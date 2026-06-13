import React, { useState } from 'react';
import { FileText, AlertTriangle, Scale, ShieldCheck, ChevronDown, ChevronRight, Activity, Terminal } from 'lucide-react';
import metadata from '../../metadata.json';
import packageInfo from '../../package.json';
import { View } from '../types';

interface TermsOfServiceViewProps {
    onNavigate: (view: View) => void;
}

const sections = [
    { id: 'acceptance', label: 'Acceptance of Terms', icon: FileText },
    { id: 'accounts', label: 'User Accounts & Authentication', icon: ShieldCheck },
    { id: 'rules', label: 'Platform Rules & Conduct', icon: Activity },
    { id: 'acceptable-use', label: 'Acceptable Use Policy', icon: Scale },
    { id: 'intellectual', label: 'Intellectual Property', icon: Terminal },
    { id: 'liability', label: 'Limitation of Liability', icon: AlertTriangle }
];

const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onNavigate }) => {
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
                        <span className="italic text-neutral-500 dark:text-neutral-400">Terms of Service.</span>
                    </h1>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 font-sans max-w-2xl leading-relaxed">
                        Effective Date: May 6, 2026 &mdash; The rules, guidelines, and binding agreements for using the platform.
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
                    <section id="acceptance" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />
                        
                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Acceptance of Terms</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                By accessing or logging into Ceaznet, you enter into a binding agreement and affirmatively agree to these Terms of Service. This document governs your usage of the platform, the integrated datasets, intelligent agents, and any backend services provided.
                            </p>
                            <p>
                                If you do not agree with any subset or whole of these terms, your sole remedy is to discontinue your usage of Ceaznet entirely. We reserve the authority to update these terms at our discretion, enforcing updates prospectively.
                            </p>
                        </div>
                    </section>

                    {/* Section 2 */}
                    <section id="accounts" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">User Accounts & Authentication</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                When creating a user identity using external providers (such as Google OAuth) on Ceaznet, you accept total responsibility for the activity undertaken under your authenticated session.
                            </p>
                            <ul className="list-disc pl-4 space-y-2 mt-2">
                                <li>You agree to provide true, accurate, and contemporary information associated with your account identity.</li>
                                <li>You are explicitly forbidden from delegating, transferring, or selling your digital account rights to any unauthorized third party.</li>
                                <li>We reserve the right to irrevocably suspend any account that poses a security threat or repeatedly violates our community conduct policies.</li>
                            </ul>
                        </div>
                    </section>
                    
                    {/* Section 3 */}
                    <section id="rules" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Activity className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Platform Rules & Conduct</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                The Ceaznet infrastructure exists to enhance your personal intelligence and operational capabilities. To maintain high availability bounds for all peers:
                            </p>
                            <ul className="list-disc pl-4 space-y-2 mt-2">
                                <li>Do not manipulate backend requests to artificially extract quota, bypass enforced API limits, or spam internal support streams.</li>
                                <li>Automated bots, scripts, scrapers, or other programmatic routines explicitly banned from interacting directly with our endpoint without a verified Developer token.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 4 */}
                    <section id="acceptable-use" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Scale className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Acceptable Use Policy</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>You agree not to configure or instruct the application tools to:</p>
                            <ul className="list-disc pl-4 space-y-2 mt-2">
                                <li>Violate any established local, state, national, or international statute bounding your jurisdiction.</li>
                                <li>Infringe systematically upon the intellectual property rights or private identities of third parties.</li>
                                <li>Circumvent or benchmark the security frameworks embedded into our underlying architecture.</li>
                                <li>Process, store, or transmit deeply harmful payloads (such as malware traces).</li>
                            </ul>
                        </div>
                    </section>
                    
                    {/* Section 5 */}
                    <section id="intellectual" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <Terminal className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Intellectual Property</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                Any content explicitly generated, authored, or formulated by you via our text pads, audio forms, and canvas layers belongs to you. You retain ownership over your explicit work product. However, Ceaznet's overarching layout, proprietary code, interface assets, and branding constitute the exclusive intellectual property of the developers and are heavily guarded.
                            </p>
                        </div>
                    </section>

                    {/* Section 6 */}
                    <section id="liability" className="relative pl-6 md:pl-8 scroll-mt-48 group rounded-xl p-2 -ml-2 transition-colors">
                        <div className="absolute left-[1.5px] top-3 w-3.5 h-3.5 rounded-full border-[3px] border-[#F9F6F2] dark:border-[#191B1A] bg-neutral-300 dark:bg-neutral-700 group-hover:bg-amber-500 transition-colors duration-500 z-10" />

                        <div className="flex items-center gap-2 mb-2 pt-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Limitation of Liability</h2>
                        </div>
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-4">
                            <p>
                                Ceaznet operates entirely "as is" and "as deployed" without explicit computational or legal warranties. We guarantee no uptime constraints and declare that service may be subjected to downtime.
                            </p>
                            <p>
                                In no legally recognizable event shall the creators, developers, or host nodes be held legally liable for secondary, incidental, or destructive damages deriving consequentially from system usage.
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

export default TermsOfServiceView;
