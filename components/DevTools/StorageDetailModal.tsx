import React, { useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { formatSize } from './utils';
import { InteractivePayloadViewer } from './InteractivePayloadViewer';

export interface StorageDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    storageType: 'localStorage' | 'sessionStorage' | 'cookies';
    itemKey: string;
    itemValue: string;
    itemSize: number;
    itemType: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
    isJson: boolean;
    parsed: any;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
    onSaveEdit: (newKey: string, newValue: string) => void;
    onDelete: (key: string) => void;
}

export const StorageDetailModal: React.FC<StorageDetailModalProps> = ({
    isOpen,
    onClose,
    storageType,
    itemKey,
    itemValue,
    itemSize,
    itemType,
    isJson,
    parsed,
    copiedId,
    handleCopy,
    onSaveEdit,
    onDelete
}) => {
    const [activeTab, setActiveTab] = useState<'tree' | 'raw' | 'decoded' | 'edit' | 'metadata'>('tree');
    const [editedValue, setEditedValue] = useState(itemValue);
    const [editError, setEditError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Reset edited value when item changes
    React.useEffect(() => {
        setEditedValue(itemValue);
        setEditError(null);
        setActiveTab(isJson ? 'tree' : 'raw');
    }, [itemKey, itemValue, isJson]);

    // Value decoding diagnostics (JWT, Base64, URL, Timestamps)
    const decodedInsights = useMemo(() => {
        const insights: Array<{ title: string; type: string; decoded: any; raw: string }> = [];
        const trimmed = itemValue.trim();

        // 1. Check for JWT
        if (trimmed.split('.').length === 3) {
            try {
                const parts = trimmed.split('.');
                const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                insights.push({
                    title: 'JSON Web Token (JWT)',
                    type: 'jwt',
                    decoded: { header, payload, signature: parts[2] },
                    raw: trimmed
                });
            } catch {}
        }

        // 2. Check for Base64 encoded JSON or string
        if (trimmed.length > 8 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
            try {
                const decodedStr = atob(trimmed);
                if (decodedStr && decodedStr !== trimmed) {
                    let parsedJson = null;
                    try { parsedJson = JSON.parse(decodedStr); } catch {}
                    insights.push({
                        title: 'Base64 Decoded Content',
                        type: 'base64',
                        decoded: parsedJson || decodedStr,
                        raw: decodedStr
                    });
                }
            } catch {}
        }

        // 3. Check for URL-encoded string
        if (trimmed.includes('%20') || trimmed.includes('%7B') || trimmed.includes('%22') || trimmed.includes('%3A')) {
            try {
                const decodedUrl = decodeURIComponent(trimmed);
                if (decodedUrl !== trimmed) {
                    let parsedJson = null;
                    try { parsedJson = JSON.parse(decodedUrl); } catch {}
                    insights.push({
                        title: 'URL Decoded Content',
                        type: 'url',
                        decoded: parsedJson || decodedUrl,
                        raw: decodedUrl
                    });
                }
            } catch {}
        }

        // 4. Check for UNIX Timestamp (milliseconds or seconds)
        const num = Number(trimmed);
        if (!isNaN(num) && num > 1000000000 && num < 3000000000000) {
            try {
                const ms = num < 2000000000 ? num * 1000 : num;
                const d = new Date(ms);
                if (!isNaN(d.getTime())) {
                    insights.push({
                        title: 'Timestamp / Date Representation',
                        type: 'date',
                        decoded: {
                            iso: d.toISOString(),
                            local: d.toLocaleString(),
                            relative: getRelativeTime(d.getTime()),
                            unixSeconds: Math.floor(ms / 1000),
                            unixMs: ms
                        },
                        raw: d.toISOString()
                    });
                }
            } catch {}
        }

        return insights;
    }, [itemValue]);

    function getRelativeTime(ts: number) {
        const diff = Date.now() - ts;
        const mins = Math.round(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.round(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.round(hrs / 24);
        return `${days}d ago`;
    }

    // Text stats
    const textStats = useMemo(() => {
        const lines = itemValue.split('\n').length;
        const words = itemValue.trim() ? itemValue.trim().split(/\s+/).length : 0;
        const characters = itemValue.length;
        const keyChars = itemKey.length;
        return { lines, words, characters, keyChars };
    }, [itemKey, itemValue]);

    // Format / beautify JSON
    const handleBeautify = () => {
        try {
            const parsedObj = JSON.parse(editedValue);
            setEditedValue(JSON.stringify(parsedObj, null, 2));
            setEditError(null);
        } catch (e: any) {
            setEditError(`Cannot format: ${e.message}`);
        }
    };

    // Minify JSON
    const handleMinify = () => {
        try {
            const parsedObj = JSON.parse(editedValue);
            setEditedValue(JSON.stringify(parsedObj));
            setEditError(null);
        } catch (e: any) {
            setEditError(`Cannot minify: ${e.message}`);
        }
    };

    // Save changes
    const handleSave = () => {
        try {
            onSaveEdit(itemKey, editedValue);
            setEditError(null);
            onClose();
        } catch (e: any) {
            setEditError(e.message || 'Failed to save value');
        }
    };

    // Export single key to JSON
    const handleExportSingle = () => {
        try {
            const exportData = {
                key: itemKey,
                storageType,
                exportedAt: new Date().toISOString(),
                value: isJson ? parsed : itemValue,
                sizeBytes: itemSize
            };
            const jsonStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${storageType}_${itemKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {}
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-0 sm:p-3 md:p-5 animate-fade-in">
            <div className="bg-[var(--dev-console-bg)] sm:border border-[var(--dev-console-border)] sm:rounded-xl shadow-2xl w-full h-full sm:h-[92vh] sm:max-h-[820px] sm:max-w-5xl flex flex-col overflow-hidden text-[var(--dev-console-text)] font-sans">
                {/* Modal Header */}
                <div className="flex-none px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1.5 rounded bg-[#007fd4]/10 text-[#007fd4] border border-[#007fd4]/20 shrink-0">
                            <Icon icon="solar:database-linear" className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <span className="font-mono font-bold text-xs sm:text-sm text-[var(--dev-console-syntax-property)] truncate" title={itemKey}>
                                    {itemKey}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider uppercase font-mono shrink-0 ${
                                    isJson ? 'bg-[#007fd4]/15 text-[#007fd4] border border-[#007fd4]/30' : 'bg-neutral-500/15 text-[var(--dev-console-text-muted)] border border-[var(--dev-console-border)]'
                                }`}>
                                    {itemType.toUpperCase()}
                                </span>
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-[var(--dev-console-text-muted)] font-mono truncate">
                                {storageType} • {formatSize(itemSize)} ({itemSize.toLocaleString()} bytes)
                            </span>
                        </div>
                    </div>

                    {/* Header Quick Actions */}
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <button
                            onClick={() => handleCopy(itemValue, `modal-val-${itemKey}`)}
                            className="px-2 sm:px-2.5 py-1 sm:py-1.5 rounded text-xs font-semibold flex items-center gap-1 bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] cursor-pointer transition-colors"
                            title="Copy Value"
                        >
                            {copiedId === `modal-val-${itemKey}` ? <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5 text-green-500" /> : <Icon icon="solar:copy-linear" className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">Copy Value</span>
                        </button>

                        <button
                            onClick={handleExportSingle}
                            className="p-1 sm:p-1.5 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] cursor-pointer transition-colors"
                            title="Download JSON"
                        >
                            <Icon icon="solar:download-minimalistic-linear" className="w-3.5 h-3.5" />
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1 sm:p-1.5 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)] rounded transition-colors border-0 bg-transparent cursor-pointer ml-0.5"
                            title="Close Inspector"
                        >
                            <Icon icon="tabler:x" className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Sub-Tabs Bar */}
                <div className="flex-none px-3 sm:px-4 h-9 sm:h-10 bg-[var(--dev-console-tab-bg)] border-b border-[var(--dev-console-border)] flex items-center justify-between gap-2 select-none overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-1 h-full">
                        {isJson && (
                            <button
                                onClick={() => setActiveTab('tree')}
                                className={`h-full px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                    activeTab === 'tree'
                                        ? 'border-[#007fd4] text-[#007fd4] font-bold bg-[var(--dev-console-bg)]'
                                        : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'
                                }`}
                            >
                                <Icon icon="solar:layers-minimalistic-linear" className="w-3.5 h-3.5" />
                                <span>Interactive Tree</span>
                            </button>
                        )}

                        <button
                            onClick={() => setActiveTab('raw')}
                            className={`h-full px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                activeTab === 'raw'
                                    ? 'border-[#007fd4] text-[#007fd4] font-bold bg-[var(--dev-console-bg)]'
                                    : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'
                            }`}
                        >
                            <Icon icon="solar:document-text-linear" className="w-3.5 h-3.5" />
                            <span>Raw String</span>
                            <span className="text-[10px] font-mono opacity-60">({textStats.characters})</span>
                        </button>

                        {decodedInsights.length > 0 && (
                            <button
                                onClick={() => setActiveTab('decoded')}
                                className={`h-full px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                    activeTab === 'decoded'
                                        ? 'border-purple-500 text-purple-600 dark:text-purple-400 font-bold bg-[var(--dev-console-bg)]'
                                        : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'
                                }`}
                            >
                                <Icon icon="solar:stars-minimalistic-linear" className="w-3.5 h-3.5 text-purple-500" />
                                <span>Decoded</span>
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-500/20 text-purple-600 dark:text-purple-400 font-mono font-bold">
                                    {decodedInsights.length}
                                </span>
                            </button>
                        )}

                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`h-full px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                activeTab === 'edit'
                                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold bg-[var(--dev-console-bg)]'
                                    : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'
                            }`}
                        >
                            <Icon icon="solar:pen-linear" className="w-3.5 h-3.5" />
                            <span>Live Editor</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('metadata')}
                            className={`h-full px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                                activeTab === 'metadata'
                                    ? 'border-[#007fd4] text-[#007fd4] font-bold bg-[var(--dev-console-bg)]'
                                    : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'
                            }`}
                        >
                            <Icon icon="solar:cpu-bolt-linear" className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Metadata & Diagnostics</span>
                            <span className="sm:hidden">Diagnostics</span>
                        </button>
                    </div>

                    {/* Text counts helper */}
                    {activeTab === 'raw' && (
                        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--dev-console-text-muted)] font-mono">
                            <span>{textStats.lines} lines</span>
                            <span>•</span>
                            <span>{textStats.words} words</span>
                        </div>
                    )}
                </div>

                {/* Tab Content Body (Flat & Container-less) */}
                <div className="flex-1 overflow-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                    {/* 1. Interactive Tree Tab */}
                    {activeTab === 'tree' && isJson && (
                        <div className="h-full flex flex-col text-[12px]">
                            <InteractivePayloadViewer
                                data={parsed}
                                title={itemKey}
                                size={itemSize}
                                syntaxColorClass="text-[var(--dev-console-syntax-property)]"
                                copiedId={copiedId}
                                handleCopy={handleCopy}
                                copyIdPrefix={`detail-${itemKey}`}
                                isMobile={false}
                            />
                        </div>
                    )}

                    {/* 2. Raw String Tab */}
                    {activeTab === 'raw' && (
                        <div className="h-full flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs text-[var(--dev-console-text-muted)]">
                                <span>Verbatim String ({itemValue.length} characters)</span>
                                <button
                                    onClick={() => handleCopy(itemValue, `raw-full-${itemKey}`)}
                                    className="flex items-center gap-1 text-[#007fd4] hover:underline bg-transparent border-0 cursor-pointer font-semibold"
                                >
                                    {copiedId === `raw-full-${itemKey}` ? <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5 text-green-500" /> : <Icon icon="solar:copy-linear" className="w-3.5 h-3.5" />}
                                    <span>Copy Full String</span>
                                </button>
                            </div>
                            <pre className="flex-1 p-3 sm:p-4 rounded bg-[var(--dev-payload-code-bg)] border border-[var(--dev-payload-code-border)] font-mono text-xs text-[var(--dev-console-text)] overflow-auto whitespace-pre-wrap break-all select-all leading-relaxed">
                                {itemValue}
                            </pre>
                        </div>
                    )}

                    {/* 3. Decoded Insights Tab */}
                    {activeTab === 'decoded' && (
                        <div className="flex flex-col gap-3">
                            {decodedInsights.map((insight, idx) => (
                                <div key={idx} className="p-3 sm:p-4 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-2">
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:stars-minimalistic-linear" className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                            <span className="font-bold text-xs text-[var(--dev-console-text)]">{insight.title}</span>
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold">
                                                {insight.type}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleCopy(typeof insight.decoded === 'object' ? JSON.stringify(insight.decoded, null, 2) : String(insight.decoded), `dec-${idx}`)}
                                            className="px-2 py-1 rounded text-xs bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] flex items-center gap-1 text-[var(--dev-console-text)] cursor-pointer"
                                        >
                                            {copiedId === `dec-${idx}` ? <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5 text-green-500" /> : <Icon icon="solar:copy-linear" className="w-3.5 h-3.5" />}
                                            <span>Copy</span>
                                        </button>
                                    </div>

                                    {typeof insight.decoded === 'object' && insight.decoded !== null ? (
                                        <div className="p-2 sm:p-3 rounded bg-[var(--dev-payload-code-bg)] border border-[var(--dev-payload-code-border)]">
                                            <InteractivePayloadViewer
                                                data={insight.decoded}
                                                title={`${insight.title}`}
                                                copiedId={copiedId}
                                                handleCopy={handleCopy}
                                                copyIdPrefix={`ins-${idx}`}
                                            />
                                        </div>
                                    ) : (
                                        <pre className="p-2.5 sm:p-3 rounded bg-[var(--dev-payload-code-bg)] border border-[var(--dev-payload-code-border)] font-mono text-xs overflow-auto whitespace-pre-wrap">
                                            {String(insight.decoded)}
                                        </pre>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 4. Live Editor Tab */}
                    {activeTab === 'edit' && (
                        <div className="h-full flex flex-col gap-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--dev-console-text-muted)] font-medium">
                                    Direct Modification for <strong className="text-[var(--dev-console-syntax-property)] font-mono">{itemKey}</strong>
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {isJson && (
                                        <>
                                            <button
                                                onClick={handleBeautify}
                                                className="px-2 py-1 rounded text-xs font-semibold bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] cursor-pointer"
                                            >
                                                Format JSON
                                            </button>
                                            <button
                                                onClick={handleMinify}
                                                className="px-2 py-1 rounded text-xs font-semibold bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] cursor-pointer"
                                            >
                                                Minify
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <textarea
                                value={editedValue}
                                onChange={(e) => {
                                    setEditedValue(e.target.value);
                                    setEditError(null);
                                }}
                                className="flex-1 w-full p-3 sm:p-4 rounded bg-[var(--dev-payload-code-bg)] border border-[var(--dev-payload-code-border)] font-mono text-xs text-[var(--dev-console-text)] outline-none resize-none focus:border-[#007fd4] leading-relaxed select-text"
                                placeholder="Edit storage value..."
                            />

                            {editError && (
                                <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                                    <Icon icon="solar:danger-triangle-linear" className="w-3.5 h-3.5 shrink-0" />
                                    <span>{editError}</span>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--dev-console-border)]">
                                <button
                                    onClick={() => {
                                        setEditedValue(itemValue);
                                        setEditError(null);
                                    }}
                                    className="px-3 py-1.5 rounded text-xs font-semibold bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)] cursor-pointer"
                                >
                                    Reset
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3.5 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white border-0 cursor-pointer shadow-2xs flex items-center gap-1.5"
                                >
                                    <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5" />
                                    <span>Save to Storage</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 5. Metadata & Diagnostics Tab */}
                    {activeTab === 'metadata' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            {/* Key Metadata Flat Section */}
                            <div className="p-3.5 sm:p-4 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-2.5">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--dev-console-text-muted)] flex items-center gap-1.5 border-b border-[var(--dev-console-border)] pb-2">
                                    <Icon icon="solar:cpu-bolt-linear" className="w-3.5 h-3.5 text-[#007fd4]" />
                                    Memory Footprint & Sizing
                                </h4>
                                <div className="flex flex-col gap-2 text-xs">
                                    <div className="flex justify-between items-center py-1 border-b border-[var(--dev-console-border-light)]">
                                        <span className="text-[var(--dev-console-text-muted)]">Key Name Length:</span>
                                        <span className="font-mono font-semibold">{textStats.keyChars} chars ({(textStats.keyChars * 2)} bytes)</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-[var(--dev-console-border-light)]">
                                        <span className="text-[var(--dev-console-text-muted)]">Value String Length:</span>
                                        <span className="font-mono font-semibold">{textStats.characters.toLocaleString()} chars ({(textStats.characters * 2).toLocaleString()} bytes)</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-[var(--dev-console-border-light)]">
                                        <span className="text-[var(--dev-console-text-muted)]">Total Estimated Weight:</span>
                                        <span className="font-mono font-bold text-[#007fd4]">{formatSize(itemSize)} ({itemSize.toLocaleString()} B)</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[var(--dev-console-text-muted)]">Storage Type:</span>
                                        <span className="font-mono font-semibold uppercase">{storageType}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Schema & Validation Flat Section */}
                            <div className="p-3.5 sm:p-4 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-2.5">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--dev-console-text-muted)] flex items-center gap-1.5 border-b border-[var(--dev-console-border)] pb-2">
                                    <Icon icon="solar:shield-check-linear" className="w-3.5 h-3.5 text-emerald-500" />
                                    Parsing & Schema Diagnostics
                                </h4>
                                <div className="flex flex-col gap-2 text-xs">
                                    <div className="flex justify-between items-center py-1 border-b border-[var(--dev-console-border-light)]">
                                        <span className="text-[var(--dev-console-text-muted)]">JSON Structure:</span>
                                        <span className={`font-mono font-semibold flex items-center gap-1 ${isJson ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--dev-console-text-muted)]'}`}>
                                            {isJson ? 'Valid JSON' : 'Plain Text / Primitive'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-[var(--dev-console-border-light)]">
                                        <span className="text-[var(--dev-console-text-muted)]">Detected Data Type:</span>
                                        <span className="font-mono font-bold uppercase text-[var(--dev-console-syntax-property)]">{itemType}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-[var(--dev-console-border-light)]">
                                        <span className="text-[var(--dev-console-text-muted)]">Root Entries / Fields:</span>
                                        <span className="font-mono font-semibold">
                                            {isJson && parsed && typeof parsed === 'object' 
                                                ? (Array.isArray(parsed) ? `${parsed.length} elements` : `${Object.keys(parsed).length} keys`)
                                                : '1 value'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[var(--dev-console-text-muted)]">Multi-line Count:</span>
                                        <span className="font-mono font-semibold">{textStats.lines} line(s)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action Bar */}
                <div className="flex-none px-3.5 sm:px-4 py-2 sm:py-2.5 border-t border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-between">
                    <button
                        onClick={() => {
                            onDelete(itemKey);
                            onClose();
                        }}
                        className="px-3 py-1.5 rounded text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 bg-transparent cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                        <span>Delete Key</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="px-3.5 py-1.5 rounded text-xs font-semibold bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
