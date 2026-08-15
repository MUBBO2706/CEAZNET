import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { View, NewsArticle, Note, Transaction, Conversation, UserProfile, MoleculeData } from '../types';
import { BookOpen, FileText, Wallet, Calendar, Languages, FlaskConical, Mic, Settings, ArrowRight, TrendingUp, TrendingDown, MessageSquare, Clock, Plus, ArrowUpRight, AlertCircle, CheckCircle2, ScrollText, Palette, Volume2, Cpu, ShieldCheck, Database, Layers, Zap, ChevronRight, Sparkles, Sliders, LayoutGrid } from 'lucide-react';
import { getNotes, getRecentNotes, getFinanceSummary, getTransactions, getRecentConversation, getDairySummary, getDairyEntries, getDairyPayments, getTranslatorUsage, getLastMolecule, getSetting } from '../services/dbService';
import { getMoleculeSummary } from '../services/chemistryService';
import type { User } from '@supabase/supabase-js';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MoleculeViewer from './MoleculeViewer';
import metadata from '../metadata.json';

// Static configuration for the preview viewer to prevent re-renders
const PREVIEW_MOLECULE_STATE = {
    showElectrons: false,
    showElectronCloud: false,
    style: 'ballAndStick' as const,
    showHydrogens: false,
    showLabels: true,
    autoRotate: false // Disabled to prevent continuous WebGL rendering and scrolling lag
};

const getPreviewContent = (content: string) => {
    if (!content) return '';
    let text = content;
    // 1. Remove Finance Widgets entirely
    text = text.replace(/<!-- FINANCE_WIDGET_START -->[\s\S]*?<!-- FINANCE_WIDGET_END -->/g, '');
    // 2. Remove any other HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    // 3. Strip remaining HTML tags
    text = text.replace(/<[^>]*>?/gm, '');
    // 4. Clean up multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
};

interface HomeViewProps {
    onNavigate: (view: View) => void;
    user: User | null;
    userProfile?: UserProfile;
    exploreArticles: NewsArticle[];
}

