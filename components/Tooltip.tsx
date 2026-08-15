import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactElement; // Must be a single ReactElement
    position?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'left' | 'right' | 'center'; // For top/bottom: horizontal align. For left/right: vertical align (top->top, bottom->bottom, center->center)
    className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', align = 'center', className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const targetRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        if (!targetRef.current || !tooltipRef.current) return;

        const targetRect = targetRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const { width: tooltipWidth, height: tooltipHeight } = tooltipRect;
        
        const margin = 8;

        let finalTop = 0;
        let finalLeft = 0;

        if (position === 'top' || position === 'bottom') {
            // Vertical positioning
            if (position === 'top') {
                finalTop = targetRect.top - tooltipHeight - margin;
            } else {
                finalTop = targetRect.bottom + margin;
            }

            // Horizontal alignment
            if (align === 'center') {
                finalLeft = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
            } else if (align === 'left') {
                finalLeft = targetRect.left;
            } else { // right
                finalLeft = targetRect.right - tooltipWidth;
            }
        } else {
            // Horizontal positioning (left/right)
            if (position === 'left') {
                finalLeft = targetRect.left - tooltipWidth - margin;
            } else { // right
                finalLeft = targetRect.right + margin;
            }

            // Vertical alignment
            if (align === 'center') {
                finalTop = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
            } else if (align === 'left') { // interpreting 'left' as 'top' for vertical alignment to reuse prop
                finalTop = targetRect.top;
            } else { // 'right' as 'bottom'
                finalTop = targetRect.bottom - tooltipHeight;
            }
        }

        // Collision detection
        if (finalLeft < margin) finalLeft = margin;
        if (finalLeft + tooltipWidth > window.innerWidth - margin) {
            finalLeft = window.innerWidth - tooltipWidth - margin;
        }
        
        if (finalTop < margin) finalTop = margin;
        if (finalTop + tooltipHeight > window.innerHeight - margin) {
            finalTop = window.innerHeight - tooltipHeight - margin;
        }

        setCoords({ top: finalTop, left: finalLeft });
    }, [position, align]);

    useEffect(() => {
        if (isVisible) {
            // Use a microtask timeout to allow the tooltip to render invisibly first,
            // so we can measure its dimensions before positioning it.
            queueMicrotask(updatePosition);
        }
    }, [isVisible, updatePosition]);
    
    const handleMouseEnter = (e: React.MouseEvent) => {
        if (typeof (children.props as any).onMouseEnter === 'function') {
            (children.props as any).onMouseEnter(e);
        }
        setIsVisible(true);
    };

    const handleMouseLeave = (e: React.MouseEvent) => {
        if (typeof (children.props as any).onMouseLeave === 'function') {
            (children.props as any).onMouseLeave(e);
        }
        setIsVisible(false);
    };
    
    const handleRef = useCallback((node: HTMLElement | null) => {
        (targetRef as React.MutableRefObject<HTMLElement | null>).current = node;
    }, []);

    const childWithProps = React.cloneElement(children as React.ReactElement<any>, {
        ref: handleRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
    });
    
    const TooltipPortal = createPortal(
        <div
            ref={tooltipRef}
            className={`fixed bg-gray-900 dark:bg-black text-white text-xs rounded-md py-1.5 px-3 pointer-events-none z-50 shadow-lg transition-opacity duration-200 ${className} ${isVisible ? 'opacity-100' : 'opacity-0'}`}
            style={isVisible ? { top: `${coords.top}px`, left: `${coords.left}px` } : { visibility: 'hidden' }}
            role="tooltip"
        >
            {content}
        </div>,
        document.body
    );

    return (
        <>
            {childWithProps}
            {TooltipPortal}
        </>
    );
};

export default Tooltip;