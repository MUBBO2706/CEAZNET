
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader } from 'lucide-react';
import { AppIcon } from './core/AppIcon';
import { UserProfile, View } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useToast } from './ToastSystem';
import { formatStat } from '../utils/stringUtils';

interface FloatingHeaderProps {
    onOpenSidebar: () => void;
    user: SupabaseUser | null;
    userProfile: UserProfile;
    onOpenAuthModal: () => void;
    onOpenProfileModal: () => void;
    onLogout: () => void;
    onNavigate: (view: View) => void;
    currentView: View;
    bookmarkCount?: number | null;
    onOpenBookmarks?: () => void;
    isProfileLoading?: boolean;
    notesSearchQuery?: string;
    setNotesSearchQuery?: (query: string) => void;
    financeSearchQuery?: string;
    setFinanceSearchQuery?: (query: string) => void;
    financeViewMode?: 'list' | 'analytics' | 'calendar';
    voiceHistorySearchQuery?: string;
    setVoiceHistorySearchQuery?: (query: string) => void;
    previousView?: View | null;
    articleTitle?: string;
    articleLikes?: number;
    onSaveVoiceSettings?: () => void;
    isSavingVoiceSettings?: boolean;
    articleViews?: number;
    dairyTitle?: string | null;
    onDairyBack?: () => void;
    onDairyDelete?: () => void;
    onDairyEdit?: () => void;
    onDairyImport?: () => void;
    onDairyExport?: () => void;
    onGalleryUpload?: () => void;
    isGalleryUploading?: boolean;
    uiPreferences?: import('../types').UIPreferences;
    expandedVoiceTitle?: string;
    expandedVoiceSubtitle?: string;
    onExpandedVoiceBack?: () => void;
    notesHeaderState?: {
        title: string | null;
        isReadOnly: boolean;
        isWalletLinked: boolean;
        isSyncing: boolean;
        isSaving?: boolean;
        onBack?: () => void;
        onEdit?: () => void;
        onSave?: () => void;
        onSync?: () => void;
    };
    supportHeaderState?: {
        title: string | null;
        onBack?: () => void;
    };
    categoryHeaderState?: {
        title: string | null;
        onBack?: () => void;
        isDetail?: boolean;
        isSaving?: boolean;
        isDeleting?: boolean;
        isCustom?: boolean;
        isNew?: boolean;
        canSave?: boolean;
        onSave?: () => void;
        onDelete?: () => void;
    };
    onOpenTranslatorStats?: () => void;
}

import { useGlobalModal } from './core/GlobalModalProvider';

const UserMenu: React.FC<{ user: SupabaseUser; userProfile: UserProfile; avatarUrl: string; onLogout: () => void | Promise<void>; onOpenProfile: () => void; onClose: () => void }> = ({ user, userProfile, avatarUrl, onLogout, onOpenProfile, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await onLogout();
        } catch (err) {
            console.error("Logout failed:", err);
            setIsLoggingOut(false);
        }
    };

    return (
        <div 
            ref={menuRef} 
            className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-black border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden z-50 origin-top-right"
        >
            <div className="p-4 border-b border-neutral-100 dark:border-gray-800/50 bg-gradient-to-br from-neutral-50/50 to-transparent dark:from-white/5">
                <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                        <div className="absolute -inset-0.5 bg-gradient-to-tr from-amber-400 to-purple-500 rounded-full opacity-50 blur-[1px]"></div>
                        <img src={avatarUrl} alt="User avatar" className="relative h-10 w-10 rounded-full object-cover bg-neutral-200 dark:bg-gray-700 ring-2 ring-white dark:ring-[#1e1f22]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{userProfile.full_name || 'User'}</p>
                        <p className="text-[10px] font-medium text-neutral-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                </div>
            </div>
            
            <div className="py-1">
                <button
                    onClick={onOpenProfile}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-white/5 transition-all group"
                >
                    <AppIcon name="solar:user-circle-linear" className="h-4 w-4 text-neutral-500 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                    <span>Manage Profile</span>
                </button>
                
                <div className="h-px bg-neutral-100 dark:bg-gray-800/50 m-0"></div>

                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isLoggingOut ? (
                        <Loader className="h-4 w-4 animate-spin text-red-500" />
                    ) : (
                        <AppIcon name="solar:logout-2-linear" className="h-4 w-4" />
                    )}
                    <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
                </button>
            </div>
        </div>
    );
};

