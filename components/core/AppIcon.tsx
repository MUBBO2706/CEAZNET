import React, { useState, useEffect } from 'react';
import { Icon, loadIcons, iconLoaded } from '@iconify/react';
import * as LucideIcons from 'lucide-react';

export interface AppIconProps {
    name: string;
    className?: string;
    color?: string;
    size?: number | string;
    style?: React.CSSProperties;
    strokeWidth?: number;
}

// Preload essential UI icons on module load to guarantee zero flash or layout shift
const ESSENTIAL_UI_ICONS = [
    'solar:widget-2-linear',
    'ph:compass-light',
    'tabler:notebook',
    'solar:wallet-money-linear',
    'solar:notebook-bookmark-linear',
    'solar:gallery-linear',
    'ri:translate-2',
    'hugeicons:voice',
    'tabler:history',
    'hugeicons:customer-support',
    'hugeicons:ai-magic',
    'heroicons:information-circle',
    'tabler:file-text',
    'solar:shield-linear',
    'ph:shield-light',
    'solar:settings-minimalistic-linear',
    'solar:bookmark-linear',
    'ri:search-2-line',
    'ph:eye-light',
    'ph:eye-slash-light',
    'solar:heart-linear',
    'solar:heart-bold',
    'heroicons:arrow-left',
    'tabler:trash',
    'solar:upload-minimalistic-linear',
    'solar:download-minimalistic-linear',
    'tabler:rotate-clockwise',
    'hugeicons:edit-02',
    'ph:check-light',
    'solar:headphones-round-sound-linear',
    'hugeicons:sparkles',
    'heroicons:chevron-down',
    'tabler:chart-bar',
    'solar:user-circle-linear',
    'solar:logout-2-linear',
    'solar:login-2-linear',
    'heroicons:x-mark',
    'tabler:atom',
    'ph:push-pin-light',
    'solar:clock-circle-linear',
    'solar:share-linear',
    'tabler:plus',
    'hugeicons:tag-01',
    'solar:tag-linear',
    'solar:wrench-linear',
    'solar:test-tube-minimalistic-linear',
    'solar:danger-triangle-linear',
    'solar:calendar-linear',
    'solar:pulse-2-linear',
    'solar:graph-up-linear',
    'solar:graph-down-linear',
    'solar:check-circle-linear',
    'solar:danger-circle-linear',
    'solar:close-circle-linear',
    'solar:trash-bin-trash-linear',
    'solar:alt-arrow-down-linear',
    'solar:alt-arrow-up-linear',
    'solar:alt-arrow-left-linear',
    'solar:alt-arrow-right-linear',
    'solar:arrow-right-linear',
    'solar:devices-linear',
    'solar:map-point-linear',
    'solar:monitor-cross-linear',
    'solar:wifi-router-minimalistic-linear',
    'solar:restart-linear',
    'solar:rewind-10-seconds-back-linear',
    'solar:rewind-10-seconds-forward-linear',
    'solar:play-linear',
    'solar:pause-linear',
    'solar:menu-dots-linear',
    'solar:check-read-linear',
    'solar:microphone-3-linear',
    'solar:magic-stick-3-linear',
    'solar:tuning-square-2-linear',
    'solar:woman-linear',
    'solar:man-linear',
    'solar:user-linear',
    'tabler:woman',
    'tabler:man',
    'hugeicons:voice'
];

try {
    loadIcons(ESSENTIAL_UI_ICONS, () => {
        // preloaded
    });
} catch (e) {
    // Graceful fallback
}

