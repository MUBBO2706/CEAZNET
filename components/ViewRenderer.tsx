import React, { useRef, useState, useMemo } from 'react';
import { View, MoleculeData, VoiceName, NewsArticle, UserProfile, UserArticleInteraction, UIPreferences, Transaction, FinanceProfile, Note, VoicePersona } from '../types';
import TranslatorView from './Translator';
import MoleculeViewer from './MoleculeViewer';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import LiveConversationView from './LiveConversationView';
import ExploreView from './ExploreView';
import ArticleReaderView from './ArticleReaderView';
import SettingsView from './SettingsView';
import NotesView from './notes/NotesView';
import FinanceView from './finance/FinanceView';
import DairyView from './dairy/DairyView';
import GalleryView from './gallery/GalleryView';
import AboutView from './AboutView';
import FeaturesView from './FeaturesView';
import PrivacyPolicyView from './PrivacyPolicyView';
import TermsOfServiceView from './TermsOfServiceView';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import HomeView from './HomeView';
import ChemistryView from './ChemistryView';
import VoiceHistoryView from './VoiceHistoryView';
import VoiceSettingsView from './VoiceSettingsView';
import NotFoundView from './NotFoundView';
import { SupportView } from './SupportView';
import { motion, AnimatePresence } from 'motion/react';

interface ViewRendererProps {
    currentView: View;
    translatorUsage: { input: number, output: number };
    setCurrentView: (view: View) => void;
    // ... rest of props
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    onCloseTranslator: () => void;
    onTranslationComplete: (tokens: { input: number, output: number }) => void;
    moleculeForFullScreen: MoleculeData | null;
    onMaximizeMoleculeViewer: (molecule: MoleculeData) => void;
    voiceModeVoice: VoiceName;
    setVoiceModeVoice: (voice: VoiceName) => void;
    voiceModePersonaInstruction: string;
    setVoiceModePersonaInstruction: (instruction: string) => void;
    voiceModeToneInstruction: string;
    setVoiceModeToneInstruction: (instruction: string) => void;
    voiceModeCustomInstruction: string;
    setVoiceModeCustomInstruction: (instruction: string) => void;
    isVoiceProactiveMode: boolean;
    setIsVoiceProactiveMode: (isEnabled: boolean) => void;
    onSaveVoiceConversation: (transcript: any[], audioBlob?: Blob) => void;
    onBackFromLive: () => void;
    voiceContinuationContext: string;
    user: SupabaseUser | null;
    userProfile: UserProfile;
    onReadArticle: (article: NewsArticle) => void;
    articleForReading: NewsArticle | null;
    exploreCurrentIndex: number;
    setExploreCurrentIndex: (updater: (prev: number) => number) => void;
    exploreActiveCategory: string;
    setExploreActiveCategory: (category: string) => void;
    exploreArticles: NewsArticle[];
    exploreIsLoading: boolean;
    exploreError: string | null;
    interactions: Record<string, UserArticleInteraction>;
    handleInteraction: (articleUrl: string, type: 'like' | 'bookmark') => void;
    isBookmarkFeedOpen: boolean;
    setIsBookmarkFeedOpen: (isOpen: boolean) => void;
    bookmarkCount: number | null;
    setExploreArticles: React.Dispatch<React.SetStateAction<NewsArticle[]>>;
    uiPreferences: UIPreferences;
    onUpdatePreferences: (newPrefs: Partial<UIPreferences>) => void;
    currentTheme: 'light' | 'dark' | 'system';
    onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
    notesSearchQuery?: string;
    setNotesSearchQuery?: (q: string) => void;
    financeSearchQuery?: string;
    voiceHistorySearchQuery?: string;
    isVoiceConversationSaving: boolean;
    isAudioRecordingEnabled: boolean;
    setIsAudioRecordingEnabled: (enabled: boolean) => void;
    onArticleUpdate: (article: NewsArticle) => void;
    onEditProfile: () => void;
    previousView: View | null;
    onOpenSidebar: () => void;
    onLogout: () => void;
    onOpenAuthModal: () => void;
    setDairyHeaderState: (state: { 
        title: string | null; 
        onBack?: () => void; 
        onDelete?: () => void;
        onImport?: () => void;
        onExport?: () => void;
    }) => void;
    setNotesHeaderState: (state: {
        title: string | null;
        isReadOnly: boolean;
        isWalletLinked: boolean;
        isSyncing: boolean;
        onBack?: () => void;
        onEdit?: () => void;
        onSave?: () => void;
        onSync?: () => void;
        searchQuery: string;
        setSearchQuery?: (q: string) => void;
    }) => void;
    setGalleryHeaderState: (state: { onUpload?: () => void; isUploading?: boolean }) => void;
    setSupportHeaderState: (state: { title: string | null; onBack?: () => void }) => void;
    isSuspended?: boolean;
    voicePersonas: VoicePersona[];
    activeVoicePersona?: string | null;
    setActiveVoicePersona?: (persona: string | null) => void;
    onVoiceSettingChange?: (key: string, value: any) => Promise<void>;
    onVoiceSettingsChangeMulti?: (settings: Record<string, any>) => Promise<void>;
}

