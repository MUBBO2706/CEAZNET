
import React, { useMemo } from 'react';
import { Note } from '../../types';
import { Pin, Trash2, Tag, Clock, Share2 } from 'lucide-react';

interface NoteCardProps {
    note: Note;
    onClick: (note: Note, e: React.MouseEvent) => void;
    onDelete: (id: string) => void;
    onPin: (note: Note, isPinned: boolean) => void;
    onShare?: (note: Note, e: React.MouseEvent) => void;
}

// Modern light pastel palette that works in both light and dark modes
const colorVariants: Record<string, string> = {
    default: 'bg-white dark:bg-[#1e1f22] border-neutral-200/70 dark:border-gray-800/80 text-neutral-800 dark:text-neutral-200',
    red: 'bg-red-50/50 dark:bg-red-950/15 border-red-100 dark:border-red-900/30 text-red-950 dark:text-red-200',
    orange: 'bg-orange-50/50 dark:bg-orange-950/15 border-orange-100 dark:border-orange-900/30 text-orange-950 dark:text-orange-200',
    amber: 'bg-amber-50/50 dark:bg-amber-950/15 border-amber-100 dark:border-amber-900/30 text-amber-950 dark:text-amber-200',
    yellow: 'bg-yellow-50/50 dark:bg-yellow-950/15 border-yellow-100 dark:border-yellow-900/30 text-yellow-950 dark:text-yellow-200',
    green: 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 text-emerald-950 dark:text-emerald-200',
    emerald: 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30 text-emerald-950 dark:text-emerald-200',
    teal: 'bg-teal-50/50 dark:bg-teal-950/15 border-teal-100 dark:border-teal-900/30 text-teal-950 dark:text-teal-200',
    cyan: 'bg-cyan-50/50 dark:bg-cyan-950/15 border-cyan-100 dark:border-cyan-900/30 text-cyan-950 dark:text-cyan-200',
    sky: 'bg-sky-50/50 dark:bg-sky-950/15 border-sky-100 dark:border-sky-900/30 text-sky-950 dark:text-sky-200',
    blue: 'bg-blue-50/50 dark:bg-blue-950/15 border-blue-100 dark:border-blue-900/30 text-blue-950 dark:text-blue-200',
    indigo: 'bg-indigo-50/50 dark:bg-indigo-950/15 border-indigo-100 dark:border-indigo-900/30 text-indigo-950 dark:text-indigo-200',
    purple: 'bg-purple-50/50 dark:bg-purple-950/15 border-purple-100 dark:border-purple-900/30 text-purple-950 dark:text-purple-200',
    violet: 'bg-violet-50/50 dark:bg-violet-950/15 border-violet-100 dark:border-violet-900/30 text-violet-950 dark:text-violet-200',
    pink: 'bg-pink-50/50 dark:bg-pink-950/15 border-pink-100 dark:border-pink-900/30 text-pink-950 dark:text-pink-200',
    rose: 'bg-rose-50/50 dark:bg-rose-950/15 border-rose-100 dark:border-rose-900/30 text-rose-950 dark:text-rose-200',
};

