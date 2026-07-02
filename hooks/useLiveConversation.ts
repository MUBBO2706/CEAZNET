import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, GroundingChunk, FunctionDeclaration, Type } from '@google/genai';
import { getAiClient } from '../services/aiClient';
import { VoiceName, EmailPreviewData, TranscriptMessage } from '../types';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { getVoicePersonaContext } from '../services/voicePersonaService';
import { playConnectSound, playDisconnectSound, triggerHapticFeedback } from '../utils/feedbackUtils';

export type Status = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'error' | 'processing_text';

interface UseLiveConversationProps {
    voice: string;
    instruction: string;
    gender: 'male' | 'female';
    isProactiveModeEnabled: boolean;
    onSessionEnd?: (transcript: TranscriptMessage[], audioBlob?: Blob) => void;
    continuationContext?: string;
    isAudioRecordingEnabled?: boolean;
}

export const useLiveConversation = ({ voice, instruction, gender, isProactiveModeEnabled, onSessionEnd, continuationContext, isAudioRecordingEnabled = true }: UseLiveConversationProps) => {
    const [status, setStatus] = useState<Status>('disconnected');
    const [aiTranscript, setAiTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [sources, setSources] = useState<GroundingChunk[] | null>(null);
    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const isNewTurnRef = useRef(true);

    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const micAnalyserRef = useRef<AnalyserNode | null>(null);
    const micGainNodeRef = useRef<GainNode | null>(null);
    const outputAnalyserRef = useRef<AnalyserNode | null>(null);
    const audioDataArrayRef = useRef<Uint8Array | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);

    const outputNodeRef = useRef<GainNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const outputSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const statusRef = useRef(status);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // For saving transcript
    const transcriptionHistoryRef = useRef<TranscriptMessage[]>([]);
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const currentOutputAudioChunksRef = useRef<string[]>([]);
    
    // Timing refs
    const sessionStartTimeRef = useRef<number>(0);
    const currentTurnStartTimeRef = useRef<number | null>(null);
    const recordingStartCtxTimeRef = useRef<number>(0);
    const lastSpeechDetectedTimestampRef = useRef<number | null>(null);


    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);


    const toggleMicMute = useCallback(() => {
        setIsMicMuted(prev => {
            const newMutedState = !prev;
            if (micGainNodeRef.current && inputAudioContextRef.current) {
                micGainNodeRef.current.gain.setValueAtTime(newMutedState ? 0 : 1, inputAudioContextRef.current.currentTime);
            }
            return newMutedState;
        });
    }, []);

    const toggleSpeakerMute = useCallback(() => {
        setIsSpeakerMuted(prev => {
            const newMutedState = !prev;
            if (outputNodeRef.current && outputAudioContextRef.current) {
                outputNodeRef.current.gain.setValueAtTime(newMutedState ? 0 : 1, outputAudioContextRef.current.currentTime);
            }
            return newMutedState;
        });
    }, []);

    const stopMasterAudioAnalysis = useCallback(() => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        setAudioLevel(0);
    }, []);
    
    const resetSilenceTimer = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }
        if (!isProactiveModeEnabled) {
            return;
        }
        silenceTimerRef.current = setTimeout(() => {
            // Check refs to get latest state inside timeout
            if (statusRef.current !== 'listening' || !sessionPromiseRef.current) return;
    
            const proactivePrompt = "[SYSTEM_TRIGGER] The user has been silent for 15 seconds. Proactively and dynamically re-engage them in a friendly, natural, and brief way. Your response must be varied and not sound robotic. Keep it short and conversational.";
        
            sessionPromiseRef.current.then(session => {
                session.sendRealtimeInput({ text: proactivePrompt });
            });
        }, 15000); // 15 seconds
    }, [isProactiveModeEnabled]);

    const resetSilenceTimerRef = useRef(resetSilenceTimer);
    useEffect(() => {
        resetSilenceTimerRef.current = resetSilenceTimer;
    }, [resetSilenceTimer]);

    useEffect(() => {
        const loop = () => {
            const currentStatus = statusRef.current;
            let activeAnalyser = null;
            
            if (currentStatus === 'listening') {
                activeAnalyser = micAnalyserRef.current;
            } else if (currentStatus === 'speaking') {
                activeAnalyser = outputAnalyserRef.current;
            }

            if (activeAnalyser && audioDataArrayRef.current) {
                activeAnalyser.getByteTimeDomainData(audioDataArrayRef.current);
                let sumSquares = 0.0;
                for (const amplitude of audioDataArrayRef.current) {
                    const v = (amplitude / 128.0) - 1.0;
                    sumSquares += v * v;
                }
                const rms = Math.sqrt(sumSquares / audioDataArrayRef.current.length);
                setAudioLevel(prev => prev * 0.8 + rms * 0.2);
            } else {
                 setAudioLevel(prev => prev * 0.8);
            }
            animationFrameIdRef.current = requestAnimationFrame(loop);
        };

        if (status === 'listening' || status === 'speaking') {
            animationFrameIdRef.current = requestAnimationFrame(loop);
        } else {
            stopMasterAudioAnalysis();
        }

        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, [status, stopMasterAudioAnalysis]);
    
    const cleanup = useCallback(async (isError = false) => {
        let audioBlob: Blob | undefined;
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.requestData();
            mediaRecorderRef.current.stop();
            // Create blob from accumulated chunks
            if (audioChunksRef.current.length > 0) {
                audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            }
        } else if (audioChunksRef.current.length > 0) {
            // If already stopped but we have chunks
            audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        }

        const historyToSave = [...transcriptionHistoryRef.current];
        transcriptionHistoryRef.current = [];
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;

        if (onSessionEnd && historyToSave.length > 0) {
            // Await the session end callback to ensure data is saved before proceeding
            await onSessionEnd(historyToSave, audioBlob);
        }
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';

        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (!isError && statusRef.current !== 'disconnected') {
            playDisconnectSound();
            triggerHapticFeedback();
        }
        stopMasterAudioAnalysis();
        if (microphoneStreamRef.current) {
            microphoneStreamRef.current.getTracks().forEach(track => track.stop());
            microphoneStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            await inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            await outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.error("Error closing session:", e);
            } finally {
                sessionPromiseRef.current = null;
            }
        }
        outputSourcesRef.current.forEach(source => source.stop());
        outputSourcesRef.current.clear();
        setIsMicMuted(false);
        setIsSpeakerMuted(false);
        setStatus('disconnected');
    }, [stopMasterAudioAnalysis, onSessionEnd]);

    useEffect(() => {
        return () => {
            // We cannot await in the cleanup function of useEffect, but we trigger it.
            // For navigation triggered cleanup, the parent component should handle the await via handleStop if needed.
            cleanup(true); 
        };
    }, [cleanup]);

    const handleStart = useCallback(async () => {
        setError(null);
        setStatus('connecting');
        setAiTranscript('');
        nextStartTimeRef.current = 0;
        isNewTurnRef.current = true;
        transcriptionHistoryRef.current = [];
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';
        currentTurnStartTimeRef.current = null;
        lastSpeechDetectedTimestampRef.current = null;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphoneStreamRef.current = stream;

            const ai = getAiClient();
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            outputNodeRef.current = outputAudioContextRef.current.createGain();
            outputNodeRef.current.gain.value = isSpeakerMuted ? 0 : 1;
            outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
            outputAnalyserRef.current.fftSize = 512;
            outputAnalyserRef.current.connect(outputNodeRef.current);
            outputNodeRef.current.connect(outputAudioContextRef.current.destination);
            
            // --- Setup Recording ---
            if (isAudioRecordingEnabled) {
                const recorderDest = outputAudioContextRef.current.createMediaStreamDestination();
                
                // Connect Model Output to Recorder
                outputNodeRef.current.connect(recorderDest);
                
                // Connect Mic to Recorder (create a new source in this context)
                if (microphoneStreamRef.current) {
                    const micSource = outputAudioContextRef.current.createMediaStreamSource(microphoneStreamRef.current);
                    micSource.connect(recorderDest);
                }
                
                const recorder = new MediaRecorder(recorderDest.stream);
                audioChunksRef.current = [];
                
                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };
                recorder.start(1000); // Collect chunks every second
                
                // CRITICAL: Set start times exactly when recording begins to sync audio with timestamps
                sessionStartTimeRef.current = Date.now();
                recordingStartCtxTimeRef.current = outputAudioContextRef.current.currentTime;
                
                mediaRecorderRef.current = recorder;
            } else {
                // Fallback if recording is disabled (though logic mainly relies on it being enabled for history)
                sessionStartTimeRef.current = Date.now();
                if (outputAudioContextRef.current) {
                    recordingStartCtxTimeRef.current = outputAudioContextRef.current.currentTime;
                }
            }
            // -----------------------

            const basePersona = getVoicePersonaContext(gender);
            const continuationInstruction = continuationContext
                ? `[PREVIOUS CONVERSATION HISTORY FOR CONTEXT]\n${continuationContext}\n[END HISTORY]\nYou are now continuing this conversation.`
                : '';
            
            const fullSystemInstruction = [
                basePersona,
                continuationInstruction,
                instruction ? `[Additional User Instructions]\n${instruction}` : ''
            ].filter(Boolean).join('\n\n');

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        playConnectSound();
                        triggerHapticFeedback();
                        setStatus('listening');
                        resetSilenceTimerRef.current();
                        if (!inputAudioContextRef.current || !microphoneStreamRef.current) return;
                        const source = inputAudioContextRef.current.createMediaStreamSource(microphoneStreamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        micGainNodeRef.current = inputAudioContextRef.current.createGain();
                        micGainNodeRef.current.gain.value = isMicMuted ? 0 : 1;

                        micAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
                        micAnalyserRef.current.fftSize = 512;
                        audioDataArrayRef.current = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
                        
                        source.connect(micGainNodeRef.current);
                        micGainNodeRef.current.connect(micAnalyserRef.current);
                        micAnalyserRef.current.connect(scriptProcessorRef.current);

                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

                            let sumSquares = 0.0;
                            for (const amplitude of inputData) {
                                sumSquares += amplitude * amplitude;
                            }
                            const rms = Math.sqrt(sumSquares / inputData.length);
                            if (rms > 0.01) { // Threshold for speech detection
                                resetSilenceTimerRef.current();
                                // Capture the time of speech detection for precise user-turn timestamping
                                if (!lastSpeechDetectedTimestampRef.current) {
                                     lastSpeechDetectedTimestampRef.current = Date.now();
                                }
                            } else {
                                // Reset if silence persists for a bit? No, we want the *start* of the phrase.
                                // Actually, we should only reset this when a turn completes or we consume it.
                            }

                            const pcmBlob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32767)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const interrupted = message.serverContent?.interrupted;
                        if (interrupted) {
                            for (const source of outputSourcesRef.current.values()) {
                                source.stop();
                                outputSourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }

                        if (message.serverContent?.inputTranscription) {
                            if (currentInputTranscriptionRef.current === '' && isNewTurnRef.current) {
                                // First transcription for this user turn
                                // Use VAD timestamp if available and recent (< 3s), otherwise current time
                                const now = Date.now();
                                const vadTime = lastSpeechDetectedTimestampRef.current;
                                const speechStart = (vadTime && (now - vadTime < 3000)) ? vadTime : now;
                                
                                currentTurnStartTimeRef.current = Math.max(0, (speechStart - sessionStartTimeRef.current) / 1000);
                            }
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            setStatus('speaking');
                            resetSilenceTimerRef.current();
                            currentOutputAudioChunksRef.current.push(base64Audio);

                            const outputAudioContext = outputAudioContextRef.current;
                            const outputAnalyser = outputAnalyserRef.current;
                            if (!outputAudioContext || !outputAnalyser) return;

                            // Calculate precise start time based on AudioContext scheduling
                            // If nextStartTime is in the past (or 0), we play immediately at currentTime
                            const playTime = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                            
                            if (currentOutputAudioChunksRef.current.length === 1) {
                                // First audio chunk for this model turn
                                // Map AudioContext time to Session time
                                const relativeStartTime = playTime - recordingStartCtxTimeRef.current;
                                currentTurnStartTimeRef.current = Math.max(0, relativeStartTime);
                            }

                            nextStartTimeRef.current = playTime; // Ensure we schedule from here
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAnalyser);
                            source.addEventListener('ended', () => {
                                outputSourcesRef.current.delete(source);
                                if (outputSourcesRef.current.size === 0) {
                                    setStatus('listening');
                                }
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            outputSourcesRef.current.add(source);
                        }

                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            currentOutputTranscriptionRef.current += text;
                            if (isNewTurnRef.current) {
                                setAiTranscript(text);
                                isNewTurnRef.current = false;
                            } else {
                                setAiTranscript(prev => prev + text);
                            }
                        }

                        const groundingMetadata = (message.serverContent?.modelTurn as any)?.groundingMetadata;
                        if (groundingMetadata?.groundingChunks) {
                            setSources(prev => [...(prev || []), ...groundingMetadata.groundingChunks]);
                        }

                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current;
                            const fullOutput = currentOutputTranscriptionRef.current;
                            const endTime = (Date.now() - sessionStartTimeRef.current) / 1000;
                            const startTime = currentTurnStartTimeRef.current ?? (endTime - 1); // Fallback if start missed

                            if (fullInput.trim()) {
                                transcriptionHistoryRef.current.push({ 
                                    role: 'user', 
                                    text: fullInput.trim(), 
                                    id: crypto.randomUUID(),
                                    startTime: startTime,
                                    endTime: endTime
                                });
                            }
                            if (fullOutput.trim()) {
                                transcriptionHistoryRef.current.push({ 
                                    role: 'model', 
                                    text: fullOutput.trim(), 
                                    id: crypto.randomUUID(),
                                    audioChunks: [...currentOutputAudioChunksRef.current],
                                    startTime: startTime,
                                    endTime: endTime
                                });
                            }
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                            currentOutputAudioChunksRef.current = [];
                            currentTurnStartTimeRef.current = null;
                            lastSpeechDetectedTimestampRef.current = null;

                            resetSilenceTimerRef.current();
                            isNewTurnRef.current = true;
                            setSources(null);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError('Connection error. Please try again.');
                        setStatus('error');
                        cleanup(true);
                    },
                    onclose: (e: CloseEvent) => {
                        cleanup();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
                    systemInstruction: fullSystemInstruction,
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                    tools: [{ googleSearch: {} }],
                },
            });

        } catch (err) {
            console.error('Failed to start conversation:', err);
            setError('Could not access microphone. Please grant permission and try again.');
            setStatus('error');
            cleanup(true);
        }
    }, [voice, instruction, gender, cleanup, isMicMuted, isSpeakerMuted, resetSilenceTimerRef, isProactiveModeEnabled, continuationContext, isAudioRecordingEnabled]);

    const handleStop = useCallback(async () => {
        await cleanup();
    }, [cleanup]);

    const handleSendText = useCallback(async (text: string) => {
        if (!text.trim() || !sessionPromiseRef.current) {
            console.warn("Cannot send text: no active session or empty text.");
            return;
        }
    
        setStatus('processing_text');
        triggerHapticFeedback();
        
        // The AI's response to the text will be a new turn.
        isNewTurnRef.current = true;
        
        // Add user text to transcript immediately
        currentInputTranscriptionRef.current += text;
    
        try {
            const session = await sessionPromiseRef.current;
            session.sendRealtimeInput({ text });
            // The onmessage callback will handle the transition to 'speaking'.
        } catch (e) {
            console.error("Failed to send text input to live session:", e);
            setError("Failed to send text message.");
            setStatus('error');
        }
    }, [setError]);

    const isSessionActive = status !== 'disconnected' && status !== 'error';

    return {
        status,
        aiTranscript,
        error,
        audioLevel,
        sources,
        handleStart,
        handleStop,
        isSessionActive,
        isMicMuted,
        isSpeakerMuted,
        toggleMicMute,
        toggleSpeakerMute,
        handleSendText,
    };
};