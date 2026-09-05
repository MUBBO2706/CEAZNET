import React, { useMemo, useState } from 'react';
import { DairyItem, DairyEntry, DairyPayment } from '../../types';
import { Edit2, Trash2, IndianRupee, Calendar, Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { allocatePayments } from '../../utils/dairyUtils';
import ConfirmationModal from '../ConfirmationModal';

interface DairyEntryInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: DairyItem;
    entry: DairyEntry;
    payments: DairyPayment[];
    onEdit: () => void;
    onOpenPayment: () => void;
    onDelete: (id: string) => Promise<void> | void;
}

const DairyEntryInfoModal: React.FC<DairyEntryInfoModalProps> = ({
    isOpen,
    onClose,
    item,
    entry,
    payments,
    onEdit,
    onOpenPayment,
    onDelete,
}) => {
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Calculate allocation for this specific entry to show correct paid amount and remaining balance
    const allocated = useMemo(() => {
        const itemPayments = payments.filter(p => p.itemId === item.id);
        const allAllocated = allocatePayments([entry], itemPayments);
        return allAllocated[0] || { ...entry, paidAmount: entry.isPaid ? entry.totalPrice : 0, isFullyPaid: entry.isPaid };
    }, [entry, payments, item.id]);

    const entryPayments = useMemo(() => {
        return payments.filter(p => 
            (p as any).entryId === entry.id || 
            p.id === entry.paymentId ||
            (p.itemId === entry.itemId && p.date === entry.date)
        );
    }, [entry, payments]);

    if (!isOpen) return null;

    const remainingAmount = Number(Math.max(0, entry.totalPrice - allocated.paidAmount).toFixed(2));
    const statusLabel = allocated.isFullyPaid 
        ? 'Paid' 
        : allocated.paidAmount > 0 
            ? 'Partially Paid' 
            : 'Unpaid';

    const statusBadgeColor = allocated.isFullyPaid 
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' 
        : allocated.paidAmount > 0 
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' 
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';

    const statusIcon = allocated.isFullyPaid 
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        : allocated.paidAmount > 0 
            ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            : <AlertCircle className="w-3.5 h-3.5 text-red-500" />;

    // Format Date
    const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Format Time from createdAt if exists
    const formattedTime = entry.createdAt 
        ? new Date(entry.createdAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        })
        : null;

    const handleDeleteClick = () => {
        setIsDeleteConfirmOpen(true);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#050505] rounded-2xl w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                
                {/* Header Section */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                            {item.name}
                        </h2>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusBadgeColor}`}>
                            {statusIcon}
                            <span>{statusLabel}</span>
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {/* Record/View Payment Button */}
                        <button
                            type="button"
                            onClick={onOpenPayment}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                            title={allocated.isFullyPaid ? "Payment Information" : "Record Payment"}
                            aria-label={allocated.isFullyPaid ? "Payment Information" : "Record Payment"}
                        >
                            <IndianRupee className="w-4 h-4" />
                        </button>

                        {/* Edit Button */}
                        <button
                            type="button"
                            onClick={onEdit}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                            title="Edit Entry"
                            aria-label="Edit Entry"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                            title="Delete Entry"
                            aria-label="Delete Entry"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Content Section - Containerless layout */}
                <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
                    
                    {/* PAYMENT DETAILS Section */}
                    <div className="space-y-2 pb-3.5 border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1.5">
                            Payment Details
                        </span>
                        
                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                                {entry.quantity} {item.unit}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 dark:text-gray-400">Rate</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                                ₹{entry.pricePerUnit} / {item.unit}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-0.5 border-t border-gray-100/60 dark:border-gray-800/40 pt-1.5">
                            <span className="text-gray-500 dark:text-gray-400">Total Cost</span>
                            <span className="font-bold text-gray-900 dark:text-white">
                                ₹{entry.totalPrice}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 dark:text-gray-400">Paid Amount</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-500">
                                ₹{allocated.paidAmount}
                            </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 dark:text-gray-400">Remaining Balance</span>
                            <span className={`font-extrabold ${remainingAmount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                ₹{remainingAmount}
                            </span>
                        </div>
                    </div>

                    {/* DATE & TIME Section */}
                    <div className="space-y-2 pb-3.5 border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1.5">
                            Date & Time
                        </span>

                        <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                Date
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                {formattedDate}
                            </span>
                        </div>

                        {formattedTime && (
                            <div className="flex items-center justify-between text-xs py-0.5 border-t border-gray-100/60 dark:border-gray-800/40 pt-1.5">
                                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                                    Time
                                </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {formattedTime}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* NOTES Section - Only rendered if notes exist */}
                    {entry.notes && entry.notes.trim() !== '' && (
                        <div className="space-y-1.5 pb-3.5 border-b border-gray-100 dark:border-gray-800/60">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1 mb-1">
                                <FileText className="w-3 h-3 text-gray-400" />
                                Notes
                            </span>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed pl-1">
                                {entry.notes}
                            </p>
                        </div>
                    )}

                    {/* LINKED PAYMENTS Section - Only rendered if payments exist */}
                    {entryPayments.length > 0 && (
                        <div className="space-y-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 block mb-1.5">
                                Linked Payments
                            </span>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                                {entryPayments.map(payment => (
                                    <div key={payment.id} className="py-1.5 flex justify-between items-center text-xs first:pt-0 last:pb-0">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-gray-900 dark:text-white">₹{payment.amount}</span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                                    {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            {payment.notes && <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{payment.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/35 hover:bg-gray-100 dark:hover:bg-gray-800/60 border border-gray-200 dark:border-gray-800 rounded-xl transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>

                {/* Inner Delete Confirmation Modal */}
                <ConfirmationModal
                    isOpen={isDeleteConfirmOpen}
                    onClose={() => {
                        if (!isDeleting) {
                            setIsDeleteConfirmOpen(false);
                        }
                    }}
                    onConfirm={async () => {
                        setIsDeleting(true);
                        try {
                            await onDelete(entry.id);
                            setIsDeleteConfirmOpen(false);
                            onClose();
                        } catch (err) {
                            console.error(err);
                        } finally {
                            setIsDeleting(false);
                        }
                    }}
                    title="Delete Entry"
                    message="Are you sure you want to delete this entry? This action cannot be undone."
                    confirmButtonText="Delete"
                    confirmButtonVariant="danger"
                    isLoading={isDeleting}
                />
            </div>
        </div>
    );
};

export default DairyEntryInfoModal;
