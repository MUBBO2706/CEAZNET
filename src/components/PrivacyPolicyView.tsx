import React, { useState } from 'react';
import { Shield, Lock, Eye, Server, RefreshCw, ChevronDown, ChevronRight, Activity, Database, Globe } from 'lucide-react';
import metadata from '../../metadata.json';
import packageInfo from '../../package.json';
import { View } from '../types';

interface PrivacyPolicyViewProps {
    onNavigate: (view: View) => void;
}

const sections = [
    { id: 'collection', label: 'Information We Collect', icon: Eye },
    { id: 'usage', label: 'How We Use Information', icon: Server },
    { id: 'storage', label: 'Information Sharing & Storage', icon: Shield },
    { id: 'cookies', label: 'Cookies & Tracking', icon: Activity },
    { id: 'security', label: 'Data Security Measures', icon: Database },
    { id: 'international', label: 'International Transfers', icon: Globe },
    { id: 'rights', label: 'Your Choices & Rights', icon: Lock },
    { id: 'changes', label: 'Changes to This Policy', icon: RefreshCw }
];

const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onNavigate }) => {
    const [isTocOpen, setIsTocOpen] = useState(false);

    const scrollToSection = (id: string) => {
        setIsTocOpen(false);
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Add highlight effect
                element.classList.add('bg-amber-50/50', 'dark:bg-amber-900/10', 'transition-colors', 'duration-1000');
                setTimeout(() => element.classList.remove('bg-amber-50/50', 'dark:bg-amber-900/10'), 2000);
            }
        }, 350);
    };

    return (
        <main className="relative z-10 h-full overflow-y-auto bg-transparent scrollbar-hide pt-16 md:pt-24 px-4 md:px-6 pb-6">
            <div className="w-full max-w-none mx-auto">
                {/* --- HEADER --- */}
                <div className="mb-2 border-b border-neutral-200 dark:border-neutral-800 pb-4 mt-6">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 dark:text-neutral-400 uppercase">
                            LEGAL & COMPLIANCE
                        </span>
                    </div>
                    
                    <h1 className="text-3xl md:text-5xl font-serif font-medium text-neutral-900 dark:text-white leading-[1.1] tracking-tight mb-3">
                        Ceaznet: Engineered for <br/>
                        <span className="italic text-neutral-500 dark:text-neutral-400">Privacy Policy.</span>
                    </h1>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 font-sans max-w-2xl leading-relaxed">
                        Effective Date: May 6, 2026 &mdash; How the system collects, uses, and protects your information.
                    </p>
                </div>

                {/* --- ACCORDION TOC --- */}
                <div className="mb-12">
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

                <div className="relative ml-2.5 md:ml-3.5 space-y-12 mt-8">
                    <div className="absolute left-0 top-2 bottom-0 w-px bg-neutral-200 dark:bg-neutral-800" />

                    {/* Section 1 */}
                    <section id="collection" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />
                        
                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Information We Collect</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                When you use Ceaznet, we collect information directly from you, as well as automatically through your use of our services. Our goal is to collect only what is necessary to provide a seamless and secure experience.
                            </p>
                            <ul className="list-disc pl-4 space-y-2 mt-2">
                                <li><strong>Account Information:</strong> When you register, we collect your name, profile picture, and email address (e.g., via Google OAuth) to manage your identity securely.</li>
                                <li><strong>Application Data:</strong> Any notes, financial logs, chemical analysis snapshots, and voice memos you create are safely persisted within our database infrastructure.</li>
                                <li><strong>Device & Usage Data:</strong> We automatically record your interactions, IP address, and browser specifics to maintain system health, deliver security updates, and analyze aggregated performance.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section id="usage" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Server className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">How We Use Information</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>Your data is processed strictly for the following operational objectives:</p>
                            <ul className="list-disc pl-4 space-y-2 mt-2">
                                <li><strong>Service Delivery:</strong> To operate, maintain, and provide the core functionalities of Ceaznet, including real-time synchronization and localized offline capabilities.</li>
                                <li><strong>Authentication & Security:</strong> To verify your identity, prevent unauthorized access to your account, and monitor against malicious activities across our platform.</li>
                                <li><strong>Support & Communication:</strong> To respond to your support tickets, provide troubleshooting updates, and inform you of major system changes or policies.</li>
                                <li><strong>System Optimization:</strong> To analyze behavioral usage patterns, measure service disruptions, and ultimately improve our backend rendering and retrieval mechanisms.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 3 */}
                    <section id="storage" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Information Sharing & Storage</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                We firmly believe that your private workspace belongs exclusively to you. We explicitly do not sell, rent, or trade your personal information with marketing partners or ad networks.
                            </p>
                            <p>
                                <strong>Third-Party Processors:</strong> We utilize trusted third-party infrastructure providers to support our operations. For instance, Supabase is employed for secure, edge-ready database management, where rigorous Row Level Security (RLS) ensures that database reads and writes are securely verified against your authentication token.
                            </p>
                            <p>
                                <strong>Legal Requirements:</strong> We may disclose information if required to do so by a legal summons or strict statutory duty, though we routinely contest broad or unwarranted requests to protect user boundaries.
                            </p>
                        </div>
                    </section>
                    
                    {/* Section 4 */}
                    <section id="cookies" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Activity className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Cookies & Tracking</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                We employ minimal tracking methodologies across Ceaznet. Tokens and identifiers generated by our system are strictly designated for maintaining your ongoing session and personalizing UI layouts.
                            </p>
                            <p>
                                We may use local storage, indexed database queries, and first-party cookies to remember your state. You can disable local tracking features via browser settings, but please note that this may result in core system features functioning incorrectly.
                            </p>
                        </div>
                    </section>

                    {/* Section 5 */}
                    <section id="rights" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Your Choices & Rights</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                We empower you with unconditional control over your own data footprint in compliance with modern standards (such as GDPR and CCPA considerations):
                            </p>
                            <ul className="list-disc pl-4 space-y-2 mt-2">
                                <li><strong>Access & Export:</strong> You can download a complete backup of everything you've created within Ceaznet directly via the Settings panel.</li>
                                <li><strong>Deletion:</strong> You hold the right to irretrievably delete your account, erasing all bound data from our active storage regions immediately.</li>
                                <li><strong>Revocation:</strong> You can retract our access to external sources (like Google) entirely from your local client settings.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 6 */}
                    <section id="changes" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Changes to This Policy</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                The digital landscape adapts, and our policies evolve in sync. We routinely review this architecture for compliance. When material changes are drafted, we will broadcast a system-wide notification so you can review the proposed changes before they take effect.
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

export default PrivacyPolicyView;