const apps = [
    { id: 'explore', title: 'Explore News', description: 'Read the latest curated news and articles', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800/30', bannerImg: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=1000&auto=format&fit=crop' },
    { id: 'notes', title: 'Notes', description: 'Capture your thoughts, ideas, and tasks', icon: FileText, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/30', bannerImg: 'https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=1000&auto=format&fit=crop' },
    { id: 'finance', title: 'Finance', description: 'Track your expenses and manage budget', icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/30', bannerImg: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=1000&auto=format&fit=crop' },
    { id: 'dairy', title: 'Daily Khata', description: 'Manage your daily accounts and ledgers', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-800/30', bannerImg: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=1000&auto=format&fit=crop' },
    { id: 'translator', title: 'Translator', description: 'Translate text seamlessly across languages', icon: Languages, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/30', bannerImg: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=1000&auto=format&fit=crop' },
    { id: 'molecule-viewer', title: 'Chemistry Lab', description: 'Explore 3D molecular structures', icon: FlaskConical, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/30', bannerImg: 'https://images.unsplash.com/photo-1603126859738-11119566675e?q=80&w=1000&auto=format&fit=crop' },
    { id: 'settings', title: 'Preferences', description: 'Customize your experience', icon: Settings, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/20', border: 'border-slate-100 dark:border-slate-800/30', bannerImg: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop' },
];

const getCardPositionState = (idx: number, centerIdx: number, total: number) => {
    if (idx === centerIdx) return 'center';
    if (idx === (centerIdx - 1 + total) % total) return 'left';
    if (idx === (centerIdx + 1) % total) return 'right';
    if (idx === (centerIdx - 2 + total) % total) return 'far-left';
    if (idx === (centerIdx + 2) % total) return 'far-right';
    return 'hidden';
};

const HomeView: React.FC<HomeViewProps> = ({ onNavigate, user, userProfile, exploreArticles }) => {
    const [tick, setTick] = useState(0);
    const [recentNotes, setRecentNotes] = useState<Note[]>([]);
    const [financeSummary, setFinanceSummary] = useState<{ balance: number, income: number, expense: number, count?: number, lastTransaction: Transaction | null } | null>(null);
    const [recentConversation, setRecentConversation] = useState<Conversation | null>(null);
    const [dairySummary, setDairySummary] = useState<{ due: number, paid: number } | null>(null);
    const [translatorStats, setTranslatorStats] = useState<{ input: number, output: number } | null>(null);
    const [lastMolecule, setLastMolecule] = useState<string | null>(null);
    const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
    const [settingsSummary, setSettingsSummary] = useState<{ theme: string, voice: string, font: string, density: string, radius: string, authStatus: string } | null>(null);

    // Single interval for all rotations to reduce re-renders and improve scroll performance
    useEffect(() => {
        const interval = setInterval(() => {
            setTick((prev) => prev + 1);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    // Derived indices
    const currentAdIndex = tick % apps.length;
    const exploreArticleIndex = exploreArticles.length > 0 ? tick % exploreArticles.length : 0;
    const currentNoteIndex = recentNotes.length > 0 ? tick % recentNotes.length : 0;
    const currentFinanceIndex = tick % 3;
    const currentDairyIndex = tick % 3;

    // Fetch User Data
    useEffect(() => {
        const fetchData = async () => {
            if (user) {
                // Notes
                try {
                    const notes = await getRecentNotes(user, 3);
                    setRecentNotes(notes);
                } catch (e) { console.error("Failed to fetch notes", e); }

                // Finance
                try {
                    const summary = await getFinanceSummary(user);
                    setFinanceSummary(summary);
                } catch (e) { console.error("Failed to fetch finance", e); }

                // Conversations
                try {
                    const recent = await getRecentConversation(user);
                    setRecentConversation(recent);
                } catch (e) { console.error("Failed to fetch conversations", e); }

                // Dairy
                try {
                    const summary = await getDairySummary(user);
                    setDairySummary(summary);
                } catch (e) { console.error("Failed to fetch dairy", e); }

                // Translator
                try {
                    const usage = await getTranslatorUsage(user);
                    setTranslatorStats(usage);
                } catch (e) { console.error("Failed to fetch translator usage", e); }

                // Molecule
                try {
                    const mol = await getLastMolecule(user);
                    const moleculeToFetch = mol ? mol.name : 'Caffeine';
                    setLastMolecule(moleculeToFetch);
                    
                    getMoleculeSummary(moleculeToFetch).then(data => {
                        setMoleculeData(data as MoleculeData);
                    }).catch(err => {
                        console.error("Failed to fetch molecule data for home view", err);
                        setMoleculeData(null);
                    });
                } catch (e) { console.error("Failed to fetch molecule", e); }

                // Settings
                try {
                    const theme = await getSetting('theme', user) || 'system';
                    const voice = await getSetting('voice_mode_voice', user) || 'Elara';
                    const localPrefsStr = localStorage.getItem('ceaznet_ui_preferences');
                    let font = 'Geist Sans';
                    let density = 'Comfortable';
                    let radius = 'Round (16px)';
                    if (localPrefsStr) {
                        try {
                            const p = JSON.parse(localPrefsStr);
                            if (p.fontFamily) font = p.fontFamily;
                            if (p.layoutDensity) density = p.layoutDensity;
                            if (p.borderRadius) radius = p.borderRadius;
                        } catch (e) {}
                    }
                    setSettingsSummary({ 
                        theme: theme as string, 
                        voice: voice as string,
                        font: font,
                        density: density,
                        radius: radius,
                        authStatus: 'Active & Synced'
                    });
                } catch (e) { console.error("Failed to fetch settings", e); }

            } else {
                setRecentNotes([]);
                setFinanceSummary(null);
                setRecentConversation(null);
                setDairySummary(null);
                setTranslatorStats(null);
                setLastMolecule(null);
                setMoleculeData(null);
                setSettingsSummary(null);
            }
        };
        fetchData();
    }, [user?.id]);

    const activeApp = apps[currentAdIndex];

    const renderCardContent = (app: typeof apps[0]) => {
        // --- LOGGED IN USER CONTENT ---
        if (user) {
            if (app.id === 'explore' && exploreArticles.length > 0) {
                const article = exploreArticles[exploreArticleIndex];
                return (
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={exploreArticleIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="relative h-full w-full group/news overflow-hidden"
                        >
                            {/* Full Background Image */}
                            <div className="absolute inset-0 bg-neutral-900">
                                {article.image ? (
                                    <img 
                                        src={article.image} 
                                        alt="" 
                                        className="w-full h-full object-cover transition-transform duration-1000 group-hover/news:scale-110 opacity-90" 
                                        referrerPolicy="no-referrer" 
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                                        <BookOpen className="w-12 h-12 text-neutral-600" />
                                    </div>
                                )}
                                {/* Gradient Overlay for Text Readability - Stronger at bottom */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                            </div>
                            
                            {/* Content Overlay - Bottom Aligned */}
                            <div className="absolute inset-0 p-5 flex flex-col justify-end z-10">
                                <div className="transform transition-transform duration-500 group-hover/news:-translate-y-1">
                                    <h4 className="font-bold text-white leading-tight text-lg mb-3 line-clamp-3 drop-shadow-lg">
                                        {article.title}
                                    </h4>
                                    
                                    <div className="flex items-center flex-wrap gap-3">
                                        {/* Trending Badge - Moved Bottom */}
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                            <TrendingUp className="w-3 h-3" />
                                            <span>Trending</span>
                                        </div>

                                        {/* Source */}
                                        <div className="flex items-center gap-2 text-xs font-medium text-gray-200">
                                            <span className="truncate max-w-[100px] drop-shadow-md">
                                                {article.source.name}
                                            </span>
                                        </div>
                                        
                                        {/* Date */}
                                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider ml-auto">
                                            {new Date(article.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                );
            }

            if (app.id === 'notes' && recentNotes.length > 0) {
                const currentNote = recentNotes[currentNoteIndex];
                // Strip HTML tags and markdown for preview
                const plainContent = (currentNote.content || '')
                    .replace(/<!--[\s\S]*?\-\->/g, '') // Remove HTML comments
                    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
                    .replace(/[#*`_~\[\]()]/g, '') // Remove basic markdown
                    .trim();
                
                return (
                    <div className="flex flex-col h-full relative overflow-hidden group/note">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3 relative z-10 shrink-0">
                            <div className={`p-2 rounded-xl ${app.bg} ${app.color}`}>
                                <app.icon className="w-5 h-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Pagination Dots */}
                                <div className="flex gap-1">
                                    {recentNotes.map((_, idx) => (
                                        <div 
                                            key={idx}
                                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentNoteIndex ? 'bg-amber-500 w-3' : 'bg-neutral-200 dark:bg-neutral-700'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* Note Card Container */}
                        <div className="flex-1 relative z-10 min-h-0 perspective-1000">
                             {/* Stack Effect - Background Card */}
                            <div className="absolute top-2 left-2 right-2 bottom-0 bg-amber-100/50 dark:bg-amber-900/20 rounded-xl border border-amber-100/50 dark:border-white/5 rotate-2 transform origin-bottom-right transition-transform duration-500 group-hover/note:rotate-3" />
                            
                            {/* Main Card */}
                            <AnimatePresence mode="wait">
                                <motion.div 
                                    key={currentNoteIndex}
                                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                    transition={{ duration: 0.4 }}
                                    className="absolute inset-0 bg-amber-50 dark:bg-neutral-900 rounded-xl border border-amber-100 dark:border-neutral-800 shadow-sm flex flex-col"
                                >
                                    {/* Decorative Tape or Pin */}
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-4 bg-amber-200/80 dark:bg-amber-900/50 backdrop-blur-sm rotate-[-2deg] shadow-sm z-20" />

                                    <div className="p-5 flex flex-col h-full">
                                        <h4 className="font-bold text-neutral-800 dark:text-white line-clamp-1 mb-3 text-lg font-serif">
                                            {currentNote.title || 'Untitled Note'}
                                        </h4>
                                        
                                        <div className="flex-1 overflow-hidden relative">
                                            <div className="text-sm text-neutral-600 dark:text-neutral-300 font-mono leading-relaxed line-clamp-5 whitespace-pre-wrap">
                                                {currentNote.content ? plainContent : 'No content'}
                                            </div>
                                            {/* Fade out at bottom */}
                                            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-amber-50 dark:from-neutral-900 to-transparent" />
                                        </div>

                                        <div className="mt-auto pt-3 border-t border-amber-100 dark:border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400 uppercase tracking-wider font-bold">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(currentNote.updatedAt).toLocaleDateString()}
                                            </span>
                                            <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover/note:scale-110 transition-transform">
                                                <ArrowRight className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                );
            }

            if (app.id === 'finance' && financeSummary) {
                return (
                    <div className="flex flex-col h-full relative overflow-hidden group/finance">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 relative z-10 shrink-0">
                            <div className={`p-2.5 rounded-2xl ${app.bg} ${app.color} shadow-sm`}>
                                <app.icon className="w-5 h-5" />
                            </div>
                            <div className="flex gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-full">
                                {[0, 1, 2].map((idx) => (
                                    <div 
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentFinanceIndex ? 'w-4 bg-emerald-500' : 'w-1.5 bg-neutral-300 dark:bg-neutral-600'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Dynamic Content */}
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={currentFinanceIndex}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3 }}
                                className="flex-1 flex flex-col justify-between relative z-10"
                            >
                                
                                {/* View 0: Total Balance */}
                            {currentFinanceIndex === 0 && (
                                <div className="flex flex-col h-full justify-center">
                                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Total Balance</div>
                                    <div className={`text-4xl font-bold tracking-tight mb-4 ${financeSummary.balance >= 0 ? 'text-neutral-900 dark:text-white' : 'text-red-500'}`}>
                                        ₹{Math.abs(financeSummary.balance).toLocaleString()}
                                    </div>
                                    
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/20">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${financeSummary.income > financeSummary.expense ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-600'}`}>
                                            <TrendingUp className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold">Monthly Status</div>
                                            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                                {financeSummary.income > financeSummary.expense ? 'Positive Cash Flow' : 'High Expenses'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* View 1: Cash Flow */}
                            {currentFinanceIndex === 1 && (
                                <div className="flex flex-col h-full justify-center gap-5">
                                    {/* Income */}
                                    <div>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Income</span>
                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+₹{financeSummary.income.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: '100%' }} />
                                        </div>
                                    </div>
                                    
                                    {/* Expense */}
                                    <div>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Expense</span>
                                            <span className="text-sm font-bold text-rose-500">-₹{financeSummary.expense.toLocaleString()}</span>
                                        </div>
                                        <div className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
                                            <div 
                                                className="bg-rose-500 h-full rounded-full" 
                                                style={{ width: `${Math.min(100, (financeSummary.expense / (financeSummary.income || 1)) * 100)}%` }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* View 2: Last Transaction */}
                            {currentFinanceIndex === 2 && (
                                <div className="flex flex-col h-full justify-center items-center">
                                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 text-center">Last Activity</div>
                                    
                                    {financeSummary.lastTransaction ? (
                                        <div className="flex flex-col items-center text-center w-full">
                                            <div className={`w-10 h-10 rounded-xl mb-2 flex items-center justify-center shadow-sm ${financeSummary.lastTransaction.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                                                {financeSummary.lastTransaction.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            </div>
                                            <div className="font-bold text-neutral-900 dark:text-white text-sm line-clamp-1 w-full px-2 mb-0.5">
                                                {financeSummary.lastTransaction.description || 'Transaction'}
                                            </div>
                                            <div className={`font-bold text-lg ${financeSummary.lastTransaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {financeSummary.lastTransaction.type === 'income' ? '+' : '-'}₹{financeSummary.lastTransaction.amount.toLocaleString()}
                                            </div>
                                            <div className="mt-1 text-[10px] text-neutral-400 font-bold bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                                                {new Date(financeSummary.lastTransaction.transaction_date).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center text-neutral-400 text-xs">No recent activity</div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                        </AnimatePresence>
                    </div>
                );
            }

            if (app.id === 'live-conversation') {
                return (
                    <div className="flex flex-col h-full justify-between animate-fade-in relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-3 relative z-10">
                            <div className={`p-2 rounded-xl ${app.bg} ${app.color}`}>
                                <app.icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-500">Voice Chat</span>
                        </div>
                        
                        {/* Audio Visualizer Background Effect */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 dark:opacity-10">
                            <div className="flex items-center gap-1">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="w-2 bg-rose-500 rounded-full animate-pulse" style={{ height: `${[15, 35, 20, 50, 25, 45, 10, 30][i]}px`, animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                        </div>

                        {recentConversation ? (
                            <div className="flex-1 flex flex-col justify-center relative z-10">
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">Recent Session</div>
                                <div className="font-bold text-neutral-800 dark:text-white line-clamp-2 text-lg leading-tight">
                                    "{recentConversation.title}"
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(recentConversation.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center relative z-10">
                                <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-2 animate-pulse ring-4 ring-rose-500/10">
                                    <Mic className="w-6 h-6 text-rose-500" />
                                </div>
                                <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">Start Conversation</span>
                            </div>
                        )}
                    </div>
                );
            }

            if (app.id === 'dairy' && dairySummary) {
                const totalAmount = dairySummary.paid + dairySummary.due;
                const progress = totalAmount > 0 ? (dairySummary.paid / totalAmount) * 100 : 0;

                return (
                    <div className="flex flex-col h-full relative overflow-hidden group/dairy">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 relative z-10 shrink-0">
                            <div className={`p-2.5 rounded-2xl ${app.bg} ${app.color} shadow-sm`}>
                                <app.icon className="w-5 h-5" />
                            </div>
                            <div className="flex gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-full">
                                {[0, 1, 2].map((idx) => (
                                    <div 
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentDairyIndex ? 'w-4 bg-purple-500' : 'w-1.5 bg-neutral-300 dark:bg-neutral-600'}`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Dynamic Content */}
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={currentDairyIndex}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.3 }}
                                className="flex-1 flex flex-col justify-between relative z-10"
                            >
                                
                                {/* View 0: Due Amount */}
                            {currentDairyIndex === 0 && (
                                <div className="flex flex-col h-full justify-center">
                                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Total Due</div>
                                    <div className="text-4xl font-bold tracking-tight text-red-500 mb-4">
                                        ₹{dairySummary.due.toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20">
                                        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400">
                                            <AlertCircle className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold">Status</div>
                                            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                                {dairySummary.due > 0 ? 'Payment Pending' : 'All Clear'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* View 1: Paid Amount */}
                            {currentDairyIndex === 1 && (
                                <div className="flex flex-col h-full justify-center">
                                    <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Total Paid</div>
                                    <div className="text-4xl font-bold tracking-tight text-purple-600 dark:text-purple-400 mb-4">
                                        ₹{dairySummary.paid.toLocaleString()}
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/20">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-bold">Contribution</div>
                                            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                                {Math.round(progress)}% of Total Bill
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* View 2: Circular Progress */}
                            {currentDairyIndex === 2 && (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <div className="relative w-24 h-24 flex items-center justify-center mb-1">
                                        {/* Background Circle */}
                                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r="56"
                                                stroke="currentColor"
                                                strokeWidth="10"
                                                fill="transparent"
                                                className="text-neutral-100 dark:text-neutral-800"
                                            />
                                            {/* Progress Circle */}
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r="56"
                                                stroke="currentColor"
                                                strokeWidth="10"
                                                fill="transparent"
                                                strokeDasharray={351.86}
                                                strokeDashoffset={351.86 - (351.86 * progress) / 100}
                                                className="text-purple-500 transition-all duration-1000 ease-out"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-2xl font-bold text-neutral-900 dark:text-white">{Math.round(progress)}%</span>
                                            <span className="text-[10px] text-neutral-400 uppercase font-bold">Paid</span>
                                        </div>
                                    </div>
                                    <div className="text-xs font-medium text-neutral-400 mt-2">
                                        Total Bill: <span className="text-neutral-900 dark:text-white font-bold">₹{totalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                        </AnimatePresence>
                    </div>
                );
            }

            if (app.id === 'translator' && translatorStats) {
                return (
                    <div className="flex flex-col h-full justify-between animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`p-2 rounded-xl ${app.bg} ${app.color}`}>
                                <app.icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Translator</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex items-end gap-1 mb-1">
                                <span className="text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
                                    {(translatorStats.input + translatorStats.output).toLocaleString()}
                                </span>
                                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1.5">chars</span>
                            </div>
                            <div className="w-full bg-neutral-100 dark:bg-white/10 rounded-full h-1.5 mb-4 overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full w-3/4 animate-pulse" />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                                    <p className="text-[10px] uppercase font-bold text-indigo-400">Input</p>
                                    <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{translatorStats.input.toLocaleString()}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
                                    <p className="text-[10px] uppercase font-bold text-purple-400">Output</p>
                                    <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{translatorStats.output.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            if (app.id === 'molecule-viewer' && lastMolecule) {
                return (
                    <div className="flex flex-col h-full relative overflow-hidden group/chem bg-[#0a0a0a] rounded-3xl p-[1px] isolation-auto">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-blue-500/20 opacity-0 group-hover/chem:opacity-100 transition-opacity duration-700" />
                        
                        <div className="relative z-10 flex-1 bg-neutral-950/90 dark:bg-black/90 backdrop-blur-xl rounded-[23px] overflow-hidden flex flex-col h-full">
                            {/* Grid background */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_0%,#000_20%,transparent_100%)] pointer-events-none" />
                            
                            <div className="p-4 flex flex-col h-full relative z-20">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                                            <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
                                        </div>
                                        <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-cyan-400/80">ChemLab</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                                    </div>
                                </div>
                                
                                {/* Hexagon visualizer */}
                                <div className="absolute right-[-10px] bottom-10 opacity-20 group-hover/chem:opacity-40 transition-opacity duration-500 pointer-events-none group-hover/chem:scale-110 origin-bottom-right">
                                    <svg viewBox="0 0 100 100" className="w-24 h-24 text-cyan-500" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <path d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z" className="animate-[spin_20s_linear_infinite_reverse] origin-[50px_50px]" strokeDasharray="5 5"/>
                                        <circle cx="50" cy="50" r="20" className="animate-[pulse_4s_ease-in-out_infinite]" />
                                        <path d="M50 30 L65 50 L50 70 L35 50 Z" />
                                    </svg>
                                </div>
                                
                                <div className="mt-auto flex flex-col justify-end">
                                    <div className="inline-flex items-center gap-1.5 text-[9px] text-zinc-500 font-mono uppercase mb-1">
                                        <span className="w-2 h-[1px] bg-zinc-500" />
                                        Target Substance
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight line-clamp-1 group-hover/chem:text-cyan-300 transition-colors">
                                        {lastMolecule}
                                    </h2>
                                    
                                    {moleculeData ? (
                                        <div className="mt-3 flex gap-4 border-t border-white/10 pt-3">
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-[8px] sm:text-[9px] text-zinc-500 font-mono uppercase tracking-wider mb-0.5 truncate">Formula</span>
                                                <span className="text-xs font-mono font-medium text-cyan-100 truncate">{moleculeData.molecularFormula || 'UNKNOWN'}</span>
                                            </div>
                                            <div className="w-[1px] bg-white/10 shrink-0" />
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-[8px] sm:text-[9px] text-zinc-500 font-mono uppercase tracking-wider mb-0.5 truncate">Weight</span>
                                                <span className="text-xs font-mono font-medium text-blue-200 truncate">{moleculeData.molecularWeight ? moleculeData.molecularWeight.toString().split('.')[0] + ' g/mol' : 'UNKNOWN'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between opacity-50">
                                            <span className="text-[9px] text-zinc-400 font-mono uppercase">Scanning...</span>
                                            <Cpu className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            if (app.id === 'settings' && settingsSummary) {
                return (
                    <div className="flex flex-col h-full justify-between animate-fade-in relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`p-2 rounded-xl ${app.bg} ${app.color}`}>
                                <app.icon className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Preferences</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col justify-center gap-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/10">
                                <div className="flex items-center gap-2">
                                    <Palette className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Theme</span>
                                </div>
                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 capitalize">{settingsSummary.theme}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/10">
                                <div className="flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Voice</span>
                                </div>
                                <span className="text-xs font-mono text-slate-600 dark:text-slate-400 capitalize">{settingsSummary.voice}</span>
                            </div>
                        </div>
                    </div>
                );
            }
        }

            // The second block for molecule-viewer (when !lastMolecule) is now redundant because the new logic handles both cases.
            // I will remove it.


        // --- DEFAULT / ANONYMOUS CONTENT (ENHANCED) ---
        return (
            <div className="flex flex-col h-full justify-between relative z-10">
                {/* Visual Enhancements based on App Type */}
                {app.id === 'translator' && (
                    <div className="absolute top-4 right-4 opacity-10 dark:opacity-20 pointer-events-none">
                        <div className="flex gap-2 text-4xl font-serif">
                            <span className="translate-y-2">A</span>
                            <span className="-translate-y-2">文</span>
                        </div>
                    </div>
                )}
                
                {app.id === 'dairy' && (
                    <div className="absolute top-4 right-4 opacity-10 dark:opacity-20 pointer-events-none">
                        <div className="grid grid-cols-3 gap-1">
                            {[...Array(9)].map((_, i) => (
                                <div key={i} className="w-2 h-2 rounded-sm bg-current" />
                            ))}
                        </div>
                    </div>
                )}

                {app.id === 'molecule-viewer' && (
                    <div className="absolute top-2 right-2 opacity-10 dark:opacity-20 pointer-events-none">
                        <FlaskConical className="w-16 h-16 rotate-12" />
                    </div>
                )}

                {app.id === 'settings' && (
                    <div className="absolute -top-2 -right-2 opacity-5 dark:opacity-10 pointer-events-none">
                        <Settings className="w-24 h-24 animate-spin-slow" />
                    </div>
                )}

                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${app.bg} ${app.border} border transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg shadow-sm relative z-10`}>
                    <app.icon className={`w-7 h-7 ${app.color} transition-transform duration-500 group-hover:scale-110`} />
                </div>
                
                <div className="mt-auto relative z-10">
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center justify-between">
                        {app.title}
                        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-amber-500" />
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium line-clamp-2 leading-relaxed group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
                        {app.description}
                    </p>
                </div>
            </div>
        );
    };

    const renderHeroSlide = (app: typeof apps[0]) => {
        // Common Header for Hero Slides with consistent styling and alignment
        const HeroHeader = ({ title, icon: Icon, color, subtitle }: { title: string, icon: any, color: string, subtitle?: string }) => (
            <div className="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-3 md:mb-5 relative z-10 shrink-0">
                <div className="p-1.5 sm:p-2 md:p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 shadow-md">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
                </div>
                <div className="min-w-0">
                    <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white tracking-tight leading-tight drop-shadow-md truncate">
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-[9px] sm:text-[10px] md:text-xs text-white/60 uppercase tracking-widest font-mono mt-0.5 truncate">{subtitle}</p>
                    )}
                </div>
            </div>
        );

        if (user) {
            // --- FINANCE HERO ---
            if (app.id === 'finance' && financeSummary) {
                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-950 to-black p-4 sm:p-5 md:p-8 flex flex-col justify-between overflow-hidden">
                        {/* Background Decorative Icon */}
                        <div className="absolute -right-10 -bottom-10 opacity-10 transform rotate-12 pointer-events-none">
                            <Wallet className="w-36 h-36 md:w-64 md:h-64 text-emerald-500" />
                        </div>
                        
                        <div className="relative z-10 w-full h-full flex flex-col justify-between">
                            <HeroHeader title="Financial Overview" icon={Wallet} color="text-emerald-400" subtitle="Track Income & Expenses" />
                            
                            <div className="flex flex-col gap-2 my-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                                    <div className="sm:col-span-6">
                                        <p className="text-emerald-200/50 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5">Total Balance</p>
                                        <p className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight truncate">₹{financeSummary.balance.toLocaleString()}</p>
                                    </div>
                                    <div className="sm:col-span-6 grid grid-cols-2 gap-1.5 sm:gap-2">
                                        <div className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/5">
                                            <p className="text-emerald-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Income</p>
                                            <p className="text-xs sm:text-sm font-bold text-emerald-400 truncate">+₹{financeSummary.income.toLocaleString()}</p>
                                        </div>
                                        <div className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/5">
                                            <p className="text-rose-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Expense</p>
                                            <p className="text-xs sm:text-sm font-bold text-rose-400 truncate">-₹{financeSummary.expense.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {financeSummary.lastTransaction ? (
                                <div className="mt-auto pt-2 sm:pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 max-w-full">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`p-1.5 rounded-full shrink-0 ${financeSummary.lastTransaction.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {financeSummary.lastTransaction.type === 'income' ? <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-white/40 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">Latest Activity</span>
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                <span className="text-white/95 font-semibold text-[11px] sm:text-xs truncate">{financeSummary.lastTransaction.description || 'Transaction'}</span>
                                                <span className={`text-[11px] sm:text-xs font-bold shrink-0 ${financeSummary.lastTransaction.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {financeSummary.lastTransaction.type === 'income' ? '+' : '-'}₹{financeSummary.lastTransaction.amount}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {financeSummary.lastTransaction.payment_method && (
                                            <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[9px] sm:text-[10px] font-mono capitalize">
                                                {financeSummary.lastTransaction.payment_method}
                                            </span>
                                        )}
                                        {typeof financeSummary.count === 'number' && (
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] sm:text-[10px] font-bold">
                                                {financeSummary.count} entries
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-auto pt-2 sm:pt-2.5 border-t border-white/10 flex items-center justify-between text-[9px] sm:text-[10px] text-emerald-200/60 font-mono">
                                    <span>All Accounts Active</span>
                                    <span>{financeSummary.count || 0} Total Records</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            // --- NOTES HERO ---
            if (app.id === 'notes' && recentNotes.length > 0) {
                const note = recentNotes[currentNoteIndex];
                const plainContent = (note.content || '').replace(/<[^>]*>?/gm, '');
                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-amber-950 to-black p-4 sm:p-5 md:p-8 flex flex-col justify-between overflow-hidden">
                        <div className="absolute -right-10 -top-10 opacity-10 transform -rotate-12 pointer-events-none">
                            <FileText className="w-36 h-36 md:w-64 md:h-64 text-amber-500" />
                        </div>
                        <div className="relative z-10 w-full h-full flex flex-col justify-between">
                            <HeroHeader title="Quick Notes" icon={FileText} color="text-amber-400" subtitle="Capture Ideas & Thoughts" />
                            
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-4.5 shadow-xl relative group my-auto flex flex-col justify-between min-h-[90px] sm:min-h-[110px]">
                                <div className="absolute -top-2.5 left-6 w-10 h-3 bg-amber-500/30 rotate-[-2deg]" />
                                <div>
                                    <h3 className="text-sm sm:text-base md:text-lg font-bold text-white mb-1 font-serif leading-tight truncate">{note.title || 'Untitled Note'}</h3>
                                    <p className="text-xs md:text-sm text-amber-100/80 line-clamp-3 sm:line-clamp-4 md:line-clamp-4 font-mono leading-relaxed">
                                        {plainContent || 'No content'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-auto pt-2 sm:pt-3 border-t border-white/5 flex items-center justify-between text-[8px] sm:text-[9px] text-amber-200/40 uppercase tracking-wider font-bold">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                    Updated {new Date(note.updatedAt).toLocaleDateString()}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-300/70 font-mono">{recentNotes.length} Notes</span>
                                    <div className="flex gap-1">
                                        {recentNotes.map((_, idx) => (
                                            <div key={idx} className={`h-1 rounded-full transition-all ${idx === currentNoteIndex ? 'bg-amber-400 w-3' : 'bg-white/20 w-1'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- DAIRY HERO ---
            if (app.id === 'dairy' && dairySummary) {
                const progress = dairySummary.due > 0 ? (dairySummary.paid / (dairySummary.paid + dairySummary.due)) * 100 : 100;
                const totalAmount = dairySummary.paid + dairySummary.due;

                return (
                    <div className="absolute inset-0 bg-neutral-900 p-4 sm:p-5 md:p-8 flex flex-col justify-between overflow-hidden">
                        <div className="absolute inset-0 opacity-5 pointer-events-none" 
                             style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                        </div>
                        
                        <div className="relative z-10 w-full h-full flex flex-col justify-between">
                            <HeroHeader title="Daily Ledger" icon={ScrollText} color="text-purple-400" subtitle="Due & Settled Khatas" />

                            <div className="grid grid-cols-2 gap-2 sm:gap-3 my-auto">
                                <div className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden group">
                                    <p className="text-neutral-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5">Outstanding Due</p>
                                    <p className="text-sm sm:text-base md:text-lg font-mono font-bold text-red-400 tracking-tight truncate">₹{dairySummary.due.toLocaleString()}</p>
                                    <div className="mt-1 flex items-center gap-1 text-[8px] sm:text-[9px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md w-fit">
                                        <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                        Pending
                                    </div>
                                </div>

                                <div className="p-2.5 sm:p-3 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden group">
                                    <p className="text-neutral-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5">Total Paid</p>
                                    <p className="text-sm sm:text-base md:text-lg font-mono font-bold text-emerald-400 tracking-tight truncate">₹{dairySummary.paid.toLocaleString()}</p>
                                    <div className="mt-1 flex items-center gap-1 text-[8px] sm:text-[9px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md w-fit">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                        Settled
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-auto pt-2 sm:pt-3 border-t border-white/5 shrink-0">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[8px] sm:text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Payment Progress</span>
                                    <span className="text-[11px] sm:text-xs font-bold text-white">{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full h-1.5 sm:h-2 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-1000 ease-out relative"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                                <div className="flex justify-between mt-1 text-[8px] sm:text-[9px] text-neutral-500 font-mono">
                                    <span>Settled Ledger</span>
                                    <span>Total: ₹{totalAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- MOLECULE VIEWER HERO ---
            if (app.id === 'molecule-viewer' && lastMolecule) {
                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-indigo-950 to-black p-4 sm:p-5 md:p-8 flex flex-col justify-between overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        
                        <div className="relative z-10 w-full h-full flex flex-col justify-between">
                            <HeroHeader title="Chemistry Lab" icon={FlaskConical} color="text-indigo-400" subtitle="Molecular structures in 3D" />

                            <div className="flex items-center gap-3 sm:gap-4 my-auto min-h-0">
                                <div className="flex-1 min-w-0">
                                    <div className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1 sm:mb-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                        Last Analyzed
                                    </div>
                                    <h3 className="text-base sm:text-xl md:text-2xl font-extrabold text-white leading-tight mb-2 sm:mb-3 truncate font-serif italic">
                                        {lastMolecule}
                                    </h3>
                                    
                                    {moleculeData && (
                                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                            <div className="p-1.5 sm:p-2.5 rounded-xl bg-white/5 border border-white/5">
                                                <p className="text-indigo-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Formula</p>
                                                <p className="text-[11px] sm:text-xs font-bold text-white font-mono truncate">{moleculeData.molecularFormula || 'N/A'}</p>
                                            </div>
                                            <div className="p-1.5 sm:p-2.5 rounded-xl bg-white/5 border border-white/5">
                                                <p className="text-indigo-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Weight</p>
                                                <p className="text-[11px] sm:text-xs font-bold text-white font-mono truncate">{moleculeData.molecularWeight ? `${moleculeData.molecularWeight}` : 'N/A'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Abstract Molecule Structure */}
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center shrink-0 shadow-xl overflow-hidden">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 relative animate-[spin_15s_linear_infinite]">
                                        <div className="absolute inset-0 border border-indigo-500/30 rounded-full border-dashed" />
                                        <div className="absolute inset-2 border border-blue-500/30 rounded-full animate-[spin_10s_linear_infinite_reverse] border-dotted" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full" />
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full" />
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-auto pt-2 sm:pt-3 border-t border-white/5 text-[8px] sm:text-[9px] text-indigo-300/40 font-mono uppercase tracking-wider">
                                Click card to interact in virtual sandbox
                            </div>
                        </div>
                    </div>
                );
            }

            // --- SETTINGS HERO ---
            if (app.id === 'settings' && settingsSummary) {
                const settingItems = [
                    { label: "Theme", value: settingsSummary.theme, icon: Palette, color: "text-emerald-400" },
                    { label: "Voice", value: settingsSummary.voice, icon: Mic, color: "text-blue-400" },
                    { label: "Font", value: settingsSummary.font, icon: Sliders, color: "text-purple-400" },
                    { label: "Density", value: settingsSummary.density, icon: LayoutGrid, color: "text-amber-400" },
                    { label: "Radius", value: settingsSummary.radius, icon: CheckCircle2, color: "text-rose-400" },
                    { label: "Account", value: settingsSummary.authStatus, icon: ShieldCheck, color: "text-cyan-400" },
                ];

                return (
                    <div className="absolute inset-0 bg-neutral-950 p-3.5 sm:p-4 md:p-6 flex flex-col justify-between overflow-hidden">
                        <div className="absolute -right-8 -top-8 opacity-5 pointer-events-none">
                            <Settings className="w-36 h-36 md:w-64 md:h-64 text-white animate-[spin_60s_linear_infinite]" />
                        </div>

                        <div className="relative z-10 w-full h-full flex flex-col justify-between">
                            <HeroHeader title="Preferences" icon={Settings} color="text-slate-400" subtitle="Configuration & Customization" />
                            
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 my-auto">
                                {settingItems.map((item, sIdx) => (
                                    <div key={sIdx} className="flex items-center justify-between px-2.5 py-1.5 sm:py-2 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <item.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                                            <span className="text-[10px] sm:text-xs font-bold text-neutral-300 truncate">{item.label}</span>
                                        </div>
                                        <span className={`text-[10px] sm:text-xs font-mono capitalize shrink-0 ${item.color}`}>
                                            {item.value}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-auto pt-2 sm:pt-2.5 border-t border-white/5 flex items-center justify-between text-[8px] sm:text-[9px] text-slate-400 font-mono uppercase tracking-wider">
                                <span>6 Active Preferences</span>
                                <span>Applied Instantly</span>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- VOICE CHAT HERO ---
            if (app.id === 'live-conversation' && recentConversation) {
                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-900 via-rose-950 to-black p-4 sm:p-5 md:p-8 flex flex-col justify-between overflow-hidden">
                        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                            <Mic className="w-36 h-36 md:w-64 md:h-64 text-rose-500" />
                        </div>
                        <div className="relative z-10 w-full h-full flex flex-col justify-between">
                            <HeroHeader title="Voice Conversations" icon={Mic} color="text-rose-400" subtitle="Speech Transcription" />
                            
                            <div className="space-y-2 sm:space-y-3 my-auto">
                                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-3 sm:p-4 max-w-2xl">
                                    <p className="text-xs sm:text-sm md:text-base text-white font-medium leading-relaxed line-clamp-3">
                                        "{recentConversation.title || 'No title'}"
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2.5 mt-auto pt-2 sm:pt-3 border-t border-white/5 items-center justify-between text-[8px] sm:text-[9px] font-mono text-rose-300/60 uppercase">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                    {new Date(recentConversation.createdAt).toLocaleDateString()}
                                </span>
                                <span>{recentConversation.messages?.length || 0} Messages</span>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- EXPLORE HERO ---
            if (app.id === 'explore' && exploreArticles.length > 0) {
                const article = exploreArticles[exploreArticleIndex];
                return (
                    <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-neutral-900">
                             {article.image && (
                                <img src={article.image} alt="" className="w-full h-full object-cover opacity-50 transition-transform duration-1000 hover:scale-105" referrerPolicy="no-referrer" />
                             )}
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                        </div>
                        <div className="absolute inset-0 p-4 sm:p-5 md:p-8 flex flex-col justify-end">
                            <div className="relative z-10 w-full">
                                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">Trending News</span>
                                    <span className="text-gray-300 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider truncate max-w-[150px]">
                                        {article.source.name}
                                    </span>
                                </div>
                                <h2 className="text-sm sm:text-base md:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight line-clamp-2 drop-shadow-md">
                                    {article.title}
                                </h2>
                                <p className="text-[11px] sm:text-xs md:text-sm text-gray-200 line-clamp-2 drop-shadow-sm font-medium">
                                    {article.description || article.content}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- TRANSLATOR HERO ---
            if (app.id === 'translator' && translatorStats) {
                const totalChars = translatorStats.input + translatorStats.output;
                const inputRatio = totalChars > 0 ? Math.round((translatorStats.input / totalChars) * 100) : 50;
                const outputRatio = 100 - inputRatio;

                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-indigo-950 to-black p-4 sm:p-5 md:p-8 flex flex-col justify-between overflow-hidden">
                        <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
                            <Languages className="w-36 h-36 md:w-64 md:h-64 text-indigo-500" />
                        </div>
                        <div className="relative z-10 w-full h-full flex flex-col justify-between">
                            <HeroHeader title="Translation Stats" icon={Languages} color="text-indigo-400" subtitle="Multi-language Engine" />
                            
                            <div className="my-auto flex flex-col gap-2">
                                <div className="flex items-baseline justify-between">
                                    <div>
                                        <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tighter leading-none">
                                            {totalChars.toLocaleString()}
                                        </span>
                                        <span className="text-[9px] sm:text-[10px] text-indigo-300 font-bold uppercase tracking-wider ml-2">Total Characters</span>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[9px] sm:text-[10px] font-mono font-bold">
                                        100+ Langs
                                    </span>
                                </div>

                                {/* Ratio bar */}
                                <div className="w-full h-1.5 sm:h-2 bg-indigo-950 rounded-full overflow-hidden border border-white/10 flex">
                                    <div className="bg-indigo-400 h-full transition-all" style={{ width: `${inputRatio}%` }} title={`Input: ${inputRatio}%`} />
                                    <div className="bg-cyan-400 h-full transition-all" style={{ width: `${outputRatio}%` }} title={`Output: ${outputRatio}%`} />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-auto pt-2 sm:pt-3 border-t border-white/5">
                                <div className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-indigo-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Input</p>
                                    <p className="text-[11px] sm:text-xs font-bold text-white truncate">{translatorStats.input.toLocaleString()}</p>
                                </div>
                                <div className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-indigo-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Output</p>
                                    <p className="text-[11px] sm:text-xs font-bold text-white truncate">{translatorStats.output.toLocaleString()}</p>
                                </div>
                                <div className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-indigo-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Engine</p>
                                    <p className="text-[11px] sm:text-xs font-bold text-indigo-300 truncate">Neural AI</p>
                                </div>
                                <div className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/5">
                                    <p className="text-indigo-200/50 text-[8px] sm:text-[9px] font-bold uppercase mb-0.5 truncate">Audio</p>
                                    <p className="text-[11px] sm:text-xs font-bold text-emerald-400 truncate">TTS Ready</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        }

        // Check if explore has articles even in anonymous mode
        if (app.id === 'explore' && exploreArticles.length > 0) {
            const article = exploreArticles[exploreArticleIndex];
            return (
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-neutral-900">
                         {article.image && (
                            <img src={article.image} alt="" className="w-full h-full object-cover opacity-50 transition-transform duration-1000 hover:scale-105" referrerPolicy="no-referrer" />
                         )}
                         <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    </div>
                    <div className="absolute inset-0 p-4 sm:p-5 md:p-8 flex flex-col justify-end">
                        <div className="relative z-10 w-full">
                            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">Trending News</span>
                                <span className="text-gray-300 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider truncate max-w-[150px]">
                                    {article.source.name}
                                </span>
                            </div>
                            <h2 className="text-sm sm:text-base md:text-xl font-bold text-white mb-1 sm:mb-2 leading-tight line-clamp-2 drop-shadow-md">
                                {article.title}
                            </h2>
                            <p className="text-[11px] sm:text-xs md:text-sm text-gray-200 line-clamp-2 drop-shadow-sm font-medium">
                                {article.description || article.content}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        // --- ENHANCED DEFAULT / ANONYMOUS HERO SLIDE ---
        const anonymousDetails: Record<string, {
            subtitle: string;
            tagline: string;
            features: { title: string; desc: string; icon: any }[];
            badge: string;
            bgGradient: string;
            accentColor: string;
        }> = {
            explore: {
                subtitle: "Global Intelligence & News",
                tagline: "Curated real-time feeds, breaking headlines, and offline reading.",
                features: [
                    { title: "Live Feeds", desc: "Top global channels", icon: Zap },
                    { title: "Smart Reader", desc: "Clean reader view", icon: BookOpen }
                ],
                badge: "Curated Headlines",
                bgGradient: "from-blue-900 via-slate-950 to-black",
                accentColor: "text-blue-400"
            },
            notes: {
                subtitle: "Markdown Vault & Ideas",
                tagline: "Capture inspirations, markdown documents, and structured logs.",
                features: [
                    { title: "Markdown Editor", desc: "Formatting & tables", icon: FileText },
                    { title: "Local Vault", desc: "Instant offline access", icon: Database }
                ],
                badge: "Encrypted Storage",
                bgGradient: "from-amber-900 via-amber-950 to-black",
                accentColor: "text-amber-400"
            },
            finance: {
                subtitle: "Budgets & Expense Tracking",
                tagline: "Track income, categorize expenses, and monitor monthly cashflow.",
                features: [
                    { title: "Income & Expenses", desc: "Instant fast logging", icon: Wallet },
                    { title: "Cashflow Metrics", desc: "Real-time balances", icon: TrendingUp }
                ],
                badge: "Private & Offline",
                bgGradient: "from-emerald-900 via-emerald-950 to-black",
                accentColor: "text-emerald-400"
            },
            dairy: {
                subtitle: "Daily Ledger & Khata",
                tagline: "Manage accounts, dues, settled payments, and ledger balances.",
                features: [
                    { title: "Ledger Accounts", desc: "Dues & payments", icon: ScrollText },
                    { title: "PDF Statements", desc: "Export statements", icon: CheckCircle2 }
                ],
                badge: "Zero Data Loss",
                bgGradient: "from-purple-900 via-purple-950 to-black",
                accentColor: "text-purple-400"
            },
            translator: {
                subtitle: "Neural Multi-Language Hub",
                tagline: "Lightning-fast translations across 100+ languages with voice playback.",
                features: [
                    { title: "100+ Languages", desc: "Neural engine", icon: Languages },
                    { title: "Voice Audio", desc: "Pronunciation playback", icon: Volume2 }
                ],
                badge: "Neural Powered",
                bgGradient: "from-indigo-900 via-indigo-950 to-black",
                accentColor: "text-indigo-400"
            },
            'molecule-viewer': {
                subtitle: "Interactive 3D Chemistry",
                tagline: "Simulate and inspect molecular geometries, weights, and atomic orbitals.",
                features: [
                    { title: "3D WebGL", desc: "Spatial rotation", icon: FlaskConical },
                    { title: "Formula Data", desc: "Weight & structures", icon: Cpu }
                ],
                badge: "Virtual Sandbox",
                bgGradient: "from-cyan-950 via-slate-950 to-black",
                accentColor: "text-cyan-400"
            },
            settings: {
                subtitle: "System Preferences",
                tagline: "Personalize visual themes, AI voice personas, and offline caching.",
                features: [
                    { title: "Theme Engine", desc: "Adaptive day & dark", icon: Palette },
                    { title: "Voice Personas", desc: "Custom audio models", icon: Settings }
                ],
                badge: "Personalized",
                bgGradient: "from-neutral-900 via-neutral-950 to-black",
                accentColor: "text-slate-300"
            }
        };

        const details = anonymousDetails[app.id] || {
            subtitle: "Digital Workspace App",
            tagline: app.description,
            features: [
                { title: "Fast & Offline", desc: "Ready anytime", icon: Zap },
                { title: "Secure Vault", desc: "Private storage", icon: ShieldCheck }
            ],
            badge: "Offline Persistent",
            bgGradient: "from-neutral-900 via-neutral-950 to-black",
            accentColor: "text-white"
        };

        return (
            <div className="absolute inset-0 overflow-hidden bg-neutral-950">
                {/* Background image with enhanced gradient overlay */}
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 opacity-20 scale-105"
                    style={{ backgroundImage: `url(${app.bannerImg})` }}
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${details.bgGradient} opacity-95`} />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
                
                {/* Background Decorative App Icon */}
                <div className="absolute -right-6 -bottom-6 opacity-10 transform rotate-12 pointer-events-none">
                    <app.icon className={`w-32 h-32 md:w-56 md:h-56 ${details.accentColor}`} />
                </div>

                <div className="absolute inset-0 p-4 sm:p-5 md:p-8 flex flex-col justify-between relative z-10">
                    <HeroHeader 
                        title={app.title} 
                        icon={app.icon} 
                        color={details.accentColor} 
                        subtitle={details.subtitle} 
                    />
                    
                    {/* Middle Feature Highlights - Fills the card evenly */}
                    <div className="my-auto flex flex-col gap-2 sm:gap-2.5">
                        <p className="text-xs sm:text-sm text-gray-200/90 font-medium leading-relaxed drop-shadow-md line-clamp-2">
                            {details.tagline}
                        </p>

                        <div className="grid grid-cols-2 gap-2 mt-0.5">
                            {details.features.map((feat, fIdx) => (
                                <div key={fIdx} className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center gap-2 min-w-0">
                                    <div className="p-1 rounded-lg bg-white/10 shrink-0">
                                        <feat.icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${details.accentColor}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] sm:text-xs font-bold text-white truncate">{feat.title}</p>
                                        <p className="text-[8px] sm:text-[9px] text-white/50 truncate font-mono">{feat.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Action & Badge Row */}
                    <div className="mt-auto pt-2.5 sm:pt-3 border-t border-white/10 flex items-center justify-between">
                        <button className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 bg-white text-black font-bold rounded-full hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 text-[11px] sm:text-xs shadow-md group/btn shrink-0">
                            Open App <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[9px] sm:text-[10px] text-white/70 font-mono">
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            <span>{details.badge}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="px-3 py-6 pt-20 md:px-6 md:py-12 md:pt-24 w-full max-w-[1600px] mx-auto h-full overflow-y-auto scrollbar-hide dev-console-spacing-pb">
            
            {/* Dynamic Animated Banner Section */}
            {/* Mobile View: Proportionally reduced card with preserved aspect ratio & centered layout */}
            <div className="md:hidden mb-8 w-full flex flex-col items-center">
                <div 
                    className="relative w-full max-w-[360px] xs:max-w-[380px] aspect-[16/10] rounded-[1.5rem] overflow-hidden shadow-lg group cursor-pointer mx-auto" 
                    onClick={() => onNavigate(apps[currentAdIndex].id as View)}
                >
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={currentAdIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: "easeInOut" }}
                            className="absolute inset-0 transition-transform duration-1000 group-hover:scale-[1.02]"
                        >
                            {renderHeroSlide(apps[currentAdIndex])}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Mobile Progress Indicators (centered underneath the card) */}
                <div className="flex justify-center items-center gap-1.5 mt-3.5 w-full">
                    {apps.map((_, idx) => (
                        <button 
                            key={idx} 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setTick(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all duration-500 p-0 border-0 cursor-pointer ${idx === currentAdIndex ? 'w-7 bg-indigo-500 dark:bg-indigo-400' : 'w-1.5 bg-gray-300 dark:bg-gray-700'}`}
                            aria-label={`Slide ${idx + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Desktop View: Interactive 3D Sliding Marquee Carousel */}
            <div className="hidden md:block mb-8 w-full overflow-hidden">
                <div className="relative w-full h-[17.5rem] lg:h-[19rem] xl:h-[20.5rem] flex items-center justify-center py-4">
                    {apps.map((app, idx) => {
                        const position = getCardPositionState(idx, currentAdIndex, apps.length);
                        
                        // Generate position-specific classes dynamically with beautiful, proportional sizes
                        let positionClasses = '';
                        if (position === 'center') {
                            positionClasses = 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[34%] max-w-[480px] min-w-[310px] z-30 opacity-100 scale-100 blur-0 shadow-2xl pointer-events-auto cursor-pointer';
                        } else if (position === 'left') {
                            positionClasses = 'top-1/2 -translate-y-1/2 left-[25%] -translate-x-1/2 w-[30%] max-w-[430px] min-w-[270px] z-20 opacity-75 scale-[0.84] blur-[0.5px] shadow-xl pointer-events-auto cursor-pointer hover:opacity-95';
                        } else if (position === 'right') {
                            positionClasses = 'top-1/2 -translate-y-1/2 left-[75%] -translate-x-1/2 w-[30%] max-w-[430px] min-w-[270px] z-20 opacity-75 scale-[0.84] blur-[0.5px] shadow-xl pointer-events-auto cursor-pointer hover:opacity-95';
                        } else if (position === 'far-left') {
                            positionClasses = 'top-1/2 -translate-y-1/2 left-[14%] -translate-x-1/2 w-[26%] max-w-[360px] min-w-[230px] z-10 opacity-35 scale-[0.68] blur-[1px] shadow-md pointer-events-auto cursor-pointer hover:opacity-60';
                        } else if (position === 'far-right') {
                            positionClasses = 'top-1/2 -translate-y-1/2 left-[86%] -translate-x-1/2 w-[26%] max-w-[360px] min-w-[230px] z-10 opacity-35 scale-[0.68] blur-[1px] shadow-md pointer-events-auto cursor-pointer hover:opacity-60';
                        } else {
                            positionClasses = 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[26%] z-0 opacity-0 scale-[0.5] blur-[8px] pointer-events-none';
                        }

                        return (
                            <div 
                                key={app.id}
                                className={`absolute h-[90%] rounded-[2rem] overflow-hidden transition-all duration-700 ease-in-out select-none ${positionClasses}`}
                                onClick={() => {
                                    if (position === 'center') {
                                        onNavigate(app.id as View);
                                    } else {
                                        let diff = idx - currentAdIndex;
                                        if (diff > apps.length / 2) {
                                            diff -= apps.length;
                                        } else if (diff < -apps.length / 2) {
                                            diff += apps.length;
                                        }
                                        setTick(prev => prev + diff);
                                    }
                                }}
                            >
                                <div className="absolute inset-0 transition-transform duration-1000 hover:scale-[1.02]">
                                    {renderHeroSlide(app)}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop Progress Indicators */}
                <div className="flex justify-center gap-2 mt-4">
                    {apps.map((_, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => {
                                const diff = (idx - currentAdIndex + apps.length) % apps.length;
                                setTick(prev => prev + diff);
                            }}
                            className={`h-1.5 rounded-full transition-all duration-500 hover:bg-indigo-400/80 ${idx === currentAdIndex ? 'w-8 bg-indigo-500 dark:bg-indigo-400' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
                            aria-label={`Slide ${idx + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Subtle Horizontal Divider */}
            <hr className="border-t border-neutral-200/80 dark:border-white/10 my-8 md:my-10" />

            {/* Landing Hero Title & Pitch */}
            <div className="text-center max-w-4xl mx-auto mt-12 mb-16 px-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-neutral-800 dark:text-white font-serif tracking-tight leading-[1.15]">
                    An Elegant Workspace <br />
                    Built for <span className="text-[var(--session-accent-text)] italic font-normal">Modern Intellects</span>
                </h1>
                <p className="text-neutral-500 dark:text-[var(--session-text-muted)] text-base sm:text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
                    Welcome to <strong className="font-bold text-neutral-800 dark:text-white">Ceaznet</strong> — a secure, offline-first digital sandbox bridging real-time global news, secure markdown logs, comprehensive budgeting, chemistry simulation, and lightning-fast neural translation.
                </p>
                <div className="flex flex-wrap justify-center gap-4 mt-8">
                    <button 
                        onClick={() => onNavigate('notes')}
                        className="px-6 py-3 bg-[var(--category-tab-active-bg)] text-[var(--category-tab-active-text)] rounded-full font-bold text-sm shadow-md hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                    >
                        Get Started Instantly
                    </button>
                    <button 
                        onClick={() => {
                            const element = document.getElementById('core-suites-section');
                            if (element) element.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-6 py-3 bg-[var(--category-tab-inactive-bg)] text-[var(--category-tab-inactive-text)] border border-[var(--category-tab-inactive-border)] rounded-full font-bold text-sm hover:bg-[var(--category-tab-inactive-hover-bg)] hover:text-[var(--category-tab-inactive-hover-text)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                    >
                        Explore Core Suites
                    </button>
                </div>
            </div>

            {/* Live Workspace Intelligence Hub */}
            <div className="mb-16">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
                    <div>
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--session-accent-text)]">Telemetry & Data</span>
                        <h2 className="text-2xl md:text-3xl font-serif font-bold text-neutral-800 dark:text-white mt-1">Live Workspace Intelligence</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Finance Card */}
                    <div className="p-4 rounded-xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] hover:bg-[var(--landing-card-hover-bg)] transition-all duration-300 flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-center">
                                <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                                    <Wallet className="w-4 h-4" />
                                </span>
                                <span className="text-[9px] font-mono font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded">Active Summary</span>
                            </div>
                            
                            <div className="grid grid-cols-5 gap-2 mt-3 items-stretch">
                                <div className="col-span-3">
                                    <h3 className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Finance Liquidity</h3>
                                    <p className="text-lg font-black text-neutral-800 dark:text-white mt-0.5">
                                        ₹{financeSummary ? financeSummary.balance.toLocaleString() : '0'}
                                    </p>
                                    <div className="mt-1.5 flex flex-row flex-wrap gap-x-2 text-[9px] font-mono text-neutral-500">
                                        <span className="whitespace-nowrap">In: <strong className="text-emerald-600 font-semibold">₹{financeSummary ? financeSummary.income.toLocaleString() : '0'}</strong></span>
                                        <span className="whitespace-nowrap">Out: <strong className="text-rose-500 font-semibold">₹{financeSummary ? financeSummary.expense.toLocaleString() : '0'}</strong></span>
                                    </div>
                                </div>
                                <div className="col-span-2 border-l border-neutral-200/60 dark:border-white/10 pl-2.5 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[8px] font-mono text-neutral-400 uppercase tracking-wider">Last Activity</p>
                                        {financeSummary?.lastTransaction ? (
                                            <div className="mt-0.5">
                                                <p className="text-[9px] font-bold text-neutral-700 dark:text-neutral-300 truncate">
                                                    {financeSummary.lastTransaction.description || financeSummary.lastTransaction.category}
                                                </p>
                                                <p className={`text-[9px] font-mono font-bold mt-0.5 ${financeSummary.lastTransaction.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                    {financeSummary.lastTransaction.type === 'income' ? '+' : '-'}₹{financeSummary.lastTransaction.amount.toLocaleString()}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-[8px] text-neutral-500 italic mt-0.5 leading-tight">No logs</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onNavigate('finance')} className="mt-3.5 flex items-center gap-1 text-xs font-bold text-[var(--session-accent-text)] group-hover:translate-x-1 transition-transform cursor-pointer bg-transparent border-none p-0 text-left">
                            Manage Budgets <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Daily Khata Card */}
                    <div className="p-4 rounded-xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] hover:bg-[var(--landing-card-hover-bg)] transition-all duration-300 flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-center">
                                <span className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400">
                                    <ScrollText className="w-4 h-4" />
                                </span>
                                <span className="text-[9px] font-mono font-bold text-purple-500 bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded">Ledger Log</span>
                            </div>

                            <div className="grid grid-cols-5 gap-2 mt-3 items-stretch">
                                <div className="col-span-3">
                                    <h3 className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Outstanding Due</h3>
                                    <p className="text-lg font-black text-red-500 mt-0.5">
                                        ₹{dairySummary ? dairySummary.due.toLocaleString() : '0'}
                                    </p>
                                    <div className="mt-1.5 text-[9px] font-mono text-neutral-500">
                                        Paid: <strong className="text-purple-600 dark:text-purple-400 font-semibold">₹{dairySummary ? dairySummary.paid.toLocaleString() : '0'}</strong>
                                    </div>
                                </div>
                                <div className="col-span-2 border-l border-neutral-200/60 dark:border-white/10 pl-2.5 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[8px] font-mono text-neutral-400 uppercase tracking-wider">Recovery</p>
                                        <div className="mt-0.5">
                                            <p className="text-base font-black text-neutral-800 dark:text-white leading-none">
                                                {dairySummary && (dairySummary.paid + dairySummary.due > 0)
                                                    ? `${Math.round((dairySummary.paid / (dairySummary.paid + dairySummary.due)) * 100)}%`
                                                    : '0%'}
                                            </p>
                                            <p className="text-[8px] font-mono text-neutral-500 uppercase mt-0.5 leading-tight">settled rate</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onNavigate('dairy')} className="mt-3.5 flex items-center gap-1 text-xs font-bold text-[var(--session-accent-text)] group-hover:translate-x-1 transition-transform cursor-pointer bg-transparent border-none p-0 text-left">
                            Open Ledger <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Notes Storage */}
                    <div className="p-4 rounded-xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] hover:bg-[var(--landing-card-hover-bg)] transition-all duration-300 flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-center">
                                <span className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400">
                                    <FileText className="w-4 h-4" />
                                </span>
                                <span className="text-[9px] font-mono font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">Vault Files</span>
                            </div>

                            <div className="grid grid-cols-5 gap-2 mt-3 items-stretch">
                                <div className="col-span-3">
                                    <h3 className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Knowledge Base</h3>
                                    <p className="text-lg font-black text-neutral-800 dark:text-white mt-0.5">
                                        {recentNotes.length > 0 ? `${recentNotes.length} Logged` : '0 Notes'}
                                    </p>
                                    <p className="text-[9px] text-neutral-500 dark:text-[var(--session-text-muted)] mt-1.5 font-mono line-clamp-2 italic leading-tight">
                                        {recentNotes.length > 0 ? `Latest: "${recentNotes[0].title || 'Untitled'}"` : 'No notes written yet'}
                                    </p>
                                </div>
                                <div className="col-span-2 border-l border-neutral-200/60 dark:border-white/10 pl-2.5 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[8px] font-mono text-neutral-400 uppercase tracking-wider">Older Logs</p>
                                        <div className="mt-0.5 space-y-0.5">
                                            {recentNotes.slice(1, 3).map((note, idx) => (
                                                <p key={note.id || idx} className="text-[8px] font-medium text-neutral-600 dark:text-neutral-400 truncate hover:text-[var(--session-accent-text)] transition-colors leading-tight">
                                                    • {note.title || 'Untitled'}
                                                </p>
                                            ))}
                                            {recentNotes.length <= 1 && (
                                                <p className="text-[8px] text-neutral-500 italic leading-tight">No other logs</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onNavigate('notes')} className="mt-3.5 flex items-center gap-1 text-xs font-bold text-[var(--session-accent-text)] group-hover:translate-x-1 transition-transform cursor-pointer bg-transparent border-none p-0 text-left">
                            Launch Notes Vault <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Neural & Chemistry */}
                    <div className="p-4 rounded-xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] hover:bg-[var(--landing-card-hover-bg)] transition-all duration-300 flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-center">
                                <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                                    <FlaskConical className="w-4 h-4" />
                                </span>
                                <span className="text-[9px] font-mono font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.5 rounded">Scientific Log</span>
                            </div>

                            <div className="grid grid-cols-5 gap-2 mt-3 items-stretch">
                                <div className="col-span-3">
                                    <h3 className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Active Sandbox</h3>
                                    <p className="text-base font-black text-neutral-800 dark:text-white mt-0.5 truncate">
                                        {lastMolecule || 'Caffeine'}
                                    </p>
                                    <p className="text-[9px] text-neutral-500 dark:text-[var(--session-text-muted)] mt-1.5 font-mono leading-tight">
                                        Translate: <strong>{translatorStats ? (translatorStats.input + translatorStats.output).toLocaleString() : '0'} ch</strong>
                                    </p>
                                </div>
                                <div className="col-span-2 border-l border-neutral-200/60 dark:border-white/10 pl-2.5 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[8px] font-mono text-neutral-400 uppercase tracking-wider">Compound</p>
                                        <div className="mt-0.5">
                                            <p className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate leading-none">
                                                {moleculeData?.molecularFormula || 'C8H10N4O2'}
                                            </p>
                                            <p className="text-[8px] font-mono text-neutral-500 uppercase mt-1 leading-tight">
                                                {moleculeData?.molecularWeight ? `${parseFloat(moleculeData.molecularWeight).toFixed(0)}g` : '194g/mol'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => onNavigate('molecule-viewer')} className="mt-3.5 flex items-center gap-1 text-xs font-bold text-[var(--session-accent-text)] group-hover:translate-x-1 transition-transform cursor-pointer bg-transparent border-none p-0 text-left">
                            Open Molecule Lab <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Core Suites Deep Dive */}
            <div id="core-suites-section" className="mb-16 pt-8 scroll-mt-20">
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--session-accent-text)]">Productivity Matrix</span>
                    <h2 className="text-3xl font-serif font-bold text-neutral-800 dark:text-white mt-2">Deliberately Structured Applications</h2>
                    <p className="text-sm text-neutral-500 dark:text-[var(--session-text-muted)] mt-3">
                        Every tool inside Ceaznet is engineered to operate independently while feeding seamlessly into your global productivity profile.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* App 1: Explore News */}
                    <div className="flex flex-col lg:flex-row items-stretch rounded-3xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] overflow-hidden hover:border-[var(--session-accent-border)] transition-colors group">
                        <div className="lg:w-1/3 bg-neutral-100 dark:bg-neutral-900 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--session-card-border)]">
                            <div>
                                <span className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 inline-block">
                                    <BookOpen className="w-6 h-6" />
                                </span>
                                <h3 className="text-2xl font-serif font-bold text-neutral-800 dark:text-white mt-4">Explore News Feed</h3>
                                <p className="text-sm text-neutral-500 dark:text-[var(--session-text-muted)] mt-2">
                                    Read latest curated global news articles, completely indexed offline.
                                </p>
                            </div>
                            <button onClick={() => onNavigate('explore')} className="mt-8 px-5 py-2.5 bg-neutral-800 text-white dark:bg-white dark:text-black font-bold rounded-full text-xs shadow-md hover:opacity-90 active:scale-95 transition-all self-start cursor-pointer">
                                Open News Workspace
                            </button>
                        </div>
                        <div className="lg:w-2/3 p-8 flex flex-col justify-center gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">Smart Category Curations</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Filter news dynamically using keyword tags, sources, and categories for a custom feed.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">Offline Reader Sandbox</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Saves full text contents in Telegram persistent storage so you can read without standard internet delays.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">Neural Translations</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Instantly translate entire paragraphs inside the article reader view with a single click.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">Unified Bookmarks Vault</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Keep track of your favorite research papers and news items dynamically across devices.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* App 2: Intelligent Notes */}
                    <div className="flex flex-col lg:flex-row-reverse items-stretch rounded-3xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] overflow-hidden hover:border-[var(--session-accent-border)] transition-colors group">
                        <div className="lg:w-1/3 bg-neutral-100 dark:bg-neutral-900 p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-l border-[var(--session-card-border)]">
                            <div>
                                <span className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 inline-block">
                                    <FileText className="w-6 h-6" />
                                </span>
                                <h3 className="text-2xl font-serif font-bold text-neutral-800 dark:text-white mt-4">Intelligent Notes</h3>
                                <p className="text-sm text-neutral-500 dark:text-[var(--session-text-muted)] mt-2">
                                    Capture your thoughts, plan tasks, write documentation, and edit in clean Markdown.
                                </p>
                            </div>
                            <button onClick={() => onNavigate('notes')} className="mt-8 px-5 py-2.5 bg-neutral-800 text-white dark:bg-white dark:text-black font-bold rounded-full text-xs shadow-md hover:opacity-90 active:scale-95 transition-all self-start cursor-pointer">
                                Open Notes Canvas
                            </button>
                        </div>
                        <div className="lg:w-2/3 p-8 flex flex-col justify-center gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">Full Markdown Parsing</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Supports links, list items, rich headings, bold tags, and customized code block rendering.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">Peer Note Sharing</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Generate read-only shared access links to export structured notes cleanly to other users.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">Heuristic Global Search</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Search through your entire archive instantaneously with real-time word highlighting.</p>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-neutral-800 dark:text-white">State Synchronizers</h4>
                                    <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">Real-time local saving safeguards and ensures you never lose a single typed character.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* App 3: Personal Finance & Ledger (Two Columns Split) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Finance */}
                        <div className="p-8 rounded-3xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] transition-all flex flex-col justify-between">
                            <div>
                                <span className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 inline-block">
                                    <Wallet className="w-6 h-6" />
                                </span>
                                <h3 className="text-2xl font-serif font-bold text-neutral-800 dark:text-white mt-4">Unified Personal Finance</h3>
                                <p className="text-sm text-neutral-500 dark:text-[var(--session-text-muted)] mt-2">
                                    Track global transactions, check category spendings, and balance your budgets.
                                </p>
                                <ul className="mt-6 space-y-3 text-xs text-neutral-500 dark:text-[var(--session-text-muted)]">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Automated monthly budget health analytics.</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CSV transaction importing.</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Interactive categorized expense breakdown charts.</li>
                                </ul>
                            </div>
                            <button onClick={() => onNavigate('finance')} className="mt-8 px-5 py-2.5 bg-neutral-800 text-white dark:bg-white dark:text-black font-bold rounded-full text-xs shadow-md hover:opacity-90 active:scale-95 transition-all self-start cursor-pointer">
                                Launch Finance Suite
                            </button>
                        </div>

                        {/* Daily Khata */}
                        <div className="p-8 rounded-3xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] transition-all flex flex-col justify-between">
                            <div>
                                <span className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-500 inline-block">
                                    <Calendar className="w-6 h-6" />
                                </span>
                                <h3 className="text-2xl font-serif font-bold text-neutral-800 dark:text-white mt-4">Daily Khata Ledger</h3>
                                <p className="text-sm text-neutral-500 dark:text-[var(--session-text-muted)] mt-2">
                                    Professional, custom-tailored accounts ledger to track business and personal balances.
                                </p>
                                <ul className="mt-6 space-y-3 text-xs text-neutral-500 dark:text-[var(--session-text-muted)]">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Outstanding logs for due & cleared Khatas.</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Integrated dynamic PDF invoice generator.</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Vehicle and fuel expense management panels.</li>
                                </ul>
                            </div>
                            <button onClick={() => onNavigate('dairy')} className="mt-8 px-5 py-2.5 bg-neutral-800 text-white dark:bg-white dark:text-black font-bold rounded-full text-xs shadow-md hover:opacity-90 active:scale-95 transition-all self-start cursor-pointer">
                                Launch Khata Desk
                            </button>
                        </div>
                    </div>

                    {/* App 4 & 5 & 6 & 7: Grid of Specialized Services */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Translator */}
                        <div className="p-6 rounded-3xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] transition-all flex flex-col justify-between">
                            <div>
                                <span className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 inline-block">
                                    <Languages className="w-5 h-5" />
                                </span>
                                <h3 className="text-lg font-bold text-neutral-800 dark:text-white mt-3">Neural Translator</h3>
                                <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">
                                    Highly performant cross-language translation with custom prompt enhancements. Supports multi-character text parsing.
                                </p>
                            </div>
                            <button onClick={() => onNavigate('translator')} className="mt-6 flex items-center gap-1 text-xs font-bold text-[var(--session-accent-text)] hover:translate-x-1 transition-transform cursor-pointer bg-transparent border-none p-0 text-left">
                                Open Translator <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Chem Lab */}
                        <div className="p-6 rounded-3xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] transition-all flex flex-col justify-between">
                            <div>
                                <span className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 text-cyan-500 inline-block">
                                    <FlaskConical className="w-5 h-5" />
                                </span>
                                <h3 className="text-lg font-bold text-neutral-800 dark:text-white mt-3">Chemistry Sandbox</h3>
                                <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">
                                    Explore interactive WebGL 3D molecular structures. Supports electron density, label highlights, and physical parameter checks.
                                </p>
                            </div>
                            <button onClick={() => onNavigate('molecule-viewer')} className="mt-6 flex items-center gap-1 text-xs font-bold text-[var(--session-accent-text)] hover:translate-x-1 transition-transform cursor-pointer bg-transparent border-none p-0 text-left">
                                Enter Sandbox <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Settings */}
                        <div className="p-6 rounded-3xl bg-[var(--session-card-bg)] border border-[var(--session-card-border)] hover:border-[var(--session-accent-border)] transition-all flex flex-col justify-between">
                            <div>
                                <span className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/20 text-slate-500 inline-block">
                                    <Settings className="w-5 h-5" />
                                </span>
                                <h3 className="text-lg font-bold text-neutral-800 dark:text-white mt-3">Preferences Engine</h3>
                                <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-1">
                                    Personalize the entire workspace. Control typographic layout scales, custom accent hues, and choose voice-over assistant profiles.
                                </p>
                            </div>
                            <button onClick={() => onNavigate('settings')} className="mt-6 flex items-center gap-1 text-xs font-bold text-[var(--session-accent-text)] hover:translate-x-1 transition-transform cursor-pointer bg-transparent border-none p-0 text-left">
                                Configure System <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* System Integrity & Infrastructure */}
            <div className="mb-16 border-t border-[var(--session-card-border)] pt-16">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div>
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 w-fit">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-neutral-800 dark:text-white mt-4">Zero Cloud Leakage</h3>
                        <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-2 leading-relaxed">
                            Your notes, private expenses, daily khatas, and configurations are synchronized natively with end-to-end encrypted Telegram channels or sandboxed locally in offline-first localStorage blocks. We never index your details for model training.
                        </p>
                    </div>

                    <div>
                        <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/10 text-amber-600 dark:text-amber-400 w-fit">
                            <Database className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-neutral-800 dark:text-white mt-4">Persistent Offline Sync</h3>
                        <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-2 leading-relaxed">
                            Every keystroke is saved immediately. Continue working, accounting, translating, or reading while in tunnels, flights, or remote zones. The integrated sync manager aligns changes automatically as soon as internet connection restablishes.
                        </p>
                    </div>

                    <div>
                        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/10 text-indigo-600 dark:text-indigo-400 w-fit">
                            <Layers className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-neutral-800 dark:text-white mt-4">Alternating Control Hub</h3>
                        <p className="text-xs text-neutral-500 dark:text-[var(--session-text-muted)] mt-2 leading-relaxed">
                            Ceaznet fuses seven completely distinct workspaces into a singular, highly cohesive workspace. Move between ledgers, news highlights, and molecular sandboxes without ever shifting focus, opening new tabs, or logging in twice.
                        </p>
                    </div>
                </div>
            </div>

            {/* Legal Footer for Public Verification */}
            <footer className="mt-auto pt-6 pb-2 text-center border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-500">
                <div className="flex items-center justify-center space-x-4 mb-2 font-mono">
                    <a href="/privacy" onClick={(e) => { e.preventDefault(); onNavigate('privacy-policy'); }} className="hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors">
                        Privacy Policy
                    </a>
                    <span>•</span>
                    <a href="/about" onClick={(e) => { e.preventDefault(); onNavigate('about'); }} className="hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors">
                        About
                    </a>
                    <span>•</span>
                    <a href="/terms" onClick={(e) => { e.preventDefault(); onNavigate('terms-of-service'); }} className="hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors">
                        Terms of Service
                    </a>
                </div>
                <p className="font-mono">&copy; {new Date().getFullYear()} {metadata.name}. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default HomeView;
