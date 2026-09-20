
import React, { useState, useEffect, useRef } from 'react';
import { View } from '../types';
import Tooltip from './Tooltip';
import ThemeToggle from './ThemeToggle';
import { AppIcon, createAppIcon } from './core/AppIcon';

interface SidebarProps {
    isMobileOpen: boolean;
    onMobileClose: () => void;
    currentView: View;
    onNavigate: (view: View) => void;
}

interface SidebarItemProps {
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
    isCollapsed: boolean;
}

// --- Enhanced Outline / Linear Icons across 7 Libraries ---
const OverviewIcon = createAppIcon('solar:widget-2-linear');
const ExploreIcon = createAppIcon('ph:compass-light');
const NotesIcon = createAppIcon('tabler:notebook');
const FinanceIcon = createAppIcon('solar:wallet-money-linear');
const DairyIcon = createAppIcon('solar:notebook-bookmark-linear');
const GalleryIcon = createAppIcon('solar:gallery-linear');
const TranslatorIcon = createAppIcon('ri:translate-2');
const VoiceIcon = createAppIcon('hugeicons:voice');
const HistoryIcon = createAppIcon('tabler:history');
const SupportIcon = createAppIcon('hugeicons:customer-support');
const GuideIcon = createAppIcon('hugeicons:ai-magic');
const AboutIcon = createAppIcon('heroicons:information-circle');
const TermsIcon = createAppIcon('tabler:file-text');
const PrivacyIcon = createAppIcon('ph:shield-light');

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, isActive, onClick, isCollapsed }) => {
    return (
        <Tooltip content={label} position="right" align="center" className={isCollapsed ? '' : 'hidden'}>
            <button
                onClick={onClick}
                className={`
                    group relative flex items-center text-sm font-medium transition-all duration-200 ease-in-out w-full
                    ${isActive 
                        ? 'text-indigo-600 dark:text-indigo-400 font-semibold' 
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                    }
                    ${isCollapsed ? 'justify-center py-3' : 'justify-start py-3 pl-5 pr-8'}
                    whitespace-nowrap
                `}
            >
                {/* Active Indicator - Sharp Line with Gap from Left Edge */}
                {!isCollapsed && isActive && (
                    <div 
                        className="absolute top-0 bottom-0 w-[3px] bg-indigo-600 dark:bg-indigo-400"
                        style={{ left: '2px' }}
                    />
                )}
                
                {/* Collapsed State Dot */}
                {isCollapsed && isActive && (
                     <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 ml-1"></div>
                )}

                <Icon 
                    className={`
                        transition-all duration-300 flex-shrink-0
                        ${isCollapsed ? 'h-5 w-5' : 'h-5 w-5 mr-3'} 
                        ${isActive 
                            ? 'text-indigo-600 dark:text-indigo-400' 
                            : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'
                        }
                    `} 
                />
                
                {!isCollapsed && (
                    <span className={`truncate ${isActive ? 'font-semibold' : ''}`}>
                        {label}
                    </span>
                )}
            </button>
        </Tooltip>
    );
};

