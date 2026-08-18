import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface CustomDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  displayLabels?: Record<string, string>;
  triggerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  className = '',
  displayLabels,
  triggerClassName = 'px-4 py-2.5 text-[13px]',
  placeholder,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    minWidth: 0,
    direction: 'down' as 'up' | 'down',
  });

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const calculatePosition = (triggerEl: HTMLButtonElement, lockedWidth?: number) => {
    const rect = triggerEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const panelHeight = Math.min(options.length * 36 + 12, 240);

    let direction: 'up' | 'down' = 'down';
    let top = rect.bottom;

    if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
      direction = 'up';
      top = rect.top;
    }

    let panelWidth = lockedWidth || 0;

    if (!panelWidth) {
      let maxCharLength = 0;
      options.forEach((opt) => {
        const label = displayLabels?.[opt] || opt;
        if (label.length > maxCharLength) {
          maxCharLength = label.length;
        }
      });

      const hasScrollbar = options.length > 6;
      const contentNeededWidth = Math.ceil(maxCharLength * 7.5 + 28 + (hasScrollbar ? 16 : 0));
      const desiredWidth = Math.max(rect.width, contentNeededWidth);
      const maxAllowedScreenWidth = Math.max(100, window.innerWidth - 24);
      panelWidth = Math.min(desiredWidth, maxAllowedScreenWidth);
    }

    const maxAllowedScreenWidth = Math.max(100, window.innerWidth - 24);
    const minWidth = Math.min(rect.width, maxAllowedScreenWidth);

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - panelWidth - 12);
    }
    if (left < 12) {
      left = 12;
    }

    return {
      top,
      left,
      width: panelWidth,
      minWidth,
      direction,
    };
  };

  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      setPosition(calculatePosition(triggerRef.current));
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      setPosition(calculatePosition(triggerRef.current));
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsideTrigger = dropdownRef.current?.contains(target);
      const isClickInsidePanel = panelRef.current?.contains(target);

      if (!isClickInsideTrigger && !isClickInsidePanel) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = (event: Event) => {
      if (panelRef.current && (event.target === panelRef.current || panelRef.current.contains(event.target as Node))) {
        return;
      }
      if (isOpen && triggerRef.current) {
        setPosition((prev) => calculatePosition(triggerRef.current!, prev.width));
      }
    };

    const preventScroll = (e: Event) => {
      if (isOpen) {
        const target = e.target as Node;
        if (!panelRef.current?.contains(target)) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    if (isOpen) {
      document.addEventListener('wheel', preventScroll, { passive: false, capture: true });
      document.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('wheel', preventScroll, { capture: true });
      document.removeEventListener('touchmove', preventScroll, { capture: true });
    };
  }, [isOpen]);

  const displayValue = displayLabels?.[value] || value || placeholder || 'Select';

  const panelContent = isOpen ? createPortal(
    <div
      ref={panelRef}
      className={`custom-dropdown-panel ${isOpen ? 'open' : ''} bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl py-1 relative z-[999999] overflow-y-auto max-h-[240px]`}
      role="listbox"
      style={{
        position: 'fixed',
        top: position.direction === 'down' ? position.top + 4 : 'auto',
        bottom: position.direction === 'up' ? window.innerHeight - position.top + 4 : 'auto',
        left: position.left,
        width: position.width ? `${position.width}px` : 'auto',
        minWidth: position.minWidth ? `${position.minWidth}px` : undefined,
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 999999,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((option) => {
        const label = displayLabels?.[option] || option;
        const isSelected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap flex items-center justify-between ${
              isSelected
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(option);
            }}
            title={label}
          >
            <span className="truncate block">{label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={dropdownRef} className={`relative max-w-full min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-1 w-full text-left transition-all cursor-pointer ${triggerClassName}`}
      >
        <span className="truncate block flex-1">{displayValue}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {panelContent}
    </div>
  );
};
