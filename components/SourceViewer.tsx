
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { GroundingChunk } from '../types';
import { useDraggableSheet } from '../hooks/useDraggableSheet';
import { X, ExternalLink, Globe, Link as LinkIcon, ArrowUpRight, ChevronRight } from 'lucide-react';

interface SourceViewerProps {
    sources: GroundingChunk[];
    onClose: () => void;
}

interface ProcessedSource {
    uri: string;
    title: string;
    favicon?: string;
}

const SourceViewer: React.FC<SourceViewerProps> = ({ sources, onClose }) => {
    const sheetRef = useRef<HTMLDivElement>(null);
    const [isMounted, setIsMounted] = useState(false);
    const { sheetStyle, handleRef } = useDraggableSheet(sheetRef, onClose, isMounted);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const processedSources = useMemo((): ProcessedSource[] => {
        const sourceMap = new Map<string, ProcessedSource>();
        
        sources.forEach(source => {
            if (!source.web) return;
            const { uri, title } = source.web;
            if (!uri) return;

            // Key by both URI and title to ensure uniqueness
            const uniqueKey = `${uri}|${title}`;

            if (!sourceMap.has(uniqueKey)) {
                sourceMap.set(uniqueKey, { uri, title, favicon: source.favicon });
            }
        });

        return Array.from(sourceMap.values());
    }, [sources]);

    const isMobile = window.matchMedia("(max-width: 640px)").matches;

    // Helper to extract a readable site name from hostname (Indianexpress.com -> Indianexpress)
    const getSiteName = (hostname: string) => {
        const parts = hostname.split('.');
        let name = parts[0];
        if (name === 'www' && parts.length > 1) name = parts[1];
        
        // Fallback for short names or complex domains
        if (name.length < 3 && parts.length > 1 && parts[0] !== 'www') name = parts[0];
        
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    const content = (
        <div className="flex flex-col h-auto max-h-full bg-[#F9F9F9] dark:bg-[#121212] backdrop-blur-xl rounded-t-[2rem] rounded-b-none sm:rounded-[2rem] overflow-hidden border-t sm:border border-white/20 dark:border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            {/* Drag Handle (Mobile) */}
            <div ref={handleRef} className="w-full flex items-center justify-center pt-3 pb-1 sm:hidden cursor-grab active:cursor-grabbing flex-shrink-0">
                <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full"></div>
            </div>

            {/* Header */}
            <header className="relative px-6 py-5 flex items-center justify-between flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
                        Sources
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            {processedSources.length} CITATIONS
                        </span>
                        <p className="text-xs text-neutral-500 dark:text-neutral-500 font-medium">
                            Verified Web Links
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="group p-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white transition-all duration-200"
                    aria-label="Close"
                >
                    <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
                </button>
            </header>

            <div className="overflow-y-auto p-4 sm:px-6 scrollbar-hide min-h-0 bg-neutral-50/50 dark:bg-black/20">
                {processedSources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-neutral-400 dark:text-neutral-600 opacity-70">
                        <div className="p-4 bg-neutral-100 dark:bg-neutral-800/50 rounded-full mb-4">
                            <Globe className="h-8 w-8 stroke-[1.5]" />
                        </div>
                        <p className="text-sm font-medium">No external sources linked.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 pb-6">
                        {processedSources.map((source, index) => {
                             let hostname = source.uri ? new URL(source.uri).hostname.replace(/^www\./, '') : 'Unknown source';
                             const iconSrc = source.favicon || `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
                             
                             const isInternal = hostname.includes('vertex') || hostname.includes('google') || hostname.includes('cloud');
                             const siteName = getSiteName(hostname);
                             
                             // Logic: If title is missing OR looks like a domain/URL (contains dot and no spaces), use the clean siteName.
                             // This ensures "indianexpress.com" becomes "Indianexpress" in the title line.
                             let displayTitle = source.title;
                             
                             if (!displayTitle || displayTitle.trim() === "" || displayTitle.toLowerCase() === hostname.toLowerCase() || (displayTitle.includes('.') && !displayTitle.includes(' '))) {
                                 displayTitle = isInternal ? 'Web Source' : siteName;
                             }

                             return (
                                <a
                                    key={index}
                                    href={source.uri}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative flex items-start gap-4 p-4 bg-white dark:bg-[#1E1E1E] rounded-2xl border border-neutral-200/60 dark:border-neutral-800 hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-sm hover:shadow-lg transition-all duration-300 w-full"
                                >
                                    {/* Favicon Container */}
                                    <div className="flex-shrink-0 mt-1 w-10 h-10 rounded-xl bg-neutral-50 dark:bg-[#252525] flex items-center justify-center border border-neutral-100 dark:border-neutral-800 group-hover:scale-105 transition-transform duration-300 shadow-inner">
                                        <img 
                                            src={iconSrc} 
                                            alt="" 
                                            className="w-5 h-5 object-contain opacity-90 group-hover:opacity-100 transition-opacity"
                                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                        />
                                    </div>

                                    {/* Text Content */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                        {/* Line 1: Title (Name only, no .com) */}
                                        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                            {displayTitle}
                                        </h3>
                                        {/* Line 2: Subtitle (Hostname with .com) */}
                                        <div className="flex items-center gap-1.5">
                                            <Globe className="w-3 h-3 text-neutral-400" />
                                            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-500 truncate font-mono">
                                                {hostname}
                                            </span>
                                        </div>
                                    </div>

                                    {/* External Link Icon (Right Side) */}
                                    <div className="flex-shrink-0 self-center text-neutral-300 dark:text-neutral-600 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </a>
                             )
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <>
                <div
                    className={`fixed inset-0 bg-black/60 z-[60] transition-opacity duration-300 backdrop-blur-sm ${isMounted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={onClose}
                    aria-hidden="true"
                ></div>
                <div
                    ref={sheetRef}
                    className={`fixed bottom-0 left-0 right-0 z-[70] transition-transform duration-300 ease-out ${
                        isMounted ? 'translate-y-0' : 'translate-y-full'
                    } h-auto max-h-[85dvh] flex flex-col rounded-t-[2rem] overflow-hidden shadow-2xl`}
                    style={isMounted ? sheetStyle : {}}
                    role="dialog"
                    aria-modal="true"
                >
                    {content}
                </div>
            </>
        );
    }

    return (
        <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-6 transition-opacity duration-300 ${isMounted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div
                className={`w-full max-w-2xl h-auto max-h-[85vh] transform transition-all duration-300 ${isMounted ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'} shadow-2xl rounded-[2rem] overflow-hidden flex flex-col`}
                role="dialog"
                onClick={(e) => e.stopPropagation()}
            >
                {content}
            </div>
        </div>
    );
};

export default SourceViewer;
