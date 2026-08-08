import React, { useMemo, useState } from 'react';
import { DairyItem, DairyEntry, DairyPayment } from '../../types';
import { X, Edit2, Trash2, IndianRupee, Calendar, Clock, Tag, Package, FileText, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { allocatePayments, EntryPaymentStatus } from '../../utils/dairyUtils';
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
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        : allocated.paidAmount > 0 
            ? <AlertCircle className="w-4 h-4 text-amber-500" />
            : <AlertCircle className="w-4 h-4 text-red-500" />;

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
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>Entry Details</span>
                    </h2>
                    
                    <div className="flex items-center gap-1">
                        {/* Record/View Payment Button */}
                        <button
                            type="button"
                            onClick={onOpenPayment}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                            title={allocated.isFullyPaid ? "Payment Information" : "Record Payment"}
                            aria-label={allocated.isFullyPaid ? "Payment Information" : "Record Payment"}
                        >
                            <IndianRupee className="w-5 h-5" />
                        </button>

                        {/* Edit Button */}
                        <button
                            type="button"
                            onClick={onEdit}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                            title="Edit Entry"
                            aria-label="Edit Entry"
                        >
                            <Edit2 className="w-5 h-5" />
                        </button>

                        {/* Delete Button */}
                        <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                            title="Delete Entry"
                            aria-label="Delete Entry"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>

                        {/* Divider */}
                        <span className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></span>

                        {/* Close Button */}
                        <button 
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 rounded-lg transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-5 space-y-5 overflow-y-auto flex-1">
                    
                    {/* Header Summary Card */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-100 dark:border-gray-800/60 flex flex-col items-center text-center space-y-2">
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-full">
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {entry.quantity} {item.unit} {item.name}
                            </h3>
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                                Total Cost: ₹{entry.totalPrice}
                            </p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeColor}`}>
                            {statusIcon}
                            <span>{statusLabel}</span>
                        </div>
                    </div>

                    {/* Metadata Table / Rows */}
                    <div className="space-y-3.5 pt-1">
                        {/* Entry Type */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-gray-400" />
                                Entry Type
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Expense</span>
                        </div>

                        {/* Item */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                Item / Title
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</span>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Package className="w-4 h-4 text-gray-400 animate-pulse" />
                                Quantity
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {entry.quantity} {item.unit}
                            </span>
                        </div>

                        {/* Price per Unit */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <IndianRupee className="w-4 h-4 text-gray-400" />
                                Rate
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                ₹{entry.pricePerUnit} / {item.unit}
                            </span>
                        </div>

                        {/* Total Cost */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <IndianRupee className="w-4 h-4 text-gray-400" />
                                Total Cost
                            </span>
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                ₹{entry.totalPrice}
                            </span>
                        </div>

                        {/* Paid Amount */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                Paid Amount
                            </span>
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-500">
                                ₹{allocated.paidAmount}
                            </span>
                        </div>

                        {/* Remaining Amount */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                Remaining Balance
                            </span>
                            <span className={`text-sm font-bold ${remainingAmount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                ₹{remainingAmount}
                            </span>
                        </div>

                        {/* Date */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                Date
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white text-right">
                                {formattedDate}
                            </span>
                        </div>

                        {/* Time if available */}
                        {formattedTime && (
                            <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-gray-800/40">
                                <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    Time Recorded
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formattedTime}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Notes Section */}
                    <div className="space-y-1.5 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            Notes / Description
                        </span>
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-800/50 rounded-xl">
                            {entry.notes ? (
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {entry.notes}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                                    No notes added for this entry.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Payment History Section inside the entry details */}
                    {entryPayments.length > 0 && (
                        <div className="space-y-2.5 pt-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Linked Payments
                            </span>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800/60 border border-gray-100 dark:border-gray-800 rounded-xl p-3 bg-gray-50/25 dark:bg-gray-900/10">
                                {entryPayments.map(payment => (
                                    <div key={payment.id} className="py-2 flex justify-between items-center text-sm first:pt-0 last:pb-0">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 dark:text-white">₹{payment.amount}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(payment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            {payment.notes && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{payment.notes}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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
