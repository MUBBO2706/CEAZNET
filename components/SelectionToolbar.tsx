
import React from 'react';
import { Trash2, X } from 'lucide-react';

interface SelectionToolbarProps {
    selectedCount: number;
    onDelete: () => void;
    onCancel: () => void;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ selectedCount, onDelete, onCancel }) => {
    return (
        <div 
            className="flex items-center gap-2 p-2 sm:p-2.5 bg-white/95 dark:bg-black/95 backdrop-blur-md border border-neutral-200 dark:border-gray-800 rounded-2xl"
            style={{ borderRadius: 'var(--app-border-radius, 1rem)' }}
        >
            <div className="flex items-center gap-2 pl-1 pr-1.5">
                <button 
                    onClick={onCancel} 
                    className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-gray-800 text-neutral-500 dark:text-gray-400 transition-colors"
                    title="Cancel selection"
                >
                    <X className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                    {selectedCount} Selected
                </span>
            </div>
            <button 
                onClick={onDelete} 
                disabled={selectedCount === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: 'calc(var(--app-border-radius, 1rem) * 0.75)' }}
            >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
            </button>
        </div>
    );
};

export default SelectionToolbar;
