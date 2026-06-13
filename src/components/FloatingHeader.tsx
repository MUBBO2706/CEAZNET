
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, UserCircle2, LogIn, X, Bookmark, LoaderCircle, Search, Eye, Heart, ArrowLeft, Trash2, Upload, Download, RefreshCw, Edit2, Check, HeadphonesIcon } from 'lucide-react';
import { UserProfile, View } from '../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useToast } from './ToastManager';
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
        onBack?: () => void;
        onEdit?: () => void;
        onSave?: () => void;
        onSync?: () => void;
    };
    supportHeaderState?: {
        title: string | null;
        onBack?: () => void;
    };
}

const UserMenu: React.FC<{ user: SupabaseUser; userProfile: UserProfile; avatarUrl: string; onLogout: () => void; onOpenProfile: () => void; onClose: () => void }> = ({ user, userProfile, avatarUrl, onLogout, onOpenProfile, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div 
            ref={menuRef} 
            className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-black border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right"
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
            
            <div className="p-2 space-y-1">
                <button
                    onClick={onOpenProfile}
                    className="w-full flex items-center gap-3 p-2.5 text-sm font-medium text-neutral-700 dark:text-gray-300 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-all group"
                >
                    <div className="p-1.5 bg-neutral-100 dark:bg-gray-800 rounded-lg text-neutral-500 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:bg-amber-50 dark:group-hover:bg-amber-900/20 transition-colors">
                        <UserCircle2 className="h-4 w-4" />
                    </div>
                    <span>Manage Profile</span>
                </button>
                
                <div className="h-px bg-neutral-100 dark:bg-gray-800/50 my-1 mx-2"></div>

                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 p-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all group"
                >
                    <div className="p-1.5 bg-red-50 dark:bg-red-900/10 rounded-lg group-hover:bg-red-100 dark:group-hover:bg-red-900/30 transition-colors">
                        <LogOut className="h-4 w-4" />
                    </div>
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    );
};

