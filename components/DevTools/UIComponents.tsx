import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, EyeOff, Check, Copy } from 'lucide-react';
import { 
    highlightSearchMatchText, 
    getRelativeDateAnd24hTime, 
    formatSessionDateTime,
    formatSize
} from './utils';

// --- PREMIUM BRAND SVG LOGOS ---

export const ChromeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C8.21 0 4.83 2.11 3.03 5.23L7.79 13.5C8.11 11.02 10.15 9.11 12.65 9.11H22.18C21.2 3.88 17.06 0 12 0Z" fill="#EA4335"/>
    <path d="M5.4 6.27C2.17 8.04 0 11.49 0 15.44C0 19.16 1.95 22.42 4.93 24.23L9.7 15.96C8.89 15.44 8.35 14.53 8.35 13.5C8.35 12.28 9.11 11.23 10.17 10.82L5.4 6.27Z" fill="#34A853"/>
    <path d="M16.52 11.23C15.46 10.82 14.7 9.77 14.7 8.55C14.7 7.52 15.24 6.61 16.05 6.09L11.29 13.5L16.05 20.91C19.28 19.14 21.45 15.69 21.45 11.74C21.45 8.02 19.5 4.76 16.52 2.95V11.23Z" fill="#FBBC05"/>
    <circle cx="12" cy="13.5" r="3.73" fill="#4285F4"/>
  </svg>
);

export const SafariIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" fill="#007AFF" />
    <circle cx="12" cy="12" r="9" fill="#FFF" stroke="#0051C3" strokeWidth="0.8" />
    <line x1="12" y1="3" x2="12" y2="4.5" stroke="#007AFF" strokeWidth="0.8" />
    <line x1="12" y1="19.5" x2="12" y2="21" stroke="#007AFF" strokeWidth="0.8" />
    <line x1="3" y1="12" x2="4.5" y2="12" stroke="#007AFF" strokeWidth="0.8" />
    <line x1="19.5" y1="12" x2="21" y2="12" stroke="#007AFF" strokeWidth="0.8" />
    <path d="M12 12 L15 6 L12 12 L9 18 Z" fill="#FF3B30" />
    <path d="M12 12 L9 18 L12 12 L15 6 Z" fill="#EAEAEA" />
    <circle cx="12" cy="12" r="1.5" fill="#FFF" stroke="#0051C3" strokeWidth="0.5" />
  </svg>
);

export const FirefoxIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" fill="#3E2723" />
    <circle cx="11" cy="13" r="7" fill="#0062E3" />
    <path d="M21.5 10C21.5 6 18.5 3 14.5 3.5C12 3.8 11.2 5 10.5 5.5C9.5 6.2 8.5 6 7.5 5.5C6.5 5 6 6 6.5 7.5C7 9 6.5 10.5 5 11C3.5 11.5 3 13.5 4.5 15.5C6.5 18.5 10 20.5 14 20C18.5 19.5 21.5 15.5 21.5 10Z" fill="#FF9100" />
    <path d="M18.5 8C19 6 17.5 4.5 15.5 4.5C13.5 4.5 12.5 5.5 12 6.5C11.5 7.5 10.5 8.5 9 8.5C7.5 8.5 6.5 9.5 7 11C7.5 12.5 9 13.5 11 13C13.5 12.5 16 11 18.5 8Z" fill="#FF3D00" />
    <path d="M13.5 11.5C14.5 10.5 15 9.5 15 8.5C15 7.5 14.5 7 14 7C13 7 12 8 11.5 9C11 10 11 11 11.5 11.5C12 12 13 12.5 13.5 11.5Z" fill="#FFE082" />
  </svg>
);

export const EdgeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12H12V2Z" fill="#0078D4" className="opacity-10" />
    <path d="M2.1 12.3C2.3 8 5.4 4.5 10 4.1C13.5 3.8 17 5.5 18.8 8.5C19.5 9.8 19 11 17.5 11H10.5C9.1 11 8 12.1 8 13.5C8 14.9 9.1 16 10.5 16H20.1C20.5 16 20.8 16.3 20.8 16.7C20.4 19.5 17.8 21.6 14.8 21.9C10.5 22.3 6.3 20.1 4.1 16.5C2.8 14.3 2.1 12.4 2.1 12.3Z" fill="#0078D4" />
    <path d="M10.5 16C7.5 16 5.1 13.6 5.1 10.6C5.1 7.6 7.5 5.2 10.5 5.2C13.5 5.2 15.9 7.6 15.9 10.6H10.5V16Z" fill="#00F2FE" className="opacity-70" />
    <path d="M18.8 8.5C17 5.5 13.5 3.8 10 4.1C5.4 4.5 2.3 8 2.1 12.3C2.3 8.3 5.3 5.2 9.5 5.2C13.5 5.2 16.8 7.8 18.5 11.2C18.9 10.3 19 9.4 18.8 8.5Z" fill="#30C1D9" />
  </svg>
);

