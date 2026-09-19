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
    'solar:settings-minimalistic-linear',
    'solar:bookmark-linear',
    'ri:search-2-line',
    'ph:eye-light',
    'ph:eye-slash-light',
    'solar:heart-linear',
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
    'hugeicons:tag-01'
];

try {
    loadIcons(ESSENTIAL_UI_ICONS, () => {
        // preloaded
    });
} catch (e) {
    // Graceful fallback
}

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

    // 1. Iconify Render Path
    if (isIconify && !hasError) {
        return (
            <span
                className={`inline-flex items-center justify-center shrink-0 ${className}`}
                style={{ ...style, color: color || style?.color }}
            >
                <Icon
                    icon={name}
                    className={`w-full h-full transition-opacity duration-150 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    width={size || '100%'}
                    height={size || '100%'}
                    onError={() => setHasError(true)}
                />
            </span>
        );
    }

    // 2. Lucide Component Fallback / Direct Match
    const cleanName = name.replace(/^lucide:/i, '');
    let LucideComp = (LucideIcons as any)[cleanName];
    if (!LucideComp) {
        // Try PascalCase transformation
        const pascal = cleanName.split(/[\s\/_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        LucideComp = (LucideIcons as any)[pascal];
    }

    if (LucideComp) {
        return (
            <LucideComp
                className={className}
                size={size}
                strokeWidth={strokeWidth}
                style={{ ...style, color: color || style?.color }}
            />
        );
    }

    // 3. Fallback generic clean square/circle
    return (
        <span
            className={`inline-block border border-current rounded opacity-60 ${className}`}
            style={{ ...style, width: size || undefined, height: size || undefined, color: color || style?.color }}
        />
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
