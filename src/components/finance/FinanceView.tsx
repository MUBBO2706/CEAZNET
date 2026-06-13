
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { Transaction, FinanceProfile, Note } from '../../types';
import { getTransactions, saveTransaction, saveTransactionsBulk, deleteTransaction, getFinanceProfiles, saveFinanceProfile, updateFinanceProfile, deleteFinanceProfile } from '../../services/dbService';
import { linkWalletToNote, syncTransactionAdd, syncTransactionUpdate, syncTransactionDelete, fetchLinkedNote, syncAllTransactionsToNote } from '../../services/financeSyncService'; 
import { Plus, Wallet, Download, PieChart, ArrowUpRight, ArrowDownLeft, BarChart3, List, Trash2, X, CheckSquare, ChevronDown, PlusCircle, Edit2, Check, PiggyBank, TrendingUp, FileText, Database, Upload, Link as LinkIcon, Calendar, StickyNote, RefreshCw, Loader2, FileSpreadsheet } from 'lucide-react';
import FinanceCalendar from './FinanceCalendar';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal';
import TransactionDetailPage from './TransactionDetailPage'; 
import BulkImportModal from './BulkImportModal';
import FinanceAnalytics from './FinanceAnalytics';
import FinancialFitnessCard from './FinancialFitnessCard';
import ConfirmationModal from '../ConfirmationModal';
import FileRenameModal from './FileRenameModal';
import NotePickerModal from '../NotePickerModal';
import type { User } from '@supabase/supabase-js';
import { useToast } from '../ToastManager';
import Tooltip from '../Tooltip';

