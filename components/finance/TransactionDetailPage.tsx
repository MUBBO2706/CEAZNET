
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Transaction } from '../../types';
import { 
    ArrowLeft, Edit2, Trash2, Copy, Calendar, Clock, 
    CreditCard, ArrowUpRight, ArrowDownLeft, 
    ArrowRightLeft, Receipt, CheckCircle2, Wallet, ExternalLink,
    Car, Gauge, Droplets, Route, Fuel, Info, X
} from 'lucide-react';
import DescriptionModal from './DescriptionModal';

interface TransactionDetailPageProps {
    transaction: Transaction;
    onBack: () => void;
    onEdit: (t: Transaction) => void;
    onDelete?: (id: string) => void;
    onDuplicate: (t: Transaction) => void;
}

const TransactionDetailPage: React.FC<TransactionDetailPageProps> = ({ 
    transaction, 
    onBack, 
    onEdit, 
    onDelete, 
    onDuplicate 
}) => {
    const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
    
    const theme = useMemo(() => {
        if (transaction.type === 'income') return {
            text: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-100 dark:bg-emerald-900/30',
            border: 'border-emerald-100 dark:border-emerald-900/30',
            iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
            glow: 'from-emerald-500/20 to-teal-500/20',
            icon: ArrowDownLeft,
            label: 'Income'
        };
        if (transaction.type === 'expense') return {
            text: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-900/10',
            border: 'border-rose-100 dark:border-rose-900/30',
            iconBg: 'bg-rose-100 dark:bg-rose-900/30',
            glow: 'from-rose-500/20 to-orange-500/20',
            icon: ArrowUpRight,
            label: 'Expense'
        };
        return {
            text: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-50 dark:bg-indigo-900/10',
            border: 'border-indigo-100 dark:border-indigo-900/30',
            iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
            glow: 'from-indigo-500/20 to-purple-500/20',
            icon: ArrowRightLeft,
            label: 'Transfer'
        };
    }, [transaction.type]);

    const dateObj = new Date(transaction.transaction_date);
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const weekdayStr = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });

    // Calculate time ago
    const timeAgo = useMemo(() => {
        const diff = (new Date().getTime() - dateObj.getTime()) / 1000;
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return `${Math.floor(diff / 86400)} days ago`;
    }, [dateObj]);

    const TypeIcon = theme.icon;
    const metadata = transaction.metadata;
    const isFuelRecord = metadata && metadata.vehicle_id;

    return (
        <div className="fixed inset-0 z-50 bg-[#F9F6F2] dark:bg-black flex flex-col h-full animate-slide-up-fade overflow-y-auto scrollbar-hide">
            
            {/* Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-4 bg-[#F9F6F2]/80 dark:bg-black/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onBack}
                        className="p-2.5 rounded-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                    </button>
                    <button 
                        onClick={() => onDuplicate(transaction)}
                        className="p-2.5 rounded-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-sm hover:text-indigo-600 transition-colors"
                        title="Duplicate"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => onEdit(transaction)}
                        className="p-2.5 rounded-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-sm hover:text-amber-500 transition-colors"
                        title="Edit"
                    >
                        <Edit2 className="w-5 h-5" />
                    </button>
                    {onDelete && (
                        <button 
                            onClick={() => onDelete(transaction.id)}
                            className="p-2.5 rounded-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 shadow-sm hover:text-red-500 transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 px-4 pb-12 pt-2 max-w-4xl mx-auto w-full">
                
                {/* Hero Section */}
                <div className="relative flex flex-col items-center text-center py-10 overflow-hidden">
                    {/* Background Glow */}
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-tr ${theme.glow} rounded-full blur-3xl opacity-60 pointer-events-none`}></div>

                    <div className={`relative w-20 h-20 rounded-[2rem] ${theme.bg} ${theme.text} flex items-center justify-center mb-6 shadow-sm z-10`}>
                        <TypeIcon className="w-10 h-10" strokeWidth={2} />
                    </div>
                    
                    <h1 className={`relative text-6xl font-extrabold tracking-tight mb-2 ${theme.text} z-10`}>
                        ₹{Number(transaction.amount).toLocaleString('en-IN')}
                    </h1>
                    
                    <div className="relative z-10 flex items-center gap-2 px-4 py-1.5 bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-full border border-gray-200/50 dark:border-white/5 mb-6">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Completed</span>
                    </div>

                    {/* Truncated Description with Click Handler */}
                    <div 
                        onClick={() => setIsDescriptionModalOpen(true)}
                        className="relative z-10 max-w-md cursor-pointer group"
                    >
                        <p className="text-xl font-semibold text-gray-800 dark:text-gray-100 leading-snug line-clamp-2 group-hover:opacity-80 transition-opacity">
                            {transaction.description}
                        </p>
                        {transaction.description.length > 50 && (
                            <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mt-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                                Read more
                            </span>
                        )}
                    </div>

                    <p className="relative z-10 text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        {transaction.category}
                    </p>
                </div>

                {/* --- MAIN DETAILS CARD --- */}
                <div className={`${theme.bg} p-5 rounded-2xl border ${theme.border} mb-6 shadow-sm relative overflow-hidden`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${theme.glow} to-transparent rounded-bl-full pointer-events-none opacity-50`}></div>
                    
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <div className={`p-2 ${theme.iconBg} rounded-full ${theme.text}`}>
                            <Info className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">Transaction Info</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 relative z-10">
                        <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-white/50 dark:border-white/10 shadow-sm">
                            <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                                <Calendar className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Date</span>
                            </div>
                            <p className="text-base font-bold text-gray-900 dark:text-white truncate">{dateStr}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{weekdayStr}</p>
                        </div>
                        
                        <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-white/50 dark:border-white/10 shadow-sm">
                            <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                                <Clock className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Time</span>
                            </div>
                            <p className="text-base font-bold text-gray-900 dark:text-white truncate">{timeStr}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{timeAgo}</p>
                        </div>

                        <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-white/50 dark:border-white/10 shadow-sm">
                            <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                                <Wallet className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Wallet</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {transaction.profile_id ? "Custom Wallet" : "Main Wallet"}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-white/50 dark:border-white/10 shadow-sm">
                            <div className="flex items-center gap-2 mb-1 text-gray-500 dark:text-gray-400">
                                <CreditCard className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Method</span>
                            </div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {transaction.payment_method}
                            </p>
                        </div>
                    </div>
                </div>
                
                {/* --- FUEL STATS CARD --- */}
                {isFuelRecord && metadata && (
                    <div className="bg-red-50/80 dark:bg-red-900/10 p-5 rounded-2xl border border-red-100 dark:border-red-900/20 mb-6 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full pointer-events-none"></div>
                        
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                            <div className="p-2 bg-red-100 dark:bg-red-800/30 rounded-full text-red-600 dark:text-red-400">
                                <Fuel className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-base">Vehicle Stats</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="col-span-2 bg-white dark:bg-black/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 flex items-center gap-3">
                                <Car className="w-8 h-8 text-red-500" />
                                <div>
                                    <p className="text-xs text-red-600/70 dark:text-red-300 font-bold uppercase tracking-wider">Vehicle</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">{metadata.vehicle_name || 'Unknown'}</p>
                                </div>
                            </div>
                            
                            <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                                <div className="flex items-center gap-2 mb-1 text-red-500">
                                    <Gauge className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Mileage</span>
                                </div>
                                <p className="text-xl font-extrabold text-gray-900 dark:text-white">
                                    {metadata.mileage ? `${metadata.mileage} km/L` : 'N/A'}
                                </p>
                            </div>

                            <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                                <div className="flex items-center gap-2 mb-1 text-red-500">
                                    <Route className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Driven</span>
                                </div>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {metadata.distance_driven ? `+${metadata.distance_driven} km` : 'First Log'}
                                </p>
                            </div>

                            <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Odometer</p>
                                <p className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">
                                    {metadata.odometer_reading?.toLocaleString()} km
                                </p>
                            </div>

                            <div className="bg-white dark:bg-black/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
                                <div className="flex items-center gap-1.5 mb-1 text-gray-500 dark:text-gray-400">
                                    <Droplets className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Volume</span>
                                </div>
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    {metadata.fuel_liters} Liters
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Receipt Footer */}
                <div className="border-t-2 border-dashed border-gray-200 dark:border-gray-800 pt-6 px-2">
                    <div className="flex items-center gap-2 mb-4 text-gray-400 dark:text-gray-600">
                        <Receipt className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Transaction Receipt</span>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Reference ID</span>
                            <span className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded select-all">
                                {transaction.id}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Created At</span>
                            <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                                {new Date(transaction.created_at || transaction.transaction_date).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Modals */}
            <DescriptionModal 
                isOpen={isDescriptionModalOpen} 
                onClose={() => setIsDescriptionModalOpen(false)} 
                description={transaction.description} 
            />
        </div>
    );
};

export default TransactionDetailPage;
