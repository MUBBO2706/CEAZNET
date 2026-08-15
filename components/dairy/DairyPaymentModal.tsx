import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DairyItem, DairyPayment, DairyEntry } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { X, Save, Calendar, DollarSign, ChevronDown, Trash2, CheckSquare, Square, ListChecks, Loader2, Info, CheckCircle, IndianRupee, AlertTriangle } from 'lucide-react';
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
    entry?: DairyEntry; // Added for single entry flow
    onDeletePayment?: (id: string) => Promise<void> | void; // Added for single entry flow
}

const DairyPaymentModal: React.FC<DairyPaymentModalProps> = ({ 
    isOpen, 
    onClose, 
    item, 
    entries, 
    payments, 
    onSave, 
    initialPayment, 
    onDelete,
    entry,
    onDeletePayment
}) => {
    const getToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Calculate details for single entry mode - Match by itemId and date
    const entryPayments = useMemo(() => {
        if (!entry) return [];
        return (payments || []).filter(p => 
            (p as any).entryId === entry.id || 
            p.id === entry.paymentId ||
            (p.itemId === entry.itemId && p.date === entry.date)
        );
    }, [entry, payments]);

    const totalPaid = useMemo(() => {
        if (!entry) return 0;
        const total = entryPayments.reduce((sum, p) => sum + p.amount, 0);
        return Number(total.toFixed(2));
    }, [entry, entryPayments]);

    const outstanding = useMemo(() => {
        if (!entry) return 0;
        const diff = entry.totalPrice - totalPaid;
        return Number(Math.max(0, diff).toFixed(2));
    }, [entry, totalPaid]);

    // Fields states
    const [date, setDate] = useState(getToday());
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk payment state
    const [paymentMode, setPaymentMode] = useState<'manual' | 'bulk'>('manual');
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
    const [upToDate, setUpToDate] = useState<string>('');
    const [manualAmount, setManualAmount] = useState('');
    const [isCustomAmount, setIsCustomAmount] = useState(false);

    const savingRef = useRef(false);

    // Initialize/sync states
    useEffect(() => {
        if (isOpen) {
            if (entry) {
                setDate(entry.date);
                setAmount(outstanding > 0 ? outstanding.toString() : '');
                setNotes(`Payment for ${item.name} on ${entry.date}`);
            } else {
                setDate(initialPayment?.date || getToday());
                setAmount(initialPayment?.amount.toString() || '');
                setNotes(initialPayment?.notes || '');
                setManualAmount(initialPayment?.amount.toString() || '');
                setIsCustomAmount(false);
                setPaymentMode('manual');
            }
        }
    }, [isOpen, entry, outstanding, initialPayment, item.name]);

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

    // Initialize selected entries if editing a bulk payment (non-single-entry mode)
    useEffect(() => {
        if (!entry && initialPayment && entries) {
            const paidByThis = entries.filter(e => e.paymentId === initialPayment.id);
            if (paidByThis.length > 0) {
                setPaymentMode('bulk');
                setSelectedEntryIds(new Set(paidByThis.map(e => e.id)));
                setIsCustomAmount(true);
            }
        }
    }, [initialPayment, entries, entry]);

    useEffect(() => {
        if (entry) return; // skip for single entry mode
        if (paymentMode === 'bulk') {
            if (!isCustomAmount) {
                const selectedEntries = unpaidEntries.filter(e => selectedEntryIds.has(e.id));
                const total = selectedEntries.reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0);
                setAmount(total > 0 ? total.toString() : '');
            }
        } else {
            setAmount(manualAmount);
        }
    }, [selectedEntryIds, paymentMode, unpaidEntries, manualAmount, isCustomAmount, entry]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setAmount(val);
        if (!entry) {
            if (paymentMode === 'manual') {
                setManualAmount(val);
            } else {
                setIsCustomAmount(true);
            }
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
        if (savingRef.current) return;

        const paymentAmount = Number(amount);
        if (entry) {
            if (paymentAmount <= 0) return;
            if (Number(paymentAmount.toFixed(2)) > Number(outstanding.toFixed(2))) {
                return;
            }
        }

        savingRef.current = true;
        setIsSaving(true);
        try {
            if (entry) {
                // Single Entry Payment Save
                const paymentId = initialPayment?.id || uuidv4();
                const newPayment: DairyPayment = {
                    id: paymentId,
                    itemId: item.id,
                    date,
                    amount: paymentAmount,
                    notes,
                    createdAt: initialPayment?.createdAt || new Date().toISOString()
                };
                // Store the linked entry ID using custom property
                (newPayment as any).entryId = entry.id;

                const newTotalPaid = Number((totalPaid + paymentAmount).toFixed(2));
                const updatedEntry: DairyEntry = { ...entry };
                
                if (newTotalPaid >= entry.totalPrice - 0.01) {
                    updatedEntry.isPaid = true;
                    updatedEntry.paymentId = paymentId;
                } else {
                    updatedEntry.isPaid = false;
                    updatedEntry.paymentId = undefined;
                }

                await onSave(newPayment, [updatedEntry]);
            } else {
                // Bulk / Manual General Payment Save
                const paymentId = initialPayment?.id || uuidv4();
                const newPayment: DairyPayment = {
                    id: paymentId,
                    itemId: item.id,
                    date,
                    amount: paymentAmount,
                    notes,
                    createdAt: initialPayment?.createdAt || new Date().toISOString()
                };

                if (paymentMode === 'bulk') {
                    const selectedEntries = unpaidEntries
                        .filter(e => selectedEntryIds.has(e.id))
                        .map(e => {
                            const { paidAmount: _1, isFullyPaid: _2, ...rest } = e;
                            return { ...rest, isPaid: true, paymentId };
                        });
                    
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
            }
        } finally {
            savingRef.current = false;
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

    const handleDeleteSinglePayment = async (id: string) => {
        if (onDeletePayment) {
            setIsDeleting(true);
            try {
                await onDeletePayment(id);
                setConfirmDeletePaymentId(null);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const showBulkOption = !entry && unpaidEntries.length > 0;

    // Single Entry Flow Render Calculations
    const isSingleEntryMode = Boolean(entry);
    const isFullyPaid = isSingleEntryMode && outstanding <= 0;
    const isOverpaid = isSingleEntryMode && Number(Number(amount).toFixed(2)) > Number(outstanding.toFixed(2));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#050505] rounded-2xl w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                
                {/* Header Section */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        {isSingleEntryMode ? (
                            isFullyPaid ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    <span>Payment Information</span>
                                </>
                            ) : (
                                <>
                                    <IndianRupee className="w-5 h-5 text-green-500" />
                                    <span>{totalPaid > 0 ? 'Record Additional Payment' : 'Record Payment'}</span>
                                </>
                            )
                        ) : (
                            <>
                                <DollarSign className="w-5 h-5 text-green-500" />
                                <span>{initialPayment ? 'Edit Payment' : 'Record Payment'}</span>
                            </>
                        )}
                    </h2>
                    
                    {!isSingleEntryMode && initialPayment && onDelete && !isConfirmingDelete && (
                        <button 
                            type="button"
                            onClick={() => setIsConfirmingDelete(true)} 
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                            title="Delete Payment"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}

                    <button 
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Delete general payment confirmation */}
                {!isSingleEntryMode && isConfirmingDelete ? (
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
                        <div className="p-5 space-y-5 overflow-y-auto">
                            
                            {/* Single Entry Details Panel - flat & containerless layout */}
                            {isSingleEntryMode && entry && (
                                <div className="space-y-2.5 pb-4 border-b border-gray-100 dark:border-gray-800/60">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Entry Date</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{new Date(entry.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Total Amount</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">₹{entry.totalPrice}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Total Paid</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-500">₹{totalPaid}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pt-2.5 border-t border-dashed border-gray-200 dark:border-gray-800">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Outstanding Balance</span>
                                        <span className={`font-bold text-base ${outstanding > 0 ? 'text-red-500' : 'text-emerald-500'}`}>₹{outstanding}</span>
                                    </div>
                                </div>
                            )}

                            {/* Bulk option switch */}
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

                            {/* Payment list inside Record Payment or Payment Info screen - flat & containerless list */}
                            {isSingleEntryMode && entryPayments.length > 0 && (
                                <div className="space-y-3 pt-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Payment History</h3>
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                                        {entryPayments.map(payment => (
                                            <div key={payment.id} className="py-2.5 flex justify-between items-center text-sm first:pt-0">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-900 dark:text-white">₹{payment.amount}</span>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(payment.date).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                                                    </div>
                                                    {payment.notes && <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[240px] leading-relaxed">{payment.notes}</p>}
                                                </div>
                                                
                                                {onDeletePayment && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => onDeletePayment(payment.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors animate-in fade-in duration-150"
                                                        title="Delete Payment"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Input Form Fields: Hidden completely if already fully paid in Single Entry Mode */}
                            {!isFullyPaid && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Date input */}
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

                                        {/* Amount input */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₹</span>
                                                <input
                                                    type="number"
                                                    value={amount}
                                                    onChange={handleAmountChange}
                                                    placeholder="0.00"
                                                    className={`w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border ${isOverpaid ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 dark:border-gray-700 focus:ring-blue-500'} rounded-lg focus:ring-2 outline-none transition-all`}
                                                    required
                                                    min="0.01"
                                                    step="0.01"
                                                />
                                            </div>
                                            {isOverpaid && (
                                                <p className="text-xs text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Cannot exceed ₹{outstanding}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bulk Entries selector inside general bulk payment mode */}
                                    {paymentMode === 'bulk' && !entry && (
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

                                                {unpaidEntries.map(unpaid => (
                                                    <div 
                                                        key={unpaid.id}
                                                        onClick={() => handleToggleEntry(unpaid.id)}
                                                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                                            selectedEntryIds.has(unpaid.id) 
                                                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30' 
                                                                : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {selectedEntryIds.has(unpaid.id) ? (
                                                                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                            ) : (
                                                                <Square className="w-4 h-4 text-gray-400" />
                                                            )}
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {new Date(unpaid.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                                                                    {unpaid.quantity} {item.unit} @ ₹{unpaid.pricePerUnit}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-sm font-bold text-gray-900 dark:text-white text-right">
                                                            ₹{unpaid.totalPrice - unpaid.paidAmount}
                                                            {unpaid.paidAmount > 0 && (
                                                                <div className="text-[10px] text-gray-500 font-normal">
                                                                    (Total: ₹{unpaid.totalPrice})
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {paymentMode === 'bulk' && !entry && isCustomAmount && Number(amount) !== unpaidEntries.filter(e => selectedEntryIds.has(e.id)).reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0) && (
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

                                    {/* Notes input */}
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
                                </>
                            )}
                        </div>

                        {/* Footer buttons */}
                        {!isFullyPaid && (
                            <div className="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl flex justify-end">
                                <button
                                    type="submit"
                                    disabled={isSaving || isOverpaid || Number(amount) <= 0 || (paymentMode === 'bulk' && !entry && selectedEntryIds.size === 0)}
                                    className="px-5 py-2 w-full sm:w-auto justify-center bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 text-sm font-semibold"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isSaving ? 'Saving...' : (isSingleEntryMode ? 'Save Payment' : (paymentMode === 'bulk' ? 'Mark Paid & Save' : 'Save Payment'))}
                                </button>
                            </div>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};

export default DairyPaymentModal;
