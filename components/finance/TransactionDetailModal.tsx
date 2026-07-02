
import React from 'react';
import { Transaction } from '../../types';
import { X, Calendar, Clock, Tag, CreditCard, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Copy } from 'lucide-react';

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction | null;
    onEdit: (t: Transaction) => void;
    onDelete: (id: string) => void;
    onDuplicate?: (t: Transaction) => void;
}

const DetailRow: React.FC<{ label: string, value: string, icon?: React.ElementType }> = ({ label, value, icon: Icon }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
            {Icon && <Icon className="w-3 h-3" />}
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
    let iconBg = 'bg-indigo-400';
    let Icon = ArrowRightLeft;
    let sign = '';

    if (isIncome) {
        gradient = 'from-emerald-500 to-teal-600';
        iconBg = 'bg-emerald-400';
        Icon = ArrowDownLeft;
        sign = '+';
    } else if (isExpense) {
        gradient = 'from-rose-500 to-pink-600';
        iconBg = 'bg-rose-400';
        Icon = ArrowUpRight;
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
            <div className="relative w-full max-w-md transform transition-all animate-fade-in-up">
                
                {/* Main Card */}
                <div className="relative bg-white/90 dark:bg-[#161618]/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col">
                    
                    {/* 1. Header / Hero Section */}
                    <div className={`relative p-8 flex flex-col items-center justify-center text-white bg-gradient-to-br ${gradient}`}>
                        
                        {/* Close Button */}
                        <button 
                            onClick={onClose} 
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>

                        {/* Icon Bubble */}
                        <div className={`w-16 h-16 rounded-2xl ${iconBg} bg-opacity-30 backdrop-blur-sm flex items-center justify-center mb-4 shadow-lg border border-white/20`}>
                            <div className="w-10 h-10 rounded-xl bg-white text-gray-900 flex items-center justify-center shadow-sm">
                                <Icon className="w-6 h-6" strokeWidth={2.5} />
                            </div>
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
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    </div>

                    {/* 2. "Perforated" Divider Effect (Optional stylistic choice, simplified here for cleaner look) */}
                    {/* Kept simple border instead of complex perforations for cleaner glassmorphism */}
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent opacity-50"></div>

                    {/* 3. Details Body */}
                    <div className="px-8 pb-8 pt-6">
                        <div className="bg-gray-50/50 dark:bg-black/20 rounded-2xl p-6 shadow-inner border border-gray-100/50 dark:border-white/5">
                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                <DetailRow label="Category" value={transaction.category} icon={Tag} />
                                <DetailRow label="Payment" value={transaction.payment_method} icon={CreditCard} />
                                <DetailRow label="Date" value={dateStr} icon={Calendar} />
                                <DetailRow label="Time" value={timeStr} icon={Clock} />
                                
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
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white font-bold text-xs uppercase tracking-wide hover:bg-gray-200 dark:hover:bg-white/20 transition-all active:scale-[0.98]"
                                >
                                    <Edit2 className="w-4 h-4" /> Edit
                                </button>
                                {onDuplicate && (
                                    <button 
                                        onClick={() => onDuplicate(transaction)}
                                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold text-xs uppercase tracking-wide hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-all active:scale-[0.98]"
                                    >
                                        <Copy className="w-4 h-4" /> Copy
                                    </button>
                                )}
                            </div>
                            <button 
                                onClick={() => onDelete(transaction.id)}
                                className="flex items-center justify-center p-3 rounded-xl bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/30 transition-all active:scale-[0.98]"
                                title="Delete"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