const sha256 = async (message: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const FloatingHeader: React.FC<FloatingHeaderProps> = (props) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [localFinanceSearchQuery, setLocalFinanceSearchQuery] = useState(props.financeSearchQuery || '');

  useEffect(() => {
      setLocalFinanceSearchQuery(props.financeSearchQuery || '');
  }, [props.financeSearchQuery]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toasts, removeToast, addToast } = useToast();
  const { prompt, alert: globalAlert } = useGlobalModal();
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [isSecretDevOpen, setIsSecretDevOpen] = useState(() => {
      try {
          return localStorage.getItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join('')) === '1';
      } catch {
          return false;
      }
  });

  const handleSettingsClick = async () => {
      const newCount = secretClickCount + 1;
      if (newCount >= 7) {
          const enteredPassword = await prompt("Enter Developer Password:", { type: 'info', inputType: 'password', allowOutsideClick: false });
          if (enteredPassword !== null) {
              const enteredHash = await sha256(enteredPassword);
              const correctHash = "61f88ece20fe57ae1063ac972c802aab52d0efc32f663f6734d55e2e4b9a1d21";
              
              if (enteredHash === correctHash) {
                  try {
                      localStorage.setItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join(''), '1');
                      setIsSecretDevOpen(true);
                      window.location.reload();
                  } catch {}
              } else {
                  addToast("Unauthorized access", "error");
              }
          }
          setSecretClickCount(0);
      } else {
          setSecretClickCount(newCount);
      }
  };

  const handleUserIconClick = () => {
      if (props.user) {
          setIsUserMenuOpen(prev => !prev);
      } else {
          props.onOpenAuthModal();
      }
  };
  
  const handleOpenProfile = () => {
    props.onNavigate('profile');
    setIsUserMenuOpen(false);
  };
  
  const handleLogout = () => {
      props.onLogout();
      addToast("Logged out successfully.", "info");
      setIsUserMenuOpen(false);
  };

  const avatarUrl = props.userProfile.avatar_url 
    ? props.userProfile.avatar_url 
    : `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(props.userProfile.full_name || props.user?.email || 'A')}`;

    const rootViews: View[] = ['home', 'explore', 'notes', 'finance', 'finance-categories', 'dairy', 'gallery', 'translator', 'features', 'about', 'settings', 'profile', 'support', 'privacy-policy', 'terms-of-service'];
    const isRootView = rootViews.includes(props.currentView);
    const isHomeView = props.currentView === 'home';
    
    const isExploreView = props.currentView === 'explore';
    const isNotesView = props.currentView === 'notes';
    const isNotesEditorOpen = isNotesView && props.notesHeaderState?.title != null;
    const isFinanceView = props.currentView === 'finance';
    const isFinanceCategoriesView = props.currentView === 'finance-categories';
    const isDairyView = props.currentView === 'dairy';
    const isGalleryView = props.currentView === 'gallery';
    const isTranslatorView = props.currentView === 'translator';
    const isSettingsView = props.currentView === 'settings';
    const isProfileView = props.currentView === 'profile';
    const isMoleculeView = props.currentView === 'molecule-viewer';
    const isVoiceHistoryView = props.currentView === 'voice-history';
    const isVoiceSettingsView = props.currentView === 'voice-settings';
    const isFeaturesView = props.currentView === 'features';
    const isAboutView = props.currentView === 'about';
    const isArticleReaderView = props.currentView === 'article-reader';
    const isSupportView = props.currentView === 'support';
    const isPrivacyPolicyView = props.currentView === 'privacy-policy';
    const isTermsOfServiceView = props.currentView === 'terms-of-service';

    const isVoiceHistoryFromSidebar = props.currentView === 'voice-history' && props.previousView !== 'live-conversation';
    const showHamburger = (isRootView || isVoiceHistoryFromSidebar) && !props.dairyTitle && !props.expandedVoiceTitle && !isNotesEditorOpen && !props.supportHeaderState?.title && !isFinanceCategoriesView;

  useEffect(() => {
      if (isSearchExpanded && searchInputRef.current) {
          searchInputRef.current.focus();
      }
  }, [isSearchExpanded]);

  // Reset search state when navigating away from Notes, Finance, or Voice History view (or if Finance view is not list mode)
  useEffect(() => {
      if (!isNotesView && !isFinanceView && !isVoiceHistoryView) {
          setIsSearchExpanded(false);
      }
      if (isFinanceView && props.financeViewMode && props.financeViewMode !== 'list') {
          closeSearch();
      }
  }, [isNotesView, isFinanceView, isVoiceHistoryView, props.financeViewMode]);

  const handleMobileNavClick = () => {
      if (isNotesEditorOpen && props.notesHeaderState?.onBack) {
          closeSearch();
          props.notesHeaderState.onBack();
          return;
      }

      if (props.expandedVoiceTitle && props.onExpandedVoiceBack) {
          closeSearch();
          props.onExpandedVoiceBack();
          return;
      }

      if (props.dairyTitle && props.onDairyBack) {
          closeSearch();
          props.onDairyBack();
          return;
      }

      if (props.supportHeaderState?.title && props.supportHeaderState.onBack) {
          closeSearch();
          props.supportHeaderState.onBack();
          return;
      }

      if (isFinanceCategoriesView) {
          closeSearch();
          if (props.categoryHeaderState?.onBack) {
              props.categoryHeaderState.onBack();
          } else {
              props.onNavigate('finance');
          }
          return;
      }

      if (showHamburger) {
          props.onOpenSidebar();
      } else {
          closeSearch();
          switch (props.currentView) {
              case 'article-reader':
                  props.onNavigate('explore');
                  break;
              case 'voice-history':
              case 'voice-settings':
                  props.onNavigate('live-conversation');
                  break;
              default:
                  props.onNavigate('home');
          }
      }
  };

    const closeSearch = () => {
        setIsSearchExpanded(false);
        if (isNotesView && props.setNotesSearchQuery) {
            props.setNotesSearchQuery('');
        }
        if (isFinanceView && props.setFinanceSearchQuery) {
            props.setFinanceSearchQuery('');
        }
        if (isVoiceHistoryView && props.setVoiceHistorySearchQuery) {
            props.setVoiceHistorySearchQuery('');
        }
    };

    return (
      <div className="absolute top-0 left-0 w-full z-30 pointer-events-none flex flex-col">
          <div className="px-4 md:pl-6 py-3 md:py-2 flex justify-between items-start gap-4">
        
        {/* LEFT: Mobile Sidebar Toggle / Back Button + Title */}
        <div className={`pointer-events-auto flex items-center gap-3 z-10 min-w-0 ${isSearchExpanded ? 'flex-none' : 'flex-1'}`}>
            <div className={`${showHamburger ? 'md:hidden' : ''} p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300 flex-shrink-0`}>
                <button
                onClick={handleMobileNavClick}
                className="flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-neutral-900 dark:hover:text-white rounded-full active:scale-95 transition-all"
                >
                {showHamburger ? (
                    // Custom Tapered Hamburger Icon: Bigger Bars, Less Padding
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" x2="21" y1="6" y2="6" />
                        <line x1="3" x2="15" y1="12" y2="12" />
                        <line x1="3" x2="9" y1="18" y2="18" />
                    </svg>
                ) : (props.dairyTitle || props.expandedVoiceTitle || isNotesEditorOpen || props.supportHeaderState?.title || isFinanceCategoriesView) ? (
                    <AppIcon name="heroicons:arrow-left" className="h-5 w-5" />
                ) : (
                    <AppIcon name="heroicons:x-mark" className="h-5 w-5" />
                )}
                </button>
            </div>
            
            {(!isSearchExpanded && (isHomeView || isExploreView || isNotesView || isFinanceView || isFinanceCategoriesView || isDairyView || isGalleryView || isTranslatorView || isSettingsView || isProfileView || isMoleculeView || isVoiceHistoryView || isVoiceSettingsView || isFeaturesView || isAboutView || isArticleReaderView || isSupportView || isPrivacyPolicyView || isTermsOfServiceView)) && (
                <div className={`flex items-center justify-center bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm relative z-20 min-w-0 max-w-[75vw] md:max-w-none w-fit ${(!isNotesEditorOpen) ? 'px-5 md:px-5 h-12 md:h-10' : 'px-4 md:px-4 h-11 md:h-10'}`}>
                    <div className="flex items-baseline gap-2 truncate w-full justify-center">
                        <h1 
                            className={`font-bold text-neutral-800 dark:text-gray-200 truncate transition-all duration-300 ${(!isNotesEditorOpen) ? 'text-xl md:text-lg' : 'text-base md:text-base'} ${isSettingsView ? 'cursor-pointer select-none' : ''}`}
                            onClick={isSettingsView ? handleSettingsClick : undefined}
                        >
                            {isHomeView && "Welcome to Ceaznet"}
                            {isExploreView && "Explore"}
                            {isNotesView && (isNotesEditorOpen ? props.notesHeaderState?.title : "Notes")}
                            {isFinanceView && "Finance"}
                            {isFinanceCategoriesView && (props.categoryHeaderState?.title || "Categories")}
                            {isDairyView && (props.dairyTitle ? `Daily ${props.dairyTitle} Khata` : "Daily Khata")}
                            {isGalleryView && "Gallery"}
                            {isTranslatorView && "Translator"}
                            {isSettingsView && "Settings"}
                            {isProfileView && (props.supportHeaderState?.title || "Profile")}
                            {isMoleculeView && "Chemistry Tools"}
                            {isVoiceHistoryView && (props.expandedVoiceTitle || "Voice History")}
                            {isVoiceSettingsView && "Voice Settings"}
                            {isFeaturesView && "Features"}
                            {isAboutView && "About"}
                            {isArticleReaderView && props.articleTitle}
                            {isSupportView && (props.supportHeaderState?.title || "Support")}
                            {isPrivacyPolicyView && "Privacy Policy"}
                            {isTermsOfServiceView && "Terms of Service"}
                        </h1>
                        {/* PORTAL FOR VIEW-SPECIFIC CENTER ACTIONS */}
                        <div id="floating-header-center-portal" className="flex items-center empty:hidden"></div>
                        {props.expandedVoiceTitle && props.expandedVoiceSubtitle && (
                            <span className="text-[11px] font-medium text-neutral-500 dark:text-gray-400 flex-shrink-0">
                                {props.expandedVoiceSubtitle}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT: Actions Group */}
        <div className={`flex items-center gap-4 z-10 flex-shrink-0 ${isSearchExpanded ? 'flex-1 ml-0' : 'ml-auto'}`}>
            
            {/* Article Stats Pill */}
            {isArticleReaderView && (
                <div className="pointer-events-auto flex items-center gap-3 px-4 h-11 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300">
                    <div className="flex items-center gap-1.5 text-neutral-500 dark:text-gray-400">
                        <AppIcon name="ph:eye-light" className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium tabular-nums">{formatStat(props.articleViews)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-500 dark:text-gray-400">
                        <AppIcon name="solar:heart-linear" className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium tabular-nums">{formatStat(props.articleLikes)}</span>
                    </div>
                </div>
            )}

            {/* Notes Editor Specific Actions - Separated */}
            {isNotesEditorOpen && props.notesHeaderState && !isSearchExpanded && (
                <>
                    {props.notesHeaderState.isWalletLinked && (
                        <div className="pointer-events-auto flex items-center justify-center p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300">
                            <button
                                onClick={props.notesHeaderState.onSync}
                                disabled={props.notesHeaderState.isSyncing}
                                className={`relative flex items-center justify-center h-9 w-9 transition-all focus:outline-none rounded-full ${
                                    props.notesHeaderState.isSyncing 
                                        ? 'text-amber-600 dark:text-amber-400 cursor-wait' 
                                        : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:scale-110'
                                }`}
                                title="Sync Wallet"
                            >
                                {props.notesHeaderState.isSyncing ? <Loader className="h-5 w-5 animate-spin" /> : <AppIcon name="tabler:rotate-clockwise" className="h-5 w-5" />}
                            </button>
                        </div>
                    )}
                    <div className="pointer-events-auto flex items-center justify-center p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300">
                        {props.notesHeaderState.isReadOnly ? (
                            <button 
                                onClick={props.notesHeaderState.onEdit}
                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full"
                                title="Edit"
                            >
                                <AppIcon name="hugeicons:edit-02" className="h-5 w-5" />
                            </button>
                        ) : (
                            <button 
                                onClick={props.notesHeaderState.onSave}
                                disabled={props.notesHeaderState.isSaving}
                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all focus:outline-none rounded-full disabled:opacity-50 disabled:cursor-wait"
                                title="Save"
                            >
                                {props.notesHeaderState.isSaving ? (
                                    <Loader className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <AppIcon name="ph:check-light" className="h-5 w-5" />
                                )}
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Category Detail Specific Actions - Separated Pills */}
            {isFinanceCategoriesView && props.categoryHeaderState?.isDetail && !isSearchExpanded && (
                <>
                    {!props.categoryHeaderState.isNew && props.categoryHeaderState.onDelete && (
                        <div className="pointer-events-auto flex items-center justify-center p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300">
                            <button
                                type="button"
                                onClick={props.categoryHeaderState.onDelete}
                                disabled={props.categoryHeaderState.isDeleting}
                                className="relative flex items-center justify-center h-9 w-9 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:scale-110 active:scale-95 transition-all focus:outline-none rounded-full disabled:opacity-50 disabled:scale-100 cursor-pointer"
                                title={props.categoryHeaderState.isCustom ? "Delete Category" : "Hide Category"}
                                aria-label={props.categoryHeaderState.isCustom ? "Delete Category" : "Hide Category"}
                            >
                                {props.categoryHeaderState.isDeleting ? (
                                    <Loader className="h-5 w-5 animate-spin text-rose-600 dark:text-rose-400" />
                                ) : props.categoryHeaderState.isCustom ? (
                                    <AppIcon name="tabler:trash" className="h-5 w-5" />
                                ) : (
                                    <AppIcon name="ph:eye-slash-light" className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    )}

                    {props.categoryHeaderState.onSave && (
                        <div className="pointer-events-auto flex items-center justify-center p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300">
                            <button
                                type="button"
                                onClick={props.categoryHeaderState.onSave}
                                disabled={props.categoryHeaderState.isSaving || props.categoryHeaderState.canSave === false}
                                className="relative flex items-center justify-center h-9 w-9 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:scale-110 active:scale-95 transition-all focus:outline-none rounded-full disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
                                title={props.categoryHeaderState.isNew ? "Create Category" : "Save Changes"}
                                aria-label={props.categoryHeaderState.isNew ? "Create Category" : "Save Changes"}
                            >
                                {props.categoryHeaderState.isSaving ? (
                                    <Loader className="h-5 w-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <AppIcon name="ph:check-light" className="h-5 w-5 stroke-[2.5]" />
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Main Actions Pill */}
            {(isRootView || isExploreView || isNotesView || isFinanceView || isDairyView || isGalleryView || isTranslatorView || isSettingsView || isMoleculeView || isVoiceHistoryView || isVoiceSettingsView || props.currentView === 'article-reader') && (
                <div className={`pointer-events-auto flex items-center gap-1 p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300 ${isSearchExpanded ? 'w-full flex-1' : ''}`}>
                    
                    {/* Search Bar (Notes, Finance list mode, & Voice History View) */}
                    {(isNotesView || (isFinanceView && (props.financeViewMode === 'list' || !props.financeViewMode)) || (isVoiceHistoryView && !props.expandedVoiceTitle)) && (
                        <div className={`flex items-center transition-all duration-300 ease-in-out ${isSearchExpanded ? 'flex-1 pl-3 pr-1 w-full' : ''}`}>
                            {isSearchExpanded ? (
                                <div className="flex items-center w-full px-2 py-0.5 transition-all duration-300">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isFinanceView && props.setFinanceSearchQuery) {
                                                const trimmed = localFinanceSearchQuery.trim();
                                                if (trimmed !== (props.financeSearchQuery || '').trim()) {
                                                    props.setFinanceSearchQuery(trimmed);
                                                }
                                            }
                                        }}
                                        className="mr-2 flex-shrink-0 text-amber-500 hover:text-amber-600 focus:outline-none"
                                        title={isFinanceView ? "Search transactions (Press Enter)" : "Search"}
                                    >
                                        <AppIcon name="ri:search-2-line" className="w-4 h-4" />
                                    </button>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={isNotesView ? (props.notesSearchQuery || '') : isFinanceView ? localFinanceSearchQuery : (props.voiceHistorySearchQuery || '')}
                                        onChange={(e) => {
                                            if (isNotesView && props.setNotesSearchQuery) {
                                                props.setNotesSearchQuery(e.target.value);
                                            } else if (isFinanceView) {
                                                setLocalFinanceSearchQuery(e.target.value);
                                            } else if (isVoiceHistoryView && props.setVoiceHistorySearchQuery) {
                                                props.setVoiceHistorySearchQuery(e.target.value);
                                            }
                                        }}
                                        placeholder={(isNotesEditorOpen && props.notesHeaderState?.isWalletLinked) ? "Search transactions (Enter)..." : isNotesView ? "Search notes..." : isFinanceView ? "Search transactions (Press Enter)..." : "Search transcripts..."}
                                        className="w-full bg-transparent border-none focus:outline-none text-sm text-neutral-800 dark:text-white placeholder-neutral-400 h-8 font-medium"
                                        onBlur={() => { 
                                            if (isFinanceView) {
                                                if (!localFinanceSearchQuery.trim() && !props.financeSearchQuery) {
                                                    closeSearch();
                                                }
                                            } else {
                                                const query = isNotesView ? props.notesSearchQuery : props.voiceHistorySearchQuery;
                                                if (!query) {
                                                    closeSearch();
                                                } 
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (isFinanceView && props.setFinanceSearchQuery) {
                                                    e.preventDefault();
                                                    const trimmed = localFinanceSearchQuery.trim();
                                                    if (trimmed !== (props.financeSearchQuery || '').trim()) {
                                                        props.setFinanceSearchQuery(trimmed);
                                                    }
                                                }
                                            } else if (e.key === 'Escape') {
                                                closeSearch();
                                            }
                                        }}
                                    />
                                    <button 
                                        onMouseDown={(e) => {
                                            // Use onMouseDown to prevent onBlur from firing first
                                            e.preventDefault();
                                            if (isFinanceView) {
                                                if (localFinanceSearchQuery || props.financeSearchQuery) {
                                                    setLocalFinanceSearchQuery('');
                                                    if (props.setFinanceSearchQuery && props.financeSearchQuery) {
                                                        props.setFinanceSearchQuery('');
                                                    }
                                                    searchInputRef.current?.focus();
                                                } else {
                                                    closeSearch();
                                                }
                                            } else {
                                                const query = isNotesView ? props.notesSearchQuery : props.voiceHistorySearchQuery;
                                                if (query) {
                                                    if (props.setNotesSearchQuery) props.setNotesSearchQuery('');
                                                    if (props.setVoiceHistorySearchQuery) props.setVoiceHistorySearchQuery('');
                                                    searchInputRef.current?.focus();
                                                } else {
                                                    closeSearch();
                                                }
                                            }
                                        }}
                                        className="p-1.5 rounded-full hover:text-amber-500 text-neutral-500 dark:text-gray-400 transition-colors ml-1 flex-shrink-0"
                                        title={((isNotesView ? props.notesSearchQuery : isFinanceView ? (localFinanceSearchQuery || props.financeSearchQuery) : props.voiceHistorySearchQuery) ? "Clear search" : "Close search")}
                                    >
                                        <AppIcon name="heroicons:x-mark" className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsSearchExpanded(true)}
                                    className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full group"
                                    aria-label="Search"
                                >
                                    <AppIcon name="ri:search-2-line" className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Hide other icons when search is expanded */}
                    {!isSearchExpanded && (
                        <>
                            {/* Explore View Specific Actions */}
                            {isExploreView && (
                                <div className="relative">
                                    <button 
                                        onClick={props.onOpenBookmarks}
                                        className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full" 
                                        aria-label="View bookmarked articles"
                                        title="Bookmarks"
                                    >
                                        <AppIcon name="solar:bookmark-linear" className="h-5 w-5" />
                                         {props.bookmarkCount !== null && props.bookmarkCount !== undefined && props.bookmarkCount > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 text-white px-1 pointer-events-none text-[10px] font-bold">
                                                {props.bookmarkCount}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Gallery View Specific Actions: Upload */}
                            {isGalleryView && props.onGalleryUpload && (
                                <div className="relative">
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            props.onGalleryUpload?.();
                                        }}
                                        type="button"
                                        disabled={props.isGalleryUploading}
                                        className={`relative flex items-center justify-center h-9 w-9 transition-all focus:outline-none rounded-full ${
                                            props.isGalleryUploading 
                                                ? 'text-amber-600 dark:text-amber-400 cursor-wait' 
                                                : 'text-neutral-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                                        }`}
                                        aria-label="Upload Media"
                                        title="Upload Media"
                                    >
                                        {props.isGalleryUploading ? <Loader className="h-5 w-5 animate-spin" /> : <AppIcon name="solar:upload-minimalistic-linear" className="h-5 w-5" />}
                                    </button>
                                </div>
                            )}

                            {/* Dairy View Specific Actions: Import & Export */}
                            {isDairyView && (
                                <>
                                    {props.onDairyImport && (
                                        <div className="relative">
                                            <button 
                                                onClick={props.onDairyImport}
                                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all focus:outline-none rounded-full" 
                                                aria-label="Import Data"
                                                title="Import Data"
                                            >
                                                <AppIcon name="solar:upload-minimalistic-linear" className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                    {props.onDairyExport && (
                                        <div className="relative">
                                            <button 
                                                onClick={props.onDairyExport}
                                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all focus:outline-none rounded-full" 
                                                aria-label="Export Data"
                                                title="Export Data"
                                            >
                                                <AppIcon name="solar:download-minimalistic-linear" className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Dairy View Specific Actions: Edit and Delete Buttons */}
                            {isDairyView && props.dairyTitle && (
                                <div className="flex items-center gap-2">
                                    {props.onDairyEdit && (
                                        <div className="relative">
                                            <button 
                                                onClick={props.onDairyEdit}
                                                className="relative flex items-center justify-center h-9 w-9 text-blue-600 dark:text-blue-400 hover:scale-110 rounded-full transition-all focus:outline-none" 
                                                aria-label="Edit Item"
                                                title="Edit Item"
                                            >
                                                <AppIcon name="hugeicons:edit-02" className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"></div>
                                    <div className="relative">
                                        <button 
                                            onClick={props.onDairyDelete}
                                            className="relative flex items-center justify-center h-9 w-9 text-red-600 dark:text-red-400 hover:scale-110 rounded-full transition-all focus:outline-none" 
                                            aria-label="Delete Item"
                                            title="Delete Item"
                                        >
                                            <AppIcon name="tabler:trash" className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PORTAL FOR VIEW-SPECIFIC ACTIONS */}
                            <div id="floating-header-actions-portal" className="flex items-center empty:hidden"></div>



                            {/* Home View Specific Actions */}
                            {isHomeView && (
                                <div className="relative">
                                    <button 
                                        onClick={() => props.onNavigate('support')}
                                        className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full group" 
                                        aria-label="Support Center"
                                        title="Support Center"
                                    >
                                        <AppIcon name="solar:headphones-round-sound-linear" className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    </button>
                                </div>
                            )}

                            {/* Voice Settings Actions */}
                            {isVoiceSettingsView && props.onSaveVoiceSettings && (
                                <div className="relative">
                                    <button 
                                        onClick={props.onSaveVoiceSettings}
                                        disabled={props.isSavingVoiceSettings}
                                        className={`relative flex items-center justify-center h-9 w-9 transition-all focus:outline-none rounded-full ${
                                            props.isSavingVoiceSettings 
                                                ? 'text-amber-600 dark:text-amber-400 cursor-wait' 
                                                : 'text-emerald-600 dark:text-emerald-400 hover:scale-110'
                                        }`}
                                        title="Save Settings"
                                    >
                                        {props.isSavingVoiceSettings ? <Loader className="h-5 w-5 animate-spin" /> : <AppIcon name="ph:check-light" className="h-5 w-5" />}
                                    </button>
                                </div>
                            )}

                            {/* Translator Actions */}
                            {isTranslatorView && props.onOpenTranslatorStats && (
                                <div className="relative">
                                    <button 
                                        onClick={props.onOpenTranslatorStats}
                                        className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full group" 
                                        aria-label="Translator Statistics"
                                        title="Translator Statistics"
                                    >
                                        <AppIcon name="tabler:chart-bar" className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                    </button>
                                </div>
                            )}

                            {(isHomeView || isExploreView || isNotesView || (isFinanceView && (props.financeViewMode === 'list' || !props.financeViewMode)) || isDairyView || isGalleryView || isTranslatorView || (isVoiceHistoryView && !props.expandedVoiceTitle) || isMoleculeView || isSupportView || isVoiceSettingsView || (isProfileView && props.supportHeaderState?.title)) && (
                                <div className="w-px h-5 bg-neutral-200 dark:bg-gray-700 mx-1"></div>
                            )}

                            {/* User Button */}
                            <div className="relative shrink-0">
                                <button
                                    onClick={handleUserIconClick}
                                    className="flex items-center justify-center h-9 w-9 aspect-square shrink-0 text-neutral-600 dark:text-gray-300 hover:ring-2 hover:ring-amber-500/50 focus:outline-none rounded-full transition-all"
                                    aria-label={props.user ? 'User menu' : 'Sign in options'}
                                    title={props.user ? 'User menu' : 'Sign in options'}
                                >
                                    {props.isProfileLoading ? (
                                        <Loader className="h-5 w-5 animate-spin" />
                                    ) : props.user ? (
                                        <img src={avatarUrl} alt="User avatar" className="h-8 w-8 rounded-full object-cover bg-neutral-200 dark:bg-gray-700" />
                                    ) : (
                                        <AppIcon name="solar:login-2-linear" className="h-5 w-5" />
                                    )}
                                </button>
                                
                                {props.user && isUserMenuOpen && (
                                    <UserMenu 
                                        user={props.user} 
                                        userProfile={props.userProfile}
                                        avatarUrl={avatarUrl}
                                        onLogout={props.onLogout} 
                                        onOpenProfile={handleOpenProfile}
                                        onClose={() => setIsUserMenuOpen(false)} 
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
          </div>
      </div>
  );
};

export default React.memo(FloatingHeader);
