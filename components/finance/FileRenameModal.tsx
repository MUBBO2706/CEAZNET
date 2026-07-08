
import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Download } from 'lucide-react';

interface FileRenameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (filename: string) => void;
    defaultFilename: string;
    fileExtension: string;
}

const FileRenameModal: React.FC<FileRenameModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    defaultFilename,
    fileExtension 
}) => {
    const [filename, setFilename] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Strip extension for editing if present (just in case)
            const name = defaultFilename.replace(`.${fileExtension}`, '');
            setFilename(name);
            // Focus after animation
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen, defaultFilename, fileExtension]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (filename.trim()) {
            onConfirm(`${filename.trim()}.${fileExtension}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity duration-300" 
                onClick={onClose} 
            />
            
            <div className="relative w-full max-w-sm transform transition-all animate-fade-in-up">
                <div className="relative bg-white/90 dark:bg-[#161618]/95 backdrop-blur-2xl rounded-[1.5rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden">
                    
                    <div className="px-6 py-5 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 shadow-sm">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Name Your File</h2>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                                Filename
                            </label>
                            <div className="relative flex items-center">
                                <input 
                                    ref={inputRef}
                                    type="text"
                                    value={filename}
                                    onChange={(e) => setFilename(e.target.value)}
                                    className="w-full pl-4 pr-16 py-3 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium text-gray-900 dark:text-white transition-all"
                                    placeholder="Enter filename"
                                />
                                <span className="absolute right-4 text-gray-400 dark:text-gray-500 text-sm font-mono select-none pointer-events-none">
                                    .{fileExtension}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button 
                                type="button" 
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                Download
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FileRenameModal;
