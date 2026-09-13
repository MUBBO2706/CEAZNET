import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Edit2, Trash2, Tag, AlertTriangle, ArrowRight, Check, Loader, 
    Calendar, ArrowUpRight, ArrowDownLeft, ShieldAlert, Sparkles, 
    ChevronDown, ChevronUp, Search, CheckCircle2, RotateCcw, Palette
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Transaction } from '../../types';
import { CATEGORY_CONFIG, getCategoryConfig, LUCIDE_ICON_MAP, AVAILABLE_ICON_NAMES } from './categories';
import { 
    getCustomCategories, saveCustomCategory, deleteCustomCategory, 
    hideCategory, getCategoryUsageImpact, reassignCategoryTransactions, 
    CategoryUsageImpact, CustomCategoryItem 
} from '../../services/dbService';
import { useGlobalModal } from '../core/GlobalModalProvider';

interface CategoryDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryId: string | null;
    categoryType?: 'expense' | 'income' | 'transfer';
    user: User | null;
    transactions: Transaction[];
    onCategoryUpdated: () => void;
    onCategoryDeleted?: (categoryId: string) => void;
}

const COLOR_PRESETS = [
    { name: 'Indigo', text: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    { name: 'Emerald', text: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { name: 'Rose', text: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30' },
    { name: 'Amber', text: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { name: 'Sky', text: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-900/30' },
    { name: 'Purple', text: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { name: 'Orange', text: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    { name: 'Pink', text: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30' },
    { name: 'Teal', text: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    { name: 'Yellow', text: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
    { name: 'Blue', text: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { name: 'Green', text: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    { name: 'Red', text: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
    { name: 'Cyan', text: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    { name: 'Violet', text: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30' },
    { name: 'Fuchsia', text: 'text-fuchsia-500', bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/30' },
    { name: 'Lime', text: 'text-lime-600', bg: 'bg-lime-100 dark:bg-lime-900/30' },
    { name: 'Slate', text: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
    { name: 'Gray', text: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
];

const CategoryDetailModalComponent: React.FC<CategoryDetailModalProps> = ({
    isOpen,
    onClose,
    categoryId,
    categoryType = 'expense',
    user,
    transactions,
    onCategoryUpdated,
    onCategoryDeleted
}) => {
    const { alert: globalAlert, confirm: globalConfirm } = useGlobalModal();

    const [isDevToolsOpen, setIsDevToolsOpen] = useState(() => {
        try {
            const saved = localStorage.getItem('devToolsIsOpen') ?? localStorage.getItem('devConsoleIsOpen');
            return saved !== null ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const handleStateChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && typeof customEvent.detail.isOpen === 'boolean') {
                setIsDevToolsOpen(customEvent.detail.isOpen);
            }
        };
        window.addEventListener('devToolsStateChange', handleStateChange);
        return () => {
            window.removeEventListener('devToolsStateChange', handleStateChange);
        };
    }, []);

    // Mode state: 'view' | 'edit' | 'delete_impact'
    const [mode, setMode] = useState<'view' | 'edit' | 'delete_impact'>('view');
    
    // Impact State
    const [impact, setImpact] = useState<CategoryUsageImpact | null>(null);
    const [isImpactLoading, setIsImpactLoading] = useState(false);
    const [showAffectedTxs, setShowAffectedTxs] = useState(false);
    
    // Deletion Resolution State
    const [replacementCategory, setReplacementCategory] = useState<string>('Other');
    const [isExecutingDelete, setIsExecutingDelete] = useState(false);
    
    // Edit State
    const [editLabel, setEditLabel] = useState('');
    const [editIconName, setEditIconName] = useState('Tag');
    const [editColor, setEditColor] = useState('text-indigo-500');
    const [editBg, setEditBg] = useState('bg-indigo-100 dark:bg-indigo-900/30');
    const [iconSearchQuery, setIconSearchQuery] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([]);

    // Load custom categories and impact when modal opens or categoryId changes
    useEffect(() => {
        if (isOpen && categoryId) {
            setMode('view');
            setShowAffectedTxs(false);
            loadCategoryData();
        }
    }, [isOpen, categoryId]);

    const loadCategoryData = async () => {
        if (!categoryId) return;
        setIsImpactLoading(true);
        try {
            const [customs, usageImpact] = await Promise.all([
                getCustomCategories(user),
                getCategoryUsageImpact(categoryId, user)
            ]);
            setCustomCategories(customs);
            setImpact(usageImpact);

            // Initialize edit state
            const config = getCategoryConfig(categoryId, categoryType, customs);
            setEditLabel(config?.label || categoryId);
            setEditIconName((config as any)?.iconName || 'Tag');
            setEditColor(config?.color || 'text-indigo-500');
            setEditBg(config?.bg || 'bg-indigo-100 dark:bg-indigo-900/30');

            // Default replacement category to first different category or 'Other'
            const defaultTarget = categoryId.toLowerCase() === 'other' ? 'General' : 'Other';
            setReplacementCategory(defaultTarget);
        } catch (e) {
            console.error("Failed to load category details:", e);
        } finally {
            setIsImpactLoading(false);
        }
    };

    const categoryConfig = useMemo(() => {
        if (!categoryId) return null;
        return getCategoryConfig(categoryId, categoryType, customCategories);
    }, [categoryId, categoryType, customCategories]);

    const matchingTransactions = useMemo(() => {
        if (!categoryId) return [];
        const target = categoryId.toLowerCase().trim();
        return transactions.filter(t => (t.category || '').toLowerCase().trim() === target);
    }, [categoryId, transactions]);

    const categoryStats = useMemo(() => {
        const count = matchingTransactions.length;
        const total = matchingTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const avg = count > 0 ? total / count : 0;
        return { count, total, avg };
    }, [matchingTransactions]);

    // Available target categories for reassignment (exclude current category)
    const availableReplacementCategories = useMemo(() => {
        const all = [
            ...CATEGORY_CONFIG.expense,
            ...CATEGORY_CONFIG.income,
            ...CATEGORY_CONFIG.transfer,
            ...customCategories.map(c => ({ id: c.id, label: c.label }))
        ];
        
        // Deduplicate and filter out current
        const uniqueMap = new Map<string, string>();
        all.forEach(item => {
            if (categoryId && item.id.toLowerCase() !== categoryId.toLowerCase()) {
                uniqueMap.set(item.id, item.label);
            }
        });

        // Always ensure 'Other' is in the options
        if (categoryId?.toLowerCase() !== 'other' && !uniqueMap.has('Other')) {
            uniqueMap.set('Other', 'Other');
        }

        return Array.from(uniqueMap.entries()).map(([id, label]) => ({ id, label }));
    }, [categoryId, customCategories]);

    // Filtered Icons for picker
    const filteredIconNames = useMemo(() => {
        if (!iconSearchQuery) return AVAILABLE_ICON_NAMES.slice(0, 40);
        const query = iconSearchQuery.toLowerCase();
        return AVAILABLE_ICON_NAMES.filter(name => name.toLowerCase().includes(query)).slice(0, 50);
    }, [iconSearchQuery]);

    // Action: Save Edited Category
    const handleSaveEdit = async () => {
        if (!categoryId || !editLabel.trim()) return;

        const isRenamed = editLabel.trim().toLowerCase() !== categoryId.toLowerCase();
        setIsSavingEdit(true);

        try {
            // If renamed and transactions exist, confirm impact
            if (isRenamed && categoryStats.count > 0) {
                const confirmed = await globalConfirm(
                    `Renaming "${categoryId}" to "${editLabel.trim()}" will automatically update ${categoryStats.count} existing transaction${categoryStats.count === 1 ? '' : 's'} (total ₹${categoryStats.total.toLocaleString('en-IN')}) to keep your history synced. Continue?`,
                    { title: 'Update Transactions' }
                );
                if (!confirmed) {
                    setIsSavingEdit(false);
                    return;
                }
            }

            // Save custom category definition
            const updatedCategoryItem: CustomCategoryItem = {
                id: editLabel.trim(),
                label: editLabel.trim(),
                type: categoryType,
                iconName: editIconName,
                color: editColor,
                bg: editBg,
                isCustom: true
            };

            await saveCustomCategory(updatedCategoryItem, user);

            // If renamed, update all matching transactions
            if (isRenamed && categoryStats.count > 0) {
                await reassignCategoryTransactions(categoryId, editLabel.trim(), user);
                // Also delete old custom category record if it had a different id
                await deleteCustomCategory(categoryId, user);
            }

            globalAlert(`Category "${editLabel.trim()}" updated successfully!`, { type: 'info' });
            onCategoryUpdated();
            setMode('view');
            loadCategoryData();
        } catch (e: any) {
            console.error("Error updating category:", e);
            globalAlert(e?.message || "Failed to update category", { type: 'danger' });
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Action: Initiate Delete Flow (checks usage impact first)
    const handleInitiateDelete = () => {
        const usageCount = impact?.count ?? categoryStats.count;
        if (usageCount === 0) {
            // No usage: simple direct confirmation
            handleDirectDelete();
        } else {
            // Has usage: transition to delete impact & resolution view
            setMode('delete_impact');
        }
    };

    // Action: Direct delete if zero transactions exist
    const handleDirectDelete = async () => {
        if (!categoryId) return;
        const confirmed = await globalConfirm(
            `Are you sure you want to remove the "${categoryConfig?.label || categoryId}" category?`,
            { title: 'Delete Category' }
        );
        if (!confirmed) return;

        setIsExecutingDelete(true);
        try {
            // Check if custom category or preset
            const isCustom = customCategories.some(c => c.id.toLowerCase() === categoryId.toLowerCase());
            if (isCustom) {
                await deleteCustomCategory(categoryId, user);
            } else {
                await hideCategory(categoryId, user);
            }

            globalAlert(`Category "${categoryConfig?.label || categoryId}" removed.`, { type: 'info' });
            onCategoryDeleted?.(categoryId);
            onCategoryUpdated();
            onClose();
        } catch (e: any) {
            console.error("Error deleting category:", e);
            globalAlert(e?.message || "Failed to delete category", { type: 'danger' });
        } finally {
            setIsExecutingDelete(false);
        }
    };

    // Action: Safe Delete with Transaction Reassignment
    const handleExecuteReassignAndDelete = async () => {
        if (!categoryId) return;

        setIsExecutingDelete(true);
        try {
            const countToReassign = impact?.count ?? categoryStats.count;

            // 1. Reassign transactions to replacement category
            if (countToReassign > 0 && replacementCategory) {
                await reassignCategoryTransactions(categoryId, replacementCategory, user);
            }

            // 2. Remove or hide category
            const isCustom = customCategories.some(c => c.id.toLowerCase() === categoryId.toLowerCase());
            if (isCustom) {
                await deleteCustomCategory(categoryId, user);
            } else {
                await hideCategory(categoryId, user);
            }

            globalAlert(
                `Category removed! ${countToReassign} transaction${countToReassign === 1 ? '' : 's'} were safely reassigned to "${replacementCategory}".`,
                { type: 'info' }
            );

            onCategoryDeleted?.(categoryId);
            onCategoryUpdated();
            onClose();
        } catch (e: any) {
            console.error("Error executing reassignment and deletion:", e);
            globalAlert(e?.message || "Failed to complete category deletion", { type: 'danger' });
        } finally {
            setIsExecutingDelete(false);
        }
    };

    if (!isOpen || !categoryId) return null;

    const IconComp = categoryConfig?.icon || Tag;

    return (
        <div 
            className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4"
            style={{ 
                paddingBottom: isDevToolsOpen ? 'calc(45vh + 30px)' : '32px' 
            }}
        >
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl" 
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-[480px] bg-white/95 dark:bg-[#080808]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-200/80 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-white/5 backdrop-blur-md flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${categoryConfig?.bg || 'bg-indigo-100 dark:bg-indigo-900/30'} ${categoryConfig?.color || 'text-indigo-600 dark:text-indigo-400'}`}>
                            <IconComp className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white tracking-tight">
                                {mode === 'edit' ? 'Edit Category' : mode === 'delete_impact' ? 'Delete Impact & Safety' : 'Category Details'}
                            </h2>
                            <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 capitalize">
                                {categoryType} Category
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                        title="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-5 overflow-y-auto scrollbar-hide space-y-4">
                    
                    {/* ============================================================ */}
                    {/* 1. VIEW MODE */}
                    {/* ============================================================ */}
                    {mode === 'view' && (
                        <>
                            {/* Category Banner Card */}
                            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-neutral-900/60 border border-gray-200/70 dark:border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${categoryConfig?.bg || 'bg-indigo-100 dark:bg-indigo-900/30'} ${categoryConfig?.color || 'text-indigo-600 dark:text-indigo-400'}`}>
                                        <IconComp className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                                            {categoryConfig?.label || categoryId}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-200/80 dark:bg-neutral-800 text-gray-700 dark:text-gray-300">
                                                {(categoryConfig as any)?.isCustom ? 'Custom Category' : 'Default Preset'}
                                            </span>
                                            <span className="text-[10px] font-medium text-gray-400">
                                                ID: {categoryId}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Key Stats Cards */}
                            <div className="grid grid-cols-3 gap-2.5">
                                <div className="p-3 rounded-xl bg-gray-50/70 dark:bg-neutral-900/40 border border-gray-200/60 dark:border-white/5 text-center">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Value</p>
                                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-0.5 truncate">
                                        ₹{categoryStats.total.toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50/70 dark:bg-neutral-900/40 border border-gray-200/60 dark:border-white/5 text-center">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Transactions</p>
                                    <p className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                                        {categoryStats.count}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-gray-50/70 dark:bg-neutral-900/40 border border-gray-200/60 dark:border-white/5 text-center">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Average</p>
                                    <p className="text-sm sm:text-base font-black text-gray-900 dark:text-white mt-0.5 truncate">
                                        ₹{Math.round(categoryStats.avg).toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>

                            {/* Recent Transactions in this category */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Recorded Transactions ({matchingTransactions.length})
                                    </h4>
                                    {matchingTransactions.length > 5 && (
                                        <button 
                                            onClick={() => setShowAffectedTxs(!showAffectedTxs)}
                                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            {showAffectedTxs ? 'Show Fewer' : 'View All'}
                                        </button>
                                    )}
                                </div>

                                {matchingTransactions.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-gray-400 dark:text-gray-600 bg-gray-50/50 dark:bg-neutral-900/20 rounded-xl border border-dashed border-gray-200 dark:border-neutral-800">
                                        No transactions recorded under this category yet.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
                                        {(showAffectedTxs ? matchingTransactions : matchingTransactions.slice(0, 5)).map((tx) => (
                                            <div 
                                                key={tx.id} 
                                                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/60 dark:bg-neutral-900/40 border border-gray-100 dark:border-white/5 text-xs"
                                            >
                                                <div className="min-w-0 flex-1 pr-2">
                                                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                                                        {tx.description || tx.category}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                                                        <span>{new Date(tx.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                        <span>•</span>
                                                        <span>{tx.payment_method}</span>
                                                    </p>
                                                </div>
                                                <div className={`font-bold text-xs shrink-0 ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {tx.type === 'income' ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('edit')}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Edit Category</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleInitiateDelete}
                                    disabled={isExecutingDelete || isImpactLoading}
                                    className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/30 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                >
                                    {isExecutingDelete ? (
                                        <Loader className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    )}
                                    <span>Delete Category</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* ============================================================ */}
                    {/* 2. EDIT MODE */}
                    {/* ============================================================ */}
                    {mode === 'edit' && (
                        <div className="space-y-4 animate-fade-in-up">
                            {/* Side-by-Side Name Input & Color Theme Dropdown Selector */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Name Input */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Category Name
                                    </label>
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="text"
                                            value={editLabel}
                                            onChange={(e) => setEditLabel(e.target.value)}
                                            placeholder="Category name..."
                                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 dark:bg-neutral-900/60 border border-gray-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs sm:text-sm font-bold text-gray-900 dark:text-white"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Color Theme Dropdown Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Palette className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>Color Theme</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={COLOR_PRESETS.find(c => c.text === editColor)?.name || 'Indigo'}
                                            onChange={(e) => {
                                                const selected = COLOR_PRESETS.find(c => c.name === e.target.value);
                                                if (selected) {
                                                    setEditColor(selected.text);
                                                    setEditBg(selected.bg);
                                                }
                                            }}
                                            className="w-full pl-3 pr-8 py-2 rounded-xl bg-gray-50 dark:bg-neutral-900/60 border border-gray-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs sm:text-sm font-bold text-gray-900 dark:text-white appearance-none cursor-pointer"
                                        >
                                            {COLOR_PRESETS.map((col) => (
                                                <option key={col.name} value={col.name} className="bg-white dark:bg-neutral-900 text-gray-900 dark:text-white font-medium">
                                                    {col.name} Theme
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Icon Picker Grid */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Choose Icon
                                    </label>
                                    <div className="relative w-36">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                        <input 
                                            type="text"
                                            value={iconSearchQuery}
                                            onChange={(e) => setIconSearchQuery(e.target.value)}
                                            placeholder="Search icons..."
                                            className="w-full pl-6 pr-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800 text-[10px] text-gray-900 dark:text-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 max-h-36 overflow-y-auto scrollbar-hide bg-gray-50 dark:bg-neutral-900/60 rounded-xl border border-gray-200/60 dark:border-white/5">
                                    {filteredIconNames.map((name) => {
                                        const IconComp = LUCIDE_ICON_MAP[name];
                                        if (!IconComp) return null;
                                        const isSelected = editIconName === name;
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => setEditIconName(name)}
                                                className={`p-2 rounded-lg flex flex-col items-center justify-center transition-all ${
                                                    isSelected 
                                                        ? 'bg-indigo-600 text-white shadow-md scale-105' 
                                                        : 'hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300'
                                                }`}
                                                title={name}
                                            >
                                                <IconComp className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Impact Notice if renaming */}
                            {editLabel.trim() && editLabel.trim().toLowerCase() !== categoryId.toLowerCase() && categoryStats.count > 0 && (
                                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>Automatic Sync Notice</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed">
                                        Renaming will automatically update <b>{categoryStats.count} transaction{categoryStats.count === 1 ? '' : 's'}</b> (₹{categoryStats.total.toLocaleString('en-IN')}) from "<b>{categoryId}</b>" to "<b>{editLabel.trim()}</b>".
                                    </p>
                                </div>
                            )}

                            {/* Edit Action Buttons - Compact & Content Fit */}
                            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-gray-100 dark:border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setMode('view')}
                                    disabled={isSavingEdit}
                                    className="w-auto px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 font-bold text-xs transition-all cursor-pointer select-none"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    disabled={isSavingEdit || !editLabel.trim()}
                                    className="w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98] cursor-pointer select-none shrink-0"
                                >
                                    {isSavingEdit ? (
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Check className="w-3.5 h-3.5" />
                                    )}
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ============================================================ */}
                    {/* 3. DELETE IMPACT & REASSIGNMENT SAFETY VIEW */}
                    {/* ============================================================ */}
                    {mode === 'delete_impact' && (
                        <div className="space-y-4 animate-fade-in-up">
                            
                            {/* Critical Warning Card */}
                            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2.5">
                                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                                    <ShieldAlert className="w-5 h-5 shrink-0" />
                                    <span>Impact Analysis & Warning</span>
                                </div>

                                <p className="text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
                                    This category "<b>{categoryConfig?.label || categoryId}</b>" is currently linked to <b>{impact?.count ?? categoryStats.count} active transaction{categoryStats.count === 1 ? '' : 's'}</b> totaling <b>₹{(impact?.totalAmount ?? categoryStats.total).toLocaleString('en-IN')}</b>.
                                </p>

                                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/40 border border-rose-200/60 dark:border-rose-900/30 text-[11px] text-rose-800 dark:text-rose-300">
                                    <b>Impact:</b> If deleted directly without reassignment, these records will lose their category tag and become unclassified in your monthly balance & analytics reports.
                                </div>
                            </div>

                            {/* Safe Solution Selector */}
                            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-neutral-900/60 border border-gray-200/80 dark:border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        <span>Recommended Safe Solution</span>
                                    </span>
                                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                                        Auto-Migrate
                                    </span>
                                </div>

                                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                    Select a replacement category below. All <b>{impact?.count ?? categoryStats.count} transactions</b> will be seamlessly reassigned to it before deleting:
                                </p>

                                {/* Replacement Category Dropdown */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Reassign All Transactions To:
                                    </label>
                                    <select
                                        value={replacementCategory}
                                        onChange={(e) => setReplacementCategory(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    >
                                        {availableReplacementCategories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.label} ({c.id})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Affected Transactions Collapsible Preview */}
                            <div className="border border-gray-200/60 dark:border-white/5 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowAffectedTxs(!showAffectedTxs)}
                                    className="w-full px-3.5 py-2.5 bg-gray-50/50 dark:bg-neutral-900/30 flex justify-between items-center text-xs font-semibold text-gray-700 dark:text-gray-300"
                                >
                                    <span>Preview Affected Transactions ({matchingTransactions.length})</span>
                                    {showAffectedTxs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>

                                {showAffectedTxs && (
                                    <div className="p-2 space-y-1.5 max-h-40 overflow-y-auto scrollbar-hide bg-white dark:bg-black">
                                        {matchingTransactions.map((tx) => (
                                            <div key={tx.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50/70 dark:bg-neutral-900/50 text-[11px]">
                                                <div className="truncate pr-2">
                                                    <span className="font-semibold text-gray-900 dark:text-white">{tx.description || tx.category}</span>
                                                    <span className="text-gray-400 ml-2">{new Date(tx.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                </div>
                                                <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">
                                                    ₹{Number(tx.amount).toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons for Delete & Reassignment */}
                            <div className="pt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('view')}
                                    disabled={isExecutingDelete}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 font-bold text-xs transition-all"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleExecuteReassignAndDelete}
                                    disabled={isExecutingDelete || !replacementCategory}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                                >
                                    {isExecutingDelete ? (
                                        <Loader className="w-3.5 h-3.5 animate-spin text-white" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5 text-white" />
                                    )}
                                    <span>Reassign & Delete</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CategoryDetailModal = React.memo(CategoryDetailModalComponent, (prevProps, nextProps) => {
    return (
        prevProps.isOpen === nextProps.isOpen &&
        prevProps.categoryId === nextProps.categoryId &&
        prevProps.categoryType === nextProps.categoryType &&
        prevProps.user?.id === nextProps.user?.id &&
        prevProps.transactions.length === nextProps.transactions.length
    );
});

export { CategoryDetailModal };
export default CategoryDetailModal;
