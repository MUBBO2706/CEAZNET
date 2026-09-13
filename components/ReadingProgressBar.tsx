import React, { useState, useEffect } from 'react';

interface ReadingProgressBarProps {
    scrollContainerRef: React.RefObject<HTMLElement>;
}

const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({ scrollContainerRef }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const calculateProgress = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const scrollableHeight = scrollHeight - clientHeight;
            if (scrollableHeight <= 0) {
                // If not scrollable, it's 100% if we are not at the very top.
                // On initial load, scrollTop is 0, so this correctly sets progress to 0.
                setProgress(scrollTop > 0 ? 100 : 0);
                return;
            }
            const currentProgress = (scrollTop / scrollableHeight) * 100;
            setProgress(currentProgress);
        };

        // Initial calculation after a short delay for content to render and calculate its height.
        const initialCalcTimeout = setTimeout(calculateProgress, 150);

        container.addEventListener('scroll', calculateProgress, { passive: true });
        
        // Use ResizeObserver to recalculate progress if content size changes (e.g., images loading)
        const resizeObserver = new ResizeObserver(calculateProgress);
        if (container.firstChild) {
            resizeObserver.observe(container.firstChild as Element);
        }

        return () => {
            clearTimeout(initialCalcTimeout);
            container.removeEventListener('scroll', calculateProgress);
            resizeObserver.disconnect();
        };
    }, [scrollContainerRef]);

    return (
        <div className="reading-progress-bar">
            <div className="reading-progress-bar-inner" style={{ width: `${progress}%` }}></div>
        </div>
    );
};

export default ReadingProgressBar;