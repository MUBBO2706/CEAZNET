import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface CustomSelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
    color?: string;
    bg?: string;
    badge?: string;
    description?: string;
}

export interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: CustomSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    buttonClassName?: string;
    searchable?: boolean;
    id?: string;
    size?: 'sm' | 'md' | 'lg';
    align?: 'left' | 'right';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select option...',
    disabled = false,
    className = '',
    buttonClassName = '',
    searchable = false,
    id,
    size = 'md',
    align = 'left'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const generatedId = useId();
    const selectId = id || `custom-select-${generatedId}`;

    const selectedOption = options.find(opt => opt.value === value);

    const filteredOptions = searchable && searchQuery.trim()
        ? options.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            opt.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (opt.badge && opt.badge.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : options;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            if (searchable && searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, searchable]);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearchQuery('');
    };

    const sizeClasses = {
        sm: 'h-9 min-h-[36px] max-h-[36px] py-1.5 px-3 text-xs box-border',
        md: 'h-10 min-h-[40px] max-h-[40px] py-2 px-3.5 sm:px-3 text-xs sm:text-sm box-border',
        lg: 'h-11 min-h-[44px] max-h-[44px] py-2.5 px-4 text-sm sm:text-base box-border'
    }[size];

    const alignmentClasses = align === 'right'
        ? 'right-0 left-auto'
        : 'left-0 right-auto';

    return (
        <div ref={containerRef} className={`relative block w-full max-w-full ${className}`}>
            <button
                type="button"
                id={selectId}
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 rounded-xl border box-border transition-all duration-200 select-none ${sizeClasses} ${buttonClassName} ${
                    disabled
                        ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-neutral-900 border-gray-200 dark:border-white/10 text-gray-400'
                        : isOpen
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-black/90 text-gray-900 dark:text-white shadow-sm'
                        : 'bg-white/80 dark:bg-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.08] border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200'
                }`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2 truncate min-w-0">
                    {selectedOption?.icon && (
                        <span className="shrink-0 flex items-center justify-center">
                            {selectedOption.icon}
                        </span>
                    )}
                    <span className={`truncate font-medium ${!selectedOption ? 'text-gray-400 dark:text-gray-500' : ''}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    {selectedOption?.badge && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 shrink-0">
                            {selectedOption.badge}
                        </span>
                    )}
                </div>
                <ChevronDown
                    className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-indigo-500' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div
                    className={`absolute ${alignmentClasses} top-full mt-1.5 ${
                        align === 'right'
                            ? 'w-max min-w-full sm:min-w-[240px]'
                            : 'w-full sm:w-auto sm:min-w-[200px]'
                    } max-w-[calc(100vw-2rem)] z-50 rounded-xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#121214]/95 backdrop-blur-xl shadow-xl overflow-hidden py-1 max-h-64 flex flex-col box-border`}
                    role="listbox"
                >
                        {searchable && (
                            <div className="p-2 border-b border-gray-100 dark:border-white/10 sticky top-0 bg-white/90 dark:bg-[#121214]/90 backdrop-blur-md z-10">
                                <div className="relative flex items-center">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 text-gray-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                                        onClick={e => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="overflow-y-auto scrollbar-hide py-1 flex-1">
                            {filteredOptions.length === 0 ? (
                                <div className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                                    No options found
                                </div>
                            ) : (
                                filteredOptions.map(opt => {
                                    const isSelected = opt.value === value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => handleSelect(opt.value)}
                                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100/70 dark:hover:bg-white/[0.06]'
                                            }`}
                                            role="option"
                                            aria-selected={isSelected}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 pr-1">
                                                {opt.icon && (
                                                    <span className="shrink-0 flex items-center justify-center">
                                                        {opt.icon}
                                                    </span>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-medium whitespace-nowrap">{opt.label}</div>
                                                    {opt.description && (
                                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap mt-0.5">
                                                            {opt.description}
                                                        </div>
                                                    )}
                                                </div>
                                                {opt.badge && (
                                                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 shrink-0 ml-auto">
                                                        {opt.badge}
                                                    </span>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                </div>
            )}
        </div>
    );
};
