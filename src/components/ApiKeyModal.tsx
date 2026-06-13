
import React, { useState, useEffect } from 'react';
import { X, ExternalLink, ArrowRight, Check, Shield, Zap, Key } from 'lucide-react';
import { useToast } from './ToastManager';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSetApiKey: (key: string) => void;
  onClose: () => void;
  currentApiKey?: string | null;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSetApiKey, onClose, currentApiKey }) => {
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setKeyInput(currentApiKey || '');
      setError('');
      setIsConnecting(false);
    }
  }, [isOpen, currentApiKey]);

  const handleClose = () => {
      setIsAnimating(false);
      setTimeout(onClose, 300);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!keyInput.trim()) {
      setError('API Key is required to proceed.');
      return;
    }
    if (keyInput.trim().length < 20) {
        setError('Invalid key format. Too short.');
        return;
    }
    setError('');
    setIsConnecting(true);
    
    // Simulate connection lag for better UX feedback
    setTimeout(() => {
        onSetApiKey(keyInput.trim());
        addToast('API Key connected successfully!', 'success');
        setIsConnecting(false);
        handleClose();
    }, 600);
  };

  const handlePaste = async () => {
      try {
          const text = await navigator.clipboard.readText();
          setKeyInput(text);
          setError('');
      } catch (e) {
          console.error('Failed to paste:', e);
      }
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div 
        className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
        {/* Deep Dark/Light Backdrop with Blur */}
        <div 
            className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" 
            onClick={handleClose}
        />

        <div 
            className={`relative w-full max-w-[400px] transform transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Glowing Gradient Border Effect */}
            <div className="absolute -inset-[1px] bg-gradient-to-br from-amber-500 via-purple-600 to-blue-600 rounded-[2rem] opacity-30 dark:opacity-60 blur-sm" />
            
            {/* Main Card */}
            <div className="relative bg-white/90 dark:bg-[#161618]/95 backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/5 overflow-hidden">
                
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-900/10 pointer-events-none" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Close Button */}
                <button 
                    onClick={handleClose} 
                    className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-20"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="px-8 pt-10 pb-8">
                    {/* Header Section */}
                    <div className="text-center mb-8 relative z-10">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white mb-4 shadow-lg shadow-blue-500/30">
                            <Zap className="w-6 h-6 fill-current" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                            Initialize Engine
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2 font-medium max-w-[260px] mx-auto">
                            Connect your Gemini API key to unlock the full potential of Ceaznet.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 group-focus-within:text-amber-500 transition-colors pointer-events-none">
                                    <Key className="h-5 w-5" />
                                </div>
                                <input
                                    type="text"
                                    value={keyInput}
                                    onChange={(e) => {
                                        setKeyInput(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="Paste API Key here..."
                                    className="w-full bg-neutral-50 dark:bg-[#0f1115] border border-neutral-200 dark:border-gray-700/50 rounded-full py-3.5 pl-12 pr-12 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-sm font-mono text-sm"
                                    autoComplete="off"
                                />
                                {keyInput && !error && (
                                    <div className="absolute right-4 top-0 bottom-0 flex items-center justify-center text-green-500 animate-fade-in-up pointer-events-none">
                                        <Check className="h-5 w-5" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex justify-between items-center px-2">
                                <button 
                                    type="button"
                                    onClick={handlePaste} 
                                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors uppercase tracking-wider disabled:opacity-50"
                                    disabled={isConnecting}
                                >
                                    Paste from Clipboard
                                </button>
                                {error && (
                                    <span className="text-[10px] text-red-500 font-medium animate-pulse">
                                        {error}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isConnecting}
                            className={`group relative w-full flex items-center justify-center gap-2 py-4 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-full overflow-hidden transition-all ${isConnecting ? 'opacity-80 cursor-not-allowed scale-[0.98]' : 'hover:shadow-xl hover:shadow-amber-500/20 active:scale-[0.98]'}`}
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            {isConnecting ? (
                                <div className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-base">Connecting...</span>
                                </div>
                            ) : (
                                <>
                                    <span className="text-base">{currentApiKey ? 'Update Key' : 'Connect'}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
                
                {/* Footer Info */}
                <div className="bg-neutral-50/80 dark:bg-black/30 p-4 border-t border-neutral-100 dark:border-white/5 backdrop-blur-sm flex justify-between items-center px-6">
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 dark:text-gray-600 font-semibold uppercase tracking-wider">
                        <Shield className="w-3 h-3" /> Secure Storage
                    </div>
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                    >
                        Get Key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ApiKeyModal;
