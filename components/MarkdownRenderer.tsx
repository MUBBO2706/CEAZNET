
import React, { memo } from 'react';
import { GroundingChunk } from '../types';
import CodeBlock from './CodeBlock';

// Renders a source citation as a small, squared number, matching the user's screenshot.
// It remains a clickable link if a valid source is provided.
const Citation: React.FC<{ source: GroundingChunk | undefined; index: number }> = ({ source, index }) => {
    const citationNumber = index + 1;
    
    // The visual element
    const content = (
        <span className="inline-flex items-center justify-center w-5 h-5 -mb-1 text-xs font-semibold text-neutral-600 dark:text-gray-300 bg-neutral-200 dark:bg-gray-700 rounded-sm mx-0.5 transition-colors">
            {citationNumber}
        </span>
    );

    if (source?.web?.uri) {
        return (
            <a
                href={source.web.uri}
                target="_blank"
                rel="noopener noreferrer"
                title={source.web.title || source.web.uri}
                className="no-underline hover:opacity-80"
            >
                {content}
            </a>
        );
    }
    
    // Non-clickable citation if no source URI
    return content;
};


// Parses inline markdown: `code` first, then **bold**, *italic*, citations, links.
// Prioritizing code prevents asterisks inside code blocks from breaking formatting.
const parseInline = (text: string, sources?: GroundingChunk[], isStreamingLastElement?: boolean): React.ReactNode => {
    // Enhanced regex to catch HTML spans with classes, alongside existing patterns
    const regex = /(<span class="[^"]+">.*?<\/span>|\`.+?\`|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|\[\d+\]|\[[^\]]*?\]\s*\([^)]*?\)|https?:\/\/[^\s\)]+|www\.[^\s\)]+)/g;
    const urlRegex = /^(https?:\/\/[^\s\)]+|www\.[^\s\)]+)$/;
    const markdownLinkRegex = /^\[([\s\S]*?)\]\s*\(([\s\S]*?)\)$/;
    const spanRegex = /^<span class="([^"]+)">(.*?)<\/span>$/;

    const parts = text.split(regex).filter(Boolean);

    return parts.map((part, i) => {
        // Handle HTML Spans (for dynamic colors/fonts)
        const spanMatch = part.match(spanRegex);
        if (spanMatch) {
            const className = spanMatch[1];
            const content = spanMatch[2];
            return <span key={i} className={className}>{content}</span>;
        }

        // Handle Inline Code `text` - Checked First
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-neutral-200 dark:bg-gray-700/60 text-neutral-800 dark:text-gray-200 font-mono text-xs font-medium px-1.5 py-0.5 rounded-md mx-0.5">{part.slice(1, -1)}</code>;
        }

        // Handle Citation [1]
        const citationMatch = part.match(/^\[(\d+)\]$/);
        if (citationMatch) {
            const index = parseInt(citationMatch[1], 10) - 1;
            if (index >= 0) {
                const source = sources?.[index];
                return <Citation key={i} source={source} index={index} />;
            }
        }

        // Handle Markdown Link [text](url)
        const mdLinkMatch = part.match(markdownLinkRegex);
        if (mdLinkMatch) {
            const linkText = mdLinkMatch[1]; 
            const linkUrl = mdLinkMatch[2].trim(); 
            return (
                <a
                    key={i}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 dark:text-amber-400 hover:underline font-medium break-words"
                >
                    {linkText}
                </a>
            );
        }

        if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
            return <em key={i}>{part.slice(1, -1)}</em>;
        }
        
        // Handle Raw URL
        if (urlRegex.test(part)) {
            const href = part.startsWith('www.') ? `https://${part}` : part;
            return (
                <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-900/50 hover:bg-amber-200/80 dark:hover:bg-amber-800/60 font-medium px-2 py-0.5 rounded-full no-underline hover:underline break-all"
                >
                    {part}
                </a>
            );
        }

        // It's a plain text part. Animate it word-by-word if it's the last part of a streaming element.
        const isLastPart = isStreamingLastElement && i === parts.length - 1;
        if (isLastPart) {
            return (
                <span key={i}>
                    {part.split(/(\s+)/).map((word, wordIndex) => (
                        <span key={wordIndex} className="streaming-word">
                            {word}
                        </span>
                    ))}
                </span>
            );
        }

        return part;
    });
};

interface MarkdownRendererProps {
    content: string;
    sources?: GroundingChunk[];
    isStreaming?: boolean;
    setCodeForPreview?: (data: { code: string; language: string; } | null) => void;
}