export const BraveIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 15 3.3 17.6 5.5 19.5L12 22L18.5 19.5C20.7 17.6 22 15 22 12C22 6.48 17.52 2 12 2ZM15.5 15.5L12 14L8.5 15.5L9.5 11.5L6.5 8.5L10.5 8L12 4.5L13.5 8L17.5 8.5L14.5 11.5L15.5 15.5Z" fill="#FF5000" />
  </svg>
);

export const OperaIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="12" rx="9" ry="11" fill="#FF1B2D" />
    <ellipse cx="12" cy="12" rx="4" ry="8" fill="#FFF" />
  </svg>
);

export const IEIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8" fill="#1F7AEE" />
    <path d="M2 12C2 12 6 6 12 6C18 6 22 12 22 12C22 12 18 18 12 18C6 18 2 12 2 12Z" fill="none" stroke="#FFCC00" strokeWidth="2.5" />
    <ellipse cx="12" cy="12" rx="4" ry="4" fill="#FFF" />
  </svg>
);

export const DefaultBrowserIcon = () => (
  <svg className="w-4 h-4 text-[#818cf8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const GoogleIcon = () => (
  <svg className="w-3.5 h-3.5 select-none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#fbbc05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335"/>
  </svg>
);

export const EmailIcon = () => (
  <svg className="w-3.5 h-3.5 text-[var(--dev-console-text-muted)] select-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export const WindowsIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 5.279L10.021 4.3V11.238H3V5.279ZM3 12.637H10.021V19.576L3 18.597V12.637ZM11.085 4.148L21 2.801V11.238H11.085V4.148ZM11.085 12.637H21V20.978L11.085 19.71V12.637Z" fill="#0078D6" />
  </svg>
);

export const AppleIcon = () => (
  <svg className="w-4 h-4 text-neutral-400 dark:text-neutral-300" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.48C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.1 16.67C20.08 16.74 19.67 18.11 18.71 19.5ZM15.97 4.17C16.63 3.37 17.07 2.28 16.95 1C15.98 1.04 14.81 1.65 14.11 2.47C13.5 3.17 12.97 4.28 13.12 5.54C14.2 5.62 15.31 4.97 15.97 4.17Z" />
  </svg>
);

export const AndroidIcon = () => (
  <svg className="w-4 h-4 text-[#3DDC84]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.523 15.3c-.551 0-1-.449-1-1 0-.551.449-1 1-1s1 .449 1 1c0 .551-.449 1-1 1zm-11.046 0c-.551 0-1-.449-1-1 0-.551.449-1 1-1s1 .449 1 1c0 .551-.449 1-1 1zm11.546-5.599l1.832-3.173a.498.498 0 1 0-.863-.5l-1.851 3.206C15.485 8.441 13.82 8 12 8s-3.485.441-4.887 1.234L5.262 6.028a.498.498 0 1 0-.863.5l1.832 3.173C3.606 11.231 2 13.722 2 16.6c0 .331.269.6.6.6h18.8c.331 0 .6-.269.6-.6 0-2.878-1.606-5.369-4.223-6.899z" />
  </svg>
);

export const LinuxIcon = () => (
  <svg className="w-4 h-4 text-[#f1c40f]" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C9.5 2 7 5.5 7 8.5C7 9.5 7.5 10.5 8 11C6.5 11.5 5 13 5 15C5 18 8 22 12 22C16 22 19 18 19 15C19 13 17.5 11.5 16 11C16.5 10.5 17 9.5 17 8.5C17 5.5 14.5 2 12 2ZM10.5 7.5C11 7.5 11.5 8 11.5 8.5C11.5 9 11 9.5 10.5 9.5C10 9.5 9.5 9 9.5 8.5C9.5 8 10 7.5 10.5 7.5ZM13.5 7.5C14 7.5 14.5 8 14.5 8.5C14.5 9 14 9.5 13.5 9.5C13 9.5 12.5 9 12.5 8.5C12.5 8 13 7.5 13.5 7.5ZM12 11C13 11 14 11.5 14 12C14 12.5 13 13 12 13C11 13 10 12.5 10 12C10 11.5 11 11 12 11Z" />
  </svg>
);

