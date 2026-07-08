import React, { useState } from 'react';
import { DairyItem, DairyEntry, DairyPayment } from '../../types';
import { ChevronLeft, ChevronRight, Check, X, AlertCircle } from 'lucide-react';
import { allocatePayments } from '../../utils/dairyUtils';

interface DairyCalendarProps {
    item: DairyItem;
    entries: DairyEntry[];
    payments: DairyPayment[];
    onDateClick: (date: string) => void;
    onPaymentClick: (payment: DairyPayment) => void;
}

const DairyCalendar: React.FC<DairyCalendarProps> = ({ item, entries, payments, onDateClick, onPaymentClick }) => {
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
    
    const allocatedEntries = allocatePayments(entries, payments);

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const renderDays = () => {
        const days = [];
        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 md:h-12 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50" />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entry = allocatedEntries.find(e => e.date === dateStr);
            const dayPayments = payments.filter(p => p.date === dateStr);
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            days.push(
                <div 
                    key={day} 
                    onClick={() => onDateClick(dateStr)}
                    className={`h-24 md:h-12 border border-gray-100 dark:border-gray-800 p-1.5 md:p-1 relative cursor-pointer transition-colors group flex flex-col items-center justify-center
                        ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-white dark:bg-[#050505]'}
                        ${entry || dayPayments.length > 0 ? 'hover:bg-gray-50 dark:hover:bg-gray-900/50' : 'hover:bg-blue-50 dark:hover:bg-blue-900/10'}
                    `}
                >
                    <div className={`absolute top-1 left-1.5 text-[10px] font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {day}
                    </div>

                    {entry && (
                        <div className="absolute top-1.5 right-1.5 flex items-center justify-center" title={entry.isFullyPaid ? "Fully Paid" : (entry.paidAmount > 0 ? `Partially Paid (₹${entry.paidAmount})` : "Due")}>
                            {entry.isFullyPaid ? (
                                <div className="flex items-center justify-center w-4 h-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                </div>
                            ) : entry.paidAmount > 0 ? (
                                <div className="flex items-center justify-center w-4 h-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                                    <span className="text-[8px] font-bold text-yellow-600 dark:text-yellow-400">½</span>
                                </div>
                            ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.6)]" />
                            )}
                        </div>
                    )}
                    
                    <div className="flex flex-col items-center justify-center w-full h-full pt-3 gap-0.5 overflow-y-auto no-scrollbar">
                        {entry && (
                            <>
                                <span className={`text-xs font-bold leading-none ${entry.isFullyPaid ? 'text-emerald-600 dark:text-emerald-400' : (entry.paidAmount > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-orange-400')}`}>
                                    {entry.quantity}<span className="text-[10px] font-medium ml-0.5">{item.unit}</span>
                                </span>
                                <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-none">
                                    ₹{entry.totalPrice}
                                </span>
                            </>
                        )}
                        
                        {dayPayments.map(payment => (
                            <div 
                                key={payment.id}
                                onClick={(e) => { e.stopPropagation(); onPaymentClick(payment); }}
                                className="mt-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-[9px] font-bold cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-0.5"
                                title="Click to view/edit payment"
                            >
                                -₹{payment.amount}
                            </div>
                        ))}
                    </div>

                    {!entry && dayPayments.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] text-blue-500 font-medium">+ Add</span>
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
            </div>

            <div className="grid grid-cols-7 text-center py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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

export default DairyCalendar;