// Comprehensive Semantic Alias Map to guaranteed local Lucide components
const SEMANTIC_LUCIDE_MAP: Record<string, string> = {
    // System & Banners
    'solar:wrench-linear': 'Wrench',
    'wrench': 'Wrench',
    'solar:test-tube-minimalistic-linear': 'FlaskConical',
    'test-tube': 'FlaskConical',
    'flask': 'FlaskConical',
    'solar:danger-triangle-linear': 'AlertTriangle',
    'danger-triangle': 'AlertTriangle',
    'warning': 'AlertTriangle',
    'alert-triangle': 'AlertTriangle',
    
    // Finance & Metrics
    'solar:pulse-2-linear': 'Activity',
    'pulse': 'Activity',
    'pulse-2': 'Activity',
    'activity': 'Activity',
    'solar:graph-up-linear': 'TrendingUp',
    'graph-up': 'TrendingUp',
    'trending-up': 'TrendingUp',
    'solar:graph-down-linear': 'TrendingDown',
    'graph-down': 'TrendingDown',
    'trending-down': 'TrendingDown',
    'solar:check-circle-linear': 'CheckCircle2',
    'check-circle': 'CheckCircle2',
    'solar:danger-circle-linear': 'AlertCircle',
    'danger-circle': 'AlertCircle',
    'solar:close-circle-linear': 'XCircle',
    'close-circle': 'XCircle',
    'solar:wallet-money-linear': 'Wallet',
    'wallet': 'Wallet',
    'piggy-bank': 'PiggyBank',
    'piggybank': 'PiggyBank',
    'analytics': 'BarChart3',
    'chart-bar': 'BarChart3',
    'bar-chart': 'BarChart3',
    'bar-chart-2': 'BarChart2',
    'bar-chart-3': 'BarChart3',
    'tabler:chart-bar': 'BarChart3',
    'notes': 'Notebook',
    'tabler:notebook': 'Notebook',
    'refresh': 'RefreshCw',
    'rotate-clockwise': 'RotateCw',
    'tabler:rotate-clockwise': 'RotateCw',
    'solar:restart-linear': 'RotateCcw',
    'restart': 'RotateCcw',
    'close': 'X',
    'heroicons:x-mark': 'X',
    'x-mark': 'X',
    'x': 'X',
    'pen': 'Pen',
    'hugeicons:edit-02': 'Pen',
    'edit-02': 'Pen',
    'edit': 'Pen',
    'edit-2': 'Pen',
    'edit2': 'Pen',
    'solar:calendar-linear': 'Calendar',
    'calendar': 'Calendar',
    'list': 'List',
    'download': 'Download',
    'solar:download-minimalistic-linear': 'Download',
    'upload': 'Upload',
    'solar:upload-minimalistic-linear': 'Upload',
    'database': 'Database',
    'chevron-down': 'ChevronDown',
    'heroicons:chevron-down': 'ChevronDown',
    'solar:alt-arrow-down-linear': 'ChevronDown',
    'solar:alt-arrow-up-linear': 'ChevronUp',
    'solar:alt-arrow-left-linear': 'ChevronLeft',
    'solar:alt-arrow-right-linear': 'ChevronRight',
    'tabler:chevron-left': 'ChevronLeft',
    'tabler:chevron-right': 'ChevronRight',
    'arrow-down-left': 'ArrowDownLeft',
    'arrow-up-right': 'ArrowUpRight',
    'arrow-left-right': 'ArrowRightLeft',
    'arrow-right-left': 'ArrowRightLeft',
    'arrow-right': 'ArrowRight',
    'solar:arrow-right-linear': 'ArrowRight',
    'arrow-left': 'ArrowLeft',
    'heroicons:arrow-left': 'ArrowLeft',
    'check': 'Check',
    'ph:check-light': 'Check',
    'check-square': 'CheckSquare',
    'trash-2': 'Trash2',
    'trash': 'Trash2',
    'tabler:trash': 'Trash2',
    'solar:trash-bin-trash-linear': 'Trash2',
    'tag': 'Tag',
    'hugeicons:tag-01': 'Tag',
    'solar:tag-linear': 'Tag',
    'search': 'Search',
    'ri:search-2-line': 'Search',
    'more-vertical': 'MoreVertical',
    'more-horizontal': 'MoreHorizontal',
    'plus-circle': 'PlusCircle',
    'plus': 'Plus',
    'tabler:plus': 'Plus',
    'link': 'Link',
    'credit-card': 'CreditCard',
    'solar:user-circle-linear': 'User',
    'user': 'User',
    'solar:logout-2-linear': 'LogOut',
    'logout': 'LogOut',
    'solar:login-2-linear': 'LogIn',
    'login': 'LogIn',
    'solar:bookmark-linear': 'Bookmark',
    'bookmark': 'Bookmark',
    'ph:eye-light': 'Eye',
    'eye': 'Eye',
    'ph:eye-slash-light': 'EyeOff',
    'eye-off': 'EyeOff',
    'solar:heart-linear': 'Heart',
    'solar:heart-bold': 'Heart',
    'heart': 'Heart',
    'solar:headphones-round-sound-linear': 'Headphones',
    'headphones': 'Headphones',
    'hugeicons:customer-support': 'Headphones',
    'hugeicons:ai-magic': 'Sparkles',
    'hugeicons:sparkles': 'Sparkles',
    'sparkles': 'Sparkles',
    'heroicons:information-circle': 'Info',
    'info': 'Info',
    'solar:shield-linear': 'Shield',
    'ph:shield-light': 'Shield',
    'shield': 'Shield',
    'solar:settings-minimalistic-linear': 'Settings',
    'settings': 'Settings',
    'solar:gallery-linear': 'Image',
    'gallery': 'Image',
    'ri:translate-2': 'Languages',
    'translate': 'Languages',
    'hugeicons:voice': 'Mic',
    'voice': 'Mic',
    'mic': 'Mic',
    'tabler:history': 'History',
    'history': 'History',
    'tabler:atom': 'Atom',
    'atom': 'Atom',
    'ph:push-pin-light': 'Pin',
    'pin': 'Pin',
    'solar:clock-circle-linear': 'Clock',
    'clock': 'Clock',
    'solar:share-linear': 'Share2',
    'share': 'Share2',
    'solar:widget-2-linear': 'LayoutGrid',
    'ph:compass-light': 'Compass',
    'solar:notebook-bookmark-linear': 'BookOpen',
    'solar:devices-linear': 'Laptop',
    'solar:map-point-linear': 'MapPin',
    'solar:monitor-cross-linear': 'Monitor',
    'solar:wifi-router-minimalistic-linear': 'Wifi',

    // Voice & Media Playback
    'solar:play-linear': 'Play',
    'play': 'Play',
    'solar:pause-linear': 'Pause',
    'pause': 'Pause',
    'solar:rewind-10-seconds-linear': 'RotateCcw',
    'solar:rewind-10-seconds-back-linear': 'RotateCcw',
    'rewind-10-seconds-linear': 'RotateCcw',
    'rewind-10-seconds-back-linear': 'RotateCcw',
    'rewind': 'RotateCcw',
    'solar:forward-10-seconds-linear': 'RotateCw',
    'solar:rewind-10-seconds-forward-linear': 'RotateCw',
    'forward-10-seconds-linear': 'RotateCw',
    'rewind-10-seconds-forward-linear': 'RotateCw',
    'forward': 'RotateCw',
    'solar:menu-dots-linear': 'MoreHorizontal',
    'solar:menu-dots-circle-linear': 'MoreHorizontal',
    'solar:menu-dots-vertical-linear': 'MoreVertical',
    'menu-dots': 'MoreHorizontal',
    'solar:volume-cross-linear': 'VolumeX',
    'solar:volume-loud-linear': 'Volume2',
    'solar:check-read-linear': 'Check',
    'check-read': 'Check',
    'tabler:woman': 'User',
    'tabler:man': 'User',
    'solar:women-linear': 'User',
    'solar:magic-stick-3-linear': 'Wand2',
    'solar:tuning-square-2-linear': 'Sliders',
    'solar:user-speak-linear': 'UserCheck',
    'solar:soundwave-linear': 'AudioWaveform',
    'soundwave': 'AudioWaveform'
};