export const DefaultOSIcon = () => (
  <svg className="w-4 h-4 text-[#818cf8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export const BrowserIcon = ({ name }: { name: string }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const lower = name.toLowerCase();

    let logoUrl = '';
    if (lower.includes('chrome') || lower.includes('google chrome') || lower.includes('chromium')) {
        logoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/74.1.0/chrome/chrome.svg';
    } else if (lower.includes('safari') || lower.includes('apple safari')) {
        logoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/74.1.0/safari/safari.svg';
    } else if (lower.includes('firefox')) {
        logoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/74.1.0/firefox/firefox.svg';
    } else if (lower.includes('edge') || lower.includes('edg') || lower.includes('microsoft edge')) {
        logoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/74.1.0/edge/edge.svg';
    } else if (lower.includes('brave')) {
        logoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/74.1.0/brave/brave.svg';
    } else if (lower.includes('opera') || lower.includes('opr')) {
        logoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/74.1.0/opera/opera.svg';
    } else if (lower.includes('ie') || lower.includes('internet explorer') || lower.includes('msie')) {
        logoUrl = 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/74.1.0/archive/internet-explorer_9-11/internet-explorer_9-11.svg';
    }

    if (logoUrl && !imgFailed) {
        return (
            <img 
                src={logoUrl} 
                alt={name} 
                className="w-4 h-4 object-contain select-none pointer-events-none" 
                onError={() => setImgFailed(true)}
            />
        );
    }

    // Fallback to beautiful local SVGs if offline/fail
    if (lower.includes('chrome') || lower.includes('google chrome') || lower.includes('chromium')) return <ChromeIcon />;
    if (lower.includes('safari') || lower.includes('apple safari')) return <SafariIcon />;
    if (lower.includes('firefox')) return <FirefoxIcon />;
    if (lower.includes('edge') || lower.includes('edg') || lower.includes('microsoft edge')) return <EdgeIcon />;
    if (lower.includes('brave')) return <BraveIcon />;
    if (lower.includes('opera') || lower.includes('opr')) return <OperaIcon />;
    if (lower.includes('ie') || lower.includes('internet explorer') || lower.includes('msie')) return <IEIcon />;
    return <DefaultBrowserIcon />;
};

export const OSIcon = ({ name }: { name: string }) => {
    const lower = name.toLowerCase();

    if (lower.includes('windows')) return <WindowsIcon />;
    if (lower.includes('mac') || lower.includes('os x') || lower.includes('macos') || lower.includes('osx')) return <AppleIcon />;
    if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return <AppleIcon />;
    if (lower.includes('android')) return <AndroidIcon />;
    if (lower.includes('linux')) return <LinuxIcon />;
    return <DefaultOSIcon />;
};

