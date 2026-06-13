
import React, { useState, useEffect } from 'react';
import { View } from '../types';
import { ChevronsLeft, ChevronsRight, Settings, Info } from 'lucide-react';
import Tooltip from './Tooltip';
import ThemeToggle from './ThemeToggle';

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

// --- Custom SVG Icons ---

const OverviewIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
  </svg>
);

const ExploreIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
  </svg>
);

const MemoryIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1.26C6.19 14.47 5 12.38 5 10a7 7 0 0 1 7-7z" />
    <path d="M9 21h6" />
    <path d="M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
  </svg>
);

const TranslatorIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 8l6 6" />
    <path d="M4 14h6" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="M22 22l-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>
);

const StatsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const SelectIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const NotesIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const FinanceIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h20" />
    <path d="M7 12v-3h10v3" />
    <path d="M7 15h10v-3" />
    <path d="M9 12v6" />
    <path d="M15 12v6" />
    <path d="M3 6h18" />
    <path d="M3 18h18" />
  </svg>
);

const DairyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 21h10" />
    <path d="M12 3l7 4-7 4-7-4 7-4z" />
    <path d="M19 7v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7" />
    <path d="M9 21v-4a3 3 0 0 1 6 0v4" />
  </svg>
);

const GalleryIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const AboutIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </svg>
);

const GuideIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    <path d="M12 7v1" />
  </svg>
);

const VoiceIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const HistoryIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v5h5" />
    <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    <path d="M12 7v5l4 2" />
  </svg>
);

const SupportIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const PdfIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M12 18v-6" />
    <path d="M9 15l3 3 3-3" />
  </svg>
);

const TermsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 15l2 2 4-4" />
  </svg>
);

const PrivacyIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, isActive, onClick, isCollapsed }) => {
    return (
        <Tooltip content={label} position="right" align="center" className={isCollapsed ? '' : 'hidden'}>
            <button
                onClick={onClick}
                className={`
                    group relative flex items-center text-sm font-medium transition-all duration-200 ease-in-out w-full
                    ${isActive 
                        ? 'text-indigo-600 dark:text-indigo-400 bg-gradient-to-r from-indigo-50/80 via-indigo-50/20 to-transparent dark:from-indigo-900/30 dark:via-indigo-900/10 dark:to-transparent' 
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/5'
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

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 150);
        return () => clearTimeout(timer);
    }, []);

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
        <div className="relative flex flex-col h-full bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800/60 transition-colors duration-300 w-full">
            
            {/* --- Header --- */}
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} h-16 flex-shrink-0 border-b border-gray-100 dark:border-gray-800/50 transition-all duration-300`}>
                {!isCollapsed ? (
                    <div className="flex items-center gap-2 overflow-hidden w-full">
                        <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight whitespace-nowrap animate-fade-in-up">
                            {activeTitle}
                        </span>
                    </div>
                ) : (
                    <div className="group relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl blur opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 border border-white/10">
                            <span className="text-xl font-bold font-sans">C</span>
                        </div>
                    </div>
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
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800/60 bg-gray-50 dark:bg-black">
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
                                    : 'p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }
                                ${currentView === 'settings' ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' : ''}
                            `}
                        >
                            <Settings className={`
                                transition-transform duration-500 group-hover:rotate-90
                                ${isCollapsed ? 'h-5 w-5' : 'h-5 w-5'}
                            `} />
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
                    <ChevronsLeft className="h-5 w-5" />
                </button>
            </div>
            
            {/* Desktop Sidebar */}
            <div className={`hidden md:block flex-shrink-0 h-full relative ${isMounted ? 'transition-all duration-300 ease-in-out' : ''} ${isCollapsed ? 'w-[72px]' : 'w-fit'}`}>
                {sidebarContent}

                {/* Desktop Edge Toggle Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute top-5 -right-4 w-8 h-8 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-full shadow-sm flex items-center justify-center z-10 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-transform hover:scale-110"
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
                </button>
            </div>
        </>
    );
};

export default Sidebar;
