import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    ArrowLeft, Plus, Search, Tag, Edit2, Trash2, Check, Loader, 
    Sparkles, ArrowUpRight, ArrowDownLeft, RefreshCw, AlertTriangle, 
    Layers, Filter, Eye, Palette, CheckCircle2, ChevronRight, X,
    TrendingUp, ArrowUpDown
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Transaction } from '../../types';
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
    getTransactions, 
    CustomCategoryItem 
} from '../../services/dbService';
import { useGlobalModal } from '../core/GlobalModalProvider';
import { CategoryDetailView } from './CategoryDetailView';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

export interface CategoryManagerViewProps {
    user: User | null;
    onBack: () => void;
    setCategoryHeaderState?: (state: { title: string | null; onBack?: () => void; isDetail?: boolean }) => void;
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

export const CategoryManagerView: React.FC<CategoryManagerViewProps> = ({
    user,
    onBack,
    setCategoryHeaderState
}) => {
    const { alert: globalAlert, confirm: globalConfirm } = useGlobalModal();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data states
    const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filtering & Sorting
    const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer' | 'custom'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<string>('customFirst');

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

    // Load custom categories and transactions
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [cats, txs] = await Promise.all([
                getCustomCategories(user),
                getTransactions(user)
            ]);
            setCustomCategories(cats || []);
            setTransactions(txs || []);
        } catch (err) {
            console.error('Error loading category manager data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user]);

    // Build transaction usage map
    const usageMap = useMemo(() => {
        const map = new Map<string, { count: number; total: number }>();
        transactions.forEach(tx => {
            const cat = (tx.category || 'Other').trim().toLowerCase();
            const current = map.get(cat) || { count: 0, total: 0 };
            map.set(cat, {
                count: current.count + 1,
                total: current.total + Math.abs(Number(tx.amount) || 0)
            });
        });
        return map;
    }, [transactions]);

    // Build unified category list
    const allCategories = useMemo<UnifiedCategory[]>(() => {
        const list: UnifiedCategory[] = [];
        const seenIds = new Set<string>();

        // 1. Add Custom Categories first
        customCategories.forEach(c => {
            const idKey = c.id.toLowerCase();
            seenIds.add(idKey);
            const usage = usageMap.get(idKey) || usageMap.get(c.label.toLowerCase()) || { count: 0, total: 0 };
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
                if (seenIds.has(idKey)) return; // custom override
                seenIds.add(idKey);

                // Find icon name
                const matchedIconName = Object.keys(LUCIDE_ICON_MAP).find(
                    key => LUCIDE_ICON_MAP[key] === c.icon
                ) || 'Tag';

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

    // Overall summary metrics
    const metrics = useMemo(() => {
        const totalCats = allCategories.length;
        const customCount = allCategories.filter(c => c.isCustom).length;
        const totalTxCount = transactions.length;
        const totalVolume = allCategories.reduce((acc, c) => acc + c.txTotal, 0);
        return { totalCats, customCount, totalTxCount, totalVolume };
    }, [allCategories, transactions]);

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

    // Delete a category
    const handleDeleteCategory = async (category: UnifiedCategory, e: React.MouseEvent) => {
        e.stopPropagation();

        let confirmMsg = `Are you sure you want to delete "${category.label}"?`;
        if (category.txCount > 0) {
            confirmMsg = `"${category.label}" has ${category.txCount} linked transaction${category.txCount > 1 ? 's' : ''}. Deleting this will unbind these transactions. Proceed?`;
        }

        const confirmed = await globalConfirm(confirmMsg);
        if (!confirmed) return;

        try {
            if (category.isCustom) {
                await deleteCustomCategory(category.id, user);
            } else {
                await hideCategory(category.id, user);
            }
            await loadData();
        } catch (err) {
            console.error('Error deleting category:', err);
            globalAlert('Failed to delete category.');
        }
    };

    // Render Category Detail Page if activeDetailId is set
    if (activeDetailId) {
        return (
            <CategoryDetailView
                categoryId={activeDetailId === 'new' ? null : activeDetailId}
                categoryType={detailTypeFromUrl}
                user={user}
                transactions={transactions}
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
        <div className="relative z-10 h-full overflow-y-auto bg-transparent scrollbar-hide pt-16 sm:pt-20 pb-16 dev-console-spacing-pb font-sans">
            <div className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
                
                {/* Header Row: Title & Add Category Button (No redundant in-page breadcrumb) */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-200/70 dark:border-white/10">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                            Category Management
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block mt-0.5">
                            Create custom categories, search Lucide icons with AI, and manage transaction tags.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Category</span>
                    </button>
                </div>

                {/* Metric Summary Ribbon (Compact 4-column) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 py-2.5 border-y border-gray-200/70 dark:border-white/10">
                    <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                            Total Categories
                        </span>
                        <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                            {metrics.totalCats}
                        </span>
                    </div>

                    <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500/80 dark:text-indigo-400/80 block">
                            Custom Created
                        </span>
                        <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400">
                            {metrics.customCount}
                        </span>
                    </div>

                    <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80 dark:text-emerald-400/80 block">
                            Tagged Txns
                        </span>
                        <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                            {metrics.totalTxCount}
                        </span>
                    </div>

                    <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block">
                            Tracked Volume
                        </span>
                        <span className="text-lg sm:text-xl font-black text-gray-900 dark:text-white truncate block">
                            ₹{Math.round(metrics.totalVolume).toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>

                {/* Filter & Search & Custom Sort Controls (Compact & Fully Responsive) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    
                    {/* Segmented Filter Pills */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.05] border border-gray-200/80 dark:border-white/10 overflow-x-auto scrollbar-hide shrink-0 max-w-full">
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'expense', label: 'Expenses' },
                            { id: 'income', label: 'Income' },
                            { id: 'transfer', label: 'Transfers' },
                            { id: 'custom', label: 'Custom' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTypeFilter(tab.id as any)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap select-none cursor-pointer ${
                                    activeTypeFilter === tab.id
                                        ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-xs'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Search & Custom Dropdown */}
                    <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                        {/* Search Bar */}
                        <div className="relative flex-1 sm:w-56">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search categories..."
                                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-all h-8"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
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

                {/* Categories Grid (Compact & Refined Cards) */}
                {isLoading ? (
                    <div className="py-16 flex flex-col items-center justify-center">
                        <Loader className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">Loading categories...</p>
                    </div>
                ) : displayedCategories.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl bg-white/40 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5 p-6">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                        {displayedCategories.map(category => {
                            const IconComponent = LUCIDE_ICON_MAP[category.iconName] || Tag;
                            return (
                                <div
                                    key={category.id}
                                    onClick={() => handleOpenDetail(category.id, category.type)}
                                    className="group relative p-3 sm:p-3.5 rounded-2xl bg-[var(--cat-card-bg)] hover:bg-[var(--cat-card-bg-hover)] border border-[var(--cat-card-border)] hover:border-[var(--cat-card-border-hover)] transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2.5 mb-2.5">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${category.bg} transition-transform group-hover:scale-105`}>
                                                    <IconComponent className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${category.color}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                                                        {category.label}
                                                    </h3>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                                            {category.type}
                                                        </span>
                                                        {category.isCustom && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                                                Custom
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        handleOpenDetail(category.id, category.type);
                                                    }}
                                                    className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
                                                    title="Edit category"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                {category.isCustom && (
                                                    <button
                                                        type="button"
                                                        onClick={e => handleDeleteCategory(category, e)}
                                                        className="p-1 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                                        title="Delete category"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer: Usage details */}
                                    <div className="pt-2 border-t border-gray-100 dark:border-white/[0.06] flex items-center justify-between text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                                                {category.txCount}
                                            </span>
                                            <span>txns</span>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <span className="font-mono font-bold text-gray-800 dark:text-gray-200">
                                                ₹{Math.round(category.txTotal).toLocaleString('en-IN')}
                                            </span>
                                            <ChevronRight className="w-3 h-3 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
};

export default CategoryManagerView;
