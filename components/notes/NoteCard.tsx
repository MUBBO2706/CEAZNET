
import React, { useMemo } from 'react';
import { Note } from '../../types';
import { Pin, Trash2, Tag, Clock } from 'lucide-react';

interface NoteCardProps {
    note: Note;
    onClick: (note: Note, e: React.MouseEvent) => void;
    onDelete: (id: string) => void;
    onPin: (note: Note, isPinned: boolean) => void;
}

// Modern pastel palette that works in both light and dark modes
const colorVariants: Record<string, string> = {
    default: 'bg-white dark:bg-[#1e1f22] border-neutral-200 dark:border-gray-800 text-neutral-800 dark:text-neutral-200',
    red: 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/50 text-red-900 dark:text-red-100',
    orange: 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-900/50 text-orange-900 dark:text-orange-100',
    amber: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50 text-amber-900 dark:text-amber-100',
    green: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100',
    blue: 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50 text-blue-900 dark:text-blue-100',
    purple: 'bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/50 text-purple-900 dark:text-purple-100',
    pink: 'bg-pink-50 dark:bg-pink-950/40 border-pink-100 dark:border-pink-900/50 text-pink-900 dark:text-pink-100',
};

const getPreviewContent = (content: string) => {
    if (!content) return '';
    let text = content;
    // 0. Remove "Last Synced: ..."
    text = text.replace(/Last Synced:.*?(?=\n|<br>|$)/gi, '');
    // 1. Remove Finance Widgets entirely
    text = text.replace(/<!-- FINANCE_WIDGET_START -->[\s\S]*?<!-- FINANCE_WIDGET_END -->/g, '');
    // 2. Remove any other HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    // 3. Strip HTML tags
    text = text.replace(/<[^>]*>?/gm, '');
    // 4. Replace common HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    
    // 5. Strip basic markdown syntax for cleaner plain text preview
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
    
    // 6. Clean up multiple newlines and extra spaces
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/ {2,}/g, ' ');
    return text.trim();
};

const NoteCard: React.FC<NoteCardProps> = React.memo(({ note, onClick, onDelete, onPin }) => {
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
                relative group rounded-3xl p-3.5 md:p-3 border shadow-sm 
                hover:brightness-95 dark:hover:brightness-110 
                transition-all duration-200 flex flex-col gap-0.5 cursor-pointer
                h-[18vh] w-full min-h-[140px] md:min-h-[120px] md:h-32
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
    );
});

export default NoteCard;
