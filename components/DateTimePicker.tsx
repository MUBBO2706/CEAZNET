import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

interface DateTimePickerProps {
    value: string; // YYYY-MM-DDTHH:MM format
    onChange: (val: string) => void;
    placeholder: string;
    align?: 'left' | 'right';
    variant?: 'default' | 'containerless';
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange, placeholder, align = 'left', variant = 'default' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hoursRef = useRef<HTMLDivElement>(null);
    const minutesRef = useRef<HTMLDivElement>(null);
    const isProgrammaticScroll = useRef(false);
    const scrollTimeoutRef = useRef<Record<string, any>>({});

    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current.hours) clearTimeout(scrollTimeoutRef.current.hours);
            if (scrollTimeoutRef.current.minutes) clearTimeout(scrollTimeoutRef.current.minutes);
        };
    }, []);

    // Helper to check if a date is today
    const isTodayDate = (y: number, m: number, d: number) => {
        const today = new Date();
        return today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    };

    // Parse value or default to current date/time
    const now = new Date();
    const getInitialState = () => {
        if (!value) {
            const isEnd = placeholder.toLowerCase().includes('end');
            return {
                year: now.getFullYear(),
                month: now.getMonth(), // 0-11
                day: now.getDate(),
                hours: isEnd ? 23 : 0, // 24-hour representation
                minutes: isEnd ? 59 : 0,
            };
        }
        try {
            const [datePart, timePart] = value.split('T');
            const [y, m, d] = datePart.split('-').map(Number);
            const [h24, min] = (timePart || '00:00').split(':').map(Number);
            
            return {
                year: y,
                month: m - 1,
                day: d,
                hours: h24,
                minutes: min,
            };
        } catch (e) {
            const isEnd = placeholder.toLowerCase().includes('end');
            return {
                year: now.getFullYear(),
                month: now.getMonth(),
                day: now.getDate(),
                hours: isEnd ? 23 : 0,
                minutes: isEnd ? 59 : 0,
            };
        }
    };

    const [pickerState, setPickerState] = useState(getInitialState);

    // Sync draft state with fresh values whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setPickerState(getInitialState());
        }
    }, [isOpen, value]);

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Current navigating month view state
    const [navYear, setNavYear] = useState(pickerState.year);
    const [navMonth, setNavMonth] = useState(pickerState.month);

    // Sync navigation month with active selection when opened
    useEffect(() => {
        if (isOpen) {
            setNavYear(pickerState.year);
            setNavMonth(pickerState.month);
        }
    }, [isOpen, pickerState.year, pickerState.month]);

    // Auto-scroll selected hour and minute to center on open or state update
    const scrollToSelected = (behavior: ScrollBehavior = 'auto') => {
        isProgrammaticScroll.current = true;
        if (hoursRef.current) {
            const activeEl = hoursRef.current.querySelector(`[data-val="${pickerState.hours}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ block: 'center', behavior });
            }
        }
        if (minutesRef.current) {
            const activeEl = minutesRef.current.querySelector(`[data-val="${pickerState.minutes}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ block: 'center', behavior });
            }
        }
        setTimeout(() => {
            isProgrammaticScroll.current = false;
        }, behavior === 'smooth' ? 350 : 100);
    };

    const handleScrollWithStop = (ref: React.RefObject<HTMLDivElement>, isHours: boolean) => {
        if (isProgrammaticScroll.current) return;
        
        const key = isHours ? 'hours' : 'minutes';
        if (scrollTimeoutRef.current[key]) {
            clearTimeout(scrollTimeoutRef.current[key]);
        }

        scrollTimeoutRef.current[key] = setTimeout(() => {
            if (!ref.current) return;
            const container = ref.current;
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.top + containerRect.height / 2;

            const children = container.querySelectorAll('[data-val]');
            let closestVal = isHours ? pickerState.hours : pickerState.minutes;
            let minDiff = Infinity;

            children.forEach(child => {
                const val = Number(child.getAttribute('data-val'));
                const childRect = child.getBoundingClientRect();
                const childCenter = childRect.top + childRect.height / 2;
                const diff = Math.abs(childCenter - containerCenter);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestVal = val;
                }
            });

            setPickerState(prev => {
                if (isHours && prev.hours !== closestVal) {
                    return { ...prev, hours: closestVal };
                } else if (!isHours && prev.minutes !== closestVal) {
                    return { ...prev, minutes: closestVal };
                }
                return prev;
            });
        }, 150);
    };

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                scrollToSelected('auto');
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isOpen, pickerState.hours, pickerState.minutes]);

    const handlePrevMonth = () => {
        if (navMonth === 0) {
            setNavMonth(11);
            setNavYear(prev => prev - 1);
        } else {
            setNavMonth(prev => prev - 1);
        }
    };

    const handleNextMonth = () => {
        if (navMonth === 11) {
            setNavMonth(0);
            setNavYear(prev => prev + 1);
        } else {
            setNavMonth(prev => prev + 1);
        }
    };

    // Calculate calendar days
    const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
    const firstDayIndex = new Date(navYear, navMonth, 1).getDay(); // 0 = Sun, 6 = Sat

    const days = [];
    // Previous month's padding days
    const prevMonthDays = new Date(navYear, navMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        days.push({ day: prevMonthDays - i, isCurrentMonth: false });
    }
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, isCurrentMonth: true });
    }
    // Next month's padding days to make grid complete (multiple of 7)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({ day: i, isCurrentMonth: false });
    }

    const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const updatePickerState = (updated: Partial<typeof pickerState>) => {
        setPickerState(prev => ({ ...prev, ...updated }));
    };

    const handleSelectDay = (day: number) => {
        const isSelectedDayToday = isTodayDate(navYear, navMonth, day);
        let targetHours = pickerState.hours;
        let targetMinutes = pickerState.minutes;

        if (isSelectedDayToday) {
            const todayNow = new Date();
            targetHours = todayNow.getHours();
            targetMinutes = todayNow.getMinutes();
        } else {
            const isEnd = placeholder.toLowerCase().includes('end');
            if (isEnd) {
                targetHours = 23;
                targetMinutes = 59;
            } else {
                targetHours = 0;
                targetMinutes = 0;
            }
        }

        setPickerState(prev => ({
            ...prev,
            year: navYear,
            month: navMonth,
            day,
            hours: targetHours,
            minutes: targetMinutes
        }));

        setTimeout(() => {
            scrollToSelected('smooth');
        }, 50);
    };

    const handleDone = () => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const formatted = `${pickerState.year}-${pad(pickerState.month + 1)}-${pad(pickerState.day)}T${pad(pickerState.hours)}:${pad(pickerState.minutes)}`;
        onChange(formatted);
        setIsOpen(false);
    };

    const handleSetNow = () => {
        const d = new Date();
        const updated = {
            year: d.getFullYear(),
            month: d.getMonth(),
            day: d.getDate(),
            hours: d.getHours(),
            minutes: d.getMinutes(),
        };
        setPickerState(updated);
        setNavMonth(d.getMonth());
        setNavYear(d.getFullYear());
        
        setTimeout(() => {
            scrollToSelected('smooth');
        }, 50);
    };

    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    // Format display string
    const getDisplayString = () => {
        if (!value) return placeholder;
        try {
            const [datePart, timePart] = value.split('T');
            const [y, m, d] = datePart.split('-').map(Number);
            const [h24, min] = (timePart || '00:00').split(':').map(Number);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d} ${monthNames[m - 1]} ${y}, ${pad(h24)}:${pad(min)}`;
        } catch (e) {
            return value;
        }
    };

    const isToday = (day: number, isCurrent: boolean) => {
        const today = new Date();
        return isCurrent && 
               day === today.getDate() && 
               navMonth === today.getMonth() && 
               navYear === today.getFullYear();
    };

    const isSelected = (day: number, isCurrent: boolean) => {
        return isCurrent && 
               day === pickerState.day && 
               navMonth === pickerState.month && 
               navYear === pickerState.year;
    };

    return (
        <div ref={containerRef} className="static md:relative inline-block font-sans select-none shrink-0">
            {/* Scoped custom tiny scrollbars styling and snap support */}
            <style>{`
                .custom-time-scroll {
                    scroll-snap-type: y mandatory;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                }
                .custom-time-scroll::-webkit-scrollbar {
                    display: none;
                }
                .custom-time-scroll-item {
                    scroll-snap-align: center;
                }
            `}</style>

            {/* Input Trigger Button */}
            <div className={`flex items-center rounded transition-all h-[26px] md:h-7 pl-1.5 pr-0.5 ${
                variant === 'containerless'
                    ? 'bg-transparent border-0 hover:bg-[var(--dev-console-bg-hover)]'
                    : 'bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-hover)] focus-within:border-[#007fd4]'
            }`}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 text-[9.5px] md:text-[10.5px] text-[var(--dev-console-text)] outline-none cursor-pointer h-full text-left"
                >
                    <Calendar size={11} className="text-[var(--dev-console-text-muted)] shrink-0" />
                    <span className="truncate max-w-[130px] md:max-w-[160px] pr-1.5">
                        {getDisplayString()}
                    </span>
                </button>
                {value && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClear();
                        }}
                        className="p-0.5 text-[var(--dev-console-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer transition-colors"
                        title="Clear"
                    >
                        <X size={10} />
                    </button>
                )}
            </div>

            {/* Dual-Pane Custom Responsive Popover */}
            {isOpen && (
                <div className={`absolute top-full ${align === 'right' ? 'right-2 md:right-0' : 'left-2 md:left-0'} mt-1 w-[295px] bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded-md shadow-2xl z-50 p-2 flex flex-col gap-2 font-sans text-[var(--dev-console-text)] animate-in fade-in slide-in-from-top-1 duration-150`}>
                    
                    <div className="flex flex-row gap-2 overflow-visible items-stretch">
                        {/* LEFT PANE: CALENDAR */}
                        <div className="flex flex-col gap-1.5 w-[180px] shrink-0">
                            {/* Calendar Month Header */}
                            <div className="flex items-center justify-between border-b border-[var(--dev-console-border)]/50 pb-1.5 h-[23px]">
                                <button 
                                    onClick={handlePrevMonth}
                                    className="p-1 hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] rounded transition-all cursor-pointer"
                                >
                                    <ChevronLeft size={13} />
                                </button>
                                <span className="text-[10px] font-semibold tracking-wider uppercase">
                                    {monthNames[navMonth]} {navYear}
                                </span>
                                <button 
                                    onClick={handleNextMonth}
                                    className="p-1 hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] rounded transition-all cursor-pointer"
                                >
                                    <ChevronRight size={13} />
                                </button>
                            </div>

                            {/* Week Days Label Row */}
                            <div className="grid grid-cols-7 gap-0.5 text-center font-bold text-[8.5px] text-[var(--dev-console-text-muted)]">
                                {weekdays.map((w, idx) => (
                                    <div key={idx} className="w-[24px] h-[14px] flex items-center justify-center">
                                        {w}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Day Grid */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {days.map((item, idx) => {
                                    const selected = isSelected(item.day, item.isCurrentMonth);
                                    const currentToday = isToday(item.day, item.isCurrentMonth);
                                    
                                    return (
                                        <button
                                            key={idx}
                                            disabled={!item.isCurrentMonth}
                                            onClick={() => handleSelectDay(item.day)}
                                            className={`
                                                w-[24px] h-[19px] rounded text-[9.5px] font-medium flex items-center justify-center transition-all cursor-pointer
                                                ${!item.isCurrentMonth ? 'text-[var(--dev-console-text-muted)]/10 cursor-default' : ''}
                                                ${item.isCurrentMonth && !selected ? 'hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text)]' : ''}
                                                ${currentToday && !selected ? 'border border-[#007fd4]/60 text-[#007fd4]' : ''}
                                                ${selected ? 'bg-[#007fd4] text-white font-semibold shadow-sm shadow-[#007fd4]/20' : ''}
                                            `}
                                        >
                                            {item.day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SEPARATOR DIVIDER */}
                        <div className="border-l border-[var(--dev-console-border)]/50 self-stretch shrink-0" />

                        {/* RIGHT PANE: DEDICATED CUSTOM TIME PICKER */}
                        <div className="flex flex-col gap-1.5 w-[90px] shrink-0">
                            <div className="flex items-center gap-1 border-b border-[var(--dev-console-border)]/50 pb-1.5 h-[23px]">
                                <Clock size={11} className="text-[var(--dev-console-text-muted)] shrink-0" />
                                <span className="text-[9px] font-bold text-[var(--dev-console-text-muted)] uppercase tracking-wider">Time</span>
                            </div>

                            {/* Dual Column Selectors for Hours and Minutes */}
                            <div className="relative flex flex-row h-[142px] overflow-hidden w-full">
                                {/* Center highlight border overlay */}
                                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[24px] border-y border-[#007fd4]/25 bg-[#007fd4]/5 pointer-events-none z-10" />

                                {/* Hours Scroll Column */}
                                <div 
                                    ref={hoursRef}
                                    onScroll={() => handleScrollWithStop(hoursRef, true)}
                                    className="custom-time-scroll flex-1 overflow-y-auto pr-0.5 flex flex-col gap-0.5 h-full scroll-smooth py-[59px]"
                                >
                                    {Array.from({ length: 24 }, (_, i) => i).map(h => {
                                        const isActive = pickerState.hours === h;
                                        return (
                                            <button
                                                key={h}
                                                data-val={h}
                                                onClick={() => updatePickerState({ hours: h })}
                                                className={`custom-time-scroll-item w-full h-[24px] flex items-center justify-center rounded text-[10px] font-medium transition-all cursor-pointer shrink-0 ${
                                                    isActive 
                                                        ? 'bg-[#007fd4] text-white font-semibold' 
                                                        : 'text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)]'
                                                }`}
                                            >
                                                {String(h).padStart(2, '0')}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Minutes Scroll Column */}
                                <div 
                                    ref={minutesRef}
                                    onScroll={() => handleScrollWithStop(minutesRef, false)}
                                    className="custom-time-scroll flex-1 overflow-y-auto pr-0.5 flex flex-col gap-0.5 h-full border-l border-[var(--dev-console-border)]/20 scroll-smooth py-[59px]"
                                >
                                    {Array.from({ length: 60 }, (_, i) => i).map(m => {
                                        const isActive = pickerState.minutes === m;
                                        return (
                                            <button
                                                key={m}
                                                data-val={m}
                                                onClick={() => updatePickerState({ minutes: m })}
                                                className={`custom-time-scroll-item w-full h-[24px] flex items-center justify-center rounded text-[10px] font-medium transition-all cursor-pointer shrink-0 ${
                                                    isActive 
                                                        ? 'bg-[#007fd4] text-white font-semibold' 
                                                        : 'text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)]'
                                                }`}
                                            >
                                                {String(m).padStart(2, '0')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer Utility Actions Panel */}
                    <div className="flex items-center justify-between border-t border-[var(--dev-console-border)]/50 pt-2 text-[9.5px] font-bold">
                        <button
                            onClick={handleSetNow}
                            className="text-[#34d399] hover:bg-[#34d399]/10 rounded px-1.5 py-1 transition-all cursor-pointer"
                        >
                            SET NOW
                        </button>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={handleClear}
                                className="text-red-400 hover:bg-red-500/10 rounded px-1.5 py-1 flex items-center gap-1 transition-all cursor-pointer"
                            >
                                <X size={10} /> CLEAR
                            </button>
                            <button
                                onClick={handleDone}
                                className="bg-[#007fd4] hover:bg-[#007fd4]/90 text-white rounded px-2 py-1 flex items-center gap-0.5 transition-all cursor-pointer shadow-sm shadow-[#007fd4]/10"
                            >
                                <Check size={10} /> SELECT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
