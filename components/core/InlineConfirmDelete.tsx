import React, { useState } from 'react';
import { Trash2, Loader } from 'lucide-react';

interface InlineConfirmDeleteProps {
    onDelete: () => Promise<void> | void;
    iconOnly?: boolean;
    text?: React.ReactNode;
    className?: string;
    iconClassName?: string;
    onConfirmStateChange?: (isConfirming: boolean) => void;
}

export const InlineConfirmDelete: React.FC<InlineConfirmDeleteProps> = ({
    onDelete,
    iconOnly = false,
    text = "Delete",
    className = "",
    iconClassName = "w-4 h-4",
    onConfirmStateChange
}) => {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const setConfirmingState = (val: boolean) => {
        setIsConfirming(val);
        onConfirmStateChange?.(val);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDeleting) return;
        
        setIsDeleting(true);
        try {
            await onDelete();
        } catch (error) {
            console.error("Delete failed:", error);
        } finally {
            setIsDeleting(false);
            setConfirmingState(false);
        }
    };

    if (isConfirming) {
        return (
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    disabled={isDeleting}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!isDeleting) setConfirmingState(false);
                    }}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg text-white transition-all shrink-0 flex items-center justify-center gap-1 ${
                        isDeleting
                            ? 'bg-red-800/80 cursor-not-allowed opacity-75'
                            : 'bg-red-600 hover:bg-red-700 cursor-pointer shadow-sm'
                    }`}
                >
                    {isDeleting ? (
                        <>
                            <Loader size={12} className="animate-spin shrink-0" />
                            <span>Deleting...</span>
                        </>
                    ) : (
                        <span>Delete</span>
                    )}
                </button>
            </div>
        );
    }

    const defaultIconStyles = iconOnly 
        ? `text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors ${className}`
        : `flex items-center gap-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors p-1 ${className}`;

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                setConfirmingState(true);
            }}
            className={defaultIconStyles}
            title={typeof text === 'string' ? text : undefined}
        >
            <Trash2 className={iconClassName} />
            {!iconOnly && <span>{text}</span>}
        </button>
    );
};