const FloatingHeader: React.FC<FloatingHeaderProps> = (props) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toasts, removeToast, addToast } = useToast();
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [isSecretDevOpen, setIsSecretDevOpen] = useState(() => {
      try {
          return localStorage.getItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join('')) === '1';
      } catch {
          return false;
      }
  });

  const handleSettingsClick = () => {
      setSecretClickCount(prev => {
          const newCount = prev + 1;
          if (newCount >= 7) {
              try {
                  localStorage.setItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join(''), '1');
                  setIsSecretDevOpen(true);
                  window.location.reload();
              } catch {}
              return 0;
          }
          return newCount;
      });
  };

  const handleUserIconClick = () => {
      if (props.user) {
          setIsUserMenuOpen(prev => !prev);
      } else {
          props.onOpenAuthModal();
      }
  };
  
  const handleOpenProfile = () => {
    props.onOpenProfileModal();
    setIsUserMenuOpen(false);
  }
  
  const handleLogout = () => {
      props.onLogout();
      addToast("Logged out successfully.", "info");
      setIsUserMenuOpen(false);
  };

  const avatarUrl = props.userProfile.avatar_url 
    ? props.userProfile.avatar_url 
    : `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(props.userProfile.full_name || props.user?.email || 'A')}`;

    const rootViews: View[] = ['home', 'explore', 'notes', 'finance', 'dairy', 'gallery', 'translator', 'features', 'about', 'settings', 'support', 'privacy-policy', 'terms-of-service'];
    const isRootView = rootViews.includes(props.currentView);
    const isHomeView = props.currentView === 'home';
    
    const isExploreView = props.currentView === 'explore';
    const isNotesView = props.currentView === 'notes';
    const isNotesEditorOpen = isNotesView && props.notesHeaderState?.title != null;
    const isFinanceView = props.currentView === 'finance';
    const isDairyView = props.currentView === 'dairy';
    const isGalleryView = props.currentView === 'gallery';
    const isTranslatorView = props.currentView === 'translator';
    const isSettingsView = props.currentView === 'settings';
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
    const showHamburger = (isRootView || isVoiceHistoryFromSidebar) && !props.dairyTitle && !props.expandedVoiceTitle && !isNotesEditorOpen && !props.supportHeaderState?.title;

  useEffect(() => {
      if (isSearchExpanded && searchInputRef.current) {
          searchInputRef.current.focus();
      }
  }, [isSearchExpanded]);

  // Reset search state when navigating away from Notes, Finance, or Voice History view
  useEffect(() => {
      if (!isNotesView && !isFinanceView && !isVoiceHistoryView) {
          setIsSearchExpanded(false);
      }
  }, [isNotesView, isFinanceView, isVoiceHistoryView]);

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
                ) : (props.dairyTitle || props.expandedVoiceTitle || isNotesEditorOpen || props.supportHeaderState?.title) ? (
                    <ArrowLeft className="h-5 w-5" />
                ) : (
                    <X className="h-5 w-5" />
                )}
                </button>
            </div>
            
            {(!isSearchExpanded && (isHomeView || isExploreView || isNotesView || isFinanceView || isDairyView || isGalleryView || isTranslatorView || isSettingsView || isMoleculeView || isVoiceHistoryView || isVoiceSettingsView || isFeaturesView || isAboutView || isArticleReaderView || isSupportView || isPrivacyPolicyView || isTermsOfServiceView)) && (
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
                            {isDairyView && (props.dairyTitle ? `Daily ${props.dairyTitle} Khata` : "Daily Khata")}
                            {isGalleryView && "Gallery"}
                            {isTranslatorView && "Translator"}
                            {isSettingsView && "Settings"}
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
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium tabular-nums">{formatStat(props.articleViews)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-500 dark:text-gray-400">
                        <Heart className="h-3.5 w-3.5" />
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
                                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-black/5 dark:hover:bg-white/10'
                                }`}
                                title="Sync Wallet"
                            >
                                {props.notesHeaderState.isSyncing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                            </button>
                        </div>
                    )}
                    <div className="pointer-events-auto flex items-center justify-center p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300">
                        {props.notesHeaderState.isReadOnly ? (
                            <button 
                                onClick={props.notesHeaderState.onEdit}
                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full"
                                title="Edit"
                            >
                                <Edit2 className="h-5 w-5" />
                            </button>
                        ) : (
                            <button 
                                onClick={props.notesHeaderState.onSave}
                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all focus:outline-none rounded-full"
                                title="Save"
                            >
                                <Check className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Main Actions Pill */}
            {(isRootView || isExploreView || isNotesView || isFinanceView || isDairyView || isGalleryView || isSettingsView || isMoleculeView || isVoiceHistoryView || isVoiceSettingsView || props.currentView === 'article-reader') && (
                <div className={`pointer-events-auto flex items-center gap-1 p-1 bg-white/80 dark:bg-black/60 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-full shadow-sm transition-all duration-300 ${isSearchExpanded ? 'w-full flex-1' : ''}`}>
                    
                    {/* Search Bar (Notes, Finance, & Voice History View) */}
                    {(isNotesView || isFinanceView || (isVoiceHistoryView && !props.expandedVoiceTitle)) && (
                        <div className={`flex items-center transition-all duration-300 ease-in-out ${isSearchExpanded ? 'flex-1 pl-3 pr-1 w-full' : ''}`}>
                            {isSearchExpanded ? (
                                <div className="flex items-center w-full px-2 py-0.5 transition-all duration-300">
                                    <Search className="w-4 h-4 text-amber-500 mr-2 flex-shrink-0" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={isNotesView ? (props.notesSearchQuery || '') : isFinanceView ? (props.financeSearchQuery || '') : (props.voiceHistorySearchQuery || '')}
                                        onChange={(e) => {
                                            if (isNotesView && props.setNotesSearchQuery) {
                                                props.setNotesSearchQuery(e.target.value);
                                            } else if (isFinanceView && props.setFinanceSearchQuery) {
                                                props.setFinanceSearchQuery(e.target.value);
                                            } else if (isVoiceHistoryView && props.setVoiceHistorySearchQuery) {
                                                props.setVoiceHistorySearchQuery(e.target.value);
                                            }
                                        }}
                                        placeholder={(isNotesEditorOpen && props.notesHeaderState?.isWalletLinked) ? "Search transactions..." : isNotesView ? "Search notes..." : isFinanceView ? "Search transactions..." : "Search transcripts..."}
                                        className="w-full bg-transparent border-none focus:outline-none text-sm text-neutral-800 dark:text-white placeholder-neutral-400 h-8 font-medium"
                                        onBlur={() => { 
                                            const query = isNotesView ? props.notesSearchQuery : isFinanceView ? props.financeSearchQuery : props.voiceHistorySearchQuery;
                                            if (!query) {
                                                closeSearch();
                                            } 
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                                closeSearch();
                                            }
                                        }}
                                    />
                                    <button 
                                        onMouseDown={(e) => {
                                            // Use onMouseDown to prevent onBlur from firing first
                                            e.preventDefault();
                                            const query = isNotesView ? props.notesSearchQuery : isFinanceView ? props.financeSearchQuery : props.voiceHistorySearchQuery;
                                            if (query) {
                                                if (props.setNotesSearchQuery) props.setNotesSearchQuery('');
                                                if (props.setFinanceSearchQuery) props.setFinanceSearchQuery('');
                                                if (props.setVoiceHistorySearchQuery) props.setVoiceHistorySearchQuery('');
                                                searchInputRef.current?.focus();
                                            } else {
                                                closeSearch();
                                            }
                                        }}
                                        className="p-1.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-gray-400 transition-colors ml-1 flex-shrink-0"
                                        title={((isNotesView ? props.notesSearchQuery : isFinanceView ? props.financeSearchQuery : props.voiceHistorySearchQuery) ? "Clear search" : "Close search")}
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsSearchExpanded(true)}
                                    className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full group"
                                    aria-label="Search"
                                >
                                    <Search className="h-5 w-5 group-hover:scale-110 transition-transform" />
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
                                        className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full" 
                                        aria-label="View bookmarked articles"
                                        title="Bookmarks"
                                    >
                                        <Bookmark className="h-5 w-5" />
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
                                                : 'text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                                        }`}
                                        aria-label="Upload Media"
                                        title="Upload Media"
                                    >
                                        {props.isGalleryUploading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
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
                                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all focus:outline-none rounded-full" 
                                                aria-label="Import Data"
                                                title="Import Data"
                                            >
                                                <Upload className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                    {props.onDairyExport && (
                                        <div className="relative">
                                            <button 
                                                onClick={props.onDairyExport}
                                                className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-blue-600 dark:hover:text-blue-400 transition-all focus:outline-none rounded-full" 
                                                aria-label="Export Data"
                                                title="Export Data"
                                            >
                                                <Download className="h-5 w-5" />
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
                                                className="relative flex items-center justify-center h-9 w-9 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all focus:outline-none" 
                                                aria-label="Edit Item"
                                                title="Edit Item"
                                            >
                                                <Edit2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    )}
                                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-700"></div>
                                    <div className="relative">
                                        <button 
                                            onClick={props.onDairyDelete}
                                            className="relative flex items-center justify-center h-9 w-9 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all focus:outline-none" 
                                            aria-label="Delete Item"
                                            title="Delete Item"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PORTAL FOR VIEW-SPECIFIC ACTIONS */}
                            <div id="floating-header-actions-portal" className="flex items-center empty:hidden"></div>

                            {/* Settings View Specific Actions */}
                            {isSettingsView && isSecretDevOpen && (
                                <div className="relative">
                                    <button 
                                        onClick={() => {
                                            localStorage.removeItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join(''));
                                            setIsSecretDevOpen(false);
                                            window.location.reload();
                                        }}
                                        className="relative flex items-center justify-center h-8 px-3 text-red-600 dark:text-red-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all focus:outline-none rounded-full text-xs font-semibold" 
                                        title="Hide Dev Console"
                                    >
                                        Hide Dev
                                    </button>
                                </div>
                            )}

                            {/* Home View Specific Actions */}
                            {isHomeView && (
                                <div className="relative">
                                    <button 
                                        onClick={() => props.onNavigate('support')}
                                        className="relative flex items-center justify-center h-9 w-9 text-neutral-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all focus:outline-none rounded-full group" 
                                        aria-label="Support Center"
                                        title="Support Center"
                                    >
                                        <HeadphonesIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
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
                                                : 'text-emerald-600 dark:text-emerald-400 hover:bg-black/5 dark:hover:bg-white/10'
                                        }`}
                                        title="Save Settings"
                                    >
                                        {props.isSavingVoiceSettings ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                    </button>
                                </div>
                            )}

                            {(isHomeView || isExploreView || isNotesView || isFinanceView || isDairyView || isGalleryView || (isVoiceHistoryView && !props.expandedVoiceTitle) || isMoleculeView || isSupportView || isVoiceSettingsView) && (
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
                                        <LoaderCircle className="h-5 w-5 animate-spin" />
                                    ) : props.user ? (
                                        <img src={avatarUrl} alt="User avatar" className="h-8 w-8 rounded-full object-cover bg-neutral-200 dark:bg-gray-700" />
                                    ) : (
                                        <LogIn className="h-5 w-5" />
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

export default FloatingHeader;