export const DevSelect = ({ value, options, onChange, icon, align = 'left' }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const selectedLabel = options.find((o: any) => o.value == value)?.label || 'Select...';
    return (
        <div ref={ref} className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[9.5px] md:text-[10.5px] text-[var(--dev-console-text)] rounded px-1.5 py-1 outline-none font-sans w-full justify-between hover:bg-[var(--dev-console-bg-hover)] transition-colors focus:border-[#007fd4] h-[26px] md:h-7"
            >
                <div className="flex items-center gap-1 truncate w-full">
                    {icon && <span className="text-[var(--dev-console-text-muted)] shrink-0 scale-90">{icon}</span>}
                    <span className="truncate pr-0.5">{selectedLabel}</span>
                </div>
                <ChevronDown size={10} className={`text-[var(--dev-console-text-muted)] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1 min-w-[110px] md:w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded shadow-lg z-50 py-1 overflow-hidden`}>
                    {options.map((opt: any) => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full text-left px-2 py-1.5 text-[10px] md:text-[11px] font-sans hover:bg-[var(--dev-console-bg-hover)] transition-colors ${value == opt.value ? 'text-[#007fd4] bg-[#007fd4]/10' : 'text-[var(--dev-console-text)]'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export const LiveAvgTimeLeft = React.memo(({ items, ttlMs, isFiltered }: { items: any[], ttlMs?: number, isFiltered?: boolean }) => {
    const [now, setNow] = useState(Date.now());
    
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const activeItems = items.filter(i => {
        const limitMs = ttlMs || 7200000;
        return (now - i.timestamp) < limitMs && !i.isExpired;
    });

    const formatHHMMSS = (totalSeconds: number) => {
        if (totalSeconds <= 0) return "00:00:00";
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const avgRemainingMs = activeItems.length > 0 
        ? activeItems.reduce((acc, i) => {
            const limitMs = ttlMs || 7200000;
            return acc + Math.max(0, (i.timestamp + limitMs) - now);
        }, 0) / activeItems.length 
        : 0;

    const avgSecs = Math.round(avgRemainingMs / 1000);
    return <>{formatHHMMSS(avgSecs)}</>;
});

export const SessionDuration = React.memo(({
    startTime,
    endTime,
    initialDuration,
    status,
    isMinutes,
    onToggle
}: {
    startTime: string;
    endTime: string | null;
    initialDuration: number;
    status: string;
    isMinutes: boolean;
    onToggle: () => void;
}) => {
    const [elapsed, setElapsed] = useState(0);

    const isLive = status === 'active' || !endTime;

    useEffect(() => {
        if (!isLive) return;

        const calcElapsed = () => Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
        setElapsed(calcElapsed());

        const interval = setInterval(() => {
            setElapsed(calcElapsed());
        }, 1000);

        return () => clearInterval(interval);
    }, [startTime, isLive]);

    const durationSecs = isLive ? (elapsed > 0 ? elapsed : 0) : (initialDuration || 0);

    let durationDisplayVal = isMinutes ? '00:00' : '0s';
    if (durationSecs > 0) {
        if (isMinutes) {
            const hrs = Math.floor(durationSecs / 3600);
            const mins = Math.floor((durationSecs % 3600) / 60);
            const secs = durationSecs % 60;
            const mm = String(mins).padStart(2, '0');
            const ss = String(secs).padStart(2, '0');
            if (hrs > 0 || durationSecs >= 3600) {
                const hh = String(hrs).padStart(2, '0');
                durationDisplayVal = `${hh}:${mm}:${ss}`;
            } else {
                durationDisplayVal = `${mm}:${ss}`;
            }
        } else {
            durationDisplayVal = `${durationSecs}s`;
        }
    }

    return (
        <td 
            className="px-2 py-1.5 whitespace-nowrap text-center cursor-pointer text-[var(--dev-console-text)] hover:text-[#818cf8] transition-colors font-bold select-none"
            onClick={onToggle}
            title="Tap to convert to minutes"
        >
            {durationDisplayVal}
        </td>
    );
});

export const BrowserCell = React.memo(({ session, searchQuery, highlightEnabled }: { session: any, searchQuery?: string, highlightEnabled?: boolean }) => {
    const [toggled, setToggled] = useState(false);
    const browser = session.browser_name || "Unknown";
    
    return (
        <td 
            className="px-2 py-1.5 text-center cursor-pointer select-none"
            onClick={() => setToggled(!toggled)}
        >
            <div className="flex items-center justify-center min-h-[32px] transition-all duration-200">
                {!toggled ? (
                    <div className="flex items-center justify-center p-1.5 rounded-full bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)]/50 shadow-sm transition-transform duration-200 hover:scale-110" title={browser}>
                        <BrowserIcon name={browser} />
                    </div>
                ) : (
                    <span className="text-[10px] font-bold text-[#818cf8] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] px-2 py-0.5 rounded shadow-sm animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap">
                        {highlightSearchMatchText(browser, searchQuery || '', highlightEnabled || false, 'purple')}
                    </span>
                )}
            </div>
        </td>
    );
}, (prevProps, nextProps) => {
    return prevProps.session.browser_name === nextProps.session.browser_name &&
           prevProps.session.browser_version === nextProps.session.browser_version &&
           prevProps.searchQuery === nextProps.searchQuery &&
           prevProps.highlightEnabled === nextProps.highlightEnabled;
});

export const OSCell = React.memo(({ session, searchQuery, highlightEnabled }: { session: any, searchQuery?: string, highlightEnabled?: boolean }) => {
    const [toggled, setToggled] = useState(false);
    const os = session.os_name || "Unknown";
    
    return (
        <td 
            className="px-2 py-1.5 text-center cursor-pointer select-none"
            onClick={() => setToggled(!toggled)}
        >
            <div className="flex items-center justify-center min-h-[32px] transition-all duration-200">
                {!toggled ? (
                    <div className="flex items-center justify-center p-1.5 rounded-full bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)]/50 shadow-sm transition-transform duration-200 hover:scale-110" title={os}>
                        <OSIcon name={os} />
                    </div>
                ) : (
                    <span className="text-[10px] font-bold text-[#34d399] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] px-2 py-0.5 rounded shadow-sm animate-in fade-in zoom-in-95 duration-150 whitespace-nowrap">
                        {highlightSearchMatchText(os, searchQuery || '', highlightEnabled || false, 'purple')}
                    </span>
                )}
            </div>
        </td>
    );
}, (prevProps, nextProps) => {
    return prevProps.session.os_name === nextProps.session.os_name &&
           prevProps.session.os_version === nextProps.session.os_version &&
           prevProps.searchQuery === nextProps.searchQuery &&
           prevProps.highlightEnabled === nextProps.highlightEnabled;
});

export const RelativeTimestamp = React.memo(({ dateInput }: { dateInput: string | number | Date | null | undefined }) => {
    const [showExact, setShowExact] = useState(false);
    const { relativeDate, time24h, exactString } = getRelativeDateAnd24hTime(dateInput);

    if (relativeDate === '-') return <span>-</span>;

    return (
        <span 
            className="cursor-pointer select-none relative group/ts text-[var(--dev-console-text)] font-semibold border-b border-dashed border-[var(--dev-console-border)] pb-px whitespace-nowrap"
            onClick={(e) => {
                e.stopPropagation();
                setShowExact(!showExact);
            }}
            title="Tap/Hover to view exact time"
        >
            <span className="group-hover/ts:hidden inline">
                {showExact ? exactString : `${relativeDate} at ${time24h}`}
            </span>
            <span className="hidden group-hover/ts:inline">
                {exactString}
            </span>
        </span>
    );
}, (prevProps, nextProps) => {
    return prevProps.dateInput === nextProps.dateInput;
});

export const renderLogMessageWithBadges = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[[^\]]+\])/g);
    return (
        <span className="leading-relaxed">
            {parts.map((p, idx) => {
                if (p.startsWith('[') && p.endsWith(']')) {
                    const content = p.substring(1, p.length - 1);
                    return (
                        <span 
                            key={idx} 
                            className="inline-block px-1.5 py-0.5 mx-1 rounded text-[9px] sm:text-[10px] font-bold font-mono bg-[var(--dev-console-bg-active)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] select-none uppercase tracking-wider"
                        >
                            {content}
                        </span>
                    );
                }
                return <span key={idx}>{p}</span>;
            })}
        </span>
    );
};

export const TrendIndicator = ({ trend, format = (v) => v, invertColors = false, mode = 'immediate' }: { 
    trend: any | null | undefined, 
    format?: (v: any) => any, 
    invertColors?: boolean,
    mode?: 'immediate' | 'historical'
}) => {
    if (!trend) return null;
    
    const isHist = mode === 'historical' && trend.historicalAverage !== undefined;
    
    const diff = isHist ? trend.historicalDiff : trend.diff;
    const percent = isHist ? trend.historicalPercent : trend.percent;
    const previous = isHist ? trend.historicalAverage : trend.previous;
    const isIncrease = isHist ? trend.isHistIncrease : trend.isIncrease;
    
    if (diff === 0 || diff === undefined) return null;
    
    const isPositive = invertColors ? !isIncrease : isIncrease;
    const textColor = isPositive ? 'var(--dev-trend-pos)' : 'var(--dev-trend-neg)';
    
    const arrow = isIncrease ? "↑" : "↓";
    const percentStr = previous > 0 ? `${Math.abs(percent).toFixed(1)}%` : '';
    
    const tooltipLines = [
        `Immediate Prev: ${format(trend.previous)} (${trend.isIncrease ? '+' : '-'}${format(Math.abs(trend.diff))})`
    ];
    if (trend.historicalAverage !== undefined) {
        tooltipLines.push(`Historical Avg: ${format(trend.historicalAverage)} (${trend.isHistIncrease ? '+' : '-'}${format(Math.abs(trend.historicalDiff))} | ${trend.isHistIncrease ? '↑' : '↓'}${Math.abs(trend.historicalPercent).toFixed(1)}%)`);
    }
    if (trend.min !== undefined && trend.max !== undefined) {
        tooltipLines.push(`Historical Range: ${format(trend.min)} - ${format(trend.max)}`);
    }
    if (trend.historyCount) {
        tooltipLines.push(`History Snapshots: ${trend.historyCount}`);
    }
    const tooltip = tooltipLines.join('\n');
    
    return (
        <span 
            style={{ color: textColor }}
            className="inline-flex items-center gap-0.5 text-[8.5px] lg:text-[9.5px] font-bold font-mono tracking-tight shrink-0 whitespace-nowrap select-none leading-none cursor-help border-b border-dotted border-current/20" 
            title={tooltip}
        >
            <span>{arrow}</span>
            <span>{format(Math.abs(diff))}</span>
            {percentStr && <span className="opacity-75 ml-0.5">({percentStr})</span>}
        </span>
    );
};
