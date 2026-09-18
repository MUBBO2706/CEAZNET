// A singleton AudioContext to prevent creating multiple contexts, which is resource-intensive.
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
    // Re-create the context if it was closed.
    if (!audioContext || audioContext.state === 'closed') {
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.");
            return null;
        }
    }
    return audioContext;
};

/**
 * Plays a synthesized sound effect using the Web Audio API with an envelope.
 */
const playTone = (
    frequency: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.1
) => {
    const actx = getAudioContext();
    if (!actx) return;

    // Ensure the audio context is running
    if (actx.state === 'suspended') {
        actx.resume();
    }

    const oscillator = actx.createOscillator();
    const gainNode = actx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(actx.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Envelope
    // Attack
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
    // Decay/Release
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
};

/**
 * Plays a distinct, high-pitched sound to indicate a successful connection.
 * Uses a major triad arpeggio (C5 - E5 - G5 - C6) for a positive, uplifting feel.
 */
export const playConnectSound = () => {
    const actx = getAudioContext();
    if (!actx) return;
    const now = actx.currentTime;

    // Futuristic "Power Up" / "Success" Chime
    playTone(523.25, now, 0.4, 'sine', 0.15);       // C5
    playTone(659.25, now + 0.1, 0.4, 'sine', 0.15); // E5
    playTone(783.99, now + 0.2, 0.4, 'sine', 0.15); // G5
    playTone(1046.50, now + 0.3, 0.6, 'sine', 0.1); // C6
};

/**
 * Plays a lower-pitched sound to indicate disconnection.
 * Uses a rapid descending sequence ending on a deep root note for a "Session Complete" feel.
 */
export const playDisconnectSound = () => {
    const actx = getAudioContext();
    if (!actx) return;
    const now = actx.currentTime;

    // "Session Complete" / "Power Down" - A satisfying resolution
    playTone(783.99, now, 0.15, 'sine', 0.1);       // G5
    playTone(659.25, now + 0.08, 0.15, 'sine', 0.1); // E5
    playTone(523.25, now + 0.16, 0.15, 'sine', 0.1); // C5
    playTone(261.63, now + 0.24, 0.6, 'sine', 0.2);  // C4 (Deep root for finality)
};

/**
 * Plays a connecting ping sound.
 * @param isReverse If true, plays the tone in reverse (falling pitch). Otherwise, rising pitch.
 */
export const playConnectingPing = (isReverse: boolean = false) => {
    const actx = getAudioContext();
    if (!actx) return;
    const now = actx.currentTime;

    const startFreq = isReverse ? 880 : 440;
    const endFreq = isReverse ? 440 : 880;
    const duration = 0.3;

    const oscillator = actx.createOscillator();
    const gainNode = actx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(actx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(startFreq, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

    // Envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    oscillator.start(now);
    oscillator.stop(now + duration);
};

/**
 * Plays a calm, futuristic tone to indicate a search or data fetch operation.
 * Uses a gentle rising sweep with reverb-like decay.
 */
export const playSearchSound = () => {
    const actx = getAudioContext();
    if (!actx) return;
    const now = actx.currentTime;

    // "Searching" / "Processing" - Ethereal and calm
    // Layer 1: Fundamental
    playTone(440, now, 0.6, 'sine', 0.05); // A4
    
    // Layer 2: Harmonic shimmer
    const oscillator = actx.createOscillator();
    const gainNode = actx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(actx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now); // A5
    oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.5); // Sweep up to A6
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.03, now + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    oscillator.start(now);
    oscillator.stop(now + 0.6);
};

/**
 * Triggers haptic feedback (vibration) on supported devices.
 * @param pattern A number or array of numbers for the vibration pattern in milliseconds.
 */
export const triggerHapticFeedback = (pattern: number | number[] = 50) => {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            console.warn("Haptic feedback is not supported or permission denied.");
        }
    }
};
