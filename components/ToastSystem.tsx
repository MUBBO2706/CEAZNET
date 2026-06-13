
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
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
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
            border: 'border-emerald-500/20',
            glow: 'shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]',
            bg: 'bg-neutral-900/95',
            text: 'text-emerald-50'
        },
        error: {
            icon: <AlertCircle className="w-5 h-5 text-rose-500" />,
            border: 'border-rose-500/20',
            glow: 'shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]',
            bg: 'bg-neutral-900/95',
            text: 'text-rose-50'
        },
        info: {
            icon: <Info className="w-5 h-5 text-blue-400" />,
            border: 'border-blue-500/20',
            glow: 'shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]',
            bg: 'bg-neutral-900/95',
            text: 'text-blue-50'
        },
        warning: {
            icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
            border: 'border-amber-500/20',
            glow: 'shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]',
            bg: 'bg-neutral-900/95',
            text: 'text-amber-50'
        },
    };

    const style = config[toast.type];

    return (
        <div
            className={`
                relative group flex items-center gap-3 pl-4 pr-3 py-3 rounded-2xl border backdrop-blur-2xl transition-colors cursor-pointer
                ${style.bg} ${style.border} ${style.glow}
            `}
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
                        className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/70 hover:text-white transition-colors"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>

            {/* Close Button (Subtle) */}
            <div className="pl-2 border-l border-white/10 flex items-center">
                <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(toast.id); }}
                    className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="w-4 h-4" />
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
