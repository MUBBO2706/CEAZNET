
import React from 'react';
import { Trash2, X } from 'lucide-react';

interface SelectionToolbarProps {
    selectedCount: number;
    onDelete: () => void;
    onCancel: () => void;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ selectedCount, onDelete, onCancel }) => {
    return (
        <div className="flex items-center justify-between w-full p-4 bg-white dark:bg-[#1e1f22] border border-neutral-200 dark:border-gray-800 rounded-[2rem] shadow-xl animate-fade-in-up">
            <div className="flex items-center gap-4 pl-2">
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-gray-800 transition-colors">
                    <X className="w-5 h-5 text-neutral-600 dark:text-gray-300" />
                </button>
                <span className="font-semibold text-neutral-900 dark:text-white">
                    {selectedCount} Selected
                </span>
            </div>
            <button 
                onClick={onDelete} 
                disabled={selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
            </button>
        </div>
    );
};

export default SelectionToolbar;
