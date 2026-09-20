import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { 
    ArrowLeft, Plus, Search, Tag, Check, Loader, 
    Sparkles, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, AlertTriangle, 
    Layers, Filter, Eye, Palette, CheckCircle2, ChevronRight, X,
    TrendingUp, ArrowUpDown, Wallet
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { FinanceProfile } from '../../types';
import { 
    CATEGORY_CONFIG, 
    LUCIDE_ICON_MAP, 
    getCategoryConfig 
} from './categories';
import { 
    getCustomCategories, 
    saveCustomCategory, 
    deleteCustomCategory, 
    hideCategory, 
    getFinanceProfiles,
    getFinanceAnalytics,
    CustomCategoryItem 
} from '../../services/dbService';
import { useGlobalModal } from '../core/GlobalModalProvider';
import { CategoryDetailView } from './CategoryDetailView';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

export interface CategoryManagerViewProps {
    user: User | null;
    onBack: () => void;
    setCategoryHeaderState?: (state: { 
        title: string | null; 
        onBack?: () => void; 
        isDetail?: boolean;
        isSaving?: boolean;
        isDeleting?: boolean;
        isCustom?: boolean;
        isNew?: boolean;
        canSave?: boolean;
        onSave?: () => void;
        onDelete?: () => void;
    }) => void;
}

export interface UnifiedCategory {
    id: string;
    label: string;
    type: 'expense' | 'income' | 'transfer';
    iconName: string;
    color: string;
    bg: string;
    isCustom: boolean;
    txCount: number;
    txTotal: number;
}

const SORT_OPTIONS: CustomSelectOption[] = [
    { 
        value: 'customFirst', 
        label: 'Custom First', 
        description: 'Prioritize custom categories',
        icon: <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
    },
    { 
        value: 'txCount', 
        label: 'Most Used', 
        description: 'Sort by transaction count',
        icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
    },
    { 
        value: 'txTotal', 
        label: 'Highest Volume', 
        description: 'Sort by total money spent/received',
        icon: <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
    },
    { 
        value: 'name', 
        label: 'Alphabetical (A-Z)', 
        description: 'Sort by category name',
        icon: <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
    }
];

interface CategoryItemRowProps {
    category: UnifiedCategory;
    onOpenDetail: (id: string, type: 'expense' | 'income' | 'transfer') => void;
}

const CategoryItemRow: React.FC<CategoryItemRowProps> = React.memo(({ category, onOpenDetail }) => {
    const IconComponent = LUCIDE_ICON_MAP[category.iconName] || Tag;
    return (
        <div
            onClick={() => onOpenDetail(category.id, category.type)}
            className="group flex items-center justify-between gap-3.5 sm:gap-4 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 hover:bg-black/[0.025] dark:hover:bg-white/[0.035] transition-colors duration-150 cursor-pointer select-none"
        >
            {/* Left: Icon matching main TransactionItem (No background highlight) + Info */}
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                <div className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-150">
                    <IconComponent className={`w-6 h-6 sm:w-6.5 sm:h-6.5 ${category.color}`} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-[15px] font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {category.label}
                        </h3>
                        {category.isCustom && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                                Custom
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs sm:text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="capitalize font-semibold text-gray-700 dark:text-gray-300">
                            {category.type}
                        </span>
                        <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full flex-shrink-0"></span>
                        <span>
                            {category.txCount} {category.txCount === 1 ? 'transaction' : 'transactions'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Right: Volume Total and Navigation indicator */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <div className="text-right flex flex-col items-end gap-0.5">
                    <div className="font-mono font-bold text-base sm:text-[15px] text-gray-900 dark:text-white tabular-nums">
                        ₹{Math.round(category.txTotal).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">
                        Volume
                    </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
        </div>
    );
});

export const CategoryManagerView: React.FC<CategoryManagerViewProps> = ({
    user,
    onBack,
    setCategoryHeaderState
}) => {
    const { alert: globalAlert, confirm: globalConfirm } = useGlobalModal();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data states
    const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([]);
    const [profiles, setProfiles] = useState<FinanceProfile[]>([]);
    const [categoryStats, setCategoryStats] = useState<Array<{ category: string; count: number; total: number; type: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);

    const FILTER_STORAGE_KEY = 'ceaznet_cat_mgr_active_filter';
    const SORT_STORAGE_KEY = 'ceaznet_cat_mgr_sort_by';
    const WALLET_STORAGE_KEY = 'ceaznet_active_wallet_id';

    // Active Wallet
    const [activeWalletId, setActiveWalletId] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(WALLET_STORAGE_KEY);
            if (saved) return saved;
        } catch (e) {
            console.warn('Failed to read active wallet from localStorage', e);
        }
        return 'default';
    });

    // Filtering & Sorting with localStorage persistence
    const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer' | 'custom'>(() => {
        try {
            const saved = localStorage.getItem(FILTER_STORAGE_KEY);
            if (saved && ['all', 'expense', 'income', 'transfer', 'custom'].includes(saved)) {
                return saved as any;
            }
        } catch (e) {
            console.warn('Failed to read activeTypeFilter from localStorage', e);
        }
        return 'all';
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<string>(() => {
        try {
            const saved = localStorage.getItem(SORT_STORAGE_KEY);
            if (saved && ['customFirst', 'txCount', 'txTotal', 'name'].includes(saved)) {
                return saved;
            }
        } catch (e) {
            console.warn('Failed to read sortBy from localStorage', e);
        }
        return 'customFirst';
    });

    useEffect(() => {
        try {
            localStorage.setItem(FILTER_STORAGE_KEY, activeTypeFilter);
        } catch (e) {
            console.warn('Failed to persist activeTypeFilter', e);
        }
    }, [activeTypeFilter]);

    useEffect(() => {
        try {
            localStorage.setItem(SORT_STORAGE_KEY, sortBy);
        } catch (e) {
            console.warn('Failed to persist sortBy', e);
        }
    }, [sortBy]);

    // Check if user is currently viewing/editing a detail page
    const detailIdFromUrl = searchParams.get('id');
    const isNewFromUrl = searchParams.get('new') === 'true';
    const detailTypeFromUrl = (searchParams.get('type') as 'expense' | 'income' | 'transfer') || 'expense';

    const activeDetailId = isNewFromUrl ? 'new' : detailIdFromUrl;

    const onBackRef = useRef(onBack);
    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    const handleHeaderBack = useCallback(() => {
        onBackRef.current();
    }, []);

    // Synchronize Floating Header for Category List View
    useEffect(() => {
        if (!activeDetailId) {
            setCategoryHeaderState?.({
                title: 'Categories',
                onBack: handleHeaderBack,
                isDetail: false
            });
        }
    }, [activeDetailId, handleHeaderBack, setCategoryHeaderState]);

    useEffect(() => {
        return () => {
            setCategoryHeaderState?.({ title: null });
        };
    }, [setCategoryHeaderState]);

    // Load custom categories, profiles, and wallet-scoped analytics (minimal egress)
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const profileParam = activeWalletId === 'all' 
                ? undefined 
                : (activeWalletId === 'default' ? null : activeWalletId);

            const [cats, profs, analytics] = await Promise.all([
                getCustomCategories(user),
                getFinanceProfiles(user),
                getFinanceAnalytics(user, { profileId: profileParam })
            ]);

            setCustomCategories(cats || []);
            setProfiles(profs || []);
            setCategoryStats(analytics?.categories || []);
        } catch (err) {
            console.error('Error loading category manager data:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user, activeWalletId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Wallet options for dropdown
    const walletOptions = useMemo<CustomSelectOption[]>(() => {
        const options: CustomSelectOption[] = [
            {
                value: 'default',
                label: 'Main Wallet',
                description: 'Default wallet',
                icon: <Wallet className="w-3.5 h-3.5 text-indigo-500" />
            }
        ];

        profiles.forEach(p => {
            options.push({
                value: p.id,
                label: p.name,
                description: `${p.type || 'Custom'} profile`,
                icon: <Wallet className="w-3.5 h-3.5 text-emerald-500" />
            });
        });

        options.push({
            value: 'all',
            label: 'All Wallets',
            description: 'Across all wallets',
            icon: <Layers className="w-3.5 h-3.5 text-amber-500" />
        });

        return options;
    }, [profiles]);

    const activeWalletName = useMemo(() => {
        if (activeWalletId === 'default' || !activeWalletId) return 'Main Wallet';
        if (activeWalletId === 'all') return 'All Wallets';
        const found = profiles.find(p => p.id === activeWalletId);
        return found ? found.name : 'Main Wallet';
    }, [activeWalletId, profiles]);

    // Build transaction usage map from lightweight analytics
    const usageMap = useMemo(() => {
        const map = new Map<string, { count: number; total: number }>();
        (categoryStats || []).forEach(c => {
            const cat = (c.category || 'Other').trim().toLowerCase();
            const current = map.get(cat) || { count: 0, total: 0 };
            map.set(cat, {
                count: current.count + Number(c.count || 0),
                total: current.total + Math.abs(Number(c.total || 0))
            });
        });
        return map;
    }, [categoryStats]);

    // Build unified category list
    const allCategories = useMemo<UnifiedCategory[]>(() => {
        const list: UnifiedCategory[] = [];
        const seenIds = new Set<string>();

        // 1. Add Custom Categories first
        customCategories.forEach(c => {
            const idKey = c.id.toLowerCase();
            const labelKey = (c.label || '').toLowerCase();
            seenIds.add(idKey);
            if (labelKey) seenIds.add(labelKey);
            seenIds.add(idKey.replace(/[_\s-]+/g, ' '));
            if (labelKey) seenIds.add(labelKey.replace(/[_\s-]+/g, ' '));
            const usage = usageMap.get(idKey) || usageMap.get(labelKey) || { count: 0, total: 0 };
            list.push({
                id: c.id,
                label: c.label || c.id,
                type: c.type || 'expense',
                iconName: c.iconName || 'Tag',
                color: c.color || 'text-indigo-500',
                bg: c.bg || 'bg-indigo-100 dark:bg-indigo-950/40',
                isCustom: true,
                txCount: usage.count,
                txTotal: usage.total
            });
        });

        // 2. Add Standard Categories
        const types: Array<'expense' | 'income' | 'transfer'> = ['expense', 'income', 'transfer'];
        types.forEach(t => {
            const stdList = CATEGORY_CONFIG[t] || [];
            stdList.forEach(c => {
                const idKey = c.id.toLowerCase();
                const labelKey = c.label.toLowerCase();
                const normId = idKey.replace(/[_\s-]+/g, ' ');
                const normLabel = labelKey.replace(/[_\s-]+/g, ' ');
                if (seenIds.has(idKey) || seenIds.has(labelKey) || seenIds.has(normId) || seenIds.has(normLabel)) return; // custom override
                seenIds.add(idKey);
                seenIds.add(labelKey);

                // Find icon name
                const matchedIconName = (c as any).iconName || 'solar:tag-bold-duotone';

                const usage = usageMap.get(idKey) || usageMap.get(c.label.toLowerCase()) || { count: 0, total: 0 };

                list.push({
                    id: c.id,
                    label: c.label,
                    type: t,
                    iconName: matchedIconName,
                    color: c.color || 'text-indigo-500',
                    bg: c.bg || 'bg-indigo-100 dark:bg-indigo-950/40',
                    isCustom: false,
                    txCount: usage.count,
                    txTotal: usage.total
                });
            });
        });

        return list;
    }, [customCategories, usageMap]);

    // Filter & Sort categories
    const displayedCategories = useMemo(() => {
        let list = [...allCategories];

        // Type filter
        if (activeTypeFilter === 'custom') {
            list = list.filter(c => c.isCustom);
        } else if (activeTypeFilter !== 'all') {
            list = list.filter(c => c.type === activeTypeFilter);
        }

        // Search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            list = list.filter(c => 
                c.label.toLowerCase().includes(query) ||
                c.id.toLowerCase().includes(query) ||
                c.type.toLowerCase().includes(query) ||
                c.iconName.toLowerCase().includes(query)
            );
        }

        // Sorting
        list.sort((a, b) => {
            if (sortBy === 'customFirst') {
                if (a.isCustom !== b.isCustom) return a.isCustom ? -1 : 1;
                return b.txCount - a.txCount || a.label.localeCompare(b.label);
            }
            if (sortBy === 'txCount') {
                return b.txCount - a.txCount || a.label.localeCompare(b.label);
            }
            if (sortBy === 'txTotal') {
                return b.txTotal - a.txTotal || a.label.localeCompare(b.label);
            }
            if (sortBy === 'name') {
                return a.label.localeCompare(b.label);
            }
            return 0;
        });

        return list;
    }, [allCategories, activeTypeFilter, searchQuery, sortBy]);

    // Tab item counts
    const tabCounts = useMemo(() => ({
        all: allCategories.length,
        expense: allCategories.filter(c => c.type === 'expense').length,
        income: allCategories.filter(c => c.type === 'income').length,
        transfer: allCategories.filter(c => c.type === 'transfer').length,
        custom: allCategories.filter(c => c.isCustom).length,
    }), [allCategories]);

    const filterTabs = useMemo(() => [
        { 
            id: 'all' as const, 
            label: 'All', 
            icon: <Layers className="w-3.5 h-3.5" />, 
            count: tabCounts.all 
        },
        { 
            id: 'expense' as const, 
            label: 'Expenses', 
            icon: <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />, 
            count: tabCounts.expense 
        },
        { 
            id: 'income' as const, 
            label: 'Income', 
            icon: <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />, 
            count: tabCounts.income 
        },
        { 
            id: 'transfer' as const, 
            label: 'Transfers', 
            icon: <ArrowLeftRight className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />, 
            count: tabCounts.transfer 
        },
        { 
            id: 'custom' as const, 
            label: 'Custom', 
            icon: <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />, 
            count: tabCounts.custom 
        },
    ], [tabCounts]);

    // Open detail page
    const handleOpenDetail = (catId: string, catType: 'expense' | 'income' | 'transfer' = 'expense') => {
        setSearchParams({ id: catId, type: catType });
    };

    // Open create page
    const handleOpenCreate = () => {
        setSearchParams({ new: 'true', type: activeTypeFilter !== 'all' && activeTypeFilter !== 'custom' ? activeTypeFilter : 'expense' });
    };

    // Close detail page
    const handleCloseDetail = () => {
        setSearchParams({});
    };

    // Render Category Detail Page if activeDetailId is set
    if (activeDetailId) {
        return (
            <CategoryDetailView
                categoryId={activeDetailId === 'new' ? null : activeDetailId}
                categoryType={detailTypeFromUrl}
                user={user}
                walletId={activeWalletId}
                walletName={activeWalletName}
                categoryStats={categoryStats}
                onBack={handleCloseDetail}
                setCategoryHeaderState={setCategoryHeaderState}
                onSaved={async () => {
                    await loadData();
                    handleCloseDetail();
                }}
                onDeleted={async () => {
                    await loadData();
                    handleCloseDetail();
                }}
            />
        );
    }

    return (
        <div className="relative z-10 h-full overflow-y-auto bg-transparent scrollbar-hide pt-20 sm:pt-24 pb-28 dev-console-spacing-pb font-sans">
            <div className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
                
                {/* Header Row: Title & Subtitle + Active Wallet Selector (Side-by-side on Mobile & Desktop) */}
                <div className="flex flex-row items-center justify-between gap-2.5 sm:gap-4 pb-3 border-b border-gray-200/70 dark:border-white/10">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                            Category Management
                        </h1>
                        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block mt-0.5">
                            Manage categories for <strong className="font-semibold text-gray-700 dark:text-gray-300">{activeWalletName}</strong>. Select another wallet anytime.
                        </p>
                    </div>

                    {/* Quick Wallet Selector in Header */}
                    <div className="w-36 sm:w-52 shrink-0">
                        <CustomSelect
                            value={activeWalletId}
                            onChange={val => {
                                setActiveWalletId(val);
                                try {
                                    localStorage.setItem(WALLET_STORAGE_KEY, val);
                                } catch (e) {}
                            }}
                            options={walletOptions}
                            placeholder="Select Wallet..."
                            id="category-wallet-header-select"
                            size="sm"
                            align="right"
                        />
                    </div>
                </div>

                {/* Filter Tabs & Search / Sort Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
                    
                    {/* Enhanced Segmented Filter Tabs - Content width only (w-fit) */}
                    <div className="w-fit max-w-full inline-flex items-center gap-1 p-1 rounded-2xl bg-[var(--cat-tab-bg)] border border-[var(--cat-tab-border)] overflow-x-auto scrollbar-hide shrink-0">
                        {filterTabs.map(tab => {
                            const isActive = activeTypeFilter === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTypeFilter(tab.id)}
                                    className={`relative px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors duration-200 whitespace-nowrap select-none cursor-pointer flex items-center gap-1.5 shrink-0 ${
                                        isActive
                                            ? 'text-[var(--cat-tab-active-text)] font-bold'
                                            : 'text-[var(--cat-tab-inactive-text)] hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeCategoryTab"
                                            className="absolute inset-0 bg-[var(--cat-tab-active-bg)] rounded-xl shadow-xs border border-gray-200/60 dark:border-white/10"
                                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        <span className="shrink-0 flex items-center justify-center">{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold transition-colors ${
                                            isActive
                                                ? 'bg-[var(--cat-tab-badge-bg)] text-[var(--cat-tab-badge-text)]'
                                                : 'bg-black/[0.04] dark:bg-white/[0.06] text-gray-400 dark:text-gray-500'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search & Custom Sort Dropdown (Matching exact height: h-9 / 36px) */}
                    <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                        {/* Search Bar - Fixed padding to eliminate icon & placeholder collision */}
                        <div className="relative flex-1 sm:w-60">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search categories..."
                                className="w-full pl-9 pr-8 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-all h-9 min-h-[36px] max-h-[36px] box-border"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                                    title="Clear search"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Custom Sort Select */}
                        <div className="w-40 sm:w-44 shrink-0">
                            <CustomSelect
                                value={sortBy}
                                onChange={val => setSortBy(val)}
                                options={SORT_OPTIONS}
                                placeholder="Sort..."
                                id="category-sort-select"
                                size="sm"
                                align="right"
                            />
                        </div>
                    </div>
                </div>

                {/* Categories - Containerless List Layout */}
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Loading categories for {activeWalletName}...</p>
                    </div>
                ) : displayedCategories.length === 0 ? (
                    <div className="py-16 text-center p-6">
                        <Tag className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                        <h3 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
                            No categories found
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xs mx-auto">
                            {searchQuery
                                ? `No categories match "${searchQuery}".`
                                : 'No categories available for this filter.'}
                        </p>
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create New Category</span>
                        </button>
                    </div>
                ) : (
                    <div className="-mx-3.5 sm:-mx-6 lg:-mx-8 border-t border-b border-gray-100 dark:border-gray-800/80 divide-y divide-gray-100 dark:divide-gray-800/80">
                        {displayedCategories.map(category => (
                            <CategoryItemRow
                                key={`${category.type}_${category.id}`}
                                category={category}
                                onOpenDetail={handleOpenDetail}
                            />
                        ))}
                    </div>
                )}

            </div>

            {/* Floating Action Button (FAB) for Add Category */}
            <motion.button
                type="button"
                onClick={handleOpenCreate}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="fixed right-6 sm:right-8 z-40 flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs sm:text-sm rounded-full shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/45 transition-all cursor-pointer select-none"
                style={{ bottom: 'calc(var(--dev-console-padding, 0px) + 1.5rem)' }}
                title="Add New Category"
                aria-label="Add New Category"
            >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                <span className="tracking-wide">Add Category</span>
            </motion.button>
        </div>
    );
};

export default CategoryManagerView;
