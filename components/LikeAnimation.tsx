import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface LikeAnimationProps {
    animating: boolean;
    onAnimationEnd: () => void;
    position: 'absolute' | 'fixed';
}

const LikeAnimation: React.FC<LikeAnimationProps> = ({ animating, onAnimationEnd, position }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (animating) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                onAnimationEnd();
            }, 700); // Match animation duration in index.html
            return () => clearTimeout(timer);
        }
    }, [animating, onAnimationEnd]);

    if (!isVisible) return null;

    return (
        <div className={`${position} inset-0 flex items-center justify-center pointer-events-none z-50`}>
            <Heart className="h-24 w-24 sm:h-32 sm:w-32 text-red-500 fill-current animate-like-heart drop-shadow-lg" />
        </div>
    );
};

export default LikeAnimation;
