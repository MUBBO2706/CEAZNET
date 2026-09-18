import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check, X, ClipboardPaste, Languages, ChevronDown } from 'lucide-react';
import { translateText } from '../services/translationService';

interface TranslatorViewProps {
    onBack: () => void;
    onTranslationComplete: (data: { 
        input: number; 
        output: number; 
        source: string; 
        target: string; 
        model: string;
        inputText?: string;
        outputText?: string;
    }) => void;
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

export const TRANSLATOR_AI_MODELS = [
    { code: 'gemini-3.8-flash', fullName: 'Gemini 3.8 Flash', shortName: '3.8 Flash' },
    { code: 'gemini-3.7-flash', fullName: 'Gemini 3.7 Flash', shortName: '3.7 Flash' },
    { code: 'gemini-3.6-flash', fullName: 'Gemini 3.6 Flash', shortName: '3.6 Flash' },
    { code: 'gemini-3.5-flash', fullName: 'Gemini 3.5 Flash', shortName: '3.5 Flash' },
    { code: 'gemini-3.5-flash-lite', fullName: 'Gemini 3.5 Flash-Lite', shortName: '3.5 Lite' },
    { code: 'gemini-3.1-flash-lite', fullName: 'Gemini 3.1 Flash-Lite', shortName: '3.1 Lite' },
    { code: 'gemini-3.1-pro-preview', fullName: 'Gemini 3.1 Pro', shortName: '3.1 Pro' },
    { code: 'gemini-3-flash-preview', fullName: 'Gemini 3 Flash', shortName: '3.0 Flash' },
    { code: 'gemini-2.5-pro', fullName: 'Gemini 2.5 Pro', shortName: '2.5 Pro' },
    { code: 'gemini-2.5-flash', fullName: 'Gemini 2.5 Flash', shortName: '2.5 Flash' },
    { code: 'gemini-2.5-flash-lite', fullName: 'Gemini 2.5 Flash-Lite', shortName: '2.5 Lite' },
];

// Simple token estimation: ~4 chars per token.
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const SkeletonLoader: React.FC = () => (
    <div className="w-full h-full p-4 space-y-4 animate-pulse">
        <div className="h-6 rounded w-5/6 bg-neutral-200/50 dark:bg-gray-700/50"></div>
        <div className="h-6 rounded w-full bg-neutral-200/50 dark:bg-gray-700/50"></div>
        <div className="h-6 rounded w-4/6 bg-neutral-200/50 dark:bg-gray-700/50"></div>
    </div>
);

// CUSTOM LANGUAGE SELECTOR DROPDOWN (AI model selector style)
const LanguageSelectorDropdown: React.FC<{
    selectedCode: string;
    onSelect: (code: string) => void;
    languages: { code: string; name: string }[];
    align?: 'left' | 'right';
    title?: string;
    openUpOnMobile?: boolean;
}> = ({ selectedCode, onSelect, languages, align = 'left', title, openUpOnMobile = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentLangObj = languages.find(l => l.code === selectedCode) || languages[0];

    const positionClasses = openUpOnMobile
        ? `bottom-full mb-2 md:bottom-auto md:top-full md:mb-0 md:mt-2 ${align === 'right' ? 'right-0' : 'left-0'}`
        : `top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'}`;

    return (
        <div ref={dropdownRef} className="relative inline-block text-left">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{ outline: 'none', WebkitTapHighlightColor: 'transparent', boxShadow: 'none' }}
                className={`flex items-center gap-1.5 py-1 font-bold text-base md:text-lg focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none select-none transition-all ${
                    isOpen 
                        ? 'text-indigo-600 dark:text-indigo-400 scale-102 font-extrabold' 
                        : 'text-neutral-800 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
            >
                <span>{currentLangObj.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'text-neutral-400 dark:text-gray-500'}`} />
            </button>

            {isOpen && (
                <div className={`absolute ${positionClasses} w-56 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in duration-150`}>
                    {title && (
                        <div className="px-4 py-2.5 text-[10px] uppercase font-bold tracking-wider text-neutral-400 dark:text-gray-500 border-b border-neutral-100 dark:border-neutral-900/60 bg-neutral-50/50 dark:bg-neutral-950/50 select-none">
                            {title}
                        </div>
                    )}
                    <div className="max-h-64 overflow-y-auto scrollbar-thin">
                        {languages.map((item) => {
                            const isSelected = item.code === selectedCode;
                            return (
                                <button
                                    key={item.code}
                                    type="button"
                                    onClick={() => {
                                        onSelect(item.code);
                                        setIsOpen(false);
                                    }}
                                    style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
                                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors focus:outline-none focus:ring-0 active:outline-none ${
                                        isSelected 
                                            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 font-bold' 
                                            : 'text-neutral-700 dark:text-gray-300 hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                                    }`}
                                >
                                    <span>{item.name}</span>
                                    {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// MODEL DROPDOWN (Custom trigger styling: transparent bg, hover text-only color transitions)
const TranslatorModelDropdown: React.FC<{
    selectedModel: string;
    onSelect: (modelCode: string) => void;
}> = ({ selectedModel, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentModelObj = TRANSLATOR_AI_MODELS.find(m => m.code === selectedModel) || TRANSLATOR_AI_MODELS[0];

    return (
        <div ref={dropdownRef} className="relative flex items-center">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                style={{ outline: 'none', WebkitTapHighlightColor: 'transparent', boxShadow: 'none' }}
                className={`flex items-center gap-1 px-2 py-1.5 h-8 bg-transparent text-xs font-bold focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 active:outline-none select-none transition-all ${
                    isOpen 
                        ? 'text-indigo-600 dark:text-indigo-400 scale-102 font-extrabold' 
                        : 'text-neutral-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
                title={`AI Model: ${currentModelObj.fullName}`}
            >
                <span className="whitespace-nowrap">{currentModelObj.shortName}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'text-neutral-400 dark:text-gray-500'}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 md:top-auto md:bottom-full md:mt-0 md:mb-2 w-56 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in duration-150">
                    <div className="px-4 py-2.5 text-[10px] uppercase font-bold tracking-wider text-neutral-400 dark:text-gray-500 border-b border-neutral-100 dark:border-neutral-900/60 bg-neutral-50/50 dark:bg-neutral-950/50 select-none">
                        Translation AI Model
                    </div>
                    <div className="max-h-60 overflow-y-auto scrollbar-thin">
                        {TRANSLATOR_AI_MODELS.map((item) => {
                            const isSelected = item.code === selectedModel;
                            return (
                                <button
                                    key={item.code}
                                    type="button"
                                    onClick={() => {
                                        onSelect(item.code);
                                        setIsOpen(false);
                                    }}
                                    style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
                                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-colors focus:outline-none focus:ring-0 active:outline-none ${
                                        isSelected 
                                            ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 font-bold' 
                                            : 'text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-neutral-900/60'
                                    }`}
                                >
                                    <span>{item.fullName}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const TranslatorView: React.FC<TranslatorViewProps> = ({ onBack, onTranslationComplete }) => {
    const [inputText, setInputText] = useState('');
    const [outputText, setOutputText] = useState('');
    const [sourceLang, setSourceLang] = useState('auto');
    const [targetLang, setTargetLang] = useState('en');
    const [selectedModel, setSelectedModel] = useState<string>(() => {
        try {
            return localStorage.getItem('translator_ai_model') || 'gemini-3.8-flash';
        } catch {
            return 'gemini-3.8-flash';
        }
    });

    useEffect(() => {
        const handleModelSync = (e: Event) => {
            const customEvent = e as CustomEvent<string>;
            if (customEvent.detail) {
                setSelectedModel(customEvent.detail);
            }
        };
        window.addEventListener('translator-model-change', handleModelSync);
        return () => window.removeEventListener('translator-model-change', handleModelSync);
    }, []);

    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [tokenCount, setTokenCount] = useState({ input: 0, output: 0 });
    const debounceTimeout = useRef<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleModelChange = (modelCode: string) => {
        setSelectedModel(modelCode);
        try {
            localStorage.setItem('translator_ai_model', modelCode);
            window.dispatchEvent(new CustomEvent('translator-model-change', { detail: modelCode }));
        } catch {}
    };

    const handleTranslate = useCallback(async (text: string, source: string, target: string, model: string) => {
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
                sourceLanguages.find(l => l.code === source)?.name || 'Auto Detect',
                model
            );
            
            setOutputText(result.translatedText);
            setTokenCount({ input: result.inputTokens, output: result.outputTokens });
            if (result.inputTokens > 0 || result.outputTokens > 0) {
                onTranslationComplete({ 
                    input: result.inputTokens, 
                    output: result.outputTokens,
                    source: sourceLanguages.find(l => l.code === source)?.name || 'Auto Detect',
                    target: targetLanguages.find(l => l.code === target)?.name || 'English',
                    model: TRANSLATOR_AI_MODELS.find(m => m.code === model)?.fullName || 'Gemini 3.8 Flash',
                    inputText: text,
                    outputText: result.translatedText
                });
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
                handleTranslate(inputText, sourceLang, targetLang, selectedModel);
            }, 800);
        } else {
            setOutputText('');
            setIsLoading(false);
            setTokenCount({ input: 0, output: 0 });
        }

        return () => { if (debounceTimeout.current) clearTimeout(debounceTimeout.current); };
    }, [inputText, sourceLang, targetLang, selectedModel, handleTranslate]);
    
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
        <main 
            className="relative z-10 h-full flex flex-col p-4 md:p-6 overflow-hidden pt-20 md:pt-24 max-w-[1600px] mx-auto w-full transition-all duration-300"
            style={{ paddingBottom: 'calc(var(--dev-console-padding, 0px) + 1.5rem)' }}
        >
            <div className="flex-1 flex flex-col md:flex-row gap-6 md:gap-8 min-h-0">
                
                {/* Input Panel */}
                <div className="flex-1 flex flex-col min-h-[200px] md:min-h-0">
                    <div className="pb-3 border-b border-gray-200 dark:border-white/10 h-[45px] flex items-center">
                        <LanguageSelectorDropdown 
                            selectedCode={sourceLang} 
                            onSelect={setSourceLang} 
                            languages={sourceLanguages} 
                            align="left"
                            title="Source Language"
                        />
                    </div>
                    <div className="flex-1 py-3 relative overflow-hidden flex flex-col min-h-0">
                         <textarea
                            ref={textareaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Enter text..."
                            className="w-full h-full bg-transparent resize-none focus:outline-none text-neutral-800 dark:text-gray-200 text-base sm:text-lg leading-relaxed placeholder:text-neutral-400 dark:placeholder:text-gray-500 overflow-y-auto scrollbar-thin"
                        />
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-white/10 flex justify-between items-center text-xs text-neutral-500 dark:text-gray-400 font-mono min-h-[44px]">
                        <span>{inputText.length} chars / {tokenCount.input > 0 && outputText && !isLoading ? tokenCount.input : `~${estimateTokens(inputText)}`} tokens</span>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <TranslatorModelDropdown 
                                selectedModel={selectedModel}
                                onSelect={handleModelChange}
                            />
                            <button onClick={handlePaste} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-neutral-600 dark:text-gray-300" aria-label="Paste text" title="Paste text">
                                <ClipboardPaste className="h-4 w-4 sm:h-5 sm:w-5" />
                            </button>
                            {inputText && (
                                <button onClick={() => setInputText('')} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-neutral-600 dark:text-gray-300" aria-label="Clear input text" title="Clear text">
                                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile / Desktop Separator */}
                <hr className="md:hidden border-t border-gray-200 dark:border-white/10" />
                <div className="hidden md:block w-px bg-gray-200 dark:bg-white/10 self-stretch" />

                {/* Output Panel */}
                <div className="flex-1 flex flex-col min-h-[200px] md:min-h-0">
                     <div className="pb-3 border-b border-gray-200 dark:border-white/10 h-[45px] flex items-center">
                        <LanguageSelectorDropdown 
                            selectedCode={targetLang} 
                            onSelect={setTargetLang} 
                            languages={targetLanguages} 
                            align="left"
                            title="Target Language"
                            openUpOnMobile={true}
                        />
                    </div>
                    <div className="flex-1 py-3 relative overflow-y-auto min-h-0 scrollbar-thin flex flex-col">
                        {isLoading ? (
                            <SkeletonLoader />
                        ) : outputText ? (
                            <p className="whitespace-pre-wrap text-neutral-800 dark:text-gray-200 text-base sm:text-lg leading-relaxed">
                                {outputText}
                            </p>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-neutral-400 dark:text-gray-500 my-auto py-8">
                                <Languages className="h-12 w-12 mb-2 opacity-60" />
                                <span className="font-medium text-sm">Translation will appear here</span>
                            </div>
                        )}
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-white/10 flex justify-between items-center text-xs text-neutral-500 dark:text-gray-400 font-mono min-h-[44px]">
                        <span>
                            {outputText.length} chars / {tokenCount.output > 0 && !isLoading ? tokenCount.output : `~${estimateTokens(outputText)}`} tokens
                        </span>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-h-[32px]">
                            {!isLoading && outputText && (
                               <button onClick={handleCopy} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-neutral-600 dark:text-gray-300" aria-label="Copy translation" title="Copy translation">
                                    {isCopied ? <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" /> : <Copy className="h-4 w-4 sm:h-5 sm:w-5" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </main>
    );
};

export default TranslatorView;
