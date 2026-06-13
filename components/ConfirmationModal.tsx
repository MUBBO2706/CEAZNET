import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmButtonText?: string;
    confirmButtonVariant?: 'primary' | 'danger';
    showCancel?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmButtonText = 'Confirm',
    confirmButtonVariant = 'primary',
    showCancel = true,
}) => {
    if (!isOpen) return null;

    const confirmButtonClasses = {
        primary: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
        danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" onClick={onClose}>
            <div className="bg-white dark:bg-[#1e1f22] rounded-2xl shadow-xl w-full max-w-sm transform transition-all animate-fade-in-up" role="dialog" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${confirmButtonVariant === 'danger' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'} sm:mx-0`}>
                            <AlertTriangle className={`h-6 w-6 ${confirmButtonVariant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} aria-hidden="true" />
                        </div>
                        <div className="mt-0 text-left">
                            <h3 className="text-lg leading-6 font-semibold text-neutral-900 dark:text-white" id="modal-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-neutral-500 dark:text-gray-400">
                                    {message}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="px-6 py-4 bg-neutral-50 dark:bg-gray-900/50 rounded-b-2xl flex flex-row gap-3 justify-end">
                    {showCancel && (
                        <button
                            type="button"
                            className="flex-1 sm:flex-initial sm:w-auto inline-flex justify-center rounded-md border border-neutral-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-neutral-700 dark:text-gray-200 hover:bg-neutral-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-50 dark:focus:ring-offset-[#1e1f22] focus:ring-amber-500"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        className={`flex-1 sm:flex-initial sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-50 dark:focus:ring-offset-[#1e1f22] ${confirmButtonClasses[confirmButtonVariant]}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
