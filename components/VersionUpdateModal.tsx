import { fetchApi } from "../utils/fetchApi";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AppIcon } from './core/AppIcon';
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
    // 3. Check dev and preview hostnames (localhost, 127.0.0.1, AI Studio workspace URLs)
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.includes('ais-dev-') ||
            hostname.includes('ais-pre-') ||
            hostname.includes('.run.app')
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
    const initialVersionRef = useRef<string | null>(null);
    const latestDetectedVersionRef = useRef<string | null>(null);
    const isFirstCheckRef = useRef<boolean>(true);
    const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastCheckTimeRef = useRef<number>(0);

    // Play a notification sound once the update modal is triggered
    useEffect(() => {
        if (hasUpdate && isVisible && !isDev) {
            playUpdateSound();
        }
    }, [hasUpdate, isVisible, isDev]);

    const checkForUpdates = useCallback(async (isManual = false) => {
        if (isDev) return;

        const now = Date.now();
        // Throttle automatic checks to at most once every 10 seconds
        if (!isManual && now - lastCheckTimeRef.current < 10000) {
            return;
        }
        lastCheckTimeRef.current = now;

        // Proactively trigger Service Worker update check on network
        if (swRegistrationRef.current) {
            try {
                swRegistrationRef.current.update().catch(() => {});
            } catch (swErr) {
                console.debug('[Version Update] swRegistration update check error:', swErr);
            }
        } else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            try {
                navigator.serviceWorker.getRegistration().then(reg => {
                    if (reg) {
                        swRegistrationRef.current = reg;
                        reg.update().catch(() => {});
                    }
                }).catch(() => {});
            } catch {}
        }

        let discoveredServerVersion: string | null = null;

        // 1. Channel A: Live Serverless / Backend Version Control API endpoint
        try {
            const currentVerParam = initialVersionRef.current || (typeof __BUILD_ID__ !== 'undefined' ? String(__BUILD_ID__) : 'unknown');
            const response = await fetchApi(`/api/version-control?currentVersion=${encodeURIComponent(currentVerParam)}&t=${Date.now()}`, {
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
                if (data?.serverVersion && data.serverVersion !== 'unknown' && data.serverVersion !== 'dev') {
                    discoveredServerVersion = String(data.serverVersion);
                }
            }
        } catch (error) {
            console.debug('[Update Checker] API version check error:', error);
        }

        // 2. Channel B: Static version.json served directly by CDN edge
        if (!discoveredServerVersion) {
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
                    if (staticData?.version && staticData.version !== 'unknown') {
                        discoveredServerVersion = String(staticData.version);
                    }
                }
            } catch (staticErr) {
                console.debug('[Update Checker] Static version check error:', staticErr);
            }
        }

        if (!discoveredServerVersion) return;

        // On the initial check of this session/page load:
        // Set baseline version so we never display a modal immediately on reload
        if (isFirstCheckRef.current || !initialVersionRef.current) {
            initialVersionRef.current = discoveredServerVersion;
            isFirstCheckRef.current = false;
            return;
        }

        // On subsequent checks: if the server has deployed a newer version while the app was open
        if (discoveredServerVersion !== initialVersionRef.current) {
            try {
                const dismissed = sessionStorage.getItem('ceaznet_dismissed_version');
                if (dismissed === discoveredServerVersion) {
                    return;
                }
                const reloaded = sessionStorage.getItem('ceaznet_reloaded_version');
                if (reloaded === discoveredServerVersion) {
                    return;
                }
            } catch {}

            console.log(`[Version Update] Newer version detected: ${initialVersionRef.current} -> ${discoveredServerVersion}`);
            latestDetectedVersionRef.current = discoveredServerVersion;
            setHasUpdate(true);
            setIsVisible(true);
        }
    }, [isDev]);

    useEffect(() => {
        if (isDev) return;

        // Run check on initial load to establish baseline version
        checkForUpdates(true);

        // Periodically check every 45 seconds
        checkIntervalRef.current = setInterval(() => {
            checkForUpdates();
        }, 45000);

        // Check when window or tab gains focus/visibility
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkForUpdates(true);
            }
        };
        const handleFocus = () => {
            checkForUpdates(true);
        };
        const handleOnline = () => {
            checkForUpdates(true);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('online', handleOnline);

        // Service Worker Update Listener (PWA) in production
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
                swRegistrationRef.current = reg;

                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && !isFirstCheckRef.current && (navigator.serviceWorker.controller || reg.waiting)) {
                                console.log('[Service Worker] New content installed and available.');
                                setHasUpdate(true);
                                setIsVisible(true);
                            }
                        });
                    }
                });

                reg.update().catch(() => {});
            }).catch(() => {});

            return () => {
                if (checkIntervalRef.current) {
                    clearInterval(checkIntervalRef.current);
                }
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('focus', handleFocus);
                window.removeEventListener('online', handleOnline);
            };
        }

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('online', handleOnline);
        };
    }, [checkForUpdates, isDev]);

    const handleUpdate = async () => {
        try {
            if (latestDetectedVersionRef.current) {
                try {
                    sessionStorage.setItem('ceaznet_reloaded_version', latestDetectedVersionRef.current);
                } catch {}
            }

            // Signal waiting worker to activate immediately
            if (swRegistrationRef.current && swRegistrationRef.current.waiting) {
                swRegistrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

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

            // 2. Perform hard reload with cache-busting timestamp
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
            <div 
                id="version-update-popup-container" 
                className="fixed right-6 z-[10000] w-full max-w-xs px-4 sm:px-0 pointer-events-none transition-all duration-200"
                style={{ bottom: 'calc(1.5rem + var(--dev-console-padding, 0px))' }}
            >
                {/* Compact Elegant Toast */}
                <motion.div
                    id="version-update-card"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="w-full overflow-hidden rounded-xl border p-3 flex flex-col gap-2.5 text-left pointer-events-auto backdrop-blur-md"
                    style={{
                        backgroundColor: 'var(--update-popup-bg)',
                        borderColor: 'var(--update-popup-border)',
                        color: 'var(--update-popup-text)',
                        boxShadow: 'none',
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
                            onClick={() => {
                                setIsVisible(false);
                                if (latestDetectedVersionRef.current) {
                                    try {
                                        sessionStorage.setItem('ceaznet_dismissed_version', latestDetectedVersionRef.current);
                                    } catch {}
                                }
                            }}
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
                            <AppIcon name="solar:arrow-right-linear" className="w-3 h-3" />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
