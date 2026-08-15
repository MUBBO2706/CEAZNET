import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

export interface ConfirmationModalProps {
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
    activeTheme?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmButtonText = 'Confirm',
    confirmButtonVariant = 'danger',
    showCancel = true,
    isLoading = false,
    onCancel,
    confirmLabel,
    cancelLabel,
    critical = false,
    activeTheme = 'oled',
}) => {
    const [mounted, setMounted] = useState(false);
    const [isLightMode, setIsLightMode] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        if (typeof document !== 'undefined') {
            const checkTheme = () => {
                const hasDark = document.documentElement.classList.contains('dark');
                const isLight = document.documentElement.classList.contains('light') || 
                                document.documentElement.classList.contains('theme-light') ||
                                (activeTheme && activeTheme.startsWith('light-')) ||
                                !hasDark;
                setIsLightMode(isLight);
            };
            checkTheme();
            const observer = new MutationObserver(checkTheme);
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            return () => observer.disconnect();
        }
    }, [isOpen, activeTheme]);

    if (!mounted) return null;

    const isCritical = critical || confirmButtonVariant === 'danger';
    const finalConfirmLabel = confirmLabel || confirmButtonText;
    const finalCancelLabel = cancelLabel || 'Cancel';
    const handleClose = onCancel || onClose;

    const getConfirmBtnStyle = () => {
        if (isCritical) {
            return 'bg-red-600 hover:bg-red-500 focus:ring-red-500/25';
        }
        switch (activeTheme) {
            case 'cosmic':
                return 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500/25';
            case 'asgardian':
                return 'bg-amber-600 hover:bg-amber-500 focus:ring-amber-500/25';
            case 'wakanda':
                return 'bg-purple-600 hover:bg-purple-500 focus:ring-purple-500/25';
            case 'stark':
                return 'bg-sky-600 hover:bg-sky-500 focus:ring-sky-500/25';
            case 'hydra':
                return 'bg-red-600 hover:bg-red-500 focus:ring-red-500/25';
            default:
                return 'bg-red-600 hover:bg-red-500 focus:ring-red-500/25';
        }
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div
                    className={`fixed inset-0 ${isLightMode ? 'bg-slate-900/20 backdrop-blur-md' : 'bg-black/80 backdrop-blur-sm'} z-[99999] flex items-center justify-center p-4 pointer-events-auto`}
                    id="shared-confirmation-modal-backdrop"
                >
                    {/* Backdrop click handler */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0"
                        onClick={isLoading ? undefined : handleClose}
                    />

                    {/* Content Card */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={`${
                            isLightMode
                                ? 'bg-white border border-slate-900/20 text-slate-900 shadow-2xl'
                                : 'bg-black border border-white/15 text-white shadow-2xl'
                        } max-w-md w-full rounded-2xl p-6 shadow-2xl text-left max-h-[calc(100vh-2rem)] overflow-y-auto scrollable-modal-content relative z-10`}
                        id="shared-confirmation-modal-content"
                        role="dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={`font-sans font-bold text-base sm:text-lg ${isLightMode ? 'text-slate-900' : 'text-white'} mb-2`}>
                            {title}
                        </h3>
                        <p className={`text-xs ${isLightMode ? 'text-slate-600' : 'text-neutral-400'} mb-6 font-sans leading-relaxed`}>
                            {message}
                        </p>
                        
                        <div className="flex items-center justify-end gap-2.5 font-sans text-[11px]">
                            {showCancel && handleClose && (
                                <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={handleClose}
                                    className={`px-3.5 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 focus:outline-none ${
                                        isLightMode
                                            ? 'border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                                            : 'border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 hover:bg-neutral-900/40'
                                    }`}
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
                                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
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


