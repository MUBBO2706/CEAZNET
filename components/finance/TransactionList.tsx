
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Transaction } from '../../types';
import { 
    IndianRupee, Check, HelpCircle, Loader, ArrowDownLeft, ArrowUpRight, Gauge,
    ChevronDown, Calendar, Clock, Wallet, CreditCard,
    Edit2, Copy, Fuel, ExternalLink, CheckCircle2, Car, Route, Droplets,
    FileText, X
} from 'lucide-react';
import { InlineConfirmDelete } from '../core/InlineConfirmDelete';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORY_CONFIG, getCategoryConfig } from './categories';
import { getCustomCategories, CustomCategoryItem } from '../../services/dbService';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete: (id: string) => void;
    onEdit: (t: Transaction) => void;
    onView: (t: Transaction) => void;
    onDuplicate?: (t: Transaction) => void;
    
    // Selection Props
    isSelectionMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelection?: (id: string) => void;
    onLongPress?: (id: string) => void;
    customCategories?: CustomCategoryItem[];
    isLoading?: boolean;

    // Real Server Pagination Props
    hasMore?: boolean;
    isLoadingMore?: boolean;
    onLoadMore?: () => void;
    totalCount?: number;
}

const CategoryIcon: React.FC<{ categoryId: string, type: string, className?: string, customCategories?: CustomCategoryItem[] }> = ({ categoryId, type, className, customCategories = [] }) => {
    const categoryData = getCategoryConfig(categoryId, type, customCategories);
    if (categoryData) {
        const IconComponent = categoryData.icon;
        return <IconComponent className={className} />;
    }
    return <HelpCircle className={className} />;
}

