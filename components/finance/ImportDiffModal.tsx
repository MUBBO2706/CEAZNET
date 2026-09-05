import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
    X, Search, CheckCircle2, Copy, Check, 
    ArrowLeft, Save, Filter, Loader2, Sparkles 
} from 'lucide-react';
import { Transaction } from '../../types';

export interface ImportDiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBackToEdit?: () => void;
    onConfirmSave: (transactions: Transaction[]) => void;
    oldTransactions: Transaction[];
    newTransactions: Transaction[];
    isSaving?: boolean;
}

export interface FieldDiff {
    field: string;
    oldValue: string;
    newValue: string;
}

export interface DiffRecord {
    id: string;
    status: 'modified' | 'added' | 'unchanged';
    title: string;
    category: string;
    amount: number;
    transactionDate: string;
    fieldDiffs: FieldDiff[];
    rawNewTx: Transaction;
}

const FIELD_LABELS: Record<string, string> = {
    amount: 'Amount',
    type: 'Type',
    category: 'Category',
    description: 'Description',
    payment_method: 'Payment Method',
    transaction_date: 'Transaction Date',
    profile_id: 'Profile ID',
    vehicle_id: 'Vehicle ID',
    metadata: 'Metadata / Fuel',
    created_at: 'Created At',
    user_id: 'User ID'
};

const formatFieldValue = (field: string, val: any): string => {
    if (val === undefined || val === null || val === '') return '(empty)';
    if (field === 'amount' && typeof val === 'number') return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

export const computeImportDiffs = (oldTxs: Transaction[], newTxs: Transaction[]): {
    records: DiffRecord[];
    summary: {
        totalImported: number;
        addedCount: number;
        modifiedCount: number;
        unchangedCount: number;
        totalChangedLines: number;
    };
} => {
    const oldMap = new Map<string, Transaction>();
    oldTxs.forEach(t => {
        if (t.id) oldMap.set(t.id, t);
    });

    const records: DiffRecord[] = [];
    let addedCount = 0;
    let modifiedCount = 0;
    let unchangedCount = 0;
    let totalChangedLines = 0;

    newTxs.forEach(newTx => {
        const oldTx = newTx.id ? oldMap.get(newTx.id) : undefined;

        if (!oldTx) {
            // Added record
            addedCount++;
            totalChangedLines++;
            records.push({
                id: newTx.id || crypto.randomUUID(),
                status: 'added',
                title: newTx.description || newTx.category || 'Transaction',
                category: newTx.category || 'General',
                amount: newTx.amount || 0,
                transactionDate: newTx.transaction_date || new Date().toISOString(),
                fieldDiffs: [],
                rawNewTx: newTx
            });
        } else {
            // Compare fields (including dynamic, added, and deleted fields)
            const fieldDiffs: FieldDiff[] = [];

            const allKeys = Array.from(new Set([
                ...Object.keys(oldTx),
                ...Object.keys(newTx)
            ])).filter(k => k !== 'id');

            allKeys.forEach((key) => {
                const oldHasKey = Object.prototype.hasOwnProperty.call(oldTx, key) && oldTx[key as keyof Transaction] !== undefined && oldTx[key as keyof Transaction] !== null && oldTx[key as keyof Transaction] !== '';
                const newHasKey = Object.prototype.hasOwnProperty.call(newTx, key) && newTx[key as keyof Transaction] !== undefined && newTx[key as keyof Transaction] !== null && newTx[key as keyof Transaction] !== '';

                const oldValRaw = oldTx[key as keyof Transaction];
                const newValRaw = newTx[key as keyof Transaction];

                const oldVal = formatFieldValue(key, oldValRaw);
                const newVal = formatFieldValue(key, newValRaw);

                if (oldVal !== newVal) {
                    const label = FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                    let formattedOld = oldVal;
                    let formattedNew = newVal;

                    if (!oldHasKey && newHasKey) {
                        formattedOld = '(field missing)';
                    } else if (oldHasKey && !newHasKey) {
                        formattedNew = '(field deleted)';
                    }

                    fieldDiffs.push({
                        field: label,
                        oldValue: formattedOld,
                        newValue: formattedNew
                    });
                }
            });

            if (fieldDiffs.length > 0) {
                modifiedCount++;
                totalChangedLines += fieldDiffs.length;
                records.push({
                    id: newTx.id,
                    status: 'modified',
                    title: newTx.description || oldTx.description || newTx.category || 'Transaction',
                    category: newTx.category || oldTx.category || 'General',
                    amount: newTx.amount ?? oldTx.amount ?? 0,
                    transactionDate: newTx.transaction_date || oldTx.transaction_date || '',
                    fieldDiffs,
                    rawNewTx: newTx
                });
            } else {
                unchangedCount++;
                records.push({
                    id: newTx.id,
                    status: 'unchanged',
                    title: newTx.description || 'Transaction',
                    category: newTx.category || 'General',
                    amount: newTx.amount ?? 0,
                    transactionDate: newTx.transaction_date || '',
                    fieldDiffs: [],
                    rawNewTx: newTx
                });
            }
        }
    });

    return {
        records,
        summary: {
            totalImported: newTxs.length,
            addedCount,
            modifiedCount,
            unchangedCount,
            totalChangedLines
        }
    };
};

const ImportDiffModal: React.FC<ImportDiffModalProps> = ({ 
    isOpen, 
    onClose, 
    onBackToEdit,
    onConfirmSave, 
    oldTransactions, 
    newTransactions,
    isSaving = false 
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'changes' | 'modified' | 'added' | 'all'>('changes');
    const [copied, setCopied] = useState(false);

    const { records, summary } = useMemo(() => {
        if (!isOpen) {
            return {
                records: [],
                summary: { totalImported: 0, addedCount: 0, modifiedCount: 0, unchangedCount: 0, totalChangedLines: 0 }
            };
        }
        return computeImportDiffs(oldTransactions, newTransactions);
    }, [isOpen, oldTransactions, newTransactions]);

    const filteredRecords = useMemo(() => {
        return records.filter(rec => {
            // Mode filter
            if (filterMode === 'changes' && rec.status === 'unchanged') return false;
            if (filterMode === 'modified' && rec.status !== 'modified') return false;
            if (filterMode === 'added' && rec.status !== 'added') return false;

            // Search filter
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                rec.id.toLowerCase().includes(q) ||
                rec.title.toLowerCase().includes(q) ||
                rec.category.toLowerCase().includes(q) ||
                rec.fieldDiffs.some(f => f.field.toLowerCase().includes(q) || f.oldValue.toLowerCase().includes(q) || f.newValue.toLowerCase().includes(q))
            );
        });
    }, [records, filterMode, searchQuery]);

    const handleCopySummary = () => {
        let text = `=== DATA IMPORT DIFF SUMMARY ===\n`;
        text += `Total Imported: ${summary.totalImported} | Modified: ${summary.modifiedCount} | Added: ${summary.addedCount} | Unchanged: ${summary.unchangedCount}\n`;
        text += `Total Changed Lines: ${summary.totalChangedLines}\n\n`;

        records.filter(r => r.status !== 'unchanged').forEach((rec, idx) => {
            text += `[${idx + 1}] ID: ${rec.id} | Status: ${rec.status.toUpperCase()} | ${rec.title}\n`;
            if (rec.status === 'modified') {
                rec.fieldDiffs.forEach(f => {
                    text += `  - ${f.field}:\n    🔴 OLD: ${f.oldValue}\n    🟢 NEW: ${f.newValue}\n`;
                });
            } else if (rec.status === 'added') {
                text += `  🟢 ADDED: Amount=${rec.amount}, Category=${rec.category}, Date=${rec.transactionDate}\n`;
            }
            text += `\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ backgroundColor: 'var(--diff-page-bg)' }}
                className="fixed inset-0 z-[200] w-screen h-screen flex flex-col text-gray-900 dark:text-gray-100 overflow-hidden"
            >
                {/* --- FULL-PAGE HEADER BAR --- */}
                <div
                    style={{ 
                        backgroundColor: 'var(--diff-header-bg)', 
                        borderColor: 'var(--diff-card-border)' 
                    }}
                    className="px-3 sm:px-6 py-2.5 sm:py-3.5 border-b flex items-center justify-between gap-2 shrink-0 shadow-xs"
                >
                    {/* Left: Back / Title */}
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {onBackToEdit && (
                            <button
                                onClick={onBackToEdit}
                                disabled={isSaving}
                                className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                                title="Back to JSON Editor"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">JSON</span>
                            </button>
                        )}

                        <div className="min-w-0 flex items-center gap-2">
                            <h2 className="text-sm sm:text-lg font-black text-gray-900 dark:text-white tracking-tight truncate">
                                Review Import
                            </h2>
                            <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                                {summary.totalChangedLines} {summary.totalChangedLines === 1 ? 'Change' : 'Changes'}
                            </span>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleCopySummary}
                            disabled={isSaving}
                            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-all border border-gray-200/80 dark:border-white/5"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copied' : 'Copy Diff'}
                        </button>

                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* --- SUB-HEADER: STATS & SEARCH / DROPDOWN BAR --- */}
                <div 
                    style={{ borderColor: 'var(--diff-card-border)' }}
                    className="border-b bg-gray-50/70 dark:bg-white/[0.02] px-3 sm:px-6 py-2.5 sm:py-3 shrink-0 space-y-2.5"
                >
                    <div className="max-w-7xl mx-auto space-y-2.5">
                        {/* Compact Flat Stats Summary Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5 text-xs">
                            <div className="px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200/60 dark:border-white/5 flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-gray-400">Total Import</span>
                                <span className="font-black text-gray-900 dark:text-white">{summary.totalImported}</span>
                            </div>

                            <div
                                style={{
                                    backgroundColor: 'var(--diff-removed-bg)',
                                    color: 'var(--diff-removed-text)'
                                }}
                                className="px-3 py-2 rounded-lg border border-red-500/20 flex items-center justify-between"
                            >
                                <span className="text-[10px] uppercase font-bold opacity-80">Modified</span>
                                <span className="font-black">{summary.modifiedCount}</span>
                            </div>

                            <div
                                style={{
                                    backgroundColor: 'var(--diff-added-bg)',
                                    color: 'var(--diff-added-text)'
                                }}
                                className="px-3 py-2 rounded-lg border border-emerald-500/20 flex items-center justify-between"
                            >
                                <span className="text-[10px] uppercase font-bold opacity-80">New Added</span>
                                <span className="font-black">{summary.addedCount}</span>
                            </div>

                            <div className="px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200/60 dark:border-white/5 flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-gray-400">Unchanged</span>
                                <span className="font-black text-gray-500 dark:text-gray-400">{summary.unchangedCount}</span>
                            </div>
                        </div>

                        {/* Search Bar and Adjacent Filter Dropdown */}
                        <div className="flex items-center gap-2">
                            {/* Search bar */}
                            <div className="relative flex-1">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Filter by field, description, category, or ID..."
                                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                />
                            </div>

                            {/* Adjacent Filter Dropdown */}
                            <div className="relative shrink-0">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black/50 text-xs font-semibold text-gray-800 dark:text-gray-200 shadow-2xs">
                                    <Filter className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <select
                                        value={filterMode}
                                        onChange={(e) => setFilterMode(e.target.value as any)}
                                        className="bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer pr-1"
                                    >
                                        <option value="changes" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                                            Changes Only ({summary.modifiedCount + summary.addedCount})
                                        </option>
                                        <option value="modified" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                                            Modified ({summary.modifiedCount})
                                        </option>
                                        <option value="added" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                                            Added ({summary.addedCount})
                                        </option>
                                        <option value="all" className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                                            All ({summary.totalImported})
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- MAIN SCROLLABLE VIEW (FLATTENED LAYOUT) --- */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
                    <div className="max-w-7xl mx-auto space-y-3">
                        {filteredRecords.length === 0 ? (
                            <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        {summary.totalChangedLines === 0 ? 'No Differences Detected' : 'No matching records'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs sm:max-w-md mx-auto">
                                        {summary.totalChangedLines === 0
                                            ? 'All imported transactions are identical to database records.'
                                            : 'Try adjusting your search query or filter dropdown selection.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            filteredRecords.map((rec) => (
                                <div
                                    key={rec.id}
                                    style={{
                                        backgroundColor: 'var(--diff-card-bg)',
                                        borderColor: rec.status === 'modified' ? 'var(--diff-removed-border)' : rec.status === 'added' ? 'var(--diff-added-border)' : 'var(--diff-card-border)'
                                    }}
                                    className="rounded-xl border shadow-2xs overflow-hidden transition-all"
                                >
                                    {/* Card Header */}
                                    <div
                                        style={{ backgroundColor: 'var(--diff-header-bg)', borderColor: 'var(--diff-card-border)' }}
                                        className="px-3 sm:px-4 py-2 sm:py-2.5 border-b flex flex-wrap items-center justify-between gap-2"
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 shrink-0">
                                                ID: {rec.id.length > 12 ? `${rec.id.slice(0, 8)}...` : rec.id}
                                            </span>
                                            <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate max-w-[160px] sm:max-w-md">
                                                {rec.title}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                                                {rec.category}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {rec.status === 'modified' && (
                                                <span
                                                    style={{ 
                                                        backgroundColor: 'var(--diff-removed-bg)', 
                                                        color: 'var(--diff-removed-text)', 
                                                        borderColor: 'var(--diff-removed-border)' 
                                                    }}
                                                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                                                >
                                                    {rec.fieldDiffs.length} {rec.fieldDiffs.length === 1 ? 'Field Modified' : 'Fields Modified'}
                                                </span>
                                            )}
                                            {rec.status === 'added' && (
                                                <span
                                                    style={{ 
                                                        backgroundColor: 'var(--diff-added-bg)', 
                                                        color: 'var(--diff-added-text)', 
                                                        borderColor: 'var(--diff-added-border)' 
                                                    }}
                                                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                                                >
                                                    + New
                                                </span>
                                            )}
                                            {rec.status === 'unchanged' && (
                                                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-gray-400">
                                                    Identical
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Direct Git-style Line Diffs */}
                                    <div className="divide-y divide-gray-100 dark:divide-white/5 font-mono text-xs">
                                        {rec.status === 'modified' && (
                                            rec.fieldDiffs.map((diff, fIdx) => (
                                                <div key={fIdx} className="p-2.5 sm:p-3 space-y-1">
                                                    <div className="text-[10px] font-sans font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                        FIELD: {diff.field}
                                                    </div>

                                                    <div className="rounded-lg overflow-hidden border border-gray-100 dark:border-white/5">
                                                        {/* Red Removed Line */}
                                                        <div
                                                            style={{
                                                                backgroundColor: 'var(--diff-removed-bg)',
                                                                color: 'var(--diff-removed-text)'
                                                            }}
                                                            className="px-2.5 py-1.5 flex items-start gap-2 break-all text-xs border-b border-red-500/10"
                                                        >
                                                            <span className="font-extrabold select-none text-red-600 dark:text-red-400 shrink-0">-</span>
                                                            <span className="text-[10px] font-sans uppercase font-bold opacity-70 shrink-0 w-16">Database:</span>
                                                            <span className="flex-1 font-semibold">{diff.oldValue}</span>
                                                        </div>

                                                        {/* Green Added Line */}
                                                        <div
                                                            style={{
                                                                backgroundColor: 'var(--diff-added-bg)',
                                                                color: 'var(--diff-added-text)'
                                                            }}
                                                            className="px-2.5 py-1.5 flex items-start gap-2 break-all text-xs"
                                                        >
                                                            <span className="font-extrabold select-none text-emerald-600 dark:text-emerald-400 shrink-0">+</span>
                                                            <span className="text-[10px] font-sans uppercase font-bold opacity-70 shrink-0 w-16">Import:</span>
                                                            <span className="flex-1 font-semibold">{diff.newValue}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}

                                        {rec.status === 'added' && (
                                            <div className="p-3">
                                                <div
                                                    style={{
                                                        backgroundColor: 'var(--diff-added-bg)',
                                                        color: 'var(--diff-added-text)',
                                                        borderColor: 'var(--diff-added-border)'
                                                    }}
                                                    className="p-2.5 rounded-lg border text-xs font-mono space-y-1.5"
                                                >
                                                    <div className="font-sans font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                                                        <span>+</span> New Transaction Entry
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                                                        <div><span className="opacity-75 font-sans block text-[9px] uppercase">Amount</span> ₹{rec.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                        <div><span className="opacity-75 font-sans block text-[9px] uppercase">Category</span> {rec.category}</div>
                                                        <div><span className="opacity-75 font-sans block text-[9px] uppercase">Type</span> {rec.rawNewTx.type}</div>
                                                        <div><span className="opacity-75 font-sans block text-[9px] uppercase">Method</span> {rec.rawNewTx.payment_method || 'N/A'}</div>
                                                        <div className="col-span-2"><span className="opacity-75 font-sans block text-[9px] uppercase">Date</span> {rec.transactionDate}</div>
                                                        <div className="col-span-2 sm:col-span-3"><span className="opacity-75 font-sans block text-[9px] uppercase">Description</span> {rec.title}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {rec.status === 'unchanged' && (
                                            <div className="p-3 text-xs text-gray-400 italic font-sans">
                                                Identical to existing database record.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* --- FIXED BOTTOM ACTION BAR (SAFE FOR DEVTOOLS & MOBILE) --- */}
                <div
                    style={{ 
                        backgroundColor: 'var(--diff-header-bg)', 
                        borderColor: 'var(--diff-card-border)',
                        paddingBottom: 'calc(var(--dev-console-padding, 0px) + 0.75rem)'
                    }}
                    className="px-3 sm:px-6 pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 shadow-lg z-20"
                >
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Ready to apply <strong>{summary.totalImported} items</strong> to database.</span>
                    </div>

                    <div className="flex items-center gap-2 justify-end ml-auto w-full sm:w-auto">
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="w-auto px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 transition-all text-center whitespace-nowrap"
                        >
                            Cancel
                        </button>

                        <button
                            onClick={() => onConfirmSave(newTransactions)}
                            disabled={isSaving}
                            className="w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/25 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Confirm & Save All</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};

export default ImportDiffModal;

