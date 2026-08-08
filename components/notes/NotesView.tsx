
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Note } from '../../types';
import { getNotes, saveNote, deleteNote, getNoteById, invalidateNoteCache } from '../../services/dbService';
import { syncAllTransactionsToNote } from '../../services/financeSyncService';
import { Plus, Palette, Check, Clock, Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3, Heading, X, LayoutGrid, Strikethrough, Quote, Code, Undo, Redo, ChevronLeft, Minus, Link as LinkIcon, Edit2, Lock, RotateCw, Loader2, Search, User as UserIcon, Share2, Table } from 'lucide-react';
import NoteCard from './NoteCard';
import ConfirmationModal from '../ConfirmationModal';
import ShareNoteModal from './ShareNoteModal';
import type { User } from '@supabase/supabase-js';
import { useToast } from '../ToastSystem';

interface NotesViewProps {
    user: User | null;
    onBack: () => void;
    searchQuery: string;
    setSearchQuery?: (q: string) => void;
    setNotesHeaderState: (state: {
        title: string | null;
        isReadOnly: boolean;
        isWalletLinked: boolean;
        isSyncing: boolean;
        isSaving?: boolean;
        onBack?: () => void;
        onEdit?: () => void;
        onSave?: () => void;
        onSync?: () => void;
    }) => void;
    isSuspended?: boolean;
}

interface ActiveFormats {
    bold: boolean;
    italic: boolean;
    strikeThrough: boolean;
    blockType: string; // 'p', 'h1', 'h2', 'h3', 'blockquote', 'pre', 'ul'
    isOrderedList: boolean;
    isUnorderedList: boolean;
}

const colorOptions = [
    { id: 'default', bg: 'bg-white dark:bg-[#1e1f22]', border: 'border-gray-200 dark:border-gray-700' },
    { id: 'red', bg: 'bg-red-50/60 dark:bg-red-950/20', border: 'border-red-200/60 dark:border-red-900/40' },
    { id: 'rose', bg: 'bg-rose-50/60 dark:bg-rose-950/20', border: 'border-rose-200/60 dark:border-rose-900/40' },
    { id: 'orange', bg: 'bg-orange-50/60 dark:bg-orange-950/20', border: 'border-orange-200/60 dark:border-orange-900/40' },
    { id: 'amber', bg: 'bg-amber-50/60 dark:bg-amber-950/20', border: 'border-amber-200/60 dark:border-amber-900/40' },
    { id: 'yellow', bg: 'bg-yellow-50/60 dark:bg-yellow-950/20', border: 'border-yellow-200/60 dark:border-yellow-900/40' },
    { id: 'green', bg: 'bg-emerald-50/60 dark:bg-emerald-950/20', border: 'border-emerald-200/60 dark:border-emerald-900/40' },
    { id: 'teal', bg: 'bg-teal-50/60 dark:bg-teal-950/20', border: 'border-teal-200/60 dark:border-teal-900/40' },
    { id: 'cyan', bg: 'bg-cyan-50/60 dark:bg-cyan-950/20', border: 'border-cyan-200/60 dark:border-cyan-900/40' },
    { id: 'sky', bg: 'bg-sky-50/60 dark:bg-sky-950/20', border: 'border-sky-200/60 dark:border-sky-900/40' },
    { id: 'blue', bg: 'bg-blue-50/60 dark:bg-blue-950/20', border: 'border-blue-200/60 dark:border-blue-900/40' },
    { id: 'indigo', bg: 'bg-indigo-50/60 dark:bg-indigo-950/20', border: 'border-indigo-200/60 dark:border-indigo-900/40' },
    { id: 'purple', bg: 'bg-purple-50/60 dark:bg-purple-950/20', border: 'border-purple-200/60 dark:border-purple-900/40' },
    { id: 'violet', bg: 'bg-violet-50/60 dark:bg-violet-950/20', border: 'border-violet-200/60 dark:border-violet-900/40' },
    { id: 'pink', bg: 'bg-pink-50/60 dark:bg-pink-950/20', border: 'border-pink-200/60 dark:border-pink-900/40' },
];

// --- Improved Markdown <-> HTML Converters ---

