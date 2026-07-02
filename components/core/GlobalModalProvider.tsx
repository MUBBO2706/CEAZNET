import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, AlertTriangle, Info, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalOptions {
    title?: string;
    type?: 'info' | 'warning' | 'danger';
    allowOutsideClick?: boolean;
}

interface PromptOptions extends ModalOptions {
    defaultValue?: string;
    inputType?: 'text' | 'password' | 'email' | 'number';
    placeholder?: string;
}

interface GlobalModalContextType {
    alert: (message: string, options?: ModalOptions) => Promise<void>;
    prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
    confirm: (message: string, options?: ModalOptions & { confirmText?: string; cancelText?: string }) => Promise<boolean>;
}

const GlobalModalContext = createContext<GlobalModalContextType | undefined>(undefined);

export const useGlobalModal = () => {
    const context = useContext(GlobalModalContext);
    if (!context) {
        throw new Error('useGlobalModal must be used within a GlobalModalProvider');
    }
    return context;
};

type ModalState = {
    isOpen: boolean;
    mode: 'alert' | 'prompt' | 'confirm';
    message: string;
    title: string;
    type: 'info' | 'warning' | 'danger';
    defaultValue: string;
    inputType: string;
    placeholder: string;
    confirmText: string;
    cancelText: string;
    allowOutsideClick: boolean;
    resolve: (value: any) => void;
};

export const GlobalModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [modal, setModal] = useState<ModalState | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const openModal = useCallback((
        mode: ModalState['mode'],
        message: string,
        options: any
    ) => {
        return new Promise<any>((resolve) => {
            const title = options?.title || (mode === 'alert' ? 'Alert' : mode === 'prompt' ? 'Input Required' : 'Confirm');
            const type = options?.type || 'info';
            const allowOutsideClick = options?.allowOutsideClick !== false; // Defaults to true
            
            setInputValue(options?.defaultValue || '');
            setShowPassword(false);
            
            setModal({
                isOpen: true,
                mode,
                message,
                title,
                type,
                defaultValue: options?.defaultValue || '',
                inputType: options?.inputType || 'text',
                placeholder: options?.placeholder || '',
                confirmText: options?.confirmText || 'OK',
                cancelText: options?.cancelText || 'Cancel',
                allowOutsideClick,
                resolve,
            });
        });
    }, []);

    const alert = useCallback((message: string, options?: ModalOptions) => {
        return openModal('alert', message, options) as Promise<void>;
    }, [openModal]);

    const prompt = useCallback((message: string, options?: PromptOptions) => {
        return openModal('prompt', message, options) as Promise<string | null>;
    }, [openModal]);

    const confirm = useCallback((message: string, options?: any) => {
        return openModal('confirm', message, options) as Promise<boolean>;
    }, [openModal]);

    const handleClose = () => {
        if (modal) {
            if (modal.mode === 'prompt') modal.resolve(null);
            else if (modal.mode === 'confirm') modal.resolve(false);
            else modal.resolve(undefined);
            setModal(null);
        }
    };

    const handleConfirm = () => {
        if (modal) {
            if (modal.mode === 'prompt') modal.resolve(inputValue);
            else if (modal.mode === 'confirm') modal.resolve(true);
            else modal.resolve(undefined);
            setModal(null);
        }
    };

    return (
        <GlobalModalContext.Provider value={{ alert, prompt, confirm }}>
            {children}
            <AnimatePresence>
                {modal && modal.isOpen && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => modal.allowOutsideClick && handleClose()}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-sm bg-white dark:bg-[#1e1f22] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 pb-4">
                                <div className="flex items-start gap-4">
                                    <div className={`shrink-0 p-3 rounded-full ${
                                        modal.type === 'danger' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' :
                                        modal.type === 'warning' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                        'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                    }`}>
                                        {modal.type === 'info' ? <Info className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
                                            {modal.title}
                                        </h3>
                                        <p className="text-sm text-neutral-600 dark:text-neutral-300">
                                            {modal.message}
                                        </p>
                                    </div>
                                </div>

                                {modal.mode === 'prompt' && (
                                    <div className="mt-4 relative">
                                        <input
                                            type={modal.inputType === 'password' && showPassword ? 'text' : modal.inputType}
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder={modal.placeholder}
                                            className="w-full px-4 py-2.5 bg-neutral-100 dark:bg-black/50 border border-neutral-200 dark:border-white/10 rounded-xl text-neutral-900 dark:text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-shadow"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleConfirm();
                                                if (e.key === 'Escape') handleClose();
                                            }}
                                        />
                                        {modal.inputType === 'password' && (
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-4 bg-neutral-50 dark:bg-black/20 border-t border-neutral-100 dark:border-white/5 flex items-center justify-end gap-3">
                                {(modal.mode === 'prompt' || modal.mode === 'confirm') && (
                                    <button
                                        onClick={handleClose}
                                        className="px-4 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 rounded-xl transition-colors"
                                    >
                                        {modal.cancelText}
                                    </button>
                                )}
                                <button
                                    onClick={handleConfirm}
                                    className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors ${
                                        modal.type === 'danger' ? 'bg-red-500 hover:bg-red-600' :
                                        'bg-amber-600 hover:bg-amber-700'
                                    }`}
                                >
                                    {modal.confirmText}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </GlobalModalContext.Provider>
    );
};
