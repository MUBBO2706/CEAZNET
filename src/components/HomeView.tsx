import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { View, NewsArticle, Note, Transaction, Conversation, UserProfile, MoleculeData } from '../types';
import { BookOpen, FileText, Wallet, Calendar, Languages, FlaskConical, Mic, Settings, ArrowRight, TrendingUp, TrendingDown, MessageSquare, Clock, Plus, ArrowUpRight, AlertCircle, CheckCircle2, ScrollText, Palette, Volume2, Cpu } from 'lucide-react';
import { getNotes, getRecentNotes, getFinanceSummary, getTransactions, getRecentConversation, getDairySummary, getDairyEntries, getDairyPayments, getTranslatorUsage, getLastMolecule, getSetting } from '../services/dbService';
import { getMoleculeSummary } from '../services/chemistryService';
import type { User } from '@supabase/supabase-js';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MoleculeViewer from './MoleculeViewer';
import metadata from '../../metadata.json';

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

const HomeView: React.FC<HomeViewProps> = ({ onNavigate, user, userProfile, exploreArticles }) => {
    const [tick, setTick] = useState(0);
    const [recentNotes, setRecentNotes] = useState<Note[]>([]);
    const [financeSummary, setFinanceSummary] = useState<{ balance: number, income: number, expense: number, lastTransaction: Transaction | null } | null>(null);
    const [recentConversation, setRecentConversation] = useState<Conversation | null>(null);
    const [dairySummary, setDairySummary] = useState<{ due: number, paid: number } | null>(null);
    const [translatorStats, setTranslatorStats] = useState<{ input: number, output: number } | null>(null);
    const [lastMolecule, setLastMolecule] = useState<string | null>(null);
    const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
    const [settingsSummary, setSettingsSummary] = useState<{ theme: string, voice: string } | null>(null);

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
                    setSettingsSummary({ theme: theme as string, voice: voice as string });
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
        // Common Header for Hero Slides
        const HeroHeader = ({ title, icon: Icon, color }: { title: string, icon: any, color: string }) => (
            <div className="flex items-center gap-3 mb-4 md:mb-6 relative z-10">
                <div className={`p-2 md:p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg`}>
                    <Icon className={`w-5 h-5 md:w-6 md:h-6 ${color}`} />
                </div>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight drop-shadow-md truncate">
                    {title}
                </h2>
            </div>
        );

        if (user) {
            // --- FINANCE HERO ---
            if (app.id === 'finance' && financeSummary) {
                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-950 to-black p-6 md:p-12 flex flex-col justify-center overflow-hidden">
                        <div className="absolute -right-12 -bottom-12 opacity-10 transform rotate-12 pointer-events-none">
                            <Wallet className="w-48 h-48 md:w-96 md:h-96 text-emerald-500" />
                        </div>
                        <div className="relative z-10 w-full">
                            <HeroHeader title="Financial Overview" icon={Wallet} color="text-emerald-400" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-4xl">
                                <div>
                                    <p className="text-emerald-200/60 text-xs md:text-sm font-bold uppercase tracking-wider mb-1 md:mb-2">Total Balance</p>
                                    <p className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight break-all">₹{financeSummary.balance.toLocaleString()}</p>
                                </div>
                                <div className="flex flex-row md:flex-col gap-4 md:gap-6">
                                    <div className="flex-1 flex items-center justify-between border-b border-white/10 pb-2">
                                        <p className="text-emerald-200/60 text-[10px] md:text-xs font-bold uppercase tracking-wider">Income</p>
                                        <p className="text-lg md:text-2xl font-bold text-emerald-400">+₹{financeSummary.income.toLocaleString()}</p>
                                    </div>
                                    <div className="flex-1 flex items-center justify-between border-b border-white/10 pb-2">
                                        <p className="text-rose-200/60 text-[10px] md:text-xs font-bold uppercase tracking-wider">Expense</p>
                                        <p className="text-lg md:text-2xl font-bold text-rose-400">-₹{financeSummary.expense.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                            {financeSummary.lastTransaction && (
                                <div className="ml-0 mt-6 md:mt-8 inline-flex items-center gap-3 px-4 py-2 md:px-5 md:py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer max-w-full">
                                    <div className={`p-1.5 rounded-full shrink-0 ${financeSummary.lastTransaction.type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {financeSummary.lastTransaction.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Last Activity</span>
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="text-white font-bold text-sm truncate">{financeSummary.lastTransaction.description}</span>
                                            <span className={`text-sm font-bold shrink-0 ${financeSummary.lastTransaction.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {financeSummary.lastTransaction.type === 'income' ? '+' : '-'}₹{financeSummary.lastTransaction.amount}
                                            </span>
                                        </div>
                                    </div>
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
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-900 via-amber-950 to-black p-6 md:p-12 flex flex-col justify-center overflow-hidden">
                        <div className="absolute -right-12 -top-12 opacity-10 transform -rotate-12 pointer-events-none">
                            <FileText className="w-48 h-48 md:w-96 md:h-96 text-amber-500" />
                        </div>
                        <div className="relative z-10 max-w-3xl w-full">
                            <HeroHeader title="Recent Thoughts" icon={FileText} color="text-amber-400" />
                            <div className="bg-white/5 border border-white/10 rounded-3xl p-5 md:p-8 shadow-2xl relative group hover:bg-white/10 transition-colors">
                                <div className="absolute -top-3 left-8 w-12 h-4 bg-amber-500/30 rotate-[-2deg]" />
                                <h3 className="text-xl md:text-3xl font-bold text-white mb-2 md:mb-4 font-serif leading-tight truncate">{note.title || 'Untitled Note'}</h3>
                                <p className="text-base md:text-xl text-amber-100/80 line-clamp-3 font-mono leading-relaxed">
                                    {plainContent || 'No content'}
                                </p>
                                <div className="mt-4 md:mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                                    <div className="flex items-center gap-2 text-amber-200/50 text-xs font-bold uppercase tracking-wider">
                                        <Clock className="w-3 h-3" />
                                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                                    </div>
                                    <div className="flex gap-1">
                                        {recentNotes.map((_, idx) => (
                                            <div key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === currentNoteIndex ? 'bg-amber-500' : 'bg-white/20'}`} />
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
                    <div className="absolute inset-0 bg-neutral-900 p-4 md:p-8 flex flex-col justify-center overflow-hidden">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none" 
                             style={{ backgroundImage: 'radial-gradient(#a855f7 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                        </div>
                        
                        <div className="relative z-10 w-full h-full flex flex-col justify-center">
                            <div className="flex items-center gap-3 mb-3 md:mb-6 shrink-0">
                                <div className="p-2 md:p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                    <ScrollText className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Daily Ledger</h2>
                                    <p className="text-[10px] md:text-xs text-purple-400 font-medium uppercase tracking-wider">Financial Overview</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-6 shrink-0">
                                <div className="p-3 md:p-5 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 p-2 md:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <AlertCircle className="w-8 h-8 md:w-16 md:h-16 text-red-500" />
                                    </div>
                                    <p className="text-neutral-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">Outstanding Due</p>
                                    <p className="text-xl md:text-3xl font-mono font-bold text-white tracking-tight truncate">₹{dairySummary.due.toLocaleString()}</p>
                                    <div className="mt-1 md:mt-3 flex items-center gap-1 md:gap-2 text-[10px] md:text-xs font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg w-fit">
                                        <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        Pending
                                    </div>
                                </div>

                                <div className="p-3 md:p-5 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden group">
                                    <div className="absolute right-0 top-0 p-2 md:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <CheckCircle2 className="w-8 h-8 md:w-16 md:h-16 text-emerald-500" />
                                    </div>
                                    <p className="text-neutral-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-0.5 md:mb-1">Total Paid</p>
                                    <p className="text-xl md:text-3xl font-mono font-bold text-white tracking-tight truncate">₹{dairySummary.paid.toLocaleString()}</p>
                                    <div className="mt-1 md:mt-3 flex items-center gap-1 md:gap-2 text-[10px] md:text-xs font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg w-fit">
                                        <div className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-emerald-500" />
                                        Settled
                                    </div>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-auto shrink-0">
                                <div className="flex justify-between items-end mb-1 md:mb-2">
                                    <span className="text-[10px] md:text-xs font-bold text-neutral-400 uppercase tracking-wider">Payment Progress</span>
                                    <span className="text-xs md:text-sm font-bold text-white">{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full h-2 md:h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-1000 ease-out relative"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                                    </div>
                                </div>
                                <div className="flex justify-between mt-1 md:mt-2 text-[10px] text-neutral-500 font-mono">
                                    <span>₹0</span>
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
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-indigo-950 to-black p-6 md:p-12 flex flex-col justify-center overflow-hidden">
                        {/* Background Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                        
                        <div className="relative z-10 w-full h-full flex flex-col justify-center">
                            <div className="flex items-center gap-3 mb-4 md:mb-8 shrink-0">
                                <div className="p-2 md:p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 backdrop-blur-md shadow-lg">
                                    <FlaskConical className="w-6 h-6 md:w-8 md:h-8 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">Chemistry Lab</h2>
                                    <p className="text-xs md:text-sm text-indigo-400 font-medium uppercase tracking-wider mt-1">Molecular Analysis</p>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6 md:gap-12 h-full min-h-0 items-center">
                                <div className="flex-1 flex flex-col justify-center min-w-0 shrink w-full">
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4 md:mb-6 w-fit shadow-inner">
                                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                                        Last Analyzed
                                    </div>
                                    
                                    <h3 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white mb-6 md:mb-8 tracking-tighter font-serif italic leading-tight break-words line-clamp-2 drop-shadow-xl">
                                        {lastMolecule}
                                    </h3>
                                    
                                    {moleculeData && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group">
                                                <p className="text-indigo-200/60 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2 group-hover:text-indigo-300 transition-colors">Formula</p>
                                                <p className="text-sm sm:text-base md:text-lg font-bold text-white font-mono break-all">{moleculeData.molecularFormula || 'N/A'}</p>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group">
                                                <p className="text-indigo-200/60 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2 group-hover:text-indigo-300 transition-colors">Weight</p>
                                                <p className="text-sm sm:text-base md:text-lg font-bold text-white font-mono">{moleculeData.molecularWeight ? `${moleculeData.molecularWeight}` : 'N/A'}</p>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors group hidden sm:block">
                                                <p className="text-indigo-200/60 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-1 md:mb-2 group-hover:text-indigo-300 transition-colors">Complexity</p>
                                                <p className="text-sm sm:text-base md:text-lg font-bold text-white font-mono">{moleculeData.complexity || 'N/A'}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Visual Representation */}
                                <div className="relative w-full md:w-2/5 aspect-square max-h-[300px] bg-black/40 rounded-3xl border border-white/10 overflow-hidden flex items-center justify-center group shrink-0 hidden sm:flex shadow-2xl">
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent" />
                                    
                                    {/* Abstract Molecule Structure */}
                                    <div className="relative z-10 flex items-center justify-center scale-150 group-hover:scale-110 transition-transform duration-700 ease-in-out">
                                        <div className="w-24 h-24 relative animate-[spin_20s_linear_infinite]">
                                            <div className="absolute inset-0 border-[3px] border-indigo-500/30 rounded-full border-dashed" />
                                            <div className="absolute inset-4 border-[3px] border-blue-500/30 rounded-full animate-[spin_15s_linear_infinite_reverse] border-dotted" />
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-indigo-500 rounded-full shadow-lg shadow-indigo-500/50" />
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full shadow shadow-blue-500/50" />
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full shadow shadow-blue-500/50" />
                                            <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full shadow shadow-blue-500/50" />
                                            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full shadow shadow-blue-500/50" />
                                        </div>
                                    </div>
                                    
                                    <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[10px] text-white/60 font-mono uppercase tracking-widest">
                                        3D Structure
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- SETTINGS HERO ---
            if (app.id === 'settings' && settingsSummary) {
                return (
                    <div className="absolute inset-0 bg-black p-4 sm:p-6 md:p-12 flex flex-col justify-center overflow-hidden">
                        <div className="absolute -right-8 -top-8 sm:-right-12 sm:-top-12 opacity-5 pointer-events-none">
                            <Settings className="w-48 h-48 md:w-96 md:h-96 text-white animate-[spin_60s_linear_infinite]" />
                        </div>

                        <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center gap-6 md:gap-8">
                            <div className="flex flex-col items-center text-center w-full">
                                <div className="flex items-center justify-center gap-3 mb-2 md:mb-3 relative z-10 w-full">
                                    <div className="p-2 md:p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-lg shrink-0">
                                        <Settings className="w-5 h-5 md:w-6 md:h-6 text-white/60" />
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md truncate">
                                        System Preferences
                                    </h2>
                                </div>
                                <p className="text-[10px] sm:text-xs md:text-sm text-white/40 font-mono uppercase tracking-widest mt-1">Configuration & Control</p>
                            </div>
                            
                            <div className="flex w-full gap-3 md:gap-6 justify-center max-w-lg">
                                {/* Appearance Panel */}
                                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 hover:bg-white/10 transition-all duration-300 group relative overflow-hidden shadow-2xl min-w-0">
                                    <div className="flex flex-col gap-2 md:gap-3 relative z-10">
                                        <div className="flex items-center gap-2 text-white/80 shrink-0">
                                            <div className="p-1.5 sm:p-2 rounded-xl bg-white/10 border border-white/10 shrink-0">
                                                <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </div>
                                            <h3 className="text-sm md:text-base font-bold text-white truncate">Appearance</h3>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 gap-2">
                                            <span className="text-[10px] sm:text-[11px] md:text-sm text-white/60 font-medium truncate">Theme</span>
                                            <div className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-md sm:rounded-lg bg-black/50 border border-white/10 text-[9px] sm:text-[10px] md:text-xs font-mono text-emerald-400 capitalize shadow-inner shrink-0 truncate">
                                                {settingsSummary.theme}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Voice Panel */}
                                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 hover:bg-white/10 transition-all duration-300 group relative overflow-hidden shadow-2xl min-w-0">
                                    <div className="flex flex-col gap-2 md:gap-3 relative z-10">
                                        <div className="flex items-center gap-2 text-white/80 shrink-0">
                                            <div className="p-1.5 sm:p-2 rounded-xl bg-white/10 border border-white/10 shrink-0">
                                                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </div>
                                            <h3 className="text-sm md:text-base font-bold text-white truncate">Voice</h3>
                                        </div>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 gap-2">
                                            <span className="text-[10px] sm:text-[11px] md:text-sm text-white/60 font-medium truncate">Active</span>
                                            <div className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-md sm:rounded-lg bg-black/50 border border-white/10 text-[9px] sm:text-[10px] md:text-xs font-mono text-blue-400 capitalize shadow-inner shrink-0 truncate">
                                                {settingsSummary.voice}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- VOICE CHAT HERO ---
            if (app.id === 'live-conversation' && recentConversation) {
                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-900 via-rose-950 to-black p-6 md:p-12 flex flex-col justify-center overflow-hidden">
                        <div className="absolute -right-12 -bottom-12 opacity-10 pointer-events-none">
                            <Mic className="w-48 h-48 md:w-96 md:h-96 text-rose-500" />
                        </div>
                        <div className="relative z-10 w-full">
                            <HeroHeader title="Voice Conversations" icon={Mic} color="text-rose-400" />
                            <div className="max-w-3xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="flex -space-x-2">
                                        <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs font-bold border-2 border-black">K</div>
                                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-white text-xs font-bold border-2 border-black">U</div>
                                    </div>
                                    <span className="text-rose-200/60 text-sm font-medium">
                                        Last chat {new Date(recentConversation.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                
                                <div className="space-y-4 mb-6">
                                    <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-4 md:p-6 max-w-2xl">
                                        <p className="text-lg md:text-xl text-white font-medium leading-relaxed line-clamp-3">
                                            "{recentConversation.title || 'No title'}"
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="px-4 py-2 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        {new Date(recentConversation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-bold uppercase tracking-wider">
                                        {recentConversation.messages?.length || 0} Messages
                                    </div>
                                </div>
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
                                <img src={article.image} alt="" className="w-full h-full object-cover opacity-60 transition-transform duration-1000 hover:scale-105" referrerPolicy="no-referrer" />
                             )}
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                        </div>
                        <div className="absolute inset-0 p-6 md:p-12 flex flex-col justify-end">
                            <div className="max-w-4xl relative z-10">
                                <div className="flex items-center gap-3 mb-2 md:mb-4">
                                    <span className="px-2 py-1 md:px-3 md:py-1 rounded-full bg-blue-600/80 text-white text-[10px] md:text-xs font-bold uppercase tracking-wider shadow-lg border border-blue-400/30">Trending News</span>
                                    <span className="text-gray-300 text-[10px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 truncate max-w-[150px]">
                                        <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                                        {article.source.name}
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-white mb-2 md:mb-4 leading-tight line-clamp-2 drop-shadow-lg">
                                    {article.title}
                                </h2>
                                <p className="text-sm md:text-lg text-gray-200 line-clamp-2 max-w-2xl drop-shadow-md font-medium">
                                    {article.description || article.content}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            }

            // --- TRANSLATOR HERO ---
            if (app.id === 'translator' && translatorStats) {
                return (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-indigo-950 to-black p-6 md:p-12 flex flex-col justify-center overflow-hidden">
                        <div className="absolute -right-12 -top-12 opacity-10 pointer-events-none">
                            <Languages className="w-48 h-48 md:w-96 md:h-96 text-indigo-500" />
                        </div>
                        <div className="relative z-10 w-full">
                            <HeroHeader title="Translation Stats" icon={Languages} color="text-indigo-400" />
                            <div className="flex flex-col md:flex-row items-start md:items-end gap-2 md:gap-4 mb-6 md:mb-8">
                                <span className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white tracking-tighter leading-none break-all">
                                    {(translatorStats.input + translatorStats.output).toLocaleString()}
                                </span>
                                <span className="text-sm md:text-xl text-indigo-300 font-bold mb-1 md:mb-4 uppercase tracking-wider">characters processed</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 max-w-md w-full">
                                <div className="p-4 md:p-5 rounded-2xl bg-white/5 border border-white/10">
                                    <p className="text-indigo-200/60 text-[10px] md:text-xs font-bold uppercase mb-1 md:mb-2">Input</p>
                                    <p className="text-xl md:text-2xl font-bold text-white truncate">{translatorStats.input.toLocaleString()}</p>
                                </div>
                                <div className="p-4 md:p-5 rounded-2xl bg-white/5 border border-white/10">
                                    <p className="text-indigo-200/60 text-[10px] md:text-xs font-bold uppercase mb-1 md:mb-2">Output</p>
                                    <p className="text-xl md:text-2xl font-bold text-white truncate">{translatorStats.output.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }
        }

        // --- FALLBACK / DEFAULT HERO ---
        return (
            <div className="absolute inset-0">
                <div 
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${app.bannerImg})` }}
                />
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 p-6 md:p-12 flex flex-col justify-center">
                    <div className="max-w-xl relative z-10">
                        <div className={`inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl mb-4 md:mb-6 bg-white/10 border border-white/20 shadow-xl`}>
                            <app.icon className={`w-6 h-6 md:w-8 md:h-8 text-white`} />
                        </div>
                        <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white mb-3 md:mb-4 tracking-tight drop-shadow-lg">{app.title}</h2>
                        <p className="text-lg md:text-xl text-gray-200 mb-6 md:mb-8 font-medium leading-relaxed drop-shadow-md line-clamp-3">{app.description}</p>
                        <button className="flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 bg-white text-black font-bold rounded-full hover:bg-gray-100 hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] w-fit group/btn text-sm md:text-base">
                            Open App <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 pt-20 md:p-12 md:pt-24 max-w-7xl mx-auto h-full overflow-y-auto scrollbar-hide">
            
            {/* Dynamic Animated Banner Section */}
            <div className="mb-10">
                <div className="relative w-full h-[18rem] md:h-[22rem] rounded-[2rem] overflow-hidden shadow-lg group cursor-pointer" onClick={() => onNavigate(apps[currentAdIndex].id as View)}>
                    {/* Dynamic Content Slides */}
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

                {/* Progress Indicators */}
                <div className="flex justify-center gap-2 mt-4">
                    {apps.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentAdIndex ? 'w-8 bg-indigo-500 dark:bg-indigo-400' : 'w-2 bg-gray-300 dark:bg-gray-700'}`}
                            aria-label={`Slide ${idx + 1}`}
                        />
                    ))}
                </div>
            </div>

            <motion.div 
                className="mb-8 flex items-center justify-between"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div>
                    <h2 className="text-2xl font-bold text-neutral-800 dark:text-white">
                        {user ? `Hi ${userProfile?.full_name?.split(' ')[0] || user.user_metadata.full_name?.split(' ')[0] || 'User'}, Welcome Back` : 'Welcome to Ceaznet'}
                    </h2>
                    <p className="text-neutral-500 dark:text-neutral-400 font-medium mt-1">
                        {user ? 'Here is what\'s happening today.' : 'Select an app to get started.'}
                    </p>
                </div>
            </motion.div>
            
            <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6 pb-10"
                initial="hidden"
                animate="show"
                variants={{
                    hidden: { opacity: 0 },
                    show: {
                        opacity: 1,
                        transition: {
                            staggerChildren: 0.08
                        }
                    }
                }}
            >
                {apps.map((app) => (
                    <motion.button
                        key={app.id}
                        variants={{
                            hidden: { opacity: 0, y: 20 },
                            show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                        }}
                        whileHover={{ y: -4, scale: 0.99, transition: { duration: 0.2 } }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onNavigate(app.id as View)}
                        className={`flex flex-col ${app.id === 'explore' && user && exploreArticles.length > 0 ? 'p-0' : 'p-6'} bg-white dark:bg-[#050505] rounded-[2rem] shadow-sm border border-neutral-200/60 dark:border-white/5 hover:shadow-xl transition-[box-shadow] duration-300 group relative overflow-hidden text-left h-auto min-h-[14rem] sm:h-56 w-full cursor-pointer focus:outline-none`}
                    >
                        {/* Animated Gradient Background on Hover */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${app.bg.replace('bg-', 'from-').split(' ')[0]} to-transparent opacity-0 group-hover:opacity-10 dark:group-hover:opacity-10 transition-opacity duration-300`} />
                        
                        {/* Top Right Decorative Element */}
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${app.bg.replace('bg-', 'from-').split(' ')[0]} to-transparent opacity-10 dark:opacity-5 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 ease-out group-hover:scale-[1.5] group-hover:rotate-12`} />
                        
                        {/* Hover Arrow Action */}
                        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-[opacity,transform] duration-300 origin-top-right">
                            <div className="p-2 rounded-full bg-white/80 dark:bg-black/80 border border-white/20 dark:border-white/10 text-neutral-800 dark:text-white shadow-sm">
                                <ArrowUpRight className="w-4 h-4" />
                            </div>
                        </div>

                        {/* Card Content */}
                        <div className="relative z-10 w-full h-full">
                            {renderCardContent(app)}
                        </div>
                    </motion.button>
                ))}
            </motion.div>

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
