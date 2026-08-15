import React, { useState, useEffect, useRef } from 'react';
import { getPublicSharedNote } from '../../services/dbService';
import { Note } from '../../types';
import { markdownToHtml } from './markdownUtils';
import { 
    Clock, 
    Copy, 
    Check, 
    Share2, 
    ArrowRight, 
    FileText, 
    Sparkles, 
    ExternalLink, 
    AlertCircle, 
    Loader2, 
    Tag,
    Sun,
    Moon,
    MoreVertical,
    Info,
    Calendar,
    X
} from 'lucide-react';
import { useToast } from '../ToastSystem';

interface SharedNoteViewProps {
    onNavigateHome?: () => void;
}

export const SharedNoteView: React.FC<SharedNoteViewProps> = ({ onNavigateHome }) => {
    const [note, setNote] = useState<Note | null>(null);
    const [expiryTime, setExpiryTime] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCopiedText, setIsCopiedText] = useState(false);
    const [isCopiedLink, setIsCopiedLink] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { addToast } = useToast();

    // Close menu on outer click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Parse Note ID from URL pathname
    useEffect(() => {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        let noteId = '';

        // Match /notes/share/:id, /share/note/:id, /notes/s/:id, or /notes/:id
        const match = path.match(/\/(?:notes\/share|share\/note|notes\/s|notes)\/([a-f0-9-]{36})/i);
        if (match && match[1]) {
            noteId = match[1];
        } else {
            // Check query string
            noteId = params.get('id') || params.get('noteId') || '';
        }

        if (!noteId) {
            setError('Invalid or missing note link ID.');
            setIsLoading(false);
            return;
        }

        const exp = params.get('exp');
        const sig = params.get('sig');

        if (exp && exp !== 'never') {
            const expTimestamp = parseInt(exp, 10);
            if (!isNaN(expTimestamp)) {
                setExpiryTime(new Date(expTimestamp).toISOString());
            }
        }

        setIsLoading(true);
        setError(null);

        getPublicSharedNote(noteId, exp, sig)
            .then((fetchedNote) => {
                if (fetchedNote) {
                    setNote(fetchedNote);
                } else {
                    setError('Note not found. It may have been deleted or the link is invalid.');
                }
            })
            .catch((err: any) => {
                console.error("Error loading shared note:", err);
                if (err.message && err.message.includes('expired')) {
                    setError('This shareable note link has expired.');
                } else {
                    setError('Failed to load note. Please check your internet connection.');
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, []);

    const toggleTheme = () => {
        const newDark = !isDarkMode;
        setIsDarkMode(newDark);
        if (newDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const handleCopyText = async () => {
        if (!note) return;
        try {
            // Strip HTML tags for clean plain text or copy markdown content
            const plainContent = `${note.title}\n\n${note.content}`;
            await navigator.clipboard.writeText(plainContent);
            setIsCopiedText(true);
            addToast("Note content copied to clipboard!", "success");
            setTimeout(() => setIsCopiedText(false), 2500);
        } catch (err) {
            addToast("Failed to copy note content.", "error");
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setIsCopiedLink(true);
            addToast("Shareable link copied to clipboard!", "success");
            setTimeout(() => setIsCopiedLink(false), 2500);
        } catch (err) {
            addToast("Failed to copy link.", "error");
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch {
            return dateStr;
        }
    };

    // Card background color mappings matching Note themes cleanly
    const getThemeStyles = (theme?: string) => {
        switch (theme) {
            case 'red':
                return 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20';
            case 'orange':
                return 'border-orange-200 dark:border-orange-900/50 bg-orange-50/40 dark:bg-orange-950/20';
            case 'amber':
                return 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20';
            case 'green':
                return 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20';
            case 'blue':
                return 'border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20';
            case 'purple':
                return 'border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20';
            case 'pink':
                return 'border-pink-200 dark:border-pink-900/50 bg-pink-50/40 dark:bg-pink-950/20';
            default:
                return 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900';
        }
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-300">
            {/* Top Navigation Header for Anonymous Viewers */}
            <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white/80 dark:bg-neutral-950/80 border-b border-neutral-100 dark:border-neutral-900 px-4 sm:px-8 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                            <span className="font-bold text-base sm:text-lg tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                                Shared Note
                            </span>
                            {expiryTime && (
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal whitespace-nowrap sm:ml-1">
                                    Expires: {formatDate(expiryTime)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    {/* Three Dots Dropdown Menu */}
                    {note && (
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer flex items-center justify-center"
                                title="More Actions"
                            >
                                <MoreVertical size={18} />
                            </button>

                            {isMenuOpen && (
                                <div className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg py-1.5 z-50 animate-fadeIn text-xs">
                                    <div className="flex flex-col">
                                        <button
                                            onClick={() => {
                                                setIsInfoModalOpen(true);
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full px-3 py-2 text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                                        >
                                            <Info size={14} className="text-neutral-500 shrink-0" />
                                            <span>Link Info</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                handleCopyText();
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full px-3 py-2 text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                                        >
                                            {isCopiedText ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Copy size={14} className="shrink-0" />}
                                            <span>{isCopiedText ? "Copied" : "Copy Note"}</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                handleCopyLink();
                                                setIsMenuOpen(false);
                                            }}
                                            className="w-full px-3 py-2 text-left text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2 font-medium transition-colors cursor-pointer"
                                        >
                                            {isCopiedLink ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Share2 size={14} className="shrink-0" />}
                                            <span>{isCopiedLink ? "Link Copied" : "Copy Share Link"}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {onNavigateHome && (
                        <button
                            onClick={onNavigateHome}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                        >
                            <span>Open Notes App</span>
                            <ExternalLink size={13} />
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content Viewport */}
            <main className="flex-1 w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-6 pb-4 sm:pt-8 sm:pb-6 flex flex-col justify-start">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
                        <Loader2 size={32} className="animate-spin text-amber-500" />
                        <p className="text-sm font-medium animate-pulse">Loading shared note...</p>
                    </div>
                ) : error || !note ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
                            <AlertCircle size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                            Note Unavailable
                        </h2>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mb-6 leading-relaxed">
                            {error || "This note couldn't be loaded. It might have been deleted by the owner or the link is incorrect."}
                        </p>
                        {onNavigateHome && (
                            <button
                                onClick={onNavigateHome}
                                className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium text-xs hover:bg-amber-600 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                            >
                                <span>Open Notes App</span>
                                <ArrowRight size={14} />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="w-full flex flex-col gap-8 animate-fadeIn">
                        {/* Note Main Document Box (Container-less Layout) */}
                        <article className="w-full transition-all">
                            {/* Note Header Title */}
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-4 leading-snug">
                                {note.title || 'Untitled Note'}
                            </h1>

                            {/* Tags Section */}
                            {note.tags && note.tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mb-8">
                                    {note.tags.map((tag, idx) => (
                                        <span 
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-800/60"
                                        >
                                            <Tag size={10} />
                                            <span>{tag}</span>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Note Formatted Body */}
                            <div 
                                className="prose dark:prose-invert max-w-none text-neutral-800 dark:text-neutral-200 text-sm sm:text-base leading-relaxed break-words"
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(note.content) }}
                            />
                        </article>
                    </div>
                )}
            </main>

            {/* Info Modal */}
            {isInfoModalOpen && note && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="fixed inset-0 bg-neutral-950/40 backdrop-blur-xs transition-opacity"
                        onClick={() => setIsInfoModalOpen(false)}
                    />
                    
                    {/* Modal Box */}
                    <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-scaleIn z-10">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                            <div className="flex items-center gap-2">
                                <Info size={18} className="text-amber-500" />
                                <h3 className="font-bold text-sm sm:text-base text-neutral-900 dark:text-neutral-50">
                                    Link Information
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsInfoModalOpen(false)}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 flex flex-col gap-4 text-xs sm:text-sm">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider font-bold text-neutral-400 dark:text-neutral-500">
                                    Note Title
                                </span>
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                                    {note.title || 'Untitled Note'}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider font-bold text-neutral-400 dark:text-neutral-500">
                                    Created Date
                                </span>
                                <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                                    <Calendar size={14} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                                    <span>{formatDate(note.createdAt)}</span>
                                </div>
                            </div>

                            {note.updatedAt && note.updatedAt !== note.createdAt && (
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider font-bold text-neutral-400 dark:text-neutral-500">
                                        Last Updated
                                    </span>
                                    <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                                        <Clock size={14} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                                        <span>{formatDate(note.updatedAt)}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider font-bold text-neutral-400 dark:text-neutral-500">
                                    Link Expiration
                                </span>
                                <div className="flex items-center gap-2">
                                    <Clock size={14} className={`${expiryTime ? 'text-amber-500' : 'text-neutral-400 dark:text-neutral-500'} shrink-0`} />
                                    <span className={expiryTime ? "text-amber-600 dark:text-amber-400 font-medium" : "text-neutral-700 dark:text-neutral-300"}>
                                        {expiryTime ? formatDate(expiryTime) : 'Never Expires'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
                            <button
                                onClick={() => setIsInfoModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-medium text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SharedNoteView;