interface ListItem {
    content: React.ReactNode;
    value?: number; // Stores the number for <ol> items to persist sequence even if broken
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, sources, isStreaming, setCodeForPreview }) => {
    const safeContent = typeof content === 'string' ? content : (content ? String(content) : '');
    const lines = safeContent.split('\n');
    const elements: React.JSX.Element[] = [];
    
    // Updated to store objects instead of just nodes so we can track the 'value' attribute
    let currentList: { type: 'ul' | 'ol'; items: ListItem[] } | null = null;
    
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';

    const flushList = (key: string | number) => {
        if (currentList) {
            const ListTag = currentList.type;
            const className = `${
                ListTag === 'ul' ? 'list-disc' : 'list-decimal'
            } list-inside space-y-1 my-3 pl-5`;
            elements.push(
                <ListTag key={key} className={className}>
                    {currentList.items.map((item, i) => (
                        <li key={i} value={item.value}>{item.content}</li>
                    ))}
                </ListTag>
            );
            currentList = null;
        }
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const isLastLine = !!isStreaming && i === lines.length - 1;

        // Key Points block detection
        const keyPointsHeadingMatch = line.match(/^###\s*(Key Points|Key Takeaways|In This Article)\s*$/i);
        if (keyPointsHeadingMatch) {
            flushList(`list-before-key-points-${i}`);
            
            const keyPointsTitle = keyPointsHeadingMatch[0].replace(/###\s*/, '');
            const keyPointsItems: React.ReactNode[] = [];
            let listIndex = i + 1;

            // Skip empty lines after heading
            while (listIndex < lines.length && lines[listIndex].trim() === '') {
                listIndex++;
            }

            // Consume list items
            while (listIndex < lines.length) {
                const listItemLine = lines[listIndex];
                const ulMatch = listItemLine.match(/^(\s*)(\*|-)\s+(.*)/);
                if (ulMatch) {
                    keyPointsItems.push(<li key={listIndex}>{parseInline(ulMatch[3], sources)}</li>);
                    listIndex++;
                } else {
                    break; // End of the list
                }
            }
            
            if (keyPointsItems.length > 0) {
                elements.push(
                    <div key={`key-points-${i}`} className="article-key-points">
                        <h3>{keyPointsTitle}</h3>
                        <ul>{keyPointsItems}</ul>
                    </div>
                );
                i = listIndex; // Move parser past the consumed block
                continue;
            }
        }

        // HTML Blocks (e.g. Finance Widgets)
        // Detects lines starting with <div or the specific widget comments and renders them as raw HTML
        if (line.trim().startsWith('<!-- FINANCE_WIDGET') || line.trim().startsWith('<div') || line.trim().startsWith('<h1') || line.trim().startsWith('<hr')) {
            flushList(`list-before-html-${i}`);
            elements.push(
                <div key={i} dangerouslySetInnerHTML={{ __html: line }} />
            );
            i++;
            continue;
        }

        // Code blocks
        if (line.trim().startsWith('```')) {
            flushList(`list-before-code-${i}`);
            if (inCodeBlock) {
                const code = codeBlockContent.join('\n');
                const lang = codeBlockLanguage;
                elements.push(<CodeBlock 
                    key={`code-${i}`} 
                    language={lang} 
                    code={code}
                    isStreaming={isStreaming}
                    setCodeForPreview={setCodeForPreview}
                />);
                inCodeBlock = false;
                codeBlockContent = [];
                codeBlockLanguage = '';
            } else {
                inCodeBlock = true;
                codeBlockLanguage = line.trim().substring(3).trim();
            }
            i++;
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line);
            i++;
            continue;
        }

        // Table parsing
        const isTableLine = (l: string | undefined): l is string => !!l && l.includes('|');
        const isSeparatorLine = (l: string | undefined): l is string => {
            if (!l) return false;
            let core = l.trim();
            if (core.startsWith('|')) core = core.slice(1);
            if (core.endsWith('|')) core = core.slice(0, -1);
            
            const segments = core.split('|');
            if (segments.length === 0) return false;
            // Every segment must be made of hyphens, with optional colons for alignment
            return segments.every(seg => /^\s*:?-+:?\s*$/.test(seg));
        };
        
        if (isTableLine(line) && isSeparatorLine(lines[i + 1])) {
            flushList(`list-before-table-${i}`);
            
            const headerLine = lines[i];
            const separatorLine = lines[i + 1];
            const headerContent = headerLine.split('|').slice(1, -1).map(s => s.trim());
            const separatorContent = separatorLine.split('|').slice(1, -1).map(s => s.trim());
            
            if (headerContent.length === separatorContent.length && headerContent.length > 0) {
                const tableRows: string[][] = [];
                let tableRowIndex = i + 2;
                while (tableRowIndex < lines.length && isTableLine(lines[tableRowIndex])) {
                    tableRows.push(lines[tableRowIndex].split('|').slice(1, -1).map(s => s.trim()));
                    tableRowIndex++;
                }

                const alignments = separatorContent.map(s => {
                    const hasLeft = s.startsWith(':');
                    const hasRight = s.endsWith(':');
                    if (hasLeft && hasRight) return 'center';
                    if (hasRight) return 'right';
                    return 'left';
                });

                elements.push(
                    <div key={`table-wrapper-${i}`} className="my-4 overflow-x-auto code-scrollbar">
                        <table className="min-w-full text-sm border-collapse border border-neutral-300 dark:border-gray-600">
                            <thead>
                                <tr>
                                    {headerContent.map((header, colIndex) => (
                                        <th 
                                            key={colIndex} 
                                            scope="col" 
                                            className="px-4 py-2 font-semibold text-neutral-800 dark:text-gray-200 bg-neutral-100 dark:bg-gray-800/50 border border-neutral-300 dark:border-gray-600"
                                            style={{ textAlign: alignments[colIndex] || 'left' }}
                                        >
                                            {parseInline(header, sources)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="bg-white dark:bg-[#1e1f22] even:bg-neutral-50 dark:even:bg-gray-800/30">
                                        {row.map((cell, cellIndex) => (
                                            <td 
                                                key={cellIndex} 
                                                className="px-4 py-2 text-neutral-700 dark:text-gray-300 border border-neutral-300 dark:border-gray-600"
                                                style={{ textAlign: alignments[cellIndex] || 'left' }}
                                            >
                                                {parseInline(cell, sources, isStreaming && isLastLine && rowIndex === tableRows.length - 1 && cellIndex === row.length - 1)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                
                i = tableRowIndex;
                continue;
            }
        }

        // Horizontal Rules
        if (line.match(/^(---|___|\*\*\*)\s*$/)) {
            flushList(`list-before-hr-${i}`);
            elements.push(<hr key={i} className="my-4 border-neutral-200 dark:border-gray-700" />);
            i++;
            continue;
        }
        
        // Headings (h1-h6)
        const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
            flushList(`list-before-h-${i}`);
            const level = headingMatch[1].length;
            const HeadingTag = `h${level}` as keyof React.JSX.IntrinsicElements;
            const text = headingMatch[2];
            elements.push(React.createElement(HeadingTag, { key: i }, parseInline(text, sources, isLastLine)));
            i++;
            continue;
        }
        
        // Unordered lists
        const ulMatch = line.match(/^(\s*)(\*|-)\s+(.*)/);
        if (ulMatch) {
            if (currentList?.type !== 'ul') {
                flushList(`list-before-ul-${i}`);
                currentList = { type: 'ul', items: [] };
            }
            currentList.items.push({ content: parseInline(ulMatch[3], sources, isLastLine) });
            i++;
            continue;
        }

        // Ordered lists
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
        if (olMatch) {
            if (currentList?.type !== 'ol') {
                flushList(`list-before-ol-${i}`);
                currentList = { type: 'ol', items: [] };
            }
            // Capture the number from the text.
            const itemNumber = parseInt(olMatch[2], 10);
            
            currentList.items.push({ 
                content: parseInline(olMatch[3], sources, isLastLine),
                value: itemNumber
            });
            i++;
            continue;
        }

        // --- Handle Empty Lines in Lists ---
        if (line.trim() === '' && currentList) {
            let j = i + 1;
            while (j < lines.length && lines[j].trim() === '') {
                j++;
            }
            
            if (j < lines.length) {
                const nextLine = lines[j];
                const nextIsUl = /^(\s*)(\*|-)\s+(.*)/.test(nextLine);
                const nextIsOl = /^(\s*)(\d+)\.\s+(.*)/.test(nextLine);
                
                if ((currentList.type === 'ul' && nextIsUl) || (currentList.type === 'ol' && nextIsOl)) {
                    i++;
                    continue; 
                }
            }
        }

        // Paragraphs and empty lines
        flushList(`list-before-p-${i}`);
        if (line.trim() !== '') {
            elements.push(<p key={i}>{parseInline(line, sources, isLastLine)}</p>);
        } else if (elements.length > 0 && lines[i-1]?.trim() !== '') {
            elements.push(<div key={`spacer-${i}`} className="h-1"></div>);
        }
        i++;
    }

    flushList('list-at-end');

    if (inCodeBlock) {
        const code = codeBlockContent.join('\n');
        const lang = codeBlockLanguage;
        elements.push(<CodeBlock 
            key="code-at-end" 
            language={lang} 
            code={code}
            isStreaming={isStreaming}
            setCodeForPreview={setCodeForPreview}
        />);
    }

    return <>{elements}</>;
};

export default memo(MarkdownRenderer);
