
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Transaction } from '../../types';
import { 
    IndianRupee, Check, HelpCircle, Loader2, ArrowDownLeft, ArrowUpRight, Gauge
} from 'lucide-react';
import { CATEGORY_CONFIG } from './categories';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete: (id: string) => void;
    onEdit: (t: Transaction) => void;
    onView: (t: Transaction) => void;
    
    // Selection Props
    isSelectionMode?: boolean;
    selectedIds?: Set<string>;
    onToggleSelection?: (id: string) => void;
    onLongPress?: (id: string) => void;
}

const CategoryIcon: React.FC<{ categoryId: string, type: string, className?: string }> = ({ categoryId, type, className }) => {
    // Lookup the icon from our central config
    const configList = CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.expense;
    const categoryData = configList.find(c => c.id === categoryId);
    
    if (categoryData) {
        const IconComponent = categoryData.icon;
        return <IconComponent className={className} />;
    }

    // Fallback for custom categories
    return <HelpCircle className={className} />;
}

const TransactionItem = React.memo<{
    t: Transaction;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onPointerDown: (id: string) => void;
    onPointerUp: () => void;
    onClick: (t: Transaction) => void;
}>(({ t, isSelectionMode, isSelected, onPointerDown, onPointerUp, onClick }) => {
    const isIncome = t.type === 'income';
    const isExpense = t.type === 'expense';
    const mileage = t.metadata?.mileage;

    return (
        <div
            onPointerDown={() => onPointerDown(t.id)}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={() => onClick(t)}
            className={`group relative flex items-center justify-between p-4 lg:p-3 rounded-2xl lg:rounded-xl border transition-all duration-200 text-left active:scale-[0.99] cursor-pointer
                ${isSelected 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 shadow-md scale-[0.99]' 
                    : 'bg-white dark:bg-[#050505] lg:bg-transparent lg:dark:bg-transparent border-gray-100 dark:border-gray-800 lg:border-transparent lg:hover:border-gray-200 lg:dark:hover:border-gray-800 shadow-sm lg:shadow-none hover:shadow-lg hover:bg-white lg:hover:bg-gray-50 hover:dark:bg-[#050505] lg:hover:dark:bg-[#111]'
                }
            `}
        >
            <div className="flex items-center gap-4 lg:gap-3 min-w-0 flex-1">
                {/* Icon or Checkbox */}
                <div className={`w-12 h-12 lg:w-9 lg:h-9 rounded-xl lg:rounded-lg flex items-center justify-center flex-shrink-0 transition-transform ${isSelectionMode ? '' : 'group-hover:scale-105'} 
                    ${isSelected ? 'bg-indigo-500 text-white' : 
                        isIncome ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                        isExpense ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' :
                        'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    }`}>
                    {isSelectionMode ? (
                        isSelected ? <Check className="w-6 h-6 lg:w-4 lg:h-4" /> : <div className="w-5 h-5 lg:w-4 lg:h-4 rounded-full border-2 border-gray-400 dark:border-gray-600" />
                    ) : (
                        <CategoryIcon categoryId={t.category} type={t.type} className="w-5 h-5 lg:w-4 lg:h-4" />
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

            <div className="flex flex-col items-end gap-0.5 pl-1 flex-shrink-0">
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
    );
});

const TransactionList: React.FC<TransactionListProps> = ({ 
    transactions, 
    onView,
    isSelectionMode,
    selectedIds,
    onToggleSelection,
    onLongPress
}) => {
    // Optimization 1: Memoize grouping logic to prevent heavy calculation on every render
    const grouped = useMemo(() => {
        return transactions.reduce((acc, t) => {
            const date = new Date(t.transaction_date).toDateString();
            if (!acc[date]) acc[date] = [];
            acc[date].push(t);
            return acc;
        }, {} as Record<string, Transaction[]>);
    }, [transactions]);

    // Optimization 2: Lazy Loading State
    const [displayLimit, setDisplayLimit] = useState(15); // Initial number of days/groups to show
    const observerTarget = useRef<HTMLDivElement>(null);

    const dateKeys = useMemo(() => Object.keys(grouped), [grouped]);
    const visibleKeys = dateKeys.slice(0, displayLimit);
    const hasMore = displayLimit < dateKeys.length;

    // Reset pagination when filters change (transactions prop changes)
    useEffect(() => {
        setDisplayLimit(15);
    }, [transactions]);

    // Optimization 3: Intersection Observer for Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setDisplayLimit((prev) => prev + 10); // Load 10 more days at a time
                }
            },
            { threshold: 0.1, rootMargin: '200px' } // Load before reaching exact bottom
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [hasMore, dateKeys.length]);

    // Refs for Long Press Logic
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPressTriggered = useRef(false);

    const handlePointerDown = (id: string) => {
        if (isSelectionMode) return; 
        
        isLongPressTriggered.current = false;
        timerRef.current = setTimeout(() => {
            isLongPressTriggered.current = true;
            if (onLongPress) onLongPress(id);
        }, 500); 
    };

    const handlePointerUp = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleClick = (t: Transaction) => {
        if (isLongPressTriggered.current) {
            isLongPressTriggered.current = false;
            return;
        }
        if (isSelectionMode && onToggleSelection) {
            onToggleSelection(t.id);
        } else {
            onView(t);
        }
    };

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <IndianRupee className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No transactions found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 select-none">
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
                    <div key={dateStr} className="animate-fade-in-up">
                        {/* Enhanced Date Header with Verdict */}
                        <div className="sticky top-0 z-10 lg:static lg:z-auto bg-[#F9F6F2] dark:bg-[#050505] lg:bg-transparent lg:dark:bg-transparent shadow-sm lg:shadow-none py-2.5 lg:py-1.5 mb-2 lg:mb-1 px-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-800 lg:border-none transition-colors rounded-xl mx-[-4px] lg:mx-0">
                            <h3 className="font-bold text-gray-600 dark:text-gray-400 text-xs lg:text-[11px] uppercase tracking-widest pl-1">
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
                        
                        <div className="flex flex-col gap-3">
                            {dayTransactions.map((t) => (
                                <TransactionItem 
                                    key={t.id} 
                                    t={t} 
                                    isSelectionMode={isSelectionMode} 
                                    isSelected={selectedIds?.has(t.id)} 
                                    onPointerDown={handlePointerDown} 
                                    onPointerUp={handlePointerUp} 
                                    onClick={handleClick} 
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
            
            {/* Sentinel for Infinite Scroll */}
            {hasMore && (
                <div ref={observerTarget} className="py-6 flex justify-center items-center">
                    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-medium bg-gray-100 dark:bg-[#1a1a1a] px-4 py-2 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Loading more history...
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionList;