const PageTransition: React.FC<{ children: React.ReactNode, viewKey: string }> = ({ children, viewKey }) => {
    return (
        <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

const ViewRenderer: React.FC<ViewRendererProps> = ({
    currentView,
    translatorUsage,
    setCurrentView,
    scrollContainerRef,
    onCloseTranslator,
    onTranslationComplete,
    moleculeForFullScreen,
    onMaximizeMoleculeViewer,
    voiceModeVoice,
    setVoiceModeVoice,
    voiceModePersonaInstruction,
    setVoiceModePersonaInstruction,
    voiceModeToneInstruction,
    setVoiceModeToneInstruction,
    voiceModeCustomInstruction,
    setVoiceModeCustomInstruction,
    isVoiceProactiveMode,
    setIsVoiceProactiveMode,
    onSaveVoiceConversation,
    onBackFromLive,
    voiceContinuationContext,
    user,
    userProfile,
    onReadArticle,
    articleForReading,
    exploreCurrentIndex,
    setExploreCurrentIndex,
    exploreActiveCategory,
    setExploreActiveCategory,
    exploreArticles,
    exploreIsLoading,
    exploreError,
    interactions,
    handleInteraction,
    isBookmarkFeedOpen,
    setIsBookmarkFeedOpen,
    bookmarkCount,
    setExploreArticles,
    uiPreferences,
    onUpdatePreferences,
    currentTheme,
    onThemeChange,
    notesSearchQuery,
    setNotesSearchQuery,
    financeSearchQuery,
    voiceHistorySearchQuery,
    isVoiceConversationSaving,
    isAudioRecordingEnabled,
    setIsAudioRecordingEnabled,
    onArticleUpdate,
    onEditProfile,
    previousView,
    onOpenSidebar,
    onLogout,
    onOpenAuthModal,
    setDairyHeaderState,
    setNotesHeaderState,
    setGalleryHeaderState,
    setSupportHeaderState,
    isSuspended,
    voicePersonas,
    activeVoicePersona,
    setActiveVoicePersona,
    onVoiceSettingChange,
    onVoiceSettingsChangeMulti
}) => {

    const renderView = () => {
        switch (currentView) {
            case 'about':
                return <AboutView onNavigate={setCurrentView} />;
            case 'features':
                return <FeaturesView onNavigate={setCurrentView} />;
            case 'privacy-policy':
                return <PrivacyPolicyView onNavigate={setCurrentView} />;
            case 'terms-of-service':
                return <TermsOfServiceView onNavigate={setCurrentView} />;
            case 'support':
                return <SupportView setSupportHeaderState={setSupportHeaderState} userProfile={userProfile} />;
            case 'settings':
                return (
                    <SettingsView
                        onBack={() => setCurrentView('home')}
                        onNavigate={setCurrentView}
                        preferences={uiPreferences}
                        onUpdatePreferences={onUpdatePreferences}
                        currentTheme={currentTheme}
                        onThemeChange={onThemeChange}
                        userProfile={userProfile}
                        onEditProfile={onEditProfile}
                    />
                );
            case 'voice-settings':
                return (
                    <VoiceSettingsView
                        onBack={() => setCurrentView('live-conversation')}
                        selectedVoice={voiceModeVoice}
                        setSelectedVoice={setVoiceModeVoice}
                        voiceModeToneInstruction={voiceModeToneInstruction}
                        setVoiceModeToneInstruction={setVoiceModeToneInstruction}
                        customInstruction={voiceModeCustomInstruction}
                        setCustomInstruction={setVoiceModeCustomInstruction}
                        isProactiveModeEnabled={isVoiceProactiveMode}
                        setIsVoiceProactiveMode={setIsVoiceProactiveMode}
                        isAudioRecordingEnabled={isAudioRecordingEnabled}
                        setIsAudioRecordingEnabled={setIsAudioRecordingEnabled}
                    />
                );
            case 'notes':
                return (
                    <NotesView 
                        user={user} 
                        onBack={() => setCurrentView('home')}
                        searchQuery={notesSearchQuery || ''}
                        setSearchQuery={setNotesSearchQuery}
                        setNotesHeaderState={setNotesHeaderState}
                        isSuspended={isSuspended}
                    />
                );
            case 'finance':
                return (
                    <FinanceView
                        user={user}
                        onBack={() => setCurrentView('home')}
                        searchQuery={financeSearchQuery || ''}
                        isSuspended={isSuspended}
                    />
                );
            case 'dairy':
                return <DairyView setDairyHeaderState={setDairyHeaderState} isSuspended={isSuspended} />;
            case 'gallery':
                return <GalleryView user={user} userProfile={userProfile} setGalleryHeaderState={setGalleryHeaderState} isSuspended={isSuspended} />;
            case 'translator':
                return <TranslatorView onBack={onCloseTranslator} onTranslationComplete={onTranslationComplete} />;
            case 'molecule-viewer':
                return <ChemistryView customMolecule={moleculeForFullScreen} user={user} />;
            case 'live-conversation':
                return <LiveConversationView
                            onBack={onBackFromLive}
                            selectedVoice={voiceModeVoice}
                            setSelectedVoice={setVoiceModeVoice}
                            personaInstruction={voiceModePersonaInstruction}
                            setPersonaInstruction={setVoiceModePersonaInstruction}
                            voiceModeToneInstruction={voiceModeToneInstruction}
                            setVoiceModeToneInstruction={setVoiceModeToneInstruction}
                            customInstruction={voiceModeCustomInstruction}
                            setCustomInstruction={setVoiceModeCustomInstruction}
                            isVoiceProactiveMode={isVoiceProactiveMode}
                            setIsVoiceProactiveMode={setIsVoiceProactiveMode}
                            onSaveVoiceConversation={onSaveVoiceConversation}
                            continuationContext={voiceContinuationContext}
                            onViewHistory={() => setCurrentView('voice-history')}
                            onOpenSettings={() => setCurrentView('voice-settings')}
                            isSaving={isVoiceConversationSaving}
                            isAudioRecordingEnabled={isAudioRecordingEnabled}
                            setIsAudioRecordingEnabled={setIsAudioRecordingEnabled}
                            voicePersonas={voicePersonas}
                            activeVoicePersona={activeVoicePersona}
                            setActiveVoicePersona={setActiveVoicePersona}
                            onVoiceSettingChange={onVoiceSettingChange}
                            onVoiceSettingsChangeMulti={onVoiceSettingsChangeMulti}
                        />;
            case 'voice-history':
                return <VoiceHistoryView 
                            onBack={() => setCurrentView('live-conversation')} 
                            user={user} 
                            userProfile={userProfile} 
                            isSaving={isVoiceConversationSaving}
                            showBackButton={previousView === 'live-conversation'}
                            onOpenSidebar={onOpenSidebar}
                            searchQuery={voiceHistorySearchQuery || ''}
                            onNavigate={setCurrentView}
                            onLogout={onLogout}
                            onOpenAuthModal={onOpenAuthModal}
                            onOpenProfileModal={onEditProfile}
                            isSuspended={isSuspended}
                        />;
            case 'explore':
                return <ExploreView 
                            onBack={() => setCurrentView('home')} 
                            user={user} 
                            onReadArticle={onReadArticle}
                            currentIndex={exploreCurrentIndex}
                            setCurrentIndex={setExploreCurrentIndex}
                            activeCategory={exploreActiveCategory}
                            setActiveCategory={setExploreActiveCategory}
                            articles={exploreArticles}
                            setArticles={setExploreArticles}
                            isLoading={exploreIsLoading}
                            error={exploreError}
                            interactions={interactions}
                            handleInteraction={handleInteraction}
                            isBookmarkFeedOpen={isBookmarkFeedOpen}
                            setIsBookmarkFeedOpen={setIsBookmarkFeedOpen}
                            bookmarkCount={bookmarkCount}
                        />;
            case 'article-reader':
                return articleForReading ? (
                    <ArticleReaderView
                        article={articleForReading}
                        onBack={() => setCurrentView('explore')}
                        user={user}
                        interactions={interactions}
                        handleInteraction={handleInteraction}
                        allArticles={exploreArticles}
                        onReadArticle={onReadArticle}
                        onArticleUpdate={onArticleUpdate}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 h-full bg-white dark:bg-[#09090b]">
                       <LoaderCircle className="w-8 h-8 text-[#0066FF] animate-spin mb-4" />
                       <p className="text-[#878787] dark:text-[#a1a1aa]">Loading article...</p>
                    </div>
                );
            case 'not-found':
                return <NotFoundView onNavigate={setCurrentView} />;
            case 'home':
            default:
                return <HomeView onNavigate={setCurrentView} user={user} userProfile={userProfile} exploreArticles={exploreArticles} />;
        }
    };

    return (
        <AnimatePresence mode="wait">
            <PageTransition viewKey={currentView}>
                {renderView()}
            </PageTransition>
        </AnimatePresence>
    );
};

export default ViewRenderer;
