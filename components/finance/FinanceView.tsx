
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import { Transaction, FinanceProfile, Note } from '../../types';
import { getTransactions, saveTransaction, saveTransactionsBulk, deleteTransaction, getFinanceProfiles, saveFinanceProfile, updateFinanceProfile, deleteFinanceProfile, getCustomCategories, CustomCategoryItem } from '../../services/dbService';
import { linkWalletToNote, syncTransactionAdd, syncTransactionUpdate, syncTransactionDelete, fetchLinkedNote, syncAllTransactionsToNote } from '../../services/financeSyncService'; 
import { Plus, Wallet, Download, PieChart, ArrowUpRight, ArrowDownLeft, BarChart3, List, Trash2, X, CheckSquare, ChevronDown, PlusCircle, Edit2, Check, PiggyBank, TrendingUp, FileText, Database, Upload, Link as LinkIcon, Calendar, StickyNote, Loader2, FileSpreadsheet, Activity, MoreVertical, Tag, Search, Filter, RotateCw } from 'lucide-react';
import { CATEGORY_CONFIG, getCategoryConfig } from './categories';
import FinanceCalendar from './FinanceCalendar';
import TransactionList from './TransactionList';
import TransactionModal from './TransactionModal'; 
import BulkImportModal from './BulkImportModal';
import FinanceAnalytics from './FinanceAnalytics';
import FinancialFitnessCard from './FinancialFitnessCard';
import ConfirmationModal from '../ConfirmationModal';
import FileRenameModal from './FileRenameModal';
import NotePickerModal from '../NotePickerModal';
import type { User } from '@supabase/supabase-js';
import { useToast } from '../ToastSystem';
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
    const [isCreatingProfileLoading, setIsCreatingProfileLoading] = useState(false);
    const [activeMenuWalletId, setActiveMenuWalletId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

    const handleToggleWalletMenu = (e: React.MouseEvent<HTMLButtonElement>, walletId: string) => {
        e.stopPropagation();
        if (activeMenuWalletId === walletId) {
            setActiveMenuWalletId(null);
            setMenuPosition(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 6,
                right: Math.max(12, window.innerWidth - rect.right)
            });
            setActiveMenuWalletId(walletId);
        }
    };
    
    // Wallet Counts State
    const [walletCounts, setWalletCounts] = useState<Record<string, number>>({});
    
    // Profile Editing State
    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [tempProfileName, setTempProfileName] = useState('');
    const [isRenamingProfileLoading, setIsRenamingProfileLoading] = useState(false);
    const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
    const [isDeletingProfile, setIsDeletingProfile] = useState(false);

    const selectWalletProfile = (profile: ActiveProfileState) => {
        setActiveProfile(profile);
        setIsProfileDropdownOpen(false);
        setActiveMenuWalletId(null);
        setMenuPosition(null);
        if (profile.id) {
            localStorage.setItem('ceaznet_active_wallet_id', profile.id);
        } else {
            localStorage.setItem('ceaznet_active_wallet_id', 'default');
        }
    };

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
    
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    
    // Delete Confirmation State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);
    
    // Selection Mode State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Filter States
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [customCategories, setCustomCategories] = useState<CustomCategoryItem[]>([]);
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const [dataLoaded, setDataLoaded] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    
    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
                setIsMonthDropdownOpen(false);
            }
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Budget helper for the Score card
    const budget = useMemo(() => {
        const saved = localStorage.getItem('ceaznet_monthly_budget');
        return saved ? Number(saved) : 0;
    }, []);

    const loadCustomCategoriesData = async () => {
        try {
            const cats = await getCustomCategories(user);
            setCustomCategories(cats);
        } catch (e) {
            console.error("Failed to load custom categories", e);
        }
    };

    useEffect(() => {
        loadData();
        loadProfiles();
        updateWalletCounts();
        refreshLinkedNote();
        loadCustomCategoriesData();
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
                setActiveMenuWalletId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadProfiles = async () => {
        try {
            const fetched = await getFinanceProfiles(user);
            setProfiles(fetched);

            // Restore last active wallet selection from localStorage
            const savedWalletId = localStorage.getItem('ceaznet_active_wallet_id');
            if (savedWalletId && savedWalletId !== 'default') {
                const found = fetched.find(p => p.id === savedWalletId);
                if (found) {
                    setActiveProfile(found);
                }
            }
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
        if (!newProfileName.trim() || isCreatingProfileLoading) return;
        
        setIsCreatingProfileLoading(true);
        try {
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
            localStorage.setItem('ceaznet_active_wallet_id', newProfile.id);
            addToast(`Wallet "${newProfileName.trim()}" created.`, 'success');
            setNewProfileName('');
            setIsCreatingProfile(false);
            setIsProfileDropdownOpen(false);
            updateWalletCounts(); // Init count for new wallet
        } catch (e) {
            console.error("Failed to create wallet profile", e);
            addToast('Failed to create wallet. Please try again.', 'error');
        } finally {
            setIsCreatingProfileLoading(false);
        }
    };

    const handleUpdateProfile = async (id: string) => {
        if (isSuspended) {
            addToast("Update wallet blocked: Account suspended.", "error");
            return;
        }
        if (!tempProfileName.trim() || isRenamingProfileLoading) return;

        setIsRenamingProfileLoading(true);
        try {
            const updatedName = tempProfileName.trim();
            await updateFinanceProfile(id, updatedName, user);
            setProfiles(prev => prev.map(p => p.id === id ? { ...p, name: updatedName } : p));
            if (activeProfile.id === id) {
                setActiveProfile(prev => ({ ...prev, name: updatedName }));
            }
            addToast(`Wallet renamed to "${updatedName}".`, 'success');
            setEditingProfileId(null);
            setTempProfileName('');
        } catch (e) {
            console.error("Failed to update wallet profile", e);
            addToast('Failed to rename wallet. Please try again.', 'error');
        } finally {
            setIsRenamingProfileLoading(false);
        }
    };

    const handleDeleteProfile = async () => {
        if (isSuspended) {
            addToast("Delete wallet blocked: Account suspended.", "error");
            return;
        }
        if (!profileToDelete) return;
        
        const idToDelete = profileToDelete;
        setIsDeletingProfile(true);
        try {
            await deleteFinanceProfile(idToDelete, user);
            setProfiles(prev => prev.filter(p => p.id !== idToDelete));
            addToast('Wallet deleted successfully.', 'success');
            
            // If active profile was deleted, switch to default
            if (activeProfile.id === idToDelete) {
                setActiveProfile(DEFAULT_PROFILE);
                localStorage.setItem('ceaznet_active_wallet_id', 'default');
            }
            updateWalletCounts();
            setProfileToDelete(null);
        } catch (e) {
            console.error("Failed to delete profile", e);
            addToast('Failed to delete wallet.', 'error');
        } finally {
            setIsDeletingProfile(false);
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

    const promptDelete = useCallback((id: string) => {
        if (isSuspended) {
            addToast("Delete blocked: Account suspended.", "error");
            return;
        }
        setDeleteId(id); 
    }, [isSuspended, addToast]);

    const executeDelete = async () => {
        if (!deleteId) return;
        setIsDeletingTransaction(true);
        try {
            setTransactions(prev => prev.filter(t => t.id !== deleteId));
            
            // Find transaction object for profile ID check
            const transactionToDelete = transactions.find(t => t.id === deleteId);
            
            await deleteTransaction(deleteId, user);
            
            // --- Sync Delete from Note ---
            if (transactionToDelete) {
                await syncTransactionDelete(user, deleteId, transactionToDelete.profile_id);
            }
            
            addToast('Transaction deleted.', 'success');
            updateWalletCounts();
            setDeleteId(null);
        } catch (error) {
            console.error("Delete failed:", error);
            addToast('Failed to delete transaction.', 'error');
            loadData();
        } finally {
            setIsDeletingTransaction(false);
        }
    };

    const executeBulkDelete = async () => {
        const idsToDelete: string[] = Array.from(selectedIds);
        
        // Prepare list for note sync deletion before removing from state
        const transactionsToDelete = transactions.filter(t => selectedIds.has(t.id));
        
        setIsBulkDeleting(true);
        try {
            setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
            setIsSelectionMode(false);
            setSelectedIds(new Set());

            await Promise.all(idsToDelete.map((id: string) => deleteTransaction(id, user)));
            
            // --- Bulk Sync Delete ---
            for (const t of transactionsToDelete) {
                await syncTransactionDelete(user, t.id, t.profile_id);
            }

            addToast(`${idsToDelete.length} transactions deleted.`, 'success');
            updateWalletCounts();
            setIsBulkDeleteConfirmOpen(false);
        } catch (error) {
            console.error("Bulk delete failed:", error);
            addToast('Failed to delete some transactions.', 'error');
            loadData();
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleLongPress = useCallback((id: string) => {
        if (!isSelectionMode) {
            setIsSelectionMode(true);
            setSelectedIds(new Set([id]));
            if (navigator.vibrate) navigator.vibrate(20); 
        }
    }, [isSelectionMode]);

    const handleToggleSelection = useCallback((id: string) => {
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
    }, []);

    const cancelSelectionMode = useCallback(() => {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
    }, []);

    const handleEdit = useCallback((t: Transaction) => {
        setEditingTransaction(t);
        setIsModalOpen(true);
    }, []);

    const handleDuplicate = useCallback((t: Transaction) => {
        const { id, ...rest } = t;
        const duplicated: Transaction = {
            ...rest,
            id: crypto.randomUUID() as string,
            transaction_date: t.transaction_date,
            created_at: new Date().toISOString()
        };
        setEditingTransaction(duplicated);
        setIsModalOpen(true);
    }, []);

    const handleView = useCallback((t: Transaction) => {
        if (isSelectionMode) {
            handleToggleSelection(t.id);
        }
    }, [isSelectionMode, handleToggleSelection]);

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

    const availableCategories = useMemo(() => {
        const categorySet = new Set<string>();
        
        // Add categories from current transactions
        transactions.forEach(t => {
            if (t.category && t.category.trim()) {
                categorySet.add(t.category.trim());
            }
        });

        // Also include standard preset categories
        CATEGORY_CONFIG.expense.forEach(c => categorySet.add(c.id));
        CATEGORY_CONFIG.income.forEach(c => categorySet.add(c.id));

        // Add custom categories
        customCategories.forEach(c => categorySet.add(c.id));

        return Array.from(categorySet).map(cat => {
            const conf = getCategoryConfig(cat, undefined, customCategories);
            return {
                id: cat,
                label: conf?.label || cat,
                icon: conf?.icon || Tag,
                color: conf?.color || 'text-indigo-500',
                bg: conf?.bg || 'bg-indigo-100 dark:bg-indigo-900/30'
            };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }, [transactions, customCategories]);

    const filteredCategoriesList = useMemo(() => {
        if (!categorySearch.trim()) return availableCategories;
        const q = categorySearch.toLowerCase().trim();
        return availableCategories.filter(c => 
            c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
        );
    }, [availableCategories, categorySearch]);

    const transactionsForList = useMemo(() => {
        return transactionsByDate.filter(t => {
            const matchesType = typeFilter === 'all' || t.type === typeFilter;
            const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter || (
                categoryFilter.toLowerCase() === t.category.toLowerCase()
            );
            return matchesType && matchesCategory;
        });
    }, [transactionsByDate, typeFilter, categoryFilter]);

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
            return transactions.filter(t => {
                const typeMatch = typeFilter === 'all' || t.type === typeFilter;
                const catMatch = categoryFilter === 'all' || t.category === categoryFilter || (categoryFilter.toLowerCase() === t.category.toLowerCase());
                return typeMatch && catMatch;
            }).sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
        }

        const start = exportStartDate ? new Date(exportStartDate).getTime() : 0;
        const end = exportEndDate ? new Date(exportEndDate).setHours(23, 59, 59, 999) : Infinity;

        return transactions.filter(t => {
            const tDate = new Date(t.transaction_date).getTime();
            const typeMatch = typeFilter === 'all' || t.type === typeFilter;
            const catMatch = categoryFilter === 'all' || t.category === categoryFilter || (categoryFilter.toLowerCase() === t.category.toLowerCase());
            return typeMatch && catMatch && tDate >= start && tDate <= end;
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
             
             // 1. Header Background (Reduced height & compact margins)
             const startX = 9;
             const headerHeight = 28;
             
             doc.setFillColor(30, 58, 138); // blue-900
             doc.rect(0, 0, 210, headerHeight, 'F');
             
             doc.setTextColor(255, 255, 255);
             doc.setFontSize(18);
             doc.setFont("helvetica", "bold");
             doc.text("Financial Statement", startX, 15);
             
             const rangeText = exportAllDates 
                 ? "Range: All Data" 
                 : `Range: ${exportStartDate || 'Start'} to ${exportEndDate || 'Present'}`;

             // Consolidated Metadata Row in Header
             doc.setFontSize(8.5);
             doc.setFont("helvetica", "normal");
             doc.setTextColor(220, 225, 235);
             doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, startX, 22);
             doc.text(`Wallet: ${activeProfile.name}`, 80, 22);
             doc.text(rangeText, 145, 22);
     
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
     
             let currentY = 34;

             // 2. Summary Cards (2 rows of 4 cards with thin borders)
             const cardWidth = 45;
             const cardHeight = 20;
             const gap = 4;
             
             const drawCard = (
                 x: number, 
                 y: number, 
                 w: number, 
                 h: number, 
                 title: string, 
                 value: string, 
                 bgColor: number[], 
                 borderColor: number[], 
                 titleColor: number[], 
                 valColor: number[], 
                 iconData: string
             ) => {
                 doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                 doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
                 doc.setLineWidth(0.3); // Subtle thin border
                 doc.roundedRect(x, y, w, h, 2, 2, 'FD'); // Fill and Draw border
                 
                 // Icon circle
                 doc.setFillColor(titleColor[0], titleColor[1], titleColor[2]);
                 doc.circle(x + 6, y + 6, 3.5, 'F');
                 
                 if (iconData) {
                     doc.addImage(iconData, 'PNG', x + 4, y + 4, 4, 4);
                 }

                 doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
                 doc.setFontSize(7.5);
                 doc.setFont('helvetica', 'normal');
                 doc.text(title, x + 12, y + 7.5);
                 
                 doc.setTextColor(valColor[0], valColor[1], valColor[2]);
                 doc.setFontSize(10);
                 doc.setFont('helvetica', 'bold');
                 doc.text(value, x + 5, y + 15);
             };
     
             // Row 1
             drawCard(startX, currentY, cardWidth, cardHeight, "Total Income", `Rs. ${income.toLocaleString('en-IN')}`, [236, 253, 245], [167, 243, 208], [16, 185, 129], [4, 120, 87], icons.trendingUp);
             drawCard(startX + cardWidth + gap, currentY, cardWidth, cardHeight, "Total Expense", `Rs. ${expense.toLocaleString('en-IN')}`, [254, 242, 242], [254, 202, 202], [239, 68, 68], [185, 28, 28], icons.trendingDown);
             drawCard(startX + (cardWidth + gap)*2, currentY, cardWidth, cardHeight, "Net Balance", `Rs. ${balance.toLocaleString('en-IN')}`, [239, 246, 255], [191, 219, 254], [59, 130, 246], [29, 78, 216], icons.wallet);
             drawCard(startX + (cardWidth + gap)*3, currentY, cardWidth, cardHeight, "Savings Rate", `${savingsRate.toFixed(1)}%`, [250, 245, 255], [233, 213, 255], [168, 85, 247], [126, 34, 206], icons.rupee);

             currentY += cardHeight + gap;

             // Row 2
             drawCard(startX, currentY, cardWidth, cardHeight, "Transactions", `${totalTransactions}`, [248, 250, 252], [226, 232, 240], [100, 116, 139], [51, 65, 85], icons.fileText);
             drawCard(startX + cardWidth + gap, currentY, cardWidth, cardHeight, "Days Tracked", `${daysTracked} Days`, [238, 242, 255], [199, 210, 254], [99, 102, 241], [67, 56, 202], icons.calendar);
             drawCard(startX + (cardWidth + gap)*2, currentY, cardWidth, cardHeight, "Avg Daily Spend", `Rs. ${avgDailySpend.toFixed(0)}`, [255, 247, 237], [254, 215, 170], [249, 115, 22], [194, 65, 12], icons.creditCard);
             drawCard(startX + (cardWidth + gap)*3, currentY, cardWidth, cardHeight, "Highest Expense", `Rs. ${highestExpense.toLocaleString('en-IN')}`, [254, 252, 232], [254, 240, 138], [234, 179, 8], [161, 98, 7], icons.tag);

             currentY += cardHeight + 8;
     
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
                     margin: { left: startX, right: startX },
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
                         2: { cellWidth: 32 }, // Category
                         3: { cellWidth: 22 }, // Method
                         4: { cellWidth: 26 }, // Type
                         5: { halign: 'right', fontStyle: 'bold', cellWidth: 28 } // Amount
                     },
                     styles: { 
                         fontSize: 8, 
                         cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
                         font: "helvetica",
                         valign: 'middle',
                         overflow: 'ellipsize'
                     },
                     alternateRowStyles: { fillColor: [249, 250, 251] },
                     didParseCell: (data: any) => {
                         if (data.section === 'body') {
                             if (data.column.index === 4) {
                                 data.cell.styles.cellPadding = { top: 2.5, right: 2, bottom: 2.5, left: 7.5 };
                             }
                             if (data.column.index === 5) {
                                 const raw = data.cell.raw;
                                 if (raw && raw.startsWith('+')) {
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
                                 doc.addImage(icon, 'PNG', data.cell.x + 2.5, data.cell.y + (data.cell.height / 2) - 1.75, 3.5, 3.5);
                             }
                         }
                     }
                 });
                 
                 const finalY = (doc as any).lastAutoTable.finalY || currentY;
                 
                 // Add Summary at the end
                 doc.setFontSize(11);
                 doc.setFont("helvetica", "bold");
                 doc.setTextColor(31, 41, 55);
                 doc.text("Executive Summary", startX, finalY + 12);
                 
                 doc.setFontSize(8.5);
                 doc.setFont("helvetica", "normal");
                 doc.setTextColor(75, 85, 99);
                 
                 const summaryLines = [
                     `During this period, a total of ${totalTransactions} transactions were recorded.`,
                     `The total income was Rs. ${income.toLocaleString('en-IN')} and the total expense was Rs. ${expense.toLocaleString('en-IN')}.`,
                     `This resulted in a net balance of Rs. ${balance.toLocaleString('en-IN')}, with a savings rate of ${savingsRate.toFixed(1)}%.`,
                     `On average, the daily spend was Rs. ${avgDailySpend.toFixed(0)} over ${daysTracked} active days.`,
                     `The highest single expense recorded was Rs. ${highestExpense.toLocaleString('en-IN')}.`
                 ];
                 
                 let summaryY = finalY + 19;
                 summaryLines.forEach(line => {
                     doc.text(line, startX, summaryY);
                     summaryY += 5;
                 });

                 const pageCount = (doc as any).internal.getNumberOfPages();
                 for (let i = 1; i <= pageCount; i++) {
                     doc.setPage(i);
                     const pageSize = doc.internal.pageSize;
                     const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
                     doc.setFontSize(8);
                     doc.setTextColor(150, 150, 150);
                     doc.text(`Page ${i} of ${pageCount}`, startX, pageHeight - 8);
                     doc.text("Generated by Ceaznet - Detailed Financial Breakdown", 210 - startX, pageHeight - 8, { align: 'right' });
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
        let incomeCount = 0;
        let expenseCount = 0;
        let highestIncome = 0;
        let highestExpense = 0;
        const categoryTotals: Record<string, number> = {};
        const activeExpenseDaysSet = new Set<string>();
        
        transactionsForList.forEach(t => {
            const amt = Number(t.amount);
            const dateStr = t.transaction_date ? t.transaction_date.split('T')[0] : '';
            if (t.type === 'income') {
                income += amt;
                incomeCount++;
                if (amt > highestIncome) highestIncome = amt;
            }
            if (t.type === 'expense') {
                expense += amt;
                expenseCount++;
                if (amt > highestExpense) highestExpense = amt;
                categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
                if (dateStr) activeExpenseDaysSet.add(dateStr);
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

        const activeExpenseDays = activeExpenseDaysSet.size || 1;
        const dailyAverage = expense > 0 ? expense / activeExpenseDays : 0;
        const avgIncome = incomeCount > 0 ? income / incomeCount : 0;
        const avgExpense = expenseCount > 0 ? expense / expenseCount : 0;

        let daysInPeriod = 30;
        if (dateFilter === 'this-month') {
            const now = new Date();
            daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        } else if (dateFilter.includes('-')) {
            const [y, m] = dateFilter.split('-');
            daysInPeriod = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
        } else if (dateFilter === 'all') {
            daysInPeriod = Math.max(30, activeExpenseDaysSet.size);
        }

        const zeroSpendDays = Math.max(0, daysInPeriod - activeExpenseDaysSet.size);

        return { 
            income, 
            expense, 
            balance, 
            savingsRatio, 
            topCategories,
            incomeCount,
            expenseCount,
            highestIncome,
            highestExpense,
            avgIncome,
            avgExpense,
            dailyAverage,
            activeExpenseDays: activeExpenseDaysSet.size,
            zeroSpendDays,
            daysInPeriod
        };
    }, [transactionsForList, dateFilter]);

    return (
        <>
            <main 
                className="relative z-10 h-full overflow-y-auto bg-[#F9F6F2] dark:bg-black pt-20 md:pt-24 px-4 pb-0 scrollbar-hide"
                style={{
                    paddingBottom: 'var(--dev-console-padding, 0px)',
                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 24px, black 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 24px, black 100%)'
                }}
            >
                <div className="w-full max-w-[1600px] mx-auto flex flex-col">
                    
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
                                        <div className="absolute top-full left-0 mt-3 w-80 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 ring-1 ring-black/5 dark:ring-white/5">
                                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 rounded-t-2xl">
                                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Select Wallet</span>
                                                <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">{profiles.length + 1}</span>
                                            </div>

                                            {linkedNote && (
                                                <div className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10 border-b border-amber-100/50 dark:border-amber-900/20 flex items-center gap-2">
                                                    <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                                                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate">
                                                        linked to : {linkedNote.title || 'Untitled Note'}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="py-0 max-h-[60vh] overflow-y-auto scrollbar-hide divide-y divide-gray-100/60 dark:divide-gray-800/60">
                                                {/* Main Wallet (Default) */}
                                                <div className="relative group w-full">
                                                    <div
                                                        onClick={() => selectWalletProfile(DEFAULT_PROFILE)}
                                                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                                                            activeProfile.id === null 
                                                                ? 'bg-indigo-50/90 dark:bg-indigo-500/15 text-indigo-900 dark:text-white font-semibold' 
                                                                : 'hover:bg-gray-100/80 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
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

                                                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                            {activeProfile.id === null && <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />}

                                                            {/* 3-Dot Action Menu Toggle for Main Wallet */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleToggleWalletMenu(e, 'default')}
                                                                className={`p-1.5 transition-colors cursor-pointer ${
                                                                    activeMenuWalletId === 'default' 
                                                                        ? 'text-indigo-600 dark:text-indigo-400' 
                                                                        : 'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                                                }`}
                                                                title="Wallet options"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Custom Wallets */}
                                                {profiles.map(p => (
                                                    <div key={p.id} className="relative group w-full">
                                                        {editingProfileId === p.id ? (
                                                            <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-black border-y border-indigo-500/30">
                                                                <input 
                                                                    type="text"
                                                                    value={tempProfileName}
                                                                    onChange={(e) => setTempProfileName(e.target.value)}
                                                                    disabled={isRenamingProfileLoading}
                                                                    className="flex-1 bg-transparent text-sm font-medium focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
                                                                    autoFocus
                                                                    onKeyDown={(e) => { if(e.key === 'Enter' && !isRenamingProfileLoading) handleUpdateProfile(p.id); }}
                                                                />
                                                                <button 
                                                                    onClick={() => handleUpdateProfile(p.id)} 
                                                                    disabled={isRenamingProfileLoading || !tempProfileName.trim()}
                                                                    className="p-1 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center min-w-[24px]"
                                                                    title="Save"
                                                                >
                                                                    {isRenamingProfileLoading ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                                                    ) : (
                                                                        <Check className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                                <button 
                                                                    onClick={() => { if(!isRenamingProfileLoading) setEditingProfileId(null); }} 
                                                                    disabled={isRenamingProfileLoading}
                                                                    className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors cursor-pointer"
                                                                    title="Cancel"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => selectWalletProfile(p)}
                                                                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${
                                                                    activeProfile.id === p.id 
                                                                        ? 'bg-indigo-50/90 dark:bg-indigo-500/15 text-indigo-900 dark:text-white font-semibold' 
                                                                        : 'hover:bg-gray-100/80 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
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
                                                                
                                                                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                    {activeProfile.id === p.id && (
                                                                        <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                                                    )}

                                                                    {/* 3-Dot Action Menu Toggle for Custom Wallet */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleToggleWalletMenu(e, p.id)}
                                                                        className={`p-1.5 transition-colors cursor-pointer ${
                                                                            activeMenuWalletId === p.id 
                                                                                ? 'text-indigo-600 dark:text-indigo-400' 
                                                                                : 'text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                                                        }`}
                                                                        title="Wallet options"
                                                                    >
                                                                        <MoreVertical className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Floating 3-Dot Action Popover Dropdown (Fixed position - never clips) */}
                                            {activeMenuWalletId !== null && menuPosition && (
                                                <>
                                                    <div 
                                                        className="fixed inset-0 z-[99998]" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenuWalletId(null);
                                                            setMenuPosition(null);
                                                        }} 
                                                    />
                                                    
                                                    <div 
                                                        style={{ top: `${menuPosition.top}px`, right: `${menuPosition.right}px` }}
                                                        className="fixed w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl z-[99999] py-0 overflow-hidden ring-1 ring-black/10 dark:ring-white/10"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const targetId = activeMenuWalletId === 'default' ? null : activeMenuWalletId;
                                                                setActiveMenuWalletId(null);
                                                                setMenuPosition(null);
                                                                initiateNoteLink(e, targetId);
                                                            }}
                                                            className="w-full px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                        >
                                                            <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
                                                            <span>Link to Note</span>
                                                        </button>

                                                        {((activeMenuWalletId === 'default' && activeProfile.id === null) || (activeProfile.id === activeMenuWalletId)) && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuWalletId(null);
                                                                    setMenuPosition(null);
                                                                    handleSyncAll();
                                                                }}
                                                                disabled={isSyncing}
                                                                className="w-full px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                                                            >
                                                                {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" /> : <RotateCw className="w-3.5 h-3.5 text-emerald-500" />}
                                                                <span>{isSyncing ? 'Syncing...' : 'Sync All to Note'}</span>
                                                            </button>
                                                        )}

                                                        {activeMenuWalletId !== 'default' && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const profileToEdit = profiles.find(p => p.id === activeMenuWalletId);
                                                                        setActiveMenuWalletId(null);
                                                                        setMenuPosition(null);
                                                                        if (profileToEdit) {
                                                                            setEditingProfileId(profileToEdit.id);
                                                                            setTempProfileName(profileToEdit.name);
                                                                        }
                                                                    }}
                                                                    className="w-full px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5 text-amber-500" />
                                                                    <span>Rename Wallet</span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const walletToDelete = activeMenuWalletId;
                                                                        setActiveMenuWalletId(null);
                                                                        setMenuPosition(null);
                                                                        setProfileToDelete(walletToDelete);
                                                                    }}
                                                                    className="w-full px-4 py-3 text-left text-xs font-semibold text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-gray-100 dark:border-gray-800/80"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                                    <span>Delete Wallet</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Add New Wallet Footer */}
                                            <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/10 rounded-b-2xl">
                                                {isCreatingProfile ? (
                                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-black">
                                                        <input 
                                                            type="text" 
                                                            placeholder="Wallet Name" 
                                                            value={newProfileName}
                                                            onChange={e => setNewProfileName(e.target.value)}
                                                            disabled={isCreatingProfileLoading}
                                                            className="flex-1 bg-transparent text-sm font-medium focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
                                                            autoFocus
                                                            onKeyDown={(e) => { if(e.key === 'Enter' && !isCreatingProfileLoading) handleCreateProfile(); }}
                                                        />
                                                        <button 
                                                            onClick={handleCreateProfile} 
                                                            disabled={isCreatingProfileLoading || !newProfileName.trim()}
                                                            className="p-1 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 transition-colors cursor-pointer"
                                                            title="Create Wallet"
                                                        >
                                                            {isCreatingProfileLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <Check className="w-4 h-4" />}
                                                        </button>
                                                        <button 
                                                            onClick={() => { setIsCreatingProfile(false); setNewProfileName(''); }} 
                                                            disabled={isCreatingProfileLoading}
                                                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors cursor-pointer"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => setIsCreatingProfile(true)} 
                                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100/60 dark:hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-wide cursor-pointer"
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
                                        className={`relative group flex items-center justify-center p-2.5 bg-white dark:bg-black border border-amber-200/80 dark:border-amber-900/40 hover:bg-amber-50/80 dark:hover:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 ${isSyncing ? 'cursor-not-allowed opacity-75' : ''}`} 
                                        title={isSyncing ? 'Syncing transactions to note...' : `Synced to: ${linkedNote.title || 'Note'}. Click to force sync.`}
                                    >
                                        <div className="relative w-5 h-5 flex items-center justify-center">
                                            {isSyncing ? (
                                                <Loader2 className="w-5 h-5 animate-spin text-amber-600 dark:text-amber-400" />
                                            ) : (
                                                <>
                                                    <StickyNote className="w-5 h-5 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-105" />
                                                    <RotateCw className="w-2.5 h-2.5 absolute -bottom-1 -right-1 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 rounded-full p-0.5 ring-1 ring-amber-300 dark:ring-amber-700" />
                                                </>
                                            )}
                                        </div>
                                    </button>
                                )}

                                <div className="bg-white dark:bg-black p-1 rounded-xl border border-gray-200 dark:border-gray-800 flex shadow-sm">
                                    <button 
                                        onClick={() => setViewMode('list')}
                                        className={`px-2 sm:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                        title="List view"
                                    >
                                        <List className="w-4 h-4" />
                                        <span className="hidden sm:inline text-xs font-semibold">List</span>
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('analytics')}
                                        className={`px-2 sm:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${viewMode === 'analytics' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                        title="Analytics view"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        <span className="hidden sm:inline text-xs font-semibold">Analytics</span>
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('calendar')}
                                        className={`px-2 sm:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                        title="Calendar view"
                                    >
                                        <Calendar className="w-4 h-4" />
                                        <span className="hidden sm:inline text-xs font-semibold">Calendar</span>
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
                        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-6 relative z-30">
                            <div className="bg-white dark:bg-black p-1 rounded-xl border border-gray-200 dark:border-gray-800 flex shadow-sm w-fit relative flex-shrink-0" ref={monthDropdownRef}>
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
                                
                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {isMonthDropdownOpen && dateFilter !== 'all' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 6, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute top-[calc(100%+8px)] left-0 w-52 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 ring-1 ring-black/5 dark:ring-white/5 overflow-hidden py-1"
                                        >
                                            <div className="max-h-60 overflow-y-auto scrollbar-hide py-0">
                                                {availableMonths.map((month) => {
                                                    const now = new Date();
                                                    const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                                    const isCurrentMonth = month.id === currentMonthId;
                                                    const isSelected = dateFilter === month.id || (dateFilter === 'this-month' && isCurrentMonth);
                                                    return (
                                                        <button
                                                            key={month.id}
                                                            onClick={() => {
                                                                setDateFilter(isCurrentMonth ? 'this-month' : month.id);
                                                                setIsMonthDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 last:border-0 cursor-pointer ${
                                                                isSelected
                                                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold'
                                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900/60'
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

                            {/* Type Filter */}
                            {viewMode === 'list' && (
                                <>
                                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 flex-shrink-0"></div>
                                    <div className="bg-white dark:bg-black p-1 rounded-xl border border-gray-200 dark:border-gray-800 flex shadow-sm flex-shrink-0">
                                        <button onClick={() => setTypeFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'all' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>All</button>
                                        <button onClick={() => setTypeFilter('income')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>In</button>
                                        <button onClick={() => setTypeFilter('expense')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === 'expense' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>Out</button>
                                    </div>
                                </>
                            )}

                            {/* Category Filter */}
                            {viewMode === 'list' && (
                                <>
                                    <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 flex-shrink-0"></div>
                                    <div className="relative flex-shrink-0" ref={categoryDropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsCategoryDropdownOpen(prev => !prev)}
                                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                                categoryFilter !== 'all'
                                                    ? 'bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500'
                                                    : 'bg-white dark:bg-black border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <Tag className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="whitespace-nowrap max-w-[110px] xs:max-w-[140px] truncate">
                                                {categoryFilter === 'all' 
                                                    ? 'All Categories' 
                                                    : availableCategories.find(c => c.id === categoryFilter)?.label || categoryFilter}
                                            </span>
                                            {categoryFilter !== 'all' && (
                                                <span 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCategoryFilter('all');
                                                    }}
                                                    className="ml-0.5 p-0.5 hover:bg-white/20 rounded-full transition-colors"
                                                    title="Reset Category"
                                                >
                                                    <X className="w-3 h-3" />
                                                </span>
                                            )}
                                            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown Menu */}
                                        <AnimatePresence>
                                            {isCategoryDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute top-[calc(100%+8px)] left-0 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 ring-1 ring-black/5 dark:ring-white/5 flex flex-col overflow-hidden"
                                                >
                                                    {/* Header */}
                                                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5 rounded-t-2xl flex-shrink-0">
                                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Select Category</span>
                                                        <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                                                            {availableCategories.length}
                                                        </span>
                                                    </div>

                                                    {/* Search input inside dropdown */}
                                                    <div className="relative border-b border-gray-100 dark:border-gray-800 bg-transparent flex-shrink-0 flex items-center px-4 py-2.5">
                                                        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mr-2.5 pointer-events-none" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search category..."
                                                            value={categorySearch}
                                                            onChange={(e) => setCategorySearch(e.target.value)}
                                                            className="w-full bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none h-full"
                                                            autoFocus
                                                        />
                                                        {categorySearch && (
                                                            <button
                                                                onClick={() => setCategorySearch('')}
                                                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 flex-shrink-0 ml-1"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Options List */}
                                                    <div className="max-h-60 sm:max-h-64 overflow-y-auto scrollbar-hide divide-y divide-gray-100/60 dark:divide-gray-800/60 flex-1 rounded-b-2xl">
                                                        {/* All Categories Option */}
                                                        {(!categorySearch || 'all categories'.includes(categorySearch.toLowerCase())) && (
                                                            <button
                                                                onClick={() => {
                                                                    setCategoryFilter('all');
                                                                    setIsCategoryDropdownOpen(false);
                                                                    setCategorySearch('');
                                                                }}
                                                                className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 transition-colors cursor-pointer ${
                                                                    categoryFilter === 'all'
                                                                        ? 'bg-indigo-50/90 dark:bg-indigo-500/15 text-indigo-900 dark:text-white font-semibold'
                                                                        : 'hover:bg-gray-100/80 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                                        categoryFilter === 'all'
                                                                            ? 'bg-indigo-500 text-white'
                                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                                                    }`}>
                                                                        <Tag className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="flex flex-col text-left min-w-0">
                                                                        <span className="text-xs font-bold truncate">All Categories</span>
                                                                        <span className="text-[10px] opacity-60 truncate">Show all transactions</span>
                                                                    </div>
                                                                </div>
                                                                {categoryFilter === 'all' && <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                                                            </button>
                                                        )}

                                                        {filteredCategoriesList.map((cat) => {
                                                            const IconComp = cat.icon;
                                                            const isSelected = categoryFilter.toLowerCase() === cat.id.toLowerCase();
                                                            return (
                                                                <button
                                                                    key={cat.id}
                                                                    onClick={() => {
                                                                        setCategoryFilter(cat.id);
                                                                        setIsCategoryDropdownOpen(false);
                                                                        setCategorySearch('');
                                                                    }}
                                                                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 transition-colors cursor-pointer ${
                                                                        isSelected
                                                                            ? 'bg-indigo-50/90 dark:bg-indigo-500/15 text-indigo-900 dark:text-white font-semibold'
                                                                            : 'hover:bg-gray-100/80 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cat.bg} ${cat.color}`}>
                                                                            <IconComp className="w-4 h-4" />
                                                                        </div>
                                                                        <span className="truncate text-xs font-bold">{cat.label}</span>
                                                                    </div>
                                                                    {isSelected && <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                                                                </button>
                                                            );
                                                        })}

                                                        {filteredCategoriesList.length === 0 && (
                                                            <div className="py-6 text-center text-xs text-gray-400">
                                                                No matching categories found
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col gap-6 lg:gap-6 w-full lg:max-w-[1600px] mx-auto">
                        {/* TOP DASHBOARD METRICS */}
                        {!isSelectionMode && !searchQuery && (
                            viewMode === 'analytics' ? (
                                /* Analytics Mode Top Dashboard: 4 cards in 1 row */
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-4 flex-shrink-0">
                                    {/* Income Card */}
                                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-full min-h-[175px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                                                    <ArrowDownLeft className="w-4 h-4" />
                                                </div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider">Income</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                                {stats.incomeCount} {stats.incomeCount === 1 ? 'record' : 'records'}
                                            </span>
                                        </div>

                                        <div className="my-auto py-1">
                                            <p className="text-2xl xl:text-3xl font-black text-emerald-950 dark:text-emerald-100 tracking-tight truncate">
                                                +₹{stats.income.toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 truncate">
                                                {stats.incomeCount > 0 ? 'Total inflow received' : 'No income this period'}
                                            </p>
                                        </div>

                                        <div className="pt-2.5 border-t border-emerald-200/50 dark:border-emerald-800/30 flex justify-between items-center text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                            <span>Highest: <strong className="font-bold text-emerald-950 dark:text-emerald-200">+₹{stats.highestIncome.toLocaleString('en-IN')}</strong></span>
                                            <span>Avg: <strong className="font-bold text-emerald-950 dark:text-emerald-200">+₹{Math.round(stats.avgIncome).toLocaleString('en-IN')}</strong></span>
                                        </div>
                                    </div>

                                    {/* Expense Card */}
                                    <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-full min-h-[175px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                                                <div className="p-1.5 bg-rose-100 dark:bg-rose-900/50 rounded-lg">
                                                    <ArrowUpRight className="w-4 h-4" />
                                                </div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider">Expense</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100/80 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 truncate max-w-[110px]">
                                                {stats.topCategories[0] ? stats.topCategories[0].name : `${stats.expenseCount} entries`}
                                            </span>
                                        </div>

                                        <div className="my-auto py-1">
                                            <p className="text-2xl xl:text-3xl font-black text-rose-950 dark:text-rose-100 tracking-tight truncate">
                                                -₹{stats.expense.toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-[11px] font-medium text-rose-700/80 dark:text-rose-400/80 mt-0.5 truncate">
                                                {stats.expenseCount > 0 ? 'Total outflow spent' : 'No expenses this period'}
                                            </p>
                                        </div>

                                        <div className="pt-2.5 border-t border-rose-200/50 dark:border-rose-800/30 flex justify-between items-center text-[11px] text-rose-700/80 dark:text-rose-400/80">
                                            <span>Highest: <strong className="font-bold text-rose-950 dark:text-rose-200">-₹{stats.highestExpense.toLocaleString('en-IN')}</strong></span>
                                            <span>Avg: <strong className="font-bold text-rose-950 dark:text-rose-200">-₹{Math.round(stats.avgExpense).toLocaleString('en-IN')}</strong></span>
                                        </div>
                                    </div>

                                    {/* Daily Avg Card */}
                                    <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-full min-h-[175px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
                                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                                    <Activity className="w-4 h-4" />
                                                </div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider">Daily Avg</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                                                {stats.activeExpenseDays} active {stats.activeExpenseDays === 1 ? 'day' : 'days'}
                                            </span>
                                        </div>

                                        <div className="my-auto py-1">
                                            <p className="text-2xl xl:text-3xl font-black text-indigo-950 dark:text-indigo-100 tracking-tight truncate">
                                                ₹{Math.round(stats.dailyAverage).toLocaleString('en-IN')}
                                            </p>
                                            <p className="text-[11px] font-medium text-indigo-700/80 dark:text-indigo-400/80 mt-0.5 truncate">
                                                Average spend on active days
                                            </p>
                                        </div>

                                        <div className="pt-2.5 border-t border-indigo-200/50 dark:border-indigo-800/30 flex justify-between items-center text-[11px] text-indigo-700/80 dark:text-indigo-400/80">
                                            <span>Active: <strong className="font-bold text-indigo-950 dark:text-indigo-200">{stats.activeExpenseDays}d</strong></span>
                                            <span>Pacing: <strong className="font-bold text-indigo-950 dark:text-indigo-200">₹{Math.round(stats.dailyAverage * stats.daysInPeriod).toLocaleString('en-IN')}</strong></span>
                                        </div>
                                    </div>

                                    {/* Zero Spend Card */}
                                    <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all h-full min-h-[175px]">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                                <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                                                    <Wallet className="w-4 h-4" />
                                                </div>
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider">Zero Spend</span>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                                                {Math.round((stats.zeroSpendDays / stats.daysInPeriod) * 100)}% free
                                            </span>
                                        </div>

                                        <div className="my-auto py-1">
                                            <p className="text-2xl xl:text-3xl font-black text-amber-950 dark:text-amber-100 tracking-tight truncate">
                                                {stats.zeroSpendDays} <span className="text-xs font-semibold opacity-80">Days</span>
                                            </p>
                                            <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-400/80 mt-0.5 truncate">
                                                Days without any expense
                                            </p>
                                        </div>

                                        <div className="pt-2.5 border-t border-amber-200/50 dark:border-amber-800/30 flex justify-between items-center text-[11px] text-amber-700/80 dark:text-amber-400/80">
                                            <span>Cycle: <strong className="font-bold text-amber-950 dark:text-amber-200">{Math.round((stats.zeroSpendDays / stats.daysInPeriod) * 100)}%</strong></span>
                                            <span>Period: <strong className="font-bold text-amber-950 dark:text-amber-200">{stats.daysInPeriod}d</strong></span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Transaction and Calendar Modes Top Dashboard: 3 balanced columns */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 flex-shrink-0">
                                    {/* Net Saved Balance Card */}
                                    <div className="relative overflow-hidden rounded-2xl p-5 text-white bg-[#111] dark:bg-black border border-[#222] shadow-lg flex flex-col justify-between h-full min-h-[220px]">
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-transparent opacity-60"></div>
                                        <div className="absolute top-0 right-0 p-5 opacity-15 transform group-hover:scale-110 transition-transform duration-700 pointer-events-none">
                                            <Wallet className="w-28 h-28" />
                                        </div>
                                        
                                        <div className="relative z-10 flex flex-col justify-between flex-1 h-full">
                                            {/* Top Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5 text-gray-300">
                                                    <div className="p-1.5 bg-white/10 backdrop-blur-md rounded-lg">
                                                        <Wallet className="w-4 h-4 text-white" />
                                                    </div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-300">Net Saved</span>
                                                </div>
                                                <div className={`px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                                                    stats.savingsRatio >= 20 
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                                        : stats.savingsRatio > 0 
                                                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                                            : 'bg-white/10 text-gray-400 border-white/10'
                                                }`}>
                                                    <PiggyBank className="w-3 h-3 flex-shrink-0" />
                                                    <span>{stats.savingsRatio.toFixed(1)}% Saved</span>
                                                </div>
                                            </div>

                                            {/* Center Primary Value & Supporting Metrics */}
                                            <div className="my-auto py-1">
                                                <h2 className="text-3xl xl:text-4xl font-black tracking-tight truncate">
                                                    {stats.balance >= 0 ? '+' : '-'}₹{Math.abs(stats.balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </h2>
                                                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                                                    <span className="truncate">
                                                        {stats.balance >= 0 ? 'Net surplus retained' : 'Net deficit spent'}
                                                    </span>
                                                    <span className="font-semibold text-gray-300 flex-shrink-0 ml-2">
                                                        {stats.incomeCount + stats.expenseCount} {stats.incomeCount + stats.expenseCount === 1 ? 'transaction' : 'transactions'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Bottom Divider & Metrics */}
                                            <div className="pt-2.5 border-t border-white/10">
                                                <div className="flex justify-between items-center text-[11px] text-gray-300 mb-1.5">
                                                    <span>Inflow: <strong className="text-emerald-400 font-bold">+₹{stats.income.toLocaleString('en-IN')}</strong></span>
                                                    <span>Outflow: <strong className="text-rose-400 font-bold">-₹{stats.expense.toLocaleString('en-IN')}</strong></span>
                                                </div>
                                                {stats.expense > 0 ? (
                                                    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/10">
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
                                                ) : (
                                                    <div className="h-1.5 w-full rounded-full bg-white/10" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Daily Safe Limit / Budget Card */}
                                    <div className="md:col-span-1 h-full min-h-[220px]">
                                        <FinancialFitnessCard transactions={transactionsForList} budget={budget} period={dateFilter} className="h-full" />
                                    </div>

                                    {/* Vertically Stacked Income & Expense Cards */}
                                    <div className="md:col-span-2 lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-3.5 h-full">
                                        {/* Income Card */}
                                        <div className="lg:flex-1 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all min-h-[102px]">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                                    <div className="p-1 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                                                        <ArrowDownLeft className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Income</span>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                                                    {stats.incomeCount} {stats.incomeCount === 1 ? 'record' : 'records'}
                                                </span>
                                            </div>
                                            
                                            <div>
                                                <p className="text-xl font-black text-emerald-950 dark:text-emerald-100 tracking-tight truncate">
                                                    +₹{stats.income.toLocaleString('en-IN')}
                                                </p>
                                            </div>

                                            <div className="mt-auto pt-2 border-t border-emerald-200/50 dark:border-emerald-800/30 flex justify-between items-center text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                                <span>Highest: <strong className="font-bold text-emerald-950 dark:text-emerald-200">+₹{stats.highestIncome.toLocaleString('en-IN')}</strong></span>
                                                <span>Avg: <strong className="font-bold text-emerald-950 dark:text-emerald-200">+₹{Math.round(stats.avgIncome).toLocaleString('en-IN')}</strong></span>
                                            </div>
                                        </div>

                                        {/* Expense Card */}
                                        <div className="lg:flex-1 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40 rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-all min-h-[102px]">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                                                    <div className="p-1 bg-rose-100 dark:bg-rose-900/50 rounded-lg">
                                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Expense</span>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100/80 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 truncate max-w-[100px]">
                                                    {stats.topCategories[0] ? stats.topCategories[0].name : `${stats.expenseCount} entries`}
                                                </span>
                                            </div>
                                            
                                            <div>
                                                <p className="text-xl font-black text-rose-950 dark:text-rose-100 tracking-tight truncate">
                                                    -₹{stats.expense.toLocaleString('en-IN')}
                                                </p>
                                            </div>

                                            <div className="mt-auto pt-2 border-t border-rose-200/50 dark:border-rose-800/30 flex justify-between items-center text-[11px] text-rose-700/80 dark:text-rose-400/80">
                                                <span>Highest: <strong className="font-bold text-rose-950 dark:text-rose-200">-₹{stats.highestExpense.toLocaleString('en-IN')}</strong></span>
                                                <span>Avg: <strong className="font-bold text-rose-950 dark:text-rose-200">-₹{Math.round(stats.avgExpense).toLocaleString('en-IN')}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        <hr className="border-t border-gray-200 dark:border-white/10" />

                        {/* DATA VIEW CONTAINER */}
                        <div className="mx-auto w-full max-w-none pb-0 flex flex-col min-w-0">
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <div className={viewMode === 'analytics' ? '' : 'hidden'}>
                                        <FinanceAnalytics transactions={transactionsByDate} period={dateFilter} />
                                    </div>
                                    <div className={viewMode === 'calendar' ? '' : 'hidden'}>
                                        <FinanceCalendar transactions={transactions} onDateClick={handleDateClick} />
                                    </div>
                                    <div className={viewMode === 'list' ? '' : 'hidden'}>
                                        <TransactionList 
                                            transactions={transactionsForList} 
                                            onDelete={promptDelete}
                                            onEdit={handleEdit} 
                                            onView={handleView}
                                            onDuplicate={handleDuplicate}
                                            isSelectionMode={isSelectionMode}
                                            selectedIds={selectedIds}
                                            onToggleSelection={handleToggleSelection}
                                            onLongPress={handleLongPress}
                                            customCategories={customCategories}
                                        />
                                    </div>
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
                    className="fixed right-6 z-40 w-16 h-16 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 group"
                    style={{ bottom: 'calc(var(--dev-console-padding, 0px) + 1.5rem)' }}
                    title="Add Record"
                >
                    <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                </button>
            )}

            {isSelectionMode && (
                <div 
                    className="fixed right-4 sm:right-6 z-40 flex items-center justify-end pointer-events-none"
                    style={{ bottom: 'calc(var(--dev-console-padding, 0px) + 0.75rem)' }}
                >
                    <div 
                        className="pointer-events-auto flex items-center gap-2 p-2 sm:p-2.5 bg-white/95 dark:bg-black/95 backdrop-blur-md border border-neutral-200 dark:border-gray-800 rounded-2xl"
                        style={{ borderRadius: 'var(--app-border-radius, 1rem)' }}
                    >
                        <div className="flex items-center gap-2 pl-1 pr-1.5">
                            <button 
                                onClick={cancelSelectionMode} 
                                className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-gray-800 text-neutral-500 dark:text-gray-400 transition-colors"
                                title="Cancel selection"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                                {selectedIds.size} Selected
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-neutral-200 dark:border-gray-800 pl-2">
                            <button
                                onClick={handleToggleSelectAll}
                                className="p-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex items-center gap-1"
                            >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span className="hidden xs:inline">{selectedIds.size === transactionsForList.length ? 'Deselect' : 'Select All'}</span>
                            </button>
                            <button
                                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                                disabled={selectedIds.size === 0}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ borderRadius: 'calc(var(--app-border-radius, 1rem) * 0.75)' }}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
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
                    <div className="relative w-full max-w-sm bg-white dark:bg-black rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
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
                    <div className="relative w-full max-w-sm bg-white dark:bg-black rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
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
                                    onDuplicate={(t) => { setIsCalendarModalOpen(false); handleDuplicate(t); }}
                                    isSelectionMode={false}
                                    customCategories={customCategories}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={!!deleteId}
                onClose={() => {
                    setIsDeletingTransaction(false);
                    setDeleteId(null);
                }}
                onConfirm={executeDelete}
                title="Delete Transaction"
                message="Are you sure you want to permanently delete this transaction? This action cannot be undone."
                confirmButtonText="Delete"
                confirmButtonVariant="danger"
                isLoading={isDeletingTransaction}
            />

            <ConfirmationModal
                isOpen={isBulkDeleteConfirmOpen}
                onClose={() => {
                    setIsBulkDeleting(false);
                    setIsBulkDeleteConfirmOpen(false);
                }}
                onConfirm={executeBulkDelete}
                title={`Delete ${selectedIds.size} Transactions?`}
                message="This action cannot be undone. These records will be permanently removed."
                confirmButtonText="Delete All"
                confirmButtonVariant="danger"
                isLoading={isBulkDeleting}
            />
            
            <ConfirmationModal
                isOpen={!!profileToDelete}
                onClose={() => {
                    setIsDeletingProfile(false);
                    setProfileToDelete(null);
                }}
                onConfirm={handleDeleteProfile}
                title="Delete Wallet?"
                message="Are you sure you want to permanently delete this wallet? All transactions inside it will also be lost."
                confirmButtonText="Delete Forever"
                confirmButtonVariant="danger"
                isLoading={isDeletingProfile}
            />
        </>
    );
};

export default FinanceView;
