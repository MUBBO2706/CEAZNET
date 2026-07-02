import React, { useState, useEffect } from 'react';
import { DairyItem, DairyEntry } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { X, Save, Calendar, Droplet, DollarSign, Trash2, ChevronDown, Loader2 } from 'lucide-react';

interface DairyEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: DairyItem;
    onSave: (entry: DairyEntry) => Promise<void> | void;
    onDelete?: (id: string) => Promise<void> | void;
    initialEntry?: DairyEntry;
    initialDate?: string;
}

const DairyEntryModal: React.FC<DairyEntryModalProps> = ({ isOpen, onClose, item, onSave, onDelete, initialEntry, initialDate }) => {
    const getToday = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const [date, setDate] = useState(initialEntry?.date || initialDate || getToday());
    const [quantity, setQuantity] = useState(initialEntry?.quantity || item.defaultQuantity || 1);
    
    // If we have an initial entry, use its pricePerUnit.
    // Otherwise, calculate the price per unit from the item's default price and default quantity.
    // e.g. if defaultPrice is 25 and defaultQuantity is 0.5, price per unit is 50.
    const initialPricePerUnit = initialEntry?.pricePerUnit || 
        (item.defaultQuantity && item.defaultQuantity > 0 ? (item.defaultPrice / item.defaultQuantity) : item.defaultPrice);
        
    const [pricePerUnit, setPricePerUnit] = useState(initialPricePerUnit);
    const [notes, setNotes] = useState(initialEntry?.notes || '');
    const [isPaid, setIsPaid] = useState(initialEntry?.isPaid || false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const totalPrice = Number(quantity) * Number(pricePerUnit);
            const newEntry: DairyEntry = {
                id: initialEntry?.id || uuidv4(),
                itemId: item.id,
                date,
                quantity: Number(quantity),
                pricePerUnit: Number(pricePerUnit),
                totalPrice,
                isPaid,
                paymentId: isPaid ? initialEntry?.paymentId : undefined,
                notes,
                createdAt: initialEntry?.createdAt || new Date().toISOString()
            };
            await onSave(newEntry);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (initialEntry && onDelete) {
            setIsDeleting(true);
            try {
                await onDelete(initialEntry.id);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#050505] rounded-2xl w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Droplet className="w-5 h-5 text-blue-500" />
                        {initialEntry ? 'Edit Entry' : `Add ${item.name} Entry`}
                    </h2>
                    <div className="flex items-center gap-2">
                        {initialEntry && onDelete && !isConfirmingDelete && (
                            <button 
                                type="button"
                                onClick={() => setIsConfirmingDelete(true)} 
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                title="Delete Entry"
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete this entry?</h3>
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
                    <form onSubmit={handleSubmit} className="p-4 space-y-4">
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

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity ({item.unit})</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                                min="0"
                                step="0.01"
                            />
                            {['L', 'kg'].includes(item.unit) && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {[
                                        { label: 'Quarter', temp: 0.25 },
                                        { label: 'Half', temp: 0.5 },
                                        { label: '3/4', temp: 0.75 },
                                        { label: '1', temp: 1 },
                                        { label: '1.5', temp: 1.5 },
                                        { label: '2', temp: 2 },
                                    ].map(preset => (
                                        <button
                                            key={preset.temp}
                                            type="button"
                                            onClick={() => setQuantity(preset.temp)}
                                            className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                                quantity === preset.temp 
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent'
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price/Unit (₹)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                                <input
                                    type="number"
                                    value={pricePerUnit}
                                    onChange={(e) => setPricePerUnit(Number(e.target.value))}
                                    className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    required
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex justify-between items-center">
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Cost</span>
                        <span className="text-lg font-bold text-blue-900 dark:text-blue-100">
                            ₹{(Number(quantity) * Number(pricePerUnit)).toFixed(2)}
                        </span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Extra milk for guests"
                            rows={2}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isPaid"
                            checked={isPaid}
                            onChange={(e) => setIsPaid(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="isPaid" className="text-sm text-gray-700 dark:text-gray-300">
                            Mark as Paid immediately
                        </label>
                    </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {isSaving ? 'Saving...' : 'Save Entry'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default DairyEntryModal;
