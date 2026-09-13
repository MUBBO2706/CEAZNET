




import React, { useState, useEffect, useRef } from 'react';
import { Transaction, Vehicle } from '../../types';
import { 
    X, Save, Calendar, Clock, Tag, CreditCard, AlignLeft, IndianRupee, ChevronDown, 
    Smartphone, Plus, Grid, Landmark, CheckCircle2, Search, Check,
    Car, Bike, Fuel, Gauge, Droplets, Loader, Sparkles, Wand2, Settings2, Info, AlertTriangle,
    ArrowDownLeft, ArrowUpRight, ArrowLeftRight
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { CATEGORY_CONFIG, getCategoryConfig, LUCIDE_ICON_MAP } from './categories';
import { getVehicles, saveVehicle, deleteVehicle, getCustomCategories, saveCustomCategory, CustomCategoryItem } from '../../services/dbService';
import { generateAiCategoryIcon, autoCategorizeByDescription, AiIconSuggestion } from '../../services/categoryAiService';
import { enhanceDescriptionWithAi } from '../../services/descriptionAiService';
import { useGlobalModal } from '../core/GlobalModalProvider';
import VehicleManagerModal from './VehicleManagerModal';
import { CustomAiSparkleIcon } from '../SupportView';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (t: Transaction) => void;
    initialData: Transaction | null;
    user: User | null;
    isSaving?: boolean;
    recentCategoryIds?: string[];
    transactions?: Transaction[];
}

