
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Layers, Cpu, Database, Mic, Shield, Zap, BrainCircuit, Palette } from 'lucide-react';
import metadata from '../metadata.json';
import packageInfo from '../package.json';
import { View } from '../types';

interface AboutViewProps {
    onNavigate: (view: View) => void;
}

const sections = [
    { id: 'philosophy', label: 'The Philosophy', icon: BookOpen },
    { id: 'architecture', label: 'System Architecture', icon: Layers },
    { id: 'design', label: 'Design System', icon: Palette },
    { id: 'voice', label: 'Real-time Voice', icon: Mic },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield }
];

const AboutView: React.FC<AboutViewProps> = ({ onNavigate }) => {
    const [isTocOpen, setIsTocOpen] = useState(false);

    const scrollToSection = (id: string) => {
        setIsTocOpen(false);
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Highlight text instead of background
                const textElements = element.querySelectorAll('h2, h3, p, li, span, strong');
                textElements.forEach(el => {
                    el.classList.add('!text-amber-600', 'dark:!text-amber-400', 'transition-colors', 'duration-1000');
                });
                
                setTimeout(() => {
                    textElements.forEach(el => {
                        el.classList.remove('!text-amber-600', 'dark:!text-amber-400');
                    });
                }, 2000);
            }
        }, 350);
    };

    return (
        <main className="relative z-10 h-full overflow-y-auto bg-transparent scrollbar-hide pt-16 md:pt-24 px-4 md:px-6 pb-6 dev-console-spacing-pb">
            <div className="w-full max-w-none mx-auto">
                
                {/* --- HEADER --- */}
                <div className="mb-2 border-b border-neutral-200 dark:border-neutral-800 pb-4 mt-6">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">
                            TECHNICAL WHITE PAPER
                        </span>
                    </div>
                    
                    <h1 className="text-3xl md:text-5xl font-serif font-medium text-neutral-900 dark:text-white leading-[1.1] tracking-tight mb-3">
                        Ceaznet: Engineered for <br/>
                        <span className="italic text-neutral-500 dark:text-neutral-400">Digital Convergence.</span>
                    </h1>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 font-sans max-w-2xl leading-relaxed">
                        A deep dive into the architecture, design philosophy, and privacy standards behind the system.
                    </p>
                </div>

                {/* --- ACCORDION TOC --- */}
                <div className="mb-2">
                    <button 
                        onClick={() => setIsTocOpen(!isTocOpen)}
                        className="w-full flex items-center justify-between py-2 group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors px-1 rounded-lg"
                    >
                        <span className="text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                            Table of Contents
                        </span>
                        {isTocOpen ? (
                            <ChevronDown className="w-4 h-4 text-neutral-500" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-neutral-500" />
                        )}
                    </button>

                    <div 
                        className={`overflow-hidden transition-all duration-500 ease-in-out ${isTocOpen ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
                    >
                        <nav className="pl-4 border-l border-amber-500 flex flex-col gap-1">
                            {sections.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToSection(item.id)}
                                    className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors py-1 pl-3 -ml-3 flex items-center gap-2"
                                >
                                    <item.icon className="w-3 h-3 opacity-70" />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* --- CONTENT TIMELINE --- */}
                <div className="relative ml-2.5 md:ml-3.5 space-y-2 mt-4">
                    {/* The Continuous Vertical Line */}
                    <div className="absolute left-0 top-2 bottom-0 w-px bg-neutral-200 dark:bg-neutral-800" />

                    {/* 1. Philosophy */}
                    <section id="philosophy" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        {/* Dot: Matched border color to App background (#F9F6F2 / #191B1A), Adjusted left/top for perfect centering */}
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />
                        
                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">The Integrated Life</h2>
                        </div>
                        
                        <div className="prose prose-sm dark:prose-invert max-w-none text-neutral-600 dark:text-neutral-300 leading-relaxed">
                            <p className="mb-2">
                                Modern digital life is fragmented across dozens of apps. Ceaznet brings your essential tools—finance, knowledge, and productivity—into a single, cohesive interface.
                            </p>
                            <p>
                                By prioritizing <strong>speed</strong>, <strong>simplicity</strong>, and <strong>integration</strong>, we've created a dashboard that respects your time and attention. It's not just an app; it's a personal operating system for your daily needs.
                            </p>
                        </div>
                    </section>

                    {/* 2. Architecture */}
                    <section id="architecture" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Technical Architecture</h2>
                        </div>
                        
                        <div className="prose prose-sm dark:prose-invert max-w-none text-neutral-600 dark:text-neutral-300 leading-relaxed mb-4">
                            <p>
                                Ceaznet is built on a hybrid architecture that leverages client-side performance for immediate interactivity and server-side Edge Functions for data persistence.
                            </p>
                        </div>

                        {/* Unboxed Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div>
                                <h3 className="font-bold text-neutral-900 dark:text-white mb-1 text-xs uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-800 pb-1 inline-block">Frontend Core</h3>
                                <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 mt-1">
                                    <li className="flex gap-2"> React 19 concurrent rendering</li>
                                    <li className="flex gap-2"> Tailwind CSS for utility styling</li>
                                    <li className="flex gap-2"> IndexedDB for local-first state</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-bold text-neutral-900 dark:text-white mb-1 text-xs uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-800 pb-1 inline-block">Serverless Edge</h3>
                                <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 mt-1">
                                    <li className="flex gap-2"> Supabase Auth & Database</li>
                                    <li className="flex gap-2"> Deno Edge Functions</li>
                                    <li className="flex gap-2"> Real-time Sync</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 3. Design System */}
                    <section id="design" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Palette className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Design System</h2>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">01.</span> Adaptive Theming
                                </h4>
                                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6 border-l border-neutral-200 dark:border-neutral-800 ml-1.5">
                                    The interface respects your system preferences, offering a carefully calibrated dark mode that reduces eye strain without sacrificing contrast.
                                </p>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">02.</span> Motion Design
                                </h4>
                                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6 border-l border-neutral-200 dark:border-neutral-800 ml-1.5">
                                    Every interaction is animated. From card entries to page transitions, motion is used to provide context and spatial awareness, making the app feel alive.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 4. Voice */}
                    <section id="voice" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Mic className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Multimodal Voice</h2>
                        </div>
                        
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-3">
                            We believe the future of interaction isn't just typing; it's speaking. Ceaznet leverages advanced voice models for low-latency, full-duplex conversations.
                        </p>

                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                            <span className="border-b border-neutral-300 dark:border-neutral-700">24kHz Sample</span>
                            <span className="border-b border-neutral-300 dark:border-neutral-700">&lt;500ms Latency</span>
                            <span className="border-b border-neutral-300 dark:border-neutral-700">PCM Stream</span>
                        </div>
                    </section>

                    {/* 5. Privacy */}
                    <section id="privacy" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Private by Default</h2>
                        </div>
                        
                        <div className="prose prose-sm dark:prose-invert max-w-none text-neutral-600 dark:text-neutral-300 leading-relaxed">
                            <p>
                                Your trust is our currency. Data is stored securely using Supabase's enterprise-grade encryption and Row Level Security (RLS). You retain complete control over your data.
                            </p>
                        </div>
                    </section>
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

export default AboutView;
