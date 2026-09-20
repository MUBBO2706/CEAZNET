import React, { useState, useEffect } from 'react';
import { Icon, loadIcons, iconLoaded } from '@iconify/react';
import * as LucideIcons from 'lucide-react';
import { AppIcon } from '../core/AppIcon';

export interface CategoryIconProps {
    name: string;
    className?: string;
    color?: string;
    size?: number | string;
}

/**
 * Universal CategoryIcon Component
 * Renders icons from:
 * 1. Iconify strings (e.g. 'solar:cart-large-minimalistic-bold-duotone', 'ph:coffee-duotone', 'hugeicons:car-02', 'tabler:tools')
 * 2. Standard Lucide-React icon names (e.g. 'Tag', 'Fuel', 'ShoppingBag')
 */
export const CategoryIcon: React.FC<CategoryIconProps> = ({ 
    name, 
    className = 'w-4 h-4', 
    color, 
    size 
}) => {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState<boolean>(() => {
        if (!name) return true;
        if (!name.includes(':')) return true; // Lucide icon
        return iconLoaded(name);
    });

    // Handle Iconify async loading and error states
    useEffect(() => {
        setHasError(false);
        if (!name || !name.includes(':')) {
            setIsLoaded(true);
            return;
        }

        if (iconLoaded(name)) {
            setIsLoaded(true);
            return;
        }
        
        setIsLoaded(false);
        // Preload icon SVG from Iconify API
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
    }, [name]);

    if (!name || hasError) {
        return <AppIcon name="solar:tag-linear" className={className} style={color ? { color } : undefined} />;
    }

    // 1. Check if it's an Iconify icon (contains ':')
    if (name.includes(':')) {
        return (
            <div className={`relative inline-flex items-center justify-center ${className}`} style={color ? { color } : undefined}>
                {!isLoaded && (
                    <span className="absolute inset-0 bg-gray-200/80 dark:bg-white/10 animate-pulse rounded" />
                )}
                <Icon 
                    icon={name} 
                    className={`w-full h-full transition-opacity duration-150 ${isLoaded ? 'opacity-100' : 'opacity-0'}`} 
                    style={color ? { color } : undefined}
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
        return <LucideComponent className={className} style={color ? { color } : undefined} size={size} />;
    }

    // 3. Fallback to Tag icon
    return <AppIcon name="solar:tag-linear" className={className} style={color ? { color } : undefined} />;
};

/**
 * Factory function to create a React component for any icon name string
 */
export const createUniversalIconComponent = (iconName: string) => {
    return function DynamicUniversalIcon(props: { className?: string; style?: React.CSSProperties; size?: number | string }) {
        return (
            <CategoryIcon 
                name={iconName} 
                className={props.className} 
                size={props.size}
            />
        );
    };
};

export default CategoryIcon;
