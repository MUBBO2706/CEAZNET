import React, { useState, useMemo } from 'react';
import { VoiceName } from '../types';
import { Mic, SlidersHorizontal, Smile, ToyBrick, Coffee, Briefcase, Anchor, Zap, Quote, Drama, BookOpen, Wind, CloudRain, Swords, VenetianMask, Laugh, Frown, Check, ChevronDown, Sparkles, ArrowLeft } from 'lucide-react';
import { voices } from './LiveConversationView';

const MarsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <circle cx="10" cy="14" r="5"/>
        <line x1="13.5" y1="10.5" x2="18" y2="6"/>
        <polyline points="18 9 18 6 15 6"/>
    </svg>
);

const VenusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        <circle cx="12" cy="9" r="5"></circle>
        <line x1="12" y1="14" x2="12" y2="22"></line>
        <line x1="9" y1="18" x2="15" y2="18"></line>
    </svg>
);

const tones = [
    { id: 'friendly', name: 'Friendly', icon: Smile, prompt: "[TONE: friendly, warm]" },
    { id: 'playful', name: 'Playful', icon: ToyBrick, prompt: "[TONE: playful, lighthearted]" },
    { id: 'casual', name: 'Casual', icon: Coffee, prompt: "[TONE: casual, relaxed, chill]" },
    { id: 'formal', name: 'Formal', icon: Briefcase, prompt: "[TONE: formal, professional]" },
    { id: 'serious', name: 'Serious', icon: Anchor, prompt: "[TONE: serious, direct]" },
    { id: 'enthusiastic', name: 'Enthusiastic', icon: Zap, prompt: "[TONE: enthusiastic, energetic]" },
    { id: 'sarcastic', name: 'Sarcastic', icon: Quote, prompt: "[TONE: sarcastic, witty]" },
    { id: 'dramatic', name: 'Dramatic', icon: Drama, prompt: "[TONE: dramatic, expressive]" },
    { id: 'storyteller', name: 'Storyteller', icon: BookOpen, prompt: "[TONE: captivating storyteller]" },
    { id: 'calm', name: 'Calm', icon: Wind, prompt: "[TONE: calm, soothing]" },
    { id: 'sad', name: 'Sad', icon: CloudRain, prompt: "[TONE: sad, somber]" },
    { id: 'aggressive', name: 'Aggressive', icon: Swords, prompt: "[TONE: aggressive, assertive]" },
    { id: 'whisper', name: 'Whisper', icon: VenetianMask, prompt: "[TONE: quiet, whispering voice]" },
    { id: 'laughing', name: 'Laughing', icon: Laugh, prompt: "[TONE: incorporate laughter]" },
    { id: 'crying', name: 'Crying', icon: Frown, prompt: "[TONE: incorporate crying/sadness]" },
];

interface VoiceSettingsViewProps {
    onBack: () => void;
    selectedVoice: VoiceName;
    setSelectedVoice: (voice: VoiceName) => void;
    voiceModeToneInstruction: string;
    setVoiceModeToneInstruction: (instruction: string) => void;
    customInstruction: string;
    setCustomInstruction: (instruction: string) => void;
    isProactiveModeEnabled: boolean;
    setIsVoiceProactiveMode: (isEnabled: boolean) => void;
    isAudioRecordingEnabled: boolean;
    setIsAudioRecordingEnabled: (isEnabled: boolean) => void;
}

