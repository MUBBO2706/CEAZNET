import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, Sparkles, X, Check, Loader, Tag, RotateCcw, 
    ChevronRight, ArrowRight, HelpCircle, ExternalLink 
} from 'lucide-react';
import { 
    LUCIDE_ICON_MAP 
} from './categories';
import { 
    searchLucideIcons, 
    suggestIconsWithAi, 
    POPULAR_ICON_PRESETS, 
    AiIconCandidate,
    VALID_LUCIDE_NAMES 
} from '../../services/lucideIconService';

export interface HybridIconPickerProps {
    selectedIconName: string;
    onSelectIcon: (iconName: string) => void;
    categoryName?: string;
    categoryType?: 'expense' | 'income' | 'transfer';
    colorTextClass?: string;
    colorHex?: string;
    descriptionContext?: string;
}

export const HybridIconPicker: React.FC<HybridIconPickerProps> = ({
    selectedIconName,
    onSelectIcon,
    categoryName = '',
    categoryType = 'expense',
    colorTextClass = 'text-indigo-500',
    colorHex = '#6366f1',
    descriptionContext = ''
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activePreset, setActivePreset] = useState<string>('popular');
    const [aiSuggestions, setAiSuggestions] = useState<AiIconCandidate[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiRationale, setAiRationale] = useState<string | null>(null);
    const [hasAiSearched, setHasAiSearched] = useState(false);
    const [visibleCount, setVisibleCount] = useState(64);

    // Selected Icon Component
    const SelectedIconComp = LUCIDE_ICON_MAP[selectedIconName] || LUCIDE_ICON_MAP.Tag || Tag;

    // Reset pagination when search or preset changes
    useEffect(() => {
        setVisibleCount(64);
    }, [searchQuery, activePreset]);

    // Native search results
    const displayedIcons = useMemo(() => {
        const results = searchLucideIcons(searchQuery, {
            categoryPreset: activePreset,
            limit: visibleCount
        });
        return results;
    }, [searchQuery, activePreset, visibleCount]);

    // Handle AI Suggest Trigger
    const handleTriggerAiSuggest = async () => {
        const queryToUse = searchQuery.trim() || categoryName.trim() || 'Shopping & Goods';
        setIsAiLoading(true);
        setHasAiSearched(true);
        setAiRationale(null);

        try {
            const result = await suggestIconsWithAi(queryToUse, {
                categoryName: categoryName || queryToUse,
                type: categoryType,
                description: descriptionContext
            });

            setAiSuggestions(result.suggestions);
            setAiRationale(result.rationale);

            // If user hasn't explicitly selected an icon yet and we have a top pick, auto-select it
            if (result.topPick && (!selectedIconName || selectedIconName === 'Tag' || selectedIconName === 'Sparkles')) {
                onSelectIcon(result.topPick);
            }
        } catch (err) {
            console.error('AI Icon Suggestion failed:', err);
            setAiRationale('Could not connect to AI service. Using semantic search instead.');
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            {/* 1. Header with Selected Preview & Hybrid Search Bar */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Icon Selection</span>
                    </label>

                    {/* Active Selected Icon Badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-xs font-semibold text-gray-800 dark:text-gray-200">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">Active:</span>
                        <div className={`w-4 h-4 flex items-center justify-center ${colorTextClass}`}>
                            <SelectedIconComp className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-mono text-[11px]">{selectedIconName}</span>
                    </div>
                </div>

                {/* Hybrid Search Bar + AI Suggest Action Button */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search 1,400+ Lucide icons (e.g. gym, swiggy, petrol, flight)..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/10 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-medium text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                title="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* AI Suggest Button */}
                    <button
                        type="button"
                        onClick={handleTriggerAiSuggest}
                        disabled={isAiLoading}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 shrink-0 cursor-pointer"
                        title="Analyze brand or term with Gemini AI & live search"
                    >
                        {isAiLoading ? (
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        )}
                        <span>AI Suggest</span>
                    </button>
                </div>
            </div>

            {/* 2. AI Suggestions Shelf (Displays when available or loading) */}
            {(isAiLoading || aiSuggestions.length > 0) && (
                <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>AI Recommendations</span>
                            {isAiLoading && (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal flex items-center gap-1 ml-1">
                                    <Loader className="w-2.5 h-2.5 animate-spin" />
                                    Analyzing concept & brands...
                                </span>
                            )}
                        </div>

                        {aiSuggestions.length > 0 && !isAiLoading && (
                            <button
                                type="button"
                                onClick={() => setAiSuggestions([])}
                                className="text-[10px] text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>

                    {aiRationale && !isAiLoading && (
                        <p className="text-[11px] text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed">
                            {aiRationale}
                        </p>
                    )}

                    {/* AI Candidates Row */}
                    {!isAiLoading && aiSuggestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {aiSuggestions.map((item) => {
                                const IconComp = LUCIDE_ICON_MAP[item.iconName];
                                if (!IconComp) return null;
                                const isSelected = selectedIconName === item.iconName;

                                return (
                                    <button
                                        key={item.iconName}
                                        type="button"
                                        onClick={() => onSelectIcon(item.iconName)}
                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400 scale-[1.02]'
                                                : 'bg-white dark:bg-black/60 border border-indigo-200 dark:border-indigo-800/60 text-gray-800 dark:text-gray-200 hover:border-indigo-400 dark:hover:border-indigo-600'
                                        }`}
                                        title={item.reason}
                                    >
                                        <div className={`w-4 h-4 flex items-center justify-center ${isSelected ? 'text-white' : colorTextClass}`}>
                                            <IconComp className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="font-semibold">{item.iconName}</span>
                                        {item.relevance && (
                                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-normal ${
                                                isSelected 
                                                    ? 'bg-white/20 text-white' 
                                                    : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300'
                                            }`}>
                                                {item.relevance}
                                            </span>
                                        )}
                                        {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 3. Category Filter Tabs (when not actively searching) */}
            {!searchQuery && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                    {POPULAR_ICON_PRESETS.map((preset) => {
                        const isActive = activePreset === preset.id;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => setActivePreset(preset.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-xs'
                                        : 'bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                                }`}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setActivePreset('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                            activePreset === 'all'
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-xs'
                                : 'bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                        }`}
                    >
                        All Icons (1,400+)
                    </button>
                </div>
            )}

            {/* 4. Native Lucide Icon Grid */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] text-gray-400 dark:text-gray-500 px-0.5">
                    <span>{searchQuery ? `Matching Icons (${displayedIcons.length})` : `${POPULAR_ICON_PRESETS.find(p => p.id === activePreset)?.label || 'All'} Icons`}</span>
                    {searchQuery && (
                        <span className="text-[10px]">Filtered by semantic tags</span>
                    )}
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-1 rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                    {displayedIcons.map((name) => {
                        const IconComp = LUCIDE_ICON_MAP[name];
                        if (!IconComp) return null;
                        const isSelected = selectedIconName === name;

                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => onSelectIcon(name)}
                                className={`relative p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-md scale-105 ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-black z-10'
                                        : 'hover:bg-gray-200/70 dark:hover:bg-white/[0.08] text-gray-700 dark:text-gray-300'
                                }`}
                                title={name}
                            >
                                <IconComp className="w-4 h-4" />
                                <span className="text-[9px] truncate max-w-full font-mono opacity-60 group-hover:opacity-100 leading-tight">
                                    {name}
                                </span>
                                {isSelected && (
                                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {displayedIcons.length === 0 && (
                        <div className="col-span-full py-8 text-center space-y-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                No direct match for "{searchQuery}"
                            </p>
                            <button
                                type="button"
                                onClick={handleTriggerAiSuggest}
                                disabled={isAiLoading}
                                className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Try AI Search for "{searchQuery}"</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Load More Button for large list */}
                {displayedIcons.length >= visibleCount && (
                    <div className="flex justify-center pt-1">
                        <button
                            type="button"
                            onClick={() => setVisibleCount(prev => prev + 64)}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold py-1 px-3 cursor-pointer"
                        >
                            Load More Icons...
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HybridIconPicker;
