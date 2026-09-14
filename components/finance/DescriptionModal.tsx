
import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DescriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    description: string;
}

const DescriptionModal: React.FC<DescriptionModalProps> = ({ isOpen, onClose, description }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            {/* Backdrop with blur matching other modals */}
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity duration-300" 
                onClick={onClose} 
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-lg">
                {/* Circular close button outside container corner */}
                <button 
                    onClick={onClose} 
                    className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 p-2 bg-white dark:bg-zinc-900 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-full shadow-xl border border-gray-200/80 dark:border-white/10 z-10 transition-transform hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="relative bg-white/90 dark:bg-black/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col max-h-[80vh]">
                    {/* Content only - no heading or separator */}
                    <div className="p-6 overflow-y-auto">
                        <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {description}
                        </p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DescriptionModal;
