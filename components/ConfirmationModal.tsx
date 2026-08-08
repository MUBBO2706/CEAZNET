import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose?: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    message: string;
    confirmButtonText?: string;
    confirmButtonVariant?: 'primary' | 'danger';
    showCancel?: boolean;
    isLoading?: boolean;
    // MCU-TRAKER compatibility fields
    onCancel?: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    critical?: boolean;
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
    isLoading = false,
    onCancel,
    confirmLabel,
    cancelLabel,
    critical = false,
}) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const isCritical = critical || confirmButtonVariant === 'danger';
    const finalConfirmLabel = confirmLabel || confirmButtonText;
    const finalCancelLabel = cancelLabel || 'Cancel';
    const handleClose = onCancel || onClose;

    const getConfirmBtnStyle = () => {
        if (isCritical) {
            return 'bg-red-600 hover:bg-red-500 focus:ring-red-500/25';
        }
        return 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-500/25';
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-auto" id="shared-confirmation-modal-backdrop">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-slate-900/20 dark:bg-black/80 backdrop-blur-md dark:backdrop-blur-sm"
                        onClick={isLoading ? undefined : handleClose}
                    />

                    {/* Content Card */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-900 dark:text-white max-w-sm w-full rounded-2xl p-6 shadow-2xl text-left max-h-[calc(100vh-2rem)] overflow-y-auto relative z-10"
                        role="dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="font-sans font-bold text-base sm:text-lg text-slate-900 dark:text-white mb-2">
                            {title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-neutral-400 mb-6 font-sans leading-relaxed">
                            {message}
                        </p>
                        
                        <div className="flex items-center justify-end gap-2.5 font-sans text-xs">
                            {showCancel && handleClose && (
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={handleClose}
                                    className="px-3.5 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 focus:outline-none border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-white hover:border-slate-300 dark:hover:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-900/40"
                                >
                                    {finalCancelLabel}
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => {
                                    if (isLoading) return;
                                    onConfirm();
                                }}
                                className={`${getConfirmBtnStyle()} text-white font-semibold px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 focus:outline-none`}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <span>{finalConfirmLabel}</span>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};

export default ConfirmationModal;

