import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
    ArrowLeft, Check, Trash2, Tag, Loader, EyeOff, 
    ArrowRightLeft, AlertCircle, Calendar, DollarSign, 
    TrendingUp, TrendingDown, History, Sparkles, Layers, ShieldAlert,
    ArrowUpRight, Percent, PieChart, Palette
} from 'lucide-react';
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
    reassignCategoryTransactions, 
    CustomCategoryItem, 
    CategoryUsageImpact,
    getCategoryUsageImpact,
    clearCategoryUsageImpactCache 
} from '../../services/dbService';
import { useGlobalModal } from '../core/GlobalModalProvider';
import { HybridIconPicker } from './HybridIconPicker';
import { CustomSelect, CustomSelectOption } from './CustomSelect';

export const DETAIL_COLOR_PRESETS = [
    { name: 'Indigo', text: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-950/40', hex: '#6366f1' },
    { name: 'Emerald', text: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/40', hex: '#10b981' },
    { name: 'Rose', text: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-950/40', hex: '#f43f5e' },
    { name: 'Amber', text: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/40', hex: '#f59e0b' },
    { name: 'Sky', text: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-950/40', hex: '#0ea5e9' },
    { name: 'Purple', text: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-950/40', hex: '#a855f7' },
    { name: 'Teal', text: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-950/40', hex: '#14b8a6' },
    { name: 'Cyan', text: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-950/40', hex: '#06b6d4' },
    { name: 'Blue', text: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-950/40', hex: '#3b82f6' },
    { name: 'Violet', text: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950/40', hex: '#8b5cf6' },
    { name: 'Pink', text: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-950/40', hex: '#ec4899' },
    { name: 'Orange', text: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-950/40', hex: '#f97316' },
    { name: 'Yellow', text: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-950/40', hex: '#eab308' },
    { name: 'Lime', text: 'text-lime-500', bg: 'bg-lime-100 dark:bg-lime-950/40', hex: '#84cc16' },
    { name: 'Fuchsia', text: 'text-fuchsia-500', bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/40', hex: '#d946ef' },
    { name: 'Slate', text: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800', hex: '#64748b' },
    { name: 'Gray', text: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', hex: '#71717a' },
];

const TRANSACTION_TYPE_OPTIONS: CustomSelectOption[] = [
    {
        value: 'expense',
        label: 'Expense',
        icon: <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
    },
    {
        value: 'income',
        label: 'Income',
        icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
    },
    {
        value: 'transfer',
        label: 'Transfer',
        icon: <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
    }
];

export interface CategoryDetailViewProps {
    categoryId: string | null; // null or 'new' for creation
    categoryType?: 'expense' | 'income' | 'transfer';
    user: User | null;
    walletId?: string | null;
    walletName?: string;
    categoryStats?: Array<{ category: string; count: number; total: number }>;
    transactions?: Transaction[];
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
    onSaved: (catId: string) => void;
    onDeleted: (catId: string) => void;
}

export const CategoryDetailView: React.FC<CategoryDetailViewProps> = ({
    categoryId,
    categoryType = 'expense',
    user,
    walletId,
    walletName,
    categoryStats = [],
    transactions = [],
    onBack,
    setCategoryHeaderState,
    onSaved,
    onDeleted
}) => {
    const { alert: globalAlert, confirm: globalConfirm } = useGlobalModal();

    const isNew = !categoryId || categoryId === 'new';

    // State
    const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(!isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [isReassigning, setIsReassigning] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form fields
    const [label, setLabel] = useState('');
    const [type, setType] = useState<'expense' | 'income' | 'transfer'>(categoryType);
    const [iconName, setIconName] = useState('solar:tag-bold-duotone');
    const [color, setColor] = useState(DETAIL_COLOR_PRESETS[0].text);
    const [bg, setBg] = useState(DETAIL_COLOR_PRESETS[0].bg);

    // Usage Impact
    const [impact, setImpact] = useState<CategoryUsageImpact | null>(null);

    // Reassignment target
    const [targetCategory, setTargetCategory] = useState<string>('');

    const onBackRef = useRef(onBack);
    useEffect(() => {
        onBackRef.current = onBack;
    }, [onBack]);

    const handleDetailBack = useCallback(() => {
        onBackRef.current();
    }, []);

    // Load initial data
    useEffect(() => {
        let isMounted = true;

        const loadCategory = async () => {
            if (isNew) {
                setLabel('');
                setType(categoryType);
                setIconName('solar:tag-bold-duotone');
                setColor(DETAIL_COLOR_PRESETS[0].text);
                setBg(DETAIL_COLOR_PRESETS[0].bg);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const [customs, usageImpact] = await Promise.all([
                    getCustomCategories(user),
                    getCategoryUsageImpact(categoryId, user, walletId)
                ]);

                if (!isMounted) return;

                setCustomCategories(customs || []);
                setImpact(usageImpact);

                // Find config
                const config = getCategoryConfig(categoryId, categoryType, customs || []);
                if (config) {
                    setLabel(config.label || categoryId);
                    setIconName((config as any).iconName || 'solar:tag-bold-duotone');
                    setColor(config.color || DETAIL_COLOR_PRESETS[0].text);
                    setBg(config.bg || DETAIL_COLOR_PRESETS[0].bg);
                    if ((config as any).type) {
                        setType((config as any).type);
                    }
                } else {
                    setLabel(categoryId);
                    setIconName('solar:tag-bold-duotone');
                }
            } catch (err) {
                console.error('Failed to load category details:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadCategory();

        return () => {
            isMounted = false;
        };
    }, [categoryId, isNew, user, walletId]);

    // Matching transactions
    const matchingTransactions = useMemo(() => {
        if (!categoryId || isNew) return [];
        if (impact?.transactions && impact.transactions.length > 0) {
            return impact.transactions;
        }
        if (transactions.length > 0) {
            const target = categoryId.toLowerCase().trim();
            return transactions.filter(t => (t.category || '').toLowerCase().trim() === target);
        }
        return [];
    }, [categoryId, isNew, transactions, impact]);

    // Category statistics with comprehensive breakdown
    const stats = useMemo(() => {
        const count = impact?.count ?? matchingTransactions.length;
        let total = 0;
        let minAmount = 0;
        let maxAmount = 0;
        let monthTotal = 0;
        let monthCount = 0;
        let last30DaysTotal = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        matchingTransactions.forEach((t, idx) => {
            const val = Math.abs(Number(t.amount || 0));
            total += val;
            if (idx === 0) {
                minAmount = val;
                maxAmount = val;
            } else {
                if (val < minAmount) minAmount = val;
                if (val > maxAmount) maxAmount = val;
            }

            if (t.transaction_date) {
                try {
                    const d = new Date(t.transaction_date);
                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                        monthTotal += val;
                        monthCount += 1;
                    }
                    if (d >= thirtyDaysAgo) {
                        last30DaysTotal += val;
                    }
                } catch (e) {
                    // Ignore date parse errors
                }
            }
        });

        if (impact?.totalAmount !== undefined && (total === 0 || count > matchingTransactions.length)) {
            total = impact.totalAmount;
        }

        const avg = count > 0 ? total / count : 0;
        const peakVsAvg = avg > 0 ? (maxAmount / avg).toFixed(1) : '1.0';

        // Overall total volume across all transactions
        let totalTxsCount = 0;
        let grandTotal = 0;
        let categoryRank = 1;

        if (categoryStats && categoryStats.length > 0) {
            totalTxsCount = categoryStats.reduce((sum, c) => sum + Number(c.count || 0), 0);
            grandTotal = categoryStats.reduce((sum, c) => sum + Number(c.total || 0), 0);
            const sortedCats = [...categoryStats].sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
            const currentCatKey = (categoryId || '').toLowerCase().trim();
            const rankIndex = sortedCats.findIndex(c => (c.category || '').toLowerCase().trim() === currentCatKey);
            categoryRank = rankIndex !== -1 ? rankIndex + 1 : 1;
        } else if (transactions.length > 0) {
            totalTxsCount = transactions.length;
            grandTotal = transactions.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
            const catVolumes = new Map<string, number>();
            transactions.forEach(t => {
                const cat = (t.category || 'other').toLowerCase().trim();
                catVolumes.set(cat, (catVolumes.get(cat) || 0) + Math.abs(Number(t.amount || 0)));
            });
            const sortedCats = Array.from(catVolumes.entries()).sort((a, b) => b[1] - a[1]);
            const currentCatKey = (categoryId || '').toLowerCase().trim();
            const rankIndex = sortedCats.findIndex(([k]) => k === currentCatKey);
            categoryRank = rankIndex !== -1 ? rankIndex + 1 : 1;
        } else {
            totalTxsCount = count;
            grandTotal = total;
        }

        const sharePercent = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : '0';
        const txSharePercent = totalTxsCount > 0 ? ((count / totalTxsCount) * 100).toFixed(1) : '0';

        return { 
            count, 
            total, 
            avg, 
            minAmount,
            maxAmount, 
            peakVsAvg,
            monthTotal, 
            monthCount,
            last30DaysTotal,
            sharePercent, 
            txSharePercent,
            categoryRank
        };
    }, [impact, matchingTransactions, transactions, categoryStats, categoryId]);

    // Check if category is custom
    const isCustom = useMemo(() => {
        if (isNew) return true;
        return customCategories.some(c => c.id.toLowerCase() === categoryId?.toLowerCase());
    }, [isNew, customCategories, categoryId]);

    // Available target categories for reassignment (exclude current category) with dynamic real icons
    const replacementOptions = useMemo<CustomSelectOption[]>(() => {
        const all: Array<{ id: string; label: string; type: string; iconName?: string; color?: string; bg?: string }> = [];

        ['expense', 'income', 'transfer'].forEach(t => {
            const stdList = CATEGORY_CONFIG[t as 'expense' | 'income' | 'transfer'] || [];
            stdList.forEach(c => {
                all.push({
                    id: c.id,
                    label: c.label,
                    type: t,
                    color: c.color,
                    bg: c.bg
                });
            });
        });

        customCategories.forEach(c => {
            all.push({
                id: c.id,
                label: c.label || c.id,
                type: c.type || 'custom',
                iconName: c.iconName,
                color: c.color,
                bg: c.bg
            });
        });

        const seen = new Set<string>();
        const options: CustomSelectOption[] = [];

        all.forEach(item => {
            const key = item.id.toLowerCase();
            if (categoryId && key === categoryId.toLowerCase()) return; // skip self
            if (seen.has(key)) return;
            seen.add(key);

            const config = getCategoryConfig(item.id, item.type, customCategories);
            const OptionIcon = config?.icon || Tag;
            const iconColor = config?.color || 'text-indigo-500';

            options.push({
                value: item.id,
                label: item.label,
                badge: item.type,
                icon: <OptionIcon className={`w-3.5 h-3.5 ${iconColor}`} />
            });
        });

        return options;
    }, [customCategories, categoryId]);

    // Set initial replacement target
    useEffect(() => {
        if (replacementOptions.length > 0 && !targetCategory) {
            setTargetCategory(replacementOptions[0].value);
        }
    }, [replacementOptions, targetCategory]);

    // Save handler
    const handleSave = async () => {
        const trimmed = label.trim();
        if (!trimmed) {
            globalAlert('Please enter a category name.');
            return;
        }

        setIsSaving(true);
        try {
            const idToSave = isNew ? trimmed : (categoryId || trimmed);
            await saveCustomCategory(
                {
                    id: idToSave,
                    label: trimmed,
                    type,
                    iconName,
                    color,
                    bg
                },
                user
            );
            onSaved(idToSave);
        } catch (err) {
            console.error('Failed to save category:', err);
            globalAlert('Failed to save category. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Delete handler
    const handleDelete = async () => {
        if (!categoryId) return;

        const count = stats.count;
        let confirmMsg = `Are you sure you want to delete the category "${label || categoryId}"?`;
        if (count > 0) {
            confirmMsg = `This category is currently linked to ${count} transaction${count > 1 ? 's' : ''}. You can reassign them first using the Reassign tool below, or delete this category now. Proceed?`;
        }

        const confirmed = await globalConfirm(confirmMsg);
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            if (isCustom) {
                await deleteCustomCategory(categoryId, user);
            } else {
                await hideCategory(categoryId, user);
            }
            onDeleted(categoryId);
        } catch (err) {
            console.error('Failed to delete category:', err);
            globalAlert('Failed to delete category.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Reassign transactions handler
    const handleReassign = async () => {
        if (!categoryId || !targetCategory || targetCategory === categoryId) {
            globalAlert('Please select a valid destination category.');
            return;
        }

        const confirmed = await globalConfirm(
            `Move all ${stats.count} transactions from "${label || categoryId}" to "${targetCategory}"?`
        );
        if (!confirmed) return;

        setIsReassigning(true);
        try {
            await reassignCategoryTransactions(categoryId, targetCategory, user, walletId);
            globalAlert(`Successfully moved transactions to "${targetCategory}".`);
            // Refresh impact for current wallet
            clearCategoryUsageImpactCache(categoryId);
            clearCategoryUsageImpactCache(targetCategory);
            const updatedImpact = await getCategoryUsageImpact(categoryId, user, walletId);
            setImpact(updatedImpact);
        } catch (err) {
            console.error('Failed to reassign transactions:', err);
            globalAlert('Failed to reassign transactions.');
        } finally {
            setIsReassigning(false);
        }
    };

    // Keep latest action handlers in refs for the floating header
    const handleSaveRef = useRef(handleSave);
    handleSaveRef.current = handleSave;

    const handleDeleteRef = useRef(handleDelete);
    handleDeleteRef.current = handleDelete;

    const onHeaderSave = useCallback(() => {
        handleSaveRef.current?.();
    }, []);

    const onHeaderDelete = useCallback(() => {
        handleDeleteRef.current?.();
    }, []);

    // Synchronize Floating Header for Category Detail View
    useEffect(() => {
        const headerTitle = isNew ? 'New Category' : (label.trim() || 'Edit Category');
        setCategoryHeaderState?.({
            title: headerTitle,
            onBack: handleDetailBack,
            isDetail: true,
            isSaving,
            isDeleting,
            isCustom,
            isNew,
            canSave: Boolean(label.trim()) && !isSaving,
            onSave: onHeaderSave,
            onDelete: !isNew ? onHeaderDelete : undefined
        });
    }, [isNew, label, isSaving, isDeleting, isCustom, handleDetailBack, onHeaderSave, onHeaderDelete, setCategoryHeaderState]);

    // Dynamic icon component
    const LiveIconComponent = LUCIDE_ICON_MAP[iconName] || Tag;

    if (isLoading) {
        return (
            <div className="relative z-10 h-full overflow-y-auto bg-transparent scrollbar-hide pt-20 sm:pt-24 pb-20 flex flex-col items-center justify-center font-sans">
                <Loader className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading category details...</p>
            </div>
        );
    }

    return (
        <div 
            className="relative z-10 h-full overflow-y-auto bg-transparent scrollbar-hide pt-20 sm:pt-24 pb-0 font-sans"
            style={{
                paddingBottom: 'var(--dev-console-padding, 0px)',
            }}
        >
            <div className="max-w-4xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6 pb-0">
                
                {/* Live Identity Hero (Container-less, no icon background highlight) */}
                <div className="flex items-center gap-3 sm:gap-4 px-1 py-1">
                    <div className="shrink-0 flex items-center justify-center">
                        <LiveIconComponent className={`w-8 h-8 sm:w-9 sm:h-9 ${color} stroke-[2.25] transition-transform duration-200`} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                                {label.trim() || (isNew ? 'New Category' : 'Untitled')}
                            </h1>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                {type}
                            </span>
                            {isCustom && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                    Custom
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                            {isNew
                                ? 'Customize icon, theme color & transaction type.'
                                : `${stats.count} linked txns • ₹${Math.round(stats.total).toLocaleString('en-IN')}`}
                        </p>
                    </div>
                </div>

                {/* Section 1: Basic Information (Container-less) */}
                <div className="space-y-3 px-1 pt-1">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-gray-100 dark:border-white/[0.06]">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                            Category Details
                        </h2>
                    </div>

                    <div className="flex flex-row items-end gap-2.5 sm:gap-3">
                        {/* Name Input */}
                        <div className="flex-1 space-y-1 min-w-0">
                            <label className="h-4 leading-4 text-[11px] font-semibold text-gray-600 dark:text-gray-400 block truncate">
                                Category Name
                            </label>
                            <input
                                type="text"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="e.g. Subscriptions, Gaming, Fuel..."
                                className="w-full px-3 text-xs sm:text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-all font-medium h-9 min-h-[36px] max-h-[36px] box-border leading-none"
                            />
                        </div>

                        {/* Transaction Nature (CustomSelect Dropdown) */}
                        <div className="w-36 sm:w-48 shrink-0 space-y-1">
                            <label className="h-4 leading-4 text-[11px] font-semibold text-gray-600 dark:text-gray-400 block truncate">
                                Transaction Nature
                            </label>
                            <CustomSelect
                                value={type}
                                onChange={val => setType(val as 'expense' | 'income' | 'transfer')}
                                options={TRANSACTION_TYPE_OPTIONS}
                                id="category-type-select"
                                size="sm"
                                align="right"
                            />
                        </div>
                    </div>

                    {/* Color Palette */}
                    <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                            Accent Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {DETAIL_COLOR_PRESETS.map(c => {
                                const isSelected = color === c.text;
                                return (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => {
                                            setColor(c.text);
                                            setBg(c.bg);
                                        }}
                                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                            isSelected
                                                ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                                                : 'hover:scale-105 opacity-85 hover:opacity-100'
                                        }`}
                                        style={{ backgroundColor: c.hex }}
                                        title={c.name}
                                    >
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Section 2: Choose Icon (Container-less) */}
                <div className="pt-1">
                    <HybridIconPicker
                        selectedIconName={iconName}
                        onSelectIcon={newIcon => setIconName(newIcon)}
                        categoryName={label.trim()}
                        categoryType={type}
                        colorTextClass={color}
                        user={user}
                    />
                </div>

                {/* Section 3: Financial Impact & Analytics (Container-less & Expanded Metrics) */}
                {!isNew && (
                    <div className="space-y-2.5 pt-1">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                    Usage & Financial Impact
                                </h2>
                            </div>
                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                {isCustom ? 'Custom Category' : 'Standard Category'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
                            {/* Card 1: Linked Txns */}
                            <div className="p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)] flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block truncate">
                                        Linked Txns
                                    </span>
                                    <div className="mt-0.5">
                                        <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate block">
                                            {stats.count}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                            Total records
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end justify-center pl-1 border-l border-gray-100 dark:border-white/[0.06]">
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">
                                        {stats.txSharePercent}%
                                    </span>
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 block">
                                        Of all txns
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Total Volume */}
                            <div className="p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)] flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block truncate">
                                        Total Volume
                                    </span>
                                    <div className="mt-0.5">
                                        <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate block">
                                            ₹{Math.round(stats.total).toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                            Lifetime total
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end justify-center pl-1 border-l border-gray-100 dark:border-white/[0.06]">
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                                        ₹{Math.round(stats.last30DaysTotal).toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 block">
                                        Last 30 days
                                    </span>
                                </div>
                            </div>

                            {/* Card 3: Avg Amount */}
                            <div className="p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)] flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block truncate">
                                        Avg Amount
                                    </span>
                                    <div className="mt-0.5">
                                        <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate block">
                                            ₹{Math.round(stats.avg).toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                            Per transaction
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end justify-center pl-1 border-l border-gray-100 dark:border-white/[0.06]">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block truncate">
                                        ₹{Math.round(stats.minAmount).toLocaleString('en-IN')}
                                    </span>
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 block">
                                        Lowest logged
                                    </span>
                                </div>
                            </div>

                            {/* Card 4: Peak Record */}
                            <div className="p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)] flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block truncate">
                                        Peak Record
                                    </span>
                                    <div className="mt-0.5">
                                        <span className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 truncate block">
                                            ₹{Math.round(stats.maxAmount).toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                            Highest single
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end justify-center pl-1 border-l border-gray-100 dark:border-white/[0.06]">
                                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">
                                        {stats.peakVsAvg}x
                                    </span>
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 block">
                                        Above avg
                                    </span>
                                </div>
                            </div>

                            {/* Card 5: This Month */}
                            <div className="p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)] flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block truncate">
                                        This Month
                                    </span>
                                    <div className="mt-0.5">
                                        <span className="text-sm sm:text-base font-black text-gray-900 dark:text-white truncate block">
                                            ₹{Math.round(stats.monthTotal).toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                            Current cycle
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end justify-center pl-1 border-l border-gray-100 dark:border-white/[0.06]">
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">
                                        {stats.monthCount} txns
                                    </span>
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 block">
                                        This month
                                    </span>
                                </div>
                            </div>

                            {/* Card 6: Wallet Share */}
                            <div className="p-2.5 rounded-xl bg-[var(--cat-stat-bg)] border border-[var(--cat-stat-border)] flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 block truncate">
                                        Wallet Share
                                    </span>
                                    <div className="mt-0.5">
                                        <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 truncate block">
                                            {stats.sharePercent}%
                                        </span>
                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block truncate">
                                            Of all outflow
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end justify-center pl-1 border-l border-gray-100 dark:border-white/[0.06]">
                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">
                                        #{stats.categoryRank}
                                    </span>
                                    <span className="text-[9px] font-medium text-gray-400 dark:text-gray-500 block">
                                        In volume
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section 4: Reassign Transactions Tool (Container-less & Side-by-Side Mobile Layout) */}
                {!isNew && stats.count > 0 && (
                    <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-1.5 px-1">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                Reassign Linked Transactions
                            </h2>
                        </div>

                        <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed px-1">
                            Move all <strong className="font-bold text-gray-900 dark:text-white">{stats.count}</strong> transactions currently tagged under <strong className="font-bold text-gray-900 dark:text-white">{label || categoryId}</strong> to another category seamlessly.
                        </p>

                        {/* Side-by-side dropdown selector and move button (Mobile & Desktop) */}
                        <div className="flex flex-row items-center gap-2 w-full">
                            <div className="flex-1 min-w-0">
                                <CustomSelect
                                    value={targetCategory}
                                    onChange={val => setTargetCategory(val)}
                                    options={replacementOptions}
                                    placeholder="Select target category..."
                                    searchable={true}
                                    id="reassign-category-select"
                                    size="sm"
                                    align="left"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleReassign}
                                disabled={isReassigning || !targetCategory || targetCategory === categoryId}
                                className="w-auto shrink-0 whitespace-nowrap px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center justify-center gap-1.5 h-9 min-h-[36px] max-h-[36px] box-border leading-none cursor-pointer"
                            >
                                {isReassigning ? (
                                    <>
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                        <span>Moving...</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                        <span>Move</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Section 5: Recent Tagged Transactions History (Edge-to-Edge & Container-less, Bottom Flush) */}
                {!isNew && (
                    <div className="pt-2 pb-0 space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <History className="w-3.5 h-3.5 text-indigo-500" />
                                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                    Recent Transactions
                                </h2>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200/80 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                                    {matchingTransactions.length}
                                </span>
                            </div>
                        </div>

                        {matchingTransactions.length === 0 ? (
                            <div className="-mx-3.5 sm:-mx-6 lg:-mx-8 border-t border-gray-200/70 dark:border-white/[0.08] py-10 text-center px-4 bg-gray-50/40 dark:bg-white/[0.01]">
                                <History className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500 opacity-60" />
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                    No transactions recorded under this category yet.
                                </p>
                            </div>
                        ) : (
                            <div className="-mx-3.5 sm:-mx-6 lg:-mx-8 border-t border-b border-gray-100 dark:border-gray-800/80 divide-y divide-gray-100 dark:divide-gray-800/80">
                                {matchingTransactions.map((t, idx) => {
                                    const amountNum = Number(t.amount) || 0;
                                    const isIncome = t.type === 'income' || (!t.type && amountNum > 0);
                                    const isExpense = t.type === 'expense' || (!t.type && amountNum < 0);
                                    
                                    let dateStr = 'No date';
                                    let timeStr = '';
                                    if (t.transaction_date) {
                                        try {
                                            const d = new Date(t.transaction_date);
                                            dateStr = d.toLocaleDateString(undefined, { 
                                                month: 'short', 
                                                day: 'numeric',
                                                year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                            });
                                            timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                                        } catch (e) {
                                            dateStr = t.transaction_date;
                                        }
                                    }

                                    return (
                                        <div
                                            key={t.id || idx}
                                            className="group flex items-center justify-between gap-3.5 sm:gap-4 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 hover:bg-black/[0.025] dark:hover:bg-white/[0.035] transition-colors duration-150 cursor-pointer select-none"
                                        >
                                            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                                                {/* Category icon with NO background highlight */}
                                                <div className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-150">
                                                    <LiveIconComponent className={`w-6 h-6 sm:w-6.5 sm:h-6.5 ${color}`} />
                                                </div>

                                                <div className="min-w-0 flex flex-col gap-1 flex-1 pr-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold truncate text-base sm:text-[15px] leading-tight text-gray-900 dark:text-white">
                                                            {t.description || 'Untitled Transaction'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs sm:text-[11px] font-medium text-gray-500 dark:text-gray-400 flex-wrap">
                                                        <span className="capitalize truncate max-w-[120px] font-semibold text-gray-700 dark:text-gray-300">
                                                            {t.category || label}
                                                        </span>
                                                        {t.payment_method && (
                                                            <>
                                                                <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full shrink-0"></span>
                                                                <span className="opacity-75 truncate max-w-[120px] uppercase text-[10px] font-medium">
                                                                    {t.payment_method}
                                                                </span>
                                                            </>
                                                        )}
                                                        {t.source && (
                                                            <>
                                                                <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full shrink-0"></span>
                                                                <span className="opacity-60 text-[9px] uppercase tracking-wider font-medium">
                                                                    {t.source}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2.5 pl-1 shrink-0">
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className={`text-base sm:text-[15px] font-bold tabular-nums whitespace-nowrap shrink-0 ${
                                                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 
                                                        isExpense ? 'text-rose-600 dark:text-rose-400' : 
                                                        'text-indigo-600 dark:text-indigo-400'
                                                    }`}>
                                                        {isExpense ? '-' : '+'}₹{Math.abs(amountNum).toLocaleString('en-IN')}
                                                    </span>
                                                    <span className="text-xs sm:text-[11px] font-medium text-gray-400 dark:text-gray-500">
                                                        {dateStr} {timeStr ? `• ${timeStr}` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};
