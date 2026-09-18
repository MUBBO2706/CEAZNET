import React, { useEffect, useRef, useState } from 'react';
import { Status } from '../hooks/useLiveConversation';

interface AvatarProps {
    audioLevel: number;
    status: Status;
}

const Avatar: React.FC<AvatarProps> = ({ audioLevel, status }) => {
    const [isBlinking, setIsBlinking] = useState(false);
    const mouthPathRef = useRef<SVGPathElement>(null);
    const mouthHeightRef = useRef(0);
    const animationFrameIdRef = useRef<number | null>(null);
    const audioLevelRef = useRef(audioLevel);
    const statusRef = useRef(status);

    useEffect(() => {
        audioLevelRef.current = audioLevel;
    }, [audioLevel]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Blinking logic
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const triggerBlink = () => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 150);
            const nextBlink = Math.random() * 3000 + 2000; // 2-5 seconds
            timeoutId = setTimeout(triggerBlink, nextBlink);
        };

        timeoutId = setTimeout(triggerBlink, 3000);

        return () => clearTimeout(timeoutId);
    }, []);

    // Mouth animation loop
    useEffect(() => {
        const animate = () => {
            const currentStatus = statusRef.current;
            const currentAudioLevel = audioLevelRef.current;

            // Target mouth opening based on audio level
            // Only open mouth if speaking or listening (and maybe listening should be smaller?)
            // Usually avatar speaks when status is 'speaking'. When 'listening', it should be mostly closed or slight movement.
            let targetHeight = 0;
            
            if (currentStatus === 'speaking') {
                targetHeight = Math.min(1.0, Math.max(0.05, currentAudioLevel * 4.0)); 
            } else if (currentStatus === 'listening') {
                targetHeight = 0.05; // Slightly open/neutral
            } else {
                targetHeight = 0;
            }
            
            // Smooth interpolation
            mouthHeightRef.current += (targetHeight - mouthHeightRef.current) * 0.15;
            
            const h = mouthHeightRef.current * 20; // Max height scale (pixels)
            const w = 40 + (h * 0.5); // Mouth widens slightly as it opens

            // Quadratic curve for mouth
            // Center is (100, 130)
            const startX = 100 - w / 2;
            const endX = 100 + w / 2;
            const y = 130;
            const controlY = y + h; // Control point goes down to open mouth

            // If mouth is closed (h ~ 0), draw a straight line or slight curve
            const d = `M ${startX} ${y} Q 100 ${controlY} ${endX} ${y} Q 100 ${y + h * 0.2} ${startX} ${y}`;

            if (mouthPathRef.current) {
                mouthPathRef.current.setAttribute('d', d);
            }
            
            animationFrameIdRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
        };
    }, []);

    // Eye transformation
    const eyeScaleY = isBlinking ? 0.1 : 1;
    const eyeStyle = { 
        transform: `scaleY(${eyeScaleY})`, 
        transformOrigin: 'center', 
        transition: 'transform 0.1s ease-in-out' 
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full max-w-[300px] max-h-[300px] drop-shadow-2xl">
                <defs>
                    <radialGradient id="faceGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#1e3a8a" stopOpacity="1" />
                    </radialGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                {/* Head Shape */}
                <circle cx="100" cy="100" r="80" fill="url(#faceGradient)" />

                {/* Eyes Group */}
                <g fill="white">
                    {/* Left Eye */}
                    <g transform="translate(70, 85)">
                        <ellipse rx="10" ry="14" style={eyeStyle} />
                        <circle cx="0" cy="0" r="4" fill="#1e3a8a" style={eyeStyle} />
                    </g>
                    
                    {/* Right Eye */}
                    <g transform="translate(130, 85)">
                        <ellipse rx="10" ry="14" style={eyeStyle} />
                        <circle cx="0" cy="0" r="4" fill="#1e3a8a" style={eyeStyle} />
                    </g>
                </g>

                {/* Mouth */}
                <path ref={mouthPathRef} fill="white" opacity="0.9" filter="url(#glow)" />
            </svg>
            
            {/* Status Rings */}
            {status === 'listening' && (
                <div className="absolute inset-0 rounded-full border-4 border-green-400/30 animate-pulse pointer-events-none" />
            )}
            {status === 'speaking' && (
                <div className="absolute inset-0 rounded-full border-4 border-purple-400/30 animate-pulse pointer-events-none" />
            )}
             {status === 'connecting' && (
                <div className="absolute inset-0 rounded-full border-4 border-blue-400/30 animate-spin-slow pointer-events-none" />
            )}
        </div>
    );
};

export default Avatar;
