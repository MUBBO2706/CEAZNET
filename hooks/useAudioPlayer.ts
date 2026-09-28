import { useState, useRef, useCallback, useEffect } from 'react';
import { decode, decodeAudioData } from '../utils/audioUtils';

export interface AudioPlayerState {
  messageId: string | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  currentTime: number;
}

export const useAudioPlayer = () => {
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    messageId: null,
    isPlaying: false,
    progress: 0,
    duration: 0,
    currentTime: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioStartContextTimeRef = useRef(0);
  const audioStartOffsetRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const audioBase64Ref = useRef<string | null>(null);

  const stop = useCallback((resetState = true) => {
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch(e) {}
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (resetState) {
        setPlayerState({ messageId: null, isPlaying: false, progress: 0, duration: 0, currentTime: 0 });
        audioBufferRef.current = null;
        audioBase64Ref.current = null;
        audioStartOffsetRef.current = 0;
    }
  }, []);

  const play = useCallback(async (messageId: string, audioBase64: string, offset = 0) => {
    stop(false);
    
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const audioContext = audioContextRef.current;
    if (audioContext.state === 'suspended') await audioContext.resume();

    if (audioBase64 !== audioBase64Ref.current) {
        const audioBytes = decode(audioBase64);
        audioBufferRef.current = await decodeAudioData(audioBytes, audioContext, 24000, 1);
        audioBase64Ref.current = audioBase64;
    }

    const audioBuffer = audioBufferRef.current;
    if (!audioBuffer) return;

    sourceRef.current = audioContext.createBufferSource();
    sourceRef.current.buffer = audioBuffer;
    sourceRef.current.connect(audioContext.destination);

    audioStartContextTimeRef.current = audioContext.currentTime;
    audioStartOffsetRef.current = offset;
    sourceRef.current.start(0, offset);

    setPlayerState({
        messageId,
        isPlaying: true,
        duration: audioBuffer.duration,
        currentTime: offset,
        progress: audioBuffer.duration > 0 ? offset / audioBuffer.duration : 0,
    });
    
    sourceRef.current.onended = () => {
        if (sourceRef.current) {
            stop(true);
        }
    };

    const updateProgress = () => {
        if (!sourceRef.current || !audioBufferRef.current || !audioContextRef.current) return;
        
        const currentTime = audioStartOffsetRef.current + (audioContextRef.current.currentTime - audioStartContextTimeRef.current);
        if (currentTime >= audioBufferRef.current.duration) {
            // onended will handle cleanup
        } else {
            setPlayerState(prev => ({
                ...prev,
                currentTime,
                progress: prev.duration > 0 ? currentTime / prev.duration : 0,
            }));
            animationFrameIdRef.current = requestAnimationFrame(updateProgress);
        }
    };
    animationFrameIdRef.current = requestAnimationFrame(updateProgress);

  }, [stop]);

  const pause = useCallback(() => {
    if (!audioContextRef.current) return;
    const elapsed = audioContextRef.current.currentTime - audioStartContextTimeRef.current;
    const newOffset = audioStartOffsetRef.current + elapsed;
    stop(false);
    setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: newOffset }));
    audioStartOffsetRef.current = newOffset; // store for resume
  }, [stop]);
  
  const seek = useCallback((progress: number) => {
    if (!audioBufferRef.current || !playerState.messageId || !audioBase64Ref.current) return;
    const newTime = audioBufferRef.current.duration * progress;
    play(playerState.messageId, audioBase64Ref.current, newTime);
  }, [playerState.messageId, play]);


  const togglePlayPause = useCallback((messageId: string, audioBase64: string) => {
    if (playerState.messageId === messageId) {
        if (playerState.isPlaying) {
            pause();
        } else {
            play(messageId, audioBase64, audioStartOffsetRef.current);
        }
    } else {
        play(messageId, audioBase64);
    }
  }, [playerState, play, pause]);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { playerState, togglePlayPause, seek, close: stop };
};
