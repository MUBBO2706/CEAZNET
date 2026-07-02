import React, { useState } from 'react';
import { X, Download, ChevronDown, Calendar } from 'lucide-react';
import { DairyItem } from '../../types';

interface DairyExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: DairyItem[];
    preselectedItemId?: string | null;
    onExport: (options: { itemId?: string; startDate?: string; endDate?: string }) => void;
}

const DairyExportModal: React.FC<DairyExportModalProps> = ({ isOpen, onClose, items, preselectedItemId, onExport }) => {
    const [selectedItemId, setSelectedItemId] = useState<string>(preselectedItemId || 'all');
    const [dateRange, setDateRange] = useState<'all' | 'current_month' | 'last_month' | 'custom'>('all');
    
    // Default to today's date so it's not blank
    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState<string>(todayStr);
    const [endDate, setEndDate] = useState<string>(todayStr);

    if (!isOpen) return null;

    const handleExport = () => {
        let start: string | undefined;
        let end: string | undefined;

        const today = new Date();
        if (dateRange === 'current_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        } else if (dateRange === 'last_month') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
            end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
        } else if (dateRange === 'custom') {
            start = startDate || undefined;
            end = endDate || undefined;
        }

        onExport({
            itemId: selectedItemId === 'all' ? undefined : selectedItemId,
            startDate: start,
            endDate: end
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#050505] rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Export Data</h3>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Item</label>
                        <div className="relative">
                            <select 
                                value={selectedItemId} 
                                onChange={(e) => setSelectedItemId(e.target.value)}
                                className="w-full pl-3 pr-10 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                <option value="all">All Items</option>
                                {items.map(item => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                        <div className="relative">
                            <select 
                                value={dateRange} 
                                onChange={(e) => setDateRange(e.target.value as any)}
                                className="w-full pl-3 pr-10 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                <option value="all">All Time</option>
                                <option value="current_month">Current Month</option>
                                <option value="last_month">Last Month</option>
                                <option value="custom">Custom Range</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    {dateRange === 'custom' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={startDate} 
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                                <div className="relative">
                                    <input 
                                        type="date" 
                                        value={endDate} 
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DairyExportModal;
