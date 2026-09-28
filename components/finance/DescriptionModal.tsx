
import React from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '../core/AppIcon';

interface DescriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    description: string;
}

const DescriptionModal: React.FC<DescriptionModalProps> = ({ isOpen, onClose, description }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* Backdrop with blur matching app modals */}
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity duration-300" 
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }} 
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-lg z-10" onClick={(e) => e.stopPropagation()}>
                {/* Circular close button outside container corner */}
                <button 
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }} 
                    className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 p-2 bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-full shadow-2xl border border-gray-200/80 dark:border-white/10 z-20 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                    aria-label="Close modal"
                >
                    <AppIcon name="solar:close-circle-linear" className="w-5 h-5" />
                </button>

                <div className="relative bg-white/95 dark:bg-black/95 backdrop-blur-2xl rounded-[1.8rem] shadow-2xl border border-gray-200/60 dark:border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
                    {/* Content only - no heading or separator line */}
                    <div className="p-6 overflow-y-auto select-text">
                        <p className="text-base font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                            {description || "No description provided."}
                        </p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DescriptionModal;
