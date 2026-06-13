
import React, { useState } from 'react';
import { Transaction } from '../../types';
import { X, Upload, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transactions: Transaction[]) => void;
    user: User | null;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSave, user }) => {
    const [inputText, setInputText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<Partial<Transaction>[]>([]);
    const [step, setStep] = useState<'input' | 'preview'>('input');

    const handleProcess = () => {
        setError(null);
        if (!inputText.trim()) return;

        try {
            const parsed = JSON.parse(inputText);
            if (!Array.isArray(parsed)) {
                throw new Error("Input must be a JSON Array [...]");
            }
            
            // Basic validation
            const validItems = parsed.filter(item => item && typeof item === 'object');
            
            if (validItems.length === 0) {
                throw new Error("No valid objects found in array.");
            }

            setPreviewData(validItems);
            setStep('preview');
        } catch (e: any) {
            setError("Invalid JSON format. Please ensure it is a valid JSON array.");
        }
    };

    const handleConfirm = () => {
        const finalTransactions: Transaction[] = previewData.map(t => {
            let finalDate = new Date();
            if (t.transaction_date) {
                const regex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
                const match = t.transaction_date.match(regex);
                if (match) {
                    finalDate = new Date(
                        parseInt(match[1]),
                        parseInt(match[2]) - 1,
                        parseInt(match[3]),
                        parseInt(match[4]),
                        parseInt(match[5]),
                        parseInt(match[6])
                    );
                } else {
                    finalDate = new Date(t.transaction_date);
                }
            }

            return {
                id: (t as any).id || crypto.randomUUID(),
                user_id: user?.id,
                profile_id: (t as any).profile_id || null,
                description: t.description || 'Imported Transaction',
                amount: Number(t.amount) || 0,
                type: (t.type === 'income' || t.type === 'transfer') ? t.type : 'expense',
                category: t.category || 'General',
                payment_method: t.payment_method || 'Cash',
                transaction_date: finalDate.toISOString(),
                created_at: (t as any).created_at || new Date().toISOString(),
                metadata: (t as any).metadata || null
            } as Transaction;
        });
        
        onSave(finalTransactions);
        setStep('input');
        setInputText('');
        setPreviewData([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" 
                onClick={onClose} 
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-2xl transform transition-all animate-fade-in-up">
                {/* Glow Border */}
                <div className="absolute -inset-[1px] bg-gradient-to-br from-indigo-500 via-blue-500 to-teal-500 rounded-[2rem] opacity-15 dark:opacity-25 blur-sm" />

                <div className="relative w-full bg-white/90 dark:bg-[#161618]/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden flex flex-col max-h-[85vh]">
                    
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center bg-white/50 dark:bg-white/5 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 shadow-sm">
                                <FileJson className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">JSON Import</h2>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Paste structured JSON data</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col p-6">
                        {step === 'input' ? (
                            <div className="flex-1 flex flex-col gap-4 min-h-0">
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-500/20 flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <div className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                        <p className="font-bold mb-1 uppercase tracking-wide">Required Format</p>
                                        <code className="bg-white/50 dark:bg-black/20 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-mono">
                                            [{`{ "amount": 100, "description": "...", "type": "expense" }`}]
                                        </code>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group">
                                        <Upload className="w-5 h-5 text-gray-400 group-hover:text-indigo-500" />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">Select JSON File</span>
                                        <input 
                                            type="file" 
                                            accept=".json" 
                                            className="hidden" 
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (e) => {
                                                    const content = e.target?.result as string;
                                                    setInputText(content);
                                                };
                                                reader.readAsText(file);
                                            }} 
                                        />
                                    </label>
                                    <span className="text-xs font-bold text-gray-400 uppercase">OR</span>
                                </div>

                                <textarea 
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder={`[\n  {\n    "amount": 50,\n    "description": "Lunch",\n    "type": "expense",\n    "transaction_date": "2023-12-01T14:30:00"\n  }\n]`}
                                    className="w-full h-64 bg-gray-50 dark:bg-[#0f0f0f] border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none placeholder-gray-400 dark:placeholder-gray-600 dark:text-gray-200 shadow-inner"
                                />
                                
                                {error && (
                                    <p className="text-xs text-red-500 font-bold px-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {error}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 flex flex-col">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Previewing {previewData.length} items
                                    </h3>
                                    <button onClick={() => setStep('input')} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider">Edit JSON</button>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-hide">
                                    {previewData.map((t, idx) => {
                                        let previewDate = new Date();
                                        if (t.transaction_date) {
                                            const regex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
                                            const match = t.transaction_date.match(regex);
                                            if (match) {
                                                previewDate = new Date(
                                                    parseInt(match[1]),
                                                    parseInt(match[2]) - 1,
                                                    parseInt(match[3]),
                                                    parseInt(match[4]),
                                                    parseInt(match[5]),
                                                    parseInt(match[6])
                                                );
                                            } else {
                                                previewDate = new Date(t.transaction_date);
                                            }
                                        }

                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.description || 'No Description'}</p>
                                                    <div className="flex gap-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">
                                                        <span className="capitalize">{t.category || 'General'}</span>
                                                        <span>•</span>
                                                        <span>
                                                            {previewDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`text-right font-bold text-sm ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {t.type === 'income' ? '+' : '-'} {t.amount}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex justify-end gap-3 backdrop-blur-md">
                        {step === 'input' ? (
                            <button 
                                onClick={handleProcess}
                                disabled={!inputText.trim()}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                <Upload className="w-4 h-4" />
                                Parse JSON
                            </button>
                        ) : (
                            <button 
                                onClick={handleConfirm}
                                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Import Data
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkImportModal;
