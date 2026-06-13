
import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { getNotes } from '../services/dbService';
import { X, Search, StickyNote, LoaderCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const getPreviewContent = (content: string) => {
    if (!content) return '';
    let text = content;
    // 1. Remove Finance Widgets entirely
    text = text.replace(/<!-- FINANCE_WIDGET_START -->[\s\S]*?<!-- FINANCE_WIDGET_END -->/g, '');
    // 2. Remove any other HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    // 3. Strip remaining HTML tags
    text = text.replace(/<[^>]*>?/gm, '');
    // 4. Clean up multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
};

interface NotePickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectNote: (note: Note) => void;
    user: User | null;
}

const NotePickerModal: React.FC<NotePickerModalProps> = ({ isOpen, onClose, onSelectNote, user }) => {
    const [notes, setNotes] = useState<Note[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
            loadNotes();
        }
    }, [isOpen, user]);

    const loadNotes = async () => {
        setIsLoading(true);
        try {
            const fetchedNotes = await getNotes(user);
            // Sort by updated recently
            fetchedNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            setNotes(fetchedNotes);
        } catch (e) {
            console.error("Failed to load notes", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(onClose, 300);
    };

    const handleSelect = (note: Note) => {
        onSelectNote(note);
        handleClose();
    };

    const filteredNotes = notes.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen && !isAnimating) return null;

    return (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
                onClick={handleClose}
            />

            <div 
                className={`relative w-full max-w-md bg-white dark:bg-[#1e1f22] rounded-2xl shadow-2xl border border-neutral-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh] transform transition-all duration-300 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-neutral-200 dark:border-gray-700 flex items-center justify-between bg-neutral-50/50 dark:bg-black/20">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <StickyNote className="w-5 h-5 text-amber-500" />
                        Attach Note
                    </h3>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-neutral-200 dark:hover:bg-gray-700 transition-colors">
                        <X className="w-5 h-5 text-neutral-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 pb-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input 
                            type="text" 
                            placeholder="Search notes..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-neutral-100 dark:bg-black/30 border border-neutral-200 dark:border-gray-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 pt-2 space-y-2 scrollbar-hide">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <LoaderCircle className="w-8 h-8 animate-spin text-amber-500" />
                        </div>
                    ) : filteredNotes.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500 dark:text-gray-400">
                            <p>No notes found.</p>
                        </div>
                    ) : (
                        filteredNotes.map(note => (
                            <button
                                key={note.id}
                                onClick={() => handleSelect(note)}
                                className="w-full text-left p-3 rounded-xl border border-neutral-200 dark:border-gray-800 hover:border-amber-500 dark:hover:border-amber-500 bg-white dark:bg-[#25262b] hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group"
                            >
                                <h4 className="font-semibold text-neutral-900 dark:text-white truncate">
                                    {note.title || "Untitled Note"}
                                </h4>
                                <div className="text-xs text-neutral-500 dark:text-gray-400 mt-1 line-clamp-2 prose prose-sm prose-neutral dark:prose-invert max-w-none [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0 [&_li]:my-0 [&_h1]:my-0 [&_h2]:my-0 [&_h3]:my-0 [&_h4]:my-0 [&_h5]:my-0 [&_h6]:my-0 [&_blockquote]:my-0 [&_pre]:my-0 [&_figure]:my-0 [&_hr]:my-0 [&_table]:my-0 [&_thead]:my-0 [&_tbody]:my-0 [&_tr]:my-0 [&_th]:my-0 [&_td]:my-0 [&_img]:hidden [&_video]:hidden [&_iframe]:hidden">
                                    {note.content ? (
                                        <Markdown 
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                p: ({node, ...props}) => <span className="inline" {...props} />,
                                                h1: ({node, ...props}) => <span className="font-bold inline mr-1" {...props} />,
                                                h2: ({node, ...props}) => <span className="font-bold inline mr-1" {...props} />,
                                                h3: ({node, ...props}) => <span className="font-bold inline mr-1" {...props} />,
                                                h4: ({node, ...props}) => <span className="font-bold inline mr-1" {...props} />,
                                                h5: ({node, ...props}) => <span className="font-bold inline mr-1" {...props} />,
                                                h6: ({node, ...props}) => <span className="font-bold inline mr-1" {...props} />,
                                                ul: ({node, ...props}) => <span className="inline" {...props} />,
                                                ol: ({node, ...props}) => <span className="inline" {...props} />,
                                                li: ({node, ...props}) => <span className="inline mr-1 before:content-['•_']" {...props} />,
                                                blockquote: ({node, ...props}) => <span className="italic opacity-80 inline mr-1" {...props} />,
                                                pre: ({node, ...props}) => <span className="font-mono bg-black/5 dark:bg-white/5 px-1 rounded inline mr-1" {...props} />,
                                                code: ({node, ...props}) => <span className="font-mono bg-black/5 dark:bg-white/5 px-1 rounded inline" {...props} />,
                                                a: ({node, ...props}) => <span className="text-blue-500 hover:underline inline" {...props} />,
                                                table: ({node, ...props}) => <span className="inline-flex gap-2 items-center text-[10px] border border-black/10 dark:border-white/10 rounded px-1" {...props} />,
                                                thead: ({node, ...props}) => <span className="font-bold inline" {...props} />,
                                                tbody: ({node, ...props}) => <span className="inline" {...props} />,
                                                tr: ({node, ...props}) => <span className="inline mr-2" {...props} />,
                                                th: ({node, ...props}) => <span className="inline mr-1" {...props} />,
                                                td: ({node, ...props}) => <span className="inline mr-1" {...props} />,
                                            }}
                                        >
                                            {getPreviewContent(note.content)}
                                        </Markdown>
                                    ) : (
                                        "No content"
                                    )}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[10px] bg-neutral-100 dark:bg-gray-700 text-neutral-500 dark:text-gray-300 px-1.5 py-0.5 rounded">
                                        {new Date(note.updatedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotePickerModal;
