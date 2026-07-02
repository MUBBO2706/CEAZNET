
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check, X, ClipboardPaste, Languages } from 'lucide-react';
import { translateText } from '../services/translationService';

interface TranslatorViewProps {
    onBack: () => void;
    onTranslationComplete: (tokens: { input: number, output: number }) => void;
}

const sourceLanguages = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' }, { code: 'de', name: 'German' },
    { code: 'hi', name: 'Hindi' }, { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' }, { code: 'ko', name: 'Korean' },
    { code: 'pt', name: 'Portuguese' }, { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese' }, { code: 'ar', name: 'Arabic' },
];

const targetLanguages = sourceLanguages.filter(lang => lang.code !== 'auto');

// Simple token estimation: ~4 chars per token.
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const SkeletonLoader: React.FC = () => (
    <div className="w-full h-full p-4 space-y-4 animate-pulse">
        <div className="h-6 rounded w-5/6 bg-neutral-200/50 dark:bg-gray-700/50"></div>
        <div className="h-6 rounded w-full bg-neutral-200/50 dark:bg-gray-700/50"></div>
        <div className="h-6 rounded w-4/6 bg-neutral-200/50 dark:bg-gray-700/50"></div>
    </div>
);

const TranslatorView: React.FC<TranslatorViewProps> = ({ onBack, onTranslationComplete }) => {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('en');
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [tokenCount, setTokenCount] = useState({ input: 0, output: 0 });
    const debounceTimeout = useRef<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleTranslate = useCallback(async (text: string, source: string, target: string) => {
        if (!text.trim()) {
            setOutputText('');
            setTokenCount({ input: 0, output: 0 });
            return;
        }
        setIsLoading(true);
        setOutputText('');
        
        try {
            const result = await translateText(
                text, 
                targetLanguages.find(l => l.code === target)?.name || 'English', 
                sourceLanguages.find(l => l.code === source)?.name || 'Auto Detect'
            );
            
            setOutputText(result.translatedText);
            setTokenCount({ input: result.inputTokens, output: result.outputTokens });
            if (result.inputTokens > 0 || result.outputTokens > 0) {
                onTranslationComplete({ input: result.inputTokens, output: result.outputTokens });
            }
        } catch (error) {
            console.error("Translation failed:", error);
            setOutputText("Error: Translation failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, [onTranslationComplete]);
    
    useEffect(() => {
        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
        
        if (inputText.trim()) {
            setIsLoading(true);
            setOutputText('');
            debounceTimeout.current = window.setTimeout(() => {
                handleTranslate(inputText, sourceLang, targetLang);
            }, 800);
        } else {
            setOutputText('');
            setIsLoading(false);
            setTokenCount({ input: 0, output: 0 });
        }

        return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
    }, [inputText, sourceLang, targetLang, handleTranslate]);
    
    const handleCopy = () => {
        if (outputText && !outputText.startsWith('Error:')) {
            navigator.clipboard.writeText(outputText);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setInputText(text);
        } catch (error) {
            console.error('Failed to read clipboard contents: ', error);
        }
    };

    return (
        <main className="relative z-10 h-full flex flex-col p-4 md:p-6 overflow-hidden pt-20 md:pt-24">
            <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 min-h-0">
                
                {/* Input Panel */}
                <div className="flex-1 flex flex-col bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/10 shadow-lg min-h-[250px] md:min-h-0">
                    <div className="p-4 border-b border-white/20 dark:border-white/10">
                        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full bg-transparent text-neutral-700 dark:text-gray-200 font-semibold focus:outline-none appearance-none">
                            {sourceLanguages.map(lang => <option key={lang.code} value={lang.code} className="bg-white dark:bg-gray-800">{lang.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 p-4 relative overflow-y-auto">
                         <textarea
                            ref={textareaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Enter text..."
                            className="w-full h-full bg-transparent resize-none focus:outline-none text-neutral-800 dark:text-gray-200 text-lg leading-relaxed placeholder:text-neutral-500 dark:placeholder:text-gray-400"
                        />
                    </div>
                    <div className="p-4 border-t border-white/20 dark:border-white/10 flex justify-between items-center text-xs text-neutral-600 dark:text-gray-400 font-mono">
                        <span>{inputText.length} chars / {tokenCount.input > 0 && outputText && !isLoading ? tokenCount.input : `~${estimateTokens(inputText)}`} tokens</span>
                        <div className="flex items-center gap-1">
                            <button onClick={handlePaste} className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors" aria-label="Paste text">
                                <ClipboardPaste className="h-5 w-5" />
                            </button>
                            {inputText && (
                                <button onClick={() => setInputText('')} className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors" aria-label="Clear input text">
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Output Panel */}
                <div className="flex-1 flex flex-col bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/10 shadow-lg min-h-[250px] md:min-h-0">
                     <div className="p-4 border-b border-white/20 dark:border-white/10">
                        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full bg-transparent text-neutral-700 dark:text-gray-200 font-semibold focus:outline-none appearance-none">
                            {targetLanguages.map(lang => <option key={lang.code} value={lang.code} className="bg-white dark:bg-gray-800">{lang.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 p-4 relative overflow-y-auto">
                        {isLoading ? (
                            <SkeletonLoader />
                        ) : outputText ? (
                            <p className="whitespace-pre-wrap text-neutral-800 dark:text-gray-200 text-lg leading-relaxed">
                                {outputText}
                            </p>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-neutral-500 dark:text-gray-400">
                                <Languages className="h-12 w-12 mb-2" />
                                <span className="font-medium">Translation will appear here</span>
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-white/20 dark:border-white/10 flex justify-between items-center text-xs text-neutral-600 dark:text-gray-400 font-mono">
                        <span>
                            {outputText.length} chars / {tokenCount.output > 0 && !isLoading ? tokenCount.output : `~${estimateTokens(outputText)}`} tokens
                        </span>
                        {!isLoading && outputText && (
                           <button onClick={handleCopy} className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-white/10 transition-colors" aria-label="Copy translation">
                                {isCopied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </main>
    );
};

export default TranslatorView;