const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';

    // 1. Protect Code Blocks: Extract them so we don't mess up their newlines
    const codeBlocks: string[] = [];
    let processed = markdown.replace(/```([\s\S]*?)```/gim, (match, code) => {
        codeBlocks.push(code); // Keep original code content
        return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
    });

    // --- Table Processing Helper Functions ---
    const isSeparatorRow = (rowCells: string[]): boolean => {
        if (rowCells.length === 0) return false;
        return rowCells.every(cell => {
            const clean = cell.trim();
            if (clean === '') return true;
            return /^[:-]+$/.test(clean);
        });
    };

    const renderTable = (rows: string[][]): string => {
        if (rows.length < 2) {
            return rows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
        }

        const hasSeparator = isSeparatorRow(rows[1]);
        let tableHtml = '<table class="w-full border-collapse my-4 table-auto">';
        
        const headers = rows[0];
        tableHtml += '<thead><tr>';
        headers.forEach(cell => {
            const content = cell
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\*(.*?)\*/g, '<i>$1</i>');
            tableHtml += `<th class="border px-4 py-2 bg-gray-100 dark:bg-gray-800 font-bold border-gray-300 dark:border-gray-700 text-left">${content}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        const startIndex = hasSeparator ? 2 : 1;
        for (let i = startIndex; i < rows.length; i++) {
            const cells = rows[i];
            tableHtml += '<tr>';
            const colCount = headers.length;
            for (let j = 0; j < colCount; j++) {
                const cell = cells[j] || '';
                const content = cell
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>');
                tableHtml += `<td class="border px-4 py-2 border-gray-300 dark:border-gray-700">${content}</td>`;
            }
            tableHtml += '</tr>';
        }

        tableHtml += '</tbody></table>';
        return tableHtml;
    };

    const parseMarkdownTables = (text: string): string => {
        const lines = text.replace(/\r/g, '').split('\n');
        const resultLines: string[] = [];
        let inTable = false;
        let tableRows: string[][] = [];

        const isTableRow = (line: string): boolean => {
            const trimmed = line.trim();
            return trimmed.startsWith('|') && trimmed.endsWith('|');
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isTableRow(line)) {
                const trimmed = line.trim();
                let cells = trimmed.split('|').map(c => c.trim());
                if (cells.length > 1) {
                    if (trimmed.startsWith('|')) cells.shift();
                    if (trimmed.endsWith('|')) cells.pop();
                }
                
                if (!inTable) {
                    inTable = true;
                    tableRows = [cells];
                } else {
                    tableRows.push(cells);
                }
            } else {
                if (inTable) {
                    resultLines.push(renderTable(tableRows));
                    inTable = false;
                    tableRows = [];
                }
                resultLines.push(line);
            }
        }
        
        if (inTable) {
            resultLines.push(renderTable(tableRows));
        }

        return resultLines.join('\n');
    };

    processed = parseMarkdownTables(processed);

    let html = processed
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        // Lists
        .replace(/^\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>') // Ordered
        .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>') // Unordered
        // Separator
        .replace(/^(---|___|\*\*\*)\s*$/gim, '<hr>')
        // Formatting
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*)\*/gim, '<i>$1</i>')
        .replace(/~~(.*)~~/gim, '<s>$1</s>')
        // Inline Code
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');

    html = html.replace(/<\/ul>\s*<ul>/gim, '');
    html = html.replace(/<\/ol>\s*<ol>/gim, '');
    html = html.replace(/(<\/h[1-6]>|<\/blockquote>|<\/ul>|<\/ol>|<hr>|<\/table>|___CODE_BLOCK_\d+___)\n/gim, '$1');
    html = html.replace(/\n(<hr>)/gim, '$1');
    html = html.replace(/\n(___CODE_BLOCK_\d+___)/gim, '$1');
    html = html.replace(/\n/gim, '<br>');
    html = html.replace(/___CODE_BLOCK_(\d+)___/gim, (match, index) => {
        const codeContent = codeBlocks[parseInt(index, 10)];
        return `<pre>${codeContent}</pre>`;
    });

    return html;
};

const htmlToMarkdown = (html: string): string => {
    if (!html) return '';

    // 1. Protect Any Custom Widget/Header HTML Block
    // Matches any blocks wrapped in <!-- <NAME>_START --> ... <!-- <NAME>_END --> (case-insensitive)
    // We must extract them before cleaning so the HTML tags don't get stripped or mangled.
    const protectedWidgets: string[] = [];
    let preservedHtml = html.replace(/(<!--\s*([\w_-]+)_(?:START|start)\s*-->[\s\S]*?<!--\s*\2_(?:END|end)\s*-->)/gi, (match) => {
        protectedWidgets.push(match);
        return `___PROTECTED_WIDGET_${protectedWidgets.length - 1}___`;
    });

    let cleaned = preservedHtml.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gim, '$1');
    cleaned = cleaned.replace(/<div[^>]*>\s*<br\s*\/?>/gim, '<div>');
    cleaned = cleaned.replace(/<br\s*\/?>\s*<\/div>/gim, '</div>');
    cleaned = cleaned.replace(/<br\s*\/?>\s*<\/(p|li|h[1-6]|pre)>/gim, '</$1>');

    cleaned = cleaned.replace(/<pre>([\s\S]*?)<\/pre>/gim, (match, content) => {
        let code = content.replace(/<br\s*\/?>/gim, '\n');
        code = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        return `\n\`\`\`\n${code.trim()}\n\`\`\`\n`;
    });

    cleaned = cleaned.replace(/<table[^>]*>([\s\S]*?)<\/table>/gim, (match, content) => {
        let markdown = '\n';
        const headerMatch = content.match(/<thead>([\s\S]*?)<\/thead>/i);
        let columnCount = 0;
        
        if (headerMatch) {
             const ths = headerMatch[1].match(/<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>/gim);
             if (ths) {
                 const headers = ths.map(th => {
                     let text = th.replace(/<\/?(?:th|td|b|strong|i|em)[^>]*>/gim, '').trim();
                     return text;
                 });
                 columnCount = headers.length;
                 markdown += '| ' + headers.join(' | ') + ' |\n';
                 markdown += '| ' + headers.map(() => ' :--- ').join(' | ') + ' |\n';
             }
        }
        
        const bodyMatch = content.match(/<tbody>([\s\S]*?)<\/tbody>/i);
        if (bodyMatch) {
            const trs = bodyMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gim);
            if (trs) {
                trs.forEach(tr => {
                    const tds = tr.match(/<td[^>]*>(.*?)<\/td>/gim);
                    if (tds) {
                         const cells = tds.map(td => {
                             let cellContent = td.replace(/<\/?td[^>]*>/gim, '').trim();
                             cellContent = cellContent.replace(/<b>(.*?)<\/b>/gim, '**$1**').replace(/<strong>(.*?)<\/strong>/gim, '**$1**');
                             return cellContent;
                         });
                         while (cells.length < columnCount) cells.push('');
                         markdown += '| ' + cells.join(' | ') + ' |\n';
                    }
                });
            }
        }
        return markdown + '\n';
    });

    cleaned = cleaned.replace(/<ol>([\s\S]*?)<\/ol>/gim, (match, listContent) => listContent.replace(/<li>(.*?)<\/li>/gim, '1. $1\n'));
    cleaned = cleaned.replace(/<ul>([\s\S]*?)<\/ul>/gim, (match, listContent) => listContent.replace(/<li>(.*?)<\/li>/gim, '- $1\n'));
    cleaned = cleaned.replace(/<\/?ol>/gim, '').replace(/<\/?ul>/gim, '');

    let md = cleaned
        .replace(/<h1>(.*?)<\/h1>/gim, '# $1\n')
        .replace(/<h2>(.*?)<\/h2>/gim, '## $1\n')
        .replace(/<h3>(.*?)<\/h3>/gim, '### $1\n')
        .replace(/<blockquote>(.*?)<\/blockquote>/gim, '> $1\n')
        .replace(/<b>(.*?)<\/b>/gim, '**$1**')
        .replace(/<strong>(.*?)<\/strong>/gim, '**$1**')
        .replace(/<i>(.*?)<\/i>/gim, '*$1*')
        .replace(/<em>(.*?)<\/em>/gim, '*$1*')
        .replace(/<s>(.*?)<\/s>/gim, '~~$1~~')
        .replace(/<strike>(.*?)<\/strike>/gim, '~~$1~~')
        .replace(/<hr\s*\/?>/gim, '\n---\n')
        .replace(/<code>(.*?)<\/code>/gim, '`$1`')
        .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gim, '[$2]($1)')
        .replace(/<div[^>]*>/gim, '\n')
        .replace(/<\/div>/gim, '')
        .replace(/<p[^>]*>/gim, '\n')
        .replace(/<\/p>/gim, '\n')
        .replace(/<br\s*\/?>/gim, '\n')
        .replace(/&nbsp;/gim, ' ');

    // 2. Restore protected widgets
    md = md.replace(/___PROTECTED_WIDGET_(\d+)___/g, (match, index) => {
        return protectedWidgets[parseInt(index, 10)];
    });

    md = md.replace(/\n{3,}/g, '\n\n');
    return md.trim();
};

