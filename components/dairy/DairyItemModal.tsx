import React, { useState, useEffect } from 'react';
import { DairyItem } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { 
    X, Save, Loader2, ChevronDown, Sparkles,
    Milk, Newspaper, Droplet, Activity, CalendarDays,
    Package, Tv, Zap, Flame, Car, Bike, Heart, Coffee, 
    Apple, Utensils, Book, Scissors, Trash, Wrench, Shield
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getCustomCategories, saveCustomCategory } from '../../services/dbService';
import { CATEGORY_CONFIG } from '../finance/categories';

interface DairyItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: DairyItem) => Promise<void> | void;
    initialItem?: DairyItem;
    existingItems?: DairyItem[];
}

const AVAILABLE_ICONS = [
    { id: 'milk', label: 'Milk / Dairy', icon: Milk },
    { id: 'newspaper', label: 'Newspaper', icon: Newspaper },
    { id: 'droplet', label: 'Water', icon: Droplet },
    { id: 'activity', label: 'Internet / Gym', icon: Activity },
    { id: 'calendar', label: 'Rent / Billing', icon: CalendarDays },
    { id: 'package', label: 'Groceries / Ration', icon: Package },
    { id: 'tv', label: 'Cable TV / Netflix', icon: Tv },
    { id: 'zap', label: 'Electricity / Bijli', icon: Zap },
    { id: 'flame', label: 'Gas / Cylinder', icon: Flame },
    { id: 'car', label: 'Petrol / Car / Cab', icon: Car },
    { id: 'bike', label: 'Bike / Scooter', icon: Bike },
    { id: 'heart', label: 'Health / Medicine', icon: Heart },
    { id: 'coffee', label: 'Tea / Coffee / Chai', icon: Coffee },
    { id: 'apple', label: 'Fruits / Veggies', icon: Apple },
    { id: 'utensils', label: 'Cook / Food', icon: Utensils },
    { id: 'book', label: 'Tuition / Classes', icon: Book },
    { id: 'scissors', label: 'Saloon / Haircut', icon: Scissors },
    { id: 'trash', label: 'Garbage / Safai', icon: Trash },
    { id: 'wrench', label: 'Maintenance', icon: Wrench },
    { id: 'shield', label: 'Insurance / Guard', icon: Shield }
];

