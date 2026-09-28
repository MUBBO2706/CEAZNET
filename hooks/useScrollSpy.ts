import React, { useState, useEffect, useRef } from 'react';

export const useScrollSpy = (
    scrollContainerRef: React.RefObject<HTMLDivElement>,
    messageIndices: number[]
): number | null => {
    const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);
    // Use a ref to store the intersection ratio of each message element.
    // This avoids re-renders and allows us to compare all visible elements.
    const intersectionRatiosRef = useRef<Map<Element, number>>(new Map());

    // This effect runs on initial load and when messages/conversation changes.
    // It sets an initial reasonable active message.
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (messageIndices.length > 0) {
            // If the content isn't scrollable, or on initial load, default to the last message.
            if (!container || container.scrollHeight <= container.clientHeight) {
                setActiveMessageIndex(messageIndices[messageIndices.length - 1]);
            }
        } else {
            setActiveMessageIndex(null);
        }
        // Reset the ratios when the conversation changes
        intersectionRatiosRef.current.clear();
    }, [messageIndices, scrollContainerRef]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || messageIndices.length === 0) {
            return;
        }

        const intersectionRatios = intersectionRatiosRef.current;

        const observer = new IntersectionObserver(
            (entries) => {
                // 1. Update the ratios for all elements that triggered the observer
                entries.forEach(entry => {
                    intersectionRatios.set(entry.target, entry.intersectionRatio);
                });

                // 2. Find the element with the highest visibility ratio from our stored map
                let bestTarget: Element | null = null;
                let maxRatio = -1;

                intersectionRatios.forEach((ratio, element) => {
                    if (ratio > maxRatio) {
                        maxRatio = ratio;
                        bestTarget = element;
                    }
                });

                // 3. If we found a best target, set it as the active index
                if (bestTarget) {
                    const index = parseInt(bestTarget.id.split('-')[1], 10);
                    // Only update state if the active index has actually changed to avoid re-renders
                    setActiveMessageIndex(prevIndex => prevIndex !== index ? index : prevIndex);
                }
            },
            {
                root: container,
                // Create an array of many thresholds. This makes the observer fire
                // frequently as an element's visibility changes, allowing us to
                // always know which one is the *most* visible.
                threshold: Array.from({ length: 101 }, (_, i) => i / 100), // [0, 0.01, 0.02, ..., 1]
            }
        );

        const elements = messageIndices
            .map(index => document.getElementById(`message-${index}`))
            .filter((el): el is HTMLElement => el !== null);

        elements.forEach(el => {
            intersectionRatios.set(el, 0); // Initialize with 0
            observer.observe(el);
        });

        return () => {
            observer.disconnect();
            // Clear the map on cleanup to prevent memory leaks with old elements.
            intersectionRatios.clear();
        };
    }, [messageIndices, scrollContainerRef]);

    return activeMessageIndex;
};