import React, { useState, useRef, useEffect, useCallback } from 'react';

// This hook enables a vertical drag-to-close gesture for bottom sheet components.
export const useDraggableSheet = (
    sheetRef: React.RefObject<HTMLDivElement>,
    onClose: () => void,
    isOpen: boolean
) => {
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ y: number; time: number } | null>(null);
    const handleRef = useRef<HTMLDivElement>(null);

    const onDragStart = useCallback((clientY: number) => {
        setIsDragging(true);
        dragStartRef.current = { y: clientY, time: Date.now() };
        if (sheetRef.current) {
            sheetRef.current.style.transition = 'none';
        }
    }, [sheetRef]);

    const onDragMove = useCallback((clientY: number) => {
        if (!isDragging || !dragStartRef.current) return;
        const deltaY = clientY - dragStartRef.current.y;
        if (deltaY > 0) { // Only allow dragging down
            setTranslateY(deltaY);
        }
    }, [isDragging]);

    const onDragEnd = useCallback(() => {
        if (!isDragging || !dragStartRef.current || !sheetRef.current) return;
        
        const sheetHeight = sheetRef.current.clientHeight;
        const dragDuration = Date.now() - dragStartRef.current.time;
        // Avoid division by zero and ensure duration is meaningful
        const velocity = dragDuration > 10 ? translateY / dragDuration : 0;
        
        const closeThreshold = sheetHeight * 0.4;
        const velocityThreshold = 0.5;

        if (sheetRef.current) {
            sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
        }

        if (translateY > closeThreshold || velocity > velocityThreshold) {
            onClose();
        } else {
            setTranslateY(0);
        }

        setIsDragging(false);
        dragStartRef.current = null;
    }, [isDragging, translateY, onClose, sheetRef]);
    
    useEffect(() => {
        if (!isOpen) {
            if (sheetRef.current) {
                // Ensure transition is active for the closing animation driven by className change
                sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
            }
            setTranslateY(0);
        }
    }, [isOpen, sheetRef]);

    useEffect(() => {
        const handle = handleRef.current;
        if (!handle) return;

        const handleMouseDown = (e: MouseEvent) => onDragStart(e.clientY);
        const handleMouseMove = (e: MouseEvent) => onDragMove(e.clientY);
        const handleMouseUp = () => onDragEnd();

        handle.addEventListener('mousedown', handleMouseDown);
        
        const cleanup = () => {
            handle.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
        
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp, { once: true });
        }

        return cleanup;
    }, [onDragStart, onDragMove, onDragEnd, isDragging]);

    useEffect(() => {
        const handle = handleRef.current;
        if (!handle) return;
        
        const handleTouchStart = (e: TouchEvent) => onDragStart(e.touches[0].clientY);
        const handleTouchMove = (e: TouchEvent) => onDragMove(e.touches[0].clientY);
        const handleTouchEnd = () => onDragEnd();
        
        handle.addEventListener('touchstart', handleTouchStart, { passive: true });

        const cleanup = () => {
            handle.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
        
        if (isDragging) {
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd, { once: true });
            window.addEventListener('touchcancel', handleTouchEnd, { once: true });
        }
        
        return cleanup;
    }, [onDragStart, onDragMove, onDragEnd, isDragging]);

    const sheetStyle: React.CSSProperties = {
        transform: `translateY(${translateY}px)`,
    };
    
    if (isDragging) {
        (sheetStyle as any).willChange = 'transform';
    }

    return { sheetStyle, handleRef };
};