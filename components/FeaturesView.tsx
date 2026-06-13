
import React, { useState, useRef } from 'react';
import { 
    ChevronDown, ChevronRight, Zap, Globe, BrainCircuit, Mic, 
    Wallet, StickyNote, Languages, Code, Settings, Image as ImageIcon, 
    Layers, Cpu, Shield, Terminal, Database,
    Layout, FileText, Music, Sparkles, TrendingUp, Calendar, FlaskConical
} from 'lucide-react';
import metadata from '../metadata.json';
import packageInfo from '../package.json';
import { View } from '../types';

interface FeaturesViewProps {
    onNavigate: (view: View) => void;
}

interface SubFeature {
    id: string;
    label: string;
    description: string;
    techSpec?: string;
    icon?: React.ElementType;
}

interface FeatureSection {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    subFeatures: SubFeature[];
}

const featuresData: FeatureSection[] = [
    {
        id: 'core',
        label: 'System Core',
        icon: Layout,
        description: 'The operating system for your personal life. Fast, private, and integrated.',
        subFeatures: [
            {
                id: 'dashboard',
                label: 'Dynamic Dashboard',
                description: 'A centralized hub for all your tools. The home view adapts to your usage, providing at-a-glance snapshots of your digital life. From your latest chemical compound discovery and translation stats to recent notes and financial overviews, everything is accessible from a single, beautiful grid.',
                techSpec: 'Grid-based layout with responsive cards that fetch and display dynamic summaries from Supabase and local storage. Features adaptive dark mode styling and animated entry effects.',
                icon: Layers
            },
            {
                id: 'privacy',
                label: 'Local-First Architecture',
                description: 'Your data belongs to you. The application is built with a local-first philosophy. Authentication is optional, and for anonymous users, data is stored locally in your browser. For logged-in users, strict Row Level Security (RLS) applies.',
                techSpec: 'Implements rigorous RLS policies on Supabase. API keys are stored in local storage and never transmitted to our servers.',
                icon: Shield
            },
            {
                id: 'multi-modal',
                label: 'Universal File Handling',
                description: 'Drag and drop support for images and documents across the entire suite. Whether attaching receipts to expenses, diagrams to notes, or analyzing chemistry snapshots, the system handles your files seamlessly.',
                techSpec: 'Client-side compression runs immediately upon upload. Files are converted to Base64 inline data or stored in Supabase Storage buckets depending on the context.',
                icon: ImageIcon
            }
        ]
    },
    {
        id: 'finance-suite',
        label: 'Finance & Productivity',
        icon: Wallet,
        description: 'Comprehensive tools for managing your personal economy and daily tasks.',
        subFeatures: [
            {
                id: 'finance-tracker',
                label: 'Financial Intelligence',
                description: 'Take control of your money with advanced expense tracking and budget management. The "Financial Fitness" card analyzes your spending habits against your budget, providing a daily safe spend limit and visual pacing indicators to keep you on track.',
                techSpec: 'Real-time aggregation of transaction data stored in Supabase. Calculates daily averages, remaining budget, and burn rate using client-side logic for instant feedback.',
                icon: TrendingUp
            },
            {
                id: 'daily-khata',
                label: 'Daily Khata Ledger',
                description: 'A digital ledger for your day-to-day accounts. Track due amounts, record payments, and monitor your debt clearance progress with intuitive visual bars. Perfect for managing informal loans, daily expenses, or small business accounts.',
                techSpec: 'Dedicated "dairy" table in the database tracks entries and payments. The UI computes total due vs. paid in real-time to render progress visualizations.',
                icon: Calendar
            },
            {
                id: 'smart-notes',
                label: 'Rich Text Notes',
                description: 'Capture your thoughts instantly. The integrated Notes app supports Markdown formatting, code blocks, and organization. It\'s the perfect place to jot down ideas, draft content, or save important information.',
                techSpec: 'Uses a custom Markdown parser with syntax highlighting. Notes are indexed for instant search and can be categorized with tags.',
                icon: StickyNote
            }
        ]
    },
    {
        id: 'knowledge-tools',
        label: 'Knowledge & Utilities',
        icon: BrainCircuit,
        description: 'Specialized tools for learning, exploring, and creating.',
        subFeatures: [
            {
                id: 'news-feed',
                label: 'Curated News Feed',
                description: 'Stay updated with the "Explore" feature. The system curates the latest articles and headlines based on your interests, allowing you to read summaries or dive deep into sources without leaving the app.',
                techSpec: 'Integrates with news APIs to fetch real-time content. Articles are presented in a clean, card-based feed with source attribution and "Read Mode" for distraction-free consumption.',
                icon: Globe
            },
            {
                id: 'molecule-viewer',
                label: 'Interactive 3D Chemistry',
                description: 'A specialized tool for students and scientists. Visualize chemical compounds in interactive 3D. The dashboard even features a blurred "visual snapshot" of your last viewed molecule, creating a beautiful and informative entry point back into your research.',
                techSpec: 'Fetches crystallographic data from PubChem. Renders 3D ball-and-stick models using WebGL/Three.js. Dashboard card uses CSS filters for the blurred snapshot effect.',
                icon: FlaskConical
            },
            {
                id: 'translator',
                label: 'Smart Translator',
                description: 'Break down language barriers. The translator tool not only converts text but tracks your usage stats. View your lifetime character input/output counts directly on the home screen with a visual progress indicator.',
                techSpec: 'Uses advanced translation models for high-accuracy results. Usage metrics are persisted to the user profile and visualized with SVG charts.',
                icon: Languages
            }
        ]
    },
    {
        id: 'voice-assistant',
        label: 'Voice Control',
        icon: Mic,
        description: 'Hands-free interaction and voice memos.',
        subFeatures: [
            {
                id: 'live-voice',
                label: 'Voice Commands & Dictation',
                description: 'Control your apps and dictate notes with your voice. The system understands natural language commands for hands-free operation, making multitasking effortless.',
                techSpec: 'Establishes a WebSocket connection for low-latency audio streaming. Handles raw PCM audio streams for high-fidelity communication.',
                icon: Zap
            },
            {
                id: 'voice-history',
                label: 'Voice Memos & History',
                description: 'Access your voice logs anytime. All voice interactions are saved as memos for easy playback and reference, ensuring you never lose a thought.',
                techSpec: 'Audio blobs are stored in Supabase Storage, with metadata and transcripts saved to the database. Custom audio player with waveform visualization.',
                icon: Music
            },
            {
                id: 'personas',
                label: 'Voice Settings',
                description: 'Select your preferred voice for system feedback and interactions.',
                techSpec: 'Manages voice synthesis configuration parameters dynamically based on user settings.',
                icon: Settings
            }
        ]
    }
];

