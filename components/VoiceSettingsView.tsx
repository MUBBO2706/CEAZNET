import React, { useState, useMemo } from 'react';
import { VoiceName } from '../types';
import { AppIcon } from './core/AppIcon';
import { voices } from './LiveConversationView';

const tones = [
    { id: 'friendly', name: 'Friendly', icon: 'solar:smile-circle-linear', prompt: "[TONE: friendly, warm]" },
    { id: 'playful', name: 'Playful', icon: 'solar:gamepad-linear', prompt: "[TONE: playful, lighthearted]" },
    { id: 'casual', name: 'Casual', icon: 'solar:cup-linear', prompt: "[TONE: casual, relaxed, chill]" },
    { id: 'formal', name: 'Formal', icon: 'solar:case-linear', prompt: "[TONE: formal, professional]" },
    { id: 'serious', name: 'Serious', icon: 'solar:shield-warning-linear', prompt: "[TONE: serious, direct]" },
    { id: 'enthusiastic', name: 'Enthusiastic', icon: 'solar:bolt-linear', prompt: "[TONE: enthusiastic, energetic]" },
    { id: 'sarcastic', name: 'Sarcastic', icon: 'solar:chat-round-line-linear', prompt: "[TONE: sarcastic, witty]" },
    { id: 'dramatic', name: 'Dramatic', icon: 'solar:mask-happly-linear', prompt: "[TONE: dramatic, expressive]" },
    { id: 'storyteller', name: 'Storyteller', icon: 'solar:book-linear', prompt: "[TONE: captivating storyteller]" },
    { id: 'calm', name: 'Calm', icon: 'solar:leaf-linear', prompt: "[TONE: calm, soothing]" },
    { id: 'sad', name: 'Sad', icon: 'solar:cloud-rain-linear', prompt: "[TONE: sad, somber]" },
    { id: 'aggressive', name: 'Aggressive', icon: 'solar:flame-linear', prompt: "[TONE: aggressive, assertive]" },
    { id: 'whisper', name: 'Whisper', icon: 'solar:soundwave-linear', prompt: "[TONE: quiet, whispering voice]" },
    { id: 'laughing', name: 'Laughing', icon: 'solar:emoji-funny-circle-linear', prompt: "[TONE: incorporate laughter]" },
    { id: 'crying', name: 'Crying', icon: 'solar:sad-circle-linear', prompt: "[TONE: incorporate crying/sadness]" },
];

interface VoiceSettingsViewProps {
    onBack?: () => void;
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
    const visibleVoices = showMoreVoices ? voices : voices.slice(0, 9);

    const selectedToneId = useMemo(() => {
        const foundTone = tones.find(t => t.prompt === voiceModeToneInstruction);
        return foundTone ? foundTone.id : null;
    }, [voiceModeToneInstruction]);

