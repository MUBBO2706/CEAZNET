import React, { useState, useEffect, useRef } from 'react';
import { DairyItem, DairyEntry, DairyPayment } from '../../types';
import { getDairyItems, saveDairyItem, deleteDairyItem, getDairyEntries, saveDairyEntry, deleteDairyEntry, getDairyPayments, saveDairyPayment, deleteDairyPayment, exportDairyData, importDairyData } from '../../services/dbService';
import { Plus, Calendar, Milk, Newspaper, Droplet, Package, TrendingUp, Clock, CalendarDays, Activity, DollarSign, BarChart3, ChevronDown, Upload, Download, Trash2, CheckCircle2, FileText, FileDown, Edit2 } from 'lucide-react';
import DairyCalendar from './DairyCalendar';
import DairyStats from './DairyStats';
import { v4 as uuidv4 } from 'uuid';
import DairyEntryModal from './DairyEntryModal';
import DairyPaymentModal from './DairyPaymentModal';
import DairyItemModal from './DairyItemModal';
import ConfirmationModal from '../ConfirmationModal';
import DairyExportModal from './DairyExportModal';
import DairyPdfExportModal from './DairyPdfExportModal';
import { useAuth } from '../../hooks/useAuth';
import { allocatePayments } from '../../utils/dairyUtils';
import { useLocation, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ICONS_SVG = {
    qty: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    rupee: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    alert: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    activity: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    trendingUp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`
};

const svgToPng = (svgString: string, colorHex: string): Promise<string> => {
    return new Promise((resolve) => {
        const coloredSvg = svgString.replace('currentColor', colorHex);
        const blob = new Blob([coloredSvg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 48;
            canvas.height = 48;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, 48, 48);
                resolve(canvas.toDataURL('image/png'));
            } else {
                resolve('');
            }
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve('');
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
};

const CARD_THEMES = [
    {
        name: 'Ocean',
        bg: 'bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-blue-950/40 dark:via-gray-900 dark:to-cyan-950/40',
        border: 'border-blue-100 dark:border-blue-800/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        barColor: 'bg-blue-500',
        textColor: 'text-blue-700 dark:text-blue-300',
        accentColor: 'text-blue-600 dark:text-blue-400'
    },
    {
        name: 'Royal',
        bg: 'bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-purple-950/40 dark:via-gray-900 dark:to-pink-950/40',
        border: 'border-purple-100 dark:border-purple-800/30',
        iconColor: 'text-purple-600 dark:text-purple-400',
        iconBg: 'bg-purple-100 dark:bg-purple-900/30',
        barColor: 'bg-purple-500',
        textColor: 'text-purple-700 dark:text-purple-300',
        accentColor: 'text-purple-600 dark:text-purple-400'
    },
    {
        name: 'Sunset',
        bg: 'bg-gradient-to-br from-orange-50 via-white to-red-50 dark:from-orange-950/40 dark:via-gray-900 dark:to-red-950/40',
        border: 'border-orange-100 dark:border-orange-800/30',
        iconColor: 'text-orange-600 dark:text-orange-400',
        iconBg: 'bg-orange-100 dark:bg-orange-900/30',
        barColor: 'bg-orange-500',
        textColor: 'text-orange-700 dark:text-orange-300',
        accentColor: 'text-orange-600 dark:text-orange-400'
    },
    {
        name: 'Forest',
        bg: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-emerald-950/40 dark:via-gray-900 dark:to-teal-950/40',
        border: 'border-emerald-100 dark:border-emerald-800/30',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        barColor: 'bg-emerald-500',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        accentColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
        name: 'Rose',
        bg: 'bg-gradient-to-br from-pink-50 via-white to-rose-50 dark:from-pink-950/40 dark:via-gray-900 dark:to-rose-950/40',
        border: 'border-pink-100 dark:border-pink-800/30',
        iconColor: 'text-pink-600 dark:text-pink-400',
        iconBg: 'bg-pink-100 dark:bg-pink-900/30',
        barColor: 'bg-pink-500',
        textColor: 'text-pink-700 dark:text-pink-300',
        accentColor: 'text-pink-600 dark:text-pink-400'
    },
    {
        name: 'Teal',
        bg: 'bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-teal-950/40 dark:via-gray-900 dark:to-cyan-950/40',
        border: 'border-teal-100 dark:border-teal-800/30',
        iconColor: 'text-teal-600 dark:text-teal-400',
        iconBg: 'bg-teal-100 dark:bg-teal-900/30',
        barColor: 'bg-teal-500',
        textColor: 'text-teal-700 dark:text-teal-300',
        accentColor: 'text-teal-600 dark:text-teal-400'
    }
];

interface DairyViewProps {
    setDairyHeaderState?: React.Dispatch<React.SetStateAction<{ 
        title: string | null; 
        onBack?: () => void; 
        onDelete?: () => void;
        onEdit?: () => void;
        onImport?: () => void;
        onExport?: () => void;
    }>>;
    isSuspended?: boolean;
}

const DairyView: React.FC<DairyViewProps> = ({ setDairyHeaderState, isSuspended }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<DairyItem[]>([]);
    const [selectedItem, setSelectedItem] = useState<DairyItem | null>(null);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<DairyPayment | null>(null);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [exportPreselectedItemId, setExportPreselectedItemId] = useState<string | null>(null);
    const [entries, setEntries] = useState<DairyEntry[]>([]);
    const [payments, setPayments] = useState<DairyPayment[]>([]);
    const [viewMode, setViewMode] = useState<'dashboard' | 'detail'>('dashboard');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    
    const location = useLocation();
    const navigate = useNavigate();
    
    const urlItemId = React.useMemo(() => {
        const parts = location.pathname.split('/');
        if (parts.length >= 3 && parts[1] === 'dairy') {
            return parts[2];
        }
        return null;
    }, [location.pathname]);

    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [summaryMonth, setSummaryMonth] = useState<number>(new Date().getMonth());
    const [summaryYear, setSummaryYear] = useState<number>(new Date().getFullYear());
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const triggerImport = () => {
        if (isSuspended) {
            alert("Import blocked: Account suspended.");
            return;
        }
        fileInputRef.current?.click();
    };

    const openExportModal = (itemId: string | null = null) => {
        setExportPreselectedItemId(itemId);
        setIsExportModalOpen(true);
    };

    useEffect(() => {
        loadData();
        if (setDairyHeaderState) {
            setDairyHeaderState({ 
                title: null,
                onImport: triggerImport,
                onExport: () => openExportModal(null)
            });
        }
        return () => {
             if (setDairyHeaderState) setDairyHeaderState({ title: null });
        };
    }, [user?.id]);

    const loadData = async () => {
        setItems(await getDairyItems(user));
        setEntries(await getDairyEntries(user));
        setPayments(await getDairyPayments(user));
        setDataLoaded(true);
    };

    useEffect(() => {
        if (!dataLoaded) return;
        
        if (urlItemId) {
            const item = items.find(i => i.id === urlItemId);
            if (item) {
                if (selectedItem?.id !== urlItemId || viewMode !== 'detail') {
                    handleSelectItem(item, true);
                }
            } else {
                navigate('/404', { replace: true });
            }
        } else if (!urlItemId && viewMode === 'detail' && selectedItem) {
            handleBackToDashboard(true);
        }
    }, [urlItemId, dataLoaded, items, selectedItem, viewMode, navigate, user]);

    const handleAddItem = async (item: DairyItem) => {
        if (isSuspended) {
            alert("Save blocked: Account suspended.");
            return;
        }
        await saveDairyItem(item, user);
        await loadData();
        if (selectedItem?.id === item.id) {
            setSelectedItem(item);
            if (setDairyHeaderState) {
                setDairyHeaderState(prev => prev ? { ...prev, title: item.name } : { title: item.name, onBack: handleBackToDashboard, onDelete: () => confirmDelete(item.id), onEdit: () => setIsItemModalOpen(true) });
            }
        }
        setIsItemModalOpen(false);
    };

    const confirmDelete = (id: string) => {
        setItemToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteItem = async () => {
        if (isSuspended) {
            alert("Delete blocked: Account suspended.");
            return;
        }
        if (itemToDelete) {
            await deleteDairyItem(itemToDelete, user);
            loadData();
            if (selectedItem?.id === itemToDelete) {
                setSelectedItem(null);
                setViewMode('dashboard');
                if (setDairyHeaderState) {
                    setDairyHeaderState({ 
                        title: null,
                        onImport: triggerImport,
                        onExport: () => openExportModal(null)
                    });
                }
            }
            setItemToDelete(null);
            setIsDeleteModalOpen(false);
        }
    };

    const handleDeleteEntry = async (id: string) => {
        if (isSuspended) {
            alert("Delete entry blocked: Account suspended.");
            return;
        }
        await deleteDairyEntry(id, user);
        await loadData();
        setIsEntryModalOpen(false);
    };

    const handleBackToDashboard = (fromUrl?: boolean) => {
        setSelectedItem(null);
        setViewMode('dashboard');
        if (setDairyHeaderState) {
            setDairyHeaderState({ 
                title: null,
                onImport: triggerImport,
                onExport: () => openExportModal(null)
            });
        }
        if (!fromUrl && location.pathname.startsWith('/dairy/')) {
            navigate('/dairy');
        }
    };

    const handleSelectItem = (item: DairyItem, fromUrl?: boolean) => {
        setSelectedItem(item);
        setViewMode('detail');
        if (setDairyHeaderState) {
            setDairyHeaderState({
                title: item.name,
                onBack: handleBackToDashboard,
                onDelete: () => confirmDelete(item.id),
                onEdit: () => setIsItemModalOpen(true)
            });
        }
        if (!fromUrl) {
            navigate(`/dairy/${item.id}`);
        }
    };

    const getIcon = (name: string, className: string = "w-6 h-6") => {
        const lower = name.toLowerCase();
        if (lower.includes('milk') || lower.includes('dudh')) return <Milk className={className} />;
        if (lower.includes('paper') || lower.includes('news') || lower.includes('akhbar')) return <Newspaper className={className} />;
        if (lower.includes('water') || lower.includes('pani') || lower.includes('jal')) return <Droplet className={className} />;
        if (lower.includes('wifi') || lower.includes('internet') || lower.includes('net')) return <Activity className={className} />;
        if (lower.includes('gym') || lower.includes('fitness') || lower.includes('workout')) return <Activity className={className} />;
        if (lower.includes('rent') || lower.includes('kiraya')) return <CalendarDays className={className} />;
        return <Package className={className} />;
    };

    const handleQuickAdd = async (e: React.MouseEvent, item: DairyItem) => {
        e.stopPropagation(); // Prevent opening the detail view
        if (isSuspended) {
            alert("Quick add blocked: Account suspended.");
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        
        // Check if entry already exists for today
        const existingEntry = entries.find(entry => entry.itemId === item.id && entry.date === today);
        if (existingEntry) {
            alert('An entry already exists for today. Please edit it from the calendar view.');
            return;
        }

        const qty = item.defaultQuantity || 1;
        const pPerUnit = item.defaultPrice / qty;

        const newEntry: DairyEntry = {
            id: uuidv4(),
            itemId: item.id,
            date: today,
            quantity: qty,
            pricePerUnit: pPerUnit,
            totalPrice: item.defaultPrice,
            isPaid: false,
            createdAt: new Date().toISOString()
        };
        
        await saveDairyEntry(newEntry, user);
        loadData();
    };

    const handleExport = async (options: { itemId?: string; startDate?: string; endDate?: string }) => {
        const dataStr = await exportDairyData(user, options);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dairy_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSuspended) {
            alert("Import blocked: Account suspended.");
            return;
        }
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        
        // Prevent accidental navigation/refresh
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                try {
                    const success = await importDairyData(content, user);
                    if (success) {
                        loadData();
                        alert('Data imported successfully!');
                    } else {
                        alert('Failed to import data. Please ensure the file is a valid JSON backup.');
                    }
                } catch (error) {
                    console.error("Import failed", error);
                    alert('An error occurred during import.');
                } finally {
                    setIsImporting(false);
                    window.removeEventListener('beforeunload', handleBeforeUnload);
                }
            }
        };
        reader.readAsText(file);
        // Reset the input so the same file can be uploaded again if needed
        e.target.value = '';
    };

    const handleDownloadPDF = async (options: { rangeType: 'all' | 'specific_month' | 'custom'; month?: number; year?: number; startDate?: string; endDate?: string }) => {
        if (!selectedItem) return;

        const doc = new jsPDF();
        
        const itemEntries = entries.filter(e => e.itemId === selectedItem.id);
        const itemPayments = payments.filter(p => p.itemId === selectedItem.id);
        const allocatedEntries = allocatePayments(itemEntries, itemPayments);
        
        let filteredEntries = allocatedEntries;
        let reportTitle = `${selectedItem.name} Report`;

        if (options.rangeType === 'specific_month' && options.month !== undefined && options.year !== undefined) {
            filteredEntries = allocatedEntries.filter(e => 
                new Date(e.date).getMonth() === options.month &&
                new Date(e.date).getFullYear() === options.year
            );
            const monthName = new Date(options.year, options.month).toLocaleString('default', { month: 'long', year: 'numeric' });
            reportTitle = `${selectedItem.name} - ${monthName}`;
        } else if (options.rangeType === 'custom' && options.startDate && options.endDate) {
            const start = new Date(options.startDate).getTime();
            const end = new Date(options.endDate).getTime();
            filteredEntries = allocatedEntries.filter(e => {
                const entryTime = new Date(e.date).getTime();
                return entryTime >= start && entryTime <= end;
            });
            reportTitle = `${selectedItem.name} - Custom Range`;
        } else {
            reportTitle = `${selectedItem.name} - All Time`;
        }

        filteredEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let totalQty = 0;
        let totalCost = 0;
        let totalPaid = 0;

        const tableColumn = ["Date", "Quantity", "Price/Unit", "Total", "Status", "Notes"];
        const tableRows: any[] = [];

        filteredEntries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
            const qty = `${entry.quantity}\xA0${selectedItem.unit}`;
            const price = `Rs.\xA0${entry.pricePerUnit}`;
            const total = `Rs.\xA0${entry.totalPrice}`;
            const status = entry.isFullyPaid ? 'Paid' : (entry.paidAmount > 0 ? `Partial\xA0(Rs.\xA0${entry.paidAmount})` : 'Unpaid');
            const notes = entry.notes || '-';
            
            totalQty += entry.quantity;
            totalCost += entry.totalPrice;
            totalPaid += entry.paidAmount;

            tableRows.push([date, qty, price, total, status, notes]);
        });

        tableRows.push([
            "Total",
            `${totalQty}\xA0${selectedItem.unit}`,
            "-",
            `Rs.\xA0${totalCost}`,
            `Paid:\xA0Rs.\xA0${totalPaid}`,
            "-"
        ]);

        // --- PDF DRAWING ---
        let currentY = 0;

        // Pre-generate icon PNGs
        const icons = {
            qty: await svgToPng(ICONS_SVG.qty, '#ffffff'),
            rupee: await svgToPng(ICONS_SVG.rupee, '#ffffff'),
            check: await svgToPng(ICONS_SVG.check, '#ffffff'),
            alert: await svgToPng(ICONS_SVG.alert, '#ffffff'),
            calendar: await svgToPng(ICONS_SVG.calendar, '#ffffff'),
            activity: await svgToPng(ICONS_SVG.activity, '#ffffff'),
            trendingUp: await svgToPng(ICONS_SVG.trendingUp, '#ffffff'),
            tag: await svgToPng(ICONS_SVG.tag, '#ffffff'),
        };

        const darkIcons = {
            calendar: await svgToPng(ICONS_SVG.calendar, '#4b5563'),
            qty: await svgToPng(ICONS_SVG.qty, '#4b5563'),
            rupee: await svgToPng(ICONS_SVG.rupee, '#4b5563'),
            check: await svgToPng(ICONS_SVG.check, '#059669'),
            alert: await svgToPng(ICONS_SVG.alert, '#dc2626'),
            partial: await svgToPng(ICONS_SVG.activity, '#d97706'),
            fileText: await svgToPng(ICONS_SVG.fileText, '#4b5563'),
            tag: await svgToPng(ICONS_SVG.tag, '#4b5563'),
        };

        // 1. Header Background
        doc.setFillColor(30, 58, 138); // blue-900
        doc.rect(0, 0, 210, 30, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(reportTitle, 14, 16);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 220, 220);
        doc.text(`Default Price: Rs. ${selectedItem.defaultPrice} / ${selectedItem.unit}`, 14, 24);
        doc.text(`Default Quantity: ${selectedItem.defaultQuantity || 1} ${selectedItem.unit}`, 70, 24);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}`, 155, 24);
        
        currentY = 38;

        // 2. Summary Cards (2 rows of 4 cards)
        const cardWidth = 42;
        const cardHeight = 22;
        const startX = 14;
        const gap = 4.6;
        
        const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, bgColor: number[], titleColor: number[], valColor: number[], iconData: string) => {
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.roundedRect(x, y, w, h, 2, 2, 'F');
            
            // Icon circle
            doc.setFillColor(titleColor[0], titleColor[1], titleColor[2]);
            doc.circle(x + 7, y + 7, 4, 'F');
            
            if (iconData) {
                doc.addImage(iconData, 'PNG', x + 4.5, y + 4.5, 5, 5);
            }

            doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(title, x + 14, y + 8.5);
            
            doc.setTextColor(valColor[0], valColor[1], valColor[2]);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(value, x + 6, y + 18);
        };

        // Row 1
        drawCard(startX, currentY, cardWidth, cardHeight, "Total Quantity", `${totalQty} ${selectedItem.unit}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.qty);
        drawCard(startX + cardWidth + gap, currentY, cardWidth, cardHeight, "Total Bill", `Rs. ${totalCost}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.rupee);
        drawCard(startX + (cardWidth + gap)*2, currentY, cardWidth, cardHeight, "Cleared", `Rs. ${totalPaid}`, [236, 253, 245], [16, 185, 129], [5, 150, 105], icons.check);
        drawCard(startX + (cardWidth + gap)*3, currentY, cardWidth, cardHeight, "Pending", `Rs. ${totalCost - totalPaid}`, [254, 242, 242], [239, 68, 68], [220, 38, 38], icons.alert);
        
        currentY += cardHeight + gap;

        // Calculate extra stats
        const dailyData: Record<string, number> = {};
        filteredEntries.forEach(e => {
            const d = new Date(e.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
            dailyData[d] = (dailyData[d] || 0) + e.quantity;
        });
        const labels = Object.keys(dailyData);
        const values = Object.values(dailyData);
        const maxVal = values.length > 0 ? Math.max(...values) : 0;
        const totalDays = labels.length;
        const avgQty = totalDays > 0 ? (totalQty / totalDays).toFixed(1) : '0';
        const avgPrice = totalQty > 0 ? (totalCost / totalQty).toFixed(1) : '0';

        // Row 2
        drawCard(startX, currentY, cardWidth, cardHeight, "Days Tracked", `${totalDays} Days`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.calendar);
        drawCard(startX + cardWidth + gap, currentY, cardWidth, cardHeight, "Avg Daily Qty", `${avgQty} ${selectedItem.unit}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.activity);
        drawCard(startX + (cardWidth + gap)*2, currentY, cardWidth, cardHeight, "Max Daily Qty", `${maxVal} ${selectedItem.unit}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.trendingUp);
        drawCard(startX + (cardWidth + gap)*3, currentY, cardWidth, cardHeight, "Avg Price/Unit", `Rs. ${avgPrice}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.tag);

        currentY += cardHeight + 12;

        // 3. Payment Status Bar (Horizontal Stacked Bar)
        if (totalCost > 0) {
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text("Payment Status", 14, currentY);
            currentY += 6;

            const barW = 182;
            const barH = 6;
            const paidRatio = totalPaid / totalCost;
            const paidW = barW * paidRatio;
            const pendingW = barW - paidW;

            // Paid part
            if (paidW > 0) {
                doc.setFillColor(16, 185, 129); // emerald-500
                doc.rect(14, currentY, paidW, barH, 'F');
            }
            // Pending part
            if (pendingW > 0) {
                doc.setFillColor(239, 68, 68); // red-500
                doc.rect(14 + paidW, currentY, pendingW, barH, 'F');
            }

            // Legend
            currentY += barH + 6;
            doc.setFillColor(16, 185, 129);
            doc.circle(16, currentY - 1, 2, 'F');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'normal');
            doc.text(`Cleared (${Math.round(paidRatio*100)}%)`, 20, currentY);

            doc.setFillColor(239, 68, 68);
            doc.circle(60, currentY - 1, 2, 'F');
            doc.text(`Pending (${Math.round((1-paidRatio)*100)}%)`, 64, currentY);

            currentY += 12;
        }

        // 4. Line Chart (Daily Quantity Trend)
        if (filteredEntries.length > 0) {
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text("Daily Quantity Trend", 14, currentY);
            currentY += 8;
            
            const chartHeight = 35;
            const chartWidth = 182;
            const chartX = 14;
            const chartY = currentY;
            
            // Draw Y-axis labels
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(maxVal.toString(), chartX - 2, chartY + 3, { align: 'right' });
            doc.text((maxVal/2).toFixed(1), chartX - 2, chartY + chartHeight/2 + 3, { align: 'right' });
            doc.text("0", chartX - 2, chartY + chartHeight + 3, { align: 'right' });
            
            // Draw axes and grid lines
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.5);
            doc.line(chartX, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight); // X axis
            doc.line(chartX, chartY, chartX, chartY + chartHeight); // Y axis
            
            doc.setDrawColor(240, 240, 240);
            doc.line(chartX, chartY + chartHeight/2, chartX + chartWidth, chartY + chartHeight/2); // Mid grid line
            doc.line(chartX, chartY, chartX + chartWidth, chartY); // Top grid line
            
            const spacing = labels.length > 1 ? (chartWidth - 10) / (labels.length - 1) : 0;
            
            const points = labels.map((label, i) => {
                const val = values[i];
                const x = chartX + 5 + (i * spacing);
                const y = chartY + chartHeight - (maxVal > 0 ? (val / maxVal) * (chartHeight - 5) : 0);
                return { x, y, val, label };
            });

            // Draw line
            if (points.length > 1) {
                doc.setDrawColor(59, 130, 246); // blue-500
                doc.setLineWidth(1.2);
                for (let i = 0; i < points.length - 1; i++) {
                    doc.line(points[i].x, points[i].y, points[i+1].x, points[i+1].y);
                }
            }

            // Draw dots and values
            let lastTextX = -100;
            let lastLabelX = -100;
            
            points.forEach((p, i) => {
                // Draw dot
                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(59, 130, 246);
                doc.setLineWidth(0.5);
                doc.circle(p.x, p.y, 1.5, 'FD');

                // Value text logic
                const isFirst = i === 0;
                const isLast = i === points.length - 1;
                const prev = i > 0 ? points[i-1].val : p.val;
                const next = i < points.length - 1 ? points[i+1].val : p.val;
                const isPeak = p.val > prev && p.val >= next;
                const isValley = p.val < prev && p.val <= next;
                
                let showText = points.length <= 12 || isFirst || isLast || isPeak || isValley;
                
                // Prevent horizontal overlap for values
                if (showText && (p.x - lastTextX < 7) && !isLast) {
                    showText = false; 
                }

                if (showText) {
                    doc.setTextColor(100, 100, 100);
                    doc.setFontSize(7);
                    const yOffset = (isValley && !isPeak && p.y < chartY + chartHeight - 5) ? 4.5 : -2.5;
                    doc.text(p.val.toString(), p.x, p.y + yOffset, { align: 'center' });
                    lastTextX = p.x;
                }

                // X-axis label
                const labelStep = Math.max(1, Math.ceil(labels.length / 7));
                if (i % labelStep === 0 || isLast) {
                    if (p.x - lastLabelX > 12 || (isLast && p.x - lastLabelX > 10)) {
                        doc.setTextColor(150, 150, 150);
                        doc.setFontSize(7);
                        doc.text(p.label, p.x, chartY + chartHeight + 5, { align: 'center' });
                        lastLabelX = p.x;
                    }
                }
            });
            
            currentY += chartHeight + 15;
        }

        // Check if we need a new page for the table
        if (currentY > 240) {
            doc.addPage();
            currentY = 20;
        }

        // 5. Table
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Detailed Records", 14, currentY);
        currentY += 4;

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: currentY,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 }, minCellHeight: 5, overflow: 'ellipsize' },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 14 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 23 },
                5: { cellWidth: 'auto' }
            },
            headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            didParseCell: function(data) {
                if (data.section === 'body') {
                    if (data.row.index === tableRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [229, 231, 235]; // gray-200
                    } else {
                        if (data.column.index >= 0 && data.column.index <= 5) {
                            data.cell.styles.cellPadding = { top: 1.5, right: 1.5, bottom: 1.5, left: 4.5 };
                        }
                        if (data.column.index === 4) {
                            // Status column styling
                            const text = data.cell.raw as string;
                            if (text === 'Paid') {
                                data.cell.styles.textColor = [5, 150, 105]; // emerald-600
                                data.cell.styles.fontStyle = 'bold';
                            } else if (text === 'Unpaid') {
                                data.cell.styles.textColor = [220, 38, 38]; // red-600
                                data.cell.styles.fontStyle = 'bold';
                            } else if (text.startsWith('Partial')) {
                                data.cell.styles.textColor = [217, 119, 6]; // amber-600
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                } else if (data.section === 'head') {
                    if (data.column.index >= 0 && data.column.index <= 5) {
                        data.cell.styles.cellPadding = { top: 1.5, right: 1.5, bottom: 1.5, left: 4.5 };
                    }
                }

                // Dynamic font size shrinking
                const text = String(data.cell.raw);
                if (text && text !== '-') {
                    const cw: Record<number, number> = {0: 15.5, 1: 7.5, 2: 13.5, 3: 13.5, 4: 16.5};
                    if (cw[data.column.index] !== undefined) {
                        let fs = 7;
                        while (fs > 4) {
                            doc.setFontSize(fs);
                            doc.setFont('helvetica', data.section === 'head' || (data.section === 'body' && data.row.index === tableRows.length - 1) ? 'bold' : 'normal');
                            if (doc.getTextWidth(text) <= cw[data.column.index]) break;
                            fs -= 0.5;
                        }
                        data.cell.styles.fontSize = fs;
                    }
                }
            },
            didDrawCell: function(data) {
                if (data.section === 'body' && data.row.index !== tableRows.length - 1) {
                    const iconSize = 2;
                    const padding = 1.25;
                    if (data.column.index === 0 && darkIcons.calendar) {
                        doc.addImage(darkIcons.calendar, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.4, iconSize, iconSize);
                    } else if (data.column.index === 1 && darkIcons.qty) {
                        doc.addImage(darkIcons.qty, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.4, iconSize, iconSize);
                    } else if (data.column.index === 2 && darkIcons.tag) {
                        doc.addImage(darkIcons.tag, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.4, iconSize, iconSize);
                    } else if (data.column.index === 3 && darkIcons.rupee) {
                        doc.addImage(darkIcons.rupee, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.4, iconSize, iconSize);
                    } else if (data.column.index === 4) {
                        const text = data.cell.raw as string;
                        let icon = null;
                        if (text === 'Paid') icon = darkIcons.check;
                        else if (text === 'Unpaid') icon = darkIcons.alert;
                        else if (text.startsWith('Partial')) icon = darkIcons.partial;
                        if (icon) {
                            doc.addImage(icon, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.5, iconSize, iconSize);
                        }
                    } else if (data.column.index === 5 && darkIcons.fileText) {
                        doc.addImage(darkIcons.fileText, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.5, iconSize, iconSize);
                    }
                }
            }
        });

        let filteredPayments = itemPayments;
        if (options.rangeType === 'specific_month' && options.month !== undefined && options.year !== undefined) {
            filteredPayments = itemPayments.filter(p => 
                new Date(p.date).getMonth() === options.month &&
                new Date(p.date).getFullYear() === options.year
            );
        } else if (options.rangeType === 'custom' && options.startDate && options.endDate) {
            const start = new Date(options.startDate).getTime();
            const end = new Date(options.endDate).getTime();
            filteredPayments = itemPayments.filter(p => {
                const paymentTime = new Date(p.date).getTime();
                return paymentTime >= start && paymentTime <= end;
            });
        }
        filteredPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const finalY = (doc as any).lastAutoTable.finalY || currentY;
        
        if (filteredPayments.length > 0) {
            let paymentY = finalY + 15;
            if (paymentY > 240) {
                doc.addPage();
                paymentY = 20;
            }
            
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text("Payment History", 14, paymentY);
            
            const paymentColumn = ["Date", "Amount", "Note"];
            const paymentRows: any[] = [];
            
            filteredPayments.forEach(p => {
                paymentRows.push([
                    new Date(p.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
                    `Rs.\xA0${p.amount}`,
                    p.notes || '-'
                ]);
            });
            
            const totalPaymentAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
            paymentRows.push([
                "Total",
                `Rs.\xA0${totalPaymentAmount}`,
                ""
            ]);
            
            autoTable(doc, {
                head: [paymentColumn],
                body: paymentRows,
                startY: paymentY + 4,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 }, minCellHeight: 5, overflow: 'ellipsize' },
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 25 },
                    2: { cellWidth: 'auto' }
                },
                headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                didParseCell: function(data) {
                    if (data.section === 'body') {
                        if (data.row.index === paymentRows.length - 1) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [229, 231, 235]; // gray-200
                        } else if (data.column.index >= 0 && data.column.index <= 2) {
                            data.cell.styles.cellPadding = { top: 1.5, right: 1.5, bottom: 1.5, left: 4.5 };
                        }
                    } else if (data.section === 'head') {
                        if (data.column.index >= 0 && data.column.index <= 2) {
                            data.cell.styles.cellPadding = { top: 1.5, right: 1.5, bottom: 1.5, left: 4.5 };
                        }
                    }

                    // Dynamic font size shrinking
                    const text = String(data.cell.raw);
                    if (text && text !== '-') {
                        const cw: Record<number, number> = {0: 15.5, 1: 18.5};
                        if (cw[data.column.index] !== undefined) {
                            let fs = 7;
                            while (fs > 4) {
                                doc.setFontSize(fs);
                                doc.setFont('helvetica', data.section === 'head' || (data.section === 'body' && data.row.index === paymentRows.length - 1) ? 'bold' : 'normal');
                                if (doc.getTextWidth(text) <= cw[data.column.index]) break;
                                fs -= 0.5;
                            }
                            data.cell.styles.fontSize = fs;
                        }
                    }
                },
                didDrawCell: function(data) {
                    if (data.section === 'body' && data.row.index !== paymentRows.length - 1) {
                        const iconSize = 2;
                        const padding = 1.25;
                        if (data.column.index === 0 && darkIcons.calendar) {
                            doc.addImage(darkIcons.calendar, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.4, iconSize, iconSize);
                        } else if (data.column.index === 1 && darkIcons.rupee) {
                            doc.addImage(darkIcons.rupee, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.4, iconSize, iconSize);
                        } else if (data.column.index === 2 && darkIcons.fileText) {
                            doc.addImage(darkIcons.fileText, 'PNG', data.cell.x + padding, data.cell.y + padding + 0.4, iconSize, iconSize);
                        }
                    }
                }
            });
        }

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${i} of ${pageCount}`, 14, pageHeight - 10);
            doc.text("Generated by Ceaznet - Detailed Financial Breakdown", 210 - 14, pageHeight - 10, { align: 'right' });
        }

        doc.save(`${selectedItem.name}_Report.pdf`);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-black overflow-hidden relative">
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-20 md:pt-24 pb-6">
                {viewMode === 'dashboard' ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {items.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                                    <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Items Yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                                    Start tracking your daily expenses like Milk, Newspaper, or Water delivery.
                                </p>
                            </div>
                        ) : (
                            items.map((item, index) => {
                                const theme = CARD_THEMES[index % CARD_THEMES.length];
                                const itemEntries = entries.filter(e => e.itemId === item.id);
                                const itemPayments = payments.filter(p => p.itemId === item.id);
                                const totalCost = itemEntries.reduce((sum, e) => sum + e.totalPrice, 0);
                                const totalPaid = itemPayments.reduce((sum, p) => sum + p.amount, 0);
                                const due = totalCost - totalPaid;
                                
                                const allocatedEntries = allocatePayments(itemEntries, itemPayments);
                                const unpaidEntries = allocatedEntries.filter(e => !e.isFullyPaid);
                                const currentBill = unpaidEntries.reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0);
                                const currentQuantity = unpaidEntries.reduce((sum, e) => sum + e.quantity, 0);
                                
                                const activeCycleTotal = unpaidEntries.reduce((sum, e) => sum + e.totalPrice, 0);
                                const activeCyclePaid = unpaidEntries.reduce((sum, e) => sum + e.paidAmount, 0);
                                const cycleProgress = activeCycleTotal > 0 ? Math.round((activeCyclePaid / activeCycleTotal) * 100) : 100;

                                // Analytics Calculations
                                const now = new Date();
                                const currentMonth = now.getMonth();
                                const currentYear = now.getFullYear();
                                
                                const thisMonthEntries = itemEntries.filter(e => {
                                    const d = new Date(e.date);
                                    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                                });
                                const thisMonthCost = thisMonthEntries.reduce((sum, e) => sum + e.totalPrice, 0);

                                const lastEntry = itemEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                                const lastEntryDate = lastEntry ? new Date(lastEntry.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Never';

                                // Frequency Calculation
                                const last7DaysEntries = itemEntries.filter(e => {
                                    const d = new Date(e.date);
                                    const diffTime = Math.abs(now.getTime() - d.getTime());
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                                    return diffDays <= 7;
                                });
                                
                                let frequency = 'Inactive';
                                if (last7DaysEntries.length >= 5) frequency = 'Daily';
                                else if (last7DaysEntries.length >= 1) frequency = 'Weekly';
                                else if (itemEntries.length > 0) frequency = 'Irregular';

                                return (
                                    <div 
                                        key={item.id}
                                        onClick={() => handleSelectItem(item)}
                                        className={`group relative rounded-3xl p-6 border shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden ${theme.bg} ${theme.border} select-none`}
                                    >
                                        <div className="relative z-10 flex flex-col h-full">
                                            {/* Header */}
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-14 h-14 rounded-2xl ${theme.iconBg} flex items-center justify-center shadow-inner ring-1 ring-black/5 dark:ring-white/10`}>
                                                        {getIcon(item.name, `w-7 h-7 ${theme.iconColor}`)}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                            {item.name}
                                                        </h3>
                                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                                                            ₹{item.defaultPrice} <span className="text-gray-300 dark:text-gray-600">/</span> {item.defaultQuantity && item.defaultQuantity !== 1 ? `${item.defaultQuantity} ` : ''}{item.unit}
                                                        </p>
                                                    </div>
                                                </div>
                                                
                                                <button
                                                    onClick={(e) => handleQuickAdd(e, item)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 dark:bg-black/20 text-gray-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-all shadow-sm hover:shadow-lg hover:scale-105 active:scale-95 backdrop-blur-sm border border-gray-100 dark:border-white/5"
                                                    title={`Add ${item.defaultQuantity} ${item.unit} for today`}
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Primary Stats (Due & Paid) */}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="p-3 rounded-2xl bg-white/60 dark:bg-black/20 border border-gray-100/50 dark:border-white/5 backdrop-blur-sm">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500 mb-1">Due</p>
                                                    <p className={`text-xl font-black ${due > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                        ₹{due.toFixed(0)}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-2xl bg-white/60 dark:bg-black/20 border border-gray-100/50 dark:border-white/5 backdrop-blur-sm">
                                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 dark:text-gray-500 mb-1">Current Bill</p>
                                                    <p className="text-xl font-black text-gray-700 dark:text-gray-300">
                                                        ₹{currentBill.toFixed(0)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Secondary Analytics Grid */}
                                            <div className="grid grid-cols-3 gap-2 mb-6">
                                                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/40 dark:bg-black/10 border border-gray-100/50 dark:border-white/5 backdrop-blur-sm">
                                                    <TrendingUp className={`w-3.5 h-3.5 mb-1 ${theme.accentColor}`} />
                                                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">This Month</span>
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">₹{thisMonthCost}</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/40 dark:bg-black/10 border border-gray-100/50 dark:border-white/5 backdrop-blur-sm">
                                                    <Clock className={`w-3.5 h-3.5 mb-1 ${theme.accentColor}`} />
                                                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Last Entry</span>
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{lastEntryDate}</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/40 dark:bg-black/10 border border-gray-100/50 dark:border-white/5 backdrop-blur-sm">
                                                    <Activity className={`w-3.5 h-3.5 mb-1 ${theme.accentColor}`} />
                                                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Freq</span>
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{frequency}</span>
                                                </div>
                                            </div>

                                            {/* Footer / Progress */}
                                            <div className="space-y-2 mt-auto">
                                                <div className="flex justify-between text-xs font-medium">
                                                    <span className="text-gray-500 dark:text-gray-400">Cycle Payment Status</span>
                                                    <span className={theme.textColor}>
                                                        {cycleProgress}%
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-gray-200/50 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${theme.barColor} rounded-full transition-all duration-500 ease-out shadow-sm`}
                                                        style={{ width: `${cycleProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        </div>
                    </div>
                ) : (
                    selectedItem && (
                        <div className="space-y-6 max-w-5xl mx-auto">
                            <DairyStats 
                                item={selectedItem} 
                                entries={entries.filter(e => e.itemId === selectedItem.id)}
                                payments={payments.filter(p => p.itemId === selectedItem.id)}
                            />
                            
                            <div className="bg-white dark:bg-[#050505] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg tracking-tight">
                                        <Calendar className="w-5 h-5 text-blue-500" />
                                        Calendar View
                                    </h2>
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={() => {
                                                setSelectedPayment(null);
                                                setIsPaymentModalOpen(true);
                                            }}
                                            className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <DollarSign className="w-4 h-4" />
                                            Record Payment
                                        </button>
                                        <button 
                                            onClick={() => setIsEntryModalOpen(true)}
                                            className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-xl transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Entry
                                        </button>
                                    </div>
                                </div>
                                <DairyCalendar 
                                    item={selectedItem}
                                    entries={entries.filter(e => e.itemId === selectedItem.id)}
                                    payments={payments.filter(p => p.itemId === selectedItem.id)}
                                    onDateClick={(date) => {
                                        setSelectedDate(date);
                                        setIsEntryModalOpen(true);
                                    }}
                                    onPaymentClick={(payment) => {
                                        setSelectedPayment(payment);
                                        setIsPaymentModalOpen(true);
                                    }}
                                />
                            </div>

                            {/* Monthly Report Section */}
                            <div className="bg-white dark:bg-[#050505] rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                    <h2 className="font-bold text-gray-900 dark:text-white text-lg tracking-tight">
                                        Monthly Report
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsPdfModalOpen(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-lg text-sm font-medium transition-colors"
                                            title="Download PDF Report"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span className="hidden sm:inline">Download PDF</span>
                                        </button>
                                        <div className="relative flex-1 sm:flex-none group">
                                            <div className="w-full sm:w-auto flex items-center justify-between pl-3 pr-8 py-1.5 min-w-[120px] bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:border-indigo-500 transition-colors">
                                                {new Date(summaryYear, summaryMonth).toLocaleString('default', { month: 'short', year: '2-digit' })}
                                            </div>
                                            <input 
                                                type="month" 
                                                value={`${summaryYear}-${String(summaryMonth + 1).padStart(2, '0')}`}
                                                onChange={(e) => {
                                                    const [y, m] = e.target.value.split('-');
                                                    setSummaryYear(Number(y));
                                                    setSummaryMonth(Number(m) - 1);
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5">
                                    {(() => {
                                        const itemEntries = entries.filter(e => e.itemId === selectedItem.id);
                                        const itemPayments = payments.filter(p => p.itemId === selectedItem.id);
                                        const allocatedEntries = allocatePayments(itemEntries, itemPayments);
                                        
                                        const monthEntries = allocatedEntries.filter(e => 
                                            new Date(e.date).getMonth() === summaryMonth &&
                                            new Date(e.date).getFullYear() === summaryYear
                                        );

                                        const totalQuantity = monthEntries.reduce((sum, e) => sum + e.quantity, 0);
                                        const totalCost = monthEntries.reduce((sum, e) => sum + e.totalPrice, 0);
                                        const clearedAmount = monthEntries.reduce((sum, e) => sum + e.paidAmount, 0);
                                        const balance = monthEntries.reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0);

                                        return (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-3">
                                                <div className="p-4 md:p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl relative overflow-hidden">
                                                    <div className="absolute top-4 right-4 opacity-20">
                                                        <Package className="w-8 h-8 md:w-5 md:h-5 text-gray-500" />
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Total Quantity</p>
                                                    <p className="text-xl md:text-lg font-bold text-gray-900 dark:text-white relative z-10">
                                                        {totalQuantity} <span className="text-sm font-medium text-gray-500">{selectedItem.unit}</span>
                                                    </p>
                                                </div>
                                                <div className="p-4 md:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl relative overflow-hidden">
                                                    <div className="absolute top-4 right-4 opacity-20">
                                                        <DollarSign className="w-8 h-8 md:w-5 md:h-5 text-blue-500" />
                                                    </div>
                                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Total Bill</p>
                                                    <p className="text-xl md:text-lg font-bold text-blue-700 dark:text-blue-300 relative z-10">
                                                        ₹{totalCost}
                                                    </p>
                                                </div>
                                                <div className="p-4 md:p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl relative overflow-hidden">
                                                    <div className="absolute top-4 right-4 opacity-20">
                                                        <DollarSign className="w-8 h-8 md:w-5 md:h-5 text-emerald-500" />
                                                    </div>
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">Cleared Amount</p>
                                                    <p className="text-xl md:text-lg font-bold text-emerald-700 dark:text-emerald-300 relative z-10">
                                                        ₹{clearedAmount}
                                                    </p>
                                                </div>
                                                <div className={`p-4 md:p-3 rounded-2xl relative overflow-hidden ${balance > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-900/50'}`}>
                                                    <div className="absolute top-4 right-4 opacity-20">
                                                        <DollarSign className={`w-8 h-8 md:w-5 md:h-5 ${balance > 0 ? 'text-red-500' : 'text-gray-500'}`} />
                                                    </div>
                                                    <p className={`text-xs font-medium mb-1 ${balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        Unpaid Amount
                                                    </p>
                                                    <p className={`text-xl md:text-lg font-bold relative z-10 ${balance > 0 ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                                                        ₹{balance}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* Floating Action Button for Dashboard */}
            {viewMode === 'dashboard' && (
                <button
                    onClick={() => setIsItemModalOpen(true)}
                    className="absolute bottom-6 right-6 p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 z-20 group"
                    aria-label="Add New Khata"
                >
                    <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
            )}

            {/* Loading Overlay */}
            {isImporting && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white dark:bg-[#050505] p-6 rounded-2xl shadow-xl flex flex-col items-center border border-gray-200 dark:border-gray-800">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-900 dark:text-white font-medium">Importing Data...</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please do not close or refresh the page.</p>
                    </div>
                </div>
            )}

            {/* Modals */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                }}
                onConfirm={handleDeleteItem}
                title="Delete Khata"
                message="Are you sure you want to delete this khata and all its history? This action cannot be undone."
                confirmButtonText="Delete"
                confirmButtonVariant="danger"
            />

            {isItemModalOpen && (
                <DairyItemModal 
                    isOpen={isItemModalOpen} 
                    onClose={() => setIsItemModalOpen(false)} 
                    onSave={handleAddItem} 
                    initialItem={selectedItem || undefined}
                />
            )}
            
            <DairyExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                items={items}
                preselectedItemId={exportPreselectedItemId}
                onExport={handleExport}
            />

            {selectedItem && isEntryModalOpen && (
                <DairyEntryModal
                    isOpen={isEntryModalOpen}
                    onClose={() => setIsEntryModalOpen(false)}
                    item={selectedItem}
                    initialDate={selectedDate}
                    initialEntry={entries.find(e => e.itemId === selectedItem.id && e.date === selectedDate)}
                    onSave={async (entry) => {
                        if (isSuspended) {
                            alert("Save entry blocked: Account suspended.");
                            return;
                        }
                        await saveDairyEntry(entry, user);
                        
                        // If marked as paid immediately, create a corresponding payment record
                        if (entry.isPaid) {
                            // Check if a payment for this exact entry already exists to avoid duplicates
                            const existingPayment = payments.find(p => p.itemId === entry.itemId && p.date === entry.date && p.amount === entry.totalPrice);
                            if (!existingPayment) {
                                const newPayment: DairyPayment = {
                                    id: uuidv4(),
                                    itemId: entry.itemId,
                                    date: entry.date,
                                    amount: entry.totalPrice,
                                    notes: `Auto-recorded for entry on ${entry.date}`,
                                    createdAt: new Date().toISOString()
                                };
                                await saveDairyPayment(newPayment, user);
                            }
                        }
                        
                        await loadData();
                        setIsEntryModalOpen(false);
                    }}
                    onDelete={handleDeleteEntry}
                />
            )}

            {selectedItem && isPaymentModalOpen && (
                <DairyPaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => {
                        setIsPaymentModalOpen(false);
                        setSelectedPayment(null);
                    }}
                    item={selectedItem}
                    entries={entries.filter(e => e.itemId === selectedItem.id)}
                    payments={payments.filter(p => p.itemId === selectedItem.id)}
                    initialPayment={selectedPayment || undefined}
                    onSave={async (payment, updatedEntries) => {
                        if (isSuspended) {
                            alert("Save payment blocked: Account suspended.");
                            return;
                        }
                        // Save all updated entries if any
                        if (updatedEntries && updatedEntries.length > 0) {
                            await Promise.all(updatedEntries.map(entry => saveDairyEntry(entry, user)));
                        }
                        await saveDairyPayment(payment, user);
                        await loadData();
                        setIsPaymentModalOpen(false);
                        setSelectedPayment(null);
                    }}
                    onDelete={async (id) => {
                        if (isSuspended) {
                            alert("Delete payment blocked: Account suspended.");
                            return;
                        }
                        // Find any entries linked to this payment and unmark them
                        const linkedEntries = entries.filter(e => e.paymentId === id);
                        if (linkedEntries.length > 0) {
                            await Promise.all(linkedEntries.map(entry => {
                                const { paymentId: _, ...rest } = entry;
                                return saveDairyEntry({ ...rest, isPaid: false }, user);
                            }));
                        }
                        
                        await deleteDairyPayment(id, user);
                        await loadData();
                        setIsPaymentModalOpen(false);
                        setSelectedPayment(null);
                    }}
                />
            )}

            {/* Hidden File Input */}
            <input 
                ref={fileInputRef}
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={handleImport} 
            />

            {selectedItem && isPdfModalOpen && (
                <DairyPdfExportModal
                    isOpen={isPdfModalOpen}
                    onClose={() => setIsPdfModalOpen(false)}
                    item={selectedItem}
                    onExport={handleDownloadPDF}
                />
            )}
        </div>
    );
};

export default DairyView;
