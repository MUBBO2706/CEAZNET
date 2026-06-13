import React, { useState, useMemo, useEffect } from 'react';
import { DairyItem, DairyPayment, DairyEntry } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { X, Save, Calendar, DollarSign, ChevronDown, Trash2, CheckSquare, Square, ListChecks, Loader2 } from 'lucide-react';
import { allocatePayments } from '../../utils/dairyUtils';

interface DairyPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: DairyItem;
    entries?: DairyEntry[];
    payments?: DairyPayment[];
    onSave: (payment: DairyPayment, updatedEntries?: DairyEntry[]) => Promise<void> | void;
    initialPayment?: DairyPayment;
    onDelete?: (id: string) => Promise<void> | void;
}

const DairyPaymentModal: React.FC<DairyPaymentModalProps> = ({ isOpen, onClose, item, entries, payments, onSave, initialPayment, onDelete }) => {
    const getToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(initialPayment?.date || getToday());
    const [amount, setAmount] = useState(initialPayment?.amount.toString() || '');
    const [notes, setNotes] = useState(initialPayment?.notes || '');
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk payment state
    const [paymentMode, setPaymentMode] = useState<'manual' | 'bulk'>('manual');
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
    const [upToDate, setUpToDate] = useState<string>('');
    const [manualAmount, setManualAmount] = useState(initialPayment?.amount.toString() || '');
    const [isCustomAmount, setIsCustomAmount] = useState(false);

    const otherPayments = useMemo(() => {
        return (payments || []).filter(p => p.id !== initialPayment?.id);
    }, [payments, initialPayment]);

    const modifiedEntries = useMemo(() => {
        if (!initialPayment) return entries || [];
        return (entries || []).map(e => {
            if (e.paymentId === initialPayment.id) {
                return { ...e, isPaid: false, paymentId: undefined };
            }
            return e;
        });
    }, [entries, initialPayment]);

    const allocatedEntries = useMemo(() => {
        return allocatePayments(modifiedEntries, otherPayments);
    }, [modifiedEntries, otherPayments]);

    const unpaidEntries = useMemo(() => {
        return allocatedEntries
            .filter(e => !e.isFullyPaid)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [allocatedEntries]);

    // Initialize selected entries if editing a bulk payment
    useEffect(() => {
        if (initialPayment && entries) {
            const paidByThis = entries.filter(e => e.paymentId === initialPayment.id);
            if (paidByThis.length > 0) {
                setPaymentMode('bulk');
                setSelectedEntryIds(new Set(paidByThis.map(e => e.id)));
                setIsCustomAmount(true);
            }
        }
    }, [initialPayment, entries]);

    useEffect(() => {
        if (paymentMode === 'bulk') {
            if (!isCustomAmount) {
                const selectedEntries = unpaidEntries.filter(e => selectedEntryIds.has(e.id));
                const total = selectedEntries.reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0);
                setAmount(total > 0 ? total.toString() : '');
            }
        } else {
            setAmount(manualAmount);
        }
    }, [selectedEntryIds, paymentMode, unpaidEntries, manualAmount, isCustomAmount]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setAmount(val);
        if (paymentMode === 'manual') {
            setManualAmount(val);
        } else {
            setIsCustomAmount(true);
        }
    };

    const handlePaymentModeChange = (mode: 'manual' | 'bulk') => {
        setPaymentMode(mode);
        if (mode === 'bulk') {
            setIsCustomAmount(false);
        }
    };

    if (!isOpen) return null;

    const handleToggleEntry = (id: string) => {
        setIsCustomAmount(false);
        const newSelected = new Set(selectedEntryIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedEntryIds(newSelected);
    };

    const handleSelectUpToDate = (dateStr: string) => {
        setIsCustomAmount(false);
        setUpToDate(dateStr);
        if (!dateStr) return;
        const newSelected = new Set<string>();
        unpaidEntries.forEach(entry => {
            if (new Date(entry.date) <= new Date(dateStr)) {
                newSelected.add(entry.id);
            }
        });
        setSelectedEntryIds(newSelected);
    };

    const handleSelectAll = () => {
        setIsCustomAmount(false);
        if (selectedEntryIds.size === unpaidEntries.length) {
            setSelectedEntryIds(new Set());
        } else {
            setSelectedEntryIds(new Set(unpaidEntries.map(e => e.id)));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const paymentId = initialPayment?.id || uuidv4();
            const newPayment: DairyPayment = {
                id: paymentId,
                itemId: item.id,
                date,
                amount: Number(amount),
                notes,
                createdAt: initialPayment?.createdAt || new Date().toISOString()
            };

            if (paymentMode === 'bulk') {
                // Find entries that were selected
                const selectedEntries = unpaidEntries
                    .filter(e => selectedEntryIds.has(e.id))
                    .map(e => {
                        const { paidAmount: _1, isFullyPaid: _2, ...rest } = e;
                        return { ...rest, isPaid: true, paymentId };
                    });
                
                // Find entries that were previously paid by this payment but are now deselected
                const deselectedEntries = unpaidEntries
                    .filter(e => {
                        const orig = (entries || []).find(orig => orig.id === e.id);
                        return orig?.paymentId === paymentId && !selectedEntryIds.has(e.id);
                    })
                    .map(e => {
                        const { paymentId: _, paidAmount: _1, isFullyPaid: _2, ...rest } = e;
                        return { ...rest, isPaid: false };
                    });

                await onSave(newPayment, [...selectedEntries, ...deselectedEntries]);
            } else {
                // If switched to manual, unmark any previously linked entries
                const deselectedEntries = unpaidEntries
                    .filter(e => {
                        const orig = (entries || []).find(orig => orig.id === e.id);
                        return orig?.paymentId === paymentId;
                    })
                    .map(e => {
                        const { paymentId: _, paidAmount: _1, isFullyPaid: _2, ...rest } = e;
                        return { ...rest, isPaid: false };
                    });
                await onSave(newPayment, deselectedEntries.length > 0 ? deselectedEntries : undefined);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (initialPayment && onDelete) {
            setIsDeleting(true);
            try {
                await onDelete(initialPayment.id);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const showBulkOption = unpaidEntries.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#050505] rounded-2xl w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        {initialPayment ? 'Edit Payment' : `Record Payment`}
                    </h2>
                    <div className="flex items-center gap-2">
                        {initialPayment && onDelete && !isConfirmingDelete && (
                            <button 
                                type="button"
                                onClick={() => setIsConfirmingDelete(true)} 
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                title="Delete Payment"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>
                
                {isConfirmingDelete ? (
                    <div className="p-6 text-center">
                        <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete this payment?</h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex gap-3 justify-center">
                            <button 
                                onClick={() => setIsConfirmingDelete(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 text-white bg-red-500 hover:bg-red-600 disabled:bg-red-400 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-4 space-y-4 overflow-y-auto">
                            {showBulkOption && (
                                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => handlePaymentModeChange('manual')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${paymentMode === 'manual' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                    >
                                        Manual Amount
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePaymentModeChange('bulk')}
                                        className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${paymentMode === 'bulk' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                                    >
                                        <ListChecks className="w-4 h-4" />
                                        Select Entries
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0"
                                        required
                                    />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                </div>
                            </div>

                            {paymentMode === 'bulk' && (
                                <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50/50 dark:bg-gray-900/20">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Select all up to date:</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="date"
                                                value={upToDate}
                                                onChange={(e) => handleSelectUpToDate(e.target.value)}
                                                className="w-full pl-10 pr-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                        <div 
                                            onClick={handleSelectAll}
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer mb-1 border-b border-gray-100 dark:border-gray-800"
                                        >
                                            <div className="flex items-center gap-2">
                                                {selectedEntryIds.size === unpaidEntries.length ? (
                                                    <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-gray-400" />
                                                )}
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">Select All</span>
                                            </div>
                                            <span className="text-xs text-gray-500">{unpaidEntries.length} entries</span>
                                        </div>

                                        {unpaidEntries.map(entry => (
                                            <div 
                                                key={entry.id}
                                                onClick={() => handleToggleEntry(entry.id)}
                                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                                    selectedEntryIds.has(entry.id) 
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30' 
                                                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {selectedEntryIds.has(entry.id) ? (
                                                        <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-gray-400" />
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                                            {entry.quantity} {item.unit} @ ₹{entry.pricePerUnit}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-bold text-gray-900 dark:text-white text-right">
                                                    ₹{entry.totalPrice - entry.paidAmount}
                                                    {entry.paidAmount > 0 && (
                                                        <div className="text-[10px] text-gray-500 font-normal">
                                                            (Total: ₹{entry.totalPrice})
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={handleAmountChange}
                                        placeholder="0.00"
                                        className={`w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all`}
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                {paymentMode === 'bulk' && isCustomAmount && Number(amount) !== unpaidEntries.filter(e => selectedEntryIds.has(e.id)).reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0) && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1.5 flex justify-between items-center px-1">
                                        <span>Calculated Total: ₹{unpaidEntries.filter(e => selectedEntryIds.has(e.id)).reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0)}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setIsCustomAmount(false);
                                                const total = unpaidEntries.filter(e => selectedEntryIds.has(e.id)).reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0);
                                                setAmount(total > 0 ? total.toString() : '');
                                            }}
                                            className="hover:underline font-medium"
                                        >
                                            Reset to Total
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder={paymentMode === 'bulk' && selectedEntryIds.size > 0 ? `Payment for ${selectedEntryIds.size} entries` : "e.g. Paid via UPI"}
                                    rows={2}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving || (paymentMode === 'bulk' && selectedEntryIds.size === 0)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {isSaving ? 'Saving...' : (paymentMode === 'bulk' ? 'Mark Paid & Save' : 'Save Payment')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default DairyPaymentModal;
