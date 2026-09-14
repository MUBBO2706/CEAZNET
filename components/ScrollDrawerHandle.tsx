import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

export const ScrollDrawerHandle: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [scrollTopRatio, setScrollTopRatio] = useState(0); // 0 to 1
    const [scrollPercentage, setScrollPercentage] = useState(0); // 0 to 100
    const [handleY, setHandleY] = useState(100); // px from top
    const [targetContainer, setTargetContainer] = useState<HTMLElement | null>(null);
    const [containerBounds, setContainerBounds] = useState<{ top: number; height: number; right: number } | null>(null);

    const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
    const dragStartYRef = useRef<number>(0);
    const dragStartScrollRatioRef = useRef<number>(0);

    // Find the primary active scrollable container near cursor or in main viewport
    const findScrollContainerAt = useCallback((x: number, y: number): HTMLElement | null => {
        const elemAtPoint = document.elementFromPoint(x, y);
        let curr: HTMLElement | null = elemAtPoint as HTMLElement;

        while (curr && curr !== document.body && curr !== document.documentElement) {
            const overflowY = window.getComputedStyle(curr).overflowY;
            const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && (curr.scrollHeight - curr.clientHeight > 15);
            if (isScrollable) {
                return curr;
            }
            curr = curr.parentElement;
        }

        // Fallback to main content area or first active scrollable area
        const mainContent = document.getElementById('main-content-area');
        if (mainContent) {
            const scrollableInside = mainContent.querySelector<HTMLElement>('.overflow-y-auto, .overflow-y-scroll, [class*="overflow-y"]');
            if (scrollableInside && scrollableInside.scrollHeight - scrollableInside.clientHeight > 15) {
                return scrollableInside;
            }
        }

        // Fallback to window / document element if scrollable
        if (document.documentElement.scrollHeight - document.documentElement.clientHeight > 15) {
            return document.documentElement;
        }

        return null;
    }, []);

    // Update scroll metrics from target container
    const updateScrollMetrics = useCallback((container: HTMLElement) => {
        let scrollTop = 0;
        let scrollHeight = 0;
        let clientHeight = 0;
        let rectTop = 0;
        let rectHeight = window.innerHeight;
        let rectRight = window.innerWidth;

        if (container === document.documentElement) {
            scrollTop = window.scrollY || document.documentElement.scrollTop;
            scrollHeight = document.documentElement.scrollHeight;
            clientHeight = window.innerHeight;
        } else {
            scrollTop = container.scrollTop;
            scrollHeight = container.scrollHeight;
            clientHeight = container.clientHeight;
            const rect = container.getBoundingClientRect();
            rectTop = rect.top;
            rectHeight = rect.height;
            rectRight = rect.right;
        }

        const maxScroll = Math.max(1, scrollHeight - clientHeight);
        const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll));
        const percentage = Math.round(ratio * 100);

        setScrollTopRatio(ratio);
        setScrollPercentage(percentage);

        // Calculate Y position on screen for handle
        const minTop = rectTop + 40;
        const maxTop = rectTop + rectHeight - 75;
        const computedY = rectTop + ratio * (rectHeight - 110) + 20;
        const clampedY = Math.max(minTop, Math.min(maxTop, computedY));

        setHandleY(clampedY);
        setContainerBounds({ top: rectTop, height: rectHeight, right: rectRight });
    }, []);

    // Handle mouse move to detect proximity to right edge
    useEffect(() => {
        const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 768;
        if (!isDesktop) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) return;

            const container = findScrollContainerAt(e.clientX, e.clientY);
            if (!container) {
                if (!isHovered) setIsVisible(false);
                return;
            }

            const isDoc = container === document.documentElement;
            const containerRight = isDoc ? window.innerWidth : container.getBoundingClientRect().right;
            const distanceFromRight = Math.abs(e.clientX - containerRight);

            // Show if mouse is within 36px of right edge of scroll container
            if (distanceFromRight <= 36) {
                setTargetContainer(container);
                updateScrollMetrics(container);
                setIsVisible(true);

                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                hideTimerRef.current = setTimeout(() => {
                    if (!isHovered && !isDragging) {
                        setIsVisible(false);
                    }
                }, 2200);
            } else if (!isHovered && !isDragging) {
                setIsVisible(false);
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [findScrollContainerAt, updateScrollMetrics, isHovered, isDragging]);

    // Handle scroll events on target container or window
    useEffect(() => {
        if (!targetContainer) return;

        const onScroll = () => {
            updateScrollMetrics(targetContainer);
            setIsVisible(true);

            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            hideTimerRef.current = setTimeout(() => {
                if (!isHovered && !isDragging) {
                    setIsVisible(false);
                }
            }, 2000);
        };

        const targetElem = targetContainer === document.documentElement ? window : targetContainer;
        targetElem.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            targetElem.removeEventListener('scroll', onScroll);
        };
    }, [targetContainer, updateScrollMetrics, isHovered, isDragging]);

    // Dragging logic
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!targetContainer) return;

        setIsDragging(true);
        dragStartYRef.current = e.clientY;
        dragStartScrollRatioRef.current = scrollTopRatio;

        const container = targetContainer;
        const isDoc = container === document.documentElement;
        const clientHeight = isDoc ? window.innerHeight : container.clientHeight;
        const maxScroll = Math.max(1, container.scrollHeight - clientHeight);
        const rectHeight = containerBounds ? containerBounds.height : window.innerHeight;

        const handleGlobalMouseMove = (moveEvt: MouseEvent) => {
            const deltaY = moveEvt.clientY - dragStartYRef.current;
            const scrollableTrackHeight = Math.max(100, rectHeight - 110);
            const ratioDelta = deltaY / scrollableTrackHeight;
            const newRatio = Math.min(1, Math.max(0, dragStartScrollRatioRef.current + ratioDelta));

            if (isDoc) {
                window.scrollTo({ top: newRatio * maxScroll, behavior: 'auto' });
            } else {
                container.scrollTop = newRatio * maxScroll;
            }

            setScrollTopRatio(newRatio);
            setScrollPercentage(Math.round(newRatio * 100));
        };

        const handleGlobalMouseUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    const handleScrollStep = (direction: 'up' | 'down') => {
        if (!targetContainer) return;
        const isDoc = targetContainer === document.documentElement;
        const step = direction === 'up' ? -260 : 260;

        if (isDoc) {
            window.scrollBy({ top: step, behavior: 'smooth' });
        } else {
            targetContainer.scrollBy({ top: step, behavior: 'smooth' });
        }
    };

    if (!isVisible && !isDragging) return null;

    const rightPos = containerBounds ? Math.max(0, window.innerWidth - containerBounds.right) : 0;

    return (
        <div
            style={{
                top: `${handleY}px`,
                right: `${rightPos}px`,
                backgroundColor: 'var(--scroll-drawer-bg)',
                color: 'var(--scroll-drawer-text)',
                borderColor: 'var(--scroll-drawer-border)',
                boxShadow: '0 10px 30px -5px var(--scroll-drawer-shadow), 0 0 1px var(--scroll-drawer-border)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                if (!isDragging) {
                    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                    hideTimerRef.current = setTimeout(() => setIsVisible(false), 1200);
                }
            }}
            className={`fixed z-50 flex items-center select-none transition-all duration-200 ease-out rounded-l-2xl border-l border-y backdrop-blur-md cursor-grab active:cursor-grabbing group ${
                isHovered || isDragging ? 'px-2.5 py-2 scale-105 -translate-x-1' : 'px-1.5 py-1.5 opacity-90'
            }`}
            title="Desktop Scroll Drawer - Drag or click to scroll easily"
        >
            <div
                onMouseDown={handleMouseDown}
                className="flex items-center space-x-1 cursor-grab active:cursor-grabbing py-1 px-0.5"
            >
                {/* Dots Grip Pattern */}
                <div className="flex flex-col space-y-1 items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4 text-current" />
                </div>

                {/* Percentage Badge & Jump Controls on Hover/Drag */}
                {(isHovered || isDragging) && (
                    <div className="flex items-center space-x-2 pl-1 animate-fadeIn">
                        <span className="text-[11px] font-bold tracking-tight px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-sm whitespace-nowrap">
                            {scrollPercentage}%
                        </span>

                        <div className="flex flex-col -space-y-1">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollStep('up');
                                }}
                                className="p-0.5 hover:bg-white/20 dark:hover:bg-black/20 rounded transition-colors cursor-pointer"
                                title="Scroll Up"
                            >
                                <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollStep('down');
                                }}
                                className="p-0.5 hover:bg-white/20 dark:hover:bg-black/20 rounded transition-colors cursor-pointer"
                                title="Scroll Down"
                            >
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScrollDrawerHandle;
