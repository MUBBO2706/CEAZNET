import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Tell TypeScript that __BUILD_ID__ is injected by Vite at compile time
declare const __BUILD_ID__: string;

const isDevelopmentEnvironment = (): boolean => {
    // 1. Check Vite standard dev flag
    if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
        return true;
    }
    // 2. Check Build ID
    if (typeof __BUILD_ID__ !== 'undefined' && __BUILD_ID__ === 'dev') {
        return true;
    }
    // 3. Check dev hostnames
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.includes('ais-dev-') ||
            hostname.startsWith('dev.')
        ) {
            return true;
        }
    }
    return false;
};

const playUpdateSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        
        const now = ctx.currentTime;
        
        // First chime (A5 - 880 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.4);

        // Second chime (C#6 - 1109.73 Hz) slightly delayed
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1109.73, now + 0.1);
        gain2.gain.setValueAtTime(0.15, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.5);
    } catch (e) {
        console.debug('[Audio Tune Error]:', e);
    }
};

export const VersionUpdateModal: React.FC = () => {
    // Completely disable in development environments
    const isDev = isDevelopmentEnvironment();

    const [hasUpdate, setHasUpdate] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const initialVersionRef = useRef<string | null>(
        typeof __BUILD_ID__ !== 'undefined' && __BUILD_ID__ !== 'dev' ? __BUILD_ID__ : null
    );
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Play a notification sound once the update modal is triggered
    useEffect(() => {
        if (hasUpdate && isVisible && !isDev) {
            playUpdateSound();
        }
    }, [hasUpdate, isVisible, isDev]);

    const checkForUpdates = useCallback(async () => {
        if (isDev) return;

        try {
            // Check 1: Direct fetch to static version.json (Fastest, zero serverless latency, works on Vercel CDN/Vite)
            try {
                const staticRes = await fetch(`/version.json?t=${Date.now()}`, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });

                if (staticRes.ok) {
                    const staticData = await staticRes.json();
                    const serverVer = staticData?.version;

                    if (serverVer && serverVer !== 'dev' && serverVer !== 'unknown') {
                        if (!initialVersionRef.current) {
                            initialVersionRef.current = String(serverVer);
                        } else if (String(serverVer) !== String(initialVersionRef.current)) {
                            console.log(`[Version Update] Direct version mismatch detected: Client=${initialVersionRef.current} -> Server=${serverVer}`);
                            setHasUpdate(true);
                            return;
                        }
                    }
                }
            } catch (staticErr) {
                console.debug('[Update Checker] Direct version.json check error:', staticErr);
            }

            // Check 2: Version Control API endpoint
            const currentVerParam = initialVersionRef.current || (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown');
            const response = await fetch(`/api/version-control?currentVersion=${encodeURIComponent(currentVerParam)}&t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data?.hasUpdate) {
                    console.log(`[Version Update] API update detected: ${data.message}`);
                    setHasUpdate(true);
                } else if (data?.serverVersion && data.serverVersion !== 'unknown' && data.serverVersion !== 'dev') {
                    if (!initialVersionRef.current) {
                        initialVersionRef.current = String(data.serverVersion);
                    } else if (String(data.serverVersion) !== String(initialVersionRef.current)) {
                        console.log(`[Version Update] Server version difference detected: ${initialVersionRef.current} vs ${data.serverVersion}`);
                        setHasUpdate(true);
                    }
                }
            }
        } catch (error) {
            console.debug('[Update Checker] Error checking for version updates:', error);
        }
    }, [isDev]);

    useEffect(() => {
        if (isDev) return;

        // Run check on initial load
        checkForUpdates();

        // Periodically check every 45 seconds
        checkIntervalRef.current = setInterval(() => {
            checkForUpdates();
        }, 45000);

        // Check when window or tab gains focus/visibility
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates();
            }
        };
        const handleFocus = () => {
            checkForUpdates();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        // Service Worker Update Listener (PWA) in production
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('[Service Worker] New content is available; please refresh.');
                                setHasUpdate(true);
                                setIsVisible(true);
                            }
                        });
                    }
                });
            }).catch(() => {});
        }

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [checkForUpdates, isDev]);

    const handleUpdate = async () => {
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

            // 3. Perform hard reload with cache-busting timestamp
            const targetUrl = new URL(window.location.href);
            targetUrl.searchParams.set('v', Date.now().toString());
            window.location.replace(targetUrl.toString());
        } catch (error) {
            console.error('[Version Update] Reload fallback error:', error);
            window.location.reload();
        }
    };

    // If running in development, do not render or run anything
    if (isDev || !hasUpdate || !isVisible) return null;

    return (
        <AnimatePresence>
            <div id="version-update-popup-container" className="fixed bottom-6 right-6 z-[10000] w-full max-w-xs px-4 sm:px-0 pointer-events-none">
                {/* Compact Elegant Toast */}
                <motion.div
                    id="version-update-card"
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
                    {/* Upper row: compact text */}
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex gap-2">
                            <div className="space-y-0.5">
                                <h4 id="version-update-title" className="text-xs font-bold tracking-tight">New Version Ready</h4>
                                <p id="version-update-description" className="text-[11px] leading-relaxed" style={{ color: 'var(--update-popup-text-muted)' }}>
                                    Reload to apply the latest features and updates.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Compact actions row */}
                    <div className="flex items-center gap-1.5 justify-end">
                        <button
                            id="version-update-later-btn"
                            onClick={() => setIsVisible(false)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold hover:bg-neutral-500/5 transition-colors focus:outline-none cursor-pointer"
                            style={{ color: 'var(--update-popup-text-muted)' }}
                        >
                            Later
                        </button>
                        <button
                            id="version-update-reload-btn"
                            onClick={handleUpdate}
                            className="px-2.5 py-1 rounded-md font-bold text-[11px] shadow-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-1 focus:outline-none cursor-pointer"
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
