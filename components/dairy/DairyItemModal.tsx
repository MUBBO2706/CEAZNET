import React, { useState } from 'react';
import { DairyItem } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { X, Save, Loader2, ChevronDown } from 'lucide-react';

interface DairyItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: DairyItem) => Promise<void> | void;
    initialItem?: DairyItem;
}

const DairyItemModal: React.FC<DairyItemModalProps> = ({ isOpen, onClose, onSave, initialItem }) => {
    const [name, setName] = useState(initialItem?.name || '');
    const [defaultPrice, setDefaultPrice] = useState(initialItem?.defaultPrice || '');
    const [unit, setUnit] = useState(initialItem?.unit || 'L');
    const [defaultQuantity, setDefaultQuantity] = useState(initialItem?.defaultQuantity?.toString() || '1');
    const [isSaving, setIsSaving] = useState(false);
    const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
    const [basePricePerUnit, setBasePricePerUnit] = useState<number>(() => {
        if (initialItem?.defaultPrice && initialItem?.defaultQuantity) {
            return initialItem.defaultPrice / initialItem.defaultQuantity;
        }
        return 0;
    });

    if (!isOpen) return null;

    const handlePriceChange = (val: string) => {
        setDefaultPrice(val);
        const newPrice = Number(val);
        const currentQty = Number(defaultQuantity) || 1;
        if (!isNaN(newPrice) && currentQty > 0) {
            setBasePricePerUnit(newPrice / currentQty);
        }
    };

    const handleQuantityChange = (val: string) => {
        setDefaultQuantity(val);
        const newQty = Number(val);
        if (!isNaN(newQty) && newQty > 0 && basePricePerUnit > 0) {
            const calculatedPrice = basePricePerUnit * newQty;
            setDefaultPrice(calculatedPrice % 1 === 0 ? calculatedPrice.toString() : calculatedPrice.toFixed(2));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const newItem: DairyItem = {
                id: initialItem?.id || uuidv4(),
                name,
                defaultPrice: Number(defaultPrice),
                unit,
                defaultQuantity: Number(defaultQuantity) || 1,
                color: 'blue' // Default color for now
            };
            await onSave(newItem);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#050505] rounded-2xl w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {initialItem ? 'Edit Item' : 'Add New Item'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Milk, Newspaper"
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Price (₹)</label>
                            <input
                                type="number"
                                value={defaultPrice}
                                onChange={(e) => handlePriceChange(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setUnitDropdownOpen(!unitDropdownOpen)}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all flex justify-between items-center"
                                >
                                    <span>
                                        {unit === 'L' ? 'Liter (L)' :
                                         unit === 'kg' ? 'Kilogram (kg)' :
                                         unit === 'pkt' ? 'Packet (pkt)' :
                                         unit === 'unit' ? 'Unit/Piece' : unit}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                </button>
                                
                                {unitDropdownOpen && (
                                    <>
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => setUnitDropdownOpen(false)}
                                        />
                                        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
                                            {[
                                                { id: 'L', label: 'Liter (L)' },
                                                { id: 'kg', label: 'Kilogram (kg)' },
                                                { id: 'pkt', label: 'Packet (pkt)' },
                                                { id: 'unit', label: 'Unit/Piece' }
                                            ].map(u => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setUnit(u.id);
                                                        setUnitDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                                                >
                                                    {u.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Daily Quantity</label>
                        <input
                            type="number"
                            value={defaultQuantity}
                            onChange={(e) => handleQuantityChange(e.target.value)}
                            placeholder="1"
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            min="0"
                            step="0.01"
                        />
                        {['L', 'kg'].includes(unit) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {[
                                    { label: 'Quarter (0.25)', temp: '0.25' },
                                    { label: 'Half (0.5)', temp: '0.5' },
                                    { label: '3/4 (0.75)', temp: '0.75' },
                                    { label: '1', temp: '1' },
                                    { label: '1.5', temp: '1.5' },
                                    { label: '2', temp: '2' },
                                ].map(preset => (
                                    <button
                                        key={preset.temp}
                                        type="button"
                                        onClick={() => handleQuantityChange(preset.temp)}
                                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                            defaultQuantity === preset.temp 
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">This will be pre-filled when adding daily entries.</p>
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
                            {isSaving ? 'Saving...' : 'Save Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DairyItemModal;