    return (
        <main 
            className="relative z-10 h-full overflow-y-auto bg-gray-50 dark:bg-black pt-16 sm:pt-18 md:pt-20 pb-6 dev-console-spacing-pb scrollbar-hide"
            style={{ paddingBottom: 'calc(var(--dev-console-padding, 0px) + 2rem)' }}
        >
            <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-2 sm:py-4 space-y-6">
                {/* Header Title (Clean, no redundant back button) */}
                <div className="space-y-1">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Voice Configuration
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-white/60">
                        Customize partner voice persona, tone style, and conversational behavior
                    </p>
                </div>

                {/* Container-less Minimal Underline Tabs */}
                <div className="flex items-center gap-6 sm:gap-8 border-b border-gray-200 dark:border-white/10">
                    <button
                        onClick={() => setActiveTab('voices')}
                        className={`pb-3 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer relative ${
                            activeTab === 'voices'
                                ? 'text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        <AppIcon name="solar:microphone-3-linear" className="w-4 h-4" />
                        <span>Voices</span>
                        {activeTab === 'voices' && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('tones')}
                        className={`pb-3 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer relative ${
                            activeTab === 'tones'
                                ? 'text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        <AppIcon name="solar:magic-stick-3-linear" className="w-4 h-4" />
                        <span>Tones</span>
                        {activeTab === 'tones' && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('instructions')}
                        className={`pb-3 text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer relative ${
                            activeTab === 'instructions'
                                ? 'text-gray-900 dark:text-white font-semibold'
                                : 'text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'
                        }`}
                    >
                        <AppIcon name="solar:tuning-square-2-linear" className="w-4 h-4" />
                        <span>Controls</span>
                        {activeTab === 'instructions' && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />
                        )}
                    </button>
                </div>

                {/* Content Area */}
                <div className="w-full">
                    {/* TAB 1: Voices (Container-less, responsive seamless rows) */}
                    {activeTab === 'voices' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                                {visibleVoices.map(v => {
                                    const isSelected = selectedVoice === v.id;
                                    const isFemale = v.gender === 'female';
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVoice(v.id)}
                                            className={`relative p-2.5 sm:p-3 rounded-2xl text-left transition-all flex flex-col gap-1.5 cursor-pointer group ${
                                                isSelected 
                                                    ? 'border-2 border-indigo-500 dark:border-indigo-400 bg-transparent shadow-xs scale-[1.01]' 
                                                    : 'border border-gray-200/80 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-transparent hover:bg-neutral-100/50 dark:hover:bg-white/[0.03]'
                                            }`}
                                        >
                                            {/* Top-Right Indicator Dot */}
                                            {isSelected && (
                                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 ring-2 ring-white dark:ring-[#0d0d10] shadow-xs" />
                                            )}

                                            {/* Top Row: Distinct Female / Male Outline Icon + Name + Gender + New */}
                                            <div className="flex items-center gap-2 min-w-0 w-full pr-3">
                                                <AppIcon 
                                                    name={isFemale ? "solar:woman-linear" : "solar:man-linear"} 
                                                    className={`w-5 h-5 shrink-0 transition-colors ${
                                                        isSelected 
                                                            ? isFemale ? 'text-pink-500 dark:text-pink-400' : 'text-indigo-500 dark:text-indigo-400'
                                                            : isFemale 
                                                                ? 'text-pink-400/80 group-hover:text-pink-500 dark:text-pink-400/70 dark:group-hover:text-pink-300' 
                                                                : 'text-neutral-400 group-hover:text-indigo-500 dark:text-neutral-500 dark:group-hover:text-indigo-400'
                                                    }`} 
                                                />

                                                <span className={`font-semibold text-xs sm:text-sm truncate ${
                                                    isSelected 
                                                        ? 'text-indigo-600 dark:text-indigo-400' 
                                                        : 'text-gray-900 dark:text-neutral-200 group-hover:text-gray-900 dark:group-hover:text-white'
                                                }`}>
                                                    {v.displayName}
                                                </span>

                                                <span className="text-[9px] text-gray-400 dark:text-white/40 uppercase tracking-wider font-mono shrink-0">
                                                    {v.gender}
                                                </span>

                                                {v.isNew && (
                                                    <span className="text-[8px] sm:text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1 py-0.2 rounded shrink-0">
                                                        New
                                                    </span>
                                                )}
                                            </div>

                                            {/* Bottom Row: Description starting cleanly from the left side under the icon */}
                                            <p className="text-[11px] sm:text-xs text-gray-500 dark:text-neutral-400 line-clamp-2 leading-snug w-full">
                                                {v.description}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                            
                            {voices.length > 9 && (
                                <div className="pt-2">
                                    <button 
                                        onClick={() => setShowMoreVoices(!showMoreVoices)} 
                                        className="py-1.5 px-3 text-xs font-medium text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span>{showMoreVoices ? 'Show fewer voices' : `Show all ${voices.length} voices`}</span>
                                        <AppIcon 
                                            name={showMoreVoices ? "solar:alt-arrow-up-linear" : "solar:alt-arrow-down-linear"} 
                                            className="h-3.5 w-3.5" 
                                        />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: Tones (Container-less minimal tiles, zero card box) */}
                    {activeTab === 'tones' && (
                        <div className="space-y-4">
                            {/* Inline Helper Text */}
                            <p className="text-xs text-neutral-500 dark:text-white/50 flex items-center gap-1.5">
                                <AppIcon name="solar:magic-stick-3-linear" className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Select a tone to subtly influence how the AI speaks. Tap the selected tone again to revert to neutral.</span>
                            </p>

                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                                {tones.map(tone => {
                                    const isSelected = selectedToneId === tone.id;
                                    return (
                                        <button
                                            key={tone.id}
                                            onClick={() => setVoiceModeToneInstruction(isSelected ? '' : tone.prompt)}
                                            className={`relative flex flex-col items-center justify-center py-3.5 px-2 rounded-2xl transition-all cursor-pointer group text-center ${
                                                isSelected 
                                                    ? 'border-2 border-indigo-500 dark:border-indigo-400 bg-transparent shadow-xs scale-[1.02]' 
                                                    : 'border border-gray-200/80 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-transparent hover:bg-neutral-100/50 dark:hover:bg-white/[0.03]'
                                            }`}
                                        >
                                            {/* Top-Right Indicator Dot */}
                                            {isSelected && (
                                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 ring-2 ring-white dark:ring-[#0d0d10] shadow-xs" />
                                            )}

                                            <AppIcon 
                                                name={tone.icon} 
                                                className={`w-6 h-6 mb-1.5 transition-transform duration-200 group-hover:scale-110 ${
                                                    isSelected 
                                                        ? 'text-indigo-600 dark:text-indigo-400' 
                                                        : 'text-neutral-400 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white'
                                                }`} 
                                            />
                                            <span className={`text-xs ${
                                                isSelected 
                                                    ? 'font-bold text-indigo-700 dark:text-indigo-300' 
                                                    : 'font-medium text-neutral-600 dark:text-neutral-300'
                                            }`}>
                                                {tone.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: Controls (Container-less rows with subtle dividing lines) */}
                    {activeTab === 'instructions' && (
                        <div className="space-y-1 divide-y divide-gray-200/60 dark:divide-white/10 max-w-2xl">
                            {/* Proactive Mode Toggle */}
                            <div className="py-4 flex items-center justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0 pr-2">
                                    <AppIcon name="solar:user-speak-linear" className="w-5 h-5 text-neutral-400 dark:text-neutral-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">Proactive Engagement</h3>
                                        <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                                            If enabled, the AI will gently re-engage you if you are silent for more than 15 seconds during a live session.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    role="switch"
                                    aria-checked={isProactiveModeEnabled}
                                    onClick={() => setIsVoiceProactiveMode(!isProactiveModeEnabled)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isProactiveModeEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-800'}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isProactiveModeEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>

                            {/* Audio Recording Toggle */}
                            <div className="py-4 flex items-center justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0 pr-2">
                                    <AppIcon name="solar:microphone-3-linear" className="w-5 h-5 text-neutral-400 dark:text-neutral-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">Record Audio</h3>
                                        <p className="text-xs text-gray-500 dark:text-neutral-400 leading-relaxed">
                                            If enabled, your voice conversations will be recorded and saved to your voice history for playback.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    role="switch"
                                    aria-checked={isAudioRecordingEnabled}
                                    onClick={() => setIsAudioRecordingEnabled(!isAudioRecordingEnabled)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAudioRecordingEnabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-800'}`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAudioRecordingEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                                    />
                                </button>
                            </div>

                            {/* Custom Instructions Input (Container-less, dark black) */}
                            <div className="pt-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AppIcon name="solar:tuning-square-2-linear" className="w-4 h-4 text-neutral-400 dark:text-neutral-400 shrink-0" />
                                        <label htmlFor="custom-instruction" className="text-sm font-semibold text-gray-900 dark:text-white">
                                            Custom System Instructions
                                        </label>
                                    </div>
                                    {customInstruction && (
                                        <button
                                            onClick={() => setCustomInstruction('')}
                                            className="text-xs text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <textarea
                                        id="custom-instruction"
                                        rows={6}
                                        value={customInstruction}
                                        onChange={(e) => setCustomInstruction(e.target.value)}
                                        placeholder="E.g., Speak slowly, always answer in Hindi, define technical terms..."
                                        className="w-full bg-white dark:bg-black border border-gray-200 dark:border-white/15 rounded-xl py-3 px-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-y shadow-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-white/50">
                                    These instructions are appended to the system prompt and override default conversational behavior.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default VoiceSettingsView;