const ICONS_SVG = {
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    fileText: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>`,
    tag: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`,
    creditCard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`,
    trendingUp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
    trendingDown: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`,
    rupee: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/></svg>`,
    wallet: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`
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

interface FinanceViewProps {
    user: User | null;
    onBack: () => void;
    searchQuery?: string;
    isSuspended?: boolean;
}

type DateFilter = 'all' | 'this-month' | string;
type TypeFilter = 'all' | 'income' | 'expense';
type ViewMode = 'list' | 'analytics' | 'calendar';

// Represents the active filter. 'null' means "Default" (legacy transactions).
type ActiveProfileState = FinanceProfile | { id: null, name: 'Main Wallet', type: 'personal', currency: 'INR', created_at: '' };

const DEFAULT_PROFILE: ActiveProfileState = { id: null, name: 'Main Wallet', type: 'personal', currency: 'INR', created_at: '' };

const FinanceView: React.FC<FinanceViewProps> = ({ user, onBack, searchQuery = '', isSuspended }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
    const { addToast } = useToast();
    
    // Profile State
    const [profiles, setProfiles] = useState<FinanceProfile[]>([]);
    const [activeProfile, setActiveProfile] = useState<ActiveProfileState>(DEFAULT_PROFILE);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [isCreatingProfile, setIsCreatingProfile] = useState(false);
    
    // Wallet Counts State
    const [walletCounts, setWalletCounts] = useState<Record<string, number>>({});
    
    // Profile Editing State
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [tempProfileName, setTempProfileName] = useState('');
    const [profileToDelete, setProfileToDelete] = useState<string | null>(null);

    // Sync State
    const [isLinkNoteModalOpen, setIsLinkNoteModalOpen] = useState(false);
    const [profileIdToLink, setProfileIdToLink] = useState<string | null>(null);
    const [linkedNote, setLinkedNote] = useState<Note | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isDataModalOpen, setIsDataModalOpen] = useState(false);
    
    // Export State
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [exportAllDates, setExportAllDates] = useState(false);
    
    // New Rename Export State
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [pendingExportType, setPendingExportType] = useState<'csv' | 'pdf' | 'json' | null>(null);
    const [exportDefaultFilename, setExportDefaultFilename] = useState('');
    
    // VIEWING TRANSACTION STATE (Acts as router for detail page)
    const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
    
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    
    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    
    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

    // Filter States
    const [dateFilter, setDateFilter] = useState<DateFilter>('this-month');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    
    const urlTransactionId = useMemo(() => {
        const parts = location.pathname.split('/');
        if (parts.length >= 3 && parts[1] === 'finance') {
            return parts[2];
        }
        return null;
    }, [location.pathname]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
                setIsMonthDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Budget helper for the Score card
    const budget = useMemo(() => {
        const saved = localStorage.getItem('kalina_monthly_budget');
        return saved ? Number(saved) : 0;
    }, []);

    useEffect(() => {
        loadData();
        loadProfiles();
        updateWalletCounts();
        refreshLinkedNote();
    }, [user?.id]);

    // Reload transactions when profile changes
    useEffect(() => {
        loadData();
        refreshLinkedNote();
    }, [activeProfile.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsProfileDropdownOpen(false);
                setIsCreatingProfile(false);
                setEditingProfileId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadProfiles = async () => {
        try {
            const fetched = await getFinanceProfiles(user);
            setProfiles(fetched);
        } catch (e) {
            console.error("Failed to load profiles", e);
        }
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await getTransactions(user, activeProfile.id);
            setTransactions(data);
            setDataLoaded(true);
        } catch (e) {
            console.error("Failed to load transactions", e);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Add effect for URL loading
    useEffect(() => {
        if (!dataLoaded || isLoading) return;

        if (urlTransactionId) {
            // Check if it's already viewed
            if (viewingTransaction?.id === urlTransactionId) return;

            const tx = transactions.find(t => t.id === urlTransactionId);
            if (tx) {
                // If the transaction belongs to the current active profile
                setViewingTransaction(tx);
            } else {
                // Attempt to see if the transaction might exist in another profile
                // but doing a raw getTransactions here without profile might be required.
                // For simplicity, if not in current wallet, we'll try to find it eventually
                // or redirect to 404. Let's do a redirect if no user or it just doesn't exist
                if (!user) {
                   navigate('/404', { replace: true });
                } else {
                   // Navigate to 404 since it's not present (could improve with cross-profile fetch)
                   navigate('/404', { replace: true });
                }
            }
        } else if (!urlTransactionId && viewingTransaction) {
            setViewingTransaction(null);
        }
    }, [urlTransactionId, dataLoaded, isLoading, transactions, viewingTransaction, navigate, user]);

    const refreshLinkedNote = async () => {
        const note = await fetchLinkedNote(user, activeProfile.id);
        setLinkedNote(note || null);
    };

    const updateWalletCounts = async () => {
        try {
            // Fetch ALL transactions (undefined profileId gets everything)
            const allTransactions = await getTransactions(user, undefined);
            const counts: Record<string, number> = { 'default': 0 };
            
            // Initialize counts for existing profiles
            profiles.forEach(p => counts[p.id] = 0);

            allTransactions.forEach(t => {
                const key = t.profile_id || 'default';
                counts[key] = (counts[key] || 0) + 1;
            });
            
            setWalletCounts(counts);
        } catch (e) {
            console.error("Failed to update wallet counts", e);
        }
    };

    const handleDateClick = (date: string) => {
        setSelectedDate(date);
        setIsCalendarModalOpen(true);
    };

    const handleCreateProfile = async () => {
        if (isSuspended) {
            addToast("Create wallet blocked: Account suspended.", "error");
            return;
        }
        if (!newProfileName.trim()) return;
        const newProfile: FinanceProfile = {
            id: crypto.randomUUID(),
            user_id: user?.id,
            name: newProfileName.trim(),
            type: 'personal',
            currency: 'INR',
            created_at: new Date().toISOString()
        };
        
        await saveFinanceProfile(newProfile, user);
        setProfiles(prev => [...prev, newProfile]);
        setActiveProfile(newProfile);
        addToast(`Wallet "${newProfileName}" created.`, 'success');
        setNewProfileName('');
        setIsCreatingProfile(false);
        setIsProfileDropdownOpen(false);
        updateWalletCounts(); // Init count for new wallet
    };

    const handleUpdateProfile = async (id: string) => {
        if (isSuspended) {
            addToast("Update wallet blocked: Account suspended.", "error");
            return;
        }
        if (!tempProfileName.trim()) return;
        await updateFinanceProfile(id, tempProfileName.trim(), user);
        setProfiles(prev => prev.map(p => p.id === id ? { ...p, name: tempProfileName.trim() } : p));
        if (activeProfile.id === id) {
            setActiveProfile(prev => ({ ...prev, name: tempProfileName.trim() }));
        }
        addToast(`Wallet renamed to "${tempProfileName}".`, 'success');
        setEditingProfileId(null);
        setTempProfileName('');
    };

    const handleDeleteProfile = async () => {
        if (isSuspended) {
            addToast("Delete wallet blocked: Account suspended.", "error");
            return;
        }
        if (!profileToDelete) return;
        
        const idToDelete = profileToDelete;
        setProfileToDelete(null); // Close modal first
        
        try {
            await deleteFinanceProfile(idToDelete, user);
            setProfiles(prev => prev.filter(p => p.id !== idToDelete));
            addToast('Wallet deleted successfully.', 'success');
            
            // If active profile was deleted, switch to default
            if (activeProfile.id === idToDelete) {
                setActiveProfile(DEFAULT_PROFILE);
            }
            updateWalletCounts();
        } catch (e) {
            console.error("Failed to delete profile", e);
            addToast('Failed to delete wallet.', 'error');
        }
    };
    
    // --- SYNC LOGIC VIA SEPARATE SERVICE ---
    
    const initiateNoteLink = (e: React.MouseEvent, profileId: string | null) => {
        e.stopPropagation();
        if (isSuspended) {
            addToast("Link note blocked: Account suspended.", "error");
            return;
        }
        setProfileIdToLink(profileId); // null means default
        setIsLinkNoteModalOpen(true);
        setIsProfileDropdownOpen(false);
    };

    const handleNoteSelectedForSync = async (note: Note) => {
        await linkWalletToNote(user, profileIdToLink, note);
        addToast(`Wallet linked to note: ${note.title || 'Untitled'}`, 'success');
        
        // If we linked the current wallet, update the UI state immediately
        if (profileIdToLink === activeProfile.id) {
            setLinkedNote(note);
        }
        setProfileIdToLink(null);
    };

    const handleSyncAll = async () => {
        if (!linkedNote) {
            addToast("Link a note first to enable syncing.", "warning");
            return;
        }
        
        setIsSyncing(true);
        setIsDataModalOpen(false); // Close data modal if open
        
        try {
            const success = await syncAllTransactionsToNote(user, activeProfile.id, activeProfile.name);
            if (success) {
                addToast("All transactions synced to note successfully.", "success");
                refreshLinkedNote(); // Update note state to reflect changes
            } else {
                addToast("Sync failed. Please try again.", "error");
            }
        } catch (e) {
            addToast("An error occurred during sync.", "error");
        } finally {
            setIsSyncing(false);
        }
    };

    const [isSaving, setIsSaving] = useState(false);

    // Calculate recent categories for quick access
    const recentCategoryIds = useMemo(() => {
        const uniqueCategories = new Set<string>();
        const result: string[] = [];
        // Sort by date descending
        const sorted = [...transactions].sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
        
        for (const t of sorted) {
            if (t.category && !uniqueCategories.has(t.category)) {
                uniqueCategories.add(t.category);
                result.push(t.category);
                if (result.length >= 20) break; // Get top 20 recent
            }
        }
        return result;
    }, [transactions]);

    const handleSave = async (transaction: Transaction) => {
        if (isSuspended) {
            addToast("Save blocked: Account suspended.", "error");
            return;
        }
        if (isSaving) return;
        setIsSaving(true);
        
        try {
            const isEdit = !!editingTransaction;
            
            const transactionWithProfile = {
                ...transaction,
                profile_id: activeProfile.id || undefined 
            };
            
            await saveTransaction(transactionWithProfile, user);
            
            // --- Sync with Notes (Add or Update) ---
            let synced = false;
            if (isEdit) {
                synced = await syncTransactionUpdate(user, transactionWithProfile);
            } else {
                synced = await syncTransactionAdd(user, transactionWithProfile);
            }
            
            if (synced) {
                addToast(isEdit ? 'Updated & Note Synced.' : 'Added & Synced to Note.', 'success');
            } else {
                addToast(isEdit ? 'Transaction updated.' : 'Transaction added.', 'success');
            }
            
            setIsModalOpen(false);
            setEditingTransaction(null);
            setViewingTransaction(null);
            loadData();
            updateWalletCounts();
        } catch (error) {
            console.error("Error saving transaction:", error);
            addToast("Failed to save transaction. Please try again.", "error");
        } finally {
            setIsSaving(false);
        }
    };
    
    const [isImporting, setIsImporting] = useState(false);

    const handleBulkSave = async (newTransactions: Transaction[]) => {
        if (isSuspended) {
            addToast("Bulk save blocked: Account suspended.", "error");
            return;
        }
        setIsBulkImportOpen(false);
        setIsDataModalOpen(false);
        setIsImporting(true);
        
        try {
            const transactionsWithProfile = newTransactions.map(t => ({
                ...t,
                profile_id: activeProfile.id || undefined
            }));
            
            // Bulk save to database
            await saveTransactionsBulk(transactionsWithProfile, user);
            
            // Sync all to note at once
            let syncCount = 0;
            if (linkedNote) {
                const success = await syncAllTransactionsToNote(user, activeProfile.id, activeProfile.name);
                if (success) syncCount = transactionsWithProfile.length;
            }
            
            addToast(`${newTransactions.length} items imported. ${syncCount > 0 ? `Synced ${syncCount} to notes.` : ''}`, 'success');
            await loadData();
            await updateWalletCounts();
        } catch (error) {
            console.error("Bulk import failed:", error);
            addToast("Failed to import transactions.", "error");
        } finally {
            setIsImporting(false);
        }
    };

    const promptDelete = (id: string) => {
        if (isSuspended) {
            addToast("Delete blocked: Account suspended.", "error");
            return;
        }
        setViewingTransaction(null); 
        setDeleteId(id); 
    };

    const executeDelete = async () => {
        if (!deleteId) return;
        setTransactions(prev => prev.filter(t => t.id !== deleteId));
        
        // Find transaction object for profile ID check
        const transactionToDelete = transactions.find(t => t.id === deleteId);
        
        try {
            await deleteTransaction(deleteId, user);
            
            // --- Sync Delete from Note ---
            if (transactionToDelete) {
                await syncTransactionDelete(user, deleteId, transactionToDelete.profile_id);
            }
            
            addToast('Transaction deleted.', 'success');
            updateWalletCounts();
        } catch (error) {
            console.error("Delete failed:", error);
            addToast('Failed to delete transaction.', 'error');
            loadData();
        } finally {
            setDeleteId(null);
        }
    };

    const executeBulkDelete = async () => {
        const idsToDelete: string[] = Array.from(selectedIds);
        
        // Prepare list for note sync deletion before removing from state
        const transactionsToDelete = transactions.filter(t => selectedIds.has(t.id));
        
        setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        setIsBulkDeleteConfirmOpen(false);

        try {
            await Promise.all(idsToDelete.map((id: string) => deleteTransaction(id, user)));
            
            // --- Bulk Sync Delete ---
            for (const t of transactionsToDelete) {
                await syncTransactionDelete(user, t.id, t.profile_id);
            }

            addToast(`${idsToDelete.length} transactions deleted.`, 'success');
            updateWalletCounts();
        } catch (error) {
            console.error("Bulk delete failed:", error);
            addToast('Failed to delete some transactions.', 'error');
            loadData();
        }
    };

    const handleLongPress = (id: string) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds(new Set([id]));
            if (navigator.vibrate) navigator.vibrate(20); 
        }
    };

    const handleToggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
                if (newSet.size === 0) setIsSelectionMode(false); 
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const cancelSelectionMode = () => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    };

    const handleEdit = (t: Transaction) => {
        setEditingTransaction(t);
        setIsModalOpen(true);
    };

    const handleDuplicate = (t: Transaction) => {
        const { id, ...rest } = t;
        const duplicated: Transaction = {
            ...rest,
            id: crypto.randomUUID() as string,
            transaction_date: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        setViewingTransaction(null);
        setEditingTransaction(duplicated);
        setIsModalOpen(true);
    };

    const handleView = (t: Transaction, fromUrl?: boolean) => {
        if (isSelectionMode) {
            handleToggleSelection(t.id);
        } else {
            setViewingTransaction(t);
            if (!fromUrl) {
                navigate(`/finance/${t.id}`);
            }
        }
    };

    const transactionsByDate = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const search = searchQuery.toLowerCase().trim();

        return transactions.filter(t => {
            const tDate = new Date(t.transaction_date);
            
            // Enhanced Search Logic
            let matchesSearch = true;
            if (search) {
                const dateStr = tDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toLowerCase();
                const timeStr = tDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();
                const amountStr = t.amount.toString();
                
                matchesSearch = 
                    t.description.toLowerCase().includes(search) ||
                    t.category.toLowerCase().includes(search) ||
                    t.payment_method.toLowerCase().includes(search) ||
                    amountStr.includes(search) ||
                    dateStr.includes(search) ||
                    timeStr.includes(search);
            }

            let matchesDate = true;
            if (dateFilter === 'this-month') {
                matchesDate = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
            } else if (dateFilter === 'all') {
                matchesDate = true;
            } else if (dateFilter.includes('-')) {
                const [year, month] = dateFilter.split('-');
                matchesDate = tDate.getFullYear() === parseInt(year, 10) && tDate.getMonth() === parseInt(month, 10) - 1;
            }

            return matchesSearch && matchesDate;
        }).sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
    }, [transactions, searchQuery, dateFilter]);

    const transactionsForList = useMemo(() => {
        return transactionsByDate.filter(t => typeFilter === 'all' || t.type === typeFilter);
    }, [transactionsByDate, typeFilter]);

    const availableMonths = useMemo(() => {
        const monthsMap = new Map<string, string>();
        const now = new Date();
        
        // Add last 12 months
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const id = `${y}-${m}`;
            const label = i === 0 ? 'This Month' : i === 1 ? 'Last Month' : d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
            monthsMap.set(id, label);
        }
        
        // Add any other months that have transactions
        transactions.forEach(t => {
            const d = new Date(t.transaction_date);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const id = `${y}-${m}`;
            if (!monthsMap.has(id)) {
                monthsMap.set(id, d.toLocaleDateString('default', { month: 'short', year: 'numeric' }));
            }
        });

        // Ensure "This Month" is mapped correctly if selected
        return Array.from(monthsMap.entries())
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => b.id.localeCompare(a.id));
    }, [transactions]);

    const handleToggleSelectAll = () => {
        if (selectedIds.size === transactionsForList.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(transactionsForList.map(t => t.id));
            setSelectedIds(allIds);
        }
    };

    // --- Export Logic ---

    const getFilteredTransactionsForExport = () => {
        if (exportAllDates) {
            return transactions.filter(t => typeFilter === 'all' || t.type === typeFilter)
                .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
        }

        const start = exportStartDate ? new Date(exportStartDate).getTime() : 0;
        const end = exportEndDate ? new Date(exportEndDate).setHours(23, 59, 59, 999) : Infinity;

        return transactions.filter(t => {
            const tDate = new Date(t.transaction_date).getTime();
            const typeMatch = typeFilter === 'all' || t.type === typeFilter;
            return typeMatch && tDate >= start && tDate <= end;
        }).sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
    };

    // --- RENAME & DOWNLOAD LOGIC ---

    const initiateExport = (type: 'csv' | 'pdf') => {
        const defaultName = `finance_report_${activeProfile.name}_${new Date().toISOString().split('T')[0]}.${type}`;
        setExportDefaultFilename(defaultName);
        setPendingExportType(type);
        setIsExportModalOpen(false);
        setIsRenameModalOpen(true);
    };

    const initiateBackup = () => {
        const defaultName = `finance_backup_${activeProfile.name}_${new Date().toISOString().split('T')[0]}.json`;
        setExportDefaultFilename(defaultName);
        setPendingExportType('json');
        setIsDataModalOpen(false);
        setIsRenameModalOpen(true);
    };

    const performFinalExport = async (filename: string) => {
        const type = pendingExportType;
        setIsRenameModalOpen(false);

        if (type === 'csv') {
             const dataToExport = getFilteredTransactionsForExport();
             const headers = ["Date", "Description", "Category", "Type", "Amount", "Method"];
             const rows = dataToExport.map(t => [
                 new Date(t.transaction_date).toLocaleDateString(),
                 `"${t.description}"`, 
                 t.category,
                 t.type,
                 t.amount,
                 t.payment_method
             ]);
     
             const csvContent = "data:text/csv;charset=utf-8," 
                 + headers.join(",") + "\n" 
                 + rows.map(e => e.join(",")).join("\n");
     
             const encodedUri = encodeURI(csvContent);
             const link = document.createElement("a");
             link.setAttribute("href", encodedUri);
             link.setAttribute("download", filename);
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             addToast('Report exported successfully.', 'info');
        } 
        else if (type === 'json') {
            const dataStr = JSON.stringify(transactions, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', filename);
            linkElement.click();
            addToast('JSON Backup exported.', 'info');
        }
        else if (type === 'pdf') {
             const win = window as any;
             const jsPDF = win.jspdf?.jsPDF || win.jsPDF;
             
             if (!jsPDF) {
                 addToast('PDF generation library not loaded. Please refresh.', 'error');
                 return;
             }
     
             const dataToExport = getFilteredTransactionsForExport();
             if (dataToExport.length === 0) {
                 addToast('No transactions found in selected range.', 'error');
                 return;
             }
     
             // Pre-generate icon PNGs
             const icons = {
                 rupee: await svgToPng(ICONS_SVG.rupee, '#ffffff'),
                 trendingUp: await svgToPng(ICONS_SVG.trendingUp, '#ffffff'),
                 trendingDown: await svgToPng(ICONS_SVG.trendingDown, '#ffffff'),
                 wallet: await svgToPng(ICONS_SVG.wallet, '#ffffff'),
                 calendar: await svgToPng(ICONS_SVG.calendar, '#ffffff'),
                 fileText: await svgToPng(ICONS_SVG.fileText, '#ffffff'),
                 tag: await svgToPng(ICONS_SVG.tag, '#ffffff'),
                 creditCard: await svgToPng(ICONS_SVG.creditCard, '#ffffff')
             };

             const darkIcons = {
                 calendar: await svgToPng(ICONS_SVG.calendar, '#4b5563'),
                 fileText: await svgToPng(ICONS_SVG.fileText, '#4b5563'),
                 tag: await svgToPng(ICONS_SVG.tag, '#4b5563'),
                 creditCard: await svgToPng(ICONS_SVG.creditCard, '#4b5563'),
                 trendingUp: await svgToPng(ICONS_SVG.trendingUp, '#15803d'), // green-700
                 trendingDown: await svgToPng(ICONS_SVG.trendingDown, '#b91c1c'), // red-700
                 rupee: await svgToPng(ICONS_SVG.rupee, '#4b5563'),
             };

             const doc = new jsPDF();
             
             // 1. Header Background
             doc.setFillColor(30, 58, 138); // blue-900
             doc.rect(0, 0, 210, 45, 'F');
             
             doc.setTextColor(255, 255, 255);
             doc.setFontSize(20);
             doc.setFont("helvetica", "bold");
             doc.text("Financial Statement", 14, 22);
             
             doc.setFontSize(9);
             doc.setFont("helvetica", "normal");
             doc.setTextColor(200, 200, 200);
             doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
             
             doc.setTextColor(220, 220, 220);
             doc.text(`Wallet: ${activeProfile.name}`, 14, 38);
             
             const rangeText = exportAllDates 
                 ? "Range: All Data" 
                 : `Range: ${exportStartDate || 'Start'} to ${exportEndDate || 'Present'}`;
             doc.text(rangeText, 100, 38);
     
             const income = dataToExport.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
             const expense = dataToExport.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
             const balance = income - expense;
             const totalTransactions = dataToExport.length;
             
             const dates = dataToExport.map(t => new Date(t.transaction_date).toISOString().split('T')[0]);
             const uniqueDates = new Set(dates);
             const daysTracked = uniqueDates.size || 1;
             const avgDailySpend = expense / daysTracked;
             const highestExpense = dataToExport.filter(t => t.type === 'expense').reduce((max, t) => Math.max(max, Number(t.amount)), 0);
             const savingsRate = income > 0 ? (Math.max(0, balance) / income) * 100 : 0;
     
             let currentY = 55;

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
                 doc.setFontSize(8);
                 doc.setFont('helvetica', 'normal');
                 doc.text(title, x + 14, y + 8.5);
                 
                 doc.setTextColor(valColor[0], valColor[1], valColor[2]);
                 doc.setFontSize(11);
                 doc.setFont('helvetica', 'bold');
                 doc.text(value, x + 6, y + 18);
             };
     
             // Row 1
             drawCard(startX, currentY, cardWidth, cardHeight, "Total Income", `Rs. ${income.toLocaleString('en-IN')}`, [236, 253, 245], [16, 185, 129], [5, 150, 105], icons.trendingUp);
             drawCard(startX + cardWidth + gap, currentY, cardWidth, cardHeight, "Total Expense", `Rs. ${expense.toLocaleString('en-IN')}`, [254, 242, 242], [239, 68, 68], [220, 38, 38], icons.trendingDown);
             drawCard(startX + (cardWidth + gap)*2, currentY, cardWidth, cardHeight, "Net Balance", `Rs. ${balance.toLocaleString('en-IN')}`, [239, 246, 255], [59, 130, 246], [29, 78, 216], icons.wallet);
             drawCard(startX + (cardWidth + gap)*3, currentY, cardWidth, cardHeight, "Savings Rate", `${savingsRate.toFixed(1)}%`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.rupee);

             currentY += cardHeight + gap;

             // Row 2
             drawCard(startX, currentY, cardWidth, cardHeight, "Transactions", `${totalTransactions}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.fileText);
             drawCard(startX + cardWidth + gap, currentY, cardWidth, cardHeight, "Days Tracked", `${daysTracked} Days`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.calendar);
             drawCard(startX + (cardWidth + gap)*2, currentY, cardWidth, cardHeight, "Avg Daily Spend", `Rs. ${avgDailySpend.toFixed(0)}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.creditCard);
             drawCard(startX + (cardWidth + gap)*3, currentY, cardWidth, cardHeight, "Highest Expense", `Rs. ${highestExpense.toLocaleString('en-IN')}`, [243, 244, 246], [107, 114, 128], [17, 24, 39], icons.tag);

             currentY += cardHeight + 12;
     
             const tableColumn = ["Date", "Description", "Category", "Method", "Type", "Amount"];
             const tableRows: any[] = [];
     
             dataToExport.forEach(t => {
                 const isExp = t.type === 'expense';
                 const sign = isExp ? '-' : '+';
                 const amountStr = `${sign} ${Number(t.amount).toLocaleString('en-IN')}`;
                 
                 const transactionData = [
                     new Date(t.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                     t.description,
                     t.category,
                     t.payment_method,
                     t.type.toUpperCase(),
                     amountStr
                 ];
                 tableRows.push(transactionData);
             });
     
             if ((doc as any).autoTable) {
                 (doc as any).autoTable({
                     head: [tableColumn],
                     body: tableRows,
                     startY: currentY,
                     theme: 'striped',
                     headStyles: { 
                         fillColor: [31, 41, 55],
                         textColor: [255, 255, 255],
                         fontStyle: 'bold',
                         halign: 'left',
                         fontSize: 8
                     },
                     columnStyles: {
                         0: { cellWidth: 24 }, // Date
                         1: { cellWidth: 'auto' }, // Description
                         2: { cellWidth: 26 }, // Category
                         3: { cellWidth: 22 }, // Method
                         4: { cellWidth: 26 }, // Type
                         5: { halign: 'right', fontStyle: 'bold', cellWidth: 28 } // Amount
                     },
                     styles: { 
                         fontSize: 8, 
                         cellPadding: 3,
                         font: "helvetica",
                         overflow: 'linebreak'
                     },
                     alternateRowStyles: { fillColor: [249, 250, 251] },
                     didParseCell: (data: any) => {
                         if (data.section === 'body') {
                             if (data.column.index === 4) {
                                 data.cell.styles.cellPadding = { top: 3, right: 3, bottom: 3, left: 9 };
                             }
                             if (data.column.index === 5) {
                                 const raw = data.cell.raw;
                                 if (raw.startsWith('+')) {
                                     data.cell.styles.textColor = [21, 128, 61]; 
                                 } else {
                                     data.cell.styles.textColor = [185, 28, 28];
                                 }
                             }
                         }
                     },
                     didDrawCell: (data: any) => {
                         if (data.section === 'body' && data.column.index === 4) {
                             const raw = data.cell.raw;
                             const icon = raw === 'INCOME' ? darkIcons.trendingUp : darkIcons.trendingDown;
                             if (icon) {
                                 doc.addImage(icon, 'PNG', data.cell.x + 3, data.cell.y + (data.cell.height / 2) - 2, 4, 4);
                             }
                         }
                     }
                 });
                 
                 const finalY = (doc as any).lastAutoTable.finalY || currentY;
                 
                 // Add Summary at the end
                 doc.setFontSize(12);
                 doc.setFont("helvetica", "bold");
                 doc.setTextColor(31, 41, 55);
                 doc.text("Executive Summary", 14, finalY + 15);
                 
                 doc.setFontSize(9);
                 doc.setFont("helvetica", "normal");
                 doc.setTextColor(75, 85, 99);
                 
                 const summaryLines = [
                     `During this period, a total of ${totalTransactions} transactions were recorded.`,
                     `The total income was Rs. ${income.toLocaleString('en-IN')} and the total expense was Rs. ${expense.toLocaleString('en-IN')}.`,
                     `This resulted in a net balance of Rs. ${balance.toLocaleString('en-IN')}, with a savings rate of ${savingsRate.toFixed(1)}%.`,
                     `On average, the daily spend was Rs. ${avgDailySpend.toFixed(0)} over ${daysTracked} active days.`,
                     `The highest single expense recorded was Rs. ${highestExpense.toLocaleString('en-IN')}.`
                 ];
                 
                 let summaryY = finalY + 25;
                 summaryLines.forEach(line => {
                     doc.text(line, 14, summaryY);
                     summaryY += 6;
                 });

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
     
                 doc.save(filename);
                 addToast('PDF Report exported.', 'success');
             } else {
                  addToast('PDF AutoTable plugin not loaded.', 'error');
             }
        }
    };
    
    const openExportModal = () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        setExportStartDate(firstDay);
        setExportEndDate(lastDay);
        setIsExportModalOpen(true);
    };

    const stats = useMemo(() => {
        let income = 0;
        let expense = 0;
        const categoryTotals: Record<string, number> = {};
        
        transactionsForList.forEach(t => {
            const amt = Number(t.amount);
            if (t.type === 'income') income += amt;
            if (t.type === 'expense') {
                expense += amt;
                categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
            }
        });

        const balance = income - expense;
        const savingsRatio = income > 0 ? (Math.max(0, balance) / income) * 100 : 0;
        
        const topCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4) 
            .map(([name, value]) => ({ 
                name, 
                value, 
                percentage: expense > 0 ? (value / expense) * 100 : 0 
            }));

        return { income, expense, balance, savingsRatio, topCategories };
    }, [transactionsForList]);

    return (
        <>
            <main 
                className="relative z-10 h-full overflow-y-auto lg:overflow-y-hidden bg-[#F9F6F2] dark:bg-black pt-20 md:pt-24 px-4 pb-2 scrollbar-hide"
                style={{
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 24px, black 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 24px, black 100%)'
                }}
            >
                <div className="max-w-7xl mx-auto h-full flex flex-col">
                    
                    {!isSelectionMode && !searchQuery && (
                        <div className="flex items-center justify-between gap-2 sm:gap-4 mb-6 min-h-[44px] flex-shrink-0">
                            <div className="flex items-center gap-2" ref={dropdownRef}>
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                        className="group flex items-center gap-2 sm:gap-3 p-1 pr-3 sm:p-1.5 sm:pr-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-neutral-200/60 dark:border-gray-800 rounded-full hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-all duration-300"
                                    >
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-inner group-hover:scale-105 transition-transform flex-shrink-0">
                                            <Wallet className="w-4 h-4 sm:w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col items-start justify-center min-w-0">
                                            <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 leading-none mb-0.5">
                                                Current Wallet
                                            </span>
                                            <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate max-w-[90px] xs:max-w-[120px] sm:max-w-[160px] leading-tight">
                                                {activeProfile.name}
                                            </span>
                                        </div>
                                        {/* Header Count Badge */}
                                        <div className="hidden xs:flex items-center justify-center px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-gray-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/50 dark:border-white/5 transition-all">
                                            <span className="text-[10px] font-bold tabular-nums">
                                                {walletCounts[activeProfile.id || 'default'] || 0}
                                            </span>
                                        </div>
                                        <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-neutral-400 group-hover:text-indigo-500 transition-transform duration-300 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {isProfileDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-3 w-72 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Select Wallet</span>
                                                <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">{profiles.length + 1}</span>
                                            </div>

                                            {linkedNote && (
                                                <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100/50 dark:border-amber-900/20 flex items-center gap-2">
                                                    <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
                                                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate">
                                                        Linked: {linkedNote.title || 'Untitled Note'}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide">
                                                <button
                                                    onClick={() => { setActiveProfile(DEFAULT_PROFILE); setIsProfileDropdownOpen(false); }}
                                                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all group ${
                                                        activeProfile.id === null 
                                                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-white' 
                                                            : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                    }`}
                                                >
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${
                                                        activeProfile.id === null 
                                                            ? 'bg-indigo-500 text-white' 
                                                            : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-500 dark:text-gray-400'
                                                    }`}>
                                                        <Wallet className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 text-left min-w-0">
                                                        <p className="text-sm font-bold truncate">Main Wallet</p>
                                                        <p className="text-[10px] opacity-70 truncate">Default</p>
                                                    </div>
                                                    
                                                    {/* Default wallet Actions */}
                                                    <div className="flex items-center gap-1">
                                                        <div 
                                                            onClick={(e) => initiateNoteLink(e, null)}
                                                            className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                                                            title="Link to Note"
                                                        >
                                                            <LinkIcon className="w-3 h-3" />
                                                        </div>
                                                        {activeProfile.id === null && (
                                                            <div 
                                                                onClick={(e) => { e.stopPropagation(); handleSyncAll(); }}
                                                                className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${isSyncing ? 'text-amber-500' : 'text-gray-400 hover:text-emerald-500'}`}
                                                                title="Sync All to Note"
                                                            >
                                                                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {activeProfile.id === null && <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                                                </button>

                                                {profiles.map(p => (
                                                    <div key={p.id} className="relative group">
                                                        {editingProfileId === p.id ? (
                                                            <div className="flex items-center gap-2 p-2 bg-white dark:bg-black rounded-xl border border-indigo-500/30">
                                                                <input 
                                                                    type="text"
                                                                    value={tempProfileName}
                                                                    onChange={(e) => setTempProfileName(e.target.value)}
                                                                    className="flex-1 bg-transparent text-sm font-medium focus:outline-none text-gray-900 dark:text-white"
                                                                    autoFocus
                                                                    onKeyDown={(e) => { if(e.key === 'Enter') handleUpdateProfile(p.id); }}
                                                                />
                                                                <button onClick={() => handleUpdateProfile(p.id)} className="p-1 text-green-600 hover:bg-green-100 rounded"><Check className="w-3 h-3" /></button>
                                                                <button onClick={() => setEditingProfileId(null)} className="p-1 text-red-600 hover:bg-red-100 rounded"><X className="w-3 h-3" /></button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setActiveProfile(p); setIsProfileDropdownOpen(false); }}
                                                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                                                                    activeProfile.id === p.id 
                                                                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-900 dark:text-white' 
                                                                        : 'hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                                }`}
                                                            >
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 font-bold text-xs ${
                                                                    activeProfile.id === p.id 
                                                                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' 
                                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                                                }`}>
                                                                    {p.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 text-left min-w-0">
                                                                    <p className="text-sm font-bold truncate">{p.name}</p>
                                                                    <p className="text-[10px] opacity-70 truncate">Personal</p>
                                                                </div>
                                                                
                                                                <div className="flex items-center gap-1">
                                                                     {/* Link Button */}
                                                                    <div 
                                                                        onClick={(e) => initiateNoteLink(e, p.id)}
                                                                        className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                                                                        title="Link to Note"
                                                                    >
                                                                        <LinkIcon className="w-3 h-3" />
                                                                    </div>
                                                                    {/* Sync Button (Only if Active, or enable for all?) enabling for Active for clarity */}
                                                                    {activeProfile.id === p.id && (
                                                                        <div 
                                                                            onClick={(e) => { e.stopPropagation(); handleSyncAll(); }}
                                                                            className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 ${isSyncing ? 'text-amber-500' : 'text-gray-400 hover:text-emerald-500'}`}
                                                                            title="Sync All to Note"
                                                                        >
                                                                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                                                        </div>
                                                                    )}
                                                                    <div 
                                                                        onClick={(e) => { e.stopPropagation(); setEditingProfileId(p.id); setTempProfileName(p.name); }}
                                                                        className="p-1.5 text-gray-400 hover:text-indigo-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </div>
                                                                    <div 
                                                                        onClick={(e) => { e.stopPropagation(); setProfileToDelete(p.id); }}
                                                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </div>
                                                                </div>
                                                                
                                                                {activeProfile.id === p.id && (
                                                                    <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 group-hover:hidden" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/10">
                                                {isCreatingProfile ? (
                                                    <div className="flex items-center gap-2 p-2 bg-white dark:bg-black rounded-xl border border-indigo-500/30 animate-fade-in-up">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Wallet Name" 
                                                            value={newProfileName}
                                                            onChange={e => setNewProfileName(e.target.value)}
                                                            className="flex-1 bg-transparent text-sm font-medium focus:outline-none text-gray-900 dark:text-white placeholder-gray-400"
                                                            autoFocus
                                                            onKeyDown={(e) => { if(e.key === 'Enter') handleCreateProfile(); }}
                                                        />
                                                        <button onClick={handleCreateProfile} className="p-1 text-green-600 hover:bg-green-100 rounded"><Check className="w-3 h-3" /></button>
                                                        <button onClick={() => setIsCreatingProfile(false)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><X className="w-3 h-3" /></button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => setIsCreatingProfile(true)} 
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all text-xs font-bold uppercase tracking-wide"
                                                    >
                                                        <PlusCircle className="w-4 h-4" />
                                                        Add New Wallet
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                {/* Sync Button - Placed between main wallet and view tabs */}
                                {linkedNote && (
                                    <button 
                                        onClick={handleSyncAll}
                                        disabled={isSyncing}
                                        className="flex items-center justify-center p-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50" 
                                        title={`Synced to: ${linkedNote.title || 'Note'}. Click to force sync.`}
                                    >
                                        {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                    </button>
                                )}

                                <div className="bg-white dark:bg-black p-1 rounded-xl border border-gray-200 dark:border-gray-800 flex shadow-sm">
                                    <button 
                                        onClick={() => setViewMode('list')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('analytics')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'analytics' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('calendar')}
                                        className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                    >
                                        <Calendar className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                <button onClick={openExportModal} className="p-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl transition-all shadow-sm active:scale-95" title="Download Reports">
                                    <Download className="w-5 h-5" />
                                </button>

                                <button onClick={() => setIsDataModalOpen(true)} className="p-2.5 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl transition-all shadow-sm active:scale-95" title="Data Management">
                                    <Database className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {!isSelectionMode && !searchQuery && (
                        <div className="flex flex-wrap items-center gap-3 mb-6 pb-2 flex-shrink-0 relative z-20">
                            <div className="bg-white dark:bg-black p-1 rounded-xl border border-gray-200 dark:border-gray-800 flex shadow-sm w-fit relative" ref={monthDropdownRef}>
                                {/* Month Dropdown Trigger */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (dateFilter === 'all') {
                                            setDateFilter('this-month');
                                            setIsMonthDropdownOpen(true);
                                        } else {
                                            setIsMonthDropdownOpen(prev => !prev);
                                        }
                                    }}
                                    className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        dateFilter !== 'all' 
                                            ? 'text-white dark:text-black' 
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {dateFilter !== 'all' && (
                                        <motion.div 
                                            layoutId="activeFilter"
                                            className="absolute inset-0 bg-black dark:bg-white rounded-lg pointer-events-none"
                                            initial={false}
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className="relative z-10 whitespace-nowrap">
                                        {dateFilter === 'this-month' 
                                            ? 'This Month' 
                                            : availableMonths.find(m => m.id === dateFilter)?.label || 'Select Month'}
                                    </span>
                                    {dateFilter !== 'all' && (
                                        <ChevronDown className={`w-3.5 h-3.5 relative z-10 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                                    )}
                                </button>
                                
                                {/* All Time Button */}
                                <button
                                    onClick={() => {
                                        setDateFilter('all');
                                        setIsMonthDropdownOpen(false);
                                    }}
                                    className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                                        dateFilter === 'all' 
                                            ? 'text-white dark:text-black' 
                                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {dateFilter === 'all' && (
                                        <motion.div 
                                            layoutId="activeFilter"
                                            className="absolute inset-0 bg-black dark:bg-white rounded-lg pointer-events-none"
                                            initial={false}
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className="relative z-10 whitespace-nowrap">All Time</span>
                                </button>
                                
                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {isMonthDropdownOpen && dateFilter !== 'all' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute top-[calc(100%+8px)] left-0 w-48 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-[999] overflow-hidden"
                                        >
                                            <div className="max-h-60 overflow-y-auto scrollbar-hide p-1">
                                                {availableMonths.map((month) => {
                                                    const now = new Date();
                                                    const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                                    const isCurrentMonth = month.id === currentMonthId;
                                                    const isSelected = dateFilter === month.id || (dateFilter === 'this-month' && isCurrentMonth);
                                                    return (
                                                        <button
                                                            key={month.id}
                                                            onClick={(_) => {
                                                                setDateFilter(isCurrentMonth ? 'this-month' : month.id);
                                                                setIsMonthDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                                                                isSelected
                                                                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900'
                                                            }`}
                                                        >
                                                            {month.label}
                                                            {isSelected && <Check className="w-4 h-4" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            {viewMode === 'list' && (
                                <>
                                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-700"></div>
                                    <div className="bg-white dark:bg-black p-1 rounded-xl border border-gray-200 dark:border-gray-800 flex shadow-sm">
                                        <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'all' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>All</button>
                                        <button onClick={() => setTypeFilter('income')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>In</button>
                                        <button onClick={() => setTypeFilter('expense')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'expense' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>Out</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col gap-6 lg:gap-6 flex-1 min-h-0 lg:max-w-7xl mx-auto w-full">
                        {/* TOP DASHBOARD METRICS */}
                        {!isSelectionMode && !searchQuery && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5 flex-shrink-0">
                                {/* Balance Card */}
                                <div className="relative overflow-hidden rounded-[2rem] lg:rounded-[1.5rem] p-8 lg:p-5 text-white bg-[#111] dark:bg-black border border-[#222] shadow-lg flex flex-col h-full">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-transparent opacity-60"></div>
                                    <div className="absolute top-0 right-0 p-8 lg:p-4 opacity-20 transform group-hover:scale-110 transition-transform duration-700">
                                        <Wallet className="w-32 h-32 lg:w-24 lg:h-24" />
                                    </div>
                                    
                                    <div className="relative z-10 flex flex-col justify-between flex-1 min-h-[140px] lg:min-h-[160px]">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <p className="text-sm lg:text-xs font-medium text-gray-400 uppercase tracking-widest mb-1 lg:mb-0.5">Net Saved</p>
                                                <h2 className="text-5xl lg:text-3xl xl:text-4xl font-extrabold tracking-tight truncate">
                                                    {stats.balance >= 0 ? '+' : '-'}₹{Math.abs(stats.balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </h2>
                                                
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                                                        stats.savingsRatio >= 20 
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                                            : stats.savingsRatio > 0 
                                                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                                                : 'bg-white/10 text-gray-400 border-white/10'
                                                    }`}>
                                                        <PiggyBank className="w-3 h-3 flex-shrink-0" />
                                                        <span className="whitespace-nowrap">{stats.savingsRatio.toFixed(1)}% Saved</span>
                                                        {stats.savingsRatio >= 20 && (
                                                            <div className="hidden xl:flex items-center gap-1 ml-1 pl-1 border-l border-emerald-500/30">
                                                                <TrendingUp className="w-3 h-3" />
                                                                <span>High</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 flex-shrink-0 hidden sm:block">
                                                <PieChart className="w-6 h-6 text-white" />
                                            </div>
                                        </div>

                                        {stats.expense > 0 && (
                                            <div className="mt-4 pt-4 lg:pt-3 border-t border-white/10 group">
                                                <div className="flex justify-between items-end mb-2.5">
                                                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Spending</p>
                                                    <p className="text-xs text-white font-bold">₹{stats.expense.toLocaleString('en-IN')}</p>
                                                </div>
                                                <div className="flex h-3 w-full rounded-full overflow-hidden bg-white/10">
                                                    {stats.topCategories.map((cat, i) => (
                                                        <Tooltip 
                                                            key={cat.name} 
                                                            content={`${cat.name}: ₹${cat.value.toLocaleString('en-IN')} (${cat.percentage.toFixed(1)}%)`}
                                                        >
                                                            <div 
                                                                style={{ width: `${cat.percentage}%`, backgroundColor: ['#F43F5E', '#F59E0B', '#10B981', '#3B82F6'][i % 4] }}
                                                                className="h-full border-r border-black/10 last:border-0 hover:opacity-80 transition-opacity cursor-pointer"
                                                            />
                                                        </Tooltip>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Income & Expense Stack */}
                                <div className="grid grid-cols-2 md:grid-cols-1 gap-4 lg:gap-5 h-full">
                                    <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-2xl lg:rounded-[1.5rem] p-5 lg:p-4 border border-gray-100 dark:border-gray-800 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 mb-2 lg:mb-1">
                                            <div className="p-2 lg:p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                                <ArrowDownLeft className="w-5 h-5 lg:w-4 lg:h-4" />
                                            </div>
                                            <span className="text-xs lg:text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">Income</span>
                                        </div>
                                        <p className="text-2xl lg:text-xl font-bold text-gray-900 dark:text-white truncate">
                                            +₹{stats.income.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <div className="flex-1 bg-white dark:bg-[#0a0a0a] rounded-2xl lg:rounded-[1.5rem] p-5 lg:p-4 border border-gray-100 dark:border-gray-800 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 mb-2 lg:mb-1">
                                            <div className="p-2 lg:p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400 flex-shrink-0">
                                                <ArrowUpRight className="w-5 h-5 lg:w-4 lg:h-4" />
                                            </div>
                                            <span className="text-xs lg:text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">Expense</span>
                                        </div>
                                        <p className="text-2xl lg:text-xl font-bold text-gray-900 dark:text-white truncate">
                                            -₹{stats.expense.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Score Card Section */}
                                {viewMode !== 'analytics' && (
                                    <div className="md:col-span-2 lg:col-span-1 xl:col-span-2 h-full">
                                        <FinancialFitnessCard transactions={transactionsForList} budget={budget} period={dateFilter} className="h-full" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DATA VIEW CONTAINER */}
                        <div className={`mx-auto w-full lg:max-w-5xl flex-1 flex flex-col min-w-0 lg:overflow-y-auto scrollbar-hide lg:bg-white lg:dark:bg-[#0a0a0a] lg:rounded-[2rem] lg:border border-gray-100 dark:border-gray-800/80 lg:shadow-sm ${viewMode === 'analytics' ? "pb-4 lg:p-8" : "pb-12 lg:p-8 lg:pb-4"}`}>
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            ) : viewMode === 'analytics' ? (
                                <FinanceAnalytics transactions={transactionsByDate} period={dateFilter} />
                            ) : viewMode === 'calendar' ? (
                                <FinanceCalendar transactions={transactions} onDateClick={handleDateClick} />
                            ) : (
                                <>
                                    <TransactionList 
                                        transactions={transactionsForList} 
                                        onDelete={promptDelete}
                                        onEdit={handleEdit} 
                                        onView={handleView}
                                        isSelectionMode={isSelectionMode}
                                        selectedIds={selectedIds}
                                        onToggleSelection={handleToggleSelection}
                                        onLongPress={handleLongPress}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            
            {/* FAB - Floating Action Button */}
            {!isSelectionMode && viewMode === 'list' && (
                <button 
                    onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
                    className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 group"
                    title="Add Record"
                >
                    <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                </button>
            )}

            {isSelectionMode && (
                <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
                    <div className="w-full max-w-2xl flex items-center justify-between p-3 bg-white dark:bg-black border border-neutral-200 dark:border-gray-800 rounded-[2rem] shadow-xl pointer-events-auto animate-fade-in-up">
                        <div className="flex items-center gap-3 px-2">
                            <button onClick={cancelSelectionMode} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-800 transition-colors">
                                <X className="w-5 h-5 text-neutral-600 dark:text-gray-300" />
                            </button>
                            <span className="font-semibold text-neutral-900 dark:text-white">
                                {selectedIds.size} Selected
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleToggleSelectAll}
                                className="p-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <CheckSquare className="w-4 h-4" />
                                <span className="hidden sm:inline">{selectedIds.size === transactionsForList.length ? 'Deselect All' : 'Select All'}</span>
                            </button>
                            <button
                                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                                disabled={selectedIds.size === 0}
                                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Range Selector Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" 
                        onClick={() => setIsExportModalOpen(false)} 
                    />
                    <div className="relative w-full max-w-sm bg-white dark:bg-black rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-fade-in-up">
                        {/* Decorative Header Background */}
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20" />
                        
                        <div className="relative p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                        <Download className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            Download Report
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Export your financial data
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsExportModalOpen(false)} className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <style>{`
                                /* Hides default date chevron */
                                input[type="date"]::-webkit-calendar-picker-indicator {
                                    display: none !important;
                                    -webkit-appearance: none;
                                }
                            `}</style>

                            <div className="space-y-5">
                                {/* Date Range Selection */}
                                <div className="bg-gray-50 dark:bg-black rounded-2xl p-4 border border-gray-100 dark:border-gray-800/60">
                                    <div className="flex items-center gap-3 mb-4 cursor-pointer group" onClick={() => setExportAllDates(!exportAllDates)}>
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${exportAllDates ? 'bg-indigo-500 border-indigo-500' : 'border-gray-300 dark:border-gray-600 group-hover:border-indigo-400'}`}>
                                            {exportAllDates && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">Export All Time Data</span>
                                    </div>

                                    <div className={`grid grid-cols-2 gap-3 transition-all duration-300 ${exportAllDates ? 'opacity-40 pointer-events-none grayscale-[50%]' : 'opacity-100'}`}>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block ml-1">From Date</label>
                                            <div className="relative group" onClick={() => (document.getElementById('export-start-date') as HTMLInputElement)?.showPicker()}>
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                                                <input 
                                                    id="export-start-date"
                                                    type="date" 
                                                    value={exportStartDate}
                                                    onChange={(e) => setExportStartDate(e.target.value)}
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none cursor-pointer appearance-none text-gray-700 dark:text-gray-300 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block ml-1">To Date</label>
                                            <div className="relative group" onClick={() => (document.getElementById('export-end-date') as HTMLInputElement)?.showPicker()}>
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                                                <input 
                                                    id="export-end-date"
                                                    type="date" 
                                                    value={exportEndDate}
                                                    onChange={(e) => setExportEndDate(e.target.value)}
                                                    className="w-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500/50 outline-none cursor-pointer appearance-none text-gray-700 dark:text-gray-300 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Export Format Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => initiateExport('csv')}
                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-gray-700 dark:text-gray-300 transition-all group"
                                    >
                                        <span className="text-xs font-bold uppercase tracking-wide">CSV Excel</span>
                                    </button>
                                    <button 
                                        onClick={() => initiateExport('pdf')}
                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg shadow-indigo-500/25 group border border-indigo-500"
                                    >
                                        <span className="text-xs font-bold uppercase tracking-wide">PDF Report</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

             {/* Unified Data Management Modal */}
             {isDataModalOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" 
                        onClick={() => setIsDataModalOpen(false)} 
                    />
                    <div className="relative w-full max-w-sm bg-white dark:bg-black rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-fade-in-up">
                        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-cyan-500/20" />
                        
                        <div className="relative p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                        <Database className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            Data Backup
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Import or export your JSON data
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsDataModalOpen(false)} className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={initiateBackup}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gray-50 dark:bg-black hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-gray-200 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-all group text-center shadow-sm"
                                >
                                    <div className="p-2 rounded-full bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-sm">
                                        <Download className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Export</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Save JSON</p>
                                    </div>
                                </button>

                                <button 
                                    onClick={() => setIsBulkImportOpen(true)}
                                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gray-50 dark:bg-black hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800/50 transition-all group text-center shadow-sm"
                                >
                                    <div className="p-2 rounded-full bg-white dark:bg-black text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shadow-sm">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wide">Import</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Restore JSON</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 dark:bg-black border-t border-gray-100 dark:border-gray-800/60">
                             <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 font-medium">
                                Use this to migrate data between devices or keep offline backups.
                             </p>
                        </div>
                    </div>
                </div>
            )}
            
            {/* NEW: Rename Modal */}
            <FileRenameModal 
                isOpen={isRenameModalOpen}
                onClose={() => setIsRenameModalOpen(false)}
                onConfirm={performFinalExport}
                defaultFilename={exportDefaultFilename}
                fileExtension={pendingExportType || 'csv'}
            />

            {viewingTransaction && (
                <TransactionDetailPage 
                    transaction={viewingTransaction}
                    onBack={() => {
                        setViewingTransaction(null);
                        if (location.pathname.startsWith('/finance/')) {
                            navigate('/finance');
                        }
                    }}
                    onEdit={handleEdit}
                    onDelete={viewMode === 'calendar' ? undefined : promptDelete}
                    onDuplicate={handleDuplicate}
                />
            )}

            <TransactionModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingTransaction}
                user={user}
                isSaving={isSaving}
                recentCategoryIds={recentCategoryIds}
            />

            {isImporting && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        <p className="text-gray-900 dark:text-white font-medium">Importing Data...</p>
                    </div>
                </div>
            )}

            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => { setIsBulkImportOpen(false); setIsDataModalOpen(false); }}
                onSave={handleBulkSave}
                user={user}
            />

            {/* Note Picker for Sync */}
            <NotePickerModal 
                isOpen={isLinkNoteModalOpen}
                onClose={() => setIsLinkNoteModalOpen(false)}
                onSelectNote={handleNoteSelectedForSync}
                user={user}
            />

            {/* Calendar Details Modal */}
            {isCalendarModalOpen && selectedDate && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                        onClick={() => setIsCalendarModalOpen(false)} 
                    />
                    <div className="relative w-full max-w-lg bg-white dark:bg-[#0a0a0a] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[80vh] animate-fade-in-up">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-500" />
                                {new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                            <button onClick={() => setIsCalendarModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
                            <div className="p-4">
                                {/* Daily Summary Stats */}
                                {(() => {
                                    const dailyTransactions = transactions.filter(t => {
                                        let dStr = '';
                                        if (typeof t.transaction_date === 'string' && t.transaction_date.length === 10 && t.transaction_date.includes('-')) {
                                            dStr = t.transaction_date;
                                        } else {
                                            const d = new Date(t.transaction_date);
                                            dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                        }
                                        return dStr === selectedDate;
                                    });
                                    
                                    const dailyIncome = dailyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
                                    const dailyExpense = dailyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
                                    const dailyNet = dailyIncome - dailyExpense;

                                    return (
                                        <div className="grid grid-cols-3 gap-3 mb-6">
                                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                                                <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Income</p>
                                                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">₹{dailyIncome.toLocaleString()}</p>
                                            </div>
                                            <div className="p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/20">
                                                <p className="text-[10px] uppercase tracking-wider font-semibold text-rose-600 dark:text-rose-400 mb-1">Expense</p>
                                                <p className="text-sm font-bold text-rose-700 dark:text-rose-300">₹{dailyExpense.toLocaleString()}</p>
                                            </div>
                                            <div className={`p-3 rounded-xl border ${dailyNet >= 0 ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/20' : 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20'}`}>
                                                <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${dailyNet >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-orange-600 dark:text-orange-400'}`}>Net Balance</p>
                                                <p className={`text-sm font-bold ${dailyNet >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-orange-700 dark:text-orange-300'}`}>
                                                    {dailyNet >= 0 ? '+' : '-'}₹{Math.abs(dailyNet).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <TransactionList 
                                    transactions={transactions.filter(t => {
                                        let dStr = '';
                                        if (typeof t.transaction_date === 'string' && t.transaction_date.length === 10 && t.transaction_date.includes('-')) {
                                            dStr = t.transaction_date;
                                        } else {
                                            const d = new Date(t.transaction_date);
                                            dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                        }
                                        return dStr === selectedDate;
                                    })}
                                    onDelete={promptDelete}
                                    onEdit={(t) => { setIsCalendarModalOpen(false); handleEdit(t); }}
                                    onView={(t) => { setIsCalendarModalOpen(false); handleView(t); }}
                                    isSelectionMode={false}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={executeDelete}
                title="Delete Transaction"
                message="Are you sure you want to permanently delete this transaction? This action cannot be undone."
                confirmButtonText="Delete"
                confirmButtonVariant="danger"
            />

            <ConfirmationModal
                isOpen={isBulkDeleteConfirmOpen}
                onClose={() => setIsBulkDeleteConfirmOpen(false)}
                onConfirm={executeBulkDelete}
                title={`Delete ${selectedIds.size} Transactions?`}
                message="This action cannot be undone. These records will be permanently removed."
                confirmButtonText="Delete All"
                confirmButtonVariant="danger"
            />
            
            <ConfirmationModal
                isOpen={!!profileToDelete}
                onClose={() => setProfileToDelete(null)}
                onConfirm={handleDeleteProfile}
                title="Delete Wallet?"
                message="Are you sure you want to permanently delete this wallet? All transactions inside it will also be lost."
                confirmButtonText="Delete Forever"
                confirmButtonVariant="danger"
            />
        </>
    );
};

export default FinanceView;
