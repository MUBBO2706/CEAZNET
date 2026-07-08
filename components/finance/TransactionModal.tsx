




import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Vehicle } from '../../types';
import { 
    X, Save, Calendar, Clock, Tag, CreditCard, AlignLeft, IndianRupee, ChevronDown, 
    Smartphone, Plus, Grid, Landmark, CheckCircle2, Search,
    Car, Bike, Fuel, Gauge, Droplets, Loader2
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { CATEGORY_CONFIG } from './categories';
import { getVehicles, saveVehicle, deleteVehicle } from '../../services/dbService';
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

            const list = CATEGORY_CONFIG[initialData.type];
            const isPredefined = list.some(c => c.id === initialData.category);
            setIsCustomCategory(!isPredefined);
            
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

    const loadVehicles = async () => {
        try {
            const v = await getVehicles(user);
            setVehicles(v);
        } catch (e) {
            console.error("Failed to load vehicles", e);
        }
    }

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

    const allTypeCategories = CATEGORY_CONFIG[type];
    
    // --- Determine Visible Categories (Top 3) ---
    // 1. Find categories that match the current type and are in the recent list
    const recentTypeCategories = recentCategoryIds
        .map(id => allTypeCategories.find(c => c.id === id))
        .filter((c): c is typeof allTypeCategories[0] => !!c);

    // 2. Take up to 3 recent categories
    let visibleCategories = recentTypeCategories.slice(0, 3);

    // 3. If fewer than 3, fill with default categories (avoiding duplicates)
    if (visibleCategories.length < 3) {
        const defaults = allTypeCategories.slice(0, 3);
        for (const def of defaults) {
            if (visibleCategories.length >= 3) break;
            if (!visibleCategories.some(c => c.id === def.id)) {
                visibleCategories.push(def);
            }
        }
    }

    // 4. If a category is selected and not in the visible list, replace the 3rd slot
    if (category && !isCustomCategory) {
        const isVisible = visibleCategories.some(c => c.id === category);
        if (!isVisible) {
            const selectedCatObj = allTypeCategories.find(c => c.id === category);
            if (selectedCatObj) {
                visibleCategories[2] = selectedCatObj;
            }
        }
    }
    
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
            className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all duration-200 ${
                category === cat.id 
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#161618]' 
                    : 'hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
        >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cat.bg} ${cat.color} transition-transform ${category === cat.id ? 'scale-110' : ''}`}>
                <cat.icon className="w-5 h-5" />
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
                onClick={onClose} 
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
                                        type="button"
                                        onClick={() => setIsPaymentSelectorOpen(true)}
                                        className="w-full h-full pl-3 pr-8 py-3 sm:py-5 rounded-2xl bg-gray-50/50 dark:bg-black/20 border-2 border-transparent focus:border-indigo-500/50 outline-none text-xs sm:text-sm font-medium text-gray-900 dark:text-white text-left flex items-center justify-start gap-2 transition-colors"
                                    >
                                        <div className={`p-1.5 rounded-lg ${selectedPaymentMethod.bg} shrink-0`}>
                                            <PaymentIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${selectedPaymentMethod.color}`} />
                                        </div>
                                        <span className="truncate flex-1 leading-tight">{selectedPaymentMethod.label}</span>
                                        <ChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Category Selector */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Category</label>
                                
                                {isCustomCategory ? (
                                    <div className="flex gap-2 animate-fade-in-up">
                                        <div className="relative flex-1">
                                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text"
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                placeholder="Enter custom category..."
                                                className="w-full pl-10 pr-3 py-3.5 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium text-gray-900 dark:text-white"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => { setIsCustomCategory(false); setCategory(''); }}
                                            className="px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-5 gap-2">
                                        {/* Show Visible 3 Categories (Default or Selected) */}
                                        {visibleCategories.map(cat => renderCategoryButton(cat))}
                                        
                                        {/* Custom Button */}
                                        <button
                                            type="button"
                                            onClick={() => { setIsCustomCategory(true); setCategory(''); }}
                                            className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200"
                                        >
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600">
                                                <Plus className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">Custom</span>
                                        </button>

                                        {/* More Button */}
                                        <button
                                            type="button"
                                            onClick={() => setShowAllCategories(true)}
                                            className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200"
                                        >
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                                <Grid className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">More</span>
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
                    <div className="px-6 py-3 border-b border-gray-200/50 dark:border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                ref={categorySearchRef}
                                type="text"
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                placeholder="Search categories..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 dark:bg-black/30 border-none outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-all"
                            />
                        </div>
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
                                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-600">
                                    <p className="text-sm">No categories found.</p>
                                    <button 
                                        onClick={() => { setIsCustomCategory(true); setCategory(categorySearchQuery); setShowAllCategories(false); setCategorySearchQuery(''); }}
                                        className="mt-2 text-indigo-500 font-bold text-xs hover:underline"
                                    >
                                        Use "{categorySearchQuery}" as custom
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Method Selector Modal Overlay */}
            {isPaymentSelectorOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                        onClick={() => setIsPaymentSelectorOpen(false)} 
                    />
                    <div className="relative w-full max-w-sm bg-white dark:bg-[#050505] rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 dark:text-white">Payment Method</h3>
                            <button onClick={() => setIsPaymentSelectorOpen(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-2">
                            {PAYMENT_METHODS.map((m) => {
                                const Icon = m.icon;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => { setMethod(m.id); setIsPaymentSelectorOpen(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-colors rounded-xl text-left mb-1"
                                    >
                                        <div className={`p-2 rounded-lg ${m.bg}`}>
                                            <Icon className={`w-5 h-5 ${m.color}`} />
                                        </div>
                                        <span className="flex-1">{m.label}</span>
                                        {method === m.id && <CheckCircle2 className="w-5 h-5 text-indigo-500" />}
                                    </button>
                                );
                            })}
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