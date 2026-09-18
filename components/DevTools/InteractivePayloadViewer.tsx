import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { shouldTruncate, formatSize } from './utils';
import { CategoryIcon } from '../finance/CategoryIcon';

interface InteractivePayloadViewerProps {
    data: any;
    title: string;
    size?: number;
    syntaxColorClass?: string;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
    copyIdPrefix: string;
    isMobile?: boolean;
}

const M_START = '\u0001\u0002';
const M_END = '\u0002\u0001';
const TRUNC_TAG = `${M_START}TRUNC:`;
const EXP_START_TAG = `${M_START}EXP_START:`;
const EXP_END_TAG = `${M_START}EXP_END:`;

const formatNumber = (n: number) => n.toLocaleString();

/**
 * Recursively formats data with selective expansion and markers for clickable links.
 */
function formatDataWithMarkers(
    val: any,
    expandedPaths: Set<string>,
    currentPath = 'root',
    keyName?: string,
    indent = 0,
    space = 2,
    visited = new WeakSet()
): string {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';

    // Handle string values (both root strings and property values)
    if (typeof val === 'string') {
        // If at root, test if it is a JSON string
        if (currentPath === 'root') {
            const trimmed = val.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return formatDataWithMarkers(parsed, expandedPaths, 'root', undefined, indent, space, visited);
                } catch {}
            }
        }

        // Check if string should be truncated
        if (shouldTruncate(val, keyName)) {
            if (expandedPaths.has(currentPath)) {
                // User intentionally expanded this specific field
                return (
                    `${EXP_START_TAG}${encodeURIComponent(currentPath)}:${val.length}${M_END}` +
                    JSON.stringify(val) +
                    `${EXP_END_TAG}${encodeURIComponent(currentPath)}${M_END}`
                );
            }

            // Otherwise, keep field truncated with clickable hyperlink marker
            const effectiveLimit = 80;
            if (val.length <= effectiveLimit) {
                return JSON.stringify(val);
            }
            const half = Math.floor((effectiveLimit - 12) / 2);
            let head = val.substring(0, half).replace(/\\+$/, '');
            let tail = val.substring(val.length - half).replace(/^\\+/, '');
            const truncatedCount = val.length - (head.length + tail.length);

            const jsonHead = JSON.stringify(head);
            const jsonTail = JSON.stringify(tail);

            return (
                jsonHead.slice(0, -1) +
                '...' +
                `${TRUNC_TAG}${encodeURIComponent(currentPath)}:${truncatedCount}${M_END}` +
                '...' +
                jsonTail.slice(1)
            );
        }

        return JSON.stringify(val);
    }

    if (typeof val === 'number' || typeof val === 'boolean') {
        return String(val);
    }

    if (typeof val === 'object') {
        if (visited.has(val)) return '"[Circular Reference]"';
        visited.add(val);

        const pad = ' '.repeat(indent + space);
        const closePad = ' '.repeat(indent);

        if (Array.isArray(val)) {
            if (val.length === 0) return '[]';

            // Check if this array itself has long binary items truncated
            const isBinaryKey = keyName && (
                keyName.toLowerCase().includes('chunk') || 
                keyName.toLowerCase().includes('audio') || 
                keyName.toLowerCase().includes('recording') || 
                keyName.toLowerCase().includes('base64') ||
                keyName.toLowerCase().includes('bytes') ||
                keyName.toLowerCase().includes('raw')
            );

            const arrayItemsPath = `${currentPath}.__items__`;
            if (isBinaryKey && val.length > 3 && !expandedPaths.has(arrayItemsPath)) {
                const firstTwo = val.slice(0, 2).map((item, idx) => {
                    const childPath = `${currentPath}[${idx}]`;
                    return `${pad}${formatDataWithMarkers(item, expandedPaths, childPath, keyName, indent + space, space, visited)}`;
                });
                const hiddenCount = val.length - 2;
                const truncMarker = `${pad}... [TRUNCATED ${TRUNC_TAG}${encodeURIComponent(arrayItemsPath)}:${hiddenCount}${M_END} array items of ${val.length}] ...`;
                return `[\n${[...firstTwo, truncMarker].join(',\n')}\n${closePad}]`;
            }

            const items = val.map((item, idx) => {
                const childPath = `${currentPath}[${idx}]`;
                return `${pad}${formatDataWithMarkers(item, expandedPaths, childPath, keyName, indent + space, space, visited)}`;
            });
            return `[\n${items.join(',\n')}\n${closePad}]`;
        }

        const entries = Object.entries(val);
        if (entries.length === 0) return '{}';

        const lines = entries.map(([k, v]) => {
            const childPath = currentPath ? `${currentPath}.${k}` : k;
            const formattedVal = formatDataWithMarkers(v, expandedPaths, childPath, k, indent + space, space, visited);
            return `${pad}${JSON.stringify(k)}: ${formattedVal}`;
        });
        return `{\n${lines.join(',\n')}\n${closePad}}`;
    }

    return String(val);
}