const FeaturesView: React.FC<FeaturesViewProps> = ({ onNavigate }) => {
    const [isTocOpen, setIsTocOpen] = useState(false);
    const [expandedTocSections, setExpandedTocSections] = useState<Set<string>>(new Set());

    const scrollToId = (id: string) => {
        setIsTocOpen(false); // Close TOC on selection
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Add a highlight flash effect
                element.classList.add('bg-amber-50/50', 'dark:bg-amber-900/10', 'transition-colors', 'duration-1000');
                setTimeout(() => element.classList.remove('bg-amber-50/50', 'dark:bg-amber-900/10'), 2000);
            }
        }, 350);
    };

    const toggleTocSection = (sectionId: string) => {
        setExpandedTocSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    return (
        <main className="relative z-10 h-full overflow-y-auto bg-transparent scrollbar-hide pt-16 md:pt-24 px-4 md:px-6 pb-6">
            <div className="w-full max-w-none mx-auto">
                
                {/* --- HEADER --- */}
                <div className="mb-2 border-b border-neutral-200 dark:border-neutral-800 pb-4 mt-6">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">
                            SYSTEM CAPABILITIES
                        </span>
                    </div>
                    
                    <h1 className="text-3xl md:text-5xl font-serif font-medium text-neutral-900 dark:text-white leading-[1.1] tracking-tight mb-3">
                        Engineered for <br/>
                        <span className="italic text-neutral-500 dark:text-neutral-400">Deep Context.</span>
                    </h1>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 font-sans max-w-2xl leading-relaxed">
                        A comprehensive breakdown of the intelligent systems, rendering engines, and agentic workflows that power the Ceaznet ecosystem.
                    </p>
                </div>

                {/* --- ACCORDION TOC --- */}
                <div className="mb-12">
                    <button 
                        onClick={() => setIsTocOpen(!isTocOpen)}
                        className="w-full flex items-center justify-between py-2 group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors px-1 rounded-lg"
                    >
                        <span className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                            Index of Features
                        </span>
                        {isTocOpen ? (
                            <ChevronDown className="w-4 h-4 text-neutral-500" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-neutral-500" />
                        )}
                    </button>

                    <div 
                        className={`overflow-hidden transition-all duration-500 ease-in-out ${isTocOpen ? 'max-h-[1200px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
                    >
                        <nav className="pl-4 border-l border-amber-500 space-y-4">
                            {featuresData.map((section) => {
                                const isExpanded = expandedTocSections.has(section.id);
                                return (
                                    <div key={section.id} className="transition-all">
                                        <button
                                            onClick={() => toggleTocSection(section.id)}
                                            className="w-full text-left text-sm font-bold text-neutral-800 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors mb-2 flex items-center gap-2 group"
                                        >
                                            <section.icon className="w-3.5 h-3.5 opacity-50 group-hover:text-amber-600 group-hover:opacity-100 transition-all" />
                                            <span className="flex-1">{section.label}</span>
                                            {isExpanded ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                                            )}
                                        </button>
                                        
                                        <div 
                                            className={`pl-6 flex flex-col gap-1.5 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                                        >
                                            {section.subFeatures.map((sub) => (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => scrollToId(sub.id)}
                                                    className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors py-1 border-l border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 pl-3 -ml-3"
                                                >
                                                    {sub.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* --- SECTIONS --- */}
                <div className="space-y-12">
                    {featuresData.map((section) => (
                        <section key={section.id} id={section.id} className="scroll-mt-48">
                            {/* Section Header */}
                            <div className="flex items-start gap-3 mb-6">
                                <div className="mt-0.5 p-2 rounded-xl bg-neutral-100 dark:bg-white/5 text-neutral-900 dark:text-white">
                                    <section.icon className="w-5 h-5 stroke-1" />
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white mb-1">
                                        {section.label}
                                    </h2>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-3xl leading-relaxed">
                                        {section.description}
                                    </p>
                                </div>
                            </div>

                            {/* Features List (Timeline Style) */}
                            <div className="relative ml-2.5 md:ml-3.5">
                                {/* The Continuous Vertical Line */}
                                <div className="absolute left-0 top-2 bottom-0 w-px bg-neutral-200 dark:bg-neutral-800" />

                                <div className="space-y-12">
                                    {section.subFeatures.map((feature) => (
                                        <div 
                                            key={feature.id} 
                                            id={feature.id}
                                            className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors"
                                        >
                                            {/* Timeline Dot */}
                                            <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                                            <div className="flex items-center gap-2 mb-2 pt-1.5">
                                                {feature.icon && <feature.icon className="w-4 h-4 text-amber-600 dark:text-amber-500" />}
                                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                                                    {feature.label}
                                                </h3>
                                            </div>
                                            
                                            <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                                                <p className="mb-4">
                                                    {feature.description}
                                                </p>
                                            </div>

                                            {/* Technical Spec */}
                                            {feature.techSpec && (
                                                <div className="mt-4 p-3 bg-neutral-50 dark:bg-white/5 border-l-2 border-indigo-500 rounded-r-md w-full">
                                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1.5">
                                                        <Terminal className="w-3 h-3" /> Technical Implementation
                                                    </h4>
                                                    <p className="text-xs font-mono text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                                        {feature.techSpec}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800 text-center text-neutral-500 dark:text-neutral-500 text-xs pb-2">
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
                </div>
            </div>
        </main>
    );
};

export default FeaturesView;
