import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { AlertTriangle, Wrench, Beaker, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SuspendedInfoModal } from './SuspendedInfoModal';
import { setBannerThemeColor } from '../utils/themeColor';

function getBannerBackgroundColor(bannerType: string, isDark: boolean, element?: HTMLDivElement | null): string {
    switch (bannerType) {
        case 'maintenance':
            return isDark ? '#251A0B' : '#FFFBEB';
        case 'development':
            return isDark ? '#061726' : '#EFF6FF';
        case 'testing':
            return isDark ? '#120E24' : '#EEF2FF';
        case 'alert':
        case 'suspended':
            return isDark ? '#2A0E12' : '#FEF2F2';
    }

    if (element) {
        const computedBg = window.getComputedStyle(element).backgroundColor;
        if (computedBg && computedBg !== 'transparent' && computedBg !== 'rgba(0, 0, 0, 0)') {
            return computedBg;
        }
    }

    return isDark ? '#2A0E12' : '#FEF2F2';
}

interface SystemBannerData {
    id: string;
    banner_type: string;
    is_active: boolean;
}

const PREDEFINED_BANNERS: Record<string, { icon: React.ElementType, title: string, description: React.ReactNode, colors: { bg: string, border: string, title: string, desc: string, icon: string, iconBg: string } }> = {
    'maintenance': {
        icon: Wrench,
        title: 'System Maintenance',
        description: 'The system is currently undergoing scheduled maintenance. Some features may be temporarily unavailable.',
        colors: {
            bg: 'bg-amber-50 dark:bg-[#251A0B]',
            border: 'border-amber-200/60 dark:border-amber-900/40',
            title: 'text-amber-900 dark:text-amber-400',
            desc: 'text-amber-800/90 dark:text-amber-500/90',
            iconBg: 'bg-amber-200/50 dark:bg-amber-500/10',
            icon: 'text-amber-700 dark:text-amber-500'
        }
    },
    'development': {
        icon: Wrench,
        title: 'Under Development',
        description: 'This environment is actively under development. You may experience bugs or unexpected behavior.',
        colors: {
            bg: 'bg-blue-50 dark:bg-[#061726]',
            border: 'border-blue-200/60 dark:border-blue-900/40',
            title: 'text-blue-900 dark:text-blue-400',
            desc: 'text-blue-800/90 dark:text-blue-500/90',
            iconBg: 'bg-blue-200/50 dark:bg-blue-500/10',
            icon: 'text-blue-700 dark:text-blue-500'
        }
    },
    'testing': {
        icon: Beaker,
        title: 'Beta Testing',
        description: 'You are currently using a testing environment. Please report any issues you encounter.',
        colors: {
            bg: 'bg-indigo-50 dark:bg-[#120E24]',
            border: 'border-indigo-200/60 dark:border-indigo-900/40',
            title: 'text-indigo-900 dark:text-indigo-400',
            desc: 'text-indigo-800/90 dark:text-indigo-500/90',
            iconBg: 'bg-indigo-200/50 dark:bg-indigo-500/10',
            icon: 'text-indigo-700 dark:text-indigo-500'
        }
    },
    'alert': {
        icon: AlertTriangle,
        title: 'Important Alert',
        description: 'We are currently experiencing performance degradation. Our team is investigating the issue.',
        colors: {
            bg: 'bg-red-50 dark:bg-[#2A0E12]',
            border: 'border-red-200/60 dark:border-red-900/40',
            title: 'text-red-900 dark:text-red-400',
            desc: 'text-red-800/90 dark:text-red-500/90',
            iconBg: 'bg-red-200/50 dark:bg-red-500/10',
            icon: 'text-red-700 dark:text-red-500'
        }
    }
};

let globalBannerCache: { data: SystemBannerData | null; timestamp: number } | null = null;
let globalBannerPending: Promise<SystemBannerData | null> | null = null;