/**
 * Strips markers to produce standard text for copying
 */
function cleanMarkersForCopy(
    formattedText: string,
    mode: 'truncated' | 'as_shown'
): string {
    let res = formattedText.replace(
        new RegExp(`${M_START}TRUNC:(.*?):(\\d+)${M_END}`, 'g'),
        (_, __, count) => `[TRUNCATED ${formatNumber(Number(count))} chars]`
    );
    res = res.replace(new RegExp(`${M_START}EXP_START:.*?${M_END}`, 'g'), '');
    res = res.replace(new RegExp(`${M_START}EXP_END:.*?${M_END}`, 'g'), '');
    return res;
}

export const InteractivePayloadViewer: React.FC<InteractivePayloadViewerProps> = ({
    data,
    title,
    size,
    syntaxColorClass = 'text-[var(--dev-console-syntax-string)]',
    copiedId,
    handleCopy,
    copyIdPrefix,
    isMobile = false
}) => {
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const togglePath = (path: string) => {
        setExpandedPaths(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    const collapseAll = () => {
        setExpandedPaths(new Set());
    };

    // Formatted text with markers based on current expandedPaths
    const formattedWithMarkers = useMemo(() => {
        return formatDataWithMarkers(data, expandedPaths);
    }, [data, expandedPaths]);

    // Truncated string generator for copy
    const getTruncatedString = (): string => {
        const raw = formatDataWithMarkers(data, new Set());
        return cleanMarkersForCopy(raw, 'truncated');
    };

    // Current view string generator for copy
    const getCurrentViewString = (): string => {
        return cleanMarkersForCopy(formattedWithMarkers, 'as_shown');
    };

    // Full raw string generator for copy
    const getFullRawString = (): string => {
        if (data === undefined) return 'undefined';
        if (data === null) return 'null';
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data.trim());
                return JSON.stringify(parsed, null, 2);
            } catch {
                return data;
            }
        }
        try {
            return JSON.stringify(data, null, 2);
        } catch {
            return String(data);
        }
    };

    // Primary copy action
    const handlePrimaryCopy = () => {
        if (expandedPaths.size > 0) {
            handleCopy(getCurrentViewString(), `${copyIdPrefix}-shown`);
        } else {
            handleCopy(getTruncatedString(), `${copyIdPrefix}-trunc`);
        }
    };

    // Render interactive chunks
    const renderedContent = useMemo(() => {
        const splitRegex = new RegExp(
            `(${M_START}(?:TRUNC|EXP_START|EXP_END):.*?${M_END})`,
            'g'
        );
        const segments = formattedWithMarkers.split(splitRegex);

        return segments.map((segment, index) => {
            if (segment.startsWith(TRUNC_TAG) && segment.endsWith(M_END)) {
                const content = segment.slice(TRUNC_TAG.length, -M_END.length);
                const [encodedPath, countStr] = content.split(':');
                const path = decodeURIComponent(encodedPath);
                const count = parseInt(countStr, 10) || 0;

                return (
                    <button
                        key={`trunc-${index}-${path}`}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePath(path);
                        }}
                        className="inline text-[11px] font-mono font-medium text-[var(--dev-console-link)] hover:text-[var(--dev-console-link-hover)] transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 select-none align-baseline"
                        title="Click to view full untruncated content for this field"
                    >
                        [TRUNCATED {formatNumber(count)} chars]
                    </button>
                );
            }

            if (segment.startsWith(EXP_START_TAG) && segment.endsWith(M_END)) {
                const content = segment.slice(EXP_START_TAG.length, -M_END.length);
                const [encodedPath, totalStr] = content.split(':');
                const path = decodeURIComponent(encodedPath);
                const totalChars = parseInt(totalStr, 10) || 0;

                return (
                    <button
                        key={`exp-start-${index}-${path}`}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePath(path);
                        }}
                        className="inline text-[11px] font-mono font-medium text-[var(--dev-console-link)] hover:text-[var(--dev-console-link-hover)] transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 select-none align-baseline mr-1"
                        title="Click to collapse this field"
                    >
                        [COLLAPSE ({formatNumber(totalChars)} chars)]
                    </button>
                );
            }

            if (segment.startsWith(EXP_END_TAG) && segment.endsWith(M_END)) {
                const content = segment.slice(EXP_END_TAG.length, -M_END.length);
                const path = decodeURIComponent(content);

                return (
                    <button
                        key={`exp-end-${index}-${path}`}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            togglePath(path);
                        }}
                        className="inline text-[11px] font-mono font-medium text-[var(--dev-console-link)] hover:text-[var(--dev-console-link-hover)] transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 select-none align-baseline ml-1"
                        title="Click to collapse this field"
                    >
                        [COLLAPSE]
                    </button>
                );
            }

            return <React.Fragment key={`text-${index}`}>{segment}</React.Fragment>;
        });
    }, [formattedWithMarkers]);

    const isCopied = copiedId?.startsWith(copyIdPrefix);

    return (
        <div className="flex flex-col h-full">
            {/* Action Bar / Header - Responsive on both Mobile and Desktop */}
            <div className={`flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2 mb-2 border-b border-[var(--dev-console-border)] pb-2 flex-none ${isMobile ? 'px-0.5' : ''}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-[var(--dev-console-text)] font-bold uppercase text-[10.5px] sm:text-[11px] tracking-wider shrink-0">
                        {title}
                    </h3>
                    {size !== undefined && (
                        <span className="text-[var(--dev-console-text-muted)] font-normal text-[10px] sm:text-[10.5px] lowercase shrink-0">
                            ({formatSize(size)})
                        </span>
                    )}
                </div>

                {/* Right side controls: Collapse Indicator + Smart Copy */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {/* Quick Top Collapse Indicator (if any fields are expanded) */}
                    {expandedPaths.size > 0 && (
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="inline-flex items-center gap-1 text-[9.5px] sm:text-[10px] font-mono font-medium text-[var(--dev-console-link)] hover:text-[var(--dev-console-link-hover)] bg-[var(--dev-console-link-bg)] hover:bg-[var(--dev-console-bg-hover)] px-2 py-1 rounded border border-[var(--dev-console-link-border)] transition-colors cursor-pointer shrink-0"
                            title="Collapse all expanded fields"
                        >
                            <CategoryIcon name="solar:minimize-square-3-bold-duotone" className="w-3 h-3 text-[var(--dev-console-link)]" />
                            <span>
                                {isMobile ? `Collapse (${expandedPaths.size})` : `Collapse ${expandedPaths.size === 1 ? '1 field' : `all (${expandedPaths.size})`}`}
                            </span>
                        </button>
                    )}

                    {/* Smart Copy Split/Dropdown Controls */}
                    <div className="relative flex items-center shrink-0" ref={menuRef}>
                        <div className="inline-flex items-center rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] overflow-hidden shadow-xs">
                            <button
                                type="button"
                                onClick={handlePrimaryCopy}
                                className="text-[var(--dev-console-text)] hover:text-[var(--dev-console-link)] flex items-center gap-1.5 text-[10px] sm:text-[10.5px] uppercase font-mono px-2 py-1 transition-colors cursor-pointer bg-transparent border-0"
                                title={expandedPaths.size > 0 ? 'Copy as currently shown with expanded fields' : 'Copy with truncated long values'}
                            >
                                {isCopied ? (
                                    <>
                                        <CategoryIcon name="solar:check-circle-bold-duotone" className="w-3.5 h-3.5 text-[var(--dev-console-syntax-status-ok)]" />
                                        <span className="text-[var(--dev-console-syntax-status-ok)] font-semibold">Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <CategoryIcon name="solar:copy-bold-duotone" className="w-3.5 h-3.5 text-[var(--dev-console-text-muted)]" />
                                        <span>
                                            {expandedPaths.size > 0 ? `Copy View (${expandedPaths.size})` : 'Copy'}
                                        </span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsMenuOpen(prev => !prev)}
                                className="px-1.5 py-1 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] border-l border-[var(--dev-console-border)] transition-colors cursor-pointer bg-transparent"
                                title="More copy options"
                            >
                                <ChevronDown size={11} className={`transition-transform duration-150 ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {/* Dropdown Menu with Full-Width Descriptions and Multi-Icon Library Support */}
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-64 rounded-lg border border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] shadow-[var(--dev-console-shadow)] z-50 p-1.5 text-[11px] animate-in fade-in zoom-in-95 duration-100">
                                <div className="text-[9px] uppercase font-bold text-[var(--dev-console-text-muted)] px-2 py-1 tracking-wider border-b border-[var(--dev-console-border-light)] mb-1">
                                    Smart Copy Options
                                </div>

                                {/* Option 1: Copy Truncated */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleCopy(getTruncatedString(), `${copyIdPrefix}-trunc`);
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--dev-console-bg-hover)] transition-colors cursor-pointer border-0 bg-transparent flex flex-col gap-0.5"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <CategoryIcon name="solar:minimize-square-3-bold-duotone" className="w-3.5 h-3.5 text-[var(--dev-console-text-muted)] shrink-0" />
                                        <span className="font-semibold text-[10.5px] text-[var(--dev-console-text)]">Copy Truncated</span>
                                    </div>
                                    <div className="text-[9.5px] text-[var(--dev-console-text-muted)] leading-tight pl-0">
                                        Compact view with long fields truncated
                                    </div>
                                </button>

                                {/* Option 2: Copy Current View (Only visible when >=1 field is expanded!) */}
                                {expandedPaths.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleCopy(getCurrentViewString(), `${copyIdPrefix}-shown`);
                                            setIsMenuOpen(false);
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--dev-console-bg-hover)] transition-colors cursor-pointer border-0 bg-transparent flex flex-col gap-0.5"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <CategoryIcon name="solar:magic-stick-3-bold-duotone" className="w-3.5 h-3.5 text-[var(--dev-console-link)] shrink-0" />
                                            <span className="font-semibold text-[10.5px] text-[var(--dev-console-link)]">
                                                Copy Current View ({expandedPaths.size} expanded)
                                            </span>
                                        </div>
                                        <div className="text-[9.5px] text-[var(--dev-console-text-muted)] leading-tight pl-0">
                                            Expanded fields full, rest truncated
                                        </div>
                                    </button>
                                )}

                                {/* Option 3: Copy Full Raw */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleCopy(getFullRawString(), `${copyIdPrefix}-raw`);
                                        setIsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[var(--dev-console-bg-hover)] transition-colors cursor-pointer border-0 bg-transparent flex flex-col gap-0.5"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <CategoryIcon name="solar:code-file-bold-duotone" className="w-3.5 h-3.5 text-[var(--dev-console-text-muted)] shrink-0" />
                                        <span className="font-semibold text-[10.5px] text-[var(--dev-console-text)]">Copy Full Raw</span>
                                    </div>
                                    <div className="text-[9.5px] text-[var(--dev-console-text-muted)] leading-tight pl-0">
                                        100% original untruncated content
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Pre Block */}
            <div className="flex-1 overflow-auto">
                <pre className={`font-mono ${syntaxColorClass} text-[11px] whitespace-pre-wrap break-all max-w-full overflow-x-auto bg-[var(--dev-console-bg-active)] p-2.5 rounded ${isMobile ? 'mt-1' : 'ml-2 mt-2'}`}>
                    {renderedContent}
                </pre>
            </div>
        </div>
    );
};