/**
 * Resolves any icon string (Iconify or Lucide) into a valid Lucide component
 */
function resolveLucideFallback(name: string): React.ComponentType<any> {
    if (!name) return LucideIcons.Tag;

    const trimmed = name.trim();
    const lower = trimmed.toLowerCase();

    // 1. Direct semantic map match
    if (SEMANTIC_LUCIDE_MAP[trimmed]) {
        const comp = (LucideIcons as any)[SEMANTIC_LUCIDE_MAP[trimmed]];
        if (comp) return comp;
    }
    if (SEMANTIC_LUCIDE_MAP[lower]) {
        const comp = (LucideIcons as any)[SEMANTIC_LUCIDE_MAP[lower]];
        if (comp) return comp;
    }

    // 2. Strip namespace prefix (e.g., 'solar:wrench-linear' -> 'wrench-linear')
    const rawCore = trimmed.includes(':') ? trimmed.split(':')[1] : trimmed;
    // Strip common suffixes
    const strippedCore = rawCore
        .replace(/-(linear|bold|outline|light|line|duotone|fill|minimalistic|circle|square|round|2|02|01)$/gi, '')
        .replace(/-(linear|bold|outline|light|line|duotone|fill|minimalistic|circle|square|round|2|02|01)$/gi, '');

    if (SEMANTIC_LUCIDE_MAP[strippedCore.toLowerCase()]) {
        const comp = (LucideIcons as any)[SEMANTIC_LUCIDE_MAP[strippedCore.toLowerCase()]];
        if (comp) return comp;
    }

    // 3. Exact Lucide match
    if ((LucideIcons as any)[rawCore]) {
        return (LucideIcons as any)[rawCore];
    }

    // 4. PascalCase conversion
    const pascal = rawCore
        .split(/[\s\/_-]+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');

    if ((LucideIcons as any)[pascal]) {
        return (LucideIcons as any)[pascal];
    }

    // 5. PascalCase on stripped core
    const pascalStripped = strippedCore
        .split(/[\s\/_-]+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');

    if ((LucideIcons as any)[pascalStripped]) {
        return (LucideIcons as any)[pascalStripped];
    }

    // 6. Keywords fallback
    if (lower.includes('wrench') || lower.includes('tool')) return LucideIcons.Wrench;
    if (lower.includes('alert') || lower.includes('danger') || lower.includes('warn')) return LucideIcons.AlertTriangle;
    if (lower.includes('pulse') || lower.includes('rate') || lower.includes('activity')) return LucideIcons.Activity;
    if (lower.includes('graph') || lower.includes('chart') || lower.includes('analytics')) return LucideIcons.BarChart3;
    if (lower.includes('trend') && lower.includes('up')) return LucideIcons.TrendingUp;
    if (lower.includes('trend') && lower.includes('down')) return LucideIcons.TrendingDown;
    if (lower.includes('piggy') || lower.includes('save') || lower.includes('saving')) return LucideIcons.PiggyBank;
    if (lower.includes('wallet') || lower.includes('money')) return LucideIcons.Wallet;
    if (lower.includes('check')) return LucideIcons.Check;
    if (lower.includes('close') || lower.includes('cross')) return LucideIcons.X;
    if (lower.includes('edit') || lower.includes('pen')) return LucideIcons.Pen;
    if (lower.includes('calendar') || lower.includes('date')) return LucideIcons.Calendar;
    if (lower.includes('play')) return LucideIcons.Play;
    if (lower.includes('pause')) return LucideIcons.Pause;
    if (lower.includes('rewind') || lower.includes('replay') || (lower.includes('back') && !lower.includes('background'))) return LucideIcons.RotateCcw;
    if (lower.includes('forward')) return LucideIcons.RotateCw;
    if (lower.includes('mic') || lower.includes('voice') || lower.includes('record')) return LucideIcons.Mic;
    if (lower.includes('menu') || lower.includes('dots')) return LucideIcons.MoreHorizontal;
    if (lower.includes('user') || lower.includes('woman') || lower.includes('man') || lower.includes('person')) return LucideIcons.User;
    if (lower.includes('download')) return LucideIcons.Download;
    if (lower.includes('upload')) return LucideIcons.Upload;
    if (lower.includes('tuning') || lower.includes('slider') || lower.includes('control')) return LucideIcons.Sliders;
    if (lower.includes('magic') || lower.includes('wand') || lower.includes('stick')) return LucideIcons.Wand2;

    // Default safe fallback
    return LucideIcons.Tag;
}

/**
 * Utility to extract an exact pixel size from either a size prop or Tailwind class name
 */
const parseNumericSize = (size?: number | string, className?: string): number => {
    if (typeof size === 'number' && !isNaN(size) && size > 0) return size;
    if (typeof size === 'string') {
        const parsed = parseFloat(size);
        if (!isNaN(parsed) && parsed > 0 && !size.includes('%')) return parsed;
    }
    if (className) {
        const customMatch = className.match(/[wh]-\[(\d+)px\]/);
        if (customMatch) return parseInt(customMatch[1], 10);
        
        const twMatch = className.match(/[wh]-([0-9.]+)/);
        if (twMatch) {
            const val = parseFloat(twMatch[1]);
            if (!isNaN(val) && val > 0) return Math.round(val * 4);
        }
    }
    return 20; // Standard default 20px
};

/**
 * Universal AppIcon Component
 * Supports outline/linear icons across all 7 libraries:
 * - solar: (e.g. 'solar:widget-2-linear', 'solar:wallet-money-linear')
 * - ph: (e.g. 'ph:compass-light', 'ph:push-pin-light')
 * - hugeicons: (e.g. 'hugeicons:voice', 'hugeicons:ai-magic')
 * - tabler: (e.g. 'tabler:notebook', 'tabler:trash')
 * - ri: (e.g. 'ri:search-2-line', 'ri:translate-2')
 * - heroicons: (e.g. 'heroicons:information-circle', 'heroicons:arrow-left')
 * - lucide: (e.g. 'lucide:search' or PascalCase 'Search')
 */
export const AppIcon: React.FC<AppIconProps> = ({
    name,
    className = 'w-5 h-5',
    color,
    size,
    style,
    strokeWidth
}) => {
    const isIconify = Boolean(name && name.includes(':'));
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState<boolean>(() => {
        if (!name || !isIconify) return true;
        return iconLoaded(name);
    });

    useEffect(() => {
        if (!name || !isIconify) {
            setIsLoaded(true);
            setHasError(false);
            return;
        }

        if (iconLoaded(name)) {
            setIsLoaded(true);
            setHasError(false);
            return;
        }

        setIsLoaded(false);
        setHasError(false);

        loadIcons([name], (loaded, missing) => {
            const isMissing = missing && missing.some(m => {
                const iconStr = m.provider ? `${m.provider}:${m.prefix}:${m.name}` : `${m.prefix}:${m.name}`;
                return iconStr === name;
            });

            if (isMissing) {
                setHasError(true);
            } else {
                setIsLoaded(true);
            }
        });
    }, [name, isIconify]);

    if (!name) return null;

    const resolvedPx = parseNumericSize(size, className);
    const boxStyle: React.CSSProperties = {
        width: `${resolvedPx}px`,
        height: `${resolvedPx}px`,
        minWidth: `${resolvedPx}px`,
        minHeight: `${resolvedPx}px`,
        maxWidth: `${resolvedPx}px`,
        maxHeight: `${resolvedPx}px`,
        color: color || style?.color,
        ...style
    };

    // 1. Iconify Render Path (when loaded successfully)
    if (isIconify && !hasError && isLoaded) {
        return (
            <span
                className={`inline-flex items-center justify-center shrink-0 ${className}`}
                style={boxStyle}
            >
                <Icon
                    icon={name}
                    className="w-full h-full object-contain"
                    width={resolvedPx}
                    height={resolvedPx}
                    onError={() => setHasError(true)}
                />
            </span>
        );
    }

    // 2. Guaranteed Instant Lucide / Distinct SVG Fallback
    const lowerName = name.toLowerCase();
    if (lowerName.includes('woman') || lowerName.includes('female')) {
        return (
            <span 
                className={`inline-flex items-center justify-center shrink-0 ${className}`}
                style={boxStyle}
            >
                <svg 
                    viewBox="0 0 24 24" 
                    width={resolvedPx} 
                    height={resolvedPx} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={strokeWidth || 1.8} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-full h-full"
                    style={{ color: color || style?.color }}
                >
                    <circle cx="12" cy="7" r="3.5" />
                    <path d="M7.5 11C7 13 7 15 8 16.5" />
                    <path d="M16.5 11C17 13 17 15 16 16.5" />
                    <path d="M6 21v-2a4.5 4.5 0 0 1 4.5-4.5h3a4.5 4.5 0 0 1 4.5 4.5v2" />
                </svg>
            </span>
        );
    }
    if (lowerName.includes('man') && !lowerName.includes('woman') && !lowerName.includes('manager')) {
        return (
            <span 
                className={`inline-flex items-center justify-center shrink-0 ${className}`}
                style={boxStyle}
            >
                <svg 
                    viewBox="0 0 24 24" 
                    width={resolvedPx} 
                    height={resolvedPx} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={strokeWidth || 1.8} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-full h-full"
                    style={{ color: color || style?.color }}
                >
                    <circle cx="12" cy="7" r="3.5" />
                    <path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
                </svg>
            </span>
        );
    }

    const LucideComp = resolveLucideFallback(name);
    return (
        <span 
            className={`inline-flex items-center justify-center shrink-0 ${className}`}
            style={boxStyle}
        >
            <LucideComp
                className="w-full h-full"
                size={resolvedPx}
                strokeWidth={strokeWidth}
                style={{ color: color || style?.color }}
            />
        </span>
    );
};

/**
 * Higher-order component factory for components that expect an icon element type
 * e.g. <SidebarItem icon={createAppIcon('solar:widget-2-linear')} />
 */
export const createAppIcon = (iconName: string) => {
    const Component = (props: { className?: string; size?: number | string; style?: React.CSSProperties; strokeWidth?: number }) => (
        <AppIcon
            name={iconName}
            className={props.className}
            size={props.size}
            style={props.style}
            strokeWidth={props.strokeWidth}
        />
    );
    Component.displayName = `AppIcon(${iconName})`;
    return Component;
};

export default AppIcon;

