import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, Info, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Tell TypeScript that __BUILD_ID__ is injected by Vite at compile time
declare const __BUILD_ID__: string;

export const VersionUpdateModal: React.FC = () => {
    // 1. Instantly check if we are in development environment (Localhost or dev flag)
    const isDevMode = 
        import.meta.env.DEV || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('ais-dev'); // Skip on dev container previews too

    const [hasUpdate, setHasUpdate] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Read compiled build ID of the running client
    const clientBuildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

    const checkForUpdates = useCallback(async () => {
        // Prevent executing any network requests if in development mode
        if (isDevMode) return;

        try {
            // Fetch version check api with current version as parameter
            const response = await fetch(`/api/version-control?currentVersion=${clientBuildId}&t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (!response.ok) return;

            const data = await response.json();
            if (data?.hasUpdate) {
                setHasUpdate(true);
                console.log(`[Version Update] ${data.message}`);
            }
        } catch (error) {
            console.debug('[Update Checker] Error checking for version updates:', error);
        }
    }, [clientBuildId, isDevMode]);

    useEffect(() => {
        // Stop entirely in development mode
        if (isDevMode) return;

        // Run instantly on initial load
        checkForUpdates();

        // Periodically check every 60 seconds
        checkIntervalRef.current = setInterval(() => {
            checkForUpdates();
        }, 60000);

        // Instantly check when window is focused or tab becomes visible again
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checkForUpdates, isDevMode]);

    const handleUpdate = async () => {
        // Safe, clean reload by clearing cache and appending a unique timestamp.
        // This forces the browser to pull the absolute latest build directly from the network.
        try {
            // 1. Clear Cache Storage to purge old index.html and assets
            if (typeof window !== 'undefined' && 'caches' in window) {
                try {
                    const cacheNames = await window.caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => window.caches.delete(cacheName))
                    );
                    console.log('[Version Update] Cleared Cache Storage successfully.');
                } catch (e) {
                    console.debug('[Version Update] Error clearing Cache Storage:', e);
                }
            }

            // 2. Unregister Service Workers to guarantee bypass of old sw intercepts
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(
                        registrations.map(reg => reg.unregister())
                    );
                    console.log('[Version Update] Unregistered Service Workers successfully.');
                } catch (e) {
                    console.debug('[Version Update] Error unregistering service workers:', e);
                }
            }

            // 3. Clear session storage flags if any, and perform hard reload
            const targetUrl = new URL(window.location.href);
            targetUrl.searchParams.set('v', Date.now().toString());
            window.location.replace(targetUrl.toString());
        } catch (error) {
            console.error('[Version Update] Reload fallback error:', error);
            window.location.reload();
        }
    };

    // Return absolutely nothing in dev mode or if update is not visible/not triggered
    if (isDevMode || !hasUpdate || !isVisible) return null;

    return (
        <AnimatePresence>
            <div className="fixed bottom-6 right-6 z-[10000] w-full max-w-xs px-4 sm:px-0 pointer-events-none">
                {/* Compact Elegant Toast */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="w-full overflow-hidden rounded-xl border p-3 flex flex-col gap-2.5 text-left shadow-md pointer-events-auto backdrop-blur-md"
                    style={{
                        backgroundColor: 'var(--update-popup-bg)',
                        borderColor: 'var(--update-popup-border)',
                        color: 'var(--update-popup-text)',
                        boxShadow: 'var(--update-popup-glow)',
                    }}
                >
                    {/* Upper row: compact text + dismiss button */}
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex gap-2">
                            <div className="space-y-0.5">
                                <h4 className="text-xs font-bold tracking-tight">New Version Ready</h4>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--update-popup-text-muted)' }}>
                                    Reload to apply the latest features and updates.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="p-1 rounded-full hover:bg-neutral-500/10 transition-colors flex-shrink-0"
                            style={{ color: 'var(--update-popup-text-muted)' }}
                            title="Dismiss"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Compact actions row */}
                    <div className="flex items-center gap-1.5 justify-end">
                        <button
                            onClick={() => setIsVisible(false)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold hover:bg-neutral-500/5 transition-colors focus:outline-none"
                            style={{ color: 'var(--update-popup-text-muted)' }}
                        >
                            Later
                        </button>
                        <button
                            onClick={handleUpdate}
                            className="px-2.5 py-1 rounded-md font-bold text-[11px] shadow-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-1 focus:outline-none"
                            style={{ 
                                backgroundColor: 'var(--update-popup-btn-bg)', 
                                color: 'var(--update-popup-btn-text)' 
                            }}
                        >
                            <span>Reload</span>
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