const VoiceSettingsView: React.FC<VoiceSettingsViewProps> = ({ 
    onBack, 
    selectedVoice, 
    setSelectedVoice, 
    voiceModeToneInstruction,
    setVoiceModeToneInstruction,
    customInstruction, 
    setCustomInstruction,
    isProactiveModeEnabled,
    setIsVoiceProactiveMode,
    isAudioRecordingEnabled,
    setIsAudioRecordingEnabled
}) => {
    type Tab = 'voices' | 'tones' | 'instructions';
    const [activeTab, setActiveTab] = useState<Tab>('voices');
    const [showMoreVoices, setShowMoreVoices] = useState(false);
    const visibleVoices = showMoreVoices ? voices : voices.slice(0, 8);

    const selectedToneId = useMemo(() => {
        const foundTone = tones.find(t => t.prompt === voiceModeToneInstruction);
        return foundTone ? foundTone.id : null;
    }, [voiceModeToneInstruction]);

    return (
        <div className="min-h-screen bg-[#F9F6F2] dark:bg-[#050505] pt-24 px-4 pb-8 animate-fade-in">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
                            Voice Configuration
                        </h1>
                        <p className="text-neutral-500 dark:text-neutral-400">
                            Customize your conversational partner's voice, tone, and behavior.
                        </p>
                    </div>
                </div>

                {/* Segmented Control Tabs */}
                <div className="mb-8">
                    <div className="flex p-1 bg-neutral-200 dark:bg-white/5 rounded-full relative max-w-md mx-auto border border-transparent dark:border-white/5">
                        {/* Sliding Background */}
                        <div 
                            className={`absolute top-1 bottom-1 w-[calc(33.33%-4px)] bg-white dark:bg-[#1a1a1a] rounded-full shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
                            style={{ 
                                transform: activeTab === 'voices' ? 'translateX(0)' : activeTab === 'tones' ? 'translateX(100%)' : 'translateX(200%)',
                                left: '2px' // small offset
                            }}
                        />
                        
                        <button
                            onClick={() => setActiveTab('voices')}
                            className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-full transition-colors ${activeTab === 'voices' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
                        >
                            <Mic className="w-4 h-4" /> Voices
                        </button>
                        <button
                            onClick={() => setActiveTab('tones')}
                            className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-full transition-colors ${activeTab === 'tones' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
                        >
                            <VenetianMask className="w-4 h-4" /> Tones
                        </button>
                        <button
                            onClick={() => setActiveTab('instructions')}
                            className={`flex-1 relative z-10 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-full transition-colors ${activeTab === 'instructions' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
                        >
                            <SlidersHorizontal className="w-4 h-4" /> Controls
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="min-h-[400px]">
                    {/* Voices Tab */}
                    {activeTab === 'voices' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {visibleVoices.map(v => {
                                    const isSelected = selectedVoice === v.id;
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVoice(v.id)}
                                            className={`relative p-4 rounded-2xl text-left border transition-all duration-200 group
                                                ${isSelected 
                                                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 dark:border-amber-500/50 ring-1 ring-amber-500/50' 
                                                    : 'bg-white dark:bg-[#0a0a0a] border-neutral-200 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md'
                                                }`
                                            }
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-3">
                                                    {v.gender === 'female' ? (
                                                        <div className={`p-2 rounded-full ${isSelected ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-neutral-500'}`}>
                                                            <VenusIcon className="w-4 h-4" />
                                                        </div>
                                                    ) : (
                                                        <div className={`p-2 rounded-full ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-neutral-500'}`}>
                                                            <MarsIcon className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                    <span className={`font-bold text-base ${isSelected ? 'text-neutral-900 dark:text-white' : 'text-neutral-700 dark:text-neutral-300'}`}>
                                                        {v.displayName}
                                                    </span>
                                                </div>
                                                {isSelected && <div className="bg-amber-500 text-white rounded-full p-1"><Check className="w-3 h-3" /></div>}
                                            </div>
                                            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed pl-1">
                                                {v.description}
                                            </p>
                                            {v.isNew && (
                                                <span className="absolute -top-2 -right-2 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-sm border border-white dark:border-[#0a0a0a]">
                                                    New
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            {!showMoreVoices && voices.length > 8 && (
                                <button 
                                    onClick={() => setShowMoreVoices(true)} 
                                    className="w-full py-4 flex items-center justify-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl hover:bg-neutral-50 dark:hover:bg-white/5"
                                >
                                    <span>Show all {voices.length} voices</span>
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Tones Tab */}
                    {activeTab === 'tones' && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl flex items-start gap-4">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">Style Adjustment</h3>
                                    <p className="text-sm text-blue-700 dark:text-blue-300/80 leading-relaxed">
                                        Select a tone to subtly influence how the AI speaks. Tap the selected tone again to revert to neutral.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {tones.map(tone => {
                                    const Icon = tone.icon;
                                    const isSelected = selectedToneId === tone.id;
                                    return (
                                        <button
                                            key={tone.id}
                                            onClick={() => setVoiceModeToneInstruction(isSelected ? '' : tone.prompt)}
                                            className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all duration-200 gap-3
                                                ${isSelected 
                                                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-500 dark:border-amber-500/50 shadow-md transform scale-[1.02]' 
                                                    : 'bg-white dark:bg-[#0a0a0a] border-neutral-200 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-neutral-50 dark:hover:bg-white/5'
                                                }`
                                            }
                                        >
                                            <div className={`p-3 rounded-full ${isSelected ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-neutral-400'}`}>
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <span className={`text-sm font-medium ${isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-600 dark:text-neutral-300'}`}>
                                                {tone.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Instructions Tab */}
                    {activeTab === 'instructions' && (
                        <div className="space-y-6 animate-fade-in-up max-w-2xl mx-auto">
                            
                            {/* Proactive Mode Toggle */}
                            <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-2xl border border-neutral-200 dark:border-white/10 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                <div className="pr-6">
                                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">Proactive Engagement</h3>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                        If enabled, the AI will gently re-engage you if you are silent for more than 15 seconds during a live session.
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    aria-checked={isProactiveModeEnabled}
                                    onClick={() => setIsVoiceProactiveMode(!isProactiveModeEnabled)}
                                    className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isProactiveModeEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isProactiveModeEnabled ? 'translate-x-6' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>

                            {/* Audio Recording Toggle */}
                            <div className="bg-white dark:bg-[#0a0a0a] p-6 rounded-2xl border border-neutral-200 dark:border-white/10 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                <div className="pr-6">
                                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">Record Audio</h3>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                        If enabled, your voice conversations will be recorded and saved to your history.
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    aria-checked={isAudioRecordingEnabled}
                                    onClick={() => setIsAudioRecordingEnabled(!isAudioRecordingEnabled)}
                                    className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAudioRecordingEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAudioRecordingEnabled ? 'translate-x-6' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>

                            {/* Custom Instructions Input */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <SlidersHorizontal className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
                                    <label htmlFor="custom-instruction" className="text-base font-bold text-neutral-900 dark:text-white">
                                        Custom System Instructions
                                    </label>
                                </div>
                                <div className="relative">
                                    <textarea
                                        id="custom-instruction"
                                        rows={8}
                                        value={customInstruction}
                                        onChange={(e) => setCustomInstruction(e.target.value)}
                                        placeholder="E.g., Speak slowly, always answer in Hindi, define technical terms..."
                                        className="w-full bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl py-4 px-5 text-base text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none shadow-sm"
                                    />
                                    <div className="absolute bottom-4 right-4 text-xs text-neutral-400 dark:text-neutral-500 bg-white/80 dark:bg-[#0a0a0a]/80 px-2 py-1 rounded-md backdrop-blur-sm">
                                        High Priority
                                    </div>
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 px-1">
                                    These instructions are appended to the system prompt and override default behaviors.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoiceSettingsView;