const PAYMENT_METHODS = [
    { id: 'Online', label: 'Online / UPI', icon: Smartphone, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'Cash', label: 'Cash', icon: IndianRupee, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'Card', label: 'Card', icon: CreditCard, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'Bank', label: 'Bank Transfer', icon: Landmark, color: 'text-amber-500', bg: 'bg-amber-500/10' },
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

const TransactionModalComponent: React.FC<TransactionModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    initialData, 
    user, 
    isSaving = false, 
    recentCategoryIds = [] 
}) => {
    const { alert: globalAlert, confirm: globalConfirm } = useGlobalModal();
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'expense' | 'income' | 'transfer'>('expense');
    const [category, setCategory] = useState('');
    const [method, setMethod] = useState('Online');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

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

    // Sequential validation hierarchy: Amount -> Date -> Time -> Category
    const getFirstValidationError = (): 'amount' | 'date' | 'time' | 'category' | null => {
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return 'amount';
        }
        if (!date) {
            return 'date';
        }
        if (!time) {
            return 'time';
        }
        if (!category) {
            return 'category';
        }
        return null;
    };

    const activeErrorField = hasAttemptedSubmit ? getFirstValidationError() : null;
    
    // DevTools state tracking to offset layouts cleanly
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(() => {
        try {
            const saved = localStorage.getItem('devToolsIsOpen') ?? localStorage.getItem('devConsoleIsOpen');
            return saved !== null ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const handleStateChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail && typeof customEvent.detail.isOpen === 'boolean') {
                setIsDevToolsOpen(customEvent.detail.isOpen);
            }
        };
        window.addEventListener('devToolsStateChange', handleStateChange);
        return () => {
            window.removeEventListener('devToolsStateChange', handleStateChange);
        };
    }, []);
    
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
    const [isEnhancingDescription, setIsEnhancingDescription] = useState(false);
    const [autoCategorizeError, setAutoCategorizeError] = useState<string | null>(null);
    const [autoRefineError, setAutoRefineError] = useState<string | null>(null);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    const handleCancel = () => {
        if (!showDiscardConfirm) {
            setShowDiscardConfirm(true);
            return;
        }

        setShowDiscardConfirm(false);
        resetForm();
        onClose();
    };

    // Browser page reload / leave confirmation popup when modal has unsaved transaction data
    useEffect(() => {
        if (!isOpen) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const hasEnteredAnyInput = Boolean(
                amount.trim() || 
                description.trim() || 
                category.trim() || 
                odometer.trim() || 
                fuelLiters.trim() || 
                selectedVehicleId
            );
            const hasEditedExistingInput = initialData ? (
                amount.trim() !== String(initialData.amount ?? '') ||
                description.trim() !== (initialData.description ?? '') ||
                category !== (initialData.category ?? '') ||
                method !== (initialData.payment_method ?? '')
            ) : false;

            const hasUnsavedContent = initialData ? hasEditedExistingInput : hasEnteredAnyInput;

            if (hasUnsavedContent) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isOpen, amount, description, category, odometer, fuelLiters, selectedVehicleId, method, initialData]);

    const handleAutoCategorizeByAi = async () => {
        setAutoCategorizeError(null);
        if (!description.trim()) {
            setAutoCategorizeError("Please enter a transaction description first so AI can auto-categorize.");
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
            setAutoCategorizeError(err?.message || "Failed to auto-categorize with AI.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleEnhanceDescription = async () => {
        setAutoRefineError(null);
        if (!description.trim() && (!amount || !category)) {
            setAutoRefineError("Please enter a rough description, or specify an amount and category first.");
            return;
        }

        setIsEnhancingDescription(true);
        try {
            const enhanced = await enhanceDescriptionWithAi(
                description,
                amount,
                type,
                category,
                method,
                user
            );
            if (enhanced && enhanced !== description) {
                setDescription(enhanced);
            }
        } catch (err: any) {
            console.error("AI Description Enhancement Error:", err);
            setAutoRefineError(err?.message || "Failed to enhance description with AI.");
        } finally {
            setIsEnhancingDescription(false);
        }
    };

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
    };

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
            setAutoCategorizeError("Please enter a transaction description first so AI can generate an accurate category icon.");
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
        setHasAttemptedSubmit(false);
        setAutoCategorizeError(null);
        setAutoRefineError(null);
        setShowDiscardConfirm(false);
        
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

    const handleQuickAmount = (delta: number) => {
        const current = parseFloat(amount) || 0;
        const next = Math.max(0, current + delta);
        setAmount(next.toString());
    };
    
    const handleDeleteVehicle = async (id: string) => {
        await deleteVehicle(id, user);
        setVehicles(prev => prev.filter(v => v.id !== id));
        if (selectedVehicleId === id) setSelectedVehicleId('');
    };

    const handleUpdateVehicle = async (updatedVehicle: Vehicle) => {
        await saveVehicle(updatedVehicle, user);
        setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setHasAttemptedSubmit(true);

        const firstError = getFirstValidationError();
        if (firstError) {
            // Handled via inline field validation messages and highlights
            return;
        }

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
                     metadata = {
                        ...metadata,
                        vehicle_id: selectedVehicleId,
                        vehicle_name: vehicle?.name,
                        odometer_reading: currentOdo,
                        fuel_liters: liters,
                    };
                }
            } else if (!selectedVehicleId) {
                const { vehicle_id, vehicle_name, odometer_reading, fuel_liters, distance_driven, mileage, ...rest } = metadata;
                metadata = rest;
            }
        } else {
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
    
    // --- Determine Visible Categories (Up to 11 slots for smooth carousel) ---
    let visibleCategories: typeof allTypeCategories = [];

    if (category) {
        const activeCat = allTypeCategories.find(c => c.id === category);
        if (activeCat) {
            visibleCategories.push(activeCat);
        } else {
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

    const recentTypeCategories = recentCategoryIds
        .map(id => allTypeCategories.find(c => c.id === id))
        .filter((c): c is typeof allTypeCategories[0] => !!c);

    for (const cat of recentTypeCategories) {
        if (visibleCategories.length >= 11) break;
        if (!visibleCategories.some(c => c.id === cat.id)) {
            visibleCategories.push(cat);
        }
    }

    const standardTypeCategories = CATEGORY_CONFIG[type] || [];
    for (const cat of standardTypeCategories) {
        if (visibleCategories.length >= 11) break;
        if (!visibleCategories.some(c => c.id === cat.id)) {
            visibleCategories.push(cat);
        }
    }

    for (const cat of customTypeCategories) {
        if (visibleCategories.length >= 11) break;
        if (!visibleCategories.some(c => c.id === cat.id)) {
            visibleCategories.push(cat);
        }
    }

    visibleCategories = visibleCategories.slice(0, 11);
    
    const filteredCategories = allTypeCategories.filter(c => 
        c.label.toLowerCase().includes(categorySearchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );

    const selectedPaymentMethod = PAYMENT_METHODS.find(m => m.id === method) || PAYMENT_METHODS[0];
    const PaymentIcon = selectedPaymentMethod.icon;

    const showFuelUI = category === 'Fuel';
    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    // Type styling themes
    const typeTheme = {
        expense: {
            activeTab: 'bg-rose-500 text-white shadow-md shadow-rose-500/25',
            accentGlow: 'from-rose-500/20 via-orange-500/10 to-transparent',
            amountColor: 'text-rose-600 dark:text-rose-400',
            iconColor: 'text-rose-500 dark:text-rose-400',
            modalBorder: 'border-rose-500/40 dark:border-rose-500/30',
            icon: ArrowDownLeft,
            label: 'Expense'
        },
        income: {
            activeTab: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25',
            accentGlow: 'from-emerald-500/20 via-teal-500/10 to-transparent',
            amountColor: 'text-emerald-600 dark:text-emerald-400',
            iconColor: 'text-emerald-500 dark:text-emerald-400',
            modalBorder: 'border-emerald-500/40 dark:border-emerald-500/30',
            icon: ArrowUpRight,
            label: 'Income'
        },
        transfer: {
            activeTab: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25',
            accentGlow: 'from-indigo-500/20 via-purple-500/10 to-transparent',
            amountColor: 'text-indigo-600 dark:text-indigo-400',
            iconColor: 'text-indigo-500 dark:text-indigo-400',
            modalBorder: 'border-indigo-500/40 dark:border-indigo-500/30',
            icon: ArrowLeftRight,
            label: 'Transfer'
        }
    }[type];

    const TypeIcon = typeTheme.icon;

    const renderCategoryButton = (cat: typeof allTypeCategories[0], isGrid = false) => {
        const isSelected = category === cat.id;
        return (
            <button
                key={cat.id}
                type="button"
                onClick={() => { 
                    setCategory(cat.id); 
                    setIsCustomCategory(false); 
                    setShowAllCategories(false); 
                    setCategorySearchQuery(''); 
                }}
                className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-2xl transition-all duration-150 group cursor-pointer relative ${
                    isGrid 
                        ? 'w-full h-[70px] hover:bg-neutral-100/60 dark:hover:bg-white/[0.04]' 
                        : 'w-[66px] min-w-[66px] sm:w-[70px] sm:min-w-[70px] h-[68px] shrink-0 hover:bg-neutral-100/60 dark:hover:bg-white/[0.04]'
                } ${
                    isSelected 
                        ? 'border-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-xs scale-[1.02]' 
                        : 'border border-transparent'
                }`}
            >
                {/* Top-Right Indicator Dot */}
                {isSelected && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 ring-2 ring-white dark:ring-[#0d0d10] shadow-xs" />
                )}
                <div className={`flex items-center justify-center ${cat.color} transition-transform duration-150 ${
                    isSelected ? 'scale-110' : 'group-hover:scale-105'
                }`}>
                    <cat.icon className="w-5 h-5" />
                </div>
                <span className={`text-[10.5px] truncate w-full text-center px-0.5 transition-colors ${
                    isSelected 
                        ? 'text-indigo-700 dark:text-indigo-300 font-bold' 
                        : 'text-neutral-600 dark:text-neutral-400 font-medium group-hover:text-neutral-900 dark:group-hover:text-white'
                }`}>
                    {cat.label}
                </span>
            </button>
        );
    };

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            style={{ 
                paddingBottom: isDevToolsOpen ? 'calc(45vh + 30px)' : '32px' 
            }}
        >
            {/* Backdrop with elegant blur */}
            <div 
                className="fixed inset-0 bg-neutral-950/60 dark:bg-black/80 backdrop-blur-md transition-opacity animate-fade-in-up" 
            />
            
            {/* Modal Card */}
            <div className="relative w-full max-w-[440px] my-auto animate-fade-in-up">
                {/* Subtle outer ambient glow */}
                <div className={`absolute -inset-[1px] bg-gradient-to-b ${typeTheme.accentGlow} rounded-3xl opacity-80 blur-lg pointer-events-none transition-all duration-500`} />
                
                <div className={`relative bg-white dark:bg-[#0d0d10] rounded-3xl shadow-2xl border ${typeTheme.modalBorder} overflow-hidden flex flex-col max-h-[90vh]`}>
                    
                    <style>{`
                        input[type="date"]::-webkit-calendar-picker-indicator,
                        input[type="time"]::-webkit-calendar-picker-indicator { 
                            display: none; 
                            -webkit-appearance: none;
                        }
                    `}</style>

                    {/* Header */}
                    <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/[0.06] flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02] backdrop-blur-md flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <TypeIcon className={`w-5 h-5 shrink-0 ${typeTheme.iconColor}`} />
                            <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                                {initialData ? 'Edit Record' : 'New Transaction'}
                            </h2>
                            <span className="text-sm font-semibold text-neutral-400 dark:text-neutral-500">•</span>
                            <span className={`text-sm font-bold capitalize ${typeTheme.iconColor}`}>
                                {typeTheme.label}
                            </span>
                        </div>
                    </div>

                    {/* Scrollable Form Body */}
                    <div className="p-4 sm:p-5 overflow-y-auto scrollbar-hide">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            
                            {/* Modern Segmented Type Switcher */}
                            <div className="flex bg-neutral-100/90 dark:bg-black/50 p-1 rounded-2xl border border-neutral-200/70 dark:border-white/[0.06]">
                                {(['expense', 'income', 'transfer'] as const).map((t) => {
                                    const isCurrent = type === t;
                                    const currentTabColor = t === 'expense' 
                                        ? 'bg-rose-500 text-white' 
                                        : t === 'income' 
                                        ? 'bg-emerald-500 text-white' 
                                        : 'bg-indigo-600 text-white';

                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => handleTypeChange(t)}
                                            className={`flex-1 py-2 text-xs font-bold capitalize tracking-wide rounded-xl transition-all duration-200 cursor-pointer ${
                                                isCurrent 
                                                    ? `${currentTabColor} shadow-md` 
                                                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Hero Amount & Payment Method Section */}
                            <div className={`p-3.5 sm:p-4 rounded-2xl bg-neutral-50/90 dark:bg-white/[0.02] border transition-all space-y-3 ${
                                activeErrorField === 'amount'
                                    ? 'border-rose-400 dark:border-rose-500/80 ring-2 ring-rose-500/30'
                                    : 'border-neutral-200/80 dark:border-white/[0.06]'
                            }`}>
                                <div className="flex items-center justify-between gap-3">
                                    {/* Big Amount Input */}
                                    <div className="relative flex-1 flex items-center">
                                        <span className={`text-2xl sm:text-3xl font-bold mr-1.5 ${typeTheme.amountColor}`}>₹</span>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className={`w-full bg-transparent border-none outline-none font-mono font-extrabold text-2xl sm:text-3xl ${typeTheme.amountColor} placeholder-neutral-300 dark:placeholder-neutral-700 tracking-tight`}
                                            placeholder="0.00"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    
                                    {/* Payment Method Selector Pill */}
                                    <div className="relative shrink-0">
                                        <button
                                            ref={paymentButtonRef}
                                            type="button"
                                            onClick={() => setIsPaymentSelectorOpen(!isPaymentSelectorOpen)}
                                            className="h-9 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2 hover:border-neutral-300 dark:hover:border-white/20 transition-all shadow-xs cursor-pointer"
                                        >
                                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${selectedPaymentMethod.bg} shrink-0`}>
                                                <PaymentIcon className={`w-3 h-3 ${selectedPaymentMethod.color}`} />
                                            </div>
                                            <span className="text-[11.5px] font-bold">{selectedPaymentMethod.label}</span>
                                            <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${isPaymentSelectorOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isPaymentSelectorOpen && (
                                            <div 
                                                ref={paymentDropdownRef} 
                                                className="absolute top-full right-0 mt-1.5 w-44 bg-white dark:bg-[#121216] border border-neutral-200 dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden py-1"
                                            >
                                                {PAYMENT_METHODS.map((m) => {
                                                    const Icon = m.icon;
                                                    const isSelected = method === m.id;
                                                    return (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            onClick={() => { setMethod(m.id); setIsPaymentSelectorOpen(false); }}
                                                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer text-left ${
                                                                isSelected 
                                                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                                                                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${m.bg}`}>
                                                                <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                                                            </div>
                                                            <span className="flex-1 truncate">{m.label}</span>
                                                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Amount Chips */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar pt-1 border-t border-neutral-200/50 dark:border-white/[0.04]">
                                    {QUICK_AMOUNTS.map((amt) => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => handleQuickAmount(amt)}
                                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/[0.05] border border-neutral-200/60 dark:border-white/[0.06] text-[10.5px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:border-neutral-300 dark:hover:border-white/20 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
                                        >
                                            +₹{amt}
                                        </button>
                                    ))}
                                    {parseFloat(amount) > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setAmount('')}
                                            className="px-2 py-1 rounded-lg text-[10.5px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0 cursor-pointer ml-auto"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                {activeErrorField === 'amount' && (
                                    <div className="px-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 animate-fade-in-up flex items-center gap-1.5 pt-0.5">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                                        <span>Please enter a valid amount greater than ₹0.</span>
                                    </div>
                                )}
                            </div>

                            {/* Date & Time Single Line Row (Positioned above Categories) */}
                            <div className="space-y-1">
                                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                                    <div 
                                        className={`relative cursor-pointer h-10 px-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border flex items-center gap-2 hover:border-neutral-300 dark:hover:border-white/20 transition-all ${
                                            activeErrorField === 'date' 
                                                ? 'border-rose-400 dark:border-rose-500/80 ring-2 ring-rose-500/30' 
                                                : 'border-neutral-200/80 dark:border-white/[0.08]'
                                        }`}
                                        onClick={() => dateInputRef.current?.showPicker()}
                                    >
                                        <Calendar className={`w-4 h-4 shrink-0 ${activeErrorField === 'date' ? 'text-rose-500' : 'text-neutral-400'}`} />
                                        <input 
                                            ref={dateInputRef}
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 p-0 cursor-pointer"
                                        />
                                    </div>

                                    <div 
                                        className={`relative cursor-pointer h-10 px-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border flex items-center gap-2 hover:border-neutral-300 dark:hover:border-white/20 transition-all ${
                                            activeErrorField === 'time' 
                                                ? 'border-rose-400 dark:border-rose-500/80 ring-2 ring-rose-500/30' 
                                                : 'border-neutral-200/80 dark:border-white/[0.08]'
                                        }`}
                                        onClick={() => timeInputRef.current?.showPicker()}
                                    >
                                        <Clock className={`w-4 h-4 shrink-0 ${activeErrorField === 'time' ? 'text-rose-500' : 'text-neutral-400'}`} />
                                        <input 
                                            ref={timeInputRef}
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="w-full bg-transparent border-none outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 p-0 cursor-pointer"
                                        />
                                    </div>
                                </div>
                                {activeErrorField === 'date' && (
                                    <div className="px-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 animate-fade-in-up flex items-center gap-1.5 pt-0.5">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                                        <span>Please select a valid date for the transaction.</span>
                                    </div>
                                )}
                                {activeErrorField === 'time' && (
                                    <div className="px-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 animate-fade-in-up flex items-center gap-1.5 pt-0.5">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                                        <span>Please select a valid time for the transaction.</span>
                                    </div>
                                )}
                            </div>

                            {/* Category Selector Card */}
                            <div className={`space-y-2 rounded-2xl transition-all ${
                                activeErrorField === 'category' ? 'p-1.5 ring-2 ring-rose-500/50 bg-rose-500/[0.03]' : ''
                            }`}>
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex items-center">
                                        <label className="text-[11px] font-extrabold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                            Category
                                        </label>
                                        {category ? (
                                            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs ml-1.5">• {category}</span>
                                        ) : activeErrorField === 'category' ? (
                                            <span className="text-rose-500 dark:text-rose-400 font-semibold text-xs ml-1.5 animate-fade-in-up">
                                                • Please select a category
                                            </span>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAutoCategorizeByAi}
                                        disabled={isAiLoading}
                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer p-0 bg-transparent border-none"
                                        title="Auto-Categorize based on description"
                                    >
                                        {isAiLoading ? (
                                            <>
                                                <Loader className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                                <span>Categorising...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CustomAiSparkleIcon className="w-3.5 h-3.5 drop-shadow-xs" />
                                                <span>Auto categorize</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                
                                {autoCategorizeError && (
                                    <div className="px-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 animate-fade-in-up flex items-center gap-1.5 pt-0.5">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                                        <span>{autoCategorizeError}</span>
                                    </div>
                                )}
                                
                                {isCustomCategory ? (
                                    <div className="flex gap-2 animate-fade-in-up">
                                        <div className="relative flex-1">
                                            <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
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
                                                placeholder="Enter custom category name..."
                                                className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-neutral-50 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/10 outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs font-semibold text-neutral-900 dark:text-white"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => { setIsCustomCategory(false); setCategory(''); }}
                                            className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center shrink-0 active:scale-95 cursor-pointer"
                                            title="Cancel Custom"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (category.trim() && !isAiLoading) {
                                                    handleTriggerAiCategoryIcon(category);
                                                }
                                            }}
                                            disabled={!category.trim() || isAiLoading}
                                            className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-all flex items-center justify-center shrink-0 shadow-md active:scale-95 cursor-pointer"
                                            title="Confirm with AI"
                                        >
                                            {isAiLoading ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex overflow-x-auto gap-2 py-1 px-1 no-scrollbar">
                                        {visibleCategories.map(cat => renderCategoryButton(cat))}

                                        {/* More Categories Button */}
                                        <button
                                            type="button"
                                            onClick={() => setShowAllCategories(true)}
                                            className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl transition-all duration-150 shrink-0 w-[64px] min-w-[64px] sm:w-[68px] sm:min-w-[68px] h-[66px] hover:bg-neutral-100/50 dark:hover:bg-white/[0.04] cursor-pointer group"
                                        >
                                            <div className="flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                                                <Grid className="w-5 h-5" />
                                            </div>
                                            <span className="text-[10.5px] font-medium text-indigo-600 dark:text-indigo-400 text-center w-full truncate">More</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {showFuelUI && (
                                <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/20 rounded-2xl border border-rose-200/70 dark:border-rose-900/30 space-y-2.5 animate-fade-in-up">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Fuel className="w-3.5 h-3.5" /> Vehicle & Mileage
                                        </label>
                                        <button 
                                            type="button" 
                                            onClick={() => setIsVehicleManagerOpen(true)}
                                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/50 px-2 py-0.5 rounded-lg shadow-2xs cursor-pointer"
                                        >
                                            Manage Vehicles
                                        </button>
                                    </div>

                                    {/* Vehicle Selector */}
                                    <div className="relative">
                                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-500" />
                                        <select
                                            value={selectedVehicleId}
                                            onChange={(e) => {
                                                setSelectedVehicleId(e.target.value);
                                                const v = vehicles.find(veh => veh.id === e.target.value);
                                                if(v) setOdometer(v.current_odometer.toString());
                                            }}
                                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-rose-200/80 dark:border-rose-900/40 text-xs font-semibold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500/50 appearance-none cursor-pointer"
                                        >
                                            <option value="">Select Vehicle (Optional)...</option>
                                            {vehicles.map(v => (
                                                <option key={v.id} value={v.id}>{v.name} ({v.number_plate})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-500 pointer-events-none" />
                                    </div>

                                    {/* Inputs: Odometer & Liters */}
                                    {selectedVehicleId && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="relative group">
                                                <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                                                <input 
                                                    type="number"
                                                    value={odometer}
                                                    onChange={e => setOdometer(e.target.value)}
                                                    placeholder="Odometer (km)"
                                                    className="w-full pl-8 pr-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-rose-200/80 dark:border-rose-900/40 outline-none focus:ring-2 focus:ring-rose-500/50 text-xs font-semibold text-neutral-900 dark:text-white"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={fuelLiters}
                                                    onChange={e => setFuelLiters(e.target.value)}
                                                    placeholder="Fuel (Liters)"
                                                    className="w-full pl-8 pr-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-rose-200/80 dark:border-rose-900/40 outline-none focus:ring-2 focus:ring-rose-500/50 text-xs font-semibold text-neutral-900 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Mileage Preview */}
                                    {selectedVehicle && odometer && fuelLiters && (
                                        <div className="flex justify-between items-center text-[10.5px] px-1 pt-0.5 text-rose-700 dark:text-rose-300 font-medium">
                                            <span>Last: <b>{selectedVehicle.current_odometer} km</b></span>
                                            <span className="bg-rose-100/80 dark:bg-rose-900/40 px-2 py-0.5 rounded-md font-bold">
                                                Est: {((parseFloat(odometer) - selectedVehicle.current_odometer) / parseFloat(fuelLiters)).toFixed(1)} km/L
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Description with AI Auto Refine (Positioned at the very bottom) */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[11px] font-extrabold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                        Description
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleEnhanceDescription}
                                        disabled={isEnhancingDescription}
                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer p-0 bg-transparent border-none"
                                        title="Auto-Refine description with AI"
                                    >
                                        {isEnhancingDescription ? (
                                            <>
                                                <Loader className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                                <span>Refining...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CustomAiSparkleIcon className="w-3.5 h-3.5 drop-shadow-xs" />
                                                <span>Auto refine</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                <div className="relative">
                                    <AlignLeft className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                                    <input 
                                        type="text"
                                        value={description}
                                        onChange={(e) => {
                                            setDescription(e.target.value);
                                            if (autoCategorizeError) setAutoCategorizeError(null);
                                            if (autoRefineError) setAutoRefineError(null);
                                        }}
                                        placeholder="Add note or description (optional)..."
                                        className="w-full pl-10 pr-3 py-2.5 rounded-2xl bg-neutral-50 dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.08] outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs sm:text-sm font-medium text-neutral-900 dark:text-white placeholder-neutral-400"
                                    />
                                </div>
                                {autoRefineError && (
                                    <div className="px-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 animate-fade-in-up flex items-center gap-1.5 pt-0.5">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                                        <span>{autoRefineError}</span>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons / Inline Discard Confirmation */}
                            {showDiscardConfirm ? (
                                <div className="pt-3 border-t border-neutral-100 dark:border-white/[0.06] animate-fade-in-up space-y-3">
                                    <div className="flex flex-col gap-1 text-rose-500 dark:text-rose-400 px-1">
                                        <div className="flex items-start gap-2.5">
                                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <p className="font-extrabold text-neutral-900 dark:text-white text-xs mt-0.5">Discard unsaved changes?</p>
                                        </div>
                                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">All entered transaction inputs will be cleared.</p>
                                    </div>
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowDiscardConfirm(false)}
                                            className="px-4 py-2.5 text-xs sm:text-sm font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-white/[0.05] dark:hover:bg-white/10 rounded-2xl transition-all cursor-pointer select-none"
                                        >
                                            Keep Editing
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDiscardConfirm(false);
                                                resetForm();
                                                onClose();
                                            }}
                                            className="px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-2xl transition-all shadow-md cursor-pointer select-none"
                                        >
                                            Yes, Discard
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-white/[0.06]">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="px-4 py-2.5 text-xs sm:text-sm font-bold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100/80 hover:bg-neutral-200/80 dark:bg-white/[0.05] dark:hover:bg-white/10 rounded-2xl transition-all cursor-pointer select-none"
                                    >
                                        Discard
                                    </button>
                                    
                                    <button 
                                        type="submit" 
                                        disabled={isSaving}
                                        className="group relative flex items-center justify-center gap-2 px-6 py-2.5 bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-black font-extrabold text-xs sm:text-sm rounded-2xl overflow-hidden transition-all shadow-md hover:shadow-xl active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer select-none"
                                    >
                                        <div className={`absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full ${!isSaving && 'group-hover:translate-x-full'} transition-transform duration-700`} />
                                        {isSaving ? (
                                            <Loader className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4 shrink-0" />
                                        )}
                                        <span>{isSaving ? 'Saving...' : initialData ? 'Update Record' : 'Save Record'}</span>
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>

            {/* Category Full Grid Modal Overlay */}
            {showAllCategories && (
                <div className="fixed inset-0 z-[70] bg-[#F9F6F2] dark:bg-black flex flex-col animate-fade-in-up">
                    <div className="px-5 py-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-white/70 dark:bg-white/[0.03] backdrop-blur-md">
                        <div>
                            <h3 className="font-extrabold text-base sm:text-lg text-neutral-900 dark:text-white">All Categories</h3>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Select a category for {type}</p>
                        </div>
                        <button 
                            onClick={() => setShowAllCategories(false)} 
                            className="p-2 rounded-full bg-neutral-200/70 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {/* Search Bar in Category Modal */}
                    <div className="px-5 py-3 border-b border-neutral-200 dark:border-white/10 flex items-center bg-white/40 dark:bg-white/[0.02]">
                        <Search className="w-4 h-4 text-neutral-400 shrink-0 mr-3 pointer-events-none" />
                        <input 
                            ref={categorySearchRef}
                            type="text"
                            value={categorySearchQuery}
                            onChange={(e) => setCategorySearchQuery(e.target.value)}
                            placeholder="Search categories..."
                            className="w-full bg-transparent border-none outline-none text-sm font-medium text-neutral-900 dark:text-white placeholder-neutral-400"
                        />
                        {categorySearchQuery && (
                            <button onClick={() => setCategorySearchQuery('')} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 shrink-0 ml-1 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 sm:p-6 max-w-3xl mx-auto w-full">
                        {/* Recent Section */}
                        {!categorySearchQuery && recentTypeCategories.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">Recently Used</h3>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {recentTypeCategories.map(cat => renderCategoryButton(cat, true))}
                                </div>
                            </div>
                        )}

                        {/* All Categories */}
                        <div>
                            {!categorySearchQuery && recentTypeCategories.length > 0 && (
                                <h3 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">All Categories</h3>
                            )}
                            
                            {filteredCategories.length > 0 ? (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 content-start">
                                    {filteredCategories.map(cat => renderCategoryButton(cat, true))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-neutral-400 dark:text-neutral-600 gap-3 text-center">
                                    <p className="text-sm font-medium">No standard category matches "{categorySearchQuery}".</p>
                                    <button 
                                        type="button"
                                        onClick={() => handleTriggerAiCategoryIcon(categorySearchQuery)}
                                        className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
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
                <div className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
                    <div className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white max-w-sm w-full rounded-3xl p-6 shadow-2xl relative z-10 text-left">
                        <div className="flex items-center gap-3.5 mb-3.5">
                            {(() => {
                                const iconName = aiSuggestion?.iconName || 'Tag';
                                const IconComp = LUCIDE_ICON_MAP[iconName] || LUCIDE_ICON_MAP.Tag || Tag;
                                return (
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0 shadow-sm">
                                        <IconComp className="w-6 h-6" />
                                    </div>
                                );
                            })()}
                            <div>
                                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                                    {aiSuggestion?.isExisting ? "Approve Category Selection" : "Save Custom Category"}
                                </h3>
                                <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                                    "{aiPendingName}"
                                </p>
                            </div>
                        </div>

                        {aiSuggestion?.reason && (
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-5 leading-relaxed bg-neutral-50 dark:bg-white/[0.02] p-3 rounded-xl border border-neutral-100 dark:border-white/[0.04]">
                                <span className="font-bold text-neutral-800 dark:text-neutral-200">AI Context: </span>
                                {aiSuggestion.reason}
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setIsAiModalOpen(false)}
                                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-400 font-bold transition-colors cursor-pointer"
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
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                            >
                                {isApproveLoading ? (
                                    <Loader className="w-3.5 h-3.5 animate-spin" />
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
                    setSelectedVehicleId(newVehicle.id);
                }}
                onUpdateVehicle={handleUpdateVehicle}
                onDeleteVehicle={handleDeleteVehicle}
            />
        </div>
    );
};

const TransactionModal = React.memo(TransactionModalComponent, (prevProps, nextProps) => {
    return (
        prevProps.isOpen === nextProps.isOpen &&
        prevProps.isSaving === nextProps.isSaving &&
        prevProps.initialData?.id === nextProps.initialData?.id &&
        prevProps.initialData?.amount === nextProps.initialData?.amount &&
        prevProps.initialData?.category === nextProps.initialData?.category &&
        prevProps.initialData?.description === nextProps.initialData?.description &&
        prevProps.initialData?.payment_method === nextProps.initialData?.payment_method &&
        prevProps.initialData?.transaction_date === nextProps.initialData?.transaction_date &&
        prevProps.user?.id === nextProps.user?.id &&
        JSON.stringify(prevProps.recentCategoryIds) === JSON.stringify(nextProps.recentCategoryIds)
    );
});

export default TransactionModal;