const TransactionItem = React.memo<{
    t: Transaction;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    isExpanded?: boolean;
    isDesktop?: boolean;
    customCategories?: CustomCategoryItem[];
    onPointerDown: (id: string) => void;
    onPointerUp: () => void;
    onClick: (t: Transaction) => void;
    onEdit: (t: Transaction) => void;
    onDelete: (id: string) => void;
    onDuplicate?: (t: Transaction) => void;
    onView?: (t: Transaction) => void;
}>(({ 
    t, 
    isSelectionMode, 
    isSelected, 
    isExpanded, 
    isDesktop, 
    customCategories = [],
    onPointerDown, 
    onPointerUp, 
    onClick,
    onEdit,
    onDelete,
    onDuplicate,
    onView
}) => {
    const isIncome = t.type === 'income';
    const isExpense = t.type === 'expense';
    const metadata = t.metadata;
    const mileage = metadata?.mileage;

    const [isDescModalOpen, setIsDescModalOpen] = useState(false);

    const dateObj = useMemo(() => new Date(t.transaction_date), [t.transaction_date]);
    const dateStr = useMemo(() => dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), [dateObj]);
    const weekdayStr = useMemo(() => dateObj.toLocaleDateString(undefined, { weekday: 'long' }), [dateObj]);
    const timeStr = useMemo(() => dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true }), [dateObj]);

    const timeAgo = useMemo(() => {
        const diff = (new Date().getTime() - dateObj.getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }, [dateObj]);

    return (
        <div className={`border-b border-gray-100 dark:border-gray-800/80 transition-colors duration-150
            ${isSelected 
                ? 'bg-indigo-50/70 dark:bg-indigo-950/20' 
                : isExpanded
                    ? (isIncome ? 'bg-emerald-50/70 dark:bg-emerald-950/15' : 'bg-rose-50/70 dark:bg-rose-950/15')
                    : (isIncome ? 'bg-emerald-50/25 dark:bg-emerald-950/5' : 'bg-rose-50/25 dark:bg-rose-950/5')
            }
        `}>
            {/* Transaction Header Row */}
            <div
                onPointerDown={() => onPointerDown(t.id)}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={() => onClick(t)}
                className={`group relative flex items-center justify-between px-4 py-3 transition-colors duration-150 text-left active:scale-[0.99] cursor-pointer w-full
                    ${!isSelected && !isExpanded 
                        ? (isIncome ? 'hover:bg-emerald-100/40 dark:hover:bg-emerald-950/20' : 'hover:bg-rose-100/40 dark:hover:bg-rose-950/20') 
                        : ''
                    }
                `}
            >
                <div className="flex items-center gap-4 lg:gap-3 min-w-0 flex-1">
                    {/* Icon or Checkbox */}
                    <div className={`w-12 h-12 lg:w-9 lg:h-9 flex items-center justify-center flex-shrink-0 transition-transform ${isSelectionMode ? 'rounded-xl lg:rounded-lg' : 'group-hover:scale-105'} 
                        ${isSelected ? 'bg-indigo-500 text-white rounded-xl lg:rounded-lg' : 
                            isSelectionMode ? 'bg-gray-100 dark:bg-neutral-800 rounded-xl lg:rounded-lg' : ''
                        }
                        ${!isSelected ? (
                            isIncome ? 'text-emerald-600 dark:text-emerald-400' :
                            isExpense ? 'text-rose-600 dark:text-rose-400' :
                            'text-indigo-600 dark:text-indigo-400'
                        ) : ''}`}>
                        {isSelectionMode ? (
                            isSelected ? <Check className="w-6 h-6 lg:w-4 lg:h-4" /> : <div className="w-5 h-5 lg:w-4 lg:h-4 rounded-full border-2 border-gray-400 dark:border-gray-600" />
                        ) : (
                            <CategoryIcon categoryId={t.category} type={t.type} className="w-6 h-6 lg:w-5 lg:h-5" customCategories={customCategories} />
                        )}
                    </div>
                    
                    <div className="min-w-0 flex flex-col gap-0.5 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                            <p className={`font-bold truncate text-base lg:text-sm leading-tight ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-white'}`}>
                                {t.description}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs lg:text-[10px] font-medium text-gray-500 dark:text-gray-400 flex-wrap">
                            <span className="capitalize truncate max-w-[80px]">{t.category}</span>
                            <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full flex-shrink-0"></span>
                            <span className="opacity-70 truncate max-w-[80px]">{t.payment_method}</span>
                            {mileage && (
                                <>
                                    <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full flex-shrink-0"></span>
                                    <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                        <Gauge className="w-3 h-3" /> {mileage} km/L
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 pl-1 flex-shrink-0">
                    <div className="flex flex-col items-end gap-0.5">
                        <span className={`text-base lg:text-sm font-bold tabular-nums whitespace-nowrap flex-shrink-0 ${
                            isIncome ? 'text-emerald-600 dark:text-emerald-400' : 
                            isExpense ? 'text-red-600 dark:text-red-400' : 
                            'text-indigo-600 dark:text-indigo-400'
                        }`}>
                            {isExpense ? '-' : '+'}₹{Number(t.amount).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] lg:text-[9px] font-medium text-gray-400 dark:text-gray-600">
                            {new Date(t.transaction_date).toLocaleTimeString(undefined, {hour: 'numeric', minute:'2-digit', hour12: true})}
                        </span>
                    </div>


                </div>
            </div>

            {/* Expanded Accordion Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden px-3.5 sm:px-4 pb-3.5 pt-1"
                    >
                        <div className="flex flex-col gap-3 w-full">
                            {/* Top Status Badge & Quick Actions on same row on desktop, split row on mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200/40 dark:border-gray-800/40">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                                        isIncome ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
                                        isExpense ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' :
                                        'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                    }`}>
                                        <CheckCircle2 className="w-3 h-3" />
                                        {t.type}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsDescModalOpen(true);
                                        }}
                                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer shrink-0"
                                    >
                                        <span>View Description</span>
                                    </button>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-gray-700/80 text-gray-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-600 transition-colors shadow-xs flex items-center gap-1.5 text-xs font-semibold"
                                        title="Edit Transaction"
                                    >
                                        <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                                        <span className="inline">Edit</span>
                                    </button>
                                    <InlineConfirmDelete
                                        onDelete={() => onDelete(t.id)}
                                        iconOnly={false}
                                        text="Delete"
                                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-gray-700/80 text-gray-600 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-600 transition-colors shadow-xs flex items-center text-xs font-semibold gap-1.5"
                                        iconClassName="w-3.5 h-3.5 text-rose-500"
                                    />
                                    {onDuplicate && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onDuplicate(t); }}
                                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-gray-700/80 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors shadow-xs flex items-center gap-1.5 text-xs font-semibold"
                                            title="Copy Transaction"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="inline">Copy</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Details Grid (Informative 2x2 on mobile, 4 cols on desktop) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {/* Date Card */}
                                <div className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1 shadow-2xs ${
                                    isIncome 
                                        ? 'bg-white/70 dark:bg-black/45 border-emerald-100/70 dark:border-emerald-900/30' 
                                        : 'bg-white/70 dark:bg-black/45 border-rose-100/70 dark:border-rose-900/30'
                                }`}>
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Date</span>
                                        </div>
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">{weekdayStr}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{dateStr}</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">Transaction Date</p>
                                    </div>
                                </div>

                                {/* Time Card */}
                                <div className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1 shadow-2xs ${
                                    isIncome 
                                        ? 'bg-white/70 dark:bg-black/45 border-emerald-100/70 dark:border-emerald-900/30' 
                                        : 'bg-white/70 dark:bg-black/45 border-rose-100/70 dark:border-rose-900/30'
                                }`}>
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                            <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Time</span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 truncate shrink-0">{timeAgo}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{timeStr}</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">Entry Time</p>
                                    </div>
                                </div>

                                {/* Wallet Card */}
                                <div className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1 shadow-2xs ${
                                    isIncome 
                                        ? 'bg-white/70 dark:bg-black/45 border-emerald-100/70 dark:border-emerald-900/30' 
                                        : 'bg-white/70 dark:bg-black/45 border-rose-100/70 dark:border-rose-900/30'
                                }`}>
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                            <Wallet className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Wallet</span>
                                        </div>
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">Active</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                            {t.profile_id ? "Custom Wallet" : "Main Wallet"}
                                        </p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                            {t.profile_id ? "Profile Account" : "Default Account"}
                                        </p>
                                    </div>
                                </div>

                                {/* Payment Method Card */}
                                <div className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1 shadow-2xs ${
                                    isIncome 
                                        ? 'bg-white/70 dark:bg-black/45 border-emerald-100/70 dark:border-emerald-900/30' 
                                        : 'bg-white/70 dark:bg-black/45 border-rose-100/70 dark:border-rose-900/30'
                                }`}>
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                                            <CreditCard className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Method</span>
                                        </div>
                                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 truncate shrink-0">
                                            {t.payment_method || 'Cash'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                            {t.payment_method || 'Cash Payment'}
                                        </p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">Payment Mode</p>
                                    </div>
                                </div>
                            </div>

                            {/* Vehicle Fuel Metadata if present */}
                            {metadata?.vehicle_id && (
                                <div className="bg-transparent p-2.5 rounded-xl border border-red-200/40 dark:border-red-900/30 flex flex-col gap-2">
                                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs">
                                        <Fuel className="w-4 h-4" />
                                        <span>Vehicle Fuel Log — {metadata.vehicle_name || 'Vehicle'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                        <div>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Mileage</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{metadata.mileage ? `${metadata.mileage} km/L` : 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Distance Driven</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{metadata.distance_driven ? `+${metadata.distance_driven} km` : 'First Log'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Odometer</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{metadata.odometer_reading ? `${metadata.odometer_reading.toLocaleString()} km` : 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Fuel Volume</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{metadata.fuel_liters ? `${metadata.fuel_liters} L` : 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Reference Footer - Separate Rows */}
                            <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-200/40 dark:border-gray-800/40 text-[11px]">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Ref ID</span>
                                    <span className="font-mono bg-gray-100 dark:bg-gray-800/60 px-2 py-0.5 rounded border border-gray-200/60 dark:border-gray-700/60 text-gray-700 dark:text-gray-300 select-all text-[10px]">
                                        {t.id}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-500 dark:text-gray-400 font-medium">Created Date</span>
                                    <span className="text-gray-700 dark:text-gray-300 font-medium text-[10px]">
                                        {new Date(t.created_at || t.transaction_date).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Full Description Modal (Instant appearance, no fade-in animation) */}
            {isDescModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-text"
                    onClick={(e) => { e.stopPropagation(); setIsDescModalOpen(false); }}
                >
                    <div 
                        className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl p-5 max-w-md w-full shadow-2xl relative flex flex-col gap-4 text-left"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Transaction Description</h4>
                            <button
                                type="button"
                                onClick={() => setIsDescModalOpen(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Direct Description Display */}
                        <div className="max-h-60 overflow-y-auto text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words leading-relaxed select-text py-1">
                            {t.description || "No description provided."}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

const TransactionList: React.FC<TransactionListProps> = React.memo(({ 
    transactions, 
    onDelete,
    onEdit,
    onView,
    onDuplicate,
    isSelectionMode,
    selectedIds,
    onToggleSelection,
    onLongPress,
    customCategories: customCategoriesProp,
    isLoading,
    hasMore: hasMoreProp,
    isLoadingMore = false,
    onLoadMore,
    totalCount
}) => {
    // Accordion expansion state for desktop
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [loadedCustomCategories, setLoadedCustomCategories] = useState<CustomCategoryItem[]>([]);

    useEffect(() => {
        getCustomCategories(null).then(cats => setLoadedCustomCategories(cats)).catch(() => {});
    }, []);

    const activeCustomCategories = customCategoriesProp || loadedCustomCategories;

    // Responsive Desktop Detection
    const [isDesktop, setIsDesktop] = useState(() => 
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const checkDesktop = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    // Optimization 1: Memoize grouping logic to prevent heavy calculation on every render
    const grouped = useMemo(() => {
        return transactions.reduce((acc, t) => {
            const date = new Date(t.transaction_date).toDateString();
            if (!acc[date]) acc[date] = [];
            acc[date].push(t);
            return acc;
        }, {} as Record<string, Transaction[]>);
    }, [transactions]);

    const isServerPaginated = Boolean(onLoadMore);

    // Optimization 2: Lazy Loading State for client-only fallback
    const [displayLimit, setDisplayLimit] = useState(15); 
    const observerTarget = useRef<HTMLDivElement>(null);

    const dateKeys = useMemo(() => Object.keys(grouped), [grouped]);
    const visibleKeys = isServerPaginated ? dateKeys : dateKeys.slice(0, displayLimit);
    const effectiveHasMore = isServerPaginated ? Boolean(hasMoreProp) : displayLimit < dateKeys.length;

    // Reset client pagination when transactions change
    useEffect(() => {
        if (!isServerPaginated) {
            setDisplayLimit(15);
        }
    }, [transactions, isServerPaginated]);

    // Optimization 3: Intersection Observer for Infinite Scroll
    useEffect(() => {
        if (!effectiveHasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    if (isServerPaginated) {
                        if (!isLoadingMore && onLoadMore) {
                            onLoadMore();
                        }
                    } else {
                        setDisplayLimit((prev) => prev + 10);
                    }
                }
            },
            { threshold: 0.1, rootMargin: '250px' }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [effectiveHasMore, isServerPaginated, isLoadingMore, onLoadMore, dateKeys.length]);

    // Refs for Long Press Logic
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressTriggered = useRef(false);

    const handlePointerDown = React.useCallback((id: string) => {
        if (isSelectionMode) return; 
        
        isLongPressTriggered.current = false;
        timerRef.current = setTimeout(() => {
            isLongPressTriggered.current = true;
            if (onLongPress) onLongPress(id);
        }, 500); 
    }, [isSelectionMode, onLongPress]);

    const handlePointerUp = React.useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const handleClick = React.useCallback((t: Transaction) => {
        if (isLongPressTriggered.current) {
            isLongPressTriggered.current = false;
            return;
        }
        if (isSelectionMode && onToggleSelection) {
            onToggleSelection(t.id);
        } else {
            setExpandedId(prev => prev === t.id ? null : t.id);
        }
    }, [isSelectionMode, onToggleSelection]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center" style={{ color: 'var(--finance-loader-text)' }}>
                <Loader className="w-7 h-7 sm:w-8 sm:h-8 animate-spin mb-3" style={{ color: 'var(--finance-loader-spinner)' }} />
                <p className="text-sm font-medium tracking-tight">Loading Transactions</p>
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
                <div 
                    className="p-5 sm:p-6 rounded-full mb-4 flex items-center justify-center"
                    style={{ backgroundColor: 'var(--finance-empty-icon-bg)' }}
                >
                    <IndianRupee className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: 'var(--finance-empty-text)' }} />
                </div>
                <p className="text-sm sm:text-base font-semibold tracking-tight" style={{ color: 'var(--finance-empty-text)' }}>
                    No Transactions
                </p>
            </div>
        );
    }

    return (
        <div className="-mx-4 space-y-2 select-none pb-0">
            {visibleKeys.map(dateStr => {
                const dayTransactions = grouped[dateStr];
                
                // Calculate daily totals
                const dailyIncome = dayTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + Number(t.amount), 0);

                const dailyExpense = dayTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + Number(t.amount), 0);

                const dailyBalance = dailyIncome - dailyExpense;
                
                return (
                    <div key={dateStr}>
                        {/* Enhanced Date Header with Verdict */}
                        <div className="sticky top-0 z-10 bg-[#F9F6F2] dark:bg-black py-2 px-4 flex justify-between items-center border-b border-gray-200 dark:border-white/10 transition-colors w-full">
                            <h3 className="font-bold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-widest">
                                {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                            </h3>
                            
                            <div className="flex items-center gap-3">
                                {/* Income Summary */}
                                {dailyIncome > 0 && (
                                    <div className="flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        <ArrowDownLeft className="w-3 h-3 mr-0.5" />
                                        <span>{dailyIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                    </div>
                                )}
                                
                                {/* Expense Summary */}
                                {dailyExpense > 0 && (
                                    <div className="flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                        <ArrowUpRight className="w-3 h-3 mr-0.5" />
                                        <span>{dailyExpense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                    </div>
                                )}
                                
                                {/* Verdict Pill */}
                                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border ${
                                    dailyBalance >= 0 
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                                        : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                }`}>
                                    {dailyBalance >= 0 ? '+' : ''}{dailyBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col">
                            {dayTransactions.map((t) => (
                                <TransactionItem 
                                    key={t.id} 
                                    t={t} 
                                    isSelectionMode={isSelectionMode} 
                                    isSelected={selectedIds?.has(t.id)} 
                                    isExpanded={expandedId === t.id}
                                    isDesktop={isDesktop}
                                    customCategories={activeCustomCategories}
                                    onPointerDown={handlePointerDown} 
                                    onPointerUp={handlePointerUp} 
                                    onClick={handleClick} 
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onDuplicate={onDuplicate}
                                    onView={onView}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
            
            {/* Sentinel for Infinite Scroll & Load More Controls */}
            {effectiveHasMore && (
                <div ref={observerTarget} className="py-4 flex flex-col justify-center items-center gap-2">
                    {isLoadingMore ? (
                        <div className="flex items-center gap-2 text-sm font-medium py-2 text-gray-500 dark:text-gray-400">
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Loading more transactions...</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onLoadMore && onLoadMore()}
                            className="flex items-center gap-2 text-xs font-medium px-4 py-2 rounded-xl border transition-all cursor-pointer"
                            style={{
                                backgroundColor: 'var(--finance-loadmore-btn-bg)',
                                color: 'var(--finance-loadmore-btn-text)',
                                borderColor: 'var(--finance-loadmore-btn-border)'
                            }}
                        >
                            <span>Load More Transactions</span>
                            {totalCount !== undefined && totalCount > 0 && (
                                <span className="text-[10px] opacity-75 font-mono">
                                    ({transactions.length} of {totalCount})
                                </span>
                            )}
                        </button>
                    )}
                </div>
            )}

            {!effectiveHasMore && isServerPaginated && transactions.length >= 30 && (
                <div 
                    className="py-4 text-center text-[10px] font-mono uppercase tracking-wider opacity-60" 
                    style={{ color: 'var(--finance-loader-text)' }}
                >
                    All {totalCount || transactions.length} transactions loaded
                </div>
            )}
        </div>
    );
});

export default TransactionList;
