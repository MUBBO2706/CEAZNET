import React, { useState, useMemo } from 'react';
import { Transaction } from '../../types';
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, PlusCircle } from 'lucide-react';

interface FinanceCalendarProps {
    transactions: Transaction[];
    onDateClick: (date: string) => void;
}

const FinanceCalendar: React.FC<FinanceCalendarProps> = ({ transactions, onDateClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const dailyStats = useMemo(() => {
        const stats: Record<string, { income: number; expense: number; count: number }> = {};
        
        transactions.forEach(t => {
            let dateStr = '';
            // Handle YYYY-MM-DD strings directly to avoid timezone shifts
            if (typeof t.transaction_date === 'string' && t.transaction_date.length === 10 && t.transaction_date.includes('-')) {
                dateStr = t.transaction_date;
            } else {
                const date = new Date(t.transaction_date);
                dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
            
            if (!stats[dateStr]) {
                stats[dateStr] = { income: 0, expense: 0, count: 0 };
            }
            
            if (t.type === 'income') {
                stats[dateStr].income += Number(t.amount);
            } else if (t.type === 'expense') {
                stats[dateStr].expense += Number(t.amount);
            }
            // Transfers are excluded from daily totals to avoid double counting or confusion
            
            stats[dateStr].count += 1;
        });
        
        return stats;
    }, [transactions]);

    const formatAmount = (amount: number) => {
        if (amount >= 10000000) { // Crore
            return (amount / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
        }
        if (amount >= 100000) { // Lakh
            return (amount / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
        }
        if (amount >= 1000) {
            return (amount / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
        }
        return amount.toString();
    };

    const renderDays = () => {
        const days = [];
        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[80px] bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50" />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const stats = dailyStats[dateStr];
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            days.push(
                <div 
                    key={day} 
                    onClick={() => onDateClick(dateStr)}
                    className={`min-h-[80px] border border-gray-100 dark:border-gray-800 p-1 relative cursor-pointer transition-colors group flex flex-col justify-between
                        ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'bg-white dark:bg-[#050505]'}
                        ${stats ? 'hover:bg-gray-50 dark:hover:bg-gray-900/50' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/10'}
                    `}
                >
                    <div className="flex justify-between items-start w-full">
                        <span className={`text-[10px] font-semibold ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                            {day}
                        </span>
                    </div>

                    {stats ? (
                        <div className="flex flex-col gap-0.5 w-full mt-1">
                            {stats.income > 0 && (
                                <div className="flex items-center justify-end gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                                    <ArrowDownLeft className="w-2 h-2" />
                                    <span className="truncate">{formatAmount(stats.income)}</span>
                                </div>
                            )}
                            {stats.expense > 0 && (
                                <div className="flex items-center justify-end gap-0.5 text-[9px] text-rose-600 dark:text-rose-400 font-bold">
                                    <ArrowUpRight className="w-2 h-2" />
                                    <span className="truncate">{formatAmount(stats.expense)}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlusCircle className="w-4 h-4 text-indigo-400" />
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="w-full bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
            </div>

            <div className="grid grid-cols-7 text-center py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {renderDays()}
            </div>
        </div>
    );
};

export default FinanceCalendar;