interface EditorToolbarProps {
    isReadOnly: boolean;
    showColorPicker: boolean;
    setShowColorPicker: React.Dispatch<React.SetStateAction<boolean>>;
    colorOptions: typeof colorOptions;
    selectedNote: Partial<Note> | null;
    setSelectedNote: React.Dispatch<React.SetStateAction<Partial<Note> | null>>;
    notes: Note[];
    handleSaveNote: (note: Partial<Note>) => Promise<void>;
    getEditorContent: () => string;
    setShareModalNote: (note: Note | null) => void;
    handleFormat: (e: React.MouseEvent, command: string, value?: string) => void;
    activeFormats: ActiveFormats;
    getButtonStyle: (isActive: boolean) => string;
    handleInsertTable: (e: React.MouseEvent) => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = React.memo(({
    isReadOnly,
    showColorPicker,
    setShowColorPicker,
    colorOptions,
    selectedNote,
    setSelectedNote,
    notes,
    handleSaveNote,
    getEditorContent,
    setShareModalNote,
    handleFormat,
    activeFormats,
    getButtonStyle,
    handleInsertTable
}) => {
    if (isReadOnly || !selectedNote) return null;

    return (
        <div className="relative z-20 flex-none p-2.5 border-t border-gray-100 dark:border-gray-800 bg-white/90 dark:bg-black/90 backdrop-blur-md pb-safe">
            {showColorPicker && (
                <div className="absolute bottom-full left-3 right-3 md:right-auto mb-3 p-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-gray-200/80 dark:border-gray-800 flex flex-nowrap overflow-x-auto max-w-[calc(100vw-1.5rem)] md:max-w-xl gap-2 z-30 animate-fade-in-up items-center py-2 px-2.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {colorOptions.map(option => (
                        <button
                            key={option.id}
                            onClick={async () => {
                                const updatedTheme = option.id as Note['colorTheme'];
                                setSelectedNote(prev => (prev ? { ...prev, colorTheme: updatedTheme } : null));
                                setShowColorPicker(false);
                                
                                if (selectedNote && selectedNote.id) {
                                    const isExisting = notes.some(n => n.id === selectedNote.id);
                                    if (isExisting) {
                                        const currentContent = getEditorContent();
                                        await handleSaveNote({ ...selectedNote, colorTheme: updatedTheme, content: currentContent });
                                    }
                                }
                            }}
                            className={`w-7 h-7 min-w-[28px] shrink-0 rounded-full border-2 ${option.bg} ${option.border} flex items-center justify-center transition-transform hover:scale-110 focus:outline-none`}
                        >
                            {((selectedNote.colorTheme === option.id) || (!selectedNote.colorTheme && option.id === 'default')) && <Check className="w-3.5 h-3.5 text-black/60 dark:text-white/70" />}
                        </button>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <button 
                    onClick={() => setShowColorPicker(prev => !prev)}
                    className={`p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${showColorPicker ? 'bg-gray-100 dark:bg-gray-800 text-amber-500' : 'text-neutral-500 dark:text-gray-400'}`}
                    title="Change Theme"
                >
                    <Palette className="w-5 h-5" />
                </button>

                <button 
                    onClick={() => selectedNote?.id && setShareModalNote(selectedNote as Note)}
                    className="p-2.5 rounded-xl hover:bg-amber-100/50 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400 transition-colors"
                    title="Share Note Link"
                >
                    <Share2 className="w-5 h-5" />
                </button>

                <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />

                <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide pr-2">
                    <button onMouseDown={(e) => handleFormat(e, 'undo')} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-neutral-500 dark:text-gray-400" title="Undo"><Undo className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => handleFormat(e, 'redo')} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-neutral-500 dark:text-gray-400" title="Redo"><Redo className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1" />
                    
                    <button onMouseDown={(e) => handleFormat(e, 'bold')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.bold)}`} title="Bold"><Bold className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => handleFormat(e, 'italic')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.italic)}`} title="Italic"><Italic className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => handleFormat(e, 'strikeThrough')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.strikeThrough)}`} title="Strikethrough"><Strikethrough className="w-4 h-4" /></button>
                    
                    <button onMouseDown={(e) => handleFormat(e, 'formatBlock', 'H1')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.blockType === 'h1')}`} title="Heading 1"><Heading1 className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => handleFormat(e, 'formatBlock', 'H2')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.blockType === 'h2')}`} title="Heading 2"><Heading2 className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => handleFormat(e, 'formatBlock', 'H3')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.blockType === 'h3')}`} title="Heading 3"><Heading3 className="w-4 h-4" /></button>
                    
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1" />
                    
                    <button onMouseDown={(e) => handleFormat(e, 'insertUnorderedList')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.isUnorderedList)}`} title="List"><List className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => handleFormat(e, 'insertOrderedList')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.isOrderedList)}`} title="Ordered List"><ListOrdered className="w-4 h-4" /></button>
                    
                    <button onMouseDown={(e) => handleFormat(e, 'formatBlock', 'blockquote')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.blockType === 'blockquote')}`} title="Quote"><Quote className="w-4 h-4" /></button>
                    <button onMouseDown={(e) => handleFormat(e, 'formatBlock', 'pre')} className={`p-2.5 rounded-xl transition-colors ${getButtonStyle(activeFormats.blockType === 'pre')}`} title="Code Block"><Code className="w-4 h-4" /></button>
                    <button onMouseDown={handleInsertTable} className="p-2.5 rounded-xl transition-colors text-neutral-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title="Insert Table"><Table className="w-4 h-4" /></button>
                    
                    <button onMouseDown={(e) => handleFormat(e, 'insertHorizontalRule')} className="p-2.5 rounded-xl transition-colors text-neutral-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title="Separator"><Minus className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
});

const NotesView: React.FC<NotesViewProps> = ({ user, onBack, searchQuery, setSearchQuery, setNotesHeaderState, isSuspended }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

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
    
    // Portal Target State for safe client-side mounting
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    useEffect(() => {
        setPortalTarget(document.getElementById('main-content-area') || document.body);
    }, []);
    
    // Editor/Detail View State
    const [selectedNote, setSelectedNote] = useState<Partial<Note> | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isNoteLoading, setIsNoteLoading] = useState(false);
    const [isEditorFocused, setIsEditorFocused] = useState(false);
    const [transformOrigin, setTransformOrigin] = useState<string>('center');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
    const [isNoteDeleting, setIsNoteDeleting] = useState(false);
    const [shareModalNote, setShareModalNote] = useState<Note | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false); // Sync state
    const [isSaving, setIsSaving] = useState(false); // Saving state
    const fetchingUserIdRef = useRef<string | null | undefined>(undefined);
    const isClosingRef = useRef(false);
    const activeClosingNoteIdRef = useRef<string | null>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    const urlNoteId = React.useMemo(() => {
        const parts = location.pathname.split('/');
        if (parts.length >= 3 && parts[1] === 'notes' && parts[2]) {
            return parts[2];
        }
        return null;
    }, [location.pathname]);

    useEffect(() => {
        return () => {
            if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
            }
        };
    }, []);

    // Performance optimization: limit initial rendering
    const [displayLimit, setDisplayLimit] = useState(24);
    const observerTarget = useRef<HTMLDivElement>(null);
    
    // Toolbar Active State
    const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
        bold: false,
        italic: false,
        strikeThrough: false,
        blockType: 'p',
        isOrderedList: false,
        isUnorderedList: false,
    });
    
    const editorRef = useRef<HTMLDivElement>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    // Reset limit when query changes
    useEffect(() => {
        setDisplayLimit(24);
    }, [searchQuery]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayLimit(prev => prev + 12);
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
        );
        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!selectedNote) return;
        const adjustHeight = () => {
            if (editorContainerRef.current && window.visualViewport) {
                editorContainerRef.current.style.height = `${window.visualViewport.height}px`;
            }
        };
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', adjustHeight);
            window.visualViewport.addEventListener('scroll', adjustHeight);
        }
        adjustHeight();
        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', adjustHeight);
                window.visualViewport.removeEventListener('scroll', adjustHeight);
            }
        };
    }, [selectedNote]);

    useEffect(() => {
        if (fetchingUserIdRef.current === user?.id) return;
        fetchingUserIdRef.current = user?.id;
        loadNotes();
    }, [user?.id]);

    const loadNotes = async () => {
        setIsLoading(true);
        try {
            const fetchedNotes = await getNotes(user);
            setNotes(fetchedNotes);
        } catch (e) {
            console.error("Failed to load notes", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenNote = useCallback(async (note?: Note, e?: React.MouseEvent) => {
        if (!note && isSuspended) {
            addToast("Create note blocked: Account suspended.", "error");
            return;
        }

        isClosingRef.current = false;
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }

        if (e) {
            const rect = e.currentTarget.getBoundingClientRect();
            const originX = rect.left + rect.width / 2;
            const originY = rect.top + rect.height / 2;
            setTransformOrigin(`${originX}px ${originY}px`);
        } else if (note) {
            const cardEl = document.getElementById(`note-${note.id}`);
            if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                const originX = rect.left + rect.width / 2;
                const originY = rect.top + rect.height / 2;
                setTransformOrigin(`${originX}px ${originY}px`);
            } else {
                setTransformOrigin('center');
            }
        } else {
            setTransformOrigin('center');
        }

        if (note) {
            if (location.pathname !== `/notes/${note.id}`) {
                navigate(`/notes/${note.id}`);
            }
        } else {
            const newId = crypto.randomUUID();
            if (location.pathname !== `/notes/${newId}`) {
                navigate(`/notes/${newId}`);
            }
        }
    }, [navigate, isSuspended, addToast, location.pathname]);

    const getEditorContent = () => {
        if (editorRef.current) {
            return htmlToMarkdown(editorRef.current.innerHTML);
        }
        return selectedNote?.content || '';
    };

    const handleCloseNote = useCallback(async (fromUrl?: boolean | React.MouseEvent | React.KeyboardEvent) => {
        if (!selectedNote || isClosingRef.current) return;
        isClosingRef.current = true;
        const noteToClose = selectedNote;
        activeClosingNoteIdRef.current = noteToClose.id;

        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }

        const isNewNote = !notes.some(n => n.id === noteToClose.id);
        const currentContent = getEditorContent();

        if (setSearchQuery) {
            setSearchQuery('');
        }

        const cardEl = document.getElementById(`note-${noteToClose.id}`);
        if (cardEl) {
            const rect = cardEl.getBoundingClientRect();
            const originX = rect.left + rect.width / 2;
            const originY = rect.top + rect.height / 2;
            setTransformOrigin(`${originX}px ${originY}px`);
        }

        const isPopState = fromUrl === true;

        // Handle saving synchronously if not closing via URL navigation (popstate)
        if (!isPopState) {
            if (isNewNote && (noteToClose.title || currentContent)) {
                const noteToSave: Partial<Note> = {
                    ...noteToClose,
                    content: currentContent
                };
                try {
                    setIsSaving(true);
                    await handleSaveNote(noteToSave);
                    addToast('Note created.', 'success');
                } catch (err) {
                    console.error("Failed to save note on close", err);
                } finally {
                    setIsSaving(false);
                }
            } else if (!isNewNote) {
                const original = notes.find(n => n.id === noteToClose.id);
                if (!isReadOnly && original && (original.content !== currentContent || original.title !== noteToClose.title || original.colorTheme !== noteToClose.colorTheme)) {
                    try {
                        setIsSaving(true);
                        await handleSaveNote({ ...noteToClose, content: currentContent });
                        addToast('Note saved.', 'success');
                    } catch (err) {
                        console.error("Failed to save note on close", err);
                    } finally {
                        setIsSaving(false);
                    }
                }
            }
        }

        // Close editor UI after saving is complete
        setShowColorPicker(false);
        setIsReadOnly(false);
        setIsVisible(false);
        setSelectedNote(null);
        isClosingRef.current = false;
        activeClosingNoteIdRef.current = null;

        if (!isPopState && location.pathname.startsWith('/notes/')) {
            navigate('/notes');
        }
    }, [selectedNote, notes, isReadOnly, setSearchQuery, addToast, navigate, location.pathname]);

    useEffect(() => {
        if (isLoading) return;

        if (!urlNoteId) {
            isClosingRef.current = false;
            activeClosingNoteIdRef.current = null;
            setSelectedNote(null);
        }

        if (urlNoteId && activeClosingNoteIdRef.current === urlNoteId) {
            return;
        }

        if (isClosingRef.current) {
            return;
        }

        if (urlNoteId) {
            if (selectedNote?.id === urlNoteId) {
                return;
            }
            if (closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current);
                closeTimeoutRef.current = null;
            }

            const note = notes.find(n => n.id === urlNoteId);
            if (note) {
                // Determine transform origin from DOM if not set
                const cardEl = document.getElementById(`note-${urlNoteId}`);
                if (cardEl) {
                    const rect = cardEl.getBoundingClientRect();
                    const originX = rect.left + rect.width / 2;
                    const originY = rect.top + rect.height / 2;
                    setTransformOrigin(`${originX}px ${originY}px`);
                }

                setSelectedNote(note);
                setIsReadOnly(true);
                setIsNoteLoading(false);
                setIsVisible(true);
                setShowColorPicker(false);
                setActiveFormats({ bold: false, italic: false, strikeThrough: false, blockType: 'p', isOrderedList: false, isUnorderedList: false });

                // Fetch any updated details in background
                getNoteById(note.id, user || null).then((fullNote) => {
                    if (fullNote) {
                        setSelectedNote(prev => prev?.id === fullNote.id ? { ...prev, ...fullNote } : prev);
                    }
                }).catch((err) => {
                    console.error("Failed to fetch full note details", err);
                });
            } else {
                // If ID is valid draft (UUID is 36 chars), initialize the draft
                if (urlNoteId.length === 36) {
                    setSelectedNote({
                        id: urlNoteId,
                        title: '',
                        content: '',
                        colorTheme: 'default',
                        tags: [],
                        isPinned: false
                    });
                    setIsReadOnly(false);
                    setIsNoteLoading(false);
                    setIsVisible(true);
                    setShowColorPicker(false);
                    setActiveFormats({ bold: false, italic: false, strikeThrough: false, blockType: 'p', isOrderedList: false, isUnorderedList: false });
                } else {
                    navigate('/notes', { replace: true });
                }
            }
        } else {
            if (selectedNote) {
                handleCloseNote(true);
            }
        }
    }, [urlNoteId, isLoading, notes, user, navigate, selectedNote, handleCloseNote]);


    const handleSaveNote = async (noteData: Partial<Note>) => {
        if (isSuspended) {
            addToast("Save note blocked: Account suspended.", "error");
            return;
        }
        if (!noteData.title?.trim() && !noteData.content?.trim()) {
            return;
        }

        const newNote: Note = {
            id: noteData.id || crypto.randomUUID(),
            user_id: user?.id,
            title: noteData.title || '',
            content: noteData.content || '',
            tags: noteData.tags || [],
            isPinned: noteData.isPinned || false,
            colorTheme: noteData.colorTheme || 'default',
            createdAt: noteData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setNotes(prev => {
            const existingIndex = prev.findIndex(n => n.id === newNote.id);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newNote;
                return updated;
            }
            return [newNote, ...prev];
        });
        
        await saveNote(newNote, user);
    };

    const handleSyncWallet = async () => {
        if (isSuspended) {
            addToast("Sync wallet blocked: Account suspended.", "error");
            return;
        }
        if (!selectedNote || !selectedNote.tags) return;
        
        const walletTag = selectedNote.tags.find(t => t.startsWith('wallet:'));
        if (!walletTag) return;
        
        const profileIdStr = walletTag.split('wallet:')[1];
        const profileId = profileIdStr === 'default' ? null : profileIdStr;
        
        setIsSyncing(true);
        try {
            const success = await syncAllTransactionsToNote(user, profileId, 'Wallet');
            if (success) {
                invalidateNoteCache(selectedNote.id);
                // Fetch full updated note details explicitly to prevent truncated content from list endpoint
                const fullUpdatedNote = await getNoteById(selectedNote.id, user || null, true);
                const freshNotes = await getNotes(user);
                setNotes(freshNotes);
                
                const noteToSet = fullUpdatedNote || freshNotes.find(n => n.id === selectedNote.id);
                if (noteToSet) {
                    setSelectedNote(noteToSet);
                    if (editorRef.current) {
                        editorRef.current.innerHTML = markdownToHtml(noteToSet.content || '');
                    }
                }
                addToast('Wallet synced successfully.', 'success');
            } else {
                addToast('Sync failed.', 'error');
            }
        } catch (e) {
            console.error("Sync error", e);
            addToast('An error occurred during sync.', 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDeleteClick = useCallback((id: string) => {
        if (isSuspended) {
            addToast("Delete note blocked: Account suspended.", "error");
            return;
        }
        setNoteToDelete(id);
    }, [isSuspended, addToast]);

    const handleConfirmDelete = async () => {
        if (noteToDelete) {
            setIsNoteDeleting(true);
            try {
                setNotes(prev => prev.filter(n => n.id !== noteToDelete));
                await deleteNote(noteToDelete, user);
                addToast('Note deleted.', 'success');
                if (selectedNote?.id === noteToDelete) {
                    setIsVisible(false);
                    setSelectedNote(null);
                }
                setNoteToDelete(null);
            } finally {
                setIsNoteDeleting(false);
            }
        }
    };

    const handlePinNote = useCallback(async (note: Note, isPinned: boolean) => {
        if (isSuspended) {
            addToast("Pin note blocked: Account suspended.", "error");
            return;
        }
        const updated = { ...note, isPinned, updatedAt: new Date().toISOString() };
        setNotes(prev => prev.map(n => n.id === note.id ? updated : n));
        await saveNote(updated, user);
        addToast(isPinned ? 'Note pinned.' : 'Note unpinned.', 'info');
    }, [user, addToast, isSuspended]);

    const checkFormatsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const checkFormats = useCallback(() => {
        if (checkFormatsTimeoutRef.current) {
            clearTimeout(checkFormatsTimeoutRef.current);
        }

        checkFormatsTimeoutRef.current = setTimeout(() => {
            if (!document.queryCommandState) return;

            const blockType = document.queryCommandValue('formatBlock');
            const newFormats = {
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                strikeThrough: document.queryCommandState('strikeThrough'),
                blockType: blockType ? blockType.toLowerCase() : 'p',
                isOrderedList: document.queryCommandState('insertOrderedList'),
                isUnorderedList: document.queryCommandState('insertUnorderedList'),
            };

            setActiveFormats(prev => {
                if (
                    prev.bold === newFormats.bold &&
                    prev.italic === newFormats.italic &&
                    prev.strikeThrough === newFormats.strikeThrough &&
                    prev.blockType === newFormats.blockType &&
                    prev.isOrderedList === newFormats.isOrderedList &&
                    prev.isUnorderedList === newFormats.isUnorderedList
                ) {
                    return prev;
                }
                return newFormats;
            });
        }, 150);
    }, []);

    useEffect(() => {
        return () => {
            if (checkFormatsTimeoutRef.current) {
                clearTimeout(checkFormatsTimeoutRef.current);
            }
        };
    }, []);

    const execCmd = (command: string, value: string | undefined = undefined) => {
        if (command === 'formatBlock' && value) {
            const currentBlock = document.queryCommandValue('formatBlock');
            if (currentBlock && currentBlock.toLowerCase() === value.toLowerCase()) {
                document.execCommand('formatBlock', false, 'p');
                checkFormats();
                if (editorRef.current) editorRef.current.focus();
                return;
            }
        }
        document.execCommand(command, false, value);
        checkFormats();
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    const handleFormat = (e: React.MouseEvent, command: string, value?: string) => {
        e.preventDefault();
        execCmd(command, value);
    };

    const handleInsertTable = (e: React.MouseEvent) => {
        e.preventDefault();
        const tableTemplate = `
