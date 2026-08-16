




import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Vehicle } from '../../types';
import { 
    X, Save, Calendar, Clock, Tag, CreditCard, AlignLeft, IndianRupee, ChevronDown, 
    Smartphone, Plus, Grid, Landmark, CheckCircle2, Search, Check,
    Car, Bike, Fuel, Gauge, Droplets, Loader2, Sparkles, Wand2
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { CATEGORY_CONFIG, getCategoryConfig, LUCIDE_ICON_MAP } from './categories';
import { getVehicles, saveVehicle, deleteVehicle, getCustomCategories, saveCustomCategory, CustomCategoryItem } from '../../services/dbService';
import { generateAiCategoryIcon, autoCategorizeByDescription, AiIconSuggestion } from '../../services/categoryAiService';
import { useGlobalModal } from '../core/GlobalModalProvider';
import VehicleManagerModal from './VehicleManagerModal';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (t: Transaction) => void;
    initialData: Transaction | null;
    user: User | null;
    isSaving?: boolean;
    recentCategoryIds?: string[];
}

const PAYMENT_METHODS = [
    { id: 'Online', label: 'Online / UPI', icon: Smartphone, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { id: 'Cash', label: 'Cash', icon: IndianRupee, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
    { id: 'Card', label: 'Card', icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { id: 'Bank', label: 'Bank Transfer', icon: Landmark, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
];

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, initialData, user, isSaving = false, recentCategoryIds = [] }) => {
    const { alert: globalAlert } = useGlobalModal();
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [category, setCategory] = useState('');
    const [method, setMethod] = useState('Online');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    
    // UI State
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const [isPaymentSelectorOpen, setIsPaymentSelectorOpen] = useState(false);
    
    // Fuel & Vehicle State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [odometer, setOdometer] = useState<string>('');
    const [fuelLiters, setFuelLiters] = useState<string>('');
    const [isVehicleManagerOpen, setIsVehicleManagerOpen] = useState(false);

    // Custom Category & AI Icon State
    const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([]);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<AiIconSuggestion | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isApproveLoading, setIsApproveLoading] = useState(false);
    const [aiPendingName, setAiPendingName] = useState('');
    const [aiError, setAiError] = useState<string | null>(null);

    const handleAutoCategorizeByAi = async () => {
        if (!description.trim()) {
            globalAlert("Please enter a transaction description first so AI can auto-categorize.", { type: 'warning' });
            return;
        }

        setIsAiLoading(true);
        setAiError(null);
        try {
            const suggestion = await autoCategorizeByDescription(description.trim(), type, user);
            setAiPendingName(suggestion.categoryName);
            setAiSuggestion(suggestion);
            setIsAiModalOpen(true);
        } catch (err: any) {
            console.error("AI Auto-categorization Error:", err);
            globalAlert(err?.message || "Failed to auto-categorize with AI.", { type: 'danger' });
        } finally {
            setIsAiLoading(false);
        }
    };

    // Initialize with local date strings
    const [date, setDate] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    
    const [time, setTime] = useState(() => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    });

    const dateInputRef = useRef<HTMLInputElement>(null);
    const timeInputRef = useRef<HTMLInputElement>(null);
    const categorySearchRef = useRef<HTMLInputElement>(null);
    const paymentDropdownRef = useRef<HTMLDivElement>(null);
    const paymentButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (isPaymentSelectorOpen && 
                paymentDropdownRef.current && 
                !paymentDropdownRef.current.contains(event.target as Node) &&
                paymentButtonRef.current &&
                !paymentButtonRef.current.contains(event.target as Node)
            ) {
                setIsPaymentSelectorOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isPaymentSelectorOpen]);

    useEffect(() => {
        if (showAllCategories && categorySearchRef.current) {
            categorySearchRef.current.focus();
        }
    }, [showAllCategories]);
    
    useEffect(() => {
        if (isOpen) {
            loadVehicles();
        }
    }, [isOpen, user]);

    useEffect(() => {
        if (initialData) {
            setDescription(initialData.description);
            setAmount(initialData.amount.toString());
            setType(initialData.type);
            setCategory(initialData.category);
            setMethod(initialData.payment_method);
            
            // Hydrate Fuel Data if available
            if (initialData.metadata?.vehicle_id) {
                setSelectedVehicleId(initialData.metadata.vehicle_id);
                setOdometer(initialData.metadata.odometer_reading?.toString() || '');
                setFuelLiters(initialData.metadata.fuel_liters?.toString() || '');
            }

            const d = new Date(initialData.transaction_date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            
            setDate(`${year}-${month}-${day}`);
            setTime(`${hours}:${minutes}`);
        } else {
            resetForm();
        }
    }, [initialData, isOpen]);

    // Reactively determine if category is predefined or saved custom category when data / custom categories load
    useEffect(() => {
        if (initialData && isOpen) {
            const list = CATEGORY_CONFIG[initialData.type] || [];
            const isPredefined = list.some(c => c.id === initialData.category);
            const isSavedCustom = customCategories.some(c => c.id === initialData.category);
            
            if (isPredefined || isSavedCustom) {
                setIsCustomCategory(false);
            } else {
                setIsCustomCategory(true);
            }
        }
    }, [initialData, isOpen, customCategories]);

    const loadVehicles = async () => {
        try {
            const v = await getVehicles(user);
            setVehicles(v);
        } catch (e) {
            console.error("Failed to load vehicles", e);
        }
    }

    const loadCustomCategoriesData = async () => {
        try {
            const cats = await getCustomCategories(user);
            setCustomCategories(cats);
        } catch (e) {
            console.error("Failed to load custom categories", e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadVehicles();
            loadCustomCategoriesData();
        }
    }, [isOpen, user?.id]);

    const handleTriggerAiCategoryIcon = async (catName: string) => {
        const trimmed = catName.trim();
        if (!trimmed) return;

        if (!description.trim()) {
            globalAlert("Please enter a transaction description first so AI can generate an accurate category icon.", { type: 'warning' });
            return;
        }

        setAiPendingName(trimmed);
        setIsAiLoading(true);
        setAiError(null);
        setAiSuggestion(null);

        try {
            const suggestion = await generateAiCategoryIcon(trimmed, type, description.trim(), user);
            setAiSuggestion(suggestion);
            setIsAiModalOpen(true);
        } catch (err: any) {
            console.error("AI Category Icon Error:", err);
            setAiError(err?.message || "Failed to generate AI icon.");
            setAiSuggestion({
                iconName: 'Tag',
                color: 'text-indigo-500',
                bg: 'bg-indigo-100 dark:bg-indigo-900/30',
                reason: 'Default custom category',
                categoryName: trimmed,
                type
            });
            setIsAiModalOpen(true);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleApproveCustomCategory = async (approvedCat: CustomCategoryItem) => {
        setIsApproveLoading(true);
        try {
            const updated = await saveCustomCategory(approvedCat, user);
            setCustomCategories(updated);
            setCategory(approvedCat.id);
            setIsCustomCategory(false);
            setIsAiModalOpen(false);
            setShowAllCategories(false);
            setCategorySearchQuery('');
        } catch (e) {
            console.error("Failed to save approved custom category:", e);
        } finally {
            setIsApproveLoading(false);
        }
    };

    const resetForm = () => {
        setDescription('');
        setAmount('');
        setType('expense');
        setCategory('');
        setMethod('Online');
        setIsCustomCategory(false);
        setShowAllCategories(false);
        setCategorySearchQuery('');
        setIsPaymentSelectorOpen(false);
        setSelectedVehicleId('');
        setOdometer('');
        setFuelLiters('');
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        setDate(`${year}-${month}-${day}`);
        setTime(`${hours}:${minutes}`);
    };

    const handleTypeChange = (newType: 'expense' | 'income' | 'transfer') => {
        setType(newType);
        setCategory(''); 
        setIsCustomCategory(false);
    };
    
    const handleDeleteVehicle = async (id: string) => {
        await deleteVehicle(id, user);
        setVehicles(prev => prev.filter(v => v.id !== id));
        if (selectedVehicleId === id) setSelectedVehicleId('');
    }

    const handleUpdateVehicle = async (updatedVehicle: Vehicle) => {
        await saveVehicle(updatedVehicle, user);
        setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !category) return;

        const combinedDate = new Date(`${date}T${time}:00`);
        
        let metadata = initialData?.metadata || {};
        
        // Mileage Calculation Logic
        if (category === 'Fuel') {
            if (selectedVehicleId && odometer && fuelLiters) {
                const currentOdo = parseFloat(odometer);
                const liters = parseFloat(fuelLiters);
                const vehicle = vehicles.find(v => v.id === selectedVehicleId);
                
                if (vehicle && currentOdo > vehicle.current_odometer && liters > 0) {
                    const distance = currentOdo - vehicle.current_odometer;
                    const mileage = distance / liters;
                    
                    metadata = {
                        ...metadata,
                        vehicle_id: selectedVehicleId,
                        vehicle_name: vehicle.name,
                        odometer_reading: currentOdo,
                        fuel_liters: liters,
                        distance_driven: distance,
                        mileage: parseFloat(mileage.toFixed(2))
                    };
                } else {
                     // Update even if calculation isn't perfect (e.g. first entry)
                     metadata = {
                        ...metadata,
                        vehicle_id: selectedVehicleId,
                        vehicle_name: vehicle?.name,
                        odometer_reading: currentOdo,
                        fuel_liters: liters,
                    };
                }
            } else if (!selectedVehicleId) {
                // User explicitly unselected vehicle. Remove fuel metadata.
                const { vehicle_id, vehicle_name, odometer_reading, fuel_liters, distance_driven, mileage, ...rest } = metadata;
                metadata = rest;
            }
        } else {
            // Category changed from Fuel. Remove fuel metadata.
            const { vehicle_id, vehicle_name, odometer_reading, fuel_liters, distance_driven, mileage, ...rest } = metadata;
            metadata = rest;
        }

        const transaction: Transaction = {
            id: initialData?.id || crypto.randomUUID(),
            user_id: user?.id,
            description: description || category,
            amount: parseFloat(amount),
            type,
            category,
            payment_method: method,
            transaction_date: combinedDate.toISOString(),
            created_at: initialData?.created_at || new Date().toISOString(),
            metadata: Object.keys(metadata).length > 0 ? metadata : null
        };
        onSave(transaction);
    };

    if (!isOpen) return null;

    const customTypeCategories = customCategories
        .filter(c => c.type === type)
        .map(c => {
            const conf = getCategoryConfig(c.id, type, customCategories);
            return {
                id: c.id,
                label: c.label,
                icon: conf?.icon || Sparkles,
                bg: conf?.bg || 'bg-indigo-100 dark:bg-indigo-900/30',
                color: conf?.color || 'text-indigo-500',
                isCustom: true
            };
        });

    const allTypeCategories = [
        ...CATEGORY_CONFIG[type],
        ...customTypeCategories
    ];
    
    // --- Determine Visible Categories (Exactly 11 slots for horizontal scroll) ---
    // 1. Build unique list of up to 11 categories
    let visibleCategories: typeof allTypeCategories = [];

    // First, always include the currently selected category if it is set
    if (category) {
        const activeCat = allTypeCategories.find(c => c.id === category);
        if (activeCat) {
            visibleCategories.push(activeCat);
        } else {
            // Resolve custom category dynamically if not yet loaded in customCategories
            const conf = getCategoryConfig(category, type, customCategories);
            if (conf) {
                visibleCategories.push({
                    id: category,
                    label: conf.label || category,
                    icon: conf.icon || Sparkles,
                    bg: conf.bg || 'bg-indigo-100 dark:bg-indigo-900/30',
                    color: conf.color || 'text-indigo-500',
                    isCustom: true
                });
            }
        }
    }

    // Next, fill with recently/frequently used categories of the current type (from recentCategoryIds)
    const recentTypeCategories = recentCategoryIds
        .map(id => allTypeCategories.find(c => c.id === id))
        .filter((c): c is typeof allTypeCategories[0] => !!c);

    for (const cat of recentTypeCategories) {
        if (visibleCategories.length >= 11) break;
        if (!visibleCategories.some(c => c.id === cat.id)) {
            visibleCategories.push(cat);
        }
    }

    // Next, fill with standard categories for the current type as fallback
    const standardTypeCategories = CATEGORY_CONFIG[type] || [];
    for (const cat of standardTypeCategories) {
        if (visibleCategories.length >= 11) break;
        if (!visibleCategories.some(c => c.id === cat.id)) {
            visibleCategories.push(cat);
        }
    }

    // If still less than 11, fill with custom categories of this type
    for (const cat of customTypeCategories) {
        if (visibleCategories.length >= 11) break;
        if (!visibleCategories.some(c => c.id === cat.id)) {
            visibleCategories.push(cat);
        }
    }

    // Slice to exactly 11 slots
    visibleCategories = visibleCategories.slice(0, 11);
    
    // Filter categories based on search
    const filteredCategories = allTypeCategories.filter(c => 
        c.label.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );

    const renderCategoryButton = (cat: typeof allTypeCategories[0], isGrid = false) => (
        <button
            key={cat.id}
            type="button"
            onClick={() => { setCategory(cat.id); setIsCustomCategory(false); setShowAllCategories(false); setCategorySearchQuery(''); }}
            className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-all duration-200 ${
                isGrid 
                    ? 'w-full h-[76px]' 
                    : 'w-[22%] min-w-[70px] sm:w-[74px] sm:min-w-0 h-[76px] shrink-0'
            } ${
                category === cat.id 
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#161618]' 
                    : 'hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent hover:border-gray-100 dark:hover:border-white/5'
            }`}
        >
            <div className={`w-9 h-9 flex items-center justify-center ${cat.color} transition-transform ${category === cat.id ? 'scale-105' : ''}`}>
                <cat.icon className="w-5.5 h-5.5" />
            </div>
            <span className={`text-[10px] font-medium truncate w-full text-center ${category === cat.id ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {cat.label}
            </span>
        </button>
    );

    const selectedPaymentMethod = PAYMENT_METHODS.find(m => m.id === method) || PAYMENT_METHODS[0];
    const PaymentIcon = selectedPaymentMethod.icon;

    // Determine if Fuel UI should show
    const showFuelUI = category === 'Fuel';
    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" 
            />
            
            <div className="relative w-full max-w-md transform transition-all animate-fade-in-up">
                <div className="absolute -inset-[1px] bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-[2rem] opacity-15 dark:opacity-25 blur-sm" />
                
                <div className="relative bg-white/90 dark:bg-[#050505]/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col max-h-[90vh]">
                    
                    <style>{`
                        input[type="date"]::-webkit-calendar-picker-indicator,
                        input[type="time"]::-webkit-calendar-picker-indicator { 
                            display: none; 
                            -webkit-appearance: none;
                        }
                        .no-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                        .no-scrollbar {
                            -ms-overflow-style: none;
                            scrollbar-width: none;
                        }
                    `}</style>

                    <div className="px-6 py-5 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-white/5 backdrop-blur-md flex-shrink-0">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {initialData ? 'Edit Record' : 'New Record'}
                        </h2>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto scrollbar-hide">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            
                            <div className="flex bg-gray-100 dark:bg-black/40 p-1 rounded-2xl border border-gray-200 dark:border-white/5">
                                {['expense', 'income', 'transfer'].map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => handleTypeChange(t as any)}
                                        className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 ${
                                            type === t 
                                                ? 'bg-white dark:bg-neutral-800 text-black dark:text-white shadow-sm' 
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <div className="relative group w-[60%]">
                                    <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-5 rounded-2xl bg-gray-50/50 dark:bg-black/20 border-2 border-transparent focus:border-indigo-500/50 outline-none font-mono font-bold text-2xl sm:text-4xl text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-700 transition-all shadow-inner h-full"
                                        placeholder="0"
                                        required
                                        autoFocus
                                    />
                                </div>
                                
                                <div className="relative w-[40%] flex">
                                    <button
                                        ref={paymentButtonRef}
                                        type="button"
                                        onClick={() => setIsPaymentSelectorOpen(!isPaymentSelectorOpen)}
                                        className="w-full h-full pl-3 pr-8 py-3 sm:py-5 rounded-2xl bg-gray-50/50 dark:bg-black/20 border-2 border-transparent focus:border-indigo-500/50 outline-none text-xs sm:text-sm font-medium text-gray-900 dark:text-white text-left flex items-center justify-start gap-2 transition-colors"
                                    >
                                        <div className={`p-1.5 rounded-lg ${selectedPaymentMethod.bg} shrink-0`}>
                                            <PaymentIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${selectedPaymentMethod.color}`} />
                                        </div>
                                        <span className="truncate flex-1 leading-tight">{selectedPaymentMethod.label}</span>
                                        <ChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    </button>

                                    {isPaymentSelectorOpen && (
                                        <div 
                                            ref={paymentDropdownRef} 
                                            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto"
                                        >
                                            {PAYMENT_METHODS.map((m) => {
                                                const Icon = m.icon;
                                                return (
                                                    <button
                                                        key={m.id}
                                                        type="button"
                                                        onClick={() => { setMethod(m.id); setIsPaymentSelectorOpen(false); }}
                                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs sm:text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${m.bg}`}>
                                                            <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                                                        </div>
                                                        <span className="flex-1 truncate">{m.label}</span>
                                                        {method === m.id && <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Category Selector */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Category</label>
                                    <button
                                        type="button"
                                        onClick={handleAutoCategorizeByAi}
                                        disabled={isAiLoading}
                                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer bg-transparent hover:bg-transparent shadow-none px-0 py-0"
                                        title="AI Auto-Categorize based on description"
                                    >
                                        {isAiLoading ? (
                                            <>
                                                <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                                                <span className="text-indigo-600 dark:text-indigo-400">Categorizing...</span>
                                            </>
                                        ) : (
                                            <span>Do Nothing</span>
                                        )}
                                    </button>
                                </div>
                                
                                {isCustomCategory ? (
                                    <div className="flex gap-2 animate-fade-in-up">
                                        <div className="relative flex-1">
                                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text"
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (category.trim()) {
                                                            handleTriggerAiCategoryIcon(category);
                                                        }
                                                    }
                                                }}
                                                placeholder="Enter custom category..."
                                                className="w-full pl-10 pr-3 py-3.5 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium text-gray-900 dark:text-white"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        {/* Cancel Button (Cross icon) on Left */}
                                        <button 
                                            type="button"
                                            onClick={() => { setIsCustomCategory(false); setCategory(''); }}
                                            className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center shrink-0 active:scale-95"
                                            title="Cancel"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        {/* OK Button (Check icon) on Right */}
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (category.trim() && !isAiLoading) {
                                                    handleTriggerAiCategoryIcon(category);
                                                }
                                            }}
                                            disabled={!category.trim() || isAiLoading}
                                            className="w-12 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-all flex items-center justify-center shrink-0 shadow-md active:scale-95"
                                            title="Confirm Category with AI"
                                        >
                                            {isAiLoading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Check className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex overflow-x-auto gap-2 py-2 px-1 no-scrollbar bg-gray-50/50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl">
                                        {visibleCategories.map(cat => renderCategoryButton(cat))}

                                        {/* More Button */}
                                        <button
                                            type="button"
                                            onClick={() => setShowAllCategories(true)}
                                            className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-all duration-200 shrink-0 w-[22%] min-w-[70px] sm:w-[74px] sm:min-w-0 h-[76px] hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent hover:border-gray-100 dark:hover:border-white/5"
                                        >
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                                <Grid className="w-4.5 h-4.5" />
                                            </div>
                                            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 text-center w-full truncate">More</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* FUEL / VEHICLE SPECIFIC UI */}
                            {showFuelUI && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20 space-y-3 animate-fade-in-up">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Fuel className="w-3.5 h-3.5" /> Fuel & Mileage
                                        </label>
                                        <button 
                                            type="button" 
                                            onClick={() => setIsVehicleManagerOpen(true)}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-white dark:bg-white/10 px-2 py-1 rounded shadow-sm"
                                        >
                                            Manage Vehicles
                                        </button>
                                    </div>

                                    {/* Vehicle Selector */}
                                    <div className="relative">
                                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                                        <select
                                            value={selectedVehicleId}
                                            onChange={(e) => {
                                                setSelectedVehicleId(e.target.value);
                                                // Pre-fill last reading if vehicle selected
                                                const v = vehicles.find(veh => veh.id === e.target.value);
                                                if(v) setOdometer(v.current_odometer.toString());
                                            }}
                                            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/50 dark:bg-black/20 border border-red-200 dark:border-red-900/30 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/50 appearance-none"
                                        >
                                            <option value="">Select Vehicle...</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.name} - {v.number_plate}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 pointer-events-none" />
                                    </div>

                                    {/* Inputs: Odometer & Liters */}
                                    {selectedVehicleId && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative group">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                                    <Gauge className="w-4 h-4" />
                                                </div>
                                                <input 
                                                    type="number"
                                                    value={odometer}
                                                    onChange={e => setOdometer(e.target.value)}
                                                    placeholder="Odometer (km)"
                                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/50 dark:bg-black/20 border border-red-200 dark:border-red-900/30 outline-none focus:ring-2 focus:ring-red-500/50 text-sm"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                                    <Droplets className="w-4 h-4" />
                                                </div>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={fuelLiters}
                                                    onChange={e => setFuelLiters(e.target.value)}
                                                    placeholder="Liters"
                                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/50 dark:bg-black/20 border border-red-200 dark:border-red-900/30 outline-none focus:ring-2 focus:ring-red-500/50 text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Mileage Preview */}
                                    {selectedVehicle && odometer && fuelLiters && (
                                        <div className="flex justify-between items-center text-xs px-2 pt-1 text-red-700 dark:text-red-300">
                                            <span>
                                                Prev: <b>{selectedVehicle.current_odometer} km</b>
                                            </span>
                                            <span>
                                                Est: <b>{((parseFloat(odometer) - selectedVehicle.current_odometer) / parseFloat(fuelLiters)).toFixed(1)} km/L</b>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="relative">
                                <AlignLeft className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input 
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Description (Optional)"
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-indigo-500/50 text-base font-medium text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">

                                <div className="relative cursor-pointer group" onClick={() => dateInputRef.current?.showPicker()}>
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input 
                                        ref={dateInputRef}
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full pl-10 pr-8 py-3.5 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium text-gray-900 dark:text-white appearance-none cursor-pointer"
                                    />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none opacity-70" />
                                </div>

                                <div className="relative cursor-pointer group" onClick={() => timeInputRef.current?.showPicker()}>
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input 
                                        ref={timeInputRef}
                                        type="time"
                                        value={time}
                                        onChange={(e) => setTime(e.target.value)}
                                        className="w-full pl-10 pr-8 py-3.5 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium text-gray-900 dark:text-white appearance-none cursor-pointer"
                                    />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none opacity-70" />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="group relative w-full flex items-center justify-center gap-2 py-4 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <div className={`absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] ${!isSaving && 'group-hover:translate-x-[100%]'} transition-transform duration-1000`} />
                                {isSaving ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Save className="w-5 h-5" />
                                )}
                                <span className="text-base">{isSaving ? 'Saving...' : 'Save Record'}</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Category Full Grid Modal Overlay */}
            {showAllCategories && (
                <div className="absolute inset-0 z-[70] bg-[#F9F6F2] dark:bg-black flex flex-col animate-slide-up-fade">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-white/5 backdrop-blur-md">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">All Categories</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Select one to continue</p>
                        </div>
                        <button onClick={() => setShowAllCategories(false)} className="p-2 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {/* Search Bar in Category Modal */}
                    <div className="px-6 py-3 border-b border-gray-200 dark:border-white/10 flex items-center bg-transparent">
                        <Search className="w-4 h-4 text-gray-400 shrink-0 mr-3 pointer-events-none" />
                        <input 
                            ref={categorySearchRef}
                            type="text"
                            value={categorySearchQuery}
                            onChange={(e) => setCategorySearchQuery(e.target.value)}
                            placeholder="Search categories..."
                            className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
                        />
                        {categorySearchQuery && (
                            <button onClick={() => setCategorySearchQuery('')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 ml-1">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Recent Section */}
                        {!categorySearchQuery && recentTypeCategories.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Recently Used</h3>
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                                    {recentTypeCategories.map(cat => renderCategoryButton(cat, true))}
                                </div>
                            </div>
                        )}

                        {/* All Categories */}
                        <div>
                            {!categorySearchQuery && recentTypeCategories.length > 0 && (
                                <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">All Categories</h3>
                            )}
                            
                            {filteredCategories.length > 0 ? (
                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-4 content-start">
                                    {filteredCategories.map(cat => renderCategoryButton(cat, true))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600 gap-3">
                                    <p className="text-sm">No preset category matches "{categorySearchQuery}".</p>
                                    <button 
                                        type="button"
                                        onClick={() => handleTriggerAiCategoryIcon(categorySearchQuery)}
                                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Generate AI Icon for "{categorySearchQuery}"
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Category Icon Confirmation Modal */}
            {isAiModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/20 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-black border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white max-w-sm w-full rounded-2xl p-6 shadow-2xl relative z-10 text-left">
                        <div className="flex items-center gap-3 mb-3">
                            {(() => {
                                const iconName = aiSuggestion?.iconName || 'Tag';
                                const IconComp = LUCIDE_ICON_MAP[iconName] || LUCIDE_ICON_MAP.Tag || Tag;
                                return (
                                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0">
                                        <IconComp className="w-5 h-5" />
                                    </div>
                                );
                            })()}
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    {aiSuggestion?.isExisting ? "Approve Category Selection" : "Save Custom Category"}
                                </h3>
                                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                    "{aiPendingName}"
                                </p>
                            </div>
                        </div>

                        {aiSuggestion?.reason && (
                            <p className="text-xs text-slate-600 dark:text-neutral-400 mb-5 leading-relaxed">
                                <span className="font-semibold text-slate-700 dark:text-neutral-300">AI Reason: </span>
                                {aiSuggestion.reason}
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2.5 text-xs font-sans">
                            <button
                                type="button"
                                onClick={() => setIsAiModalOpen(false)}
                                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-900 text-slate-600 dark:text-neutral-400 font-semibold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isApproveLoading}
                                onClick={async () => {
                                    if (!aiSuggestion) return;
                                    if (aiSuggestion.isExisting) {
                                        setCategory(aiSuggestion.categoryName);
                                        setIsCustomCategory(false);
                                        setIsAiModalOpen(false);
                                    } else {
                                        const iconName = aiSuggestion?.iconName || 'Tag';
                                        const iconBg = aiSuggestion?.bg || 'bg-indigo-100 dark:bg-indigo-900/30';
                                        const iconColor = aiSuggestion?.color || 'text-indigo-500';

                                        await handleApproveCustomCategory({
                                            id: aiPendingName,
                                            label: aiPendingName,
                                            type,
                                            iconName,
                                            color: iconColor,
                                            bg: iconBg
                                        });
                                    }
                                }}
                                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                {isApproveLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Approve</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Vehicle Manager Modal Overlay */}
            <VehicleManagerModal 
                isOpen={isVehicleManagerOpen}
                onClose={() => setIsVehicleManagerOpen(false)}
                vehicles={vehicles}
                onAddVehicle={async (v) => {
                     const newVehicle: Vehicle = {
                        id: crypto.randomUUID(),
                        user_id: user?.id,
                        ...v
                    };
                    await saveVehicle(newVehicle, user);
                    setVehicles(prev => [...prev, newVehicle]);
                    setSelectedVehicleId(newVehicle.id); // Auto-select new vehicle
                }}
                onUpdateVehicle={handleUpdateVehicle}
                onDeleteVehicle={handleDeleteVehicle}
            />
        </div>
    );
};

export default TransactionModal;