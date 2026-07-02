import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Network, X, Maximize2, Minimize2, Trash2, Copy, Check, ChevronRight, ChevronDown, ChevronUp, Filter, AlertTriangle, AlertCircle, Info as InfoIcon, Search, Database, Image, RefreshCw, Cpu, Loader2, MoreHorizontal, EyeOff, User, Clock, MapPin, Activity, Wifi, Smartphone, Key, Globe, Monitor, Compass } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

// --- PREMIUM BRAND SVG LOGOS ---

const ChromeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C8.21 0 4.83 2.11 3.03 5.23L7.79 13.5C8.11 11.02 10.15 9.11 12.65 9.11H22.18C21.2 3.88 17.06 0 12 0Z" fill="#EA4335"/>
    <path d="M5.4 6.27C2.17 8.04 0 11.49 0 15.44C0 19.16 1.95 22.42 4.93 24.23L9.7 15.96C8.89 15.44 8.35 14.53 8.35 13.5C8.35 12.28 9.11 11.23 10.17 10.82L5.4 6.27Z" fill="#34A853"/>
    <path d="M16.52 11.23C15.46 10.82 14.7 9.77 14.7 8.55C14.7 7.52 15.24 6.61 16.05 6.09L11.29 13.5L16.05 20.91C19.28 19.14 21.45 15.69 21.45 11.74C21.45 8.02 19.5 4.76 16.52 2.95V11.23Z" fill="#FBBC05"/>
    <circle cx="12" cy="13.5" r="3.73" fill="#4285F4"/>
  </svg>
);

const SafariIcon = () => (
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

const FirefoxIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" fill="#3E2723" />
    <circle cx="11" cy="13" r="7" fill="#0062E3" />
    <path d="M21.5 10C21.5 6 18.5 3 14.5 3.5C12 3.8 11.2 5 10.5 5.5C9.5 6.2 8.5 6 7.5 5.5C6.5 5 6 6 6.5 7.5C7 9 6.5 10.5 5 11C3.5 11.5 3 13.5 4.5 15.5C6.5 18.5 10 20.5 14 20C18.5 19.5 21.5 15.5 21.5 10Z" fill="#FF9100" />
    <path d="M18.5 8C19 6 17.5 4.5 15.5 4.5C13.5 4.5 12.5 5.5 12 6.5C11.5 7.5 10.5 8.5 9 8.5C7.5 8.5 6.5 9.5 7 11C7.5 12.5 9 13.5 11 13C13.5 12.5 16 11 18.5 8Z" fill="#FF3D00" />
    <path d="M13.5 11.5C14.5 10.5 15 9.5 15 8.5C15 7.5 14.5 7 14 7C13 7 12 8 11.5 9C11 10 11 11 11.5 11.5C12 12 13 12.5 13.5 11.5Z" fill="#FFE082" />
  </svg>
);

const EdgeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12H12V2Z" fill="#0078D4" className="opacity-10" />
    <path d="M2.1 12.3C2.3 8 5.4 4.5 10 4.1C13.5 3.8 17 5.5 18.8 8.5C19.5 9.8 19 11 17.5 11H10.5C9.1 11 8 12.1 8 13.5C8 14.9 9.1 16 10.5 16H20.1C20.5 16 20.8 16.3 20.8 16.7C20.4 19.5 17.8 21.6 14.8 21.9C10.5 22.3 6.3 20.1 4.1 16.5C2.8 14.3 2.1 12.4 2.1 12.3Z" fill="#0078D4" />
    <path d="M10.5 16C7.5 16 5.1 13.6 5.1 10.6C5.1 7.6 7.5 5.2 10.5 5.2C13.5 5.2 15.9 7.6 15.9 10.6H10.5V16Z" fill="#00F2FE" className="opacity-70" />
    <path d="M18.8 8.5C17 5.5 13.5 3.8 10 4.1C5.4 4.5 2.3 8 2.1 12.3C2.3 8.3 5.3 5.2 9.5 5.2C13.5 5.2 16.8 7.8 18.5 11.2C18.9 10.3 19 9.4 18.8 8.5Z" fill="#30C1D9" />
  </svg>
);

const BraveIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12C2 15 3.3 17.6 5.5 19.5L12 22L18.5 19.5C20.7 17.6 22 15 22 12C22 6.48 17.52 2 12 2ZM15.5 15.5L12 14L8.5 15.5L9.5 11.5L6.5 8.5L10.5 8L12 4.5L13.5 8L17.5 8.5L14.5 11.5L15.5 15.5Z" fill="#FF5000" />
  </svg>
);

const OperaIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="12" rx="9" ry="11" fill="#FF1B2D" />
    <ellipse cx="12" cy="12" rx="4" ry="8" fill="#FFF" />
  </svg>
);

const IEIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="8" fill="#1F7AEE" />
    <path d="M2 12C2 12 6 6 12 6C18 6 22 12 22 12C22 12 18 18 12 18C6 18 2 12 2 12Z" fill="none" stroke="#FFCC00" strokeWidth="2.5" />
    <ellipse cx="12" cy="12" rx="4" ry="4" fill="#FFF" />
  </svg>
);

const DefaultBrowserIcon = () => (
  <svg className="w-4 h-4 text-[#818cf8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const GoogleIcon = () => (
  <svg className="w-3.5 h-3.5 select-none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#fbbc05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335"/>
  </svg>
);

const EmailIcon = () => (
  <svg className="w-3.5 h-3.5 text-[var(--dev-console-text-muted)] select-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const WindowsIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 5.279L10.021 4.3V11.238H3V5.279ZM3 12.637H10.021V19.576L3 18.597V12.637ZM11.085 4.148L21 2.801V11.238H11.085V4.148ZM11.085 12.637H21V20.978L11.085 19.71V12.637Z" fill="#0078D6" />
  </svg>
);

const AppleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.48C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.1 16.67C20.08 16.74 19.67 18.11 18.71 19.5ZM15.97 4.17C16.63 3.37 17.07 2.28 16.95 1C15.98 1.04 14.81 1.65 14.11 2.47C13.5 3.17 12.97 4.28 13.12 5.54C14.2 5.62 15.31 4.97 15.97 4.17Z" />
  </svg>
);

const AndroidIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.523 15.3c-.551 0-1-.449-1-1 0-.551.449-1 1-1s1 .449 1 1c0 .551-.449 1-1 1zm-11.046 0c-.551 0-1-.449-1-1 0-.551.449-1 1-1s1 .449 1 1c0 .551-.449 1-1 1zm11.546-5.599l1.832-3.173a.498.498 0 1 0-.863-.5l-1.851 3.206C15.485 8.441 13.82 8 12 8s-3.485.441-4.887 1.234L5.262 6.028a.498.498 0 1 0-.863.5l1.832 3.173C3.606 11.231 2 13.722 2 16.6c0 .331.269.6.6.6h18.8c.331 0 .6-.269.6-.6 0-2.878-1.606-5.369-4.223-6.899z" />
  </svg>
);

const LinuxIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C9.5 2 7 5.5 7 8.5C7 9.5 7.5 10.5 8 11C6.5 11.5 5 13 5 15C5 18 8 22 12 22C16 22 19 18 19 15C19 13 17.5 11.5 16 11C16.5 10.5 17 9.5 17 8.5C17 5.5 14.5 2 12 2ZM10.5 7.5C11 7.5 11.5 8 11.5 8.5C11.5 9 11 9.5 10.5 9.5C10 9.5 9.5 9 9.5 8.5C9.5 8 10 7.5 10.5 7.5ZM13.5 7.5C14 7.5 14.5 8 14.5 8.5C14.5 9 14 9.5 13.5 9.5C13 9.5 12.5 9 12.5 8.5C12.5 8 13 7.5 13.5 7.5ZM12 11C13 11 14 11.5 14 12C14 12.5 13 13 12 13C11 13 10 12.5 10 12C10 11.5 11 11 12 11Z" />
  </svg>
);

