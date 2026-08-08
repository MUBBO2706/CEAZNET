
import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlignLeft } from 'lucide-react';

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
            <div className="relative w-full max-w-lg transform transition-all animate-fade-in-up">
                <div className="relative bg-white/90 dark:bg-[#161618]/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col max-h-[80vh]">
                    
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-white/5 backdrop-blur-md flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 shadow-sm">
                                <AlignLeft className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Full Description</h2>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-2 rounded-full hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto scrollbar-hide">
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
