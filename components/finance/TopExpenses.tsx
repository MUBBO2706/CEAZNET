import React, { memo, useState, useEffect, useMemo, useRef } from 'react';
import { Transaction } from '../../types';
import { ArrowUpRight, IndianRupee } from 'lucide-react';
import { TransactionItem } from './TransactionList';
import { CustomCategoryItem, getCustomCategories } from '../../services/dbService';

interface TopExpensesProps {
    transactions: Transaction[];
    isLoading?: boolean;
    onDelete?: (id: string) => void;
    onEdit?: (t: Transaction) => void;
    onView?: (t: Transaction) => void;
    onDuplicate?: (t: Transaction) => void;
    customCategories?: CustomCategoryItem[];
}

const TopExpenses: React.FC<TopExpensesProps> = ({ 
    transactions,
    isLoading = false,
    onDelete = () => {},
    onEdit = () => {},
    onView = () => {},
    onDuplicate = () => {},
    customCategories: customCategoriesProp
}) => {
    // Accordion expansion state for list items
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [loadedCustomCategories, setLoadedCustomCategories] = useState<CustomCategoryItem[]>([]);

    useEffect(() => {
        if (!customCategoriesProp || customCategoriesProp.length === 0) {
            getCustomCategories(null).then(cats => setLoadedCustomCategories(cats)).catch(() => {});
        }
    }, [customCategoriesProp]);

    const activeCustomCategories = customCategoriesProp || loadedCustomCategories;

    // Responsive Desktop Detection matching TransactionList
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

    // Filter and sort expenses by highest amount descending
    const allExpenses = useMemo(() => {
        return [...transactions]
            .filter(t => t.type === 'expense')
            .sort((a, b) => Number(b.amount) - Number(a.amount));
    }, [transactions]);

    const displayLimit = showAll ? 15 : 5;
    const displayedExpenses = useMemo(() => allExpenses.slice(0, displayLimit), [allExpenses, displayLimit]);
    const hasMoreThanFive = allExpenses.length > 5;

    // Total of currently displayed top expenses
    const totalTopExpenseAmount = useMemo(() => {
        return displayedExpenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    }, [displayedExpenses]);

    // Long press and click handling
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressTriggered = useRef(false);

    const handlePointerDown = (id: string) => {
        isLongPressTriggered.current = false;
    };

    const handlePointerUp = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleClick = (t: Transaction) => {
        setExpandedId(prev => prev === t.id ? null : t.id);
    };

    // Skeleton loader matching TransactionList rows
    if (isLoading) {
        return (
            <div className="-mx-4 space-y-2 select-none pb-0">
                <div className="sticky top-0 z-10 bg-[#F9F6F2] dark:bg-black py-2 px-4 flex justify-between items-center border-b border-gray-200 dark:border-white/10 transition-colors w-full">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                            Top Expenses
                        </h3>
                        <span className="w-12 h-3.5 rounded animate-pulse" style={{ backgroundColor: 'var(--finance-skeleton-bg)' }} />
                    </div>
                    <div className="w-16 h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--finance-skeleton-bg)' }} />
                </div>
                <div className="flex flex-col">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div 
                            key={i} 
                            className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800/80"
                        >
                            <div className="flex items-center gap-4 lg:gap-3 flex-1 min-w-0">
                                <div className="w-12 h-12 lg:w-9 lg:h-9 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: 'var(--finance-skeleton-bg)' }} />
                                <div className="flex flex-col gap-1.5 flex-1 pr-2">
                                    <div className="w-32 sm:w-44 h-3.5 rounded animate-pulse" style={{ backgroundColor: 'var(--finance-skeleton-bg)' }} />
                                    <div className="w-20 sm:w-28 h-2.5 rounded animate-pulse" style={{ backgroundColor: 'var(--finance-skeleton-bg)' }} />
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="w-16 sm:w-20 h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--finance-skeleton-bg)' }} />
                                <div className="w-10 h-2.5 rounded animate-pulse" style={{ backgroundColor: 'var(--finance-skeleton-bg)' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (allExpenses.length === 0) {
        return (
            <div className="-mx-4 space-y-2 select-none pb-0">
                <div className="sticky top-0 z-10 bg-[#F9F6F2] dark:bg-black py-2 px-4 flex justify-between items-center border-b border-gray-200 dark:border-white/10 transition-colors w-full">
                    <h3 className="font-bold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                        Top Expenses
                    </h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40">
                        0 entries
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
                    <div 
                        className="p-4 sm:p-5 rounded-full mb-3 flex items-center justify-center"
                        style={{ backgroundColor: 'var(--finance-empty-icon-bg)' }}
                    >
                        <IndianRupee className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: 'var(--finance-empty-text)' }} />
                    </div>
                    <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--finance-empty-text)' }}>
                        No Expenses In This Period
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="-mx-4 space-y-2 select-none pb-0">
            {/* Sticky Header Matching TransactionList Date Group Header */}
            <div className="sticky top-0 z-10 bg-[#F9F6F2] dark:bg-black py-2 px-4 flex justify-between items-center border-b border-gray-200 dark:border-white/10 transition-colors w-full">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                        Top Expenses
                    </h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40">
                        {displayedExpenses.length} {displayedExpenses.length === 1 ? 'entry' : 'entries'}
                    </span>
                </div>
                
                <div className="flex items-center gap-2.5">
                    {/* Total Expense Outflow Summary */}
                    {totalTopExpenseAmount > 0 && (
                        <div className="flex items-center text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            <span>{totalTopExpenseAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                    )}
                    
                    {/* Verdict Pill exactly matching TransactionList */}
                    <div className="px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800">
                        -₹{totalTopExpenseAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                </div>
            </div>
            
            {/* List of Transaction Items */}
            <div className="flex flex-col">
                {displayedExpenses.map((t, i) => (
                    <TransactionItem 
                        key={t.id}
                        t={t}
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
                        rank={i + 1}
                        showDate={true}
                    />
                ))}
            </div>

            {/* Toggle to view Top 5 or Top 15/All */}
            {hasMoreThanFive && (
                <div className="py-2.5 px-4 flex justify-center">
                    <button
                        type="button"
                        onClick={() => setShowAll(prev => !prev)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight border transition-colors cursor-pointer active:scale-95"
                        style={{
                            backgroundColor: 'var(--finance-loadmore-btn-bg)',
                            color: 'var(--finance-loadmore-btn-text)',
                            borderColor: 'var(--finance-loadmore-btn-border)'
                        }}
                    >
                        {showAll ? 'Show Top 5 Only' : `View More (${Math.min(allExpenses.length, 15)} items)`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default memo(TopExpenses);

