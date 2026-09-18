import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, TrendingUp, Layers, Clock, ArrowRight, Trash2, Loader, ChevronDown, Copy, Check } from 'lucide-react';
import { saveTranslatorUsage, getTranslationHistory, clearTranslationHistory, TranslationHistoryRecord } from '../services/dbService';
import { useToast } from './ToastSystem';

interface TranslatorStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    usage: { input: number; output: number };
    onReset: () => void;
    user: any;
}

const PAGE_SIZE = 20;

export const TranslatorStatsModal: React.FC<TranslatorStatsModalProps> = ({
    isOpen,
    onClose,
    usage,
    onReset,
    user
}) => {
    const { addToast } = useToast();
    const [isConfirmResetOpen, setIsConfirmResetOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Lazy Loaded History States
    const [historyList, setHistoryList] = useState<TranslationHistoryRecord[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // Fetch initial page on modal open
    const loadInitialHistory = useCallback(async () => {
        setIsLoadingHistory(true);
        try {
            const data = await getTranslationHistory(user, PAGE_SIZE, 0);
            setHistoryList(data);
            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            console.error("Failed to load translation history:", err);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [user]);

    useEffect(() => {
        if (isOpen) {
            loadInitialHistory();
        } else {
            setHistoryList([]);
            setExpandedId(null);
        }
    }, [isOpen, loadInitialHistory]);

    // Load More items
    const handleLoadMore = async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const nextOffset = historyList.length;
            const nextData = await getTranslationHistory(user, PAGE_SIZE, nextOffset);
            setHistoryList(prev => [...prev, ...nextData]);
            setHasMore(nextData.length === PAGE_SIZE);
        } catch (err) {
            console.error("Failed to load more translation history:", err);
        } finally {
            setIsLoadingMore(false);
        }
    };

    if (!isOpen) return null;

    const totalTokens = usage.input + usage.output;
    const estCharacters = totalTokens * 4;
    const estWords = Math.round(totalTokens * 0.75);
    const bookPages = (estWords / 250).toFixed(1);

    const handleResetConfirm = async () => {
        setIsResetting(true);
        try {
            await saveTranslatorUsage({ input: 0, output: 0 }, user);
            await clearTranslationHistory(user);
            onReset();
            setHistoryList([]);
            setIsConfirmResetOpen(false);
            addToast('Translation statistics & history reset successfully.', 'success');
        } catch (err) {
            console.error("Failed to reset statistics:", err);
            addToast('Failed to reset statistics in the database.', 'error');
        } finally {
            setIsResetting(false);
        }
    };

    const handleCopy = (text: string, key: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const formatDate = (isoString?: string) => {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
        } catch {
            return '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-neutral-900/40 dark:bg-black/75 backdrop-blur-[8px] transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Containerless Modal Body */}
            <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] bg-white/95 dark:bg-black/95 border border-neutral-100 dark:border-neutral-800/60 shadow-2xl transition-all flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-5 border-b border-neutral-100 dark:border-neutral-900/60">
                    <div>
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 tracking-tight">
                            Translation Insights
                        </h3>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 font-medium">
                            Resource consumption & on-demand history
                        </p>
                    </div>
                </div>

                {/* Content (Fully Containerless Style: No enclosed grey cards/boxes) */}
                <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 scrollbar-thin">
                    
                    {/* Hero Metric Section */}
                    <div className="flex items-baseline justify-between border-b border-neutral-100 dark:border-neutral-900/60 pb-3">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
                                Total Processed
                            </span>
                            <div className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white mt-1 tracking-tight">
                                {totalTokens.toLocaleString()} <span className="text-xs sm:text-sm font-semibold text-neutral-400 dark:text-neutral-500 font-mono">tokens</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                                Impact Equivalent
                            </span>
                            <div className="text-sm sm:text-base font-bold text-neutral-800 dark:text-neutral-200 mt-1">
                                ~{bookPages} <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Book Pages</span>
                            </div>
                        </div>
                    </div>

                    {/* Minimal Two-Column Metric Grid */}
                    <div className="grid grid-cols-2 gap-x-6 sm:gap-x-8">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                                Input Volume
                            </span>
                            <div className="text-xl sm:text-2xl font-bold text-neutral-800 dark:text-gray-200 mt-0.5 font-mono">
                                {usage.input.toLocaleString()}
                            </div>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">
                                Prompt context queries & source text
                            </p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                                Output Volume
                            </span>
                            <div className="text-xl sm:text-2xl font-bold text-neutral-800 dark:text-gray-200 mt-0.5 font-mono">
                                {usage.output.toLocaleString()}
                            </div>
                            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 font-medium">
                                Translations generated by AI engines
                            </p>
                        </div>
                    </div>

                    {/* Progress Slider Ratio */}
                    <div className="space-y-1.5 border-b border-neutral-100 dark:border-neutral-900/40 pb-3">
                        <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wider">
                            <span>Input vs Output Ratio</span>
                            <span className="font-mono">
                                {totalTokens > 0 
                                    ? `${Math.round((usage.input / totalTokens) * 100)}% / ${Math.round((usage.output / totalTokens) * 100)}%`
                                    : '0% / 0%'
                                }
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-900 rounded-full overflow-hidden flex">
                            {totalTokens > 0 ? (
                                <>
                                    <div 
                                        className="h-full bg-indigo-500 dark:bg-indigo-400" 
                                        style={{ width: `${(usage.input / totalTokens) * 100}%` }}
                                    />
                                    <div 
                                        className="h-full bg-purple-500 dark:bg-purple-400" 
                                        style={{ width: `${(usage.output / totalTokens) * 100}%` }}
                                    />
                                </>
                            ) : (
                                <div className="h-full w-full bg-neutral-100 dark:bg-neutral-900" />
                            )}
                        </div>
                    </div>

                    {/* Usage History Logs - Compact & Containerless */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900/40 pb-1.5">
                            <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                History
                            </h4>
                            {historyList.length > 0 && (
                                <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 font-mono">
                                    {historyList.length} loaded
                                </span>
                            )}
                        </div>

                        {isLoadingHistory ? (
                            <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-400 dark:text-neutral-500">
                                <Loader className="w-4 h-4 animate-spin text-indigo-500" />
                                <span className="text-xs font-medium">Fetching History...</span>
                            </div>
                        ) : historyList.length === 0 ? (
                            <div className="py-8 text-center text-neutral-400 dark:text-neutral-600">
                                <p className="text-xs font-medium">No translation history logs yet</p>
                                <p className="text-[11px] mt-0.5 text-neutral-400/80">Translate any text to see real-time logs here</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-100 dark:divide-neutral-900/50 max-h-[260px] overflow-y-auto scrollbar-thin">
                                {historyList.map((item, index) => {
                                    const itemId = item.id || `hist-${index}`;
                                    const isExpanded = expandedId === itemId;
                                    const hasText = Boolean(item.input_text || item.output_text);

                                    return (
                                        <div key={itemId} className="py-2.5 transition-colors group">
                                            {/* History Item Header */}
                                            <div 
                                                onClick={() => hasText && setExpandedId(isExpanded ? null : itemId)}
                                                className={`flex items-center justify-between gap-3 ${hasText ? 'cursor-pointer select-none' : ''}`}
                                            >
                                                {/* Left: Directional Languages + Model + Time */}
                                                <div className="min-w-0 flex-1 flex items-center flex-wrap gap-x-2 gap-y-0.5">
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                                                        <span>{item.source_lang || 'Auto'}</span>
                                                        <ArrowRight className="w-3 h-3 text-neutral-400 shrink-0" />
                                                        <span>{item.target_lang || 'English'}</span>
                                                    </div>
                                                    {item.model && (
                                                        <span className="text-[9px] font-mono font-medium text-neutral-400 dark:text-neutral-500">
                                                            {item.model.replace('Gemini ', '').replace('gemini-', '')}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                                        · {formatTime(item.created_at)}
                                                    </span>
                                                </div>
                                                
                                                {/* Right: Tokens + Chevron */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="text-right">
                                                        <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300">
                                                            {item.input_tokens + item.output_tokens}
                                                        </span>
                                                        <span className="text-[9px] text-neutral-400 font-mono ml-0.5">tk</span>
                                                    </div>
                                                    {hasText && (
                                                        <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded Text Content (Containerless & Compact) */}
                                            {isExpanded && hasText && (
                                                <div className="mt-2 pl-3 space-y-2.5 border-l-2 border-indigo-500/40 dark:border-indigo-400/30 animate-in fade-in duration-150">
                                                    {item.input_text && (
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center justify-between text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                                                                <span>Input</span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCopy(item.input_text, `${itemId}_in`);
                                                                    }}
                                                                    className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200 focus:outline-none"
                                                                >
                                                                    {copiedKey === `${itemId}_in` ? (
                                                                        <>
                                                                            <Check className="w-2.5 h-2.5 text-emerald-500" />
                                                                            <span className="text-emerald-500">Copied</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Copy className="w-2.5 h-2.5" />
                                                                            <span>Copy</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed break-words">
                                                                {item.input_text}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {item.output_text && (
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center justify-between text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                                                                <span>Translation</span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCopy(item.output_text, `${itemId}_out`);
                                                                    }}
                                                                    className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-200 focus:outline-none"
                                                                >
                                                                    {copiedKey === `${itemId}_out` ? (
                                                                        <>
                                                                            <Check className="w-2.5 h-2.5 text-emerald-500" />
                                                                            <span className="text-emerald-500">Copied</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Copy className="w-2.5 h-2.5" />
                                                                            <span>Copy</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                            <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium leading-relaxed break-words">
                                                                {item.output_text}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Load More Button */}
                                {hasMore && (
                                    <div className="pt-2 text-center">
                                        <button
                                            onClick={handleLoadMore}
                                            disabled={isLoadingMore}
                                            className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors focus:outline-none inline-flex items-center gap-1.5"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <Loader className="w-3 h-3 animate-spin" />
                                                    <span>Loading...</span>
                                                </>
                                            ) : (
                                                <span>Load More History</span>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-t border-neutral-100 dark:border-neutral-900/60 bg-neutral-50/50 dark:bg-black/60">
                    <button 
                        onClick={() => setIsConfirmResetOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors focus:outline-none rounded-xl"
                        title="Reset all accumulated tokens and history"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Stats
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 text-xs font-bold bg-neutral-950 hover:bg-neutral-900 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-black rounded-xl transition-all focus:outline-none"
                    >
                        Close
                    </button>
                </div>

                {/* Custom Confirmation Dialog Overlay */}
                {isConfirmResetOpen && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-sm rounded-[1.5rem] bg-white dark:bg-black p-6 border border-neutral-100 dark:border-neutral-800 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                            <div>
                                <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                                    Reset Stats & History?
                                </h4>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                                    This action is permanent and cannot be undone
                                </p>
                            </div>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                Are you sure you want to delete all accumulated translation statistics and cloud history logs?
                            </p>
                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <button
                                    onClick={() => !isResetting && setIsConfirmResetOpen(false)}
                                    disabled={isResetting}
                                    className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 disabled:opacity-50 transition-colors focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleResetConfirm}
                                    disabled={isResetting}
                                    className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-75 disabled:cursor-not-allowed text-white rounded-xl transition-all focus:outline-none flex items-center gap-1.5 min-w-[92px] justify-center"
                                >
                                    {isResetting ? (
                                        <>
                                            <Loader className="w-3.5 h-3.5 animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete All</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
