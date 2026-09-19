
import React from 'react';
import { Transaction } from '../../types';
import { AppIcon } from '../core/AppIcon';

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
    onEdit: (t: Transaction) => void;
    onDelete: (id: string) => void;
    onDuplicate?: (t: Transaction) => void;
}

const DetailRow: React.FC<{ label: string, value: string, iconName?: string }> = ({ label, value, iconName }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            {iconName && <AppIcon name={iconName} className="w-3 h-3" />}
            {label}
        </span>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{value}</span>
    </div>
);

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({ isOpen, onClose, transaction, onEdit, onDelete, onDuplicate }) => {
    if (!isOpen || !transaction) return null;

    const isIncome = transaction.type === 'income';
    const isExpense = transaction.type === 'expense';
    
    const dateObj = new Date(transaction.transaction_date);
    const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

    // Dynamic Styling based on type
    let gradient = 'from-indigo-500 to-blue-600';
    let iconName = 'arrow-left-right';
    let sign = '';

    if (isIncome) {
        gradient = 'from-emerald-500 to-teal-600';
        iconName = 'arrow-down-left';
        sign = '+';
    } else if (isExpense) {
        gradient = 'from-rose-500 to-pink-600';
        iconName = 'arrow-up-right';
        sign = '-';
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity duration-300" 
                onClick={onClose} 
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-md">
                
                {/* Main Card */}
                <div className="relative bg-white/90 dark:bg-black/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col">
                    
                    {/* 1. Header / Hero Section */}
                    <div className={`relative p-8 flex flex-col items-center justify-center text-white bg-gradient-to-br ${gradient}`}>
                        
                        {/* Close Button */}
                        <button 
                            onClick={onClose} 
                            className="absolute top-4 right-4 p-2 text-white group"
                        >
                            <AppIcon name="x" className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                        </button>

                        {/* Icon Bubble */}
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
                            <AppIcon name={iconName} className="w-8 h-8 text-white" />
                        </div>

                        {/* Amount */}
                        <h2 className="text-5xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
                            {sign}₹{Number(transaction.amount).toLocaleString('en-IN')}
                        </h2>
                        
                        {/* Description */}
                        <p className="text-lg font-medium text-white/90 text-center max-w-[80%] leading-tight">
                            {transaction.description}
                        </p>

                        {/* Decorative Circles */}
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    </div>

                    {/* 2. Details Body */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent opacity-50"></div>

                    <div className="px-8 pb-8 pt-6">
                        <div className="bg-gray-50/50 dark:bg-black/20 rounded-2xl p-6 shadow-inner border border-gray-100/50 dark:border-white/5">
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <DetailRow label="Category" value={transaction.category} iconName="tag" />
                                <DetailRow label="Payment" value={transaction.payment_method} iconName="credit-card" />
                                <DetailRow label="Date" value={dateStr} iconName="calendar" />
                                <DetailRow label="Time" value={timeStr} iconName="clock" />
                                
                                <div className="col-span-2 pt-4 mt-2 border-t border-dashed border-gray-200 dark:border-gray-700/50 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID</span>
                                    <span className="text-[10px] font-mono text-gray-500 bg-white dark:bg-white/5 px-2 py-1 rounded border border-gray-100 dark:border-white/5">
                                        {transaction.id.slice(0, 8)}...
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Action Buttons */}
                        <div className="flex gap-3 mt-6">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => { onClose(); onEdit(transaction); }}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white font-bold text-xs uppercase tracking-wide hover:bg-gray-200 dark:hover:bg-white/20 transition-all active:scale-[0.98] group"
                                >
                                    <AppIcon name="pen" className="w-4 h-4 group-hover:scale-110 transition-transform" /> Edit
                                </button>
                                {onDuplicate && (
                                    <button 
                                        onClick={() => onDuplicate(transaction)}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold text-xs uppercase tracking-wide hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-all active:scale-[0.98] group"
                                    >
                                        <AppIcon name="copy" className="w-4 h-4 group-hover:scale-110 transition-transform" /> Copy
                                    </button>
                                )}
                            </div>
                            <button 
                                onClick={() => onDelete(transaction.id)}
                                className="flex items-center justify-center p-3 rounded-xl bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/30 transition-all active:scale-[0.98] group"
                                title="Delete"
                            >
                                <AppIcon name="trash-2" className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