const DairyItemModal: React.FC<DairyItemModalProps> = ({ isOpen, onClose, onSave, initialItem, existingItems }) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [defaultPrice, setDefaultPrice] = useState('');
    const [unit, setUnit] = useState('L');
    const [defaultQuantity, setDefaultQuantity] = useState('1');
    const [selectedIcon, setSelectedIcon] = useState('package');
    const [isPaidByDefault, setIsPaidByDefault] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSuggestingIcon, setIsSuggestingIcon] = useState(false);
    const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
    const [customCategories, setCustomCategories] = useState<any[]>([]);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<{ 
        icon: string; 
        reason: string; 
        confidence?: number;
        createNewCategory?: boolean;
        suggestedCategoryName?: string;
        matchedCategory?: string;
    } | null>(null);

    const [snapshot, setSnapshot] = useState<{
        name: string;
        defaultPrice: string;
        unit: string;
        defaultQuantity: string;
        selectedIcon: string;
        isPaidByDefault: boolean;
    } | null>(null);

    const [basePricePerUnit, setBasePricePerUnit] = useState<number>(0);

    // Initialize or reset form and snapshot whenever modal opens or initialItem changes
    useEffect(() => {
        if (isOpen) {
            const initName = initialItem?.name || '';
            const initPrice = initialItem?.defaultPrice !== undefined ? initialItem.defaultPrice.toString() : '';
            const initUnit = initialItem?.unit || 'L';
            const initQty = initialItem?.defaultQuantity !== undefined ? initialItem.defaultQuantity.toString() : '1';
            const initIcon = initialItem?.icon || 'package';
            const initPaidByDefault = Boolean(initialItem?.isPaidByDefault);

            setName(initName);
            setDefaultPrice(initPrice);
            setUnit(initUnit);
            setDefaultQuantity(initQty);
            setSelectedIcon(initIcon);
            setIsPaidByDefault(initPaidByDefault);
            setIsSaving(false);

            if (initialItem?.defaultPrice && initialItem?.defaultQuantity) {
                setBasePricePerUnit(initialItem.defaultPrice / initialItem.defaultQuantity);
            } else {
                setBasePricePerUnit(0);
            }

            if (initialItem) {
                setSnapshot({
                    name: initName.trim(),
                    defaultPrice: (Number(initPrice) || 0).toString(),
                    unit: initUnit.trim(),
                    defaultQuantity: (Number(initQty) || 0).toString(),
                    selectedIcon: initIcon,
                    isPaidByDefault: initPaidByDefault
                });
            } else {
                setSnapshot(null);
            }

            getCustomCategories(user).then(cats => setCustomCategories(cats)).catch(console.error);
        }
    }, [isOpen, initialItem, user]);

    const suggestIconFromAi = async (itemName: string) => {
        if (!itemName.trim() || itemName.length < 2) return;
        setIsSuggestingIcon(true);
        try {
            const standardCats = [
                ...(CATEGORY_CONFIG.expense || []),
                ...(CATEGORY_CONFIG.income || []),
                ...(CATEGORY_CONFIG.transfer || [])
            ].map(c => ({ id: c.id, label: c.label }));

            const res = await fetch('/api/dairy/suggest-icon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: itemName,
                    existingItems: existingItems?.map(item => ({ name: item.name, icon: item.icon })) || [],
                    existingCategories: [
                        ...standardCats,
                        ...customCategories.map(c => ({ id: c.id, label: c.label || c.id }))
                    ]
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.icon) {
                    setAiSuggestion({
                        icon: data.icon,
                        reason: data.reason || `AI suggested this icon for '${itemName}'.`,
                        confidence: data.confidence,
                        createNewCategory: data.createNewCategory,
                        suggestedCategoryName: data.suggestedCategoryName,
                        matchedCategory: data.matchedCategory
                    });
                    setIsAiModalOpen(true);
                }
            }
        } catch (err) {
            console.error("Failed to suggest icon:", err);
        } finally {
            setIsSuggestingIcon(false);
        }
    };

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

    // Form field validity
    const isNameValid = name.trim().length > 0;
    const isPriceValid = defaultPrice !== '' && !isNaN(Number(defaultPrice)) && Number(defaultPrice) >= 0;
    const isQtyValid = defaultQuantity !== '' && !isNaN(Number(defaultQuantity)) && Number(defaultQuantity) > 0;
    const isFormValid = isNameValid && isPriceValid && isQtyValid;

    // Check if any value actually changed compared to the snapshot (normalized)
    const isDirty = React.useMemo(() => {
        if (!initialItem || !snapshot) return true;

        const normName = name.trim();
        const normPrice = (Number(defaultPrice) || 0).toString();
        const normUnit = unit.trim();
        const normQty = (Number(defaultQuantity) || 0).toString();
        const normIcon = selectedIcon;
        const normIsPaidByDefault = Boolean(isPaidByDefault);

        return (
            normName !== snapshot.name ||
            normPrice !== snapshot.defaultPrice ||
            normUnit !== snapshot.unit ||
            normQty !== snapshot.defaultQuantity ||
            normIcon !== snapshot.selectedIcon ||
            normIsPaidByDefault !== snapshot.isPaidByDefault
        );
    }, [initialItem, snapshot, name, defaultPrice, unit, defaultQuantity, selectedIcon, isPaidByDefault]);

    const canSubmit = isFormValid && (!initialItem || isDirty) && !isSaving;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || isSaving) return;

        setIsSaving(true);
        try {
            const newItem: DairyItem = {
                id: initialItem?.id || uuidv4(),
                name: name.trim(),
                defaultPrice: Number(defaultPrice),
                unit: unit.trim(),
                defaultQuantity: Number(defaultQuantity) || 1,
                icon: selectedIcon,
                isPaidByDefault,
                color: 'blue' // Default color
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
                </div>
                
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Item Name & Default Daily Quantity side-by-side */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Milk, Newspaper"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Daily Quantity</label>
                            <input
                                type="number"
                                value={defaultQuantity}
                                onChange={(e) => handleQuantityChange(e.target.value)}
                                placeholder="1"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* Quantity Selectors below both fields in a single full-width row */}
                    {['L', 'kg'].includes(unit) && (
                        <div>
                            <div className="grid grid-cols-6 gap-1.5 w-full">
                                {[
                                    { label: '0.25', temp: '0.25' },
                                    { label: '0.5', temp: '0.5' },
                                    { label: '0.75', temp: '0.75' },
                                    { label: '1', temp: '1' },
                                    { label: '1.5', temp: '1.5' },
                                    { label: '2', temp: '2' },
                                ].map(preset => (
                                    <button
                                        key={preset.temp}
                                        type="button"
                                        onClick={() => handleQuantityChange(preset.temp)}
                                        className={`w-full py-1.5 text-xs font-semibold rounded-lg transition-all text-center truncate ${
                                            defaultQuantity === preset.temp 
                                                ? 'bg-blue-600 text-white shadow-sm font-bold' 
                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-1.5">Pre-filled when adding daily entries.</p>
                        </div>
                    )}

                    {/* Default Price & Unit side-by-side */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Price (₹)</label>
                            <input
                                type="number"
                                value={defaultPrice}
                                onChange={(e) => handlePriceChange(e.target.value)}
                                placeholder="0.00"
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
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
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all flex justify-between items-center text-sm"
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
                                                    className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-sm"
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

                    {/* Paid by default preference */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isPaidByDefault"
                            checked={isPaidByDefault}
                            onChange={(e) => setIsPaidByDefault(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="isPaidByDefault" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            Paid by default
                        </label>
                    </div>

                    {/* AI Icon Suggestion Indicator and Grid */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Item Icon
                            </label>
                            <button
                                type="button"
                                onClick={() => suggestIconFromAi(name)}
                                disabled={isSuggestingIcon || !name.trim()}
                                title="Ask Gemini to select the best icon"
                                className="text-xs text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors min-w-[70px] justify-end disabled:opacity-50"
                            >
                                {isSuggestingIcon ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                        <span className="text-blue-600 dark:text-blue-400">Selecting...</span>
                                    </>
                                ) : (
                                    <span>Ask AI</span>
                                )}
                            </button>
                        </div>
                        
                        <div className="flex overflow-x-auto gap-2 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 pb-3">
                            {AVAILABLE_ICONS.map((item) => {
                                const IconComp = item.icon;
                                const isSelected = selectedIcon === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedIcon(item.id)}
                                        title={item.label}
                                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all shrink-0 w-[68px] h-[64px] ${
                                            isSelected 
                                                ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-400' 
                                                : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50 dark:bg-[#050505] dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/50'
                                        }`}
                                    >
                                        <IconComp className="w-5 h-5 mb-1" />
                                        <span className="text-[10px] truncate max-w-full text-center">{item.label.split(' / ')[0]}</span>
                                    </button>
                                );
                            })}
                        </div>
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
                            {isSaving ? 'Saving...' : (initialItem ? 'Edit Item' : 'Add Item')}
                        </button>
                    </div>
                </form>
            </div>

            {/* AI Suggested Icon Confirmation Modal */}
            {isAiModalOpen && aiSuggestion && (
                <div className="fixed inset-0 z-[100] bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white max-w-sm w-full rounded-2xl p-6 shadow-2xl relative z-10 text-left animate-in zoom-in duration-150">
                        <div className="flex items-center gap-3 mb-3">
                            {(() => {
                                const matchedIconObj = AVAILABLE_ICONS.find(i => i.id === aiSuggestion.icon);
                                const IconComp = matchedIconObj?.icon || Package;
                                return (
                                    <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center shrink-0">
                                        <IconComp className="w-5 h-5" />
                                    </div>
                                );
                            })()}
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    AI Selection Suggestion
                                </h3>
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                    "{AVAILABLE_ICONS.find(i => i.id === aiSuggestion.icon)?.label?.split(' / ')[0] || aiSuggestion.icon}" suggested for "{name}"
                                </p>
                            </div>
                        </div>

                        {aiSuggestion.reason && (
                            <p className="text-xs text-slate-600 dark:text-neutral-400 mb-4 leading-relaxed bg-slate-50 dark:bg-neutral-900 p-2.5 rounded-xl border border-slate-100 dark:border-neutral-800">
                                <span className="font-semibold text-slate-700 dark:text-neutral-300">AI Reason: </span>
                                {aiSuggestion.reason}
                            </p>
                        )}

                        {/* If AI recommends creating a new transaction category */}
                        {aiSuggestion.createNewCategory && aiSuggestion.suggestedCategoryName && (
                            <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/30 text-xs">
                                <div className="font-bold text-amber-800 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                                    <span>Create New Transaction Category</span>
                                </div>
                                <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
                                    AI detected no matching category and recommends creating a new transaction category: <strong className="underline">"{aiSuggestion.suggestedCategoryName}"</strong> in general finance.
                                </p>
                            </div>
                        )}

                        {/* If AI matched an existing transaction category */}
                        {!aiSuggestion.createNewCategory && aiSuggestion.matchedCategory && (
                            <div className="mb-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/30 text-xs">
                                <div className="font-bold text-emerald-800 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5" />
                                    <span>Matched Existing Category</span>
                                </div>
                                <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                    AI matched this Daily Khata item with your existing transaction category: <strong>"{aiSuggestion.matchedCategory}"</strong> to prevent duplicates.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2.5 text-xs font-sans">
                            <button
                                type="button"
                                onClick={() => setIsAiModalOpen(false)}
                                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-900 text-slate-600 dark:text-neutral-400 font-semibold transition-colors cursor-pointer"
                            >
                                Dismiss
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    setSelectedIcon(aiSuggestion.icon);
                                    
                                    // If AI suggested creating a new custom category, create it!
                                    if (aiSuggestion.createNewCategory && aiSuggestion.suggestedCategoryName) {
                                        try {
                                            const catId = aiSuggestion.suggestedCategoryName.trim();
                                            const iconName = aiSuggestion.icon === 'calendar' ? 'CalendarDays' : 
                                                             aiSuggestion.icon === 'activity' ? 'Activity' : 
                                                             aiSuggestion.icon === 'milk' ? 'Milk' :
                                                             aiSuggestion.icon === 'newspaper' ? 'Newspaper' :
                                                             aiSuggestion.icon === 'droplet' ? 'Droplet' :
                                                             aiSuggestion.icon === 'package' ? 'Package' :
                                                             aiSuggestion.icon === 'tv' ? 'Tv' :
                                                             aiSuggestion.icon === 'zap' ? 'Zap' :
                                                             aiSuggestion.icon === 'flame' ? 'Flame' :
                                                             aiSuggestion.icon === 'car' ? 'Car' :
                                                             aiSuggestion.icon === 'bike' ? 'Bike' :
                                                             aiSuggestion.icon === 'heart' ? 'Heart' :
                                                             aiSuggestion.icon === 'coffee' ? 'Coffee' :
                                                             aiSuggestion.icon === 'apple' ? 'Apple' :
                                                             aiSuggestion.icon === 'utensils' ? 'Utensils' :
                                                             aiSuggestion.icon === 'book' ? 'Book' :
                                                             aiSuggestion.icon === 'scissors' ? 'Scissors' :
                                                             aiSuggestion.icon === 'trash' ? 'Trash' :
                                                             aiSuggestion.icon === 'wrench' ? 'Wrench' :
                                                             aiSuggestion.icon === 'shield' ? 'Shield' : 'Package';
                                            
                                            const newCat = {
                                                id: catId,
                                                label: catId,
                                                type: 'expense' as const,
                                                iconName,
                                                color: 'text-blue-500',
                                                bg: 'bg-blue-50 dark:bg-blue-950/20'
                                            };
                                            await saveCustomCategory(newCat, user);
                                            // Reload custom categories list
                                            const cats = await getCustomCategories(user);
                                            setCustomCategories(cats);
                                        } catch (catError) {
                                            console.error("Failed to automatically create custom category:", catError);
                                        }
                                    }
                                    setIsAiModalOpen(false);
                                }}
                                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                <span>Approve Selection</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DairyItemModal;