| Column 1 | Column 2 | Column 3 |
| :--- | :--- | :--- |
| Item A1 | Item B1 | Item C1 |
| Item A2 | Item B2 | Item C2 |
`;
        const tableHtml = markdownToHtml(tableTemplate);
        document.execCommand('insertHTML', false, tableHtml + '<p><br></p>');
        checkFormats();
        if (editorRef.current) {
            editorRef.current.focus();
        }
    };

    const filteredNotes = useMemo(() => {
        return notes
            .filter(n => 
                n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
            )
            .sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            });
    }, [notes, searchQuery]);

    const getEditorBgClass = () => {
        const theme = selectedNote?.colorTheme || 'default';
        const colorObj = colorOptions.find(c => c.id === theme);
        return colorObj ? colorObj.bg : 'bg-white';
    };

    const getButtonStyle = (isActive: boolean) => {
        return isActive 
            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' 
            : 'text-neutral-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800';
    };
    
    const handleEditorClick = () => {
        if (isReadOnly) {
             addToast('Read-only mode. Tap "Enable Editing" to make changes.', 'info');
        }
    };

    useEffect(() => {
        if (selectedNote && editorRef.current) {
            if (isReadOnly || editorRef.current.innerHTML === '') {
                editorRef.current.innerHTML = markdownToHtml(selectedNote.content || '');
            }
        }
    }, [selectedNote?.id, selectedNote?.content, isReadOnly]);

    const [searchMatches, setSearchMatches] = useState<HTMLElement[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

    // Remove existing highlights
    const removeHighlights = useCallback(() => {
        if (!editorRef.current) return;
        const marks = editorRef.current.querySelectorAll('mark.search-highlight');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
                parent.normalize();
            }
        });
    }, []);

    // Apply new highlights
    const applyHighlights = useCallback((query: string) => {
        if (!editorRef.current || !query) return [];
        
        const lowerQuery = query.toLowerCase();
        const matches: HTMLElement[] = [];

        const highlightNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.nodeValue || '';
                const lowerText = text.toLowerCase();
                const index = lowerText.indexOf(lowerQuery);
                
                if (index !== -1 && node.parentNode) {
                    const matchText = text.substring(index, index + query.length);
                    const beforeText = text.substring(0, index);
                    const afterText = text.substring(index + query.length);
                    
                    const mark = document.createElement('mark');
                    mark.className = 'search-highlight bg-yellow-300 text-black rounded-sm px-0.5 transition-colors';
                    mark.textContent = matchText;
                    
                    const afterNode = document.createTextNode(afterText);
                    
                    node.nodeValue = beforeText;
                    node.parentNode.insertBefore(mark, node.nextSibling);
                    node.parentNode.insertBefore(afterNode, mark.nextSibling);
                    
                    matches.push(mark);
                    
                    highlightNode(afterNode);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'MARK') {
                Array.from(node.childNodes).forEach(highlightNode);
            }
        };

        Array.from(editorRef.current.childNodes).forEach(highlightNode);
        return matches;
    }, []);

    useEffect(() => {
        if (!editorRef.current || !selectedNote) return;
        
        removeHighlights();
        
        if (!searchQuery) {
            setSearchMatches([]);
            setCurrentMatchIndex(-1);
            
            // Also reset table row visibility if it was hidden
            const rows = editorRef.current.querySelectorAll('table tbody tr');
            rows.forEach(row => { (row as HTMLElement).style.display = ''; });
            return;
        }

        const matches = applyHighlights(searchQuery);
        setSearchMatches(matches);
        
        if (matches.length > 0) {
            setCurrentMatchIndex(0);
            matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            matches[0].classList.add('bg-orange-400', 'text-white');
            matches[0].classList.remove('bg-yellow-300', 'text-black');
        } else {
            setCurrentMatchIndex(-1);
        }

        // Optional: Still filter table rows if they don't contain matches
        const rows = editorRef.current.querySelectorAll('table tbody tr');
        rows.forEach(row => {
            const hasMatch = row.querySelector('mark.search-highlight');
            (row as HTMLElement).style.display = hasMatch ? '' : 'none';
        });

    }, [searchQuery, selectedNote, applyHighlights, removeHighlights]);

    const handleNextMatch = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (searchMatches.length === 0) return;
        
        const prevIndex = currentMatchIndex;
        const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
        
        if (prevIndex >= 0 && searchMatches[prevIndex]) {
            searchMatches[prevIndex].classList.remove('bg-orange-400', 'text-white');
            searchMatches[prevIndex].classList.add('bg-yellow-300', 'text-black');
        }
        
        searchMatches[nextIndex].classList.add('bg-orange-400', 'text-white');
        searchMatches[nextIndex].classList.remove('bg-yellow-300', 'text-black');
        searchMatches[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setCurrentMatchIndex(nextIndex);
    };

    const handlePrevMatch = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (searchMatches.length === 0) return;
        
        const prevIndex = currentMatchIndex;
        const nextIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        
        if (prevIndex >= 0 && searchMatches[prevIndex]) {
            searchMatches[prevIndex].classList.remove('bg-orange-400', 'text-white');
            searchMatches[prevIndex].classList.add('bg-yellow-300', 'text-black');
        }
        
        searchMatches[nextIndex].classList.add('bg-orange-400', 'text-white');
        searchMatches[nextIndex].classList.remove('bg-yellow-300', 'text-black');
        searchMatches[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setCurrentMatchIndex(nextIndex);
    };
    
    const isWalletLinked = selectedNote?.tags?.some(t => t.startsWith('wallet:'));

    useEffect(() => {
        if (selectedNote) {
            setNotesHeaderState({
                title: selectedNote.title || 'Untitled Note',
                isReadOnly,
                isWalletLinked: !!isWalletLinked,
                isSyncing,
                isSaving,
                onBack: handleCloseNote,
                onEdit: () => setIsReadOnly(false),
                onSave: handleCloseNote,
                onSync: handleSyncWallet
            });
        } else {
            setNotesHeaderState({
                title: null,
                isReadOnly: false,
                isWalletLinked: false,
                isSyncing: false,
                isSaving: false
            });
        }
    }, [selectedNote?.title, selectedNote?.updatedAt, isReadOnly, isWalletLinked, isSyncing, isSaving, selectedNote, handleCloseNote]);

    return (
        <main className="relative z-10 h-full overflow-y-auto bg-[#F2F4F7] dark:bg-black transition-colors scrollbar-hide pt-20 md:pt-16 dev-console-spacing-pb">
            
            <div className="w-full max-w-[1600px] mx-auto p-3 md:p-6 pb-6 flex flex-col">
                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 space-y-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-40 rounded-3xl bg-white/50 dark:bg-white/5 animate-pulse mb-3" />
                        ))}
                    </div>
                ) : (
                    <>
                        <div className={searchQuery ? "flex flex-col gap-3 md:gap-2 pb-2" : "grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-2 pb-2"}>
                            {!searchQuery && notes.length === 0 && (
                                <button 
                                    onClick={(e) => handleOpenNote(undefined, e)}
                                    className="w-full rounded-3xl p-1 bg-gradient-to-br from-amber-400 via-orange-400 to-pink-500 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group text-left h-[18vh] min-h-[140px] md:min-h-[120px] md:h-32"
                                >
                                    <div className="bg-white dark:bg-[#050505] h-full w-full rounded-[1.3rem] p-4 flex flex-col gap-2 items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                        <span className="font-bold text-sm text-neutral-800 dark:text-white">New Note</span>
                                    </div>
                                </button>
                            )}

                            {filteredNotes.slice(0, displayLimit).map(note => (
                                <NoteCard 
                                    key={note.id} 
                                    note={note} 
                                    onClick={handleOpenNote}
                                    onDelete={handleDeleteClick}
                                    onPin={handlePinNote}
                                    onShare={(noteToShare, e) => { e.stopPropagation(); setShareModalNote(noteToShare); }}
                                />
                            ))}
                        </div>
                        {/* Sentinel for Infinite Scroll */}
                        {filteredNotes.length > displayLimit && (
                            <div ref={observerTarget} className="py-6 flex justify-center items-center w-full">
                                <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-medium bg-white dark:bg-[#1a1a1a] px-4 py-2 rounded-full shadow-sm">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Loading more notes...
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {notes.length > 0 && (
                <button 
                    onClick={(e) => handleOpenNote(undefined, e)}
                    className="fixed right-6 z-40 w-14 h-14 bg-amber-500 rounded-full text-white shadow-lg flex items-center justify-center hover:scale-110 hover:bg-amber-600 transition-all active:scale-95"
                    style={{ bottom: 'calc(var(--dev-console-padding, 0px) + 1.5rem)' }}
                    title="Create New Note"
                >
                    <Plus className="w-8 h-8" />
                </button>
            )}

            {/* FULL PAGE Editor via Portal with Smooth Zoom Effect */}
            {portalTarget && createPortal(
                <AnimatePresence onExitComplete={() => {
                    setSelectedNote(null);
                }}>
                    {isVisible && selectedNote && (
                        <motion.div 
                            key={selectedNote.id || 'new-note'}
                            ref={editorContainerRef}
                            initial={{ opacity: 0, scale: 0.05, borderRadius: '2rem' }}
                            animate={{ opacity: 1, scale: 1, borderRadius: '0rem' }}
                            exit={{ opacity: 0, scale: 0.05, borderRadius: '2rem' }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-0 z-[25] bg-white dark:bg-black flex flex-col overflow-hidden"
                            style={{ 
                                height: '100%',
                                transformOrigin: transformOrigin,
                                paddingBottom: 'var(--dev-console-padding, 0px)'
                            }}
                        >
                    {/* Editor Content Area */}
                    <div className={`flex-1 overflow-y-auto ${getEditorBgClass()} dark:bg-transparent transition-colors pt-16 md:pt-14`}>
                        {/* Under editing mode (toolbar open), the padding-bottom remains pb-2. */}
                        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-3 md:py-4 pb-2 flex flex-col">
                            {/* Title */}
                            <input 
                                type="text" 
                                placeholder="Title" 
                                value={selectedNote.title || ''}
                                onChange={e => setSelectedNote(prev => ({ ...prev!, title: e.target.value }))}
                                onFocus={() => setIsEditorFocused(true)}
                                disabled={isReadOnly}
                                className="text-3xl md:text-4xl font-bold bg-transparent border-none focus:outline-none text-neutral-900 dark:text-white w-full placeholder-neutral-400/50 mb-3 mt-1 disabled:cursor-default"
                            />
                            
                            <style>
                                {`
                                    .editor-content { min-height: 100px; outline: none; }
                                    .editor-content:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; display: block; }
                                    .editor-content p { margin-bottom: 0.5em; line-height: 1.6; }
                                    .editor-content h1 { font-size: 1.5em; font-weight: bold; margin-top: 1em; margin-bottom: 0.5em; }
                                    .editor-content h2 { font-size: 1.25em; font-weight: bold; margin-top: 1em; margin-bottom: 0.5em; }
                                    .editor-content h3 { font-size: 1.1em; font-weight: bold; margin-top: 0.8em; margin-bottom: 0.4em; }
                                    .editor-content ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 0.5em; }
                                    .editor-content ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 0.5em; }
                                    .editor-content li { margin-bottom: 0.25em; }
                                    .editor-content blockquote { border-left: 3px solid #ccc; padding-left: 1em; font-style: italic; color: #666; margin-top: 0.2em; margin-bottom: 0.2em; }
                                    .dark .editor-content blockquote { border-left-color: #555; color: #aaa; }
                                    .editor-content pre { background: #f4f4f4; padding: 0.75em; border-radius: 6px; font-family: monospace; font-size: 0.9em; margin-bottom: 0.5em; overflow-x: auto; }
                                    .dark .editor-content pre { background: #1e1e1e; border: 1px solid #333; }
                                    .editor-content code { background: #f4f4f4; padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; font-size: 0.9em; color: #d63384; }
                                    .dark .editor-content code { background: #333; color: #e0e0e0; }
                                    .editor-content a { color: #3b82f6; text-decoration: underline; cursor: pointer; }
                                    .dark .editor-content a { color: #60a5fa; }
                                    .editor-content hr { border: 0; border-top: 0.5px solid rgba(156, 163, 175, 0.3); margin: 0.75em 0; }
                                    .dark .editor-content hr { border-top-color: rgba(255, 255, 255, 0.12); }
                                    
                                    /* Table Styles */
                                    .editor-content table { width: 100%; border-collapse: collapse; margin-bottom: 1em; table-layout: fixed; content-visibility: auto; contain-intrinsic-size: 1000px; }
                                    .editor-content th, .editor-content td { border: 1px solid #ddd; padding: 8px; text-align: left; overflow: hidden; text-overflow: ellipsis; word-wrap: break-word; }
                                    .dark .editor-content th, .dark .editor-content td { border-color: #444; }
                                    .editor-content th { background-color: #f8f9fa; font-weight: bold; }
                                    .dark .editor-content th { background-color: #1f2937; }
                                `}
                            </style>
                            {isNoteLoading && (
                                <div className="space-y-4 py-4 animate-pulse w-full">
                                    <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-3/4 mb-2"></div>
                                    <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-full mb-2"></div>
                                    <div className="h-4 bg-black/10 dark:bg-white/10 rounded w-5/6 mb-6"></div>
                                    
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                         <div className="h-24 bg-emerald-500/10 rounded-2xl w-full"></div>
                                         <div className="h-24 bg-rose-500/10 rounded-2xl w-full"></div>
                                    </div>
                                    
                                    <div className="h-32 bg-black/5 dark:bg-white/5 rounded-2xl w-full"></div>
                                </div>
                            )}
                            <div 
                                ref={editorRef}
                                contentEditable={!isReadOnly}
                                suppressContentEditableWarning
                                data-placeholder="Start typing..." 
                                className={`flex-1 w-full bg-transparent border-none focus:outline-none text-lg text-neutral-800 dark:text-gray-200 pb-0 editor-content ${isNoteLoading ? 'hidden' : ''}`}
                                onKeyUp={checkFormats}
                                onMouseUp={checkFormats}
                                onClick={handleEditorClick}
                                onFocus={() => setIsEditorFocused(true)}
                            />
                        </div>
                    </div>

                    {/* Editor Toolbar - Hide when Read Only */}
                    <EditorToolbar
                        isReadOnly={isReadOnly}
                        showColorPicker={showColorPicker}
                        setShowColorPicker={setShowColorPicker}
                        colorOptions={colorOptions}
                        selectedNote={selectedNote}
                        setSelectedNote={setSelectedNote}
                        notes={notes}
                        handleSaveNote={handleSaveNote}
                        getEditorContent={getEditorContent}
                        setShareModalNote={setShareModalNote}
                        handleFormat={handleFormat}
                        activeFormats={activeFormats}
                        getButtonStyle={getButtonStyle}
                        handleInsertTable={handleInsertTable}
                    />

                    {/* Search Navigation Overlay */}
                    {searchQuery && searchMatches.length > 0 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-white dark:bg-zinc-900 shadow-xl border border-gray-200 dark:border-zinc-800 rounded-full px-4 py-2 flex items-center gap-3 animate-fade-in-up">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {currentMatchIndex + 1} of {searchMatches.length}
                            </span>
                            <div className="w-px h-4 bg-gray-200 dark:bg-zinc-700" />
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={handlePrevMatch}
                                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 transition-colors"
                                    title="Previous Match"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={handleNextMatch}
                                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 transition-colors rotate-180"
                                    title="Next Match"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>,
        portalTarget
    )}

            <ConfirmationModal
                isOpen={!!noteToDelete}
                onClose={() => {
                    setIsNoteDeleting(false);
                    setNoteToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Delete Note"
                message="Are you sure you want to permanently delete this note? This action cannot be undone."
                confirmButtonText="Delete"
                confirmButtonVariant="danger"
                isLoading={isNoteDeleting}
            />

            <ShareNoteModal
                isOpen={!!shareModalNote}
                onClose={() => setShareModalNote(null)}
                note={shareModalNote}
            />
        </main>
    );
};

export default NotesView;