const SectionHeader: React.FC<{ label: string; isCollapsed: boolean }> = ({ label, isCollapsed }) => {
    if (isCollapsed) return <div className="h-px bg-gray-100 dark:bg-gray-800/50 mx-4 my-3" />; 
    return (
        <div className="px-6 pt-6 pb-2">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider select-none whitespace-nowrap">
                {label}
            </p>
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onMobileClose, currentView, onNavigate }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 150);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const updateWidth = () => {
            const isDesktop = window.matchMedia('(min-width: 768px)').matches;
            if (isDesktop && sidebarRef.current) {
                const actualWidth = sidebarRef.current.offsetWidth;
                document.documentElement.style.setProperty('--sidebar-width', `${actualWidth}px`);
            } else {
                document.documentElement.style.setProperty('--sidebar-width', '0px');
            }
        };

        updateWidth();
        
        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && sidebarRef.current) {
            resizeObserver = new ResizeObserver(() => {
                updateWidth();
            });
            resizeObserver.observe(sidebarRef.current);
        }
        
        const mediaQuery = window.matchMedia('(min-width: 768px)');
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', updateWidth);
        } else {
            window.addEventListener('resize', updateWidth);
        }

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', updateWidth);
            } else {
                window.removeEventListener('resize', updateWidth);
            }
        };
    }, [isCollapsed, isMounted]);

    const getViewTitle = (view: View): string => {
        switch (view) {
            case 'home': return 'Overview';
            case 'explore':
            case 'article-reader': return 'Explore News';
            case 'notes': return 'Notes';
            case 'finance': return 'Finance';
            case 'dairy': return 'Daily Khata';
            case 'gallery': return 'Gallery';
            case 'translator': return 'Translator';
            case 'live-conversation': return 'Live Voice';
            case 'settings': return 'Settings';
            case 'features': return 'Features Guide';
            case 'about': return 'About Ceaznet';
            case 'support': return 'Support Center';
            case 'privacy-policy': return 'Privacy Policy';
            case 'terms-of-service': return 'Terms of Service';
            default: return 'Overview';
        }
    };

    const activeTitle = getViewTitle(currentView);

    const sidebarContent = (
        <div className="relative flex flex-col h-full bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800/60 transition-colors duration-300 w-full" style={{ paddingBottom: 'var(--dev-console-padding, 0px)' }}>
            
            {/* --- Header --- */}
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} h-16 flex-shrink-0 border-b border-gray-100 dark:border-gray-800/50 transition-all duration-300`}>
                {!isCollapsed ? (
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                        <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight whitespace-nowrap animate-fade-in-up">
                            {activeTitle}
                        </span>
                    </div>
                ) : (
                    <img src="/logo.png" alt="Ceaznet Favicon" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                )}
            </div>

            {/* --- Scrollable Content --- */}
            <div className="flex-grow overflow-y-auto scrollbar-hide py-2">
                
                {/* Primary Navigation */}
                <div className="mt-2">
                    <SidebarItem 
                        icon={OverviewIcon} 
                        label="Overview" 
                        isActive={currentView === 'home'} 
                        onClick={() => onNavigate('home')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={ExploreIcon} 
                        label="Explore News" 
                        isActive={currentView === 'explore' || currentView === 'article-reader'} 
                        onClick={() => onNavigate('explore')} 
                        isCollapsed={isCollapsed}
                    />
                </div>

                {/* Tools Section */}
                <div>
                    <SectionHeader label="Workspace" isCollapsed={isCollapsed} />
                    
                    <SidebarItem 
                        icon={NotesIcon} 
                        label="Notes" 
                        isActive={currentView === 'notes'} 
                        onClick={() => onNavigate('notes')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={FinanceIcon} 
                        label="Finance" 
                        isActive={currentView === 'finance'} 
                        onClick={() => onNavigate('finance')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={DairyIcon} 
                        label="Daily Khata" 
                        isActive={currentView === 'dairy'} 
                        onClick={() => onNavigate('dairy')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={GalleryIcon} 
                        label="Gallery" 
                        isActive={currentView === 'gallery'} 
                        onClick={() => onNavigate('gallery')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={TranslatorIcon} 
                        label="Translator" 
                        isActive={currentView === 'translator'} 
                        onClick={() => onNavigate('translator')} 
                        isCollapsed={isCollapsed}
                    />
                </div>

                {/* Voice Section */}
                <div>
                    <SectionHeader label="Voice" isCollapsed={isCollapsed} />
                    <SidebarItem 
                        icon={VoiceIcon} 
                        label="Voice" 
                        isActive={currentView === 'live-conversation'} 
                        onClick={() => onNavigate('live-conversation')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={HistoryIcon} 
                        label="Voice History" 
                        isActive={currentView === 'voice-history'} 
                        onClick={() => onNavigate('voice-history')} 
                        isCollapsed={isCollapsed}
                    />
                </div>

                {/* Meta Section */}
                <div>
                    <SectionHeader label="App" isCollapsed={isCollapsed} />
                    <SidebarItem 
                        icon={SupportIcon} 
                        label="Support Center" 
                        isActive={currentView === 'support'} 
                        onClick={() => onNavigate('support')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={GuideIcon} 
                        label="Features Guide" 
                        isActive={currentView === 'features'} 
                        onClick={() => onNavigate('features')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={AboutIcon} 
                        label="About Ceaznet" 
                        isActive={currentView === 'about'} 
                        onClick={() => onNavigate('about')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={TermsIcon} 
                        label="Terms of Service" 
                        isActive={currentView === 'terms-of-service'} 
                        onClick={() => onNavigate('terms-of-service')} 
                        isCollapsed={isCollapsed}
                    />
                    <SidebarItem 
                        icon={PrivacyIcon} 
                        label="Privacy Policy" 
                        isActive={currentView === 'privacy-policy'} 
                        onClick={() => onNavigate('privacy-policy')} 
                        isCollapsed={isCollapsed}
                    />
                </div>
            </div>

            {/* --- Footer --- */}
            <div className="flex-shrink-0 px-4 pt-2.5 pb-2.5 border-t border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black">
                <div className={`flex items-center ${isCollapsed ? 'flex-col gap-4' : 'justify-between gap-4'}`}>
                    <ThemeToggle isCollapsed={isCollapsed} />
                    
                    {/* Divider if collapsed */}
                    {isCollapsed && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />}

                    <Tooltip content="Settings" position={isCollapsed ? "right" : "top"} align="center">
                        <button 
                            onClick={() => onNavigate('settings')}
                            className={`
                                group flex items-center justify-center transition-all duration-200
                                ${isCollapsed 
                                    ? 'w-8 h-8 text-gray-500 hover:text-gray-900' 
                                    : 'p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }
                                ${currentView === 'settings' ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : ''}
                            `}
                        >
                            <AppIcon 
                                name="solar:settings-minimalistic-linear" 
                                className={`
                                    transition-transform duration-500 group-hover:rotate-90
                                    ${isCollapsed ? 'h-5 w-5' : 'h-5 w-5'}
                                `} 
                            />
                        </button>
                    </Tooltip>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 md:hidden ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} ${isMounted ? 'transition-transform duration-300 ease-in-out' : ''} shadow-2xl h-full max-w-[85vw] w-fit`}>
                {sidebarContent}
                
                {/* Floating Close Button on the Edge - Hides when closed */}
                <button
                    onClick={onMobileClose}
                    className={`absolute top-4 -right-4 w-8 h-8 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-full shadow-md flex items-center justify-center z-50 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    aria-label="Close sidebar"
                >
                    <AppIcon name="tabler:chevron-left" className="h-5 w-5" />
                </button>
            </div>
            
            {/* Desktop Sidebar */}
            <div ref={sidebarRef} className={`hidden md:block flex-shrink-0 h-full relative z-50 ${isMounted ? 'transition-all duration-300 ease-in-out' : ''} ${isCollapsed ? 'w-[72px]' : 'w-max'}`}>
                {sidebarContent}

                {/* Desktop Edge Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute top-5 -right-4 w-8 h-8 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-full shadow-sm flex items-center justify-center z-50 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-transform hover:scale-110"
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <AppIcon name="tabler:chevron-right" className="h-5 w-5" /> : <AppIcon name="tabler:chevron-left" className="h-5 w-5" />}
                </button>
            </div>
        </>
    );
};

export default React.memo(Sidebar);
