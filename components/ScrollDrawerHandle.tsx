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

    // Find active scrollable container under cursor or fallback to page main content
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

        // Fallback to main content container if any
        const mainContent = document.getElementById('main-content-area');
        if (mainContent) {
            const scrollableInside = mainContent.querySelector<HTMLElement>('.overflow-y-auto, .overflow-y-scroll, [class*="overflow-y"]');
            if (scrollableInside && scrollableInside.scrollHeight - scrollableInside.clientHeight > 15) {
                return scrollableInside;
            }
        }

        // Fallback to window / document element if page is scrollable
        if (document.documentElement.scrollHeight - document.documentElement.clientHeight > 15) {
            return document.documentElement;
        }

        return null;
    }, []);

    // Update position and percentage based on scroll container
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

        // Clamp Y position within visible container bounds
        const minTop = rectTop + 32;
        const maxTop = rectTop + rectHeight - 65;
        const computedY = rectTop + ratio * (rectHeight - 90) + 16;
        const clampedY = Math.max(minTop, Math.min(maxTop, computedY));

        setHandleY(clampedY);
        setContainerBounds({ top: rectTop, height: rectHeight, right: rectRight });
    }, []);

    // Monitor mouse position for hovering near right scroll area
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

            // Trigger drawer preview when cursor is within 28px of scrollbar/right edge
            if (distanceFromRight <= 28) {
                setTargetContainer(container);
                updateScrollMetrics(container);
                setIsVisible(true);

                if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                hideTimerRef.current = setTimeout(() => {
                    if (!isHovered && !isDragging) {
                        setIsVisible(false);
                    }
                }, 1800);
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

    // Handle container scroll event to update drawer handle position dynamically
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
            }, 1500);
        };

        const targetElem = targetContainer === document.documentElement ? window : targetContainer;
        targetElem.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            targetElem.removeEventListener('scroll', onScroll);
        };
    }, [targetContainer, updateScrollMetrics, isHovered, isDragging]);

    // Drag drawer handle to scroll
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
            const scrollableTrackHeight = Math.max(80, rectHeight - 90);
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
        const step = direction === 'up' ? -220 : 220;

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
                boxShadow: '0 4px 16px var(--scroll-drawer-shadow)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                if (!isDragging) {
                    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                    hideTimerRef.current = setTimeout(() => setIsVisible(false), 1000);
                }
            }}
            className={`fixed z-50 flex items-center select-none transition-all duration-150 ease-out rounded-l-xl border-l border-y backdrop-blur-md cursor-grab active:cursor-grabbing ${
                isHovered || isDragging
                    ? 'px-2 py-1 shadow-lg border-indigo-500/30 dark:border-indigo-400/30 -translate-x-0.5'
                    : 'px-1 py-1 opacity-80'
            }`}
            title="Scroll Drawer Handle - Drag to scroll"
        >
            <div
                onMouseDown={handleMouseDown}
                className="flex items-center space-x-1 cursor-grab active:cursor-grabbing"
            >
                {/* Compact Vertical Grip Icon */}
                <div className="flex items-center justify-center text-gray-400 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Compact Percentage Badge & Direction Buttons on Hover */}
                {(isHovered || isDragging) && (
                    <div className="flex items-center space-x-1 pl-0.5">
                        <span className="text-[10px] font-bold tracking-tight px-1 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {scrollPercentage}%
                        </span>

                        <div className="flex flex-col -space-y-0.5 pl-0.5">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollStep('up');
                                }}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                title="Scroll Up"
                            >
                                <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollStep('down');
                                }}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                title="Scroll Down"
                            >
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScrollDrawerHandle;