const getPreviewContent = (content: string) => {
    if (!content) return '';
    let text = content;
    const isFinanceSync = content.includes('FINANCE_WIDGET') || content.includes('daily_stats') || content.includes('daily_verdict') || content.includes('Wallet Report') || content.includes('Daily Total');

    // 0. Remove Report Header, Footer, and redundant widget headings
    text = text.replace(/<!-- REPORT_HEADER_START -->[\s\S]*?<!-- REPORT_HEADER_END -->/g, '');
    text = text.replace(/<!-- REPORT_FOOTER_START -->[\s\S]*?<!-- REPORT_FOOTER_END -->/g, '');
    text = text.replace(/^.*?\b(Wallet Report|Report|Expense Breakdown|Daily Verdict)\b.*$/gm, '');
    // 1. Remove "Last Synced: ..."
    text = text.replace(/Last Synced:.*?(?=\n|<br>|$)/gi, '');
    // 2. Remove Finance Widgets entirely
    text = text.replace(/<!-- FINANCE_WIDGET_START -->[\s\S]*?<!-- FINANCE_WIDGET_END -->/g, '');
    // 3. Remove any other HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    // 4. Strip HTML tags
    text = text.replace(/<[^>]*>?/gm, ' ');
    // 5. Replace common HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    
    // 6. Strip basic markdown syntax for cleaner plain text preview
    text = text.replace(/^(?:[-*_]\s*){3,}$/gm, ''); // Horizontal rules
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Bold
    text = text.replace(/(\*|_)(.*?)\1/g, '$2'); // Italic
    text = text.replace(/~~(.*?)~~/g, '$1'); // Strikethrough
    text = text.replace(/`{1,3}(.*?)`{1,3}/g, '$1'); // Code
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
    text = text.replace(/^[#]+\s+(.*)$/gm, '$1'); // Headers
    text = text.replace(/^>+\s+(.*)$/gm, '$1'); // Blockquotes
    text = text.replace(/^[-*+]\s+(.*)$/gm, '• $1'); // Unordered lists
    text = text.replace(/^\d+\.\s+(.*)$/gm, '$1'); // Ordered lists
    
    // 7. Clean up multiple newlines and extra spaces
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/ {2,}/g, ' ').trim();

    // Smart fallback for synced finance notes if cleaned text is empty
    if (!text && isFinanceSync) {
        const textOnly = content.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        if (textOnly && textOnly.length > 5) {
            return textOnly;
        }
        return 'Synced Wallet Report • Daily Transactions & Summary';
    }

    return text;
};

const NoteCard: React.FC<NoteCardProps> = React.memo(({ note, onClick, onDelete, onPin, onShare }) => {
    const themeClass = colorVariants[note.colorTheme || 'default'];

    const formattedDate = useMemo(() => {
        return new Date(note.updatedAt).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric'
        });
    }, [note.updatedAt]);

    const previewContent = useMemo(() => {
        return note.content ? getPreviewContent(note.content) : '';
    }, [note.content]);

    return (
        <div 
            id={`note-${note.id}`}
            onClick={(e) => onClick(note, e)}
            className={`
                relative group rounded-2xl p-3 md:p-2.5 border shadow-none 
                hover:brightness-95 dark:hover:brightness-110 
                transition-all duration-200 flex flex-col gap-0.5 cursor-pointer
                h-[18vh] w-full min-h-[130px] md:min-h-[115px] md:h-30
                ${themeClass}
            `}
        >
            {/* Header */}
            <div className="flex justify-between items-start gap-2 flex-shrink-0">
                {note.title ? (
                    <h3 className="font-bold text-base leading-tight line-clamp-1 w-full -mt-0.5">
                        {note.title}
                    </h3>
                ) : (
                    <span className="text-sm font-medium opacity-50 italic">Untitled</span>
                )}
                
                <button 
                    onClick={(e) => { e.stopPropagation(); onPin(note, !note.isPinned); }}
                    className={`
                        p-1 -mt-1 -mr-1 rounded-full transition-all duration-200 flex-shrink-0
                        ${note.isPinned 
                            ? 'opacity-100 bg-black/5 dark:bg-white/10' 
                            : 'opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'
                        }
                    `}
                    title={note.isPinned ? "Unpin" : "Pin"}
                >
                    <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
                </button>
            </div>

            {/* Content Preview - Tighter constraints, plain text for performance */}
            <div className="flex-1 min-h-0 overflow-hidden mt-0.5 relative">
                <div className="text-xs opacity-80 leading-relaxed line-clamp-4 break-words whitespace-pre-wrap">
                    {previewContent}
                </div>
            </div>

            {/* Footer Area: Tags & Date */}
            <div className="pt-1 mt-auto flex flex-col gap-2 flex-shrink-0 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide">
                        <Clock className="w-3 h-3" />
                        {formattedDate}
                    </div>
                    
                    <div className="flex items-center gap-1">
                        {onShare && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onShare(note, e); }}
                                className="p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 transition-colors"
                                title="Share Note"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                            className="p-1 -mr-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default NoteCard;
