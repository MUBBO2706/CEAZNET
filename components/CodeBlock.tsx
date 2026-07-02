
import React, { useState, useMemo } from 'react';
import { Copy, Check, Play } from 'lucide-react';

declare const hljs: any;

interface CodeBlockProps {
    language: string;
    code: string;
    isStreaming?: boolean;
    setCodeForPreview?: (data: { code: string; language: string; } | null) => void;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, isStreaming, setCodeForPreview }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Real-time highlighting logic using useMemo
    // This runs on every render (every stream chunk), ensuring colors appear immediately
    // Using dangerouslySetInnerHTML avoids conflicts between React and manual DOM manipulation
    const highlightedCode = useMemo(() => {
        if (typeof hljs !== 'undefined') {
            try {
                // Check if language is valid, fallback to plaintext if not
                const validLanguage = hljs.getLanguage(language) ? language : 'plaintext';
                return hljs.highlight(code, { language: validLanguage }).value;
            } catch (e) {
                console.warn('Highlight.js error:', e);
                // Basic fallback escape if highlight fails
                return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }
        }
        // Fallback if hljs not loaded
        return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }, [code, language]);

    const isRunnable = setCodeForPreview && ['html', 'htmlbars', 'javascript', 'css'].includes(language.toLowerCase());

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(code);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code: ', err);
        }
    };
    
    const handleRunClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCodeForPreview?.({
            code: code,
            language: language,
        });
    };

    return (
        <div className="rounded-xl overflow-hidden my-4 border border-neutral-200 dark:border-gray-700 shadow-sm font-sans bg-white dark:bg-[#1e1e1e]">
            {/* Header */}
            <div 
                className="flex items-stretch justify-between bg-neutral-100 dark:bg-[#25262b] border-b border-neutral-200 dark:border-gray-700 cursor-pointer select-none h-10"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                {/* Language Label: Full height, dynamic width */}
                <div className="flex items-center justify-center px-4 bg-neutral-200 dark:bg-gray-700 text-xs font-bold font-mono text-neutral-700 dark:text-gray-200 border-r border-neutral-200 dark:border-gray-600 lowercase tracking-wide">
                    {language || 'text'}
                </div>

                {/* Actions (Icon Only) - Wrapped in matching container style */}
                <div className="flex items-center gap-1 px-3 bg-neutral-200 dark:bg-gray-700 border-l border-neutral-200 dark:border-gray-600">
                    {isRunnable && (
                        <button
                            onClick={handleRunClick}
                            className="p-1.5 rounded-md text-neutral-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-300 dark:hover:bg-gray-600 transition-colors"
                            aria-label="Run code"
                            title="Run code"
                        >
                            <Play className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        onClick={handleCopy}
                        className={`p-1.5 rounded-md transition-colors ${
                            isCopied 
                                ? 'text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-900/20' 
                                : 'text-neutral-500 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-300 dark:hover:bg-gray-600'
                        }`}
                        aria-label={isCopied ? 'Copied' : 'Copy code'}
                        title={isCopied ? 'Copied' : 'Copy code'}
                    >
                        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {/* Code Body */}
            {!isCollapsed && (
                <div className="relative bg-[#FAFAFA] dark:bg-[#1E1F22]">
                    <pre className="whitespace-pre-wrap break-words p-4 text-[13px] leading-relaxed font-mono overflow-x-auto code-scrollbar">
                        <code 
                            className={`language-${language} !bg-transparent !p-0 block`}
                            dangerouslySetInnerHTML={{ __html: highlightedCode }}
                        />
                    </pre>
                </div>
            )}
        </div>
    );
};

export default CodeBlock;
