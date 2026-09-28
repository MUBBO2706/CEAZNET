import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Loader } from 'lucide-react';
import { AppIcon } from '../core/AppIcon';
import { CustomAiSparkleIcon } from '../SupportView';
import { CategoryIcon } from './CategoryIcon';
import { 
    searchMultiLibraryIcons, 
    searchOnlineIconify,
    fetchLibraryCollection,
    suggestMultiLibraryIconsWithAi, 
    SUPPORTED_LIBRARIES, 
    MULTI_ICON_PRESETS,
    IconItem,
    LibraryFilter
} from '../../services/multiIconService';

import type { User } from '@supabase/supabase-js';

export interface HybridIconPickerProps {
    selectedIconName: string;
    onSelectIcon: (iconName: string) => void;
    categoryName?: string;
    categoryType?: 'expense' | 'income' | 'transfer';
    colorTextClass?: string;
    colorHex?: string;
    descriptionContext?: string;
    user?: User | null;
}

export const HybridIconPicker: React.FC<HybridIconPickerProps> = ({
    selectedIconName,
    onSelectIcon,
    categoryName = '',
    categoryType = 'expense',
    colorTextClass = 'text-indigo-500',
    colorHex = '#6366f1',
    descriptionContext = '',
    user = null
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLibrary, setSelectedLibrary] = useState<string>('all');
    const [activePreset, setActivePreset] = useState<string>('popular');
    
    // View All Icons mode state
    const [isViewAllMode, setIsViewAllMode] = useState(false);
    const [fullLibraryIcons, setFullLibraryIcons] = useState<IconItem[]>([]);
    const [isLoadingCollection, setIsLoadingCollection] = useState(false);

    // AI Recommendations
    const [aiSuggestions, setAiSuggestions] = useState<Array<{ iconId: string; iconName: string; library: string; reason: string; relevance: string }>>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiRationale, setAiRationale] = useState<string | null>(null);
    const [hasAiSearched, setHasAiSearched] = useState(false);
    const [aiLoadingStepText, setAiLoadingStepText] = useState('Analyzing category & generating smart tags...');

    // Online search async results
    const [onlineIcons, setOnlineIcons] = useState<IconItem[]>([]);
    const [isOnlineSearching, setIsOnlineSearching] = useState(false);
    const [visibleCount, setVisibleCount] = useState(96);

    // Reset pagination when search or filters change
    useEffect(() => {
        setVisibleCount(96);
    }, [searchQuery, selectedLibrary, activePreset, isViewAllMode]);

    // Load full library collection if View All Mode is toggled or library changes in View All Mode
    useEffect(() => {
        if (!isViewAllMode || selectedLibrary === 'all') {
            setFullLibraryIcons([]);
            setIsLoadingCollection(false);
            return;
        }

        let isMounted = true;
        setIsLoadingCollection(true);

        fetchLibraryCollection(selectedLibrary).then(icons => {
            if (isMounted) {
                setFullLibraryIcons(icons);
                setIsLoadingCollection(false);
            }
        }).catch(err => {
            console.warn('Failed to load library collection:', err);
            if (isMounted) setIsLoadingCollection(false);
        });

        return () => {
            isMounted = false;
        };
    }, [isViewAllMode, selectedLibrary]);

    // Debounced Online search for extended 200k+ icon query (350ms delay)
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query || query.length < 2) {
            setOnlineIcons([]);
            setIsOnlineSearching(false);
            return;
        }

        let isCancelled = false;
        setIsOnlineSearching(true);

        const timer = setTimeout(async () => {
            try {
                const results = await searchOnlineIconify(query, selectedLibrary);
                if (!isCancelled) {
                    setOnlineIcons(results);
                }
            } catch (e) {
                console.warn('Online icon search error:', e);
            } finally {
                if (!isCancelled) {
                    setIsOnlineSearching(false);
                }
            }
        }, 350);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery, selectedLibrary]);

    // Local & Curated search results
    const localIcons = useMemo(() => {
        return searchMultiLibraryIcons(searchQuery, {
            libraryFilter: selectedLibrary,
            categoryPreset: activePreset,
            limit: 120
        });
    }, [searchQuery, selectedLibrary, activePreset]);

    // Combined deduplicated icons list
    const displayedIcons = useMemo(() => {
        const seen = new Set<string>();
        const combined: IconItem[] = [];

        // If user is searching text
        if (searchQuery.trim()) {
            for (const item of localIcons) {
                if (!seen.has(item.id)) {
                    seen.add(item.id);
                    combined.push(item);
                }
            }
            for (const item of onlineIcons) {
                if (!seen.has(item.id)) {
                    seen.add(item.id);
                    combined.push(item);
                }
            }
            return combined.slice(0, visibleCount);
        }

        // If in "View All Icons" mode for a library
        if (isViewAllMode && fullLibraryIcons.length > 0) {
            return fullLibraryIcons.slice(0, visibleCount);
        }

        // Standard curated / local list
        for (const item of localIcons) {
            if (!seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
            }
        }

        return combined.slice(0, visibleCount);
    }, [localIcons, onlineIcons, searchQuery, isViewAllMode, fullLibraryIcons, visibleCount]);

    // Handle AI Suggest Trigger
    const handleTriggerAiSuggest = async () => {
        const queryText = searchQuery.trim();
        const catName = categoryName.trim();
        const isGenericCat = !catName || ['category', 'new category', 'untitled'].includes(catName.toLowerCase());

        // Guard against completely empty context
        if (!queryText && isGenericCat) {
            setHasAiSearched(true);
            setAiRationale('Please type a keyword in the icon search bar or enter a Category Name above to get AI suggestions.');
            setAiSuggestions([]);
            return;
        }

        const queryToUse = queryText || catName;
        setIsAiLoading(true);
        setHasAiSearched(true);
        setAiRationale(null);
        setAiLoadingStepText(queryText ? `Analyzing "${queryText}" & generating smart tags...` : 'Analyzing category & generating smart tags...');

        try {
            const result = await suggestMultiLibraryIconsWithAi(queryToUse, {
                categoryName: !isGenericCat ? catName : undefined,
                searchQuery: queryText || undefined,
                type: categoryType,
                description: descriptionContext,
                user: user,
                onStatusUpdate: (status) => setAiLoadingStepText(status)
            });

            setAiSuggestions(result.suggestions);
            setAiRationale(result.rationale);

            // If user has not picked a custom icon yet, auto-select top pick
            if (result.topPick && (!selectedIconName || selectedIconName === 'solar:bag-heart-bold-duotone' || selectedIconName === 'solar:tag-bold-duotone' || selectedIconName === 'Tag')) {
                onSelectIcon(result.topPick);
            }
        } catch (err) {
            console.error('Multi-library AI Icon Suggestion failed:', err);
            setAiRationale('Could not connect to AI service. Displaying top semantic matches.');
        } finally {
            setIsAiLoading(false);
        }
    };

    // Helper to get short library badge styling
    const getLibraryBadge = (item: IconItem) => {
        let prefix = item.id.includes(':') ? item.id.split(':')[0] : 'lucide';
        switch (prefix) {
            case 'solar':
                return { label: 'Solar', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' };
            case 'ph':
                return { label: 'Phosphor', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' };
            case 'hugeicons':
                return { label: 'Huge', cls: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' };
            case 'tabler':
                return { label: 'Tabler', cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' };
            case 'ri':
                return { label: 'Remix', cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' };
            case 'heroicons':
                return { label: 'Hero', cls: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300' };
            default:
                return { label: 'Lucide', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' };
        }
    };

    return (
        <div className="space-y-3 font-sans">
            {/* 1. Header with Selected Preview & Hybrid Search Bar */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AppIcon name="solar:layers-minimalistic-linear" className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Icon Selection (7 Libraries)</span>
                    </label>

                    {/* Active Selected Icon (Container-less) */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Active:</span>
                        <div className={`w-4 h-4 flex items-center justify-center ${colorTextClass}`}>
                            <CategoryIcon name={selectedIconName} className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 max-w-[160px] truncate" title={selectedIconName}>
                            {selectedIconName}
                        </span>
                    </div>
                </div>

                {/* Hybrid Search Bar + AI Suggest Action Button */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <AppIcon name="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search 200,000+ icons (e.g. burger, petrol, netflix, crypto, salon)..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/10 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-medium text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                                title="Clear search"
                            >
                                <AppIcon name="solar:close-circle-linear" className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Suggest Button with Custom AI Icon */}
                    <button
                        type="button"
                        onClick={handleTriggerAiSuggest}
                        disabled={isAiLoading}
                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] border border-gray-200/90 dark:border-white/10 text-gray-900 dark:text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50 shrink-0 cursor-pointer"
                        title={
                            searchQuery.trim()
                                ? `AI match for "${searchQuery.trim()}"`
                                : categoryName.trim() && !['category', 'new category', 'untitled'].includes(categoryName.trim().toLowerCase())
                                    ? `AI match for "${categoryName.trim()}"`
                                    : 'AI icon suggestions across 7 libraries'
                        }
                    >
                        {isAiLoading ? (
                            <Loader className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                        ) : (
                            <CustomAiSparkleIcon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        )}
                        <span>{isAiLoading ? 'Suggesting...' : 'Suggest'}</span>
                    </button>
                </div>
            </div>

            {/* 2. Library Filter Chips (All 7 Libraries + Duotone) */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide py-0.5">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    {SUPPORTED_LIBRARIES.map((lib) => {
                        const isActive = selectedLibrary === lib.id;
                        return (
                            <button
                                key={lib.id}
                                type="button"
                                onClick={() => {
                                    setSelectedLibrary(lib.id);
                                    if (lib.id === 'all') {
                                        setIsViewAllMode(false);
                                    }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-xs'
                                        : 'bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                                }`}
                                title={lib.description}
                            >
                                {lib.label}
                            </button>
                        );
                    })}
                </div>

                {/* View All Icons Toggle Button for specific library */}
                {selectedLibrary !== 'all' && (
                    <button
                        type="button"
                        onClick={() => setIsViewAllMode(!isViewAllMode)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isViewAllMode
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                        }`}
                        title="Browse complete library collection"
                    >
                        <AppIcon name="solar:layers-minimalistic-linear" className="w-3.5 h-3.5" />
                        <span>{isViewAllMode ? 'View Curated' : 'View All Icons'}</span>
                    </button>
                )}
            </div>

            {/* 3. AI Suggestions Section (Containerless layout with 3-line Shimmering Skeleton Loader) */}
            {(isAiLoading || aiSuggestions.length > 0) && (
                <div className="space-y-2 py-1">
                    <div className="flex items-center justify-between">
                        {isAiLoading ? (
                            <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                <Loader className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400 animate-pulse">{aiLoadingStepText}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                <CustomAiSparkleIcon className="w-3.5 h-3.5" />
                                <span>AI Recommendations</span>
                            </div>
                        )}

                        {aiSuggestions.length > 0 && !isAiLoading && (
                            <button
                                type="button"
                                onClick={() => setAiSuggestions([])}
                                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-medium cursor-pointer"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>

                    {/* 3-Line Shimmering Skeleton Loader while AI is loading */}
                    {isAiLoading ? (
                        <div className="space-y-2.5 py-1 animate-pulse">
                            {/* Line 1: Header / CategoryContext shimmer */}
                            <div className="h-3 bg-gradient-to-r from-indigo-200/80 via-indigo-100 to-indigo-200/80 dark:from-indigo-950/80 dark:via-indigo-900/40 dark:to-indigo-950/80 rounded-md w-full" />
                            {/* Line 2: Rationale shimmer */}
                            <div className="h-3 bg-gray-200/80 dark:bg-white/10 rounded-md w-4/5" />
                            {/* Line 3: Candidate Chips Shimmer */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <div className="h-8 w-28 rounded-2xl bg-gray-200/80 dark:bg-white/10" />
                                <div className="h-8 w-32 rounded-2xl bg-gray-200/80 dark:bg-white/10" />
                                <div className="h-8 w-24 rounded-2xl bg-gray-200/80 dark:bg-white/10" />
                                <div className="h-8 w-36 rounded-2xl bg-gray-200/80 dark:bg-white/10" />
                            </div>
                        </div>
                    ) : (
                        <>
                            {aiRationale && (
                                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {aiRationale}
                                </p>
                            )}

                            {/* AI Candidates Row grouped by relevance */}
                            {aiSuggestions.length > 0 && (() => {
                                const highSuggestions = aiSuggestions.filter(s => (s.relevance || 'High').toLowerCase() === 'high');
                                const mediumSuggestions = aiSuggestions.filter(s => (s.relevance || 'High').toLowerCase() === 'medium');
                                const otherSuggestions = aiSuggestions.filter(s => {
                                    const r = (s.relevance || 'High').toLowerCase();
                                    return r !== 'high' && r !== 'medium';
                                });

                                const getRelevanceBadgeStyle = (relevance: string) => {
                                    const rel = (relevance || 'high').toLowerCase();
                                    if (rel === 'high') {
                                        return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30';
                                    }
                                    if (rel === 'medium') {
                                        return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30';
                                    }
                                    if (rel === 'intermediate') {
                                        return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30';
                                    }
                                    return 'bg-gray-100 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/30';
                                };

                                const renderSection = (title: string, items: typeof aiSuggestions, accentColorClass: string, relevanceType: 'high' | 'medium' | 'other') => {
                                    if (items.length === 0) return null;
                                    
                                    // Set section specific styles
                                    let btnStyles = {
                                        selected: 'border-2 border-blue-500 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs scale-[1.02]',
                                        normal: 'border border-blue-200/60 dark:border-blue-900/30 bg-blue-50/10 dark:bg-blue-950/5 text-gray-800 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-600'
                                    };
                                    if (relevanceType === 'high') {
                                        btnStyles = {
                                            selected: 'border-2 border-amber-500 dark:border-amber-400 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs scale-[1.02]',
                                            normal: 'border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/10 dark:bg-amber-950/5 text-gray-800 dark:text-gray-200 hover:border-amber-400 dark:hover:border-amber-600'
                                        };
                                    } else if (relevanceType === 'medium') {
                                        btnStyles = {
                                            selected: 'border-2 border-emerald-500 dark:border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs scale-[1.02]',
                                            normal: 'border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/10 dark:bg-emerald-950/5 text-gray-800 dark:text-gray-200 hover:border-emerald-400 dark:hover:border-emerald-600'
                                        };
                                    }

                                    return (
                                        <div className="space-y-1.5 pt-1.5">
                                            <div className="flex items-center gap-1.5 px-0.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${accentColorClass}`} />
                                                <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                                    {title} ({items.length})
                                                </h4>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {items.map((item) => {
                                                    const isSelected = selectedIconName === item.iconId;

                                                    return (
                                                        <button
                                                            key={item.iconId}
                                                            type="button"
                                                            onClick={() => onSelectIcon(item.iconId)}
                                                            className={`relative px-3 py-2 rounded-2xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                                                                isSelected ? btnStyles.selected : btnStyles.normal
                                                            }`}
                                                            title={item.reason}
                                                        >
                                                            {/* Top-Right Indicator Dot */}
                                                            {isSelected && (
                                                                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 ring-2 ring-white dark:ring-[#0d0d10] shadow-xs" />
                                                            )}
                                                            <div className={`w-4 h-4 flex items-center justify-center ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : colorTextClass}`}>
                                                                <CategoryIcon name={item.iconId} className="w-4 h-4" />
                                                            </div>
                                                            <span className={`font-semibold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : ''}`}>
                                                                {item.iconName || item.iconId}
                                                            </span>
                                                            {item.library && (
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-indigo-100/80 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                                                    {item.library}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <div className="space-y-3.5">
                                        {renderSection("High Recommendation", highSuggestions, "bg-amber-500", "high")}
                                        {renderSection("Medium Recommendation", mediumSuggestions, "bg-emerald-500", "medium")}
                                        {renderSection("Other AI Suggestions", otherSuggestions, "bg-blue-500", "other")}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>
            )}

            {/* 4. Category Filter Tabs (when not searching) */}
            {!searchQuery && (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5">
                    {MULTI_ICON_PRESETS.map((preset) => {
                        const isActive = activePreset === preset.id;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => setActivePreset(preset.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                                }`}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 5. Universal Multi-Library Icon Grid */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] text-gray-400 dark:text-gray-500 px-0.5">
                    <span className="flex items-center gap-1.5">
                        {searchQuery 
                            ? `Results for "${searchQuery}" (${displayedIcons.length})` 
                            : isViewAllMode 
                                ? `All ${SUPPORTED_LIBRARIES.find(l => l.id === selectedLibrary)?.label || ''} Icons (${fullLibraryIcons.length || displayedIcons.length})`
                                : `${MULTI_ICON_PRESETS.find(p => p.id === activePreset)?.label || 'Curated'} Icons`
                        }
                        {isOnlineSearching && (
                            <span className="text-[10px] text-indigo-500 flex items-center gap-1">
                                <Loader className="w-2.5 h-2.5 animate-spin" />
                                Searching 200k+ collection...
                            </span>
                        )}
                        {isLoadingCollection && (
                            <span className="text-[10px] text-indigo-500 flex items-center gap-1">
                                <Loader className="w-2.5 h-2.5 animate-spin" />
                                Loading full library collection...
                            </span>
                        )}
                    </span>
                    <span className="text-[10px] text-gray-400">
                        {SUPPORTED_LIBRARIES.find(l => l.id === selectedLibrary)?.label}
                    </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-56 overflow-y-auto custom-scrollbar p-1.5 rounded-2xl bg-gray-50/40 dark:bg-white/[0.02] border border-gray-100/80 dark:border-white/5">
                    {displayedIcons.map((item) => {
                        const isSelected = selectedIconName === item.id;
                        const badge = getLibraryBadge(item);

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onSelectIcon(item.id)}
                                className={`relative p-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer group min-h-[68px] ${
                                    isSelected
                                        ? 'border-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-xs scale-[1.02]'
                                        : 'border border-transparent hover:bg-neutral-100/60 dark:hover:bg-white/[0.04]'
                                }`}
                                title={`${item.name} (${item.id})`}
                            >
                                {/* Top-Right Indicator Dot */}
                                {isSelected && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 ring-2 ring-white dark:ring-[#0d0d10] shadow-xs" />
                                )}

                                {/* Icon Visual */}
                                <div className={`flex items-center justify-center transition-transform duration-150 ${
                                    isSelected ? 'text-indigo-600 dark:text-indigo-400 scale-110' : 'text-neutral-700 dark:text-neutral-300 group-hover:scale-105'
                                }`}>
                                    <CategoryIcon name={item.id} className="w-5 h-5" />
                                </div>

                                {/* Icon Name Label */}
                                <span className={`text-[9.5px] font-mono break-words text-center w-full px-0.5 leading-tight transition-colors line-clamp-1 ${
                                    isSelected
                                        ? 'text-indigo-700 dark:text-indigo-300 font-bold'
                                        : 'text-neutral-600 dark:text-neutral-400 font-medium group-hover:text-neutral-900 dark:group-hover:text-white'
                                }`}>
                                    {item.name}
                                </span>

                                {/* Library Badge Pill */}
                                <span className={`text-[8px] font-mono uppercase tracking-wider px-1 py-0.2 rounded leading-none ${badge.cls}`}>
                                    {badge.label}
                                </span>
                            </button>
                        );
                    })}

                    {displayedIcons.length === 0 && !isOnlineSearching && (
                        <div className="col-span-full py-8 text-center space-y-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                No icons found matching "{searchQuery}" in {selectedLibrary !== 'all' ? selectedLibrary : 'current filters'}.
                            </p>
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                {selectedLibrary !== 'all' && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedLibrary('all')}
                                        className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
                                    >
                                        Search All 7 Libraries
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleTriggerAiSuggest}
                                    disabled={isAiLoading}
                                    className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                                >
                                    <CustomAiSparkleIcon className="w-3.5 h-3.5" />
                                    <span>Ask AI to Match "{searchQuery}"</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Load More Button */}
                {displayedIcons.length >= visibleCount && (
                    <div className="flex justify-center pt-1">
                        <button
                            type="button"
                            onClick={() => setVisibleCount(prev => prev + 96)}
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