const DefaultOSIcon = () => (
  <svg className="w-4 h-4 text-[#818cf8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const BrowserIcon = ({ name }: { name: string }) => {
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

const OSIcon = ({ name }: { name: string }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const lower = name.toLowerCase();

    let logoUrl = '';
    if (lower.includes('windows')) {
        logoUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/windows8/windows8-original.svg';
    } else if (lower.includes('mac') || lower.includes('os x') || lower.includes('macos') || lower.includes('osx')) {
        logoUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg';
    } else if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) {
        logoUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/apple/apple-original.svg';
    } else if (lower.includes('android')) {
        logoUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/android/android-original.svg';
    } else if (lower.includes('linux')) {
        logoUrl = 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg';
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
    if (lower.includes('windows')) return <WindowsIcon />;
    if (lower.includes('mac') || lower.includes('os x') || lower.includes('macos') || lower.includes('osx')) return <AppleIcon />;
    if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return <AppleIcon />;
    if (lower.includes('android')) return <AndroidIcon />;
    if (lower.includes('linux')) return <LinuxIcon />;
    return <DefaultOSIcon />;
};

const DevSelect = ({ value, options, onChange, icon }: any) => {
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
                className="flex items-center gap-1.5 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[11px] text-[var(--dev-console-text)] rounded px-2 py-1 outline-none font-sans w-full justify-between hover:bg-[var(--dev-console-bg-hover)] transition-colors focus:border-[#007fd4]"
            >
                <div className="flex items-center gap-1.5 truncate">
                    {icon && <span className="text-[var(--dev-console-text-muted)] shrink-0">{icon}</span>}
                    <span className="truncate">{selectedLabel}</span>
                </div>
                <ChevronDown size={12} className={`text-[var(--dev-console-text-muted)] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[140px] bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded shadow-lg z-50 py-1 overflow-hidden">
                    {options.map((opt: any) => (
                        <button
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full text-left px-3 py-1.5 text-[11px] font-sans hover:bg-[var(--dev-console-bg-hover)] transition-colors ${value == opt.value ? 'text-[#007fd4] bg-[#007fd4]/10' : 'text-[var(--dev-console-text)]'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const BrowserCell = ({ session }: { session: any }) => {
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
                        {browser}
                    </span>
                )}
            </div>
        </td>
    );
};

const OSCell = ({ session }: { session: any }) => {
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
                        {os}
                    </span>
                )}
            </div>
        </td>
    );
};

export type LogEntry = {
    id: string;
    type: 'log' | 'info' | 'warn' | 'error' | 'eval_result';
    timestamp: Date;
    args: any[];
};

export type NetEntry = {
    id: string;
    method: string;
    url: string;
    status: number | string;
    timestamp: Date;
    duration?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: any;
    responseBody?: any;
    requestSize?: number;
    responseSize?: number;
    fromConsole?: boolean;
};

// Global stores outside React
let logs: LogEntry[] = [];
let nets: NetEntry[] = [];
// Metrics
let totalSent = 0;
let totalReceived = 0;

let listeners: (() => void)[] = [];

const notify = () => listeners.forEach(l => l());

let isInitialized = false;

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getBodySize = (body: any) => {
    if (!body) return 0;
    if (typeof body === 'string') return new Blob([body]).size;
    try {
        return new Blob([JSON.stringify(body)]).size;
    } catch {
        return 0;
    }
};

const getRelativeDateAnd24hTime = (dateInput: string | number | Date | null | undefined) => {
    if (!dateInput) return { relativeDate: '-', time24h: '-', exactString: '-' };
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return { relativeDate: '-', time24h: '-', exactString: '-' };

    // Format 24-hour time
    const time24h = d.toLocaleTimeString('en-GB', { 
        timeZone: 'Asia/Kolkata', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });

    // Exact Date string e.g., "2 June 26, 14:30:15"
    const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Asia/Kolkata' });
    const year = d.toLocaleDateString('en-GB', { year: '2-digit', timeZone: 'Asia/Kolkata' });
    const exactString = `${day} ${month} ${year}, ${time24h}`;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relativeDate = '';
    if (diffMs < 0) {
        relativeDate = 'Today';
    } else if (diffDays === 0) {
        relativeDate = 'Today';
    } else if (diffDays === 1) {
        relativeDate = 'Yesterday';
    } else if (diffDays < 7) {
        relativeDate = `${diffDays} days ago`;
    } else if (diffDays >= 7 && diffDays < 14) {
        relativeDate = '1 week ago';
    } else if (diffDays >= 14 && diffDays < 21) {
        relativeDate = '2 weeks ago';
    } else if (diffDays >= 21 && diffDays < 30) {
        relativeDate = '3 weeks ago';
    } else if (diffDays >= 30 && diffDays < 60) {
        relativeDate = '1 month ago';
    } else if (diffDays >= 60 && diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        relativeDate = `${months} months ago`;
    } else {
        const years = Math.floor(diffDays / 365);
        relativeDate = years === 1 ? '1 year ago' : `${years} years ago`;
    }

    return { relativeDate, time24h, exactString };
};

const RelativeTimestamp = ({ dateInput }: { dateInput: string | number | Date | null | undefined }) => {
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
};

const formatSessionDateTime = (dateInput: string | number | Date | null | undefined) => {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    // Date part: e.g., "2 June 26"
    const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Asia/Kolkata' });
    const year = d.toLocaleDateString('en-GB', { year: '2-digit', timeZone: 'Asia/Kolkata' });
    
    // Time part: 24h format
    const time24h = d.toLocaleTimeString('en-GB', { 
        timeZone: 'Asia/Kolkata', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });

    return `${day} ${month} ${year}, ${time24h}`;
};

export const tryParseAndTruncateJson = (str: string, maxLength = 300, key?: string): string | null => {
    if (!str) return null;
    const trimmed = str.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            const parsed = JSON.parse(trimmed);
            const truncatedObj = truncateLongValuesInObject(parsed, maxLength, key);
            return JSON.stringify(truncatedObj);
        } catch {
            return null;
        }
    }
    return null;
};

export const shouldTruncate = (str: string, key?: string): boolean => {
    if (!str) return false;
    
    // 1. Identify human-friendly keys. We avoid truncating strings under these keys 
    // unless they exceed extreme thresholds (e.g., 5000 chars) to prevent freeze-ups.
    if (key) {
        const lowerKey = key.toLowerCase();
        const humanKeys = [
            'name', 'title', 'description', 'desc', 'text', 'content', 'message', 'msg', 
            'note', 'notes', 'summary', 'prompt', 'input', 'output', 'query', 'category', 'id',
            'source', 'author', 'email', 'subject', 'translated', 'translation', 'caption', 
            'status_text', 'display', 'label', 'value', 'formatted', 'result', 'reason', 'markdown'
        ];
        if (humanKeys.some(hk => lowerKey.includes(hk))) {
            if (str.length > 5000) return true;
            return false;
        }
    }

    const trimmed = str.trim();

    // 2. HTTP/HTTPS URLs: Allow up to 1500 characters so standard human links are never truncated
    if ((trimmed.startsWith('http:') || trimmed.startsWith('https:')) && !trimmed.startsWith('data:') && !trimmed.startsWith('blob:')) {
        if (trimmed.length > 1500) return true;
        return false;
    }

    // Always truncate if key suggests file data, base64, token, or URIs (that aren't standard web URLs)
    if (key) {
        const lowerKey = key.toLowerCase();
        if (
            lowerKey.includes('url') || 
            lowerKey.includes('chunk') || 
            lowerKey.includes('file') || 
            lowerKey.includes('avatar') || 
            lowerKey.includes('photo') || 
            lowerKey.includes('image') || 
            lowerKey.includes('audio') || 
            lowerKey.includes('video') || 
            lowerKey.includes('recording') || 
            lowerKey.includes('token') || 
            lowerKey.includes('key')
        ) {
            // For highly binary chunks, hashes, audio, base64 or raw secure tokens, truncate if length > 50
            if (lowerKey.includes('chunk') || lowerKey.includes('token') || lowerKey.includes('audio') || lowerKey.includes('recording') || lowerKey.includes('base64')) {
                if (str.length > 50) return true;
            } else {
                // For files, URLs, keys, images, photos, etc., let's allow up to 500 characters so they are fully readable
                if (str.length > 500) return true;
            }
        }
    }

    // Always truncate non-standard data URLs, blob URLs, or telegram storage paths or http URLs larger than 1500 characters
    if (
        trimmed.startsWith('data:') || 
        trimmed.startsWith('blob:')
    ) {
        return true;
    }
    
    // Telegram storage paths tg:// or paths up to 1500 characters
    if (trimmed.startsWith('tg://')) {
        if (trimmed.length > 1500) return true;
        return false;
    }
    
    // If the trimmed string is a path (contains slashes) or a file-like URL, allow up to 1000 characters
    const isPathOrUrl = trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('%20');
    if (isPathOrUrl) {
        if (trimmed.length > 1000) {
            return true;
        }
        return false;
    }
    
    // Robust detection: Calculate maximum continuous word length (length without any whitespace)
    // Genuine readable text (articles, notes, logs, messages) consists of normal words separated by spaces.
    // Extremely long words (>50 characters) mean it's base64, a hex string, or a huge raw token.
    const words = trimmed.split(/\s+/);
    
    // If it's a multi-word string and has normal human-like spacing:
    if (words.length > 2) {
        // Count how many words are abnormally long (>50 chars)
        const longWords = words.filter(w => w.length > 50);
        // If the vast majority of words are normal, it's likely a sentence/human text, even if it has a long URL or token inside
        if (longWords.length / words.length < 0.2) {
            return false;
        }
    }
    
    const maxWordLength = Math.max(...words.map(w => w.length));
    if (maxWordLength > 50) {
        return true;
    }
    
    // Low whitespace density check: base64/hex blocks contain absolutely zero spaces.
    const spaces = str.match(/\s/g)?.length || 0;
    if (spaces === 0 && str.length > 50) {
        return true;
    }
    
    // Low whitespace density for longer texts
    if (str.length > 120) {
        if (spaces < 5 || (spaces / str.length) < 0.05) {
            return true;
        }
    }
    
    return false;
};

export const truncateString = (str: string, maxLength = 150, key?: string): string => {
    if (!str) return str;
    
    // Try parsing as JSON first to cleanly format nested objects
    const jsonParsed = tryParseAndTruncateJson(str, maxLength, key);
    if (jsonParsed !== null) {
        return jsonParsed;
    }
    
    if (!shouldTruncate(str, key)) return str;
    
    // For non-human binary data or URLs that should be truncated, we use a comfortable display threshold
    const effectiveLimit = 80;
    if (str.length <= effectiveLimit) return str;
    const half = Math.floor((effectiveLimit - 12) / 2);
    return str.substring(0, half) + `...[TRUNCATED ${str.length - (half * 2)} chars]...` + str.substring(str.length - half);
};

export const truncateLongValuesInObject = (obj: any, maxLength = 300, key?: string): any => {
    if (typeof obj === 'string') {
        const jsonParsed = tryParseAndTruncateJson(obj, maxLength, key);
        if (jsonParsed !== null) {
            return jsonParsed;
        }
        return truncateString(obj, maxLength, key);
    }
    if (Array.isArray(obj)) {
        const isBinaryKey = key && (
            key.toLowerCase().includes('chunk') || 
            key.toLowerCase().includes('audio') || 
            key.toLowerCase().includes('recording') || 
            key.toLowerCase().includes('base64') ||
            key.toLowerCase().includes('bytes') ||
            key.toLowerCase().includes('raw')
        );

        const processed = obj.map(item => truncateLongValuesInObject(item, maxLength, key));
        
        // Only truncate the array itself if it is explicitly a binary chunk/payload container
        if (isBinaryKey && processed.length > 3) {
            const firstN = processed.slice(0, 2);
            return [
                ...firstN,
                `... [TRUNCATED ${processed.length - 2} additional items of total array of ${processed.length}] ...`
            ];
        }
        
        // For standard data/human containers, do not truncate the array. Return all processed elements.
        return processed;
    }
    if (typeof obj === 'object' && obj !== null) {
        try {
            const copy: any = {};
            for (const [k, value] of Object.entries(obj)) {
                if (typeof value === 'string') {
                    copy[k] = truncateString(value, maxLength, k);
                } else {
                    copy[k] = truncateLongValuesInObject(value, maxLength, k);
                }
            }
            return copy;
        } catch {
            return obj;
        }
    }
    return obj;
};

export const safeStringifyWithTruncation = (val: any, space = 2, maxLength = 300): string => {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'string') {
        try {
            const trimmed = val.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                const parsed = JSON.parse(trimmed);
                const truncatedObj = truncateLongValuesInObject(parsed, maxLength);
                return JSON.stringify(truncatedObj, null, space);
            }
        } catch {}
        return truncateString(val, maxLength);
    }
    if (typeof val !== 'object') {
        return String(val);
    }
    try {
        const truncatedObj = truncateLongValuesInObject(val, maxLength);
        return JSON.stringify(truncatedObj, null, space);
    } catch {
        return String(val);
    }
};

export const initDevStore = () => {
    if (isInitialized || typeof window === 'undefined') return;
    isInitialized = true;

    // --- Console Overrides ---
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    const addLog = (type: 'log' | 'info' | 'warn' | 'error', args: any[]) => {
        logs.push({
            id: Math.random().toString(36).slice(2, 9),
            type,
            timestamp: new Date(),
            args: args.map(a => {
                try {
                    if (a instanceof Error) {
                        return `${a.name}: ${a.message}\n${a.stack || ''}`;
                    }
                    if (typeof a === 'object' && a !== null) {
                        let str = safeStringifyWithTruncation(a, 2);
                        if (str === '{}') {
                            const props = Object.getOwnPropertyNames(a);
                            if (props.length > 0) {
                                const obj: any = {};
                                props.forEach(p => obj[p] = (a as any)[p]);
                                str = safeStringifyWithTruncation(obj, 2);
                            }
                        }
                        return str;
                    }
                    return safeStringifyWithTruncation(a, 2);
                } catch {
                    return String(a);
                }
            })
        });
        if (logs.length > 1000) logs.shift(); // Keep last 1000
        notify();
    };

        console.log = (...args) => { originalConsole.log(...args); addLog('log', args); };
    console.info = (...args) => { originalConsole.info(...args); addLog('info', args); };
    console.warn = (...args) => { originalConsole.warn(...args); addLog('warn', args); };
    console.error = (...args) => { originalConsole.error(...args); addLog('error', args); };

    // --- Fetch Override ---
    const originalFetch = window.fetch;
    try {
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            writable: true,
            value: async (...args: Parameters<typeof window.fetch>) => {
                const id = Math.random().toString(36).slice(2, 9);
                const url = (args[0] instanceof Request) ? args[0].url : String(args[0]);
                const method = (args[0] instanceof Request) ? args[0].method : (args[1]?.method || 'GET');
                let requestBody = undefined;
                if (args[1]?.body) {
                    try {
                        requestBody = typeof args[1].body === 'string' ? JSON.parse(args[1].body) : args[1].body;
                    } catch {
                        requestBody = args[1].body;
                    }
                }
                
                let reqHeaders: Record<string, string> = {};
                if (args[1]?.headers) {
                    try {
                        reqHeaders = Object.fromEntries(new Headers(args[1].headers).entries());
                    } catch (e) {}
                }

                let reqSize = getBodySize(requestBody);

                const entry: NetEntry = {
                    id,
                    url,
                    method,
                    status: 'pending',
                    timestamp: new Date(),
                    requestHeaders: reqHeaders,
                    requestBody,
                    requestSize: reqSize,
                    fromConsole: !!(window as any).__fromConsole
                };
                nets.push(entry);
                totalSent += reqSize;
                if (nets.length > 500) nets.shift(); // Keep last 500
                notify();

                const startTime = performance.now();
                try {
                    const response = await originalFetch(...args);
                    const duration = Math.round(performance.now() - startTime);
                    const target = nets.find(n => n.id === id);
                    if (target) {
                        target.status = response.status;
                        target.duration = duration;
                        let respSize = 0;
                        const lenHeader = response.headers.get('content-length');
                        if (lenHeader) respSize = parseInt(lenHeader, 10);
                        
                        try {
                            const clone = response.clone();
                            const text = await clone.text();
                            if (!respSize) respSize = new Blob([text]).size;
                            try { target.responseBody = JSON.parse(text); } 
                            catch { target.responseBody = text; }
                        } catch (e) {
                            target.responseBody = '[Could not read body]';
                        }
                        
                        let resHeaders: Record<string, string> = {};
                        try { resHeaders = Object.fromEntries(response.headers.entries()); } catch(e) {}
                        target.responseHeaders = resHeaders;
                        
                        target.responseSize = respSize;
                        totalReceived += respSize;
                        notify();
                    }
                    return response;
                } catch (e: any) {
                    const duration = Math.round(performance.now() - startTime);
                    const target = nets.find(n => n.id === id);
                    if (target) {
                        target.status = 'error';
                        target.duration = duration;
                        notify();
                    }
                    throw e;
                }
            }
        });
    } catch (err) {
        console.warn("Could not override window.fetch for DevConsole", err);
    }

    // --- XHR Override ---
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(this: XMLHttpRequest & { _devId?: string, _reqHeaders?: Record<string, string> }, method: string, url: string | URL, ...rest: any[]) {
        const id = Math.random().toString(36).slice(2, 9);
        this._devId = id;
        this._reqHeaders = {};
        nets.push({
            id,
            url: String(url),
            method,
            status: 'pending',
            timestamp: new Date(),
            requestHeaders: this._reqHeaders,
            fromConsole: !!(window as any).__fromConsole
        });
        if (nets.length > 500) nets.shift();
        notify();
        // @ts-ignore
        return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.setRequestHeader = function(this: XMLHttpRequest & { _reqHeaders?: Record<string, string> }, header: string, value: string) {
        if (this._reqHeaders) {
            this._reqHeaders[header] = value;
        }
        return originalSetRequestHeader.apply(this, [header, value]);
    };

    XMLHttpRequest.prototype.send = function(this: XMLHttpRequest & { _devId?: string, _reqSize?: number }, body?: Document | XMLHttpRequestBodyInit | null) {
        const id = this._devId;
        const startTime = performance.now();
        this._reqSize = getBodySize(body);
        if (id && this._reqSize) {
           const target = nets.find(n => n.id === id);
           if (target) target.requestSize = this._reqSize;
           totalSent += this._reqSize;
        }

        if (id) {
            const updateNet = (status: number | string, isError = false) => {
                const target = nets.find(n => n.id === id);
                if (target) {
                    target.status = status;
                    target.duration = Math.round(performance.now() - startTime);
                    if (body) {
                         try { target.requestBody = typeof body === 'string' ? JSON.parse(body) : body; } 
                         catch { target.requestBody = body; }
                    }
                    let respSize = 0;
                    if (!isError) {
                        try {
                            target.responseBody = this.responseType === '' || this.responseType === 'text' ? JSON.parse(this.responseText) : this.response;
                        } catch {
                            target.responseBody = this.responseText || this.response;
                        }
                        
                        const lenHeader = this.getResponseHeader('content-length');
                        if (lenHeader) respSize = parseInt(lenHeader, 10);
                        else respSize = getBodySize(this.responseText || this.response);
                        
                        const headersStr = this.getAllResponseHeaders();
                        const headersObj: Record<string, string> = {};
                        headersStr.trim().split(/[\r\n]+/).forEach(line => {
                            const parts = line.split(': ');
                            const head = parts.shift();
                            const val = parts.join(': ');
                            if (head) headersObj[head.toLowerCase()] = val;
                        });
                        target.responseHeaders = headersObj;
                    }
                    target.responseSize = respSize;
                    totalReceived += respSize;
                    notify();
                }
            };
            this.addEventListener('load', () => updateNet(this.status));
            this.addEventListener('error', () => updateNet('error', true));
        }
        return originalSend.apply(this, [body]);
    };
};

const renderLogMessageWithBadges = (text: string) => {
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

export const DevConsole = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showHideConfirmation, setShowHideConfirmation] = useState(false);
    const [activeTab, setActiveTab] = useState<'console' | 'network' | 'cache' | 'image-cache' | 'session-cache' | 'server-logs'>('console');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showDetailedTransfers, setShowDetailedTransfers] = useState(false);
    
    // Server Logs states
    const [serverLogsList, setServerLogsList] = useState<{ id: string; type: 'log' | 'info' | 'warn' | 'error'; timestamp: string; message: string }[]>([]);
    const [serverLogsFilter, setServerLogsFilter] = useState('');
    const [serverLogsLevel, setServerLogsLevel] = useState<'all' | 'log' | 'info' | 'warn' | 'error'>('all');
    
    const fetchServerLogs = async () => {
        try {
            const response = await fetch('/api/server-logs');
            if (response.ok) {
                const data = await response.json();
                if (data.logs) {
                    setServerLogsList(data.logs);
                }
            }
        } catch (e) {}
    };
    
    // Session Cache states
    const [sessionCacheData, setSessionCacheData] = useState<Record<string, any>>({});
    const [sessionCacheSearchInput, setSessionCacheSearchInput] = useState('');
    const [sessionCacheSearch, setSessionCacheSearch] = useState('');
    const [sessionCacheLimit, setSessionCacheLimit] = useState(() => {
        const saved = localStorage.getItem('dev_session_limit');
        return saved ? Number(saved) : 100;
    });
    const [sessionCacheStatus, setSessionCacheStatus] = useState(() => {
        return localStorage.getItem('dev_session_status') || 'all';
    });
    const [sessionCacheTime, setSessionCacheTime] = useState(() => {
        return localStorage.getItem('dev_session_time') || 'all';
    });

    useEffect(() => {
        localStorage.setItem('dev_session_limit', sessionCacheLimit.toString());
    }, [sessionCacheLimit]);

    useEffect(() => {
        localStorage.setItem('dev_session_status', sessionCacheStatus);
    }, [sessionCacheStatus]);

    useEffect(() => {
        localStorage.setItem('dev_session_time', sessionCacheTime);
    }, [sessionCacheTime]);
    const [isSessionCacheLoading, setIsSessionCacheLoading] = useState(false);
    const [isSessionCacheLoaded, setIsSessionCacheLoaded] = useState(false);
    const [sessionDurationUnits, setSessionDurationUnits] = useState<Record<string, 's' | 'm'>>({});
    const [netDurationUnits, setNetDurationUnits] = useState<Record<string, 'ms' | 's' | 'm'>>({});
    const [tick, setTick] = useState(0);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const [showMassDeleteConfirm, setShowMassDeleteConfirm] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState<{ hashId: string; deviceModel: string } | null>(null);

    useEffect(() => {
        if (activeTab !== 'session-cache') return;
        const interval = setInterval(() => {
            setTick((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeTab]);

    const fetchSessionCacheData = async (force = false) => {
        setIsSessionCacheLoading(true);
        try {
            const base = `/api/session-cache?action=get${force ? '&force=true' : ''}`;
            const params = new URLSearchParams();
            if (sessionCacheSearch) params.append('search', sessionCacheSearch);
            if (sessionCacheLimit) params.append('limit', sessionCacheLimit.toString());
            if (sessionCacheStatus !== 'all') params.append('status', sessionCacheStatus);
            if (sessionCacheTime !== 'all') params.append('timeRange', sessionCacheTime);
            
            const query = params.toString();
            const url = query ? `${base}&${query}` : base;

            const response = await fetch(url);
            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                const data = await response.json();
                setSessionCacheData(data.data || data);
                setIsSessionCacheLoaded(true);
            } else {
                console.warn(`[DevConsole] /api/session-cache?action=get returned non-JSON response or error status: ${response.status}`);
            }
        } catch (err) {
            console.error("Failed to fetch session cache data:", err);
        } finally {
            setIsSessionCacheLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab !== 'session-cache') return;
        const handler = setTimeout(() => {
            fetchSessionCacheData(true);
        }, 300);
        return () => clearTimeout(handler);
    }, [sessionCacheSearch, sessionCacheLimit, sessionCacheStatus, sessionCacheTime, activeTab]);

    useEffect(() => {
        if (activeTab !== 'session-cache') return;
        
        let eventSource: EventSource | null = null;
        try {
            eventSource = new EventSource('/api/session-cache/stream');
            eventSource.onmessage = (event: MessageEvent) => {
                try {
                    if (event.data) {
                        fetchSessionCacheData(true);
                    }
                } catch (err) {
                    console.error("[SSE DevConsole Session Cache] Failed to parse stream event:", err);
                }
            };
            eventSource.onerror = (err) => {
                if (import.meta.env.DEV) {
                    console.warn("[SSE DevConsole Session Cache] EventSource connection update:", err);
                }
            };
        } catch (e) {
            console.error("[SSE DevConsole Session Cache] Failed to initialize EventSource:", e);
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [activeTab]);
    
    // Image Cache management states
    const [serverImageCacheSummary, setServerImageCacheSummary] = useState<{ count: number; totalSizeBytes: number; items: any[] }>({ count: 0, totalSizeBytes: 0, items: [] });
    const [isClearingServerImageCache, setIsClearingServerImageCache] = useState(false);
    const [imageCacheSearch, setImageCacheSearch] = useState('');
    const [isImageCacheLoading, setIsImageCacheLoading] = useState(false);
    const [isImageCacheLoaded, setIsImageCacheLoaded] = useState(false);

    const fetchImageCacheData = async () => {
        setIsImageCacheLoading(true);
        try {
            const sResponse = await fetch('/api/image-cache-status');
            if (sResponse.ok) {
                const sData = await sResponse.json();
                setServerImageCacheSummary(sData);
                setIsImageCacheLoaded(true);
            }
        } catch (err) {
            console.error("Failed to fetch image cache statistics:", err);
        } finally {
            setIsImageCacheLoading(false);
        }
    };

    const handleClearServerImageCache = async () => {
        setIsClearingServerImageCache(true);
        try {
            const response = await fetch('/api/image-cache-clear', {
                method: 'POST'
            });
            if (response.ok) {
                await fetchImageCacheData();
            }
        } catch (err) {
             console.error("Failed to clear server image cache:", err);
        } finally {
            setIsClearingServerImageCache(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'image-cache') {
            if (!isImageCacheLoaded) {
                fetchImageCacheData();
            }
        }
    }, [activeTab, isImageCacheLoaded]);
    
    // Cache management states
    const [cacheData, setCacheData] = useState<Record<string, string | null>>({});
    const [cacheSearch, setCacheSearch] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newName, setNewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [cacheStatusMessage, setCacheStatusMessage] = useState('');
    const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
    const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null);
    const [isDeviceCacheLoading, setIsDeviceCacheLoading] = useState(false);
    const [isDeviceCacheLoaded, setIsDeviceCacheLoaded] = useState(false);
    const [persistentDeviceId, setPersistentDeviceId] = useState<string>('');

    // Gemini Live Resolver Test states
    const [testModel, setTestModel] = useState('');
    const [resolverResult, setResolverResult] = useState<any | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [testError, setTestError] = useState('');

    const fetchCacheData = async () => {
        setIsDeviceCacheLoading(true);
        try {
            try {
                const { getPersistentDeviceId } = await import('../utils/deviceUtils');
                const pId = await getPersistentDeviceId();
                setPersistentDeviceId(pId);
            } catch (pIdErr) {
                console.warn("Failed to get persistent device id:", pIdErr);
            }
            
            const response = await fetch('/api/device-mapper?action=cache_list');
            if (response.ok) {
                const data = await response.json();
                setCacheData(data);
                setIsDeviceCacheLoaded(true);
            }
        } catch (err) {
            console.error("Failed to fetch device cache data:", err);
        } finally {
            setIsDeviceCacheLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'cache') {
            if (!isDeviceCacheLoaded) {
                fetchCacheData();
            }
        }
    }, [activeTab, isDeviceCacheLoaded]);

    // Fetch server logs in the background using SSE (Server-Sent Events) to keep real-time updates and counts
    useEffect(() => {
        let eventSource: EventSource | null = null;
        let streamServiceClosed = false;
        
        const handleCustomServerLog = (e: any) => {
            if (e.detail) {
                setServerLogsList(prev => {
                    const logObj = {
                        id: Math.random().toString(36).slice(2, 9),
                        type: e.detail.type || 'log',
                        timestamp: e.detail.timestamp || new Date().toISOString(),
                        message: e.detail.message
                    };
                    const updated = [...prev, logObj];
                    return updated.length > 2000 ? updated.slice(updated.length - 2000) : updated;
                });
            }
        };
        window.addEventListener('add-server-log', handleCustomServerLog);
        
        try {
            eventSource = new EventSource('/api/server-logs/stream');
            
            // Listen for the complete initial list of server logs
            eventSource.addEventListener('initial', (event: MessageEvent) => {
                try {
                    const logs = JSON.parse(event.data);
                    if (Array.isArray(logs)) {
                        setServerLogsList(logs);
                        // If we are in serverless production mode, close the connection immediately
                        // to prevent browser EventSource from entering an infinite reconnect loop.
                        if (logs.some(l => l.id === 'prod-mode')) {
                            streamServiceClosed = true;
                            eventSource?.close();
                        }
                    }
                } catch (err) {
                    console.error("[SSE DevConsole] Failed to parse initial load:", err);
                }
            });
            
            // Listen to stream messages for individual new log entries
            eventSource.onmessage = (event: MessageEvent) => {
                if (streamServiceClosed) return;
                try {
                    const newLog = JSON.parse(event.data);
                    if (newLog && newLog.id) {
                        setServerLogsList(prev => {
                            if (prev.some(l => l.id === newLog.id)) return prev;
                            const updated = [...prev, newLog];
                            return updated.length > 2000 ? updated.slice(updated.length - 2000) : updated;
                        });
                    }
                } catch (err) {
                    console.error("[SSE DevConsole] Failed to parse stream event:", err);
                }
            };
            
            // Listen to a clear logs trigger sent by the server
            eventSource.addEventListener('clear', () => {
                setServerLogsList([]);
            });
            
            eventSource.onerror = (err) => {
                if (streamServiceClosed) return;
                // Avoid logging normal serverless disconnects on production console outside of local development mode
                if (import.meta.env.DEV) {
                    console.warn("[SSE DevConsole] EventSource connection update:", err);
                }
            };
        } catch (e) {
            console.error("[SSE DevConsole] Failed to initialize EventSource, falling back to one-time query:", e);
            fetchServerLogs();
        }
        
        return () => {
            window.removeEventListener('add-server-log', handleCustomServerLog);
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []);
    const [expandedNetId, setExpandedNetId] = useState<string | null>(null);
    const [highlightedNetId, setHighlightedNetId] = useState<string | null>(null);
    
    // Filters
    const [consoleFilter, setConsoleFilter] = useState('');
    const [consoleLevel, setConsoleLevel] = useState<'all' | 'log' | 'info' | 'warn' | 'error'>('all');
    const [networkFilter, setNetworkFilter] = useState('');
    const [netDetailTab, setNetDetailTab] = useState<'headers' | 'payload' | 'response'>('headers');
    
    const [consoleInput, setConsoleInput] = useState('');
    const [contextMenu, setContextMenu] = useState<{x: number, y: number, netId: string} | null>(null);

    // Subscribe to store
    const [, forceRender] = useState(0);
    useEffect(() => {
        const listener = () => forceRender(n => n + 1);
        listeners.push(listener);
        
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        
        return () => {
            listeners = listeners.filter(l => l !== listener);
            window.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const processResult = async (val: any) => {
        if (val instanceof Response) {
            try {
                const clone = val.clone();
                let text = await clone.text();
                try { return JSON.stringify(JSON.parse(text), null, 2); } 
                catch { return text || `Response { status: ${val.status} }`; }
            } catch {
                return `Response { status: ${val.status} }`;
            }
        }
        if (val === null) return 'null';
        if (typeof val === 'object') {
            try {
                const str = JSON.stringify(val, null, 2);
                if (str === '{}' && val.toString() !== '[object Object]') return val.toString();
                return str;
            } catch { return String(val); }
        }
        return String(val);
    };

    const handleRunJS = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!consoleInput.trim()) return;
        
        const input = consoleInput;
        setConsoleInput('');
        
        // Use timeout to let state clear input first
        setTimeout(() => {
            (window as any).__fromConsole = true;
            try {
                logs.push({
                    id: Math.random().toString(36).slice(2, 9),
                    type: 'log',
                    timestamp: new Date(),
                    args: [`> ${input}`]
                });
                
                let result;
                try {
                    result = (window as any).eval(`(${input})`);
                } catch (e) {
                    result = (window as any).eval(input);
                }
                
                if (result instanceof Promise) {
                    result.then(async (val) => {
                        const formatted = await processResult(val);
                        logs.push({
                            id: Math.random().toString(36).slice(2, 9),
                            type: 'eval_result',
                            timestamp: new Date(),
                            args: [formatted]
                        });
                        forceRender(n => n + 1);
                    }).catch(err => {
                        logs.push({
                            id: Math.random().toString(36).slice(2, 9),
                            type: 'error',
                            timestamp: new Date(),
                            args: [String(err)]
                        });
                        forceRender(n => n + 1);
                    });
                } else if (result !== undefined) {
                    processResult(result).then(formatted => {
                        logs.push({
                            id: Math.random().toString(36).slice(2, 9),
                            type: 'eval_result',
                            timestamp: new Date(),
                            args: [formatted]
                        });
                        forceRender(n => n + 1);
                    });
                }
                forceRender(n => n + 1);
            } catch (error: any) {
                console.error(error);
            } finally {
                setTimeout(() => { (window as any).__fromConsole = false; }, 50);
            }
        }, 10);
    };

    const handleContextMenu = (e: React.MouseEvent, netId: string) => {
        e.preventDefault(); // Prevent default browser context menu
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, netId });
    };

    const logsEndRef = useRef<HTMLDivElement>(null);
    const netsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    const prevNetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (isOpen && activeTab === 'console') {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (isOpen && activeTab === 'network') {
            // Only scroll to bottom if we are NOT returning from detail view
            if (!expandedNetId && prevNetIdRef.current === null && !highlightedNetId) {
                netsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        prevNetIdRef.current = expandedNetId;
    }, [logs.length, nets.length, isOpen, activeTab, expandedNetId, consoleFilter, consoleLevel, networkFilter, highlightedNetId]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleCopyAll = () => {
        if (activeTab === 'console') {
            const allText = logs.map(l => {
                const istStr = l.timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
                return `[${istStr}] ${l.type.toUpperCase()}: ${l.args.join(' ')}`;
            }).join('\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-console');
        } else if (activeTab === 'server-logs') {
            const allText = serverLogsList.map(l => {
                const dateStr = new Date(l.timestamp).toLocaleString();
                return `[${dateStr}] ${l.type.toUpperCase()}: ${l.message}`;
            }).join('\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-server-logs');
        } else {
            const allText = nets.map(n => {
                const istStr = n.timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
                let parts = [`[${istStr}] ${n.method} ${n.url} - ${n.status} (${n.duration}ms)`];
                if (n.requestBody) parts.push(`Payload: ${safeStringifyWithTruncation(n.requestBody, 2)}`);
                if (n.responseBody) parts.push(`Response: ${safeStringifyWithTruncation(n.responseBody, 2)}`);
                return parts.join('\n');
            }).join('\n\n-------------------\n\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-network');
        }
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleClear = async () => {
        if (activeTab === 'console') {
            logs = [];
        } else if (activeTab === 'server-logs') {
            try {
                const response = await fetch('/api/server-logs-clear', { method: 'POST' });
                if (response.ok) {
                    setServerLogsList([]);
                }
            } catch (e) {}
        } else {
            nets = [];
            totalSent = 0;
            totalReceived = 0;
            setExpandedNetId(null);
        }
        forceRender(n => n + 1);
    };



    const filteredLogs = logs.filter(log => {
        if (consoleLevel !== 'all' && log.type !== consoleLevel) return false;
        if (consoleFilter && !log.args.join(' ').toLowerCase().includes(consoleFilter.toLowerCase())) return false;
        return true;
    });

    const filteredServerLogs = serverLogsList.filter(log => {
        if (serverLogsLevel !== 'all' && log.type !== serverLogsLevel) return false;
        if (serverLogsFilter && !log.message.toLowerCase().includes(serverLogsFilter.toLowerCase())) return false;
        return true;
    });

    const filteredNets = nets.filter(net => {
        if (networkFilter && !net.url.toLowerCase().includes(networkFilter.toLowerCase())) return false;
        return true;
    });

    const getEnvironmentStats = () => {
        let localSent = 0, localReceived = 0;
        let supabaseSent = 0, supabaseReceived = 0;
        let externalSent = 0, externalReceived = 0;

        nets.forEach(net => {
            const lowerUrl = (net.url || '').toLowerCase();
            const sent = net.requestSize || 0;
            const received = net.responseSize || 0;

            const isSupabaseRoute = 
                lowerUrl.includes('/api/db/query') || 
                lowerUrl.includes('/api/news') || 
                lowerUrl.includes('/api/sessions') || 
                lowerUrl.includes('/api/device-mapper') || 
                lowerUrl.includes('/api/debug-triggers') || 
                lowerUrl.includes('/api/debug-news-keys');

            if (isSupabaseRoute || lowerUrl.includes('supabase.co') || lowerUrl.includes('supabase.net') || lowerUrl.includes('supabase')) {
                supabaseSent += sent;
                supabaseReceived += received;
            } else if (lowerUrl.startsWith('/') || lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1') || lowerUrl.includes(window.location.host)) {
                localSent += sent;
                localReceived += received;
            } else {
                externalSent += sent;
                externalReceived += received;
            }
        });

        return {
            local: { sent: localSent, received: localReceived },
            supabase: { sent: supabaseSent, received: supabaseReceived },
            external: { sent: externalSent, received: externalReceived }
        };
    };

    const selectedNet = nets.find(n => n.id === expandedNetId);

    const getStatusColor = (status: number | string) => {
        if (status === 'pending') return 'text-yellow-600 dark:text-yellow-400';
        if (status === 'error' || (typeof status === 'number' && status >= 400)) return 'text-red-600 dark:text-[#f48771]';
        return 'text-green-700 dark:text-[#89d185]';
    };

    const getStatusText = (status: number | string) => {
        if (typeof status !== 'number') return '';
        switch(status) {
            case 200: return 'OK';
            case 201: return 'Created';
            case 202: return 'Accepted';
            case 204: return 'No Content';
            case 301: return 'Moved';
            case 302: return 'Found';
            case 304: return 'Not Modified';
            case 400: return 'Bad Request';
            case 401: return 'Unauthorized';
            case 403: return 'Forbidden';
            case 404: return 'Not Found';
            case 422: return 'Unprocessable Entity';
            case 429: return 'Too Many Requests';
            case 500: return 'Internal Error';
            case 502: return 'Bad Gateway';
            case 503: return 'Service Unavailable';
            case 504: return 'Gateway Timeout';
            default: return '';
        }
    };

    const getMethodColor = (method: string) => {
        switch (method.toUpperCase()) {
            case 'GET': return 'text-blue-600 dark:text-[#569cd6]';
            case 'POST': return 'text-emerald-600 dark:text-[#4ec9b0]';
            case 'PUT': return 'text-yellow-600 dark:text-[#dcdcaa]';
            case 'DELETE': return 'text-red-600 dark:text-[#f44747]';
            case 'PATCH': return 'text-green-600 dark:text-[#b5cea8]';
            case 'HEAD': return 'text-purple-600 dark:text-[#c586c0]';
            case 'OPTIONS': return 'text-amber-600 dark:text-[#ce9178]';
            default: return 'text-[var(--dev-console-text-muted)]';
        }
    };

    useEffect(() => {
        if (isOpen) {
            const padSize = isMaximized ? '0px' : 'calc(45vh + 30px)';
            document.documentElement.style.setProperty('--dev-console-padding', padSize);
        } else {
            document.documentElement.style.setProperty('--dev-console-padding', '32px');
        }
        return () => {
            document.documentElement.style.setProperty('--dev-console-padding', '0px');
        };
    }, [isOpen, isMaximized]);

    return (
        <div 
            className={`fixed z-[9999] text-[13px] font-mono transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${
                isOpen 
                    ? (isMaximized 
                        ? 'inset-0 h-[100dvh] w-screen border-none bg-[var(--dev-console-bg)] shadow-[var(--dev-console-shadow)] pointer-events-auto' 
                        : 'inset-x-0 bottom-0 h-[calc(45vh+30px)] bg-transparent border-none pointer-events-none'
                      ) 
                    : 'inset-x-0 bottom-0 h-8 border-t border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] shadow-[var(--dev-console-shadow)] hover:bg-[var(--dev-console-bg-hover)] cursor-pointer w-full pointer-events-auto'
            }`}
            onClick={() => !isOpen && setIsOpen(true)}
        >
            {!isOpen ? (
                <div className="h-full flex justify-between items-center px-4 gap-4 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] font-mono text-[11px] uppercase tracking-widest font-bold transition-colors w-full pointer-events-auto">
                    <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
                        <div className="flex items-center gap-2 shrink-0" title="Console Logs">
                            <Terminal size={14} /> 
                            <span className="hidden sm:inline">Console</span>
                            {logs.length > 0 && <span className="bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] px-1.5 py-0.5 rounded text-[10px]">{logs.length}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0" title="Server Logs">
                            <Cpu size={14} /> 
                            <span className="hidden sm:inline">Server Logs</span>
                            {serverLogsList.length > 0 && <span className="bg-red-800/80 px-1.5 py-0.5 rounded text-[10px] text-white font-mono">{serverLogsList.length}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0" title="Network Requests">
                            <Network size={14} /> 
                            <span className="hidden sm:inline">Network</span>
                            {nets.length > 0 && <span className="bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] px-1.5 py-0.5 rounded text-[10px]">{nets.length}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0" title="Device Models Mapping">
                            <Smartphone size={14} /> 
                            <span className="hidden sm:inline">Device Models</span>
                            {Object.keys(cacheData).length > 0 && <span className="bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] px-1.5 py-0.5 rounded text-[10px]">{Object.keys(cacheData).length}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0" title="Image Cache Dashboard">
                            <Image size={14} /> 
                            <span className="hidden sm:inline">Image Cache</span>
                            {serverImageCacheSummary.count > 0 && <span className="bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">{serverImageCacheSummary.count}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0" title="Device Sessions Details">
                            <Clock size={14} /> 
                            <span className="hidden sm:inline">User Sessions</span>
                            {Object.keys(sessionCacheData).length > 0 && <span className="bg-[#818cf8]/20 text-[#818cf8] border border-[#818cf8]/30 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium">{Object.keys(sessionCacheData).length}</span>}
                        </div>
                    </div>
                    <ChevronUp size={16} className="shrink-0" />
                </div>
            ) : (
                <>
                    {/* Top Action Tab Bar */}
                    <div className="flex-none flex justify-between bg-transparent select-none z-10 w-full pointer-events-none pr-0">
                        {/* Left Action: Hide Console */}
                        <div className="pointer-events-auto flex items-center bg-[var(--dev-console-tab-bg)] border-t border-r border-[var(--dev-console-border)] rounded-tr-xl px-4 py-1.5 gap-2 text-[var(--dev-console-text-muted)] text-xs">
                            <button 
                                onClick={() => {
                                    setShowHideConfirmation(true);
                                }} 
                                className="p-1 text-red-500 hover:text-red-600 hover:bg-[var(--dev-console-bg-active)] rounded transition-colors flex items-center gap-1 cursor-pointer font-medium" 
                                title="Hide Developer Console"
                            >
                                <EyeOff size={13} />
                                <span className="hidden sm:inline text-[10px]">Hide Console</span>
                            </button>
                        </div>

                        {/* Right Actions */}
                        <div className="pointer-events-auto flex items-center bg-[var(--dev-console-tab-bg)] border-t border-l border-[var(--dev-console-border)] rounded-tl-xl px-4 py-1.5 gap-2 text-[var(--dev-console-text-muted)] text-xs">
                            <button onClick={handleCopyAll} className="p-1 hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-active)] rounded transition-colors flex items-center gap-1" title="Copy All">
                                {copiedId === (activeTab === 'console' ? 'all-console' : activeTab === 'server-logs' ? 'all-server-logs' : 'all-network') ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                                <span>Copy</span>
                            </button>
                            <button onClick={handleClear} className="p-1 hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-active)] rounded transition-colors" title="Clear (Cmd/Ctrl+K)">
                                <Trash2 size={13} />
                            </button>
                            <div className="w-px h-3 bg-[var(--dev-console-border)]"></div>
                            <button onClick={() => setIsMaximized(!isMaximized)} className="p-1 hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-active)] rounded transition-colors" title={isMaximized ? 'Minimize' : 'Maximize'}>
                                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-active)] rounded transition-colors" title="Close DevTools">
                                <ChevronDown size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Main Console Box (Tabs + Contents) */}
                    <div className="flex-1 flex flex-col bg-[var(--dev-console-bg)] border-t border-[var(--dev-console-border)] overflow-hidden pointer-events-auto w-full">
                        {/* Tabs in one row */}
                        <div className="flex h-9 w-full overflow-x-auto scrollbar-hide border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] select-none">
                            <button 
                                onClick={() => setActiveTab('console')}
                                className={`px-5 h-full flex shrink-0 items-center justify-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'console' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Terminal size={14} className="shrink-0" /> Console 
                                {logs.length > 0 && <span className="ml-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] px-1.5 py-[1px] rounded text-[9px]">{logs.length}</span>}
                            </button>
                            <button 
                                onClick={() => setActiveTab('server-logs')}
                                className={`px-5 h-full flex shrink-0 items-center justify-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'server-logs' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Cpu size={14} className="shrink-0" /> Server Logs
                                {serverLogsList.length > 0 && <span className="ml-1 bg-red-800/80 px-1.5 py-[1px] rounded text-[9px] text-white font-mono">{serverLogsList.length}</span>}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('network'); setExpandedNetId(null); }}
                                className={`px-5 h-full flex shrink-0 items-center justify-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'network' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Network size={14} className="shrink-0" /> Network
                                {nets.length > 0 && <span className="ml-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] px-1.5 py-[1px] rounded text-[9px]">{nets.length}</span>}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('cache'); }}
                                className={`px-5 h-full flex shrink-0 items-center justify-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'cache' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Smartphone size={14} className="shrink-0" /> Device Models
                                {Object.keys(cacheData).length > 0 && <span className="ml-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] px-1.5 py-[1px] rounded text-[9px]">{Object.keys(cacheData).length}</span>}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('image-cache'); }}
                                className={`px-5 h-full flex shrink-0 items-center justify-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'image-cache' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Image size={14} className="shrink-0" /> Image Cache
                                {serverImageCacheSummary.count > 0 && (
                                    <span className="ml-1 bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 font-medium px-1.5 py-[1px] rounded text-[9px] font-mono">
                                        {serverImageCacheSummary.count}
                                    </span>
                                )}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('session-cache'); }}
                                className={`px-5 h-full flex shrink-0 items-center justify-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'session-cache' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Clock size={14} className="shrink-0" /> User Sessions
                                {Object.keys(sessionCacheData).length > 0 && (
                                    <span className="ml-1 bg-[#818cf8]/20 text-[#818cf8] border border-[#818cf8]/30 font-medium px-1.5 py-[1px] rounded text-[9px] font-mono">
                                        {Object.keys(sessionCacheData).length}
                                    </span>
                                )}
                            </button>
                        </div>
            
            {/* Tool Bar */}
            {activeTab === 'console' && (
                <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center px-3 gap-3 w-full">
                    <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                        <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-2" />
                        <input 
                            className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)]" 
                            placeholder="Filter logs" 
                            value={consoleFilter} 
                            onChange={e => setConsoleFilter(e.target.value)}
                        />
                        {consoleFilter && <button onClick={() => setConsoleFilter('')}><X size={12} className="text-neutral-400 hover:text-white" /></button>}
                    </div>
                    <div className="h-4 w-px bg-neutral-600"></div>
                    <div className="flex gap-1">
                        {(['all', 'info', 'warn', 'error'] as const).map(level => (
                            <button
                                key={level}
                                onClick={() => setConsoleLevel(level)}
                                className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 transition-colors ${consoleLevel === level ? 'bg-[#007fd4]/20 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'}`}
                            >
                                {level === 'info' && <InfoIcon size={12} className="text-[#8be9fd]" />}
                                {level === 'warn' && <AlertTriangle size={12} className="text-[#ffb86c]" />}
                                {level === 'error' && <AlertCircle size={12} className="text-[#ff8080]" />}
                                <span className="capitalize">{level}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'server-logs' && (
                <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center px-3 gap-3 w-full">
                    <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                        <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-2" />
                        <input 
                            className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)]" 
                            placeholder="Filter server logs" 
                            value={serverLogsFilter} 
                            onChange={e => setServerLogsFilter(e.target.value)} 
                        />
                        {serverLogsFilter && <button onClick={() => setServerLogsFilter('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                    </div>
                    <div className="h-4 w-px bg-[var(--dev-console-border)]"></div>
                    <div className="flex gap-1">
                        {(['all', 'log', 'info', 'warn', 'error'] as const).map(level => (
                            <button
                                key={level}
                                onClick={() => setServerLogsLevel(level)}
                                className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 transition-colors ${serverLogsLevel === level ? 'bg-[#007fd4]/20 text-[#007fd4]' : 'text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                {level === 'log' && <Terminal size={12} className="text-neutral-400" />}
                                {level === 'info' && <InfoIcon size={12} className="text-[#8be9fd]" />}
                                {level === 'warn' && <AlertTriangle size={12} className="text-[#ffb86c]" />}
                                {level === 'error' && <AlertCircle size={12} className="text-[#ff8080]" />}
                                <span className="capitalize">{level}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'network' && (
                <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center px-3 gap-3 w-full">
                    <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                        <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-2" />
                        <input 
                            className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)]" 
                            placeholder="Filter by URL" 
                            value={networkFilter} 
                            onChange={e => setNetworkFilter(e.target.value)} 
                        />
                        {networkFilter && <button onClick={() => setNetworkFilter('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                    </div>
                </div>
            )}

            {activeTab === 'image-cache' && (
                <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center justify-between px-3 w-full">
                    <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                        <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-2" />
                        <input 
                            className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans" 
                            placeholder="Filter cached images..." 
                            value={imageCacheSearch} 
                            onChange={e => setImageCacheSearch(e.target.value)} 
                        />
                        {imageCacheSearch && <button onClick={() => setImageCacheSearch('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                    </div>
                    <button 
                        onClick={fetchImageCacheData}
                        disabled={isImageCacheLoading}
                        className="text-[10px] text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={10} className={`${isImageCacheLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            )}
            
            {activeTab === 'session-cache' && (
                <div className="flex-none border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex flex-col w-full relative z-20">
                    {/* Row 1: Search & Sync */}
                    <div className="flex items-center justify-between px-3 py-2 gap-2 border-b border-[var(--dev-console-border)] sm:border-b-0">
                        <div className="flex-1 flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 focus-within:border-[#007fd4] transition-colors h-8">
                            <input 
                                className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans h-full" 
                                placeholder="Search email, browser, IP..." 
                                value={sessionCacheSearchInput} 
                                onChange={e => setSessionCacheSearchInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') setSessionCacheSearch(sessionCacheSearchInput); }}
                            />
                            <div className="flex items-center gap-1.5 ml-2 border-l border-[var(--dev-console-border)] pl-2">
                                {sessionCacheSearchInput && (
                                    <button onClick={() => { setSessionCacheSearchInput(''); setSessionCacheSearch(''); }}>
                                        <X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" />
                                    </button>
                                )}
                                <button 
                                    onClick={() => setSessionCacheSearch(sessionCacheSearchInput)}
                                    className="p-1 hover:bg-[var(--dev-console-bg-active)] rounded text-[var(--dev-console-text-muted)] hover:text-[#007fd4] transition-colors"
                                >
                                    <Search size={14} />
                                </button>
                            </div>
                        </div>
                        <button 
                            onClick={() => fetchSessionCacheData(true)}
                            disabled={isSessionCacheLoading}
                            className="text-[10px] text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1.5 bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 transition-colors disabled:opacity-50 font-sans shrink-0 h-8 uppercase font-bold"
                        >
                            {isSessionCacheLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            <span className="hidden sm:inline">Sync Now</span>
                        </button>
                    </div>

                    {/* Row 2: Filters */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--dev-console-bg)]/50">
                        <div className="flex-1 min-w-0">
                            <DevSelect
                                value={sessionCacheStatus}
                                onChange={(val: any) => setSessionCacheStatus(val)}
                                icon={<Activity size={12} />}
                                options={[
                                    { label: 'All Status', value: 'all' },
                                    { label: 'Active', value: 'active' },
                                    { label: 'Abandoned', value: 'abandoned' },
                                    { label: 'Terminated', value: 'terminated' },
                                    { label: 'Logged Out', value: 'logged_out' },
                                ]}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <DevSelect
                                value={sessionCacheTime}
                                onChange={(val: any) => setSessionCacheTime(val)}
                                icon={<Clock size={12} />}
                                options={[
                                    { label: 'All Time', value: 'all' },
                                    { label: 'Last 24h', value: '24h' },
                                    { label: 'Last 7d', value: '7d' },
                                    { label: 'Last 30d', value: '30d' },
                                ]}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <DevSelect
                                value={sessionCacheLimit}
                                onChange={(val: any) => setSessionCacheLimit(Number(val))}
                                icon={<Database size={12} />}
                                options={[
                                    { label: '100 Limit', value: 100 },
                                    { label: '500 Limit', value: 500 },
                                    { label: '1000 Limit', value: 1000 },
                                    { label: 'No Limit', value: 0 },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            )}

            
            {/* Main Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden bg-[var(--dev-console-bg)] flex w-full">
                
                {activeTab === 'console' && (
                    <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
                        <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                            <div className="flex flex-col min-h-full">
                            {filteredLogs.length === 0 && (
                                <div className="text-[var(--dev-console-text-muted)] italic p-6 text-center text-xs flex flex-col items-center gap-2">
                                    <Terminal size={32} className="opacity-20 mb-2" />
                                    {logs.length > 0 ? 'No logs match your filter.' : 'Console is clear.'}
                                </div>
                            )}
                            {filteredLogs.map((log) => (
                                <div key={log.id} className={`group py-2 px-2 sm:px-4 border-b border-[var(--dev-console-border)] break-words whitespace-pre-wrap flex gap-2 sm:gap-3 text-[10px] sm:text-[12px] leading-relaxed ${
                                    log.type === 'error' ? 'bg-[#290000]/10 text-[#ff8080] border-l-[3px] border-l-[#ff8080]' : 
                                    log.type === 'warn' ? 'bg-[#332b00]/10 text-[#ffb86c] border-l-[3px] border-l-[#ffb86c]' : 
                                    log.type === 'info' ? 'text-[#8be9fd] border-l-[3px] border-l-transparent' : 
                                    log.type === 'eval_result' ? 'text-[#a6e22e] font-bold border-l-[3px] border-l-transparent bg-[var(--dev-console-bg-active)]' :
                                    'text-[var(--dev-console-text)] border-l-[3px] border-l-transparent'
                                } hover:bg-[var(--dev-console-bg-hover)]`}>
                                    {(log.type === 'info' || log.type === 'warn' || log.type === 'error') && (
                                        <div className="flex-none mt-0.5">
                                            {log.type === 'info' && <InfoIcon size={14} className="text-[#8be9fd]" />}
                                            {log.type === 'warn' && <AlertTriangle size={14} className="text-[#ffb86c]" />}
                                            {log.type === 'error' && <AlertCircle size={14} className="text-[#ff8080]" />}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0 font-mono">
                                        {renderLogMessageWithBadges(log.args.join(' '))}
                                    </div>
                                    <button 
                                        onClick={() => handleCopy(log.args.join(' '), log.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-neutral-700/80 rounded flex-none self-start transition-opacity"
                                        title="Copy log text"
                                    >
                                        {copiedId === log.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-neutral-400" />}
                                    </button>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                            <style>{`
                                .hide-horizontal-scrollbar::-webkit-scrollbar:horizontal { display: none; }
                                .hide-horizontal-scrollbar { scrollbar-width: none; }
                            `}</style>
                        </div>
                    </div>
                    <form onSubmit={handleRunJS} className="flex-none min-h-8 py-1.5 border-t border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] flex items-end px-3 gap-2 w-full">
                        <ChevronRight size={16} className="text-[#007fd4] mb-0.5" />
                        <textarea 
                            className="bg-transparent text-[12px] text-[var(--dev-console-text)] outline-none w-full font-mono placeholder:text-[var(--dev-console-text-muted)] resize-none max-h-[58px]" 
                            placeholder="evaluate JavaScript" 
                            style={{ height: '20px' }}
                            value={consoleInput} 
                            onChange={e => {
                                setConsoleInput(e.target.value);
                                e.target.style.height = '20px';
                                e.target.style.height = Math.min(e.target.scrollHeight, 58) + 'px';
                            }} 
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleRunJS();
                                }
                            }}
                            spellCheck={false}
                            autoComplete="off"
                        />
                    </form>
                    </div>
                )}

                {activeTab === 'server-logs' && (
                    <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
                        <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                            <div className="flex flex-col min-h-full">
                                {filteredServerLogs.length === 0 && (
                                    <div className="text-[var(--dev-console-text-muted)] italic p-6 text-center text-xs flex flex-col items-center gap-2">
                                        <Cpu size={32} className="opacity-20 mb-2 animate-pulse" />
                                        {serverLogsList.length > 0 ? 'No server logs match your filter.' : 'Server logs are empty.'}
                                    </div>
                                )}
                                {filteredServerLogs.map((log) => {
                                    const dateStr = new Date(log.timestamp).toLocaleString();
                                    return (
                                        <div key={log.id} className={`group py-2.5 px-3 sm:px-5 border-b border-[var(--dev-console-border)] flex flex-col gap-1.5 transition-colors ${
                                            log.type === 'error' ? 'bg-red-500/5 dark:bg-[#290000]/15 border-l-[3px] border-l-red-500' : 
                                            log.type === 'warn' ? 'bg-amber-500/5 dark:bg-[#332b00]/15 border-l-[3px] border-l-amber-500' : 
                                            log.type === 'info' ? 'bg-cyan-500/5 dark:bg-[#8be9fd]/5 border-l-[3px] border-l-cyan-500 dark:border-l-[#8be9fd]' : 
                                            'border-l-[3px] border-l-transparent text-[var(--dev-console-text)]'
                                        } hover:bg-[var(--dev-console-bg-hover)]`}>
                                            {/* Timestamp separate on top with type icon before it if not standard log */}
                                            <div className="flex items-center gap-1.5 text-[9px] font-mono select-none tracking-wider opacity-85">
                                                {(log.type === 'info' || log.type === 'warn' || log.type === 'error') && (
                                                    <span className="flex items-center gap-1 shrink-0">
                                                        {log.type === 'info' && <InfoIcon size={12} className="text-cyan-600 dark:text-[#8be9fd]" />}
                                                        {log.type === 'warn' && <AlertTriangle size={12} className="text-amber-600 dark:text-[#ffb86c]" />}
                                                        {log.type === 'error' && <AlertCircle size={12} className="text-red-500 dark:text-[#ff8080]" />}
                                                    </span>
                                                )}
                                                <span className="text-neutral-500 dark:text-neutral-400">{dateStr}</span>
                                            </div>
                                            
                                            {/* Log Content main row */}
                                            <div className="flex items-start gap-2.5 sm:gap-3.5 text-[10px] sm:text-[12px] leading-relaxed">
                                                <div className="flex-1 min-w-0 font-mono text-[var(--dev-console-text)] break-all sm:break-words whitespace-pre-wrap">
                                                    {renderLogMessageWithBadges(log.message)}
                                                </div>
                                                <button 
                                                    onClick={() => handleCopy(log.message, log.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--dev-console-bg-active)] rounded flex-none self-start transition-opacity"
                                                    title="Copy log text"
                                                >
                                                    {copiedId === log.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" />}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'network' && (
                    <div className="flex-1 flex w-full h-full overflow-hidden">
                        {/* Network List */}
                        <div className={`flex flex-col h-full bg-[var(--dev-console-bg)] border-r border-[var(--dev-console-border)] transition-all duration-300 ${selectedNet ? 'w-full md:w-1/2 shrink-0' : 'w-full'}`}>
                            {filteredNets.length === 0 ? (
                                <div className="text-[var(--dev-console-text-muted)] italic p-6 text-center text-xs flex flex-col items-center pt-20 h-full gap-2">
                                    <Network size={32} className="opacity-20 mb-2" />
                                    {nets.length > 0 ? 'No requests match your filter.' : 'Recording network activity...'}
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text-muted)] select-none font-semibold sticky top-0 text-[10px] sm:text-[11px] uppercase w-full shrink-0">
                                        <div className={`flex-none ${selectedNet ? 'w-[45px] sm:w-[50px]' : 'w-[45px] sm:w-[80px]'}`}>Method</div>
                                        <div className="flex-1 min-w-0 pr-2 sm:pr-4">Name</div>
                                        <div className={`flex-none ${selectedNet ? 'w-[45px] sm:w-[55px]' : 'w-[50px] sm:w-[130px]'}`}>Status</div>
                                        <div className={`flex-none text-right ${selectedNet ? 'w-[40px] sm:w-[50px]' : 'w-[50px] sm:w-[80px]'}`}>Size</div>
                                        <div 
                                            className={`flex-none text-right cursor-pointer hover:text-[#818cf8] transition-colors select-none ${selectedNet ? 'w-[40px] sm:w-[50px]' : 'w-[45px] sm:w-[60px]'}`}
                                            onClick={() => {
                                                const currentFirstUnit = filteredNets.length > 0 ? (netDurationUnits[filteredNets[0].id] || 'ms') : 'ms';
                                                const nextUnit = currentFirstUnit === 'ms' ? 's' : currentFirstUnit === 's' ? 'm' : 'ms';
                                                
                                                const updatedUnits = { ...netDurationUnits };
                                                filteredNets.forEach(net => {
                                                    updatedUnits[net.id] = nextUnit;
                                                });
                                                setNetDurationUnits(updatedUnits);
                                            }}
                                            title="Click to toggle all: ms -> s -> minutes"
                                        >
                                            Time
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                        {filteredNets.map((net) => {
                                            const isSelected = highlightedNetId === net.id || selectedNet?.id === net.id;
                                            const isError = net.status === 'error' || (typeof net.status === 'number' && net.status >= 400);
                                            let host = '';
                                            try { host = new URL(net.url, window.location.origin).hostname; } catch(e){}
                                            
                                            // Determine log origin
                                            const isSupabase = host.includes('supabase.co') || host.includes('supabase.in');
                                            const isInternal = host === window.location.hostname || net.url.startsWith('/');
                                            const isExternal = !isInternal && !isSupabase && host !== '';

                                            // Highlight light colors for different requests
                                            let bgClass = isSelected ? 'bg-[var(--dev-console-bg-active)] cursor-default' : 'hover:bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                            if (isSelected) {
                                                if (isError) bgClass = 'bg-[#3b1515]/20 cursor-default';
                                                else if (isSupabase) bgClass = 'bg-[#12281e]/40 cursor-default';
                                                else if (isInternal) bgClass = 'bg-[var(--dev-console-bg-active)] cursor-default';
                                            } else {
                                                if (isError) bgClass = 'bg-[#290000]/10 hover:bg-[#3b0000]/10 cursor-pointer';
                                                else if (net.fromConsole) bgClass = 'bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                                else if (isSupabase) bgClass = 'bg-[#0f1f17]/20 hover:bg-[#162d22]/20 cursor-pointer'; // Very faint green tint
                                                else if (isExternal) bgClass = 'bg-[#1f1a0f]/20 hover:bg-[#2e2616]/20 cursor-pointer'; // Very faint orange tint
                                            }

                                            let borderClass = isSelected ? 'border-l-[3px] border-l-[#007fd4]' :
                                                isSupabase ? 'border-l-[3px] border-l-[#3ecf8e]' :
                                                isExternal ? 'border-l-[3px] border-l-[#e3a324]' :
                                                isError ? 'border-l-[3px] border-l-[#ff8080]' :
                                                net.fromConsole ? 'border-l-[3px] border-l-[#b5cea8]' :
                                                'border-l-[3px] border-l-transparent';

                                            const duration = net.duration || 0;
                                            const unit = netDurationUnits[net.id] || 'ms';
                                            let durationDisplay = '...';
                                            if (net.duration !== undefined) {
                                                if (unit === 'ms') {
                                                    durationDisplay = `${duration}ms`;
                                                } else if (unit === 's') {
                                                    durationDisplay = `${(duration / 1000).toFixed(2)}s`;
                                                } else {
                                                    const totalSecs = Math.floor(duration / 1000);
                                                    const hrs = Math.floor(totalSecs / 3600);
                                                    const mins = Math.floor((totalSecs % 3600) / 60);
                                                    const secs = totalSecs % 60;
                                                    const mm = String(mins).padStart(2, '0');
                                                    const ss = String(secs).padStart(2, '0');
                                                    if (hrs > 0) {
                                                        const hh = String(hrs).padStart(2, '0');
                                                        durationDisplay = `${hh}:${mm}:${ss}`;
                                                    } else {
                                                        durationDisplay = `${mm}:${ss}`;
                                                    }
                                                }
                                            }

                                            return (
                                            <div 
                                                key={net.id}
                                                onClick={() => {
                                                    setExpandedNetId(net.id);
                                                    setHighlightedNetId(net.id);
                                                }}
                                                onContextMenu={(e) => handleContextMenu(e, net.id)}
                                                className={`group px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border-light)] flex items-center text-[10px] sm:text-[11px] w-full shrink-0 select-none ${bgClass} ${borderClass} ${isSelected ? 'text-[var(--dev-console-text)] font-semibold' : net.fromConsole ? 'text-[#b5cea8]' : isError ? 'text-[#ff8080]' : 'text-[var(--dev-console-text)]'}`}
                                                style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}
                                            >
                                                <div className={`flex-none flex items-center gap-0.5 sm:gap-1.5 ${selectedNet ? 'w-[45px] sm:w-[50px]' : 'w-[45px] sm:w-[80px]'}`}>
                                                    {isError && <AlertCircle size={10} className="text-[#f48771] hidden sm:inline" />}
                                                    <span className={`font-bold ${isSelected ? 'text-[var(--dev-console-text)]' : getMethodColor(net.method)}`}>
                                                        {net.method}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0 pr-2 sm:pr-4 flex items-center gap-1.5" title={net.url}>
                                                    <span className="truncate">{new URL(net.url, window.location.origin).pathname.split('/').pop() || net.url}</span>
                                                    <span className={`shrink-0 border px-1 rounded-[3px] text-[8px] uppercase tracking-wider font-bold hidden sm:inline ${
                                                        isSupabase ? 'border-[#3ecf8e]/30 text-[#3ecf8e] bg-[#3ecf8e]/10' :
                                                        isInternal ? 'border-[#569cd6]/30 text-[#569cd6] bg-[#569cd6]/10' :
                                                        'border-[#e3a324]/30 text-[#e3a324] bg-[#e3a324]/10'
                                                    }`}>
                                                        {isSupabase ? 'Supabase' : isInternal ? 'Local' : 'External'}
                                                    </span>
                                                    {!selectedNet && <span className="opacity-40 text-[9px] truncate max-w-[70px] hidden lg:inline">{host}</span>}
                                                </div>
                                                <div className={`flex-none flex items-center min-w-0 pr-1 ${selectedNet ? 'w-[45px] sm:w-[55px]' : 'w-[50px] sm:w-[130px]'}`} title={getStatusText(net.status) ? `${net.status} ${getStatusText(net.status)}` : String(net.status)}>
                                                    <span className={`${isSelected ? 'text-[var(--dev-console-text)] font-medium' : getStatusColor(net.status)} flex items-center gap-1 w-full min-w-0`}>
                                                        {net.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></span>}
                                                        <span className="truncate block w-full">
                                                            {selectedNet ? net.status : `${net.status} ${getStatusText(net.status)}`}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className={`flex-none text-right opacity-80 whitespace-nowrap ${selectedNet ? 'w-[40px] sm:w-[50px]' : 'w-[50px] sm:w-[80px]'}`} title={net.responseSize !== undefined ? formatSize(net.responseSize) : ''}>
                                                    {net.responseSize !== undefined ? formatSize(net.responseSize) : '-'}
                                                </div>
                                                <div 
                                                    className={`flex-none text-right opacity-80 whitespace-nowrap cursor-pointer hover:text-[#818cf8] transition-colors ${selectedNet ? 'w-[40px] sm:w-[50px] pl-0.5' : 'w-[45px] sm:w-[60px] pl-1 sm:pl-2'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (net.duration !== undefined) {
                                                            setNetDurationUnits(prev => {
                                                                const current = prev[net.id] || 'ms';
                                                                const next = current === 'ms' ? 's' : current === 's' ? 'm' : 'ms';
                                                                return { ...prev, [net.id]: next };
                                                            });
                                                        }
                                                    }}
                                                    title="Tap to convert: ms -> s -> minutes"
                                                >
                                                    {durationDisplay}
                                                </div>
                                            </div>
                                        )})}
                                        <div ref={netsEndRef} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Network Details Panel */}
                        {selectedNet && (
                            <div className="flex-1 min-w-0 flex flex-col h-full bg-[var(--dev-console-bg)] overflow-hidden hidden md:flex">
                                <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center px-1">
                                    <button onClick={() => setExpandedNetId(null)} className="p-1 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] mx-1" title="Close Panel">
                                        <X size={14} />
                                    </button>
                                    <div className="h-4 w-px bg-[var(--dev-console-border)] mx-1"></div>
                                    {(['headers', 'payload', 'response'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setNetDetailTab(tab)}
                                            className={`px-4 h-full flex items-center text-[11px] uppercase tracking-wider font-semibold capitalize border-b-2 transition-colors ${netDetailTab === tab ? 'border-[#007fd4] text-[var(--dev-console-text)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                    <div className="flex-1"></div>
                                    <button 
                                        onClick={() => handleCopy(selectedNet.url, 'url-copy')}
                                        className="p-1 mr-2 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1"
                                        title="Copy Request URL"
                                    >
                                        {copiedId === 'url-copy' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-auto hide-horizontal-scrollbar p-4 scrollbar-thin scrollbar-thumb-[#424242] scrollbar-track-transparent">
                                    {netDetailTab === 'headers' && (
                                        <div className="flex flex-col gap-6 text-[12px]">
                                            <div>
                                                <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">General</h3>
                                                <div className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1.5 ml-2">
                                                    <span className="text-[var(--dev-console-text-muted)] font-semibold">Request URL:</span>
                                                    <span className="text-[var(--dev-console-syntax-property)] break-all select-all">{selectedNet.url}</span>
                                                    <span className="text-[var(--dev-console-text-muted)] font-semibold">Request Method:</span>
                                                    <span className="text-[var(--dev-console-syntax-string)] font-bold">{selectedNet.method}</span>
                                                    <span className="text-[var(--dev-console-text-muted)] font-semibold">Status Code:</span>
                                                    <span className={getStatusColor(selectedNet.status)}>{selectedNet.status} {getStatusText(selectedNet.status)}</span>
                                                </div>
                                            </div>
                                            
                                            {selectedNet.responseHeaders && Object.keys(selectedNet.responseHeaders).length > 0 && (
                                                <div>
                                                    <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Response Headers</h3>
                                                    <div className="grid grid-cols-[160px_1fr] gap-x-2 gap-y-1 ml-2">
                                                        {Object.entries(selectedNet.responseHeaders).map(([k, v]) => (
                                                            <React.Fragment key={k}>
                                                                <span className="text-[var(--dev-console-syntax-property)] capitalize">{k}:</span>
                                                                <span className="text-[var(--dev-console-syntax-string)] break-all">{v}</span>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {selectedNet.requestHeaders && Object.keys(selectedNet.requestHeaders).length > 0 && (
                                                <div>
                                                    <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Request Headers</h3>
                                                    <div className="grid grid-cols-[160px_1fr] gap-x-2 gap-y-1 ml-2">
                                                        {Object.entries(selectedNet.requestHeaders).map(([k, v]) => (
                                                            <React.Fragment key={k}>
                                                                <span className="text-[var(--dev-console-syntax-property)] capitalize">{k}:</span>
                                                                <span className="text-[var(--dev-console-syntax-string)] break-all">{v}</span>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {netDetailTab === 'payload' && (
                                        <div className="text-[12px]">
                                            {!selectedNet.requestBody ? (
                                                <div className="text-neutral-500 italic p-4 text-center">No payload for this request.</div>
                                            ) : (
                                                <div>
                                                    <div className="flex justify-between items-end mb-2 border-b border-[var(--dev-console-border)] pb-1">
                                                        <h3 className="text-[var(--dev-console-text)] font-bold uppercase text-[10px] tracking-wider">Request Payload <span className="text-[var(--dev-console-text-muted)] font-normal ml-2">({formatSize(selectedNet.requestSize || 0)})</span></h3>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.requestBody, 2), 'payload-copy')}
                                                            className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[10px] uppercase"
                                                        >
                                                            {copiedId === 'payload-copy' ? <><Check size={10} className="text-green-400" /> Copied</> : <><Copy size={10} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <pre 
                                                        className="font-mono text-[var(--dev-console-syntax-string)] text-[11px] whitespace-pre-wrap break-all max-w-full overflow-x-auto bg-[var(--dev-console-bg-active)] p-2.5 rounded ml-2 mt-2"
                                                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                    >
                                                        {safeStringifyWithTruncation(selectedNet.requestBody, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {netDetailTab === 'response' && (
                                        <div className="text-[12px] h-full flex flex-col">
                                            {selectedNet.status === 'pending' ? (
                                                <div className="text-neutral-500 italic p-4 text-center flex items-center justify-center gap-2 h-full">
                                                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> Waiting for response...
                                                </div>
                                            ) : selectedNet.responseBody === undefined ? (
                                                <div className="text-neutral-500 italic p-4 text-center">No response body.</div>
                                            ) : (
                                                <div className="flex flex-col h-full">
                                                    <div className="flex justify-between items-end mb-2 border-b border-[var(--dev-console-border)] pb-1 flex-none">
                                                        <h3 className="text-[var(--dev-console-text)] font-bold uppercase text-[10px] tracking-wider">Response Body <span className="text-[var(--dev-console-text-muted)] font-normal ml-2">({formatSize(selectedNet.responseSize || 0)})</span></h3>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.responseBody, 2), 'response-copy')}
                                                            className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[10px] uppercase"
                                                        >
                                                            {copiedId === 'response-copy' ? <><Check size={10} className="text-green-400" /> Copied</> : <><Copy size={10} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <div className="flex-1 overflow-auto">
                                                        <pre 
                                                            className="font-mono text-[var(--dev-console-syntax-response)] text-[11px] whitespace-pre-wrap break-all max-w-full overflow-x-auto bg-[var(--dev-console-bg-active)] p-2.5 rounded ml-2 mt-2"
                                                            style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                        >
                                                            {safeStringifyWithTruncation(selectedNet.responseBody, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Selected overlay on mobile */}
                        {selectedNet && (
                            <div className="absolute inset-0 bg-[var(--dev-console-bg)] flex flex-col z-20 md:hidden animate-in slide-in-from-right-2 duration-200">
                                <div className="flex-none h-11 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center px-4">
                                    <button onClick={() => setExpandedNetId(null)} className="p-2 -ml-2 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-2">
                                        <ChevronRight size={18} className="rotate-180" /> Back to Network
                                    </button>
                                </div>
                                <div className="flex-none h-10 border-b border-[var(--dev-console-border)] flex">
                                    {(['headers', 'payload', 'response'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setNetDetailTab(tab)}
                                            className={`flex-1 h-full flex items-center justify-center text-[11px] uppercase tracking-wider font-semibold capitalize border-b-2 transition-colors ${netDetailTab === tab ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg-active)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex-1 overflow-auto p-4">
                                     {/* Duplicate mobile view logic to reuse the detail blocks */}
                                     {netDetailTab === 'headers' && (
                                        <div className="flex flex-col gap-6 text-[12px]">
                                            <div>
                                                <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">General</h3>
                                                <div className="flex flex-col gap-2 ml-1">
                                                    <div><div className="text-[var(--dev-console-text-muted)] font-semibold mb-0.5">Request URL:</div><div className="text-[var(--dev-console-syntax-property)] break-all">{selectedNet.url}</div></div>
                                                    <div><div className="text-[var(--dev-console-text-muted)] font-semibold mb-0.5">Request Method:</div><div className="text-[var(--dev-console-syntax-string)] font-bold">{selectedNet.method}</div></div>
                                                    <div><div className="text-[var(--dev-console-text-muted)] font-semibold mb-0.5">Status Code:</div><div className={getStatusColor(selectedNet.status)}>{selectedNet.status}</div></div>
                                                </div>
                                            </div>
                                            {/* We skip full mobile header lists for brevity, just keeping it simple */}
                                            {selectedNet.responseHeaders && Object.keys(selectedNet.responseHeaders).length > 0 && (
                                                <div>
                                                    <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Response Headers</h3>
                                                    <div className="flex flex-col gap-1.5 ml-1">
                                                        {Object.entries(selectedNet.responseHeaders).map(([k, v]) => (
                                                            <div key={k} className="break-all border-b border-[var(--dev-console-border)] pb-1">
                                                                <span className="text-[var(--dev-console-syntax-property)] capitalize mr-2">{k}:</span>
                                                                <span className="text-[var(--dev-console-syntax-string)]">{v}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {netDetailTab === 'payload' && (
                                        <div className="text-[12px]">
                                            {!selectedNet.requestBody ? (
                                                <div className="text-neutral-500 italic p-4 text-center">No payload.</div>
                                            ) : (
                                                <div>
                                                    <div className="flex justify-between items-center mb-2 border-b border-[var(--dev-console-border)] pb-1.5">
                                                        <span className="text-[10.5px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold">Request Payload</span>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.requestBody, 2), 'payload-copy-mobile')}
                                                            className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[11px] uppercase font-semibold transition-colors"
                                                        >
                                                            {copiedId === 'payload-copy-mobile' ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <pre 
                                                        className="font-mono text-[var(--dev-console-syntax-string)] text-[11px] whitespace-pre-wrap break-all bg-[var(--dev-console-bg-active)] p-3 rounded max-w-full overflow-x-auto"
                                                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                    >
                                                        {safeStringifyWithTruncation(selectedNet.requestBody, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {netDetailTab === 'response' && (
                                        <div className="text-[12px]">
                                            {selectedNet.responseBody === undefined ? (
                                                <div className="text-neutral-500 italic p-4 text-center">No response.</div>
                                            ) : (
                                                <div>
                                                    <div className="flex justify-between items-center mb-2 border-b border-[var(--dev-console-border)] pb-1.5">
                                                        <span className="text-[10.5px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold">Response Body</span>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.responseBody, 2), 'response-copy-mobile')}
                                                            className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[11px] uppercase font-semibold transition-colors"
                                                        >
                                                            {copiedId === 'response-copy-mobile' ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <pre 
                                                        className="font-mono text-[var(--dev-console-syntax-response)] text-[11px] whitespace-pre-wrap break-all bg-[var(--dev-console-bg-active)] p-3 rounded max-w-full overflow-x-auto"
                                                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                    >
                                                        {safeStringifyWithTruncation(selectedNet.responseBody, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {activeTab === 'session-cache' && (
                    <div className="flex-1 flex flex-col w-full h-full overflow-y-auto bg-[var(--dev-console-bg)] scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                        {(() => {
                            const summary = sessionCacheData._summary || {
                                totalDevices: 0,
                                activeSessions: 0,
                                totalSessions: 0,
                                activeUsers: 0,
                                avgSessionTime: 0,
                                locations: 0
                            };
                            
                            const avgSessionStr = summary.avgSessionTime > 60 
                                ? `${Math.floor(summary.avgSessionTime / 60)}m ${summary.avgSessionTime % 60}s`
                                : `${summary.avgSessionTime}s`;

                            return (
                                <div className="w-full shrink-0 border-b border-[var(--dev-console-border)] p-4 flex flex-col gap-4">
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                                        <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                            <div>
                                                <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">TOTAL DEVICES</span>
                                                <div className="text-xl font-bold text-[#818cf8] mt-1 font-mono">{summary.totalDevices}</div>
                                            </div>
                                            <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2.5 font-mono">Unique hardware profiles</span>
                                        </div>
                                        <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                            <div>
                                                <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">ACTIVE SESSIONS</span>
                                                <div className="text-xl font-bold text-[#10b981] mt-1 font-mono">{summary.activeSessions}</div>
                                            </div>
                                            <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2.5 font-mono">Currently live connections</span>
                                        </div>
                                        <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                            <div>
                                                <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">TOTAL SESSIONS</span>
                                                <div className="text-xl font-bold text-[var(--dev-console-text)] mt-1 font-mono">{summary.totalSessions}</div>
                                            </div>
                                            <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2.5 font-mono">Lifetime total connections</span>
                                        </div>
                                        <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                            <div>
                                                <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">ACTIVE USERS</span>
                                                <div className="text-xl font-bold text-[#eab308] mt-1 font-mono">{summary.activeUsers}</div>
                                            </div>
                                            <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2.5 font-mono">Distinct user accounts</span>
                                        </div>
                                        <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                            <div>
                                                <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">AVG SESSION TIME</span>
                                                <div className="text-xl font-bold text-[#c084fc] mt-1 font-mono">{avgSessionStr}</div>
                                            </div>
                                            <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2.5 font-mono">Average connection span</span>
                                        </div>
                                        <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                            <div>
                                                <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">LOCATIONS</span>
                                                <div className="text-xl font-bold text-[#f43f5e] mt-1 font-mono">{summary.locations}</div>
                                            </div>
                                            <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2.5 font-mono">Unique geolocation spots</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        
                        <div className="flex-1 p-4 pb-4">
                            <h3 className="text-sm font-bold text-[var(--dev-console-text)] tracking-wider mb-4 border-b border-[var(--dev-console-border)] pb-2 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span>Device Sessions Details</span>
                                    {sessionCacheData._resultSummary && (
                                        <span className="text-[10px] bg-[var(--dev-console-bg-hover)] px-2 py-0.5 rounded text-[var(--dev-console-text-muted)] font-mono">
                                            Showing {sessionCacheData._resultSummary.returned} of {sessionCacheData._resultSummary.totalMatches} results
                                        </span>
                                    )}
                                </div>
                                {Object.keys(sessionCacheData).filter(k => k !== '_summary' && k !== '_resultSummary').length > 0 && (
                                    <button 
                                        onClick={() => setShowMassDeleteConfirm(true)}
                                        className="text-[10px] text-red-500 hover:text-red-600 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 px-2 py-1.5 rounded transition-all font-sans cursor-pointer font-bold"
                                        title="Delete all sessions across all devices"
                                    >
                                        <Trash2 size={12} />
                                        <span className="hidden sm:inline">Clear All Sessions</span>
                                    </button>
                                )}
                            </h3>
                            {isSessionCacheLoading && !isSessionCacheLoaded ? (
                                <div className="h-40 flex flex-col items-center justify-center text-[var(--dev-console-text-muted)] space-y-3">
                                    <Loader2 size={24} className="animate-spin text-[#818cf8]" />
                                    <span className="text-[11px] tracking-widest uppercase font-semibold">Loading Sessions...</span>
                                </div>
                            ) : Object.keys(sessionCacheData).filter(k => k !== '_summary' && k !== '_resultSummary').length === 0 ? (
                                <div className="h-60 flex flex-col items-center justify-center text-[var(--dev-console-text-muted)] text-[12px] italic gap-3 px-6 text-center">
                                    <div className="p-4 bg-[var(--dev-console-bg-active)] rounded-full text-[var(--dev-console-text-muted)] opacity-50">
                                        <Search size={32} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="font-bold text-[var(--dev-console-text)] not-italic">No sessions match your search criteria</span>
                                        <span>Try adjusting your filters or search terms, or sync with the server to pull latest data.</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {Object.entries(sessionCacheData)
                                        .filter(([hashId, data]: [string, any]) => hashId !== '_summary' && hashId !== '_resultSummary')
                                        .map(([hashId, data]: [string, any]) => (
                                        <div key={hashId} className="bg-[var(--dev-console-bg)] rounded-md border border-[var(--dev-console-border)] overflow-hidden shadow-sm">
                                            <div className="bg-[var(--dev-console-bg-hover)] border-b border-[var(--dev-console-border)] px-4 py-2.5 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className="font-bold text-[var(--dev-console-text)] text-sm tracking-wide uppercase shrink-0">{data.deviceModel || 'Unknown Device'}</span>
                                                </div>
                                                <div className="bg-[#007fd4] text-white px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider shrink-0">
                                                    1 Hash IDs
                                                </div>
                                            </div>
                                            
                                            <div className="p-4">
                                                <div className="flex flex-row justify-between items-center mb-4 text-[11px] gap-4">
                                                    <div className="font-mono text-[#818cf8] break-all flex-1">{hashId}</div>
                                                    <div className="text-[var(--dev-console-text-muted)] shrink-0 font-mono">
                                                        {Number(Object.values(data.accounts || {}).reduce((acc: number, val: any) => acc + (val.sessions?.length || 0), 0))} sessions
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    {Object.entries(data.accounts || {}).map(([username, accountData]: [string, any]) => {
                                                        const sessions = (accountData.sessions || []).slice().reverse();
                                                        let firstLogin = sessions.length > 0 ? sessions[sessions.length - 1].startTime : null;
                                                        let lastLogin = sessions.length > 0 ? sessions[0].startTime : null;
                                                        
                                                        return (
                                                            <div key={username} className="space-y-3">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                                                                    <div>
                                                                        <div className="text-[9px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold mb-1.5">Linked Users</div>
                                                                        <div className="text-[var(--dev-console-text)] font-semibold flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
                                                                            <span>{accountData.fullName || (username.includes('@') ? username.split('@')[0] : username)}</span>
                                                                            {username.includes('@') && (
                                                                                <span className="text-[var(--dev-console-text-muted)] text-[10px] font-normal font-mono">({username})</span>
                                                                            )}
                                                                            <span className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)] text-[9px] px-1.5 py-0.5 rounded font-mono">
                                                                                {sessions.length}x
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[9px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold mb-1.5">Activity Range</div>
                                                                        
                                                                        {/* Desktop Layout */}
                                                                        <div className="hidden md:flex flex-row items-center flex-nowrap whitespace-nowrap gap-4 font-mono text-[10px] overflow-x-auto scrollbar-none">
                                                                            <div className="flex flex-row items-center gap-1.5 whitespace-nowrap">
                                                                                <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold">First Login:</span>
                                                                                <RelativeTimestamp dateInput={firstLogin} />
                                                                            </div>
                                                                            <div className="h-4 w-px bg-[var(--dev-console-border)] shrink-0"></div>
                                                                            <div className="flex flex-row items-center gap-1.5 whitespace-nowrap">
                                                                                <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold">Last Login:</span>
                                                                                <RelativeTimestamp dateInput={lastLogin} />
                                                                            </div>
                                                                        </div>

                                                                        {/* Mobile Layout */}
                                                                        <div className="grid md:hidden grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold mb-0.5">First Login</span>
                                                                                <RelativeTimestamp dateInput={firstLogin} />
                                                                            </div>
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold mb-0.5">Last Login</span>
                                                                                <RelativeTimestamp dateInput={lastLogin} />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="border border-[var(--dev-console-border)] rounded-md overflow-hidden bg-[var(--dev-console-bg)] shadow-sm">
                                                                    <div className="bg-[var(--dev-console-bg-active)] px-3 py-1.5 border-b border-[var(--dev-console-border)] flex items-center justify-between gap-3">
                                                                        <span className="font-bold text-[11px] text-[var(--dev-console-text)]">Recent Sessions</span>
                                                                        <button
                                                                            onClick={() => {
                                                                                setDeviceToDelete({ hashId, deviceModel: data.deviceModel || 'Unknown Device' });
                                                                            }}
                                                                            className="text-[9px] text-red-500 hover:text-red-600 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded transition-all font-sans cursor-pointer font-bold flex items-center gap-1.5 border border-red-500/15"
                                                                            title="Delete all sessions for this device"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                            <span className="hidden sm:inline">Delete Device Sessions</span>
                                                                        </button>
                                                                    </div>
                                                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                                                        <table className="w-full text-center border-collapse min-w-[1250px]">
                                                                            <thead>
                                                                                <tr className="text-[9px] uppercase tracking-widest text-[var(--dev-console-text-muted)]">
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">User</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Session Key</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Browser</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Version</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">OS</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">OS Version</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Mode</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Start Time</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">End Time</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Location/IP</th>
                                                                                    <th 
                                                                                        className="px-2 py-2 font-medium whitespace-nowrap text-center cursor-pointer hover:text-[#818cf8] transition-colors select-none"
                                                                                        onClick={() => {
                                                                                            if (sessions && sessions.length > 0) {
                                                                                                const firstSessionId = sessions[0].sessionId;
                                                                                                const nextUnit = sessionDurationUnits[firstSessionId] === 'm' ? 's' : 'm';
                                                                                                const updatedUnits = { ...sessionDurationUnits };
                                                                                                sessions.forEach((sItem: any) => {
                                                                                                    updatedUnits[sItem.sessionId] = nextUnit;
                                                                                                });
                                                                                                setSessionDurationUnits(updatedUnits);
                                                                                            }
                                                                                        }}
                                                                                        title="Click to toggle all durations: Seconds <-> Minutes/Seconds"
                                                                                    >
                                                                                        Duration
                                                                                    </th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Status</th>
                                                                                    <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="text-[10px] font-mono divide-y divide-[var(--dev-console-border)]/50">
                                                                                {sessions.map((s: any, idx: number) => {
                                                                                    let durationSecs = s.duration || 0;
                                                                                    if (s.status === 'active' || !s.endTime) {
                                                                                        const elapsed = Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000);
                                                                                        durationSecs = (elapsed > 0 ? elapsed : 0) + (tick * 0);
                                                                                    }
                                                                                    const isMinutes = sessionDurationUnits[s.sessionId] === 'm';
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
                                                                                    <tr key={idx} className="hover:bg-[var(--dev-console-bg-hover)] transition-colors group">
                                                                                        <td 
                                                                                            className="px-2 py-1.5 truncate max-w-[180px] cursor-pointer whitespace-nowrap text-center" 
                                                                                            onClick={(e) => { e.currentTarget.classList.toggle('truncate'); e.currentTarget.classList.toggle('whitespace-normal'); e.currentTarget.classList.toggle('break-all'); e.currentTarget.classList.toggle('max-w-[180px]'); }}
                                                                                            title={username}
                                                                                        >
                                                                                            <div className="flex items-center justify-center gap-1.5 inline-flex">
                                                                                                {s.provider === 'google' ? (
                                                                                                    <span title="Logged in with Google" className="inline-flex shrink-0 cursor-help">
                                                                                                        <GoogleIcon />
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span title="Logged in with Email & Password" className="inline-flex shrink-0 cursor-help">
                                                                                                        <EmailIcon />
                                                                                                    </span>
                                                                                                )}
                                                                                                <span>{username}</span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td 
                                                                                            className="px-2 py-1.5 truncate max-w-[120px] cursor-pointer whitespace-nowrap text-center text-[var(--dev-console-text-muted)] text-[9px]" 
                                                                                            onClick={(e) => { e.currentTarget.classList.toggle('truncate'); e.currentTarget.classList.toggle('whitespace-normal'); e.currentTarget.classList.toggle('break-all'); e.currentTarget.classList.toggle('max-w-[120px]'); }}
                                                                                            title={s.sessionId}
                                                                                        >
                                                                                            {s.sessionId}
                                                                                        </td>
                                                                                        <BrowserCell session={s} />
                                                                                        <td className="px-2 py-1.5 text-center text-[var(--dev-console-text)] whitespace-nowrap">
                                                                                            {s.browser_version || <span className="text-[var(--dev-console-text-muted)]">-</span>}
                                                                                        </td>
                                                                                        <OSCell session={s} />
                                                                                        <td className="px-2 py-1.5 text-center text-[var(--dev-console-text-muted)] whitespace-nowrap">
                                                                                            {s.os_version || <span className="text-[var(--dev-console-text-muted)]">-</span>}
                                                                                        </td>
                                                                                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                                                                            {s.is_incognito ? (
                                                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                                                                                                    <EyeOff className="w-2.5 h-2.5 mr-1" />
                                                                                                    Private
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                                                                                    Normal
                                                                                                </span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-2 py-1.5 text-[var(--dev-console-text)] whitespace-nowrap text-center">{formatSessionDateTime(s.startTime)}</td>
                                                                                        <td className="px-2 py-1.5 text-[var(--dev-console-text)] whitespace-nowrap text-center">{s.endTime ? formatSessionDateTime(s.endTime) : <span className="text-[var(--dev-console-text-muted)]">-</span>}</td>
                                                                                        <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                                                            <div 
                                                                                                className="flex flex-row items-center justify-center gap-1.5 max-w-[200px] cursor-pointer mx-auto"
                                                                                                onClick={(e) => { 
                                                                                                    e.currentTarget.classList.toggle('max-w-[200px]'); 
                                                                                                    const spans = e.currentTarget.querySelectorAll('span');
                                                                                                    spans.forEach(span => {
                                                                                                        span.classList.toggle('truncate');
                                                                                                        span.classList.toggle('whitespace-normal');
                                                                                                        span.classList.toggle('break-words');
                                                                                                    });
                                                                                                }}
                                                                                            >
                                                                                                {s.location && <span className="truncate text-[var(--dev-console-text)] whitespace-nowrap">{s.location}</span>}
                                                                                                {s.ip && <span className="text-[9px] text-[var(--dev-console-text-muted)] truncate whitespace-nowrap">• {s.ip}</span>}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td 
                                                                                            className="px-2 py-1.5 whitespace-nowrap text-center cursor-pointer hover:text-[#818cf8] font-bold select-none"
                                                                                            onClick={() => {
                                                                                                if (durationSecs) {
                                                                                                    setSessionDurationUnits(prev => ({
                                                                                                        ...prev,
                                                                                                        [s.sessionId]: prev[s.sessionId] === 'm' ? 's' : 'm'
                                                                                                    }));
                                                                                                }
                                                                                            }}
                                                                                            title="Tap to convert to minutes"
                                                                                        >
                                                                                            {durationDisplayVal}
                                                                                        </td>
                                                                                        <td className="px-2 py-1.5 text-center">
                                                                                            <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide whitespace-nowrap ${
                                                                                                s.status === 'active' ? 'bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20' : 
                                                                                                s.status === 'background' ? 'bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20' :
                                                                                                s.status === 'tab_closed' ? 'bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20' :
                                                                                                s.status === 'abandoned' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20' :
                                                                                                s.status === 'logged_out' ? 'bg-[#007fd4]/10 text-[#007fd4] border border-[#007fd4]/20' : 
                                                                                                s.status === 'terminated' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                                                                                                'bg-[var(--dev-console-bg-active)] text-[var(--dev-console-text-muted)] border border-[var(--dev-console-border)]'
                                                                                            }`}>
                                                                                                {s.status === 'active' ? 'Logged In' : s.status === 'background' ? 'Background' : s.status === 'tab_closed' ? 'Tab Closed' : s.status === 'abandoned' ? 'Abandoned' : s.status === 'logged_out' ? 'Logged Out' : s.status === 'terminated' ? 'Terminated' : s.status}
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-2 py-1.5 text-center">
                                                                                            {deletingSessionId === s.sessionId ? (
                                                                                                <div className="flex items-center justify-center gap-1 font-sans">
                                                                                                    <button 
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setDeletingSessionId(null);
                                                                                                        }}
                                                                                                        className="px-1.5 py-0.5 bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] rounded text-[9px] cursor-pointer transition-colors hover:bg-[var(--dev-console-bg-hover)] shrink-0 font-medium"
                                                                                                    >
                                                                                                        Cancel
                                                                                                    </button>
                                                                                                    <button 
                                                                                                        onClick={async (e) => {
                                                                                                            e.stopPropagation();
                                                                                                            try {
                                                                                                                const res = await fetch('/api/session-cache?action=delete', {
                                                                                                                    method: 'POST',
                                                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                                                    body: JSON.stringify({
                                                                                                                        deviceHash: hashId,
                                                                                                                        username,
                                                                                                                        sessionId: s.sessionId
                                                                                                                    })
                                                                                                                });
                                                                                                                if (res.ok) {
                                                                                                                    fetchSessionCacheData(true);
                                                                                                                } else {
                                                                                                                    console.error("Failed to delete session");
                                                                                                                }
                                                                                                            } catch (err) {
                                                                                                                 console.error("Error deleting session", err);
                                                                                                            } finally {
                                                                                                                setDeletingSessionId(null);
                                                                                                            }
                                                                                                        }}
                                                                                                        className="px-1.5 py-0.5 bg-red-600 dark:bg-red-900 text-white border border-red-700 dark:border-red-700/80 rounded font-bold cursor-pointer text-[9px] transition-colors hover:bg-red-700 shrink-0"
                                                                                                    >
                                                                                                        Delete
                                                                                                    </button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <button 
                                                                                                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                                                                                                    onClick={() => {
                                                                                                        setDeletingSessionId(s.sessionId);
                                                                                                    }}
                                                                                                >
                                                                                                    <Trash2 size={12} />
                                                                                                </button>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {Object.keys(data.accounts || {}).length === 0 && (
                                                        <div className="flex flex-col items-center justify-center p-4 text-[var(--dev-console-text-muted)] gap-2 bg-[var(--dev-console-bg-active)] rounded-lg border border-dashed border-[var(--dev-console-border)]">
                                                            <User size={16} className="opacity-50" />
                                                            <span className="text-[10px] italic">No accounts linked yet.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {activeTab === 'image-cache' && (
                    <div className="flex-1 flex flex-col md:flex-row w-full h-full md:min-h-0 overflow-y-auto md:overflow-hidden bg-[var(--dev-console-bg)]">
                        {/* Left Side: Caching Engine Controls & Analytics Dashboard */}
                        <div className="w-full md:w-[350px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--dev-console-border)] p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                            <h3 className="text-sm font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2 border-b border-[var(--dev-console-border)] pb-2 shrink-0">
                                <Image size={16} className="text-[#10b981]" />
                                Cache Analytics Dashboard
                            </h3>
                            
                            {(() => {
                                const items = serverImageCacheSummary.items || [];
                                const totalCount = items.length;
                                const expiredCount = items.filter(i => i.isExpired).length;
                                const activeCount = totalCount - expiredCount;
                                const totalBytes = serverImageCacheSummary.totalSizeBytes || 0;
                                const averageSizeBytes = totalCount > 0 ? Math.round(totalBytes / totalCount) : 0;
                                
                                const domainMap: Record<string, number> = {};
                                items.forEach(item => {
                                    let hostname = 'Unknown Origin';
                                    try {
                                        hostname = new URL(item.url).hostname;
                                    } catch {
                                        hostname = 'Unknown Origin';
                                    }
                                    domainMap[hostname] = (domainMap[hostname] || 0) + 1;
                                });
                                
                                const sortedDomains = Object.entries(domainMap)
                                    .map(([name, count]) => ({ name, count, percent: totalCount > 0 ? (count / totalCount) * 100 : 0 }))
                                    .sort((a, b) => b.count - a.count)
                                    .slice(0, 5);

                                const cacheRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 100;

                                return (
                                    <div className="flex flex-col gap-4 font-sans">
                                        {/* Row 1 Metrics Grid */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                                <div>
                                                    <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">Total Items</span>
                                                    <div className="text-xl font-bold text-[var(--dev-console-text)] mt-1 font-mono">{totalCount}</div>
                                                </div>
                                                <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2 font-mono">Cached image assets</span>
                                            </div>
                                            <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                                <div>
                                                    <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">Active TTL</span>
                                                    <div className="text-xl font-bold text-[#10b981] mt-1 font-mono">{activeCount}</div>
                                                </div>
                                                <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2 font-mono">Non-expired images</span>
                                            </div>
                                            <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                                <div>
                                                    <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">Total Size</span>
                                                    <div className="text-xl font-bold text-[var(--dev-console-text)] mt-1 font-mono">{formatSize(totalBytes)}</div>
                                                </div>
                                                <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2 font-mono">Proxy footprint</span>
                                            </div>
                                            <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col justify-between min-h-[95px]">
                                                <div>
                                                    <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-mono font-bold">Avg Size</span>
                                                    <div className="text-xl font-bold text-[#3b82f6] mt-1 font-mono">{formatSize(averageSizeBytes)}</div>
                                                </div>
                                                <span className="text-[9px] text-[var(--dev-console-text-muted)] mt-2 font-mono">Average image weight</span>
                                            </div>
                                        </div>

                                        {/* Cache Efficiency Progress */}
                                        <div className="bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] rounded-md p-3">
                                            <div className="flex justify-between items-center text-[10.5px] font-mono text-[var(--dev-console-text-muted)] mb-1.5 uppercase font-bold">
                                                <span>Cache Health (Active Rate)</span>
                                                <span className="text-[#10b981] font-bold">{cacheRatio}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-[var(--dev-console-border)] rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                                                    style={{ width: `${cacheRatio}%` }}
                                                />
                                            </div>
                                            <p className="text-[9.5px] text-[var(--dev-console-text-muted)] mt-1.5 leading-relaxed">
                                                Active images persist in proxy memory with a 2-hour sliding window. Memory locks prevent browser CORS locks.
                                            </p>
                                        </div>

                                        {/* Top Contributing Domains (Proxy Volume Analytics) */}
                                        <div className="flex flex-col gap-2">
                                            <h4 className="text-[10px] text-[var(--dev-console-text-muted)] font-bold uppercase tracking-wider font-mono border-b border-[var(--dev-console-border)] pb-1">
                                                Top Origin Server Distribution
                                            </h4>
                                            
                                            {sortedDomains.length === 0 ? (
                                                <p className="text-[11px] text-[var(--dev-console-text-muted)] italic py-2 text-center">No hostname distribution metrics available.</p>
                                            ) : (
                                                <div className="flex flex-col gap-2 text-[11px] font-sans">
                                                    {sortedDomains.map((dom, i) => (
                                                        <div key={dom.name + i} className="flex flex-col bg-[var(--dev-console-bg-active)] p-2 border border-[var(--dev-console-border)] rounded-md">
                                                            <div className="flex justify-between items-center text-[var(--dev-console-text-muted)] font-mono text-[10px] mb-1">
                                                                <span className="truncate max-w-[200px] text-[var(--dev-console-text)] font-bold" title={dom.name}>{dom.name}</span>
                                                                <span className="text-[var(--dev-console-text-muted)] font-bold">{dom.count} img ({Math.round(dom.percent)}%)</span>
                                                            </div>
                                                            <div className="w-full h-1 bg-[var(--dev-console-border)] rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full ${
                                                                        i === 0 ? 'bg-[#10b981]' : 
                                                                        i === 1 ? 'bg-[#3b82f6]' : 
                                                                        i === 2 ? 'bg-[#8b5cf6]' : 
                                                                        'bg-neutral-600'
                                                                    }`} 
                                                                    style={{ width: `${dom.percent}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Cache controls */}
                                        <div className="border-t border-[var(--dev-console-border)] pt-3 mt-2 flex flex-col gap-2">
                                            <label className="text-[10px] text-[var(--dev-console-text-muted)] font-bold uppercase tracking-wider font-mono">Server Storage Flush</label>
                                            <button
                                                onClick={handleClearServerImageCache}
                                                disabled={isClearingServerImageCache || totalCount === 0}
                                                className="w-full bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-white border border-red-200 dark:border-red-900/30 dark:hover:border-red-600/50 rounded-md py-2 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-sans flex items-center justify-center gap-2"
                                            >
                                                <Trash2 size={13} />
                                                Flush Server-Side Cache ({totalCount})
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Right Side: Server Cache Visualizer List */}
                        <div className="flex-1 flex flex-col overflow-hidden min-h-[500px] md:min-h-0">
                            <div className="flex-none p-3 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                    <span className="text-[11px] font-bold text-[var(--dev-console-text)] uppercase tracking-widest font-sans">Server-Side Proxy Cache ({serverImageCacheSummary.count || 0})</span>
                                </div>
                                <span className="text-[10px] text-[var(--dev-console-text-muted)] font-mono font-medium">{formatSize(serverImageCacheSummary.totalSizeBytes || 0)}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent font-sans">
                                {(serverImageCacheSummary.items || []).length === 0 ? (
                                    <div className="text-neutral-500 italic p-12 text-center text-xs flex flex-col items-center justify-center h-full gap-2 font-sans">
                                        <Image size={24} className="opacity-15" />
                                        Server memory proxy cache is empty.
                                    </div>
                                ) : (() => {
                                    const filtered = (serverImageCacheSummary.items || []).filter(item => 
                                        !imageCacheSearch || item.url.toLowerCase().includes(imageCacheSearch.toLowerCase())
                                    );
                                    if (filtered.length === 0) {
                                        return (
                                            <div className="text-neutral-500 italic p-12 text-center text-xs">
                                                No server items matched search.
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex flex-col divide-y divide-[var(--dev-console-border)] text-xs font-sans">
                                            {filtered.map((item, idx) => (
                                                <div key={item.url + idx} className="p-3 hover:bg-[var(--dev-console-bg-active)] transition-all flex items-start gap-3 group">
                                                    {/* Thumbnail Box */}
                                                    <div className="w-10 h-10 shrink-0 bg-[var(--dev-console-border)] rounded-md border border-[var(--dev-console-border)] overflow-hidden flex items-center justify-center select-none">
                                                        <img src={item.url} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                                    </div>
                                                    {/* Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[var(--dev-console-text)] font-mono text-[11px] truncate select-all" title={item.url}>{item.url}</div>
                                                        <div className="text-[10px] text-[var(--dev-console-text-muted)] flex items-center gap-2 mt-1 font-mono">
                                                            <span>{formatSize(item.sizeBytes)}</span>
                                                            <span>•</span>
                                                            <span className={item.isExpired ? 'text-red-400' : 'text-[var(--dev-console-text-muted)]'}>
                                                                {item.isExpired ? 'Expired' : `TTL: ${item.timeLeftMinutes ? item.timeLeftMinutes.toFixed(1) : 0}m left`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {/* Action Elements */}
                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        {deletingImageUrl === item.url ? (
                                                            <div className="flex items-center gap-1 shrink-0 font-sans">
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeletingImageUrl(null);
                                                                    }}
                                                                    className="px-2 py-0.5 bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] rounded-md font-sans text-[10px] cursor-pointer transition-colors shrink-0"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button 
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            await fetch('/api/image-cache-delete', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ url: item.url })
                                                                            });
                                                                            setDeletingImageUrl(null);
                                                                            await fetchImageCacheData();
                                                                        } catch (err) {
                                                                            console.error("Error deleting image cache item:", err);
                                                                        }
                                                                    }}
                                                                    className="px-2 py-0.5 bg-red-600 dark:bg-red-900 text-white border border-red-700 dark:border-red-700/80 rounded-md font-bold cursor-pointer font-sans text-[10px] transition-colors shrink-0"
                                                                >
                                                                    Confirm
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleCopy(item.url, `srv-copy-${idx}`)}
                                                                    className="p-1 hover:bg-[var(--dev-console-border)] rounded-md text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors"
                                                                    title="Copy URL"
                                                                >
                                                                    {copiedId === `srv-copy-${idx}` ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeletingImageUrl(item.url);
                                                                    }}
                                                                    className="p-1 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-md text-[var(--dev-console-text-muted)] hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                                    title="Remove Entry"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'cache' && (
                    <div className="flex-1 flex flex-col md:flex-row w-full h-full md:min-h-0 overflow-y-auto md:overflow-hidden bg-[var(--dev-console-bg)]">
                        {/* Left Side: Operations / Add-Edit */}
                        <div className="w-full md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--dev-console-border)] p-4 flex flex-col gap-4 overflow-visible md:overflow-y-auto md:h-full md:min-h-0">
                            <h3 className="text-sm font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2 border-b border-[var(--dev-console-border)] pb-2 shrink-0">
                                <Smartphone size={16} className="text-[#007fd4]" />
                                Device Model Mapping
                            </h3>
                            
                            {persistentDeviceId && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-[10px] font-bold uppercase text-[var(--dev-console-text-muted)] tracking-wider">
                                        Persistent Device Hash
                                    </span>
                                    <div className="p-2.5 bg-gray-100 dark:bg-black rounded-md border border-[var(--dev-console-border)] flex items-center justify-between gap-3">
                                        <span className="font-mono text-xs text-[var(--dev-console-text)] break-all select-all">
                                            {persistentDeviceId}
                                        </span>
                                        <button 
                                            onClick={() => handleCopy(persistentDeviceId, 'hash-id')}
                                            className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors shrink-0"
                                            title="Copy Hash ID"
                                        >
                                            {copiedId === 'hash-id' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!newModel.trim()) return;
                                setIsSaving(true);
                                setCacheStatusMessage('');
                                try {
                                    const response = await fetch('/api/device-mapper?action=cache_update', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ model: newModel, name: newName || null })
                                    });
                                    if (response.ok) {
                                        setNewModel('');
                                        setNewName('');
                                        setCacheStatusMessage('Saved successfully!');
                                        fetchCacheData();
                                        setTimeout(() => setCacheStatusMessage(''), 3000);
                                    } else {
                                        setCacheStatusMessage('Error saving to cache.');
                                    }
                                } catch (err) {
                                    setCacheStatusMessage('Network error saving.');
                                } finally {
                                    setIsSaving(false);
                                }
                            }} className="flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-[11px] text-[var(--dev-console-text-muted)] mb-1 font-bold uppercase tracking-wider font-mono truncate">Device Model Code</label>
                                        <input 
                                            className="w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono"
                                            placeholder="e.g. SM-S928U"
                                            value={newModel}
                                            onChange={e => setNewModel(e.target.value)}
                                            required
                                        />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-[11px] text-[var(--dev-console-text-muted)] mb-1 font-bold uppercase tracking-wider font-mono truncate">Marketing Name</label>
                                        <input 
                                            className="w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors"
                                            placeholder="e.g. Google Pixel 8a"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                        />
                                    </div>
                                </div>
                                
                                <button 
                                    type="submit"
                                    disabled={isSaving || !newModel.trim()}
                                    className="w-full bg-[#007fd4] text-white rounded py-2 text-xs font-semibold hover:bg-[#007fd4]/90 disabled:opacity-50 transition-colors cursor-pointer mt-1 font-sans"
                                >
                                    {isSaving ? 'Saving...' : 'Save Mapping'}
                                </button>
                                
                                {cacheStatusMessage && (
                                    <div className={`text-[11px] font-semibold text-center p-1 rounded font-sans ${cacheStatusMessage.includes('error') || cacheStatusMessage.includes('Error') ? 'bg-red-50 dark:bg-red-950/45 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-950/45 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50'}`}>
                                        {cacheStatusMessage}
                                    </div>
                                )}
                            </form>

                            <div className="border-t border-[var(--dev-console-border)] my-2 pt-4 flex flex-col gap-3">
                                <h4 className="text-xs font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2 uppercase font-mono">
                                    <Cpu size={14} className="text-amber-500" />
                                    Gemini Live Resolver
                                </h4>
                                
                                <p className="text-[10px] text-[var(--dev-console-text-muted)] leading-relaxed font-sans">
                                    Test the Gemini API resolver live. This forces the model to bypass cache and use real-time Google Search grounding to retrieve current specifications.
                                </p>

                                <div className="flex gap-2 w-full">
                                    <input 
                                        className="w-[70%] bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono shrink-0"
                                        placeholder="Enter model code, e.g. SM-S928U"
                                        value={testModel}
                                        onChange={e => setTestModel(e.target.value)}
                                        disabled={isResolving}
                                    />
                                    
                                    <button 
                                        type="button"
                                        onClick={async () => {
                                            if (!testModel.trim()) return;
                                            setIsResolving(true);
                                            setTestError('');
                                            setResolverResult(null);
                                            try {
                                                const response = await fetch('/api/device-mapper', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ model: testModel, skipCache: true })
                                                });
                                                if (response.ok) {
                                                    const data = await response.json();
                                                    setResolverResult(data);
                                                    if (data.error) {
                                                        setTestError(data.error);
                                                    }
                                                } else {
                                                    setTestError('Failed to resolve device model.');
                                                }
                                            } catch (err: any) {
                                                setTestError(err.message || 'Network error occurred.');
                                            } finally {
                                                setIsResolving(false);
                                            }
                                        }}
                                        disabled={isResolving || !testModel.trim()}
                                        className="w-[30%] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text)] rounded py-2 text-xs font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sans shrink-0 overflow-hidden"
                                        title={isResolving ? "Resolving..." : "Resolve with Gemini (Live)"}
                                    >
                                        {isResolving ? (
                                            <>
                                                <Loader2 size={12} className="animate-spin text-[#007fd4] shrink-0" />
                                                <span className="truncate">Resolving...</span>
                                            </>
                                        ) : (
                                            <span className="truncate">Resolve</span>
                                        )}
                                    </button>
                                </div>

                                {testError && (
                                    <div className="text-[11px] bg-red-50 dark:bg-red-950/45 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-950/40 px-2 py-1.5 rounded font-sans leading-tight">
                                        {testError}
                                    </div>
                                )}

                                {resolverResult && (
                                    <div className="bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded p-3 flex flex-col gap-2 font-sans text-xs">
                                        <div className="flex flex-col gap-0.5 pb-2 border-b border-[var(--dev-console-border)]">
                                            <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold font-mono">Resolved Name</span>
                                            <span className="font-semibold text-[var(--dev-console-text)] font-sans text-[13px]">{resolverResult.name || 'Unknown / Not Found'}</span>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold font-mono">Knowledge Base Source</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {resolverResult.usedSearchTool ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 font-bold uppercase font-mono">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-0.5" />
                                                        Google Search Tool
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase font-mono">
                                                        Internal Knowledge
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {resolverResult.usedSearchTool && resolverResult.sources && resolverResult.sources.length > 0 && (
                                            <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-neutral-900">
                                                <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-mono flex items-center gap-1">
                                                    Reference Web Sources ({resolverResult.sources.length})
                                                </span>
                                                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                                                    {resolverResult.sources.map((src: any, index: number) => (
                                                        <a 
                                                            key={index} 
                                                            href={src.uri} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            referrerPolicy="no-referrer" 
                                                            className="flex items-center gap-1 p-1 rounded hover:bg-[var(--dev-console-bg-active)] transition-colors text-blue-500 hover:text-blue-600 text-[11px] truncate"
                                                        >
                                                            <span className="font-mono text-[var(--dev-console-text-muted)]">[{index + 1}]</span>
                                                            <span className="truncate flex-1">{src.title || src.uri}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Search / List View */}
                        <div className="flex-1 flex flex-col shrink-0 min-h-[400px] md:min-h-0 md:shrink-1 overflow-visible md:overflow-hidden md:h-full">
                            <div className="flex-none p-3 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1 w-full sm:w-72 focus-within:border-[#007fd4] transition-colors font-sans flex-1">
                                    <Search size={13} className="text-[var(--dev-console-text-muted)] mr-2" />
                                    <input 
                                        className="bg-transparent text-xs text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans" 
                                        placeholder="Search cached models..." 
                                        value={cacheSearch} 
                                        onChange={e => setCacheSearch(e.target.value)} 
                                    />
                                    {cacheSearch && <button onClick={() => setCacheSearch('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                                </div>
                                <button 
                                    onClick={fetchCacheData}
                                    className="px-2.5 py-1 rounded bg-[var(--dev-console-bg-active)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-xs text-[var(--dev-console-text-muted)] transition-colors font-sans cursor-pointer"
                                >
                                    Refresh List
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-visible md:overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                {Object.entries(cacheData).length === 0 ? (
                                    <div className="text-[var(--dev-console-text-muted)] italic p-12 text-center text-xs flex flex-col items-center gap-2 justify-center h-full">
                                        <Database size={32} className="opacity-20 mb-2" />
                                        Cache is currently empty or loading.
                                    </div>
                                ) : (() => {
                                    const filtered = Object.entries(cacheData).filter(([model, name]) => {
                                        if (!cacheSearch) return true;
                                        const cleanQuery = cacheSearch.toLowerCase();
                                        return model.toLowerCase().includes(cleanQuery) || 
                                               (!!name && name.toLowerCase().includes(cleanQuery));
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="text-[var(--dev-console-text-muted)] italic p-12 text-center text-xs flex flex-col items-center gap-2 justify-center h-full font-sans">
                                                No cached entries found matching "{cacheSearch}".
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col">
                                            {filtered.map(([model, name]) => (
                                                <div key={model} className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-active)] transition-colors text-xs group">
                                                    <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                                                        <div className="font-bold text-[var(--dev-console-text)] font-mono tracking-wider">{model}</div>
                                                        <div className="text-[var(--dev-console-text-muted)] font-sans truncate">
                                                            {name === null ? (
                                                                <span className="text-amber-500/80 italic font-mono text-[10px]">Negative Match Locked (will skip Gemini resolution)</span>
                                                            ) : name}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            onClick={() => {
                                                                setNewModel(model);
                                                                setNewName(name || '');
                                                            }}
                                                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--dev-console-border)] rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-opacity cursor-pointer"
                                                            title="Edit Entry"
                                                        >
                                                            <ChevronRight size={14} />
                                                        </button>
                                                        {deletingModelId === model ? (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeletingModelId(null);
                                                                    }}
                                                                    className="px-2 py-0.5 bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] rounded font-sans text-[10px] cursor-pointer transition-colors shrink-0"
                                                                >
                                                                    Cancel
                                                                </button>
                                                                <button 
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            const response = await fetch('/api/device-mapper?action=cache_delete', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ model })
                                                                            });
                                                                            if (response.ok) {
                                                                                setDeletingModelId(null);
                                                                                fetchCacheData();
                                                                            }
                                                                        } catch (err) {
                                                                            console.error("Error deleting cached item:", err);
                                                                        }
                                                                    }}
                                                                    className="px-2 py-0.5 bg-red-600 dark:bg-red-900 text-white border border-red-700 dark:border-red-700/80 rounded font-bold cursor-pointer font-sans text-[10px] transition-colors shrink-0"
                                                                >
                                                                    Confirm
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeletingModelId(model);
                                                                }}
                                                                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950/45 rounded text-[var(--dev-console-text-muted)] hover:text-red-600 dark:hover:text-red-400 transition-opacity cursor-pointer"
                                                                title="Delete Entry"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Status Bar */}
            {activeTab === 'network' && (
                <div className="w-full relative flex-none h-6 border-t border-[var(--dev-console-border)] bg-[#007fd4] text-white flex items-center px-4 justify-between text-[11px] font-medium select-none">
                    <div className="flex items-center gap-4">
                        <span>{filteredNets.length} / {nets.length} requests</span>
                        <span className="w-px h-3 bg-white/30"></span>
                        <span>{formatSize(totalSent + totalReceived)} transferred</span>
                    </div>
                    
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowDetailedTransfers(prev => !prev);
                        }}
                        className="ml-auto p-1 hover:bg-white/15 active:bg-white/20 rounded cursor-pointer transition-all flex items-center justify-center shrink-0"
                        title="Show detailed transfer information"
                    >
                        <MoreHorizontal size={14} className="text-white" />
                    </button>

                    {showDetailedTransfers && (
                        <div 
                            className="absolute bottom-7 right-2 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] w-[calc(100vw-16px)] sm:w-[280px] max-w-sm z-50 flex flex-col gap-2 font-sans text-xs select-none rounded-lg p-3 shadow-none max-h-[calc(45vh-45px)] md:max-h-[380px]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Downward pointing Tail to trigger button */}
                            <div className="absolute bottom-[-5px] right-3 w-2.5 h-2.5 bg-[var(--dev-console-bg)] border-r border-b border-[var(--dev-console-border)] rotate-45 z-10" />

                            <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-1.5 shrink-0">
                                <span className="font-bold text-[11px] tracking-wider text-[var(--dev-console-text)] flex items-center gap-1.5">
                                    <Network size={12} className="text-blue-500" /> Environment Transfers
                                </span>
                                <button 
                                    onClick={() => setShowDetailedTransfers(false)}
                                    className="p-0.5 hover:bg-[var(--dev-console-bg-active)] rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] cursor-pointer transition-colors"
                                    title="Close"
                                >
                                    <X size={12} />
                                </button>
                            </div>

                            {/* Overall Stats summary block */}
                            <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 dark:border-blue-500/15 rounded-md p-2 flex flex-col gap-1 shrink-0">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-[9px] tracking-wider text-blue-600 dark:text-blue-400">OVERALL TRANSFER</span>
                                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">{formatSize(totalSent + totalReceived)}</span>
                                </div>
                                <div className="flex justify-between items-center gap-2 text-[9px] text-[var(--dev-console-text-muted)] font-mono">
                                    <span>Sent (↑): <span className="text-[var(--dev-console-text)] font-semibold">{formatSize(totalSent)}</span></span>
                                    <span>Recv (↓): <span className="text-[var(--dev-console-text)] font-semibold">{formatSize(totalReceived)}</span></span>
                                </div>
                            </div>

                            {(() => {
                                const stats = getEnvironmentStats();
                                const items = [
                                    { name: 'Local (Dev API)', key: 'local', desc: 'Relative, app-server paths' },
                                    { name: 'Supabase DB', key: 'supabase', desc: 'Direct & proxied db requests' },
                                    { name: 'External Services', key: 'external', desc: 'CDNs, images, external APIs' }
                                ];
                                return (
                                    <div className="flex flex-col gap-2 overflow-y-auto pr-0.5 scrollbar-thin">
                                        {items.map(item => {
                                            const stat = stats[item.key as keyof typeof stats];
                                            const total = stat.sent + stat.received;
                                            return (
                                                <div key={item.key} className="flex flex-col gap-1 pb-2 border-b border-[var(--dev-console-border)]/50 last:border-0 last:pb-0 last:mb-0">
                                                    <div className="flex justify-between items-start gap-1.5">
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-semibold text-[11px] text-[var(--dev-console-text)] truncate">{item.name}</span>
                                                            <span className="text-[8.5px] text-[var(--dev-console-text-muted)] leading-tight">{item.desc}</span>
                                                        </div>
                                                        <span className="font-mono text-[10.5px] font-bold text-blue-500 dark:text-blue-400 shrink-0">{formatSize(total)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] text-[var(--dev-console-text-muted)] font-mono bg-[var(--dev-console-bg-active)]/35 rounded py-0.5 px-2 mt-0.5">
                                                        <span>Sent (↑): {formatSize(stat.sent)}</span>
                                                        <span>Recv (↓): {formatSize(stat.received)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'cache' && (
                <div className="flex-none h-6 border-t border-[var(--dev-console-border)] bg-[#007fd4] text-white flex items-center px-3 text-[11px] font-medium gap-4">
                    <span>{Object.keys(cacheData).length} device mappings cached</span>
                    <span className="w-px h-3 bg-white/30"></span>
                    <span>100% Offline Efficiency</span>
                </div>
            )}
            {activeTab === 'image-cache' && (
                <div className="flex-none min-h-[24px] h-auto py-1 sm:h-6 sm:py-0 border-t border-[var(--dev-console-border)] bg-[#007fd4] text-white flex flex-wrap items-center px-3 text-[10px] sm:text-[11px] font-medium gap-x-3 gap-y-1">
                    <span>Server Cache: Unlimited</span>
                    <span className="hidden sm:inline w-px h-3 bg-white/30"></span>
                    <span>Cached proxy items: {serverImageCacheSummary.count} ({formatSize(serverImageCacheSummary.totalSizeBytes || 0)})</span>
                </div>
            )}
                    </div>
                </>
            )}
            
            {contextMenu && (
                <div 
                    className="fixed z-[10000] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] shadow-xl rounded py-1 w-56 text-[12px] font-mono text-[var(--dev-console-text)] select-none pointer-events-auto"
                    style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 280) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) handleCopy(net.url, `url-copy`);
                            setContextMenu(null);
                        }}
                    >Copy URL</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net && net.responseBody !== undefined) {
                                handleCopy(safeStringifyWithTruncation(net.responseBody, 2), 'response-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy Response</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)]"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                let curl = `curl "${net.url}" -X "${net.method}"`;
                                if (net.requestHeaders) {
                                    Object.entries(net.requestHeaders).forEach(([k, v]) => {
                                        curl += ` -H "${k}: ${v}"`;
                                    });
                                }
                                if (net.requestBody) {
                                    const bodyStr = typeof net.requestBody === 'string' ? net.requestBody : JSON.stringify(net.requestBody);
                                    curl += ` --data-raw ${JSON.stringify(bodyStr)}`;
                                }
                                handleCopy(curl, 'curl-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy as cURL</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                const headersStr = net.requestHeaders ? JSON.stringify(net.requestHeaders, null, 2).replace(/\n/g, '\n  ') : '{}';
                                const bodyVal = net.requestBody ? `, body: ${typeof net.requestBody === 'string' ? JSON.stringify(net.requestBody) : JSON.stringify(JSON.stringify(net.requestBody))}` : '';
                                const code = `import fetch from 'node-fetch';\n\nfetch("${net.url}", {\n  method: "${net.method}",\n  headers: ${headersStr}${bodyVal}\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
                                handleCopy(code, 'node-fetch-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy as Node fetch</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                let code = `fetch("${net.url}", {\n  "method": "${net.method}"`;
                                if (net.requestHeaders && Object.keys(net.requestHeaders).length > 0) {
                                    code += `,\n  "headers": ${JSON.stringify(net.requestHeaders, null, 4).replace(/\n/g, '\n  ')}`;
                                }
                                if (net.requestBody) {
                                    code += `,\n  "body": ${typeof net.requestBody === 'string' ? JSON.stringify(net.requestBody) : JSON.stringify(JSON.stringify(net.requestBody))}`;
                                }
                                code += `\n});`;
                                handleCopy(code, 'fetch-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy as fetch</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)]"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net && net.requestHeaders) {
                                const headersText = Object.entries(net.requestHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
                                handleCopy(headersText, 'req-headers-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy Request Headers</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net && net.responseHeaders) {
                                const headersText = Object.entries(net.responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
                                handleCopy(headersText, 'resp-headers-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy Response Headers</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)]"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                const istStr = net.timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
                                let parts = [`[${istStr}] ${net.method} ${net.url} - ${net.status} (${net.duration}ms)`];
                                if (net.requestHeaders) parts.push(`Request Headers:\n${safeStringifyWithTruncation(net.requestHeaders, 2)}`);
                                if (net.requestBody) parts.push(`Payload:\n${safeStringifyWithTruncation(net.requestBody, 2)}`);
                                if (net.responseHeaders) parts.push(`Response Headers:\n${safeStringifyWithTruncation(net.responseHeaders, 2)}`);
                                if (net.responseBody) parts.push(`Response:\n${safeStringifyWithTruncation(net.responseBody, 2)}`);
                                handleCopy(parts.join('\n\n'), 'request-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy request</button>
                </div>
            )}

            {showHideConfirmation && (
                <div 
                    className="fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px] pointer-events-auto"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <div className="bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] max-w-sm w-full p-5 rounded-lg shadow-xl flex flex-col gap-4 font-sans">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-red-500/10 text-red-500 shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="font-bold text-sm text-[var(--dev-console-text)]">Hide Developer Console?</h3>
                                <p className="text-[12px] text-[var(--dev-console-text-muted)] leading-relaxed">
                                    This will disable the developer console and reload the application.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2.5 justify-end text-xs font-medium">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowHideConfirmation(false);
                                }}
                                className="px-3.5 py-1.5 rounded border border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    localStorage.removeItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join(''));
                                    window.location.reload();
                                }}
                                className="px-3.5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer font-bold"
                            >
                                Confirm & Hide
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showMassDeleteConfirm && (
                <ConfirmationModal
                    isOpen={showMassDeleteConfirm}
                    onClose={() => setShowMassDeleteConfirm(false)}
                    onConfirm={async () => {
                        try {
                            const res = await fetch('/api/session-cache?action=delete_all', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' }
                            });
                            if (res.ok) {
                                fetchSessionCacheData(true);
                            } else {
                                console.error("Failed to clear all sessions");
                            }
                        } catch (e) {
                            console.error("Error clearing all sessions", e);
                        } finally {
                            setShowMassDeleteConfirm(false);
                        }
                    }}
                    title="Clear All Session Logs"
                    message="Are you sure you want to delete ALL active and historical session logs across ALL devices? This action is destructive and cannot be undone."
                    confirmButtonText="Delete All"
                    confirmButtonVariant="danger"
                />
            )}

            {deviceToDelete && (
                <ConfirmationModal
                    isOpen={deviceToDelete !== null}
                    onClose={() => setDeviceToDelete(null)}
                    onConfirm={async () => {
                        if (!deviceToDelete) return;
                        try {
                            const res = await fetch('/api/session-cache?action=delete_device', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ deviceHash: deviceToDelete.hashId })
                            });
                            if (res.ok) {
                                fetchSessionCacheData(true);
                            } else {
                                console.error("Failed to delete device sessions");
                            }
                        } catch (e) {
                            console.error("Error deleting device sessions", e);
                        } finally {
                            setDeviceToDelete(null);
                        }
                    }}
                    title={`Delete Sessions for ${deviceToDelete.deviceModel}`}
                    message={`Are you sure you want to delete ALL cached sessions for the device "${deviceToDelete.deviceModel}"? This action is destructive and cannot be undone.`}
                    confirmButtonText="Delete Sessions"
                    confirmButtonVariant="danger"
                />
            )}
        </div>
    );
};

export default DevConsole;

