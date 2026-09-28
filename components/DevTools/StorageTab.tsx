import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Icon } from '@iconify/react';
import { formatSize } from './utils';
import { InteractivePayloadViewer } from './InteractivePayloadViewer';
import { StorageDetailModal } from './StorageDetailModal';
import { StorageStatsView } from './StorageStatsView';
import { StorageDocsView } from './StorageDocsView';
import ConfirmationModal from '../ConfirmationModal';

export interface StorageTabProps {
    isOpen: boolean;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
    onStorageCountChange?: (count: number) => void;
}

export interface StorageItem {
    key: string;
    value: string;
    size: number;
    type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
    isJson: boolean;
    parsed: any;
}

export const StorageTab: React.FC<StorageTabProps> = ({
    isOpen,
    copiedId,
    handleCopy,
    onStorageCountChange
}) => {
    // Sub-Tab state matching DevicesTab ('local' | 'session' | 'cookies' | 'stats' | 'docs')
    const [subTab, setSubTab] = useState<'local' | 'session' | 'cookies' | 'stats' | 'docs'>('local');

    // Storage items states
    const [localItems, setLocalItems] = useState<StorageItem[]>([]);
    const [sessionItems, setSessionItems] = useState<StorageItem[]>([]);
    const [cookieItems, setCookieItems] = useState<StorageItem[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    // Search and Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'key' | 'size' | 'type'>('key');
    const [sortAsc, setSortAsc] = useState<boolean>(true);

    // Add Key Form state & FAB toggle
    const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [isJsonInput, setIsJsonInput] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

    // Detailed Inspector Modal state
    const [inspectItem, setInspectItem] = useState<StorageItem | null>(null);
    const [inspectStorageType, setInspectStorageType] = useState<'localStorage' | 'sessionStorage' | 'cookies'>('localStorage');

    // Import Modal state
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importJsonText, setImportJsonText] = useState('');
    const [importError, setImportError] = useState<string | null>(null);
    const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

    // Clear Storage Modal state
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

    // File input ref for upload
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Parse item helper
    const parseStorageValue = (key: string, value: string): StorageItem => {
        const size = (key.length + value.length) * 2; // UTF-16 byte estimation
        const trimmed = value.trim();

        if (trimmed === 'null') {
            return { key, value, size, type: 'null', isJson: true, parsed: null };
        }
        if (trimmed === 'true' || trimmed === 'false') {
            return { key, value, size, type: 'boolean', isJson: true, parsed: trimmed === 'true' };
        }
        if (!isNaN(Number(trimmed)) && trimmed !== '') {
            return { key, value, size, type: 'number', isJson: true, parsed: Number(trimmed) };
        }

        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                const parsed = JSON.parse(trimmed);
                const type = Array.isArray(parsed) ? 'array' : 'object';
                return { key, value, size, type, isJson: true, parsed };
            } catch {}
        }

        return { key, value, size, type: 'string', isJson: false, parsed: value };
    };

    // Reload all storage items
    const reloadStorage = () => {
        try {
            // 1. LocalStorage
            const lItems: StorageItem[] = [];
            if (typeof window !== 'undefined' && window.localStorage) {
                for (let i = 0; i < window.localStorage.length; i++) {
                    const k = window.localStorage.key(i);
                    if (k !== null) {
                        const val = window.localStorage.getItem(k) || '';
                        lItems.push(parseStorageValue(k, val));
                    }
                }
            }
            setLocalItems(lItems);

            // 2. SessionStorage
            const sItems: StorageItem[] = [];
            if (typeof window !== 'undefined' && window.sessionStorage) {
                for (let i = 0; i < window.sessionStorage.length; i++) {
                    const k = window.sessionStorage.key(i);
                    if (k !== null) {
                        const val = window.sessionStorage.getItem(k) || '';
                        sItems.push(parseStorageValue(k, val));
                    }
                }
            }
            setSessionItems(sItems);

            // 3. Cookies
            const cItems: StorageItem[] = [];
            if (typeof document !== 'undefined' && document.cookie) {
                const rawCookies = document.cookie.split(';');
                rawCookies.forEach(raw => {
                    const trimmed = raw.trim();
                    if (trimmed) {
                        const eqIdx = trimmed.indexOf('=');
                        const k = eqIdx !== -1 ? decodeURIComponent(trimmed.slice(0, eqIdx)) : trimmed;
                        const val = eqIdx !== -1 ? decodeURIComponent(trimmed.slice(eqIdx + 1)) : '';
                        cItems.push(parseStorageValue(k, val));
                    }
                });
            }
            setCookieItems(cItems);

            // Notify parent count of active items
            if (onStorageCountChange) {
                onStorageCountChange(lItems.length + sItems.length + cItems.length);
            }
        } catch (err) {
            console.error('Failed to load storage items:', err);
        }
    };

    // Load initial storage and set listener
    useEffect(() => {
        reloadStorage();

        const handleStorageChange = () => reloadStorage();
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('storage-update', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('storage-update', handleStorageChange);
        };
    }, []);

    // Get current items based on active subTab
    const currentItems = useMemo(() => {
        if (subTab === 'local') return localItems;
        if (subTab === 'session') return sessionItems;
        if (subTab === 'cookies') return cookieItems;
        return [];
    }, [subTab, localItems, sessionItems, cookieItems]);

    // Active storage engine label
    const currentStorageType = useMemo((): 'localStorage' | 'sessionStorage' | 'cookies' => {
        if (subTab === 'session') return 'sessionStorage';
        if (subTab === 'cookies') return 'cookies';
        return 'localStorage';
    }, [subTab]);

    // Filter & Sort items
    const filteredItems = useMemo(() => {
        return currentItems.filter(item => {
            const matchesSearch = item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.value.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'all' || item.type === typeFilter;
            return matchesSearch && matchesType;
        }).sort((a, b) => {
            let res = 0;
            if (sortBy === 'key') res = a.key.localeCompare(b.key);
            else if (sortBy === 'size') res = a.size - b.size;
            else if (sortBy === 'type') res = a.type.localeCompare(b.type);
            return sortAsc ? res : -res;
        });
    }, [currentItems, searchQuery, typeFilter, sortBy, sortAsc]);

    // Currently selected active item for preview pane
    const activeSelectedItem = useMemo(() => {
        if (!selectedKey) return filteredItems[0] || null;
        return currentItems.find(it => it.key === selectedKey) || filteredItems[0] || null;
    }, [selectedKey, currentItems, filteredItems]);

    // Handle Item Addition
    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKey.trim()) {
            setAddError('Key name is required');
            return;
        }

        try {
            let valToStore = newValue;
            if (isJsonInput) {
                // Verify valid JSON
                JSON.parse(newValue);
            }

            if (subTab === 'local') {
                window.localStorage.setItem(newKey.trim(), valToStore);
            } else if (subTab === 'session') {
                window.sessionStorage.setItem(newKey.trim(), valToStore);
            } else if (subTab === 'cookies') {
                document.cookie = `${encodeURIComponent(newKey.trim())}=${encodeURIComponent(valToStore)}; path=/; max-age=604800; SameSite=Lax`;
            }

            setNewKey('');
            setNewValue('');
            setAddError(null);
            setAddSuccessMessage(`Saved to ${subTab === 'local' ? 'LocalStorage' : subTab === 'session' ? 'SessionStorage' : 'Cookies'}`);
            setTimeout(() => setAddSuccessMessage(null), 3000);
            reloadStorage();
            setSelectedKey(newKey.trim());
        } catch (err: any) {
            setAddError(err.message || 'Failed to save item');
        }
    };

    // Handle Item Deletion
    const handleDeleteItem = (keyToDelete: string) => {
        try {
            if (subTab === 'local') {
                window.localStorage.removeItem(keyToDelete);
            } else if (subTab === 'session') {
                window.sessionStorage.removeItem(keyToDelete);
            } else if (subTab === 'cookies') {
                document.cookie = `${encodeURIComponent(keyToDelete)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            }
            if (selectedKey === keyToDelete) setSelectedKey(null);
            reloadStorage();
        } catch (err) {
            console.error('Failed to delete item:', err);
        }
    };

    // Handle In-Place Save from Detail Modal
    const handleSaveDetailEdit = (itemKey: string, updatedValue: string) => {
        if (inspectStorageType === 'localStorage') {
            window.localStorage.setItem(itemKey, updatedValue);
        } else if (inspectStorageType === 'sessionStorage') {
            window.sessionStorage.setItem(itemKey, updatedValue);
        } else if (inspectStorageType === 'cookies') {
            document.cookie = `${encodeURIComponent(itemKey)}=${encodeURIComponent(updatedValue)}; path=/; max-age=604800; SameSite=Lax`;
        }
        reloadStorage();
    };

    // Handle Clear All
    const handleExecuteClear = () => {
        try {
            if (subTab === 'local') {
                window.localStorage.clear();
            } else if (subTab === 'session') {
                window.sessionStorage.clear();
            } else if (subTab === 'cookies') {
                const cookies = document.cookie.split(';');
                cookies.forEach(c => {
                    const eqIdx = c.indexOf('=');
                    const name = eqIdx > -1 ? c.substr(0, eqIdx).trim() : c.trim();
                    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                });
            }
            setSelectedKey(null);
            setIsClearConfirmOpen(false);
            reloadStorage();
        } catch (err) {
            console.error('Failed to clear storage:', err);
        }
    };

    // Export Current Storage
    const handleExportJson = () => {
        try {
            const dump: Record<string, any> = {};
            currentItems.forEach(it => {
                dump[it.key] = it.isJson ? it.parsed : it.value;
            });

            const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${currentStorageType}_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    // Listen to DevTools top header actions (Export, Import, Clear)
    useEffect(() => {
        const handleExport = () => handleExportJson();
        const handleImport = () => fileInputRef.current?.click();
        const handleClear = () => {
            if (subTab === 'local' || subTab === 'session' || subTab === 'cookies') {
                setIsClearConfirmOpen(true);
            }
        };

        window.addEventListener('dev-storage-export', handleExport);
        window.addEventListener('dev-storage-import', handleImport);
        window.addEventListener('dev-storage-clear', handleClear);

        return () => {
            window.removeEventListener('dev-storage-export', handleExport);
            window.removeEventListener('dev-storage-import', handleImport);
            window.removeEventListener('dev-storage-clear', handleClear);
        };
    }, [currentItems, currentStorageType, subTab]);

    // Import JSON Action
    const handleExecuteImport = () => {
        try {
            const parsed = JSON.parse(importJsonText);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                setImportError('Import JSON must be a key-value object');
                return;
            }

            if (importMode === 'replace') {
                if (subTab === 'local') window.localStorage.clear();
                else if (subTab === 'session') window.sessionStorage.clear();
            }

            Object.entries(parsed).forEach(([k, v]) => {
                const stringVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
                if (subTab === 'local') window.localStorage.setItem(k, stringVal);
                else if (subTab === 'session') window.sessionStorage.setItem(k, stringVal);
                else if (subTab === 'cookies') document.cookie = `${encodeURIComponent(k)}=${encodeURIComponent(stringVal)}; path=/; max-age=604800; SameSite=Lax`;
            });

            setIsImportModalOpen(false);
            setImportJsonText('');
            setImportError(null);
            reloadStorage();
        } catch (err: any) {
            setImportError(`Invalid JSON: ${err.message}`);
        }
    };

    // File Upload Handler for JSON
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setImportJsonText(content);
            setIsImportModalOpen(true);
        };
        reader.readAsText(file);
    };

    // Open detailed inspector
    const handleOpenDetailModal = (item: StorageItem, storageType: 'localStorage' | 'sessionStorage' | 'cookies') => {
        setInspectItem(item);
        setInspectStorageType(storageType);
    };

    // Calculate total size of current storage
    const currentTotalSize = useMemo(() => {
        return currentItems.reduce((acc, it) => acc + it.size, 0);
    }, [currentItems]);

    // LocalStorage quota metrics (5MB)
    const quotaPct = Math.min(100, (currentTotalSize / (5 * 1024 * 1024)) * 100);

    if (!isOpen) return null;

    return (
        <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden bg-[var(--dev-console-bg)] text-[var(--dev-console-text)]">
            {/* Top Sub-Tabs Navigation (Styled exactly like DevicesTab) */}
            <div className="flex-none px-2 sm:px-3 h-9 bg-[var(--dev-console-tab-bg)] border-b border-[var(--dev-console-border)] flex items-center overflow-x-auto select-none scrollbar-none">
                <div className="flex items-center gap-1 h-full shrink-0">
                    {/* 1. Local Storage Sub-Tab */}
                    <button
                        onClick={() => setSubTab('local')}
                        className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                            subTab === 'local'
                                ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                        }`}
                        title="Local Storage"
                    >
                        <Icon icon="solar:database-linear" className="w-3.5 h-3.5 shrink-0" />
                        <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                            subTab === 'local' ? 'max-w-[140px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                        }`}>
                            Local Storage
                        </span>
                        <span className={`ml-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                            subTab === 'local' ? 'bg-[#007fd4]/15 text-[#007fd4]' : 'bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)]'
                        }`}>
                            {localItems.length}
                        </span>
                    </button>

                    {/* 2. Session Storage Sub-Tab */}
                    <button
                        onClick={() => setSubTab('session')}
                        className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                            subTab === 'session'
                                ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                        }`}
                        title="Session Storage"
                    >
                        <Icon icon="solar:server-square-linear" className={`w-3.5 h-3.5 shrink-0 ${subTab === 'session' ? 'text-purple-600 dark:text-purple-400' : ''}`} />
                        <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                            subTab === 'session' ? 'max-w-[150px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                        }`}>
                            Session Storage
                        </span>
                        <span className={`ml-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                            subTab === 'session' ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30' : 'bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)]'
                        }`}>
                            {sessionItems.length}
                        </span>
                    </button>

                    {/* 3. Cookies Sub-Tab */}
                    <button
                        onClick={() => setSubTab('cookies')}
                        className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                            subTab === 'cookies'
                                ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                        }`}
                        title="Cookies"
                    >
                        <Icon icon="tabler:cookie" className={`w-3.5 h-3.5 shrink-0 ${subTab === 'cookies' ? 'text-amber-600 dark:text-amber-400' : ''}`} />
                        <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                            subTab === 'cookies' ? 'max-w-[120px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                        }`}>
                            Cookies
                        </span>
                        <span className={`ml-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                            subTab === 'cookies' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30' : 'bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)]'
                        }`}>
                            {cookieItems.length}
                        </span>
                    </button>

                    {/* 4. Stats & Analytics Sub-Tab */}
                    <button
                        onClick={() => setSubTab('stats')}
                        className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                            subTab === 'stats'
                                ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                        }`}
                        title="Storage Analytics & Deep Stats"
                    >
                        <Icon icon="solar:chart-2-linear" className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                        <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                            subTab === 'stats' ? 'max-w-[150px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                        }`}>
                            Storage Stats
                        </span>
                        <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] font-mono uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold">
                            All
                        </span>
                    </button>

                    {/* 5. Guide / Documentation Sub-Tab */}
                    <button
                        onClick={() => setSubTab('docs')}
                        className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                            subTab === 'docs'
                                ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                        }`}
                        title="Storage API Documentation & Guide"
                    >
                        <Icon icon="solar:book-linear" className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                        <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                            subTab === 'docs' ? 'max-w-[140px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                        }`}>
                            Storage Guide
                        </span>
                    </button>
                </div>
            </div>

            {/* View Dispatcher based on SubTab */}
            {subTab === 'stats' ? (
                <StorageStatsView
                    localItems={localItems}
                    sessionItems={sessionItems}
                    cookieItems={cookieItems}
                    onSelectKey={(type, key) => {
                        const targetSubTab = type === 'localStorage' ? 'local' : type === 'sessionStorage' ? 'session' : 'cookies';
                        setSubTab(targetSubTab);
                        setSelectedKey(key);
                    }}
                    copiedId={copiedId}
                    handleCopy={handleCopy}
                />
            ) : subTab === 'docs' ? (
                <StorageDocsView copiedId={copiedId} handleCopy={handleCopy} />
            ) : (
                /* Primary Container-less Two-Column Responsive Storage Manager View */
                <div className="flex-1 flex flex-col md:flex-row w-full h-full md:min-h-0 overflow-y-auto md:overflow-hidden bg-[var(--dev-console-bg)]">
                    {/* Hidden file input for JSON Import trigger from main header (always mounted) */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".json,application/json"
                        className="hidden"
                    />

                    {/* Left Column: Flat Operations / Add Key / Quota Meter - Toggled via FAB */}
                    {isAddEntryOpen && (
                        <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--dev-console-border)] p-3 sm:p-4 flex flex-col gap-4 overflow-visible md:overflow-y-auto md:h-full md:min-h-0 scrollbar-thin scrollbar-thumb-[var(--dev-console-border)]">
                            <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-2.5 shrink-0">
                                <h3 className="text-xs sm:text-sm font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2">
                                    {subTab === 'local' ? <Icon icon="solar:database-linear" className="w-4 h-4 text-[#007fd4] shrink-0" /> :
                                     subTab === 'session' ? <Icon icon="solar:server-square-linear" className="w-4 h-4 text-purple-500 shrink-0" /> :
                                     <Icon icon="tabler:cookie" className="w-4 h-4 text-amber-500 shrink-0" />}
                                    <span>Add or Update Entry</span>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)]">
                                        {currentItems.length} {currentItems.length === 1 ? 'item' : 'items'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddEntryOpen(false)}
                                        className="p-1 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-tab-bg)] transition-colors bg-transparent border-0 cursor-pointer"
                                        title="Close Add Entry panel"
                                    >
                                        <Icon icon="tabler:x" className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Flat Quota & Footprint Meter */}
                            <div className="flex flex-col gap-1.5 pb-3 border-b border-[var(--dev-console-border)]">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-[var(--dev-console-text-muted)] uppercase font-mono text-[10px] tracking-wider">Storage Footprint</span>
                                    <span className="font-mono font-bold text-[#007fd4]">{formatSize(currentTotalSize)}</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] overflow-hidden">
                                    <div 
                                        className="h-full bg-[#007fd4] rounded-full transition-all duration-300"
                                        style={{ width: `${Math.max(2, quotaPct)}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-[var(--dev-console-text-muted)] font-mono">
                                    <span>~5 MB Limit</span>
                                    <span>{quotaPct.toFixed(2)}% used</span>
                                </div>
                            </div>

                            {/* Flat Quick Add Key Form */}
                            <form onSubmit={handleAddItem} className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-[var(--dev-console-text-muted)] uppercase font-mono">
                                        Key Name
                                    </label>
                                    <input
                                        className="w-full bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono"
                                        placeholder="e.g. app_user_settings"
                                        value={newKey}
                                        onChange={e => {
                                            setNewKey(e.target.value);
                                            setAddError(null);
                                        }}
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-[var(--dev-console-text-muted)] uppercase font-mono">
                                            Value Payload
                                        </label>
                                        <button
                                            type="button"
                                            role="checkbox"
                                            aria-checked={isJsonInput}
                                            onClick={() => setIsJsonInput(!isJsonInput)}
                                            className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] select-none bg-transparent border-0 p-0 outline-none group"
                                        >
                                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-all duration-150 border ${
                                                isJsonInput 
                                                    ? 'bg-[#007fd4] border-[#007fd4] text-white' 
                                                    : 'bg-[var(--dev-console-tab-bg)] border-[var(--dev-console-border)] group-hover:border-[var(--dev-console-text-muted)]'
                                            }`}>
                                                {isJsonInput && <Icon icon="tabler:check" className="w-2.5 h-2.5 stroke-[3]" />}
                                            </div>
                                            <span className={isJsonInput ? 'text-[var(--dev-console-text)] font-semibold' : ''}>JSON Validation</span>
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full h-20 bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono resize-none leading-relaxed"
                                        placeholder={isJsonInput ? '{\n  "theme": "dark"\n}' : 'Enter value string...'}
                                        value={newValue}
                                        onChange={e => {
                                            setNewValue(e.target.value);
                                            setAddError(null);
                                        }}
                                    />
                                </div>

                                {addError && (
                                    <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5 font-sans">
                                        <Icon icon="solar:danger-triangle-linear" className="w-3.5 h-3.5 shrink-0" />
                                        <span>{addError}</span>
                                    </div>
                                )}

                                {addSuccessMessage && (
                                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5 font-sans">
                                        <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5 shrink-0" />
                                        <span>{addSuccessMessage}</span>
                                    </div>
                                )}

                                <div className="flex justify-end pt-1">
                                    <button
                                        type="submit"
                                        className="w-auto py-1.5 px-3 bg-[#007fd4] hover:bg-[#006bb3] text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs border-0 whitespace-nowrap"
                                    >
                                        <Icon icon="tabler:plus" className="w-3.5 h-3.5" />
                                        <span>Save to {subTab === 'local' ? 'LocalStorage' : subTab === 'session' ? 'SessionStorage' : 'Cookies'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Right Column: Key-Values List & Preview */}
                    <div className="flex-1 flex flex-col shrink-0 min-h-[400px] md:min-h-0 md:shrink-1 overflow-visible md:overflow-hidden md:h-full">
                        {/* Search and Filters Bar with adjacent Import/Export */}
                        <div className="flex-none p-2 sm:p-2.5 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-wrap items-center justify-between gap-2">
                            {/* Search input + adjacent Import / Export buttons */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                <div className="flex-1 relative">
                                    <Icon icon="solar:magnifer-linear" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dev-console-text-muted)]" />
                                    <input
                                        type="text"
                                        placeholder="Search key or payload..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-7 py-1 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] font-mono placeholder:font-sans"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] bg-transparent border-0 cursor-pointer"
                                        >
                                            <Icon icon="tabler:x" className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Import and Export Buttons adjacent to search bar */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-7 px-2 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] cursor-pointer text-xs flex items-center gap-1.5 transition-colors"
                                        title={`Import JSON into ${currentStorageType}`}
                                    >
                                        <Icon icon="solar:upload-minimalistic-linear" className="w-3.5 h-3.5 text-[#007fd4]" />
                                        <span className="hidden sm:inline font-mono text-[11px]">Import</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportJson}
                                        className="h-7 px-2 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] cursor-pointer text-xs flex items-center gap-1.5 transition-colors"
                                        title={`Export ${currentStorageType} as JSON`}
                                    >
                                        <Icon icon="solar:download-minimalistic-linear" className="w-3.5 h-3.5 text-emerald-500" />
                                        <span className="hidden sm:inline font-mono text-[11px]">Export</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {/* Type Filter Buttons */}
                                <div className="flex items-center gap-0.5 sm:gap-1 bg-[var(--dev-console-bg)] p-0.5 rounded border border-[var(--dev-console-border)] text-[10px] font-mono overflow-x-auto">
                                    {(['all', 'object', 'array', 'string', 'number', 'boolean'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setTypeFilter(t)}
                                            className={`px-1.5 sm:px-2 py-0.5 rounded capitalize transition-colors cursor-pointer whitespace-nowrap border-0 ${
                                                typeFilter === t
                                                    ? 'bg-[#007fd4] text-white font-bold'
                                                    : 'text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] bg-transparent'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>

                                {/* Sort Toggle */}
                                <button
                                    onClick={() => setSortAsc(!sortAsc)}
                                    className="h-7 p-1 px-2 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] cursor-pointer text-xs flex items-center gap-1 shrink-0"
                                    title="Toggle Sort Direction"
                                >
                                    <Icon icon="tabler:arrows-sort" className="w-3.5 h-3.5" />
                                    <span className="font-mono text-[10px]">{sortAsc ? 'ASC' : 'DESC'}</span>
                                </button>
                            </div>
                        </div>

                        {/* List and Quick Preview Grid */}
                        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                            {/* Key List Items */}
                            <div className="w-full md:w-[48%] border-b md:border-b-0 md:border-r border-[var(--dev-console-border)] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] flex flex-col">
                                {filteredItems.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--dev-console-text-muted)] text-xs gap-2">
                                        <Icon icon="solar:database-linear" className="w-6 h-6 opacity-40" />
                                        <span>No storage entries found</span>
                                    </div>
                                ) : (
                                    filteredItems.map(item => {
                                        const isSelected = activeSelectedItem?.key === item.key;
                                        return (
                                            <div
                                                key={item.key}
                                                onClick={() => {
                                                    setSelectedKey(item.key);
                                                    handleOpenDetailModal(item, currentStorageType);
                                                }}
                                                className={`p-2.5 sm:p-3 border-b border-[var(--dev-console-border-light)] cursor-pointer transition-colors flex flex-col gap-1.5 ${
                                                    isSelected ? 'bg-[#007fd4]/10 border-l-2 border-l-[#007fd4]' : 'hover:bg-[var(--dev-console-bg-hover)]'
                                                }`}
                                            >
                                                {/* Top Row: Key Name, Badges, and Action Buttons (Copy & Delete) */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-mono font-bold text-xs text-[var(--dev-console-syntax-property)] truncate flex-1" title={item.key}>
                                                        {item.key}
                                                    </span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold ${
                                                            item.isJson ? 'bg-[#007fd4]/15 text-[#007fd4]' : 'bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)]'
                                                        }`}>
                                                            {item.type}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-[var(--dev-console-text-muted)] mr-1">
                                                            {formatSize(item.size)}
                                                        </span>

                                                        {/* Quick Actions in Top Row */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopy(item.value, `list-copy-${item.key}`);
                                                            }}
                                                            className="p-1 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)] bg-transparent border-0 cursor-pointer transition-colors"
                                                            title="Copy Value"
                                                        >
                                                            {copiedId === `list-copy-${item.key}` ? (
                                                                <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5 text-green-500" />
                                                            ) : (
                                                                <Icon icon="solar:copy-linear" className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteItem(item.key);
                                                            }}
                                                            className="p-1 rounded text-[var(--dev-console-text-muted)] hover:text-red-500 hover:bg-red-500/10 bg-transparent border-0 cursor-pointer transition-colors"
                                                            title="Delete Key"
                                                        >
                                                            <Icon icon="solar:trash-bin-trash-linear" className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Value summary snippet */}
                                                <div className="text-[11px] font-mono text-[var(--dev-console-text-muted)] truncate opacity-80">
                                                    {item.value || '<empty>'}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Right Quick Preview & Tree Viewer */}
                            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--dev-console-bg)]">
                                {activeSelectedItem ? (
                                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                                        {/* Preview Header */}
                                        <div className="flex-none p-2.5 sm:p-3 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono font-bold text-xs text-[var(--dev-console-syntax-property)] truncate" title={activeSelectedItem.key}>
                                                    {activeSelectedItem.key}
                                                </span>
                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-[#007fd4]/15 text-[#007fd4] font-bold">
                                                    {activeSelectedItem.type}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    onClick={() => handleOpenDetailModal(activeSelectedItem, currentStorageType)}
                                                    className="px-2.5 py-1 rounded text-xs font-semibold bg-[#007fd4] hover:bg-[#006bb3] text-white border-0 cursor-pointer flex items-center gap-1.5 shadow-2xs transition-colors"
                                                >
                                                    <Icon icon="solar:eye-linear" className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline">Open Full Inspector</span>
                                                    <span className="sm:hidden">Inspect</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Preview Content */}
                                        <div className="flex-1 overflow-auto p-3 sm:p-4 scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] text-xs">
                                            {activeSelectedItem.isJson ? (
                                                <InteractivePayloadViewer
                                                    data={activeSelectedItem.parsed}
                                                    title={activeSelectedItem.key}
                                                    size={activeSelectedItem.size}
                                                    syntaxColorClass="text-[var(--dev-console-syntax-property)]"
                                                    copiedId={copiedId}
                                                    handleCopy={handleCopy}
                                                    copyIdPrefix={`quick-${activeSelectedItem.key}`}
                                                    isMobile={false}
                                                />
                                            ) : (
                                                <pre className="p-3 rounded bg-[var(--dev-payload-code-bg)] border border-[var(--dev-payload-code-border)] font-mono text-xs overflow-auto whitespace-pre-wrap select-all leading-relaxed">
                                                    {activeSelectedItem.value}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center p-6 text-center text-xs text-[var(--dev-console-text-muted)] italic">
                                        Select a key from the list to preview content
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Deep Detail Inspector Modal */}
            {inspectItem && (
                <StorageDetailModal
                    isOpen={!!inspectItem}
                    onClose={() => setInspectItem(null)}
                    storageType={inspectStorageType}
                    itemKey={inspectItem.key}
                    itemValue={inspectItem.value}
                    itemSize={inspectItem.size}
                    itemType={inspectItem.type}
                    isJson={inspectItem.isJson}
                    parsed={inspectItem.parsed}
                    copiedId={copiedId}
                    handleCopy={handleCopy}
                    onSaveEdit={handleSaveDetailEdit}
                    onDelete={handleDeleteItem}
                />
            )}

            {/* Import JSON Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3">
                    <div className="bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden text-[var(--dev-console-text)]">
                        <div className="px-4 py-3 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <Icon icon="solar:upload-minimalistic-linear" className="w-4 h-4 text-[#007fd4]" />
                                Import JSON into {currentStorageType}
                            </h3>
                            <button
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportError(null);
                                }}
                                className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] bg-transparent border-0 cursor-pointer"
                            >
                                <Icon icon="tabler:x" className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-4 text-xs">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="importMode"
                                        checked={importMode === 'merge'}
                                        onChange={() => setImportMode('merge')}
                                    />
                                    <span>Merge with existing</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="importMode"
                                        checked={importMode === 'replace'}
                                        onChange={() => setImportMode('replace')}
                                    />
                                    <span className="text-red-500 font-semibold">Replace all existing</span>
                                </label>
                            </div>

                            <textarea
                                value={importJsonText}
                                onChange={e => {
                                    setImportJsonText(e.target.value);
                                    setImportError(null);
                                }}
                                placeholder='{\n  "key1": "value1",\n  "key2": {"nested": "data"}\n}'
                                className="w-full h-44 p-3 bg-[var(--dev-payload-code-bg)] border border-[var(--dev-payload-code-border)] rounded-lg font-mono text-xs text-[var(--dev-console-text)] outline-none resize-none focus:border-[#007fd4] leading-relaxed"
                            />

                            {importError && (
                                <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5 font-sans">
                                    <Icon icon="solar:danger-triangle-linear" className="w-3.5 h-3.5 shrink-0" />
                                    <span>{importError}</span>
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-3 border-t border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-end gap-2">
                            <button
                                onClick={() => {
                                    setIsImportModalOpen(false);
                                    setImportError(null);
                                }}
                                className="px-3 py-1.5 rounded text-xs font-semibold bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecuteImport}
                                className="px-4 py-1.5 rounded text-xs font-semibold bg-[#007fd4] hover:bg-[#006bb3] text-white border-0 cursor-pointer shadow-2xs"
                            >
                                Execute Import
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Action Button (FAB) for Add/Update Entry */}
            {(subTab === 'local' || subTab === 'session' || subTab === 'cookies') && !isAddEntryOpen && (
                <button
                    onClick={() => setIsAddEntryOpen(true)}
                    className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 bg-[#007fd4] hover:bg-[#006bb3] text-white rounded-full shadow-lg hover:shadow-xl font-medium text-xs transition-all duration-200 cursor-pointer border-0 select-none group active:scale-95"
                    title={`Add or Update ${subTab === 'local' ? 'LocalStorage' : subTab === 'session' ? 'SessionStorage' : 'Cookie'} Entry`}
                >
                    <Icon icon="tabler:plus" className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                    <span className="font-semibold">Add Entry</span>
                </button>
            )}

            {/* Clear Storage Confirmation Modal */}
            <ConfirmationModal
                isOpen={isClearConfirmOpen}
                onClose={() => setIsClearConfirmOpen(false)}
                onConfirm={handleExecuteClear}
                title={`Clear all ${currentStorageType}?`}
                message={`This will permanently remove all ${currentItems.length} stored key-value pairs from ${currentStorageType}. This action cannot be undone.`}
                confirmButtonText="Clear All Storage"
                confirmButtonVariant="danger"
            />
        </div>
    );
};
