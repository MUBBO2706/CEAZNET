
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { AppIcon } from './core/AppIcon';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    action?: ToastAction;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType, action?: ToastAction) => void;
    removeToast: (id: string) => void;
    toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
    useEffect(() => {
        // Auto dismiss
        const removeTimer = setTimeout(() => {
            onRemove(toast.id);
        }, 4000); 

        return () => {
            clearTimeout(removeTimer);
        };
    }, [toast.id, onRemove]);

    // Auto-scale font size based on length to fit single line
    const textSizeClass = useMemo(() => {
        const len = toast.message.length;
        if (len > 50) return 'text-[10px]';
        if (len > 30) return 'text-xs';
        return 'text-sm';
    }, [toast.message]);

    // Premium styling configuration
    const config = {
        success: {
            icon: <AppIcon name="solar:check-circle-linear" className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
            border: 'border-emerald-500/25 dark:border-emerald-500/35',
            glow: 'shadow-[0_4px_20px_-4px_rgba(16,185,129,0.25)] dark:shadow-[0_4px_24px_-4px_rgba(16,185,129,0.3)]',
            text: 'text-neutral-800 dark:text-emerald-100'
        },
        error: {
            icon: <AppIcon name="solar:danger-circle-linear" className="w-5 h-5 text-rose-500 dark:text-rose-400" />,
            border: 'border-rose-500/25 dark:border-rose-500/35',
            glow: 'shadow-[0_4px_20px_-4px_rgba(244,63,94,0.25)] dark:shadow-[0_4px_24px_-4px_rgba(244,63,94,0.3)]',
            text: 'text-neutral-800 dark:text-rose-100'
        },
        info: {
            icon: <AppIcon name="solar:info-circle-linear" className="w-5 h-5 text-blue-500 dark:text-blue-400" />,
            border: 'border-blue-500/25 dark:border-blue-500/35',
            glow: 'shadow-[0_4px_20px_-4px_rgba(59,130,246,0.25)] dark:shadow-[0_4px_24px_-4px_rgba(59,130,246,0.3)]',
            text: 'text-neutral-800 dark:text-blue-100'
        },
        warning: {
            icon: <AppIcon name="solar:danger-triangle-linear" className="w-5 h-5 text-amber-500 dark:text-amber-400" />,
            border: 'border-amber-500/25 dark:border-amber-500/35',
            glow: 'shadow-[0_4px_20px_-4px_rgba(245,158,11,0.25)] dark:shadow-[0_4px_24px_-4px_rgba(245,158,11,0.3)]',
            text: 'text-neutral-800 dark:text-amber-100'
        },
    };

    const style = config[toast.type];

    return (
        <div
            className={`
                relative group flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl border backdrop-blur-2xl transition-all cursor-pointer shadow-lg
                ${style.border} ${style.glow}
            `}
            style={{ backgroundColor: 'var(--toast-bg)' }}
            role="alert"
            onClick={() => onRemove(toast.id)}
        >
            {/* Icon */}
            <div className="flex-shrink-0">
                {style.icon}
            </div>

            {/* Message - Auto scaling + Truncate */}
            <div className="flex-1 min-w-0 pr-2">
                <p className={`${textSizeClass} font-medium ${style.text} truncate`}>{toast.message}</p>
                {toast.action && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toast.action!.onClick();
                            onRemove(toast.id);
                        }}
                        className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-700 dark:text-white/70 dark:hover:text-white transition-colors"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>

            {/* Close Button (Subtle & Linear Icon, No Background Hover Box) */}
            <div className="pl-2 border-l border-neutral-200 dark:border-white/10 flex items-center">
                <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
                    className="p-1 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-white transition-colors"
                    title="Dismiss"
                >
                    <AppIcon name="solar:close-circle-linear" className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
        const id = Math.random().toString(36).substring(2, 9);
        // Prevent duplicate toasts and enforce maximum of 1 toast to stop double stacking
        setToasts((prev) => {
            if (prev.some(t => t.message === message && t.type === type)) {
                return prev;
            }
            return [{ id, message, type, action }];
        });
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
            {children}
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
                <AnimatePresence mode="popLayout">
                    {toasts.map(toast => (
                        <motion.div 
                            key={toast.id} 
                            layout
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                            className="pointer-events-auto w-full flex justify-center"
                        >
                            <ToastItem toast={toast} onRemove={removeToast} />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};
