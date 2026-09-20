import React, { useState, useEffect } from 'react';
import { Icon, loadIcons, iconLoaded } from '@iconify/react';
import * as LucideIcons from 'lucide-react';
import { AppIcon } from '../core/AppIcon';

export interface CategoryIconProps {
    name: string;
    className?: string;
    color?: string;
    size?: number | string;
    style?: React.CSSProperties;
}

// Global cache for icons that have already been loaded into Iconify memory
const loadedIconSet = new Set<string>();

// Module-level cache for universal icon components to preserve stable function references across re-renders
const universalIconCache = new Map<string, React.ComponentType<any>>();

/**
 * Universal CategoryIcon Component
 * Renders icons from:
 * 1. Iconify strings (e.g. 'solar:cart-large-minimalistic-bold-duotone', 'ph:coffee-duotone', 'hugeicons:car-02', 'tabler:tools')
 * 2. Standard Lucide-React icon names (e.g. 'Tag', 'Fuel', 'ShoppingBag')
 */
export const CategoryIcon: React.FC<CategoryIconProps> = React.memo(({ 
    name, 
    className = 'w-4 h-4', 
    color, 
    size,
    style 
}) => {
    const isIconify = Boolean(name && name.includes(':'));
    const [hasError, setHasError] = useState(false);
    
    // Check if icon is already loaded in Iconify memory / persistent set
    const isInitiallyLoaded = !isIconify || loadedIconSet.has(name) || (typeof iconLoaded === 'function' && iconLoaded(name));
    const [isLoaded, setIsLoaded] = useState<boolean>(isInitiallyLoaded);

    // Handle Iconify async loading without unmounting or blinking
    useEffect(() => {
        setHasError(false);
        if (!isIconify) {
            setIsLoaded(true);
            return;
        }

        if (loadedIconSet.has(name) || (typeof iconLoaded === 'function' && iconLoaded(name))) {
            loadedIconSet.add(name);
            setIsLoaded(true);
            return;
        }

        let isCancelled = false;
        // Preload icon SVG from Iconify API
        loadIcons([name], (_loaded, missing) => {
            if (isCancelled) return;
            const isMissing = missing && missing.some(m => {
                const iconStr = m.provider ? `${m.provider}:${m.prefix}:${m.name}` : `${m.prefix}:${m.name}`;
                return iconStr === name;
            });

            if (isMissing) {
                setHasError(true);
            } else {
                loadedIconSet.add(name);
                setIsLoaded(true);
            }
        });

        return () => {
            isCancelled = true;
        };
    }, [name, isIconify]);

    const combinedStyle = color ? { color, ...style } : style;

    if (!name || hasError) {
        return <AppIcon name="solar:tag-linear" className={className} style={combinedStyle} />;
    }

    // 1. Check if it's an Iconify icon (contains ':')
    if (isIconify) {
        return (
            <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={combinedStyle}>
                <Icon 
                    icon={name} 
                    className="w-full h-full" 
                    style={combinedStyle}
                    width={size || '100%'}
                    height={size || '100%'}
                    onError={() => setHasError(true)}
                />
            </div>
        );
    }

    // 2. Check if it's a Lucide icon (exact match or sanitized PascalCase)
    let LucideComponent = (LucideIcons as any)[name];
    if (!LucideComponent && !name.includes(':')) {
        // Try sanitized PascalCase (e.g., "Slot Machine" -> "SlotMachine", "Award / Trophy" -> "Award", "Lottery Ticket" -> "Ticket")
        const pascalName = name.split(/[\s\/_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
        LucideComponent = (LucideIcons as any)[pascalName];
        
        // Try single-word matches
        if (!LucideComponent) {
            const firstWord = name.split(/[\s\/_-]+/)[0];
            const capitalizedFirst = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
            LucideComponent = (LucideIcons as any)[capitalizedFirst];
        }

        // Specific category keyword fallbacks
        if (!LucideComponent) {
            const lower = name.toLowerCase();
            if (lower.includes('ticket') || lower.includes('lottery')) LucideComponent = LucideIcons.Ticket;
            else if (lower.includes('dice')) LucideComponent = LucideIcons.Dices || LucideIcons.Dice1;
            else if (lower.includes('card')) LucideComponent = LucideIcons.CreditCard || LucideIcons.Ticket;
            else if (lower.includes('trophy') || lower.includes('award')) LucideComponent = LucideIcons.Trophy || LucideIcons.Award;
            else if (lower.includes('slot') || lower.includes('betting') || lower.includes('casino')) LucideComponent = LucideIcons.Gamepad2 || LucideIcons.Coins;
        }
    }

    if (LucideComponent) {
        return <LucideComponent className={className} style={combinedStyle} size={size} />;
    }

    // 3. Fallback to Tag icon
    return <AppIcon name="solar:tag-linear" className={className} style={combinedStyle} />;
});

/**
 * Factory function to create a cached React component for any icon name string.
 * Uses universalIconCache to guarantee referential equality and prevent React unmount/remount cycles.
 */
export const createUniversalIconComponent = (iconName: string) => {
    const key = iconName || 'solar:tag-linear';
    let CachedComp = universalIconCache.get(key);
    if (!CachedComp) {
        CachedComp = React.memo(function DynamicUniversalIcon(props: { className?: string; style?: React.CSSProperties; size?: number | string; color?: string }) {
            return (
                <CategoryIcon 
                    name={key} 
                    className={props.className} 
                    style={props.style}
                    color={props.color}
                    size={props.size}
                />
            );
        });
        CachedComp.displayName = `UniversalIcon_${key.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        universalIconCache.set(key, CachedComp);
    }
    return CachedComp;
};

export default CategoryIcon;
