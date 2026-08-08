import React, { useState, useEffect } from 'react';
import { DairyItem, DairyEntry } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { X, Save, Calendar, Droplet, DollarSign, Trash2, ChevronDown, Loader2, IndianRupee, Eye } from 'lucide-react';
import { useGlobalModal } from '../core/GlobalModalProvider';
import ConfirmationModal from '../ConfirmationModal';

interface DairyEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: DairyItem;
    onSave: (entry: DairyEntry) => Promise<void> | void;
    onDelete?: (id: string) => Promise<void> | void;
    onOpenPayment?: () => void;
    onShowInfo?: () => void;
    initialEntry?: DairyEntry;
    initialDate?: string;
}

const DairyEntryModal: React.FC<DairyEntryModalProps> = ({ isOpen, onClose, item, onSave, onDelete, onOpenPayment, onShowInfo, initialEntry, initialDate }) => {
    const { confirm } = useGlobalModal();
    
    const getToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(getToday());
    const [quantity, setQuantity] = useState<number | string>('1');
    const [pricePerUnit, setPricePerUnit] = useState<number | string>(item.defaultPrice);
    const [totalCost, setTotalCost] = useState<number | string>(item.defaultPrice);
    const [notes, setNotes] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const [snapshot, setSnapshot] = useState<{
        date: string;
        quantity: string;
        pricePerUnit: string;
        totalCost: string;
        notes: string;
        isPaid: boolean;
    } | null>(null);

    // Re-initialize state and snapshot when modal opens or initial values change
    useEffect(() => {
        if (isOpen) {
            const initDate = initialEntry?.date || initialDate || getToday();
            const calculatedPpu = item.defaultQuantity && item.defaultQuantity > 0 
                ? (item.defaultPrice / item.defaultQuantity) 
                : item.defaultPrice;
            const initPricePerUnit = initialEntry?.pricePerUnit !== undefined ? initialEntry.pricePerUnit : calculatedPpu;
            const initQty = initialEntry ? initialEntry.quantity : (item.defaultQuantity || 1);
            const initTotal = initialEntry 
                ? initialEntry.totalPrice 
                : Number(((item.defaultQuantity || 1) * initPricePerUnit).toFixed(2));
            const initNotes = initialEntry?.notes || '';
            const initIsPaid = initialEntry ? Boolean(initialEntry.isPaid) : Boolean(item.isPaidByDefault);

            setDate(initDate);
            setQuantity(initQty);
            setPricePerUnit(initPricePerUnit);
            setTotalCost(initTotal);
            setNotes(initNotes);
            setIsPaid(initIsPaid);
            setIsSaving(false);

            if (initialEntry) {
                setSnapshot({
                    date: initDate,
                    quantity: (Number(initQty) || 0).toFixed(4),
                    pricePerUnit: (Number(initPricePerUnit) || 0).toFixed(2),
                    totalCost: (Number(initTotal) || 0).toFixed(2),
                    notes: initNotes.trim(),
                    isPaid: initIsPaid
                });
            } else {
                setSnapshot(null);
            }
        }
    }, [isOpen, initialEntry, initialDate, item]);

    const handleQuantityChange = (valStr: string | number) => {
        if (valStr === '') {
            setQuantity('');
            setTotalCost('');
            return;
        }
        const val = Number(valStr);
        setQuantity(val);
        const rate = Number(pricePerUnit) || 0;
        setTotalCost(Number((val * rate).toFixed(2)));
    };

    const handlePricePerUnitChange = (valStr: string | number) => {
        if (valStr === '') {
            setPricePerUnit('');
            setTotalCost('');
            return;
        }
        const val = Number(valStr);
        setPricePerUnit(val);
        const qty = Number(quantity) || 0;
        setTotalCost(Number((qty * val).toFixed(2)));
    };

    const handleTotalCostChange = (valStr: string | number) => {
        if (valStr === '') {
            setTotalCost('');
            setQuantity('');
            return;
        }
        const val = Number(valStr);
        setTotalCost(val);
        const rate = Number(pricePerUnit) || 0;
        if (rate > 0) {
            const calculatedQty = val / rate;
            setQuantity(Number(calculatedQty.toFixed(4)));
        } else {
            const qty = Number(quantity) || 0;
            if (qty > 0) {
                setPricePerUnit(Number((val / qty).toFixed(2)));
            }
        }
    };

    if (!isOpen) return null;

    // Form validation
    const isDateValid = Boolean(date && date.trim());
    const isQtyValid = quantity !== '' && !isNaN(Number(quantity)) && Number(quantity) > 0;
    const isPriceValid = pricePerUnit !== '' && !isNaN(Number(pricePerUnit)) && Number(pricePerUnit) >= 0;
    const isTotalValid = totalCost !== '' && !isNaN(Number(totalCost)) && Number(totalCost) >= 0;
    const isFormValid = isDateValid && isQtyValid && isPriceValid && isTotalValid;

    // Check if any value changed compared to snapshot
    const isDirty = React.useMemo(() => {
        if (!initialEntry || !snapshot) return true;

        const normDate = date;
        const normQty = (Number(quantity) || 0).toFixed(4);
        const normPrice = (Number(pricePerUnit) || 0).toFixed(2);
        const normTotal = (Number(totalCost) || 0).toFixed(2);
        const normNotes = notes.trim();
        const normIsPaid = Boolean(isPaid);

        return (
            normDate !== snapshot.date ||
            normQty !== snapshot.quantity ||
            normPrice !== snapshot.pricePerUnit ||
            normTotal !== snapshot.totalCost ||
            normNotes !== snapshot.notes ||
            normIsPaid !== snapshot.isPaid
        );
    }, [initialEntry, snapshot, date, quantity, pricePerUnit, totalCost, notes, isPaid]);

    const canSubmit = isFormValid && (!initialEntry || isDirty) && !isSaving;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || isSaving) return;

        setIsSaving(true);
        try {
            const qtyNum = Number(quantity);
            const priceNum = Number(pricePerUnit);
            const totalPrice = Number((qtyNum * priceNum).toFixed(2));
            const newEntry: DairyEntry = {
                id: initialEntry?.id || uuidv4(),
                itemId: item.id,
                date,
                quantity: qtyNum,
                pricePerUnit: priceNum,
                totalPrice,
                isPaid,
                paymentId: isPaid ? initialEntry?.paymentId : undefined,
                notes: notes.trim(),
                createdAt: initialEntry?.createdAt || new Date().toISOString()
            };
            await onSave(newEntry);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = () => {
        if (!initialEntry || !onDelete) return;
        setIsDeleteConfirmOpen(true);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#050505] rounded-2xl w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Droplet className="w-5 h-5 text-blue-500" />
                        {initialEntry ? 'Edit Entry' : `Add ${item.name} Entry`}
                    </h2>
                    {initialEntry && (
                        <div className="flex items-center gap-1">
                            {onShowInfo && (
                                <button
                                    type="button"
                                    onClick={onShowInfo}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                    title="View Information"
                                    aria-label="View Information"
                                >
                                    <Eye className="w-5 h-5" />
                                </button>
                            )}
                            {onOpenPayment && (
                                <button
                                    type="button"
                                    onClick={onOpenPayment}
                                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-colors"
                                    title="Record Payment"
                                    aria-label="Record Payment"
                                >
                                    <IndianRupee className="w-5 h-5" />
                                </button>
                            )}
                            {onDelete && (
                                <button 
                                    type="button"
                                    onClick={handleDeleteClick} 
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                    title="Delete Entry"
                                    aria-label="Delete Entry"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Quantity and Price first as requested */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity ({item.unit})</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => handleQuantityChange(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                required
                                min="0"
                                step="any"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price/Unit (₹)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                <input
                                    type="number"
                                    value={pricePerUnit}
                                    onChange={(e) => handlePricePerUnitChange(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                    required
                                    min="0"
                                    step="any"
                                />
                            </div>
                        </div>
                    </div>

                    {['L', 'kg'].includes(item.unit) && (
                        <div className="grid grid-cols-6 gap-1.5 w-full">
                            {[
                                { label: '0.25', temp: 0.25 },
                                { label: '0.5', temp: 0.5 },
                                { label: '0.75', temp: 0.75 },
                                { label: '1', temp: 1 },
                                { label: '1.5', temp: 1.5 },
                                { label: '2', temp: 2 },
                            ].map(preset => (
                                <button
                                    key={preset.temp}
                                    type="button"
                                    onClick={() => handleQuantityChange(preset.temp)}
                                    className={`w-full py-1.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
                                        Number(quantity) === preset.temp 
                                            ? 'bg-blue-600 text-white shadow-sm font-bold' 
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Date and Total Cost below Quantity and Price/Unit */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full pl-9 pr-2 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0 text-xs sm:text-sm"
                                    required
                                />
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Total Cost (₹)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-bold text-sm">₹</span>
                                <input
                                    type="number"
                                    value={totalCost}
                                    onChange={(e) => handleTotalCostChange(e.target.value)}
                                    className="w-full pl-7 pr-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 font-bold rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                    required
                                    min="0"
                                    step="any"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Extra milk for guests"
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isPaid"
                            checked={isPaid}
                            onChange={(e) => setIsPaid(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="isPaid" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            Mark as Paid immediately
                        </label>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors flex items-center gap-2 font-medium text-sm"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {isSaving ? 'Saving...' : (initialEntry ? 'Edit Entry' : 'Add Entry')}
                        </button>
                    </div>
                </form>
                <ConfirmationModal
                    isOpen={isDeleteConfirmOpen}
                    onClose={() => {
                        if (!isDeleting) {
                            setIsDeleteConfirmOpen(false);
                        }
                    }}
                    onConfirm={async () => {
                        if (!initialEntry || !onDelete) return;
                        setIsDeleting(true);
                        try {
                            await onDelete(initialEntry.id);
                            setIsDeleteConfirmOpen(false);
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

export default DairyEntryModal;
