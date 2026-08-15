import React, { useState, useEffect, useRef } from 'react';
import { Note } from '../../types';
import { X, Copy, Check, Share2, Globe, ExternalLink, ShieldCheck, Clock, Eye, ChevronDown } from 'lucide-react';
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
            <div 
                className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden flex flex-col font-sans transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Share2 size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                                Share Note
                            </h3>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                Anyone with this link can view this note anonymously
                            </p>
                        </div>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="p-5 flex flex-col gap-4">
                    {/* Note Title Preview */}
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-800">
                        <span className="block text-[10px] uppercase font-mono font-semibold text-neutral-400 dark:text-neutral-505 mb-1">
                            Note Title
                        </span>
                        <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {note.title || 'Untitled Note'}
                        </p>
                    </div>

                    {/* Side-by-Side Expiration Settings & Link Copy Block */}
                    <div className="grid grid-cols-2 gap-4 items-stretch w-full">
                        {/* Expiration Settings (Left Column) */}
                        <div className="flex flex-col justify-between gap-1.5 min-w-0 relative h-full">
                            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                                <Clock size={13} className="text-amber-500 shrink-0" />
                                <span className="truncate">Expiration</span>
                            </label>

                            {/* Custom Dropdown Trigger */}
                            <div className="relative flex-1 flex items-end" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full h-9 px-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs font-medium flex items-center justify-between gap-1 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer shadow-2xs"
                                >
                                    <span className="truncate">{getSelectedLabel()}</span>
                                    <ChevronDown size={14} className={`text-neutral-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Custom Dropdown Content */}
                                {isDropdownOpen && (
                                    <div className="absolute left-0 right-0 bottom-full mb-1 sm:bottom-auto sm:top-full sm:mt-1 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg max-h-48 overflow-y-auto animate-fadeIn">
                                        {durationOptions.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    setDurationType(opt.value);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-colors flex items-center justify-between ${
                                                    durationType === opt.value ? 'bg-amber-500/5 text-amber-600 dark:text-amber-400 font-semibold' : 'text-neutral-700 dark:text-neutral-300'
                                                }`}
                                            >
                                                <span>{opt.label}</span>
                                                {durationType === opt.value && <Check size={12} className="shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Public Share Link Block (Right Column) */}
                        <div className="flex flex-col justify-between gap-1.5 min-w-0 h-full">
                            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 truncate">
                                    <Globe size={13} className="text-amber-500 shrink-0" />
                                    <span className="truncate">Public Link</span>
                                </span>
                            </label>

                            <div className="flex flex-col gap-1.5 flex-1 justify-end">
                                <button
                                    onClick={handleCopy}
                                    className="w-full h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                                >
                                    {copied ? <Check size={14} className="shrink-0" /> : <Copy size={14} className="shrink-0" />}
                                    <span className="truncate">{copied ? "Copied" : "Copy Link"}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Custom Duration Fields Row (Shown below when custom selected) */}
                    {durationType === 'custom' && (
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 flex items-center gap-2.5 animate-fadeIn">
                            <div className="flex-1 min-w-0">
                                <span className="block text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 mb-1">
                                    Duration Value
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    value={customQty}
                                    onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full h-8 px-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                            <div className="w-28 shrink-0 relative" ref={unitDropdownRef}>
                                <span className="block text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 mb-1">
                                    Unit
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                                    className="w-full h-8 px-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs font-medium flex items-center justify-between gap-1 cursor-pointer"
                                >
                                    <span>{getUnitLabel()}</span>
                                    <ChevronDown size={12} className="text-neutral-400 shrink-0" />
                                </button>

                                {isUnitDropdownOpen && (
                                    <div className="absolute right-0 bottom-full mb-1 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg w-28 py-1">
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
                                                className={`w-full text-left px-2.5 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800/80 transition-colors ${
                                                    customUnit === u.v ? 'text-amber-500 font-semibold' : 'text-neutral-700 dark:text-neutral-300'
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

                    {/* Optional URL Preview (For verification) */}
                    <div className="flex items-center gap-1.5 p-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
                        <span className="text-[10px] uppercase font-mono text-neutral-400 dark:text-neutral-500 px-1 shrink-0">
                            URL Preview:
                        </span>
                        <input
                            type="text"
                            readOnly
                            value={shareUrl}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 bg-transparent text-[11px] font-mono text-neutral-500 dark:text-neutral-400 focus:outline-none truncate select-all"
                        />
                    </div>

                    {/* Additional Options */}
                    <div className="pt-2 flex items-center justify-between gap-3 text-xs border-t border-neutral-100 dark:border-neutral-800/80 mt-1">
                        <button
                            onClick={handlePreviewLink}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-medium cursor-pointer"
                        >
                            <Eye size={14} className="text-neutral-500" />
                            <span>Preview</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors font-medium cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDirectShare}
                                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                                <Share2 size={13} />
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