export const SystemBanner: React.FC<{ isSuspended?: boolean }> = ({ isSuspended }) => {
    const { user } = useAuth();
    const [banner, setBanner] = useState<SystemBannerData | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hasError, setHasError] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBanner = async (force = false) => {
            try {
                const now = Date.now();
                if (!force && globalBannerCache && (now - globalBannerCache.timestamp < 60000)) {
                    setBanner(globalBannerCache.data);
                    return;
                }

                if (!force && globalBannerPending) {
                    const res = await globalBannerPending;
                    setBanner(res);
                    return;
                }

                globalBannerPending = (async () => {
                    const { data, error } = await supabase
                        .from('broadcasts')
                        .select('id, banner_type, is_active')
                        .eq('type', 'system_banner')
                        .eq('is_active', true)
                        .limit(1);

                    if (error) {
                        setHasError(true);
                        return null;
                    }

                    const bannerData = (data && data.length > 0) ? data[0] : null;
                    globalBannerCache = { data: bannerData, timestamp: Date.now() };
                    return bannerData;
                })();

                const result = await globalBannerPending;
                globalBannerPending = null;
                setBanner(result);
            } catch (error) {
                globalBannerPending = null;
            }
        };

        fetchBanner();

        if (!user) {
            // For anonymous sessions, only fetch once on mount; do NOT establish a heavy WebSocket subscription.
            return;
        }

        let isUnmounted = false;

        const uniqueChannelId = `system_banner_changes_${Math.random().toString(36).substring(7)}`;
        const channel = supabase.channel(uniqueChannelId)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'broadcasts', filter: 'type=eq.system_banner' },
                (payload: any) => {
                    if (isUnmounted) return;
                    // Extra security verification check on client payload
                    const record = payload.new || payload.old;
                    if (record && record.type !== 'system_banner') {
                        return;
                    }
                    fetchBanner(true); // force fetch on actual DB events
                }
            )
            .subscribe((status) => {
                // Do not fetch on subscription status updates to prevent redundant network requests.
                // The initial load fetch on mount is sufficient, and real-time events handle updates.
            });

        return () => {
            isUnmounted = true;
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const bannerRef = useRef<HTMLDivElement>(null);

    let activeConfig = null;

    if (isSuspended) {
        activeConfig = {
            icon: AlertTriangle,
            title: 'Account Suspended',
            description: (
                <span>
                    Your account is suspended, you are not able to create or update anything. For more info{' '}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsModalOpen(true);
                        }}
                        className="underline font-semibold text-red-900 dark:text-red-400 hover:text-red-700"
                    >
                        click here
                    </button>
                    .
                </span>
            ),
            colors: {
                bg: 'bg-red-50 dark:bg-[#2A0E12]',
                border: 'border-red-200/60 dark:border-red-900/40',
                title: 'text-red-900 dark:text-red-400',
                desc: 'text-red-800/90 dark:text-red-500/90',
                iconBg: 'bg-red-200/50 dark:bg-red-500/10',
                icon: 'text-red-700 dark:text-red-500'
            }
        };
    } else if (banner && !hasError && banner.is_active) {
        activeConfig = PREDEFINED_BANNERS[banner.banner_type] || PREDEFINED_BANNERS['alert'];
    }

    const effectiveBannerType = isSuspended
        ? 'suspended'
        : (banner && !hasError && banner.is_active ? (banner.banner_type || 'alert') : null);

    useEffect(() => {
        if (!effectiveBannerType) {
            setBannerThemeColor(null);
            return;
        }

        const syncThemeColor = () => {
            const isDark = document.documentElement.classList.contains('dark');
            const targetColor = getBannerBackgroundColor(effectiveBannerType, isDark, bannerRef.current);
            setBannerThemeColor(targetColor);
        };

        syncThemeColor();

        const observer = new MutationObserver(syncThemeColor);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => {
            observer.disconnect();
        };
    }, [effectiveBannerType]);

    useEffect(() => {
        return () => {
            setBannerThemeColor(null);
        };
    }, []);

    if (!activeConfig) return null;

    const Icon = activeConfig.icon;

    return (
        <div className="flex flex-col relative z-50">
            <div 
                ref={bannerRef}
                onClick={() => setIsCollapsed(!isCollapsed)}
                className={`w-full ${activeConfig.colors.bg} border-b ${activeConfig.colors.border} pointer-events-auto transition-all duration-300 relative z-40 cursor-pointer`}
            >
                {/* Safe area top for mobile web apps */}
                <div className="pt-safe" />
            
            <div className="w-full pl-4 pr-4 sm:pr-6 lg:pr-8 py-2 md:py-2 flex items-start sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center flex-1 overflow-hidden gap-1 sm:gap-0 pt-0.5 sm:pt-0">
                    <div className="flex items-start sm:items-center gap-2 sm:gap-3 shrink-0 sm:pr-3">
                        <Icon className={`w-4 h-4 shrink-0 mt-[1.5px] sm:mt-0 ${activeConfig.colors.icon}`} strokeWidth={2.5}/>
                        
                        <span className={`font-medium text-sm leading-tight shrink-0 pt-0.5 sm:pt-0 ${activeConfig.colors.title}`}>
                            {activeConfig.title}
                        </span>
                    </div>
                    
                    <div className={`text-[13px] leading-snug sm:text-sm sm:leading-tight ${activeConfig.colors.desc} ${isCollapsed ? 'line-clamp-1 sm:line-clamp-none' : ''}`}>
                        {activeConfig.description}
                    </div>
                </div>
                
                <div className={`shrink-0 -mr-1 mt-1 sm:mt-0 self-center transition-transform md:hidden ${activeConfig.colors.icon}`}>
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
            </div>
            </div>
            {isSuspended && (
                <SuspendedInfoModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};
