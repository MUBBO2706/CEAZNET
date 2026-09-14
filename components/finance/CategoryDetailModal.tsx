import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Edit2, Trash2, Tag, AlertTriangle, ArrowRight, Check, Loader, 
    Calendar, ArrowUpRight, ArrowDownLeft, ShieldAlert, Sparkles, 
    ChevronDown, ChevronUp, Search, CheckCircle2, RotateCcw, Palette,
    ArrowLeft
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
    { name: 'Indigo', text: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-950/40', hex: '#6366f1' },
    { name: 'Emerald', text: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-950/40', hex: '#10b981' },
    { name: 'Rose', text: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-950/40', hex: '#f43f5e' },
    { name: 'Amber', text: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-950/40', hex: '#f59e0b' },
    { name: 'Sky', text: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-950/40', hex: '#0ea5e9' },
    { name: 'Purple', text: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-950/40', hex: '#a855f7' },
    { name: 'Orange', text: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-950/40', hex: '#f97316' },
    { name: 'Pink', text: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-950/40', hex: '#ec4899' },
    { name: 'Teal', text: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-950/40', hex: '#14b8a6' },
    { name: 'Yellow', text: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-950/40', hex: '#ca8a04' },
    { name: 'Blue', text: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-950/40', hex: '#3b82f6' },
    { name: 'Green', text: 'text-green-500', bg: 'bg-green-100 dark:bg-green-950/40', hex: '#22c55e' },
    { name: 'Red', text: 'text-red-500', bg: 'bg-red-100 dark:bg-red-950/40', hex: '#ef4444' },
    { name: 'Cyan', text: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-950/40', hex: '#06b6d4' },
    { name: 'Violet', text: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-950/40', hex: '#8b5cf6' },
    { name: 'Fuchsia', text: 'text-fuchsia-500', bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/40', hex: '#d946ef' },
    { name: 'Lime', text: 'text-lime-600', bg: 'bg-lime-100 dark:bg-lime-950/40', hex: '#65a30d' },
    { name: 'Slate', text: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800', hex: '#64748b' },
    { name: 'Gray', text: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', hex: '#71717a' },
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
    const [editBg, setEditBg] = useState('bg-indigo-100 dark:bg-indigo-950/40');
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
            setEditBg(config?.bg || 'bg-indigo-100 dark:bg-indigo-950/40');

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
        if (!iconSearchQuery) return AVAILABLE_ICON_NAMES.slice(0, 48);
        const query = iconSearchQuery.toLowerCase();
        return AVAILABLE_ICON_NAMES.filter(name => name.toLowerCase().includes(query)).slice(0, 60);
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
            handleDirectDelete();
        } else {
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
                className="absolute inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-md transition-opacity" 
                onClick={onClose}
            />

            {/* Modal Container - Refined & Containerless */}
            <div className="relative w-full max-w-[440px] bg-white dark:bg-[#0c0c0e] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden flex flex-col max-h-[88vh] transition-all">
                
                {/* Clean Top Navigation Bar */}
                <div className="px-5 pt-4 pb-2 flex justify-between items-center shrink-0">
                    {mode === 'view' ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                {categoryType}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                {(categoryConfig as any)?.isCustom ? 'Custom' : 'Preset'}
                            </span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setMode('view')}
                            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back</span>
                        </button>
                    )}
                    
                    <button 
                        onClick={onClose} 
                        className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                        title="Close"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="px-5 pb-5 overflow-y-auto scrollbar-hide space-y-5">
                    
                    {/* ============================================================ */}
                    {/* 1. VIEW MODE (Refined & Containerless) */}
                    {/* ============================================================ */}
                    {mode === 'view' && (
                        <>
                            {/* Category Hero Display */}
                            <div className="flex items-center gap-4 pt-1">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${categoryConfig?.bg || 'bg-indigo-100 dark:bg-indigo-950/40'} ${categoryConfig?.color || 'text-indigo-600 dark:text-indigo-400'}`}>
                                    <IconComp className="w-7 h-7" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
                                        {categoryConfig?.label || categoryId}
                                    </h2>
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5 truncate">
                                        ID: {categoryId}
                                    </p>
                                </div>
                            </div>

                            {/* Seamless Key Stats (Containerless with hairline dividers) */}
                            <div className="flex items-center justify-between py-3 border-y border-gray-100 dark:border-white/[0.06]">
                                <div className="flex-1 text-left min-w-0">
                                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 block">Total Volume</span>
                                    <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate block">
                                        ₹{categoryStats.total.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="h-7 w-px bg-gray-100 dark:bg-white/[0.06] mx-3 shrink-0" />
                                <div className="flex-1 text-center min-w-0">
                                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 block">Records</span>
                                    <span className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 tracking-tight truncate block">
                                        {categoryStats.count}
                                    </span>
                                </div>
                                <div className="h-7 w-px bg-gray-100 dark:bg-white/[0.06] mx-3 shrink-0" />
                                <div className="flex-1 text-right min-w-0">
                                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 block">Average</span>
                                    <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight truncate block">
                                        ₹{Math.round(categoryStats.avg).toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>

                            {/* Transactions Stream (Refined Borderless Rows) */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                        Recent Transactions ({matchingTransactions.length})
                                    </span>
                                    {matchingTransactions.length > 5 && (
                                        <button 
                                            onClick={() => setShowAffectedTxs(!showAffectedTxs)}
                                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            {showAffectedTxs ? 'Show Less' : 'View All'}
                                        </button>
                                    )}
                                </div>

                                {matchingTransactions.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                                        No transactions recorded under this category.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-white/[0.04] max-h-56 overflow-y-auto scrollbar-hide -mx-2 px-2">
                                        {(showAffectedTxs ? matchingTransactions : matchingTransactions.slice(0, 5)).map((tx) => (
                                            <div 
                                                key={tx.id} 
                                                className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                                            >
                                                <div className="min-w-0 flex-1 pr-3">
                                                    <p className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                                                        {tx.description || tx.category}
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5 mt-0.5">
                                                        <span>{new Date(tx.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                        <span>•</span>
                                                        <span>{tx.payment_method}</span>
                                                    </p>
                                                </div>
                                                <div className={`font-bold text-xs sm:text-sm shrink-0 tabular-nums ${
                                                    tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' :
                                                    tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400' :
                                                    'text-indigo-600 dark:text-indigo-400'
                                                }`}>
                                                    {tx.type === 'income' ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Primary Actions - Sleek & Containerless */}
                            <div className="pt-2 flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setMode('edit')}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
                                >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Edit Category</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleInitiateDelete}
                                    disabled={isExecutingDelete || isImpactLoading}
                                    className="py-2.5 px-4 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
                                    title="Delete category"
                                >
                                    {isExecutingDelete ? (
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Delete</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* ============================================================ */}
                    {/* 2. EDIT MODE (Refined, Direct & Containerless) */}
                    {/* ============================================================ */}
                    {mode === 'edit' && (
                        <div className="space-y-4 pt-1">
                            {/* Category Name Input */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    Name
                                </label>
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text"
                                        value={editLabel}
                                        onChange={(e) => setEditLabel(e.target.value)}
                                        placeholder="Category name..."
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/10 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-semibold text-gray-900 dark:text-white transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Interactive Color Palette */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Palette className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>Color Accent</span>
                                    </label>
                                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                        {COLOR_PRESETS.find(c => c.text === editColor)?.name || 'Indigo'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-0.5">
                                    {COLOR_PRESETS.map((col) => {
                                        const isSelected = editColor === col.text;
                                        return (
                                            <button
                                                key={col.name}
                                                type="button"
                                                onClick={() => {
                                                    setEditColor(col.text);
                                                    setEditBg(col.bg);
                                                }}
                                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                                    isSelected 
                                                        ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-[#0c0c0e] scale-110' 
                                                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                                                }`}
                                                style={{ backgroundColor: col.hex }}
                                                title={col.name}
                                            >
                                                {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Icon Picker (Containerless Grid) */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                        Choose Icon
                                    </label>
                                    <div className="relative w-36">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                        <input 
                                            type="text"
                                            value={iconSearchQuery}
                                            onChange={(e) => setIconSearchQuery(e.target.value)}
                                            placeholder="Search..."
                                            className="w-full pl-7 pr-2 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.04] border border-transparent focus:border-gray-200 dark:focus:border-white/10 text-[11px] text-gray-900 dark:text-white outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-36 overflow-y-auto scrollbar-hide py-1">
                                    {filteredIconNames.map((name) => {
                                        const IconComponent = LUCIDE_ICON_MAP[name];
                                        if (!IconComponent) return null;
                                        const isSelected = editIconName === name;
                                        return (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => setEditIconName(name)}
                                                className={`p-2.5 rounded-xl flex items-center justify-center transition-all ${
                                                    isSelected 
                                                        ? 'bg-indigo-600 text-white shadow-sm scale-105' 
                                                        : 'hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-600 dark:text-gray-400'
                                                }`}
                                                title={name}
                                            >
                                                <IconComponent className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Renaming Sync Notice */}
                            {editLabel.trim() && editLabel.trim().toLowerCase() !== categoryId.toLowerCase() && categoryStats.count > 0 && (
                                <div className="p-3 rounded-2xl bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                        <span>Auto-Sync Notice</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed opacity-90">
                                        Renaming will update <b>{categoryStats.count} transaction{categoryStats.count === 1 ? '' : 's'}</b> (₹{categoryStats.total.toLocaleString('en-IN')}) from "<b>{categoryId}</b>" to "<b>{editLabel.trim()}</b>".
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('view')}
                                    disabled={isSavingEdit}
                                    className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-800 dark:hover:text-white font-semibold text-xs transition-colors"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    disabled={isSavingEdit || !editLabel.trim()}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
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
                    {/* 3. DELETE IMPACT MODE (Refined & Containerless) */}
                    {/* ============================================================ */}
                    {mode === 'delete_impact' && (
                        <div className="space-y-4 pt-1">
                            {/* Warning Header */}
                            <div className="flex items-start gap-3 pt-1">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                        Delete "{categoryConfig?.label || categoryId}"
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                                        Linked to <b>{impact?.count ?? categoryStats.count} transaction{categoryStats.count === 1 ? '' : 's'}</b> totaling <b>₹{(impact?.totalAmount ?? categoryStats.total).toLocaleString('en-IN')}</b>.
                                    </p>
                                </div>
                            </div>

                            {/* Reassignment Selector */}
                            <div className="space-y-1.5 pt-1">
                                <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                    Reassign Transactions To:
                                </label>
                                <div className="relative">
                                    <select
                                        value={replacementCategory}
                                        onChange={(e) => setReplacementCategory(e.target.value)}
                                        className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200/80 dark:border-white/10 text-xs font-semibold text-gray-900 dark:text-white outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                                    >
                                        {availableReplacementCategories.map((c) => (
                                            <option key={c.id} value={c.id} className="bg-white dark:bg-[#0c0c0e] text-gray-900 dark:text-white">
                                                {c.label} ({c.id})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                    Records will automatically move to this category so your ledger stays intact.
                                </p>
                            </div>

                            {/* Affected Transactions Collapsible Preview */}
                            <div className="border-t border-gray-100 dark:border-white/[0.06] pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAffectedTxs(!showAffectedTxs)}
                                    className="w-full flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-gray-300 py-1"
                                >
                                    <span>Affected Transactions ({matchingTransactions.length})</span>
                                    {showAffectedTxs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>

                                {showAffectedTxs && (
                                    <div className="divide-y divide-gray-100 dark:divide-white/[0.04] max-h-36 overflow-y-auto scrollbar-hide mt-2 -mx-2 px-2">
                                        {matchingTransactions.map((tx) => (
                                            <div key={tx.id} className="flex justify-between items-center py-2 px-2 text-xs">
                                                <div className="truncate pr-2">
                                                    <span className="font-semibold text-gray-900 dark:text-white">{tx.description || tx.category}</span>
                                                    <span className="text-[10px] text-gray-400 ml-2">{new Date(tx.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                                                </div>
                                                <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0 tabular-nums">
                                                    ₹{Number(tx.amount).toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('view')}
                                    disabled={isExecutingDelete}
                                    className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-800 dark:hover:text-white font-semibold text-xs transition-colors"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    onClick={handleExecuteReassignAndDelete}
                                    disabled={isExecutingDelete || !replacementCategory}
                                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                                >
                                    {isExecutingDelete ? (
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
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
