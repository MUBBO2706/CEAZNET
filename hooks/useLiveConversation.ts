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

    // Keep active prop references in refs so callbacks never need to trigger re-renders or disconnects
    const voiceRef = useRef(voice);
    const instructionRef = useRef(instruction);
    const genderRef = useRef(gender);
    const isProactiveModeEnabledRef = useRef(isProactiveModeEnabled);
    const onSessionEndRef = useRef(onSessionEnd);
    const continuationContextRef = useRef(continuationContext);
    const isAudioRecordingEnabledRef = useRef(isAudioRecordingEnabled);
    const isMicMutedRef = useRef(isMicMuted);
    const isSpeakerMutedRef = useRef(isSpeakerMuted);

    useEffect(() => {
        voiceRef.current = voice;
        instructionRef.current = instruction;
        genderRef.current = gender;
        isProactiveModeEnabledRef.current = isProactiveModeEnabled;
        onSessionEndRef.current = onSessionEnd;
        continuationContextRef.current = continuationContext;
        isAudioRecordingEnabledRef.current = isAudioRecordingEnabled;
    }, [voice, instruction, gender, isProactiveModeEnabled, onSessionEnd, continuationContext, isAudioRecordingEnabled]);

    useEffect(() => {
        isMicMutedRef.current = isMicMuted;
        isSpeakerMutedRef.current = isSpeakerMuted;
    }, [isMicMuted, isSpeakerMuted]);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const isNewTurnRef = useRef(true);

    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const microphoneStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
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
        if (!isProactiveModeEnabledRef.current) {
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
    }, []);

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
    
    const cleanup = useCallback(async (isError = false, reason?: string) => {
        console.log(`[LiveConversation] EVENT: SESSION_TERMINATED | environment: ${process.env.NODE_ENV} | reason: ${reason || 'normal_cleanup'} | isError: ${isError}`);
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

        const onSessionEndCurrent = onSessionEndRef.current;
        if (onSessionEndCurrent && historyToSave.length > 0) {
            // Await the session end callback to ensure data is saved before proceeding
            await onSessionEndCurrent(historyToSave, audioBlob);
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
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
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
        if (!isError) {
            setStatus('disconnected');
        }
    }, [stopMasterAudioAnalysis]);

    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent) => {
            console.error(`[LiveConversation] EVENT: UNHANDLED_ERROR | environment: ${process.env.NODE_ENV} | message: ${event.message}`);
        };
        const handleGlobalRejection = (event: PromiseRejectionEvent) => {
            console.error(`[LiveConversation] EVENT: UNHANDLED_REJECTION | environment: ${process.env.NODE_ENV} | reason:`, event.reason);
        };
        
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleGlobalRejection);
        
        return () => {
            window.removeEventListener('error', handleGlobalError);
            window.removeEventListener('unhandledrejection', handleGlobalRejection);
            console.log(`[LiveConversation] EVENT: COMPONENT_UNMOUNT | environment: ${process.env.NODE_ENV} | Triggering cleanup`);
            // We cannot await in the cleanup function of useEffect, but we trigger it.
            // For navigation triggered cleanup, the parent component should handle the await via handleStop if needed.
            cleanup(true, 'component_unmount'); 
        };
    }, [cleanup]);

    const handleStart = useCallback(async () => {
        console.log(`[LiveConversation] EVENT: LIVE_CONVERSATION_START | environment: ${process.env.NODE_ENV}`);
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
            const audioConstraints: MediaTrackConstraints = {
                echoCancellation: { ideal: true },
                noiseSuppression: { ideal: true },
                autoGainControl: { ideal: true },
                channelCount: { ideal: 1 },
                ...({
                    googEchoCancellation: { ideal: true },
                    googAutoGainControl: { ideal: true },
                    googNoiseSuppression: { ideal: true },
                    googHighpassFilter: { ideal: true },
                    googTypingNoiseDetection: { ideal: true }
                } as any)
            };
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            microphoneStreamRef.current = stream;

            const ai = getAiClient();
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            outputNodeRef.current = outputAudioContextRef.current.createGain();
            outputNodeRef.current.gain.value = isSpeakerMutedRef.current ? 0 : 1;
            outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
            outputAnalyserRef.current.fftSize = 512;
            outputAnalyserRef.current.connect(outputNodeRef.current);
            outputNodeRef.current.connect(outputAudioContextRef.current.destination);
            
            // --- Setup Clean Dual-Source Recording Pipeline ---
            if (isAudioRecordingEnabledRef.current) {
                const recorderDest = outputAudioContextRef.current.createMediaStreamDestination();
                
                // 1. Connect Model (AI Agent) Output to Recorder with 100% pristine digital fidelity
                outputNodeRef.current.connect(recorderDest);
                
                // 2. Connect Filtered & Gated User Microphone to Recorder
                let micRecGainNode: GainNode | null = null;
                if (microphoneStreamRef.current) {
                    const micSource = outputAudioContextRef.current.createMediaStreamSource(microphoneStreamRef.current);
                    
                    // High-pass filter to cut table thumps, AC rumble, sub-bass noise
                    const recHighpass = outputAudioContextRef.current.createBiquadFilter();
                    recHighpass.type = 'highpass';
                    recHighpass.frequency.setValueAtTime(100, outputAudioContextRef.current.currentTime);
                    recHighpass.Q.setValueAtTime(0.707, outputAudioContextRef.current.currentTime);

                    // Low-pass filter to eliminate high-frequency hiss, coil whine, electrical noise
                    const recLowpass = outputAudioContextRef.current.createBiquadFilter();
                    recLowpass.type = 'lowpass';
                    recLowpass.frequency.setValueAtTime(7800, outputAudioContextRef.current.currentTime);
                    recLowpass.Q.setValueAtTime(0.707, outputAudioContextRef.current.currentTime);

                    // Vocal presence peak EQ (+2dB at 2.8kHz) for crystal-clear vocal articulation
                    const recPresence = outputAudioContextRef.current.createBiquadFilter();
                    recPresence.type = 'peaking';
                    recPresence.frequency.setValueAtTime(2800, outputAudioContextRef.current.currentTime);
                    recPresence.gain.setValueAtTime(2.0, outputAudioContextRef.current.currentTime);
                    recPresence.Q.setValueAtTime(1.0, outputAudioContextRef.current.currentTime);

                    // Gentle vocal leveling compressor
                    const recCompressor = outputAudioContextRef.current.createDynamicsCompressor();
                    recCompressor.threshold.setValueAtTime(-18, outputAudioContextRef.current.currentTime);
                    recCompressor.knee.setValueAtTime(8, outputAudioContextRef.current.currentTime);
                    recCompressor.ratio.setValueAtTime(2.5, outputAudioContextRef.current.currentTime);
                    recCompressor.attack.setValueAtTime(0.005, outputAudioContextRef.current.currentTime);
                    recCompressor.release.setValueAtTime(0.08, outputAudioContextRef.current.currentTime);

                    // Dedicated Ducking & Noise Gate Gain Node for User Mic in Recording
                    micRecGainNode = outputAudioContextRef.current.createGain();
                    micRecGainNode.gain.setValueAtTime(isMicMutedRef.current ? 0 : 1.0, outputAudioContextRef.current.currentTime);

                    micSource.connect(recHighpass);
                    recHighpass.connect(recLowpass);
                    recLowpass.connect(recPresence);
                    recPresence.connect(recCompressor);
                    recCompressor.connect(micRecGainNode);
                    micRecGainNode.connect(recorderDest);
                }
                
                // Select optimal audio format and high-bitrate Opus encoding
                let recorderMimeType = '';
                if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
                    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                        recorderMimeType = 'audio/webm;codecs=opus';
                    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                        recorderMimeType = 'audio/webm';
                    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                        recorderMimeType = 'audio/mp4';
                    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                        recorderMimeType = 'audio/ogg;codecs=opus';
                    }
                }

                const recorderOptions: MediaRecorderOptions = {
                    audioBitsPerSecond: 128000,
                    ...(recorderMimeType ? { mimeType: recorderMimeType } : {})
                };

                const recorder = new MediaRecorder(recorderDest.stream, recorderOptions);
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
                sessionStartTimeRef.current = Date.now();
                if (outputAudioContextRef.current) {
                    recordingStartCtxTimeRef.current = outputAudioContextRef.current.currentTime;
                }
            }
            // -----------------------

            const basePersona = getVoicePersonaContext(genderRef.current);
            const continuationInstruction = continuationContextRef.current
                ? `[PREVIOUS CONVERSATION HISTORY FOR CONTEXT]\n${continuationContextRef.current}\n[END HISTORY]\nYou are now continuing this conversation.`
                : '';
            
            const fullSystemInstruction = [
                basePersona,
                continuationInstruction,
                instructionRef.current ? `[Additional User Instructions]\n${instructionRef.current}` : ''
            ].filter(Boolean).join('\n\n');

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                callbacks: {
                    onopen: async () => {
                        console.log(`[LiveConversation] EVENT: CONNECTION_OPEN | environment: ${process.env.NODE_ENV}`);
                        playConnectSound();
                        triggerHapticFeedback();
                        setStatus('listening');
                        resetSilenceTimerRef.current();
                        if (!inputAudioContextRef.current || !microphoneStreamRef.current) return;
                        const source = inputAudioContextRef.current.createMediaStreamSource(microphoneStreamRef.current);
                        
                        // Professional DSP Filter Chain for Clean Mic Input
                        const inputHighpass = inputAudioContextRef.current.createBiquadFilter();
                        inputHighpass.type = 'highpass';
                        inputHighpass.frequency.setValueAtTime(100, inputAudioContextRef.current.currentTime);
                        inputHighpass.Q.setValueAtTime(0.707, inputAudioContextRef.current.currentTime);

                        const inputLowpass = inputAudioContextRef.current.createBiquadFilter();
                        inputLowpass.type = 'lowpass';
                        inputLowpass.frequency.setValueAtTime(7800, inputAudioContextRef.current.currentTime);
                        inputLowpass.Q.setValueAtTime(0.707, inputAudioContextRef.current.currentTime);

                        const inputPresence = inputAudioContextRef.current.createBiquadFilter();
                        inputPresence.type = 'peaking';
                        inputPresence.frequency.setValueAtTime(2800, inputAudioContextRef.current.currentTime);
                        inputPresence.gain.setValueAtTime(2.0, inputAudioContextRef.current.currentTime);
                        inputPresence.Q.setValueAtTime(1.0, inputAudioContextRef.current.currentTime);

                        const inputCompressor = inputAudioContextRef.current.createDynamicsCompressor();
                        inputCompressor.threshold.setValueAtTime(-18, inputAudioContextRef.current.currentTime);
                        inputCompressor.knee.setValueAtTime(8, inputAudioContextRef.current.currentTime);
                        inputCompressor.ratio.setValueAtTime(2.5, inputAudioContextRef.current.currentTime);
                        inputCompressor.attack.setValueAtTime(0.005, inputAudioContextRef.current.currentTime);
                        inputCompressor.release.setValueAtTime(0.08, inputAudioContextRef.current.currentTime);

                        micGainNodeRef.current = inputAudioContextRef.current.createGain();
                        micGainNodeRef.current.gain.value = isMicMutedRef.current ? 0 : 1;

                        micAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
                        micAnalyserRef.current.fftSize = 512;
                        audioDataArrayRef.current = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
                        
                        // Route: Mic -> Highpass (100Hz) -> Lowpass (7.8kHz) -> Presence EQ (+2dB @ 2.8kHz) -> Compressor -> Gain -> Analyser
                        source.connect(inputHighpass);
                        inputHighpass.connect(inputLowpass);
                        inputLowpass.connect(inputPresence);
                        inputPresence.connect(inputCompressor);
                        inputCompressor.connect(micGainNodeRef.current);
                        micGainNodeRef.current.connect(micAnalyserRef.current);

                        // State for Smooth Glitch-Free Noise Expander & Envelope Tracking
                        let currentSmoothedGain = 0.0;
                        let smoothedEnvelope = 0.0;
                        let dynamicNoiseFloor = 0.003;
                        let speechHoldRemainingSamples = 0;
                        const SAMPLE_RATE = 16000;
                        const HOLD_DURATION_SAMPLES = Math.floor(SAMPLE_RATE * 0.28); // 280ms hold time prevents syllable clipping

                        const handleAudioProcess = (inputData: Float32Array) => {
                            const len = inputData.length;
                            const processedData = new Float32Array(len);

                            // Alpha coefficients for smooth, click-free sample envelope tracking
                            const attackAlpha = 0.04;    // ~3ms instant attack on speech onset
                            const releaseAlpha = 0.0015; // ~150ms smooth envelope release
                            const gainSlewAlpha = 0.025;  // Sample-accurate smooth gain transition (eliminates pops/clicks)

                            let blockHasVoice = false;

                            for (let i = 0; i < len; i++) {
                                const sample = inputData[i];
                                const absSample = Math.abs(sample);

                                // Envelope tracking
                                if (absSample > smoothedEnvelope) {
                                    smoothedEnvelope += (absSample - smoothedEnvelope) * attackAlpha;
                                } else {
                                    smoothedEnvelope += (absSample - smoothedEnvelope) * releaseAlpha;
                                }

                                // Dynamic noise floor adaptation
                                if (smoothedEnvelope < dynamicNoiseFloor) {
                                    dynamicNoiseFloor = dynamicNoiseFloor * 0.998 + smoothedEnvelope * 0.002;
                                } else {
                                    dynamicNoiseFloor = dynamicNoiseFloor * 0.99995 + smoothedEnvelope * 0.00005;
                                }

                                // Adaptive speech threshold: strictly above background noise floor
                                const speechThreshold = Math.max(0.004, dynamicNoiseFloor * 2.4);

                                if (smoothedEnvelope > speechThreshold) {
                                    speechHoldRemainingSamples = HOLD_DURATION_SAMPLES;
                                    blockHasVoice = true;
                                } else if (speechHoldRemainingSamples > 0) {
                                    speechHoldRemainingSamples--;
                                    blockHasVoice = true;
                                }

                                // Slew-rate smoothed target gain: 1.0 during speech/hold, 0.0005 (-66dB silent floor) during background noise
                                const targetGain = (speechHoldRemainingSamples > 0) ? 1.0 : 0.0005;
                                currentSmoothedGain += (targetGain - currentSmoothedGain) * gainSlewAlpha;

                                // Output processed sample
                                processedData[i] = sample * currentSmoothedGain;
                            }

                            if (blockHasVoice) {
                                resetSilenceTimerRef.current();
                                if (!lastSpeechDetectedTimestampRef.current) {
                                    lastSpeechDetectedTimestampRef.current = Date.now();
                                }
                            }

                            const pcmBlob = {
                                data: encode(new Uint8Array(new Int16Array(processedData.map(x => Math.max(-1, Math.min(1, x)) * 32767)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ audio: pcmBlob });
                            });
                        };

                        // Check if AudioWorklet is supported
                        if (inputAudioContextRef.current.audioWorklet) {
                            try {
                                const workletCode = `
                                    class AudioProcessor extends AudioWorkletProcessor {
                                        constructor() {
                                            super();
                                            this.bufferSize = 1024;
                                            this.buffer = new Float32Array(this.bufferSize);
                                            this.bufferIndex = 0;
                                        }
                                        process(inputs, outputs, parameters) {
                                            const input = inputs[0];
                                            if (input && input.length > 0) {
                                                const channelData = input[0];
                                                for (let i = 0; i < channelData.length; i++) {
                                                    this.buffer[this.bufferIndex++] = channelData[i];
                                                    if (this.bufferIndex >= this.bufferSize) {
                                                        this.port.postMessage(this.buffer);
                                                        this.buffer = new Float32Array(this.bufferSize);
                                                        this.bufferIndex = 0;
                                                    }
                                                }
                                            }
                                            return true;
                                        }
                                    }
                                    registerProcessor('audio-processor', AudioProcessor);
                                `;
                                const blob = new Blob([workletCode], { type: 'application/javascript' });
                                const workletUrl = URL.createObjectURL(blob);
                                await inputAudioContextRef.current.audioWorklet.addModule(workletUrl);
                                
                                const workletNode = new AudioWorkletNode(inputAudioContextRef.current, 'audio-processor');
                                workletNodeRef.current = workletNode;
                                
                                workletNode.port.onmessage = (event) => {
                                    handleAudioProcess(event.data);
                                };
                                
                                micAnalyserRef.current.connect(workletNode);
                                workletNode.connect(inputAudioContextRef.current.destination);
                                return; // Successfully set up worklet
                            } catch (e) {
                                console.warn("AudioWorklet initialization failed, falling back to ScriptProcessorNode:", e);
                            }
                        }

                        // Fallback to ScriptProcessorNode (2048 samples for low latency & smooth audio)
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(2048, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;
                        
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            handleAudioProcess(inputData);
                        };
                        
                        micAnalyserRef.current.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);
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
                        console.error('[LiveConversation] EVENT: CONNECTION_ERROR | environment:', process.env.NODE_ENV, '| Error:', e);
                        // The actual error details for WebSockets are usually in the browser console, but we capture what we can
                        const errorMessage = (e as any).message || 'WebSocket connection error';
                        setError(`Connection error: ${errorMessage}. Please check console logs.`);
                        setStatus('error');
                        cleanup(true, 'websocket_onerror');
                    },
                    onclose: (e: CloseEvent) => {
                        console.log(`[LiveConversation] EVENT: SESSION_CLOSED | environment: ${process.env.NODE_ENV} | code: ${e.code} | reason: ${e.reason} | wasClean: ${e.wasClean}`);
                        
                        if (!e.wasClean || e.code !== 1000) {
                            setError(`Connection closed abnormally (Code: ${e.code}). ${e.reason || 'No reason provided.'}`);
                            setStatus('error');
                            cleanup(true, `websocket_onclose_error_code_${e.code}`);
                        } else {
                            cleanup(false, `websocket_onclose_code_${e.code}_${e.reason}`);
                        }
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceRef.current || 'Zephyr' } } },
                    systemInstruction: fullSystemInstruction,
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                    tools: [{ googleSearch: {} }],
                },
            });

        } catch (err: any) {
            console.error('[LiveConversation] EVENT: START_FAILED | environment:', process.env.NODE_ENV, '| err:', err);
            const errorMessage = err?.message || 'Could not access microphone. Please grant permission and try again.';
            setError(errorMessage.includes('API key') ? errorMessage : 'Connection failed. Please check permissions and try again.');
            setStatus('error');
            cleanup(true, 'start_exception');
        }
    }, [cleanup]);

    const handleStop = useCallback(async () => {
        await cleanup(false, 'manual_stop');
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