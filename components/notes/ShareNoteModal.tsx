import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../../types';
import { AppIcon } from '../core/AppIcon';
import { useToast } from '../ToastSystem';

interface ShareNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note | null;
}

export const ShareNoteModal: React.FC<ShareNoteModalProps> = ({ isOpen, onClose, note }) => {
    const [durationType, setDurationType] = useState('never');
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [customQty, setCustomQty] = useState(1);
    const [customUnit, setCustomUnit] = useState('h'); // 'm', 'h', 'd', 'w'
    const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
    
    const { addToast } = useToast();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const unitDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on outer click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
                setIsUnitDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to generate the URL with expiration timestamp and validation signature
    const generateUrl = async (noteId: string, duration: string, qty: number, unit: string) => {
        if (duration === 'never') {
            return `${window.location.origin}/notes/share/${noteId}`;
        }
        let ms = 0;
        if (duration === 'custom') {
            if (unit === 'm') ms = qty * 60 * 1000;
            else if (unit === 'h') ms = qty * 60 * 60 * 1000;
            else if (unit === 'd') ms = qty * 24 * 60 * 60 * 1000;
            else if (unit === 'w') ms = qty * 7 * 24 * 60 * 60 * 1000;
        } else {
            if (duration === '5m') ms = 5 * 60 * 1000;
            else if (duration === '1h') ms = 60 * 60 * 1000;
            else if (duration === '24h') ms = 24 * 60 * 60 * 1000;
            else if (duration === '7d') ms = 7 * 24 * 60 * 60 * 1000;
        }

        const exp = Date.now() + ms;
        const dataStr = `${noteId}:${exp}`;

        try {
            const msgUint8 = new TextEncoder().encode(dataStr);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const sig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return `${window.location.origin}/notes/share/${noteId}?exp=${exp}&sig=${sig}`;
        } catch (err) {
            console.error("Failed to generate secure signature", err);
            return `${window.location.origin}/notes/share/${noteId}?exp=${exp}`;
        }
    };

    useEffect(() => {
        if (!isOpen || !note) return;

        const updateUrl = async () => {
            const url = await generateUrl(note.id, durationType, customQty, customUnit);
            setShareUrl(url);
        };
        updateUrl();
    }, [isOpen, note, durationType, customQty, customUnit]);

    if (!isOpen || !note) return null;

    const handleCopy = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            addToast("Shareable link copied to clipboard!", "success");
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            addToast("Failed to copy link", "error");
        }
    };

    const handlePreviewLink = () => {
        if (!shareUrl) return;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDirectShare = async () => {
        if (!shareUrl) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: note.title || 'Shared Note',
                    text: 'Check out my note shared via Ceaznet Notes!',
                    url: shareUrl
                });
                addToast("Shared successfully!", "success");
            } catch (err) {
                console.error("Error direct sharing:", err);
            }
        } else {
            handleCopy();
        }
    };

    const durationOptions = [
        { value: 'never', label: 'Permanent' },
        { value: '5m', label: '5 Minutes' },
        { value: '1h', label: '1 Hour' },
        { value: '24h', label: '24 Hours' },
        { value: '7d', label: '7 Days' },
        { value: 'custom', label: 'Custom...' }
    ];

    const getSelectedLabel = () => {
        const matched = durationOptions.find(o => o.value === durationType);
        return matched ? matched.label : 'Select...';
    };

    const getUnitLabel = () => {
        if (customUnit === 'm') return 'Minutes';
        if (customUnit === 'h') return 'Hours';
        if (customUnit === 'd') return 'Days';
        return 'Weeks';
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-md bg-white dark:bg-black border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col font-sans transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <AppIcon name="solar:share-linear" size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                Share Note
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                Anyone with this link can view this note anonymously
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                        title="Close"
                    >
                        <AppIcon name="heroicons:x-mark" className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 flex flex-col gap-4">
                    {/* Note Title Preview Card */}
                    <div className="p-3.5 rounded-xl bg-amber-500/[0.04] dark:bg-white/[0.03] border border-amber-500/15 dark:border-white/10 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-white/5 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <AppIcon name="solar:document-text-linear" size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <span className="block text-[10px] uppercase font-mono font-semibold text-gray-400 dark:text-gray-400">
                                Note Title
                            </span>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate mt-0.5">
                                {note.title || 'Untitled Note'}
                            </p>
                        </div>
                    </div>

                    {/* Expiration Settings & Link Copy Block */}
                    <div className="grid grid-cols-2 gap-3.5 items-stretch w-full">
                        {/* Expiration Settings (Left Column) */}
                        <div className="flex flex-col justify-between gap-1.5 min-w-0 relative h-full">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                <AppIcon name="solar:clock-circle-linear" size={14} className="text-amber-500 shrink-0" />
                                <span className="truncate">Expiration</span>
                            </label>

                            {/* Custom Dropdown Trigger */}
                            <div className="relative flex-1 flex items-end" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-gray-800 dark:text-gray-200 text-xs font-semibold flex items-center justify-between gap-1 hover:border-amber-500/40 dark:hover:border-amber-400/40 transition-colors cursor-pointer shadow-xs"
                                >
                                    <span className="truncate">{getSelectedLabel()}</span>
                                    <AppIcon name="solar:alt-arrow-down-linear" size={14} className={`text-gray-400 shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Custom Dropdown Content */}
                                {isDropdownOpen && (
                                    <div className="absolute left-0 right-0 bottom-full mb-1.5 sm:bottom-auto sm:top-full sm:mt-1.5 z-50 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto animate-fadeIn divide-y divide-gray-100 dark:divide-white/5 py-1">
                                        {durationOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    setDurationType(opt.value);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                                    durationType === opt.value ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {durationType === opt.value && <AppIcon name="ph:check-light" size={13} className="shrink-0 stroke-[2.5]" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Public Share Link Copy Block (Right Column) */}
                        <div className="flex flex-col justify-between gap-1.5 min-w-0 h-full">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 truncate">
                                    <AppIcon name="solar:global-linear" size={14} className="text-amber-500 shrink-0" />
                                    <span className="truncate">Public Link</span>
                                </span>
                            </label>

                            <div className="flex flex-col gap-1.5 flex-1 justify-end">
                                <button
                                    onClick={handleCopy}
                                    className={`w-full h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] ${
                                        copied 
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                                    }`}
                                >
                                    {copied ? (
                                        <AppIcon name="ph:check-light" size={14} className="shrink-0 stroke-[2.5]" />
                                    ) : (
                                        <AppIcon name="solar:copy-linear" size={14} className="shrink-0" />
                                    )}
                                    <span className="truncate">{copied ? "Copied!" : "Copy Link"}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Custom Duration Fields Row (Shown when custom is selected) */}
                    {durationType === 'custom' && (
                        <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 animate-fadeIn">
                            <div className="flex-1 min-w-0">
                                <span className="block text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 mb-1">
                                    Duration Value
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    value={customQty}
                                    onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full h-9 px-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-gray-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                            <div className="w-28 shrink-0 relative" ref={unitDropdownRef}>
                                <span className="block text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 mb-1">
                                    Unit
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                                    className="w-full h-9 px-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-black text-gray-900 dark:text-white text-xs font-semibold flex items-center justify-between gap-1 cursor-pointer"
                                >
                                    <span>{getUnitLabel()}</span>
                                    <AppIcon name="solar:alt-arrow-down-linear" size={12} className="text-gray-400 shrink-0" />
                                </button>

                                {isUnitDropdownOpen && (
                                    <div className="absolute right-0 bottom-full mb-1.5 z-50 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl w-28 py-1">
                                        {[
                                            { v: 'm', l: 'Minutes' },
                                            { v: 'h', l: 'Hours' },
                                            { v: 'd', l: 'Days' },
                                            { v: 'w', l: 'Weeks' }
                                        ].map((u) => (
                                            <button
                                                key={u.v}
                                                type="button"
                                                onClick={() => {
                                                    setCustomUnit(u.v);
                                                    setIsUnitDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                                                    customUnit === u.v ? 'text-amber-500 font-bold bg-amber-500/10' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                {u.l}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* URL Preview Card with One-Click Select & Copy */}
                    <div className="flex items-center gap-2 p-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/70 dark:bg-white/[0.03]">
                        <span className="text-[10px] uppercase font-mono font-bold text-gray-400 dark:text-gray-400 px-1 shrink-0">
                            URL:
                        </span>
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 bg-transparent text-[11px] font-mono text-gray-600 dark:text-gray-300 focus:outline-none truncate select-all"
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                            title="Copy link"
                        >
                            {copied ? (
                                <AppIcon name="ph:check-light" size={13} className="text-emerald-500 stroke-[2.5]" />
                            ) : (
                                <AppIcon name="solar:copy-linear" size={13} />
                            )}
                        </button>
                    </div>

                    {/* Modal Footer Controls */}
                    <div className="pt-3 flex items-center justify-between gap-3 text-xs border-t border-black/5 dark:border-white/10 mt-1">
                        <button
                            type="button"
                            onClick={handlePreviewLink}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all font-semibold cursor-pointer group"
                        >
                            <AppIcon name="ph:eye-light" size={14} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
                            <span>Preview</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all font-medium cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDirectShare}
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] transition-all"
                            >
                                <AppIcon name="solar:share-linear" size={14} />
                                <span>Share</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareNoteModal;
