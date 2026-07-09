import { useState, useEffect, useRef } from 'react';

interface UseSessionsProps {
    isOpen: boolean;
    onActiveDevicesCountChange?: (count: number) => void;
    clearTrigger?: number;
}

export const useSessions = ({
    isOpen,
    onActiveDevicesCountChange,
    clearTrigger = 0
}: UseSessionsProps) => {
    const [sessionCacheData, setSessionCacheData] = useState<Record<string, any>>({});
    const prevSessionSummaryRef = useRef<any>(null);
    const [sessionCacheSearchInput, setSessionCacheSearchInput] = useState('');
    const [sessionCacheSearch, setSessionCacheSearch] = useState('');
    const [sessionCacheHighlightSearch, setSessionCacheHighlightSearch] = useState(true);
    
    const [sessionCacheLimit, setSessionCacheLimit] = useState(() => {
        const saved = localStorage.getItem('dev_session_limit');
        return saved ? Number(saved) : 100;
    });
    const [sessionCacheStatus, setSessionCacheStatus] = useState(() => {
        return localStorage.getItem('dev_session_status') || 'all';
    });
    const [sessionCacheTime, setSessionCacheTime] = useState(() => {
        return localStorage.getItem('dev_session_time') || 'all';
    });
    const [sessionCacheStartDate, setSessionCacheStartDate] = useState(() => {
        return localStorage.getItem('dev_session_start_date') || '';
    });
    const [sessionCacheEndDate, setSessionCacheEndDate] = useState(() => {
        return localStorage.getItem('dev_session_end_date') || '';
    });
    const [sessionCacheIncognito, setSessionCacheIncognito] = useState(() => {
        return localStorage.getItem('dev_session_incognito') || 'all';
    });

    useEffect(() => {
        localStorage.setItem('dev_session_limit', sessionCacheLimit.toString());
    }, [sessionCacheLimit]);

    useEffect(() => {
        localStorage.setItem('dev_session_status', sessionCacheStatus);
    }, [sessionCacheStatus]);

    useEffect(() => {
        localStorage.setItem('dev_session_time', sessionCacheTime);
    }, [sessionCacheTime]);

    useEffect(() => {
        localStorage.setItem('dev_session_start_date', sessionCacheStartDate);
    }, [sessionCacheStartDate]);

    useEffect(() => {
        localStorage.setItem('dev_session_end_date', sessionCacheEndDate);
    }, [sessionCacheEndDate]);

    useEffect(() => {
        localStorage.setItem('dev_session_incognito', sessionCacheIncognito);
    }, [sessionCacheIncognito]);

    const [sessionPages, setSessionPages] = useState<Record<string, number>>({});
    const [isSessionCacheLoading, setIsSessionCacheLoading] = useState(false);
    const [isSessionCacheLoaded, setIsSessionCacheLoaded] = useState(false);
    const [sessionDurationUnits, setSessionDurationUnits] = useState<Record<string, 's' | 'm'>>({});
    const [expandedDevices, setExpandedDevices] = useState<Record<string, boolean>>({});
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
    const [showMassDeleteConfirm, setShowMassDeleteConfirm] = useState(false);
    const [deviceToDelete, setDeviceToDelete] = useState<{ hashId: string; deviceModel: string } | null>(null);
    const [isDeletingAllSessions, setIsDeletingAllSessions] = useState(false);
    const [isDeletingDevice, setIsDeletingDevice] = useState(false);
    const [isDeletingSession, setIsDeletingSession] = useState<string | null>(null);

    const [activeMatchIndex, setActiveMatchIndex] = useState(0);
    const [activeDeviceMenu, setActiveDeviceMenu] = useState<string | null>(null);
    const [activeSessionMenu, setActiveSessionMenu] = useState<string | null>(null);
    const [activeRecentSessionsMenu, setActiveRecentSessionsMenu] = useState<string | null>(null);

    // Click outside handler for dropdowns
    useEffect(() => {
        const handleOutsideClick = () => {
            setActiveDeviceMenu(null);
            setActiveSessionMenu(null);
            setActiveRecentSessionsMenu(null);
        };
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    // Listen to manual sync triggers from parent/dev console header
    useEffect(() => {
        const handleRefresh = () => {
            fetchSessionCacheData(true);
        };
        window.addEventListener('refresh-session-cache', handleRefresh);
        return () => window.removeEventListener('refresh-session-cache', handleRefresh);
    }, []);

    // Report active devices count back to parent
    useEffect(() => {
        const count = Object.keys(sessionCacheData).filter(k => k !== '_summary' && k !== '_resultSummary').length;
        if (onActiveDevicesCountChange) {
            onActiveDevicesCountChange(count);
        }
    }, [sessionCacheData, onActiveDevicesCountChange]);

    // Handle clear action from parent header
    useEffect(() => {
        if (clearTrigger > 0) {
            const count = Object.keys(sessionCacheData).filter(k => k !== '_summary' && k !== '_resultSummary').length;
            if (count > 0) {
                setShowMassDeleteConfirm(true);
            }
        }
    }, [clearTrigger]);

    // SSE connection for real-time updates when tab is active
    useEffect(() => {
        if (!isOpen) return;
        
        let eventSource: EventSource | null = null;
        try {
            eventSource = new EventSource('/api/session-cache/stream');
            eventSource.onmessage = (event: MessageEvent) => {
                try {
                    if (event.data) {
                        fetchSessionCacheData(true);
                    }
                } catch (err) {
                    console.error("[SSE SessionsTab] Failed to parse stream event:", err);
                }
            };
            eventSource.onerror = (err) => {
                if (import.meta.env.DEV) {
                    console.warn("[SSE SessionsTab] EventSource connection update:", err);
                }
            };
        } catch (e) {
            console.error("[SSE SessionsTab] Failed to initialize EventSource:", e);
        }

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [isOpen]);

    const getSessionMatches = () => {
        if (!sessionCacheSearch || !sessionCacheSearch.trim()) return [];
        const query = sessionCacheSearch.trim().toLowerCase();
        const list: {
            type: 'device' | 'user' | 'session';
            hashId: string;
            username?: string;
            sessionId?: string;
            elementId: string;
            occurrenceIndex: number;
            session?: any;
        }[] = [];

        const countOccurrences = (str: string | null | undefined, q: string): number => {
            if (!str || !q) return 0;
            const cleanStr = str.toLowerCase();
            const cleanQuery = q.toLowerCase();
            let count = 0;
            let pos = cleanStr.indexOf(cleanQuery);
            while (pos !== -1) {
                count++;
                pos = cleanStr.indexOf(cleanQuery, pos + cleanQuery.length);
            }
            return count;
        };

        Object.entries(sessionCacheData)
            .filter(([hashId, data]: [string, any]) => hashId !== '_summary' && hashId !== '_resultSummary')
            .forEach(([hashId, data]: [string, any]) => {
                const deviceModel = data.deviceModel || 'Unknown Device';
                const devOccs = countOccurrences(hashId, query) + countOccurrences(deviceModel, query);
                for (let i = 0; i < devOccs; i++) {
                    list.push({
                        type: 'device',
                        hashId,
                        elementId: `device-header-${hashId}`,
                        occurrenceIndex: i
                    });
                }

                Object.entries(data.accounts || {}).forEach(([username, accountData]: [string, any]) => {
                    const displayName = accountData.fullName || (username.includes('@') ? username.split('@')[0] : username);
                    const userOccs = countOccurrences(displayName, query) + (username.includes('@') ? countOccurrences(username, query) : 0);
                    
                    for (let i = 0; i < userOccs; i++) {
                        list.push({
                            type: 'user',
                            hashId,
                            username,
                            elementId: `user-info-${hashId}-${username}`,
                            occurrenceIndex: i
                        });
                    }

                    const sessions = (accountData.sessions || []).slice().reverse();
                    sessions.forEach((s: any) => {
                        const browser = s.browser_name || "Unknown";
                        const os = s.os_name || "Unknown";
                        const location = s.location || "";
                        const ip = s.ip || "";

                        const sessOccs = 
                            countOccurrences(username, query) +
                            countOccurrences(s.sessionId || "", query) +
                            countOccurrences(browser, query) +
                            countOccurrences(os, query) +
                            countOccurrences(location, query) +
                            countOccurrences(ip, query);

                        for (let i = 0; i < sessOccs; i++) {
                            list.push({
                                type: 'session',
                                hashId,
                                username,
                                sessionId: s.sessionId,
                                elementId: `session-row-${s.sessionId}`,
                                occurrenceIndex: i,
                                session: s
                            });
                        }
                    });
                });
            });

        return list;
    };

    const restoreActiveSearchMarks = () => {
        document.querySelectorAll('.active-search-mark').forEach(m => {
            m.classList.remove('active-search-mark');
        });
    };

    const scrollToMatch = (match: any) => {
        if (!match) return;

        restoreActiveSearchMarks();

        setExpandedDevices(prev => ({ ...prev, [match.hashId]: true }));
        
        if (match.username) {
            const deviceData = sessionCacheData[match.hashId];
            if (deviceData) {
                const accountData = deviceData.accounts?.[match.username];
                if (accountData) {
                    const sessionsList = (accountData.sessions || []).slice().reverse();
                    let sessionIdx = 0;
                    if (match.sessionId) {
                        sessionIdx = sessionsList.findIndex((s: any) => s.sessionId === match.sessionId);
                    }
                    if (sessionIdx !== -1) {
                        const pageNum = Math.floor(sessionIdx / 15) + 1;
                        const pageKey = `${match.hashId}_${match.username}`;
                        setSessionPages(prev => ({ ...prev, [pageKey]: pageNum }));
                    }
                }
            }
        }
        
        setTimeout(() => {
            restoreActiveSearchMarks();

            const element = document.getElementById(match.elementId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                const marks = element.querySelectorAll('.session-match-mark');
                const targetMark = marks[match.occurrenceIndex] as HTMLElement;
                if (targetMark) {
                    targetMark.classList.add('active-search-mark');
                }
            }
        }, 50);
    };

    useEffect(() => {
        setActiveMatchIndex(0);
        restoreActiveSearchMarks();
        if (sessionCacheSearch && sessionCacheSearch.trim()) {
            const matches = getSessionMatches();
            if (matches.length > 0) {
                // Automatically expand all devices containing matching results
                const nextExpanded = { ...expandedDevices };
                matches.forEach(m => {
                    if (m.hashId) {
                        nextExpanded[m.hashId] = true;
                    }
                });
                setExpandedDevices(nextExpanded);
                
                // Search result navigation should always start from the top-most match
                scrollToMatch(matches[0]);
            }
        }
    }, [sessionCacheSearch]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!sessionCacheSearch || !sessionCacheSearch.trim()) return;
            
            const matches = getSessionMatches();
            const matchCount = matches.length;
            if (matchCount === 0) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                const nextIndex = (activeMatchIndex + 1) % matchCount;
                setActiveMatchIndex(nextIndex);
                scrollToMatch(matches[nextIndex]);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevIndex = (activeMatchIndex - 1 + matchCount) % matchCount;
                setActiveMatchIndex(prevIndex);
                scrollToMatch(matches[prevIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sessionCacheSearch, activeMatchIndex, sessionCacheData]);

    const fetchSessionCacheData = async (force = false) => {
        setIsSessionCacheLoading(true);
        try {
            const base = `/api/session-cache?action=get${force ? '&force=true' : ''}`;
            const params = new URLSearchParams();
            if (sessionCacheSearch) params.append('search', sessionCacheSearch);
            if (sessionCacheLimit !== undefined && sessionCacheLimit !== null) params.append('limit', sessionCacheLimit.toString());
            if (sessionCacheStatus !== 'all') params.append('status', sessionCacheStatus);
            if (sessionCacheTime !== 'all') params.append('timeRange', sessionCacheTime);
            if (sessionCacheTime === 'custom') {
                if (sessionCacheStartDate) params.append('startDate', sessionCacheStartDate);
                if (sessionCacheEndDate) params.append('endDate', sessionCacheEndDate);
            }
            if (sessionCacheIncognito !== 'all') {
                params.append('isIncognito', sessionCacheIncognito === 'private' ? 'true' : 'false');
            }
            
            const query = params.toString();
            const url = query ? `${base}&${query}` : base;

            const response = await fetch(url);
            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                const data = await response.json();
                setSessionCacheData(prev => {
                    if (Object.keys(prev).length > 0) {
                        prevSessionSummaryRef.current = prev._summary || null;
                    }
                    return data.data || data;
                });
                setIsSessionCacheLoaded(true);
            } else {
                console.warn(`[DevTools] /api/session-cache?action=get returned non-JSON response or error status: ${response.status}`);
            }
        } catch (err) {
            console.error("Failed to fetch session cache data:", err);
        } finally {
            setIsSessionCacheLoading(false);
        }
    };

    const lastSessionFiltersRef = useRef({
        search: sessionCacheSearch,
        limit: sessionCacheLimit,
        status: sessionCacheStatus,
        time: sessionCacheTime,
        startDate: sessionCacheStartDate,
        endDate: sessionCacheEndDate,
        incognito: sessionCacheIncognito
    });

    useEffect(() => {
        if (!isSessionCacheLoaded) {
            fetchSessionCacheData(true);
        }
    }, [isSessionCacheLoaded]);

    useEffect(() => {
        const prev = lastSessionFiltersRef.current;
        const hasChanged = 
            prev.search !== sessionCacheSearch ||
            prev.limit !== sessionCacheLimit ||
            prev.status !== sessionCacheStatus ||
            prev.time !== sessionCacheTime ||
            prev.startDate !== sessionCacheStartDate ||
            prev.endDate !== sessionCacheEndDate ||
            prev.incognito !== sessionCacheIncognito;

        let shouldFetch = hasChanged;
        if (sessionCacheTime === 'custom') {
            const bothPopulated = !!(sessionCacheStartDate && sessionCacheEndDate);
            const bothCleared = !sessionCacheStartDate && !sessionCacheEndDate;
            if (!bothPopulated && !bothCleared) {
                shouldFetch = false;
            }
        }

        if (shouldFetch) {
            lastSessionFiltersRef.current = {
                search: sessionCacheSearch,
                limit: sessionCacheLimit,
                status: sessionCacheStatus,
                time: sessionCacheTime,
                startDate: sessionCacheStartDate,
                endDate: sessionCacheEndDate,
                incognito: sessionCacheIncognito
            };
            const handler = setTimeout(() => {
                fetchSessionCacheData(true);
            }, 300);
            return () => clearTimeout(handler);
        }
    }, [sessionCacheSearch, sessionCacheLimit, sessionCacheStatus, sessionCacheTime, sessionCacheStartDate, sessionCacheEndDate, sessionCacheIncognito]);

    const deleteSingleSession = async (deviceHash: string, username: string, sessionId: string) => {
        if (isDeletingSession) return;
        setIsDeletingSession(sessionId);
        try {
            const res = await fetch('/api/session-cache?action=delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceHash, username, sessionId })
            });
            if (res.ok) {
                await fetchSessionCacheData(true);
            }
        } catch (err) {
            console.error("Error deleting session", err);
        } finally {
            setIsDeletingSession(null);
            setDeletingSessionId(null);
        }
    };

    const deleteDeviceSessions = async (deviceHash: string) => {
        setIsDeletingDevice(true);
        try {
            const res = await fetch('/api/session-cache?action=delete_device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceHash })
            });
            if (res.ok) {
                await fetchSessionCacheData(true);
            }
        } catch (e) {
            console.error("Error deleting device sessions", e);
        } finally {
            setIsDeletingDevice(false);
            setDeviceToDelete(null);
        }
    };

    const deleteAllSessions = async () => {
        setIsDeletingAllSessions(true);
        try {
            const res = await fetch('/api/session-cache?action=delete_all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                await fetchSessionCacheData(true);
            }
        } catch (e) {
            console.error("Error clearing all sessions", e);
        } finally {
            setIsDeletingAllSessions(false);
            setShowMassDeleteConfirm(false);
        }
    };

    return {
        sessionCacheData,
        sessionCacheSearchInput,
        setSessionCacheSearchInput,
        sessionCacheSearch,
        setSessionCacheSearch,
        sessionCacheHighlightSearch,
        setSessionCacheHighlightSearch,
        sessionCacheLimit,
        setSessionCacheLimit,
        sessionCacheStatus,
        setSessionCacheStatus,
        sessionCacheTime,
        setSessionCacheTime,
        sessionCacheStartDate,
        setSessionCacheStartDate,
        sessionCacheEndDate,
        setSessionCacheEndDate,
        sessionCacheIncognito,
        setSessionCacheIncognito,
        sessionPages,
        setSessionPages,
        isSessionCacheLoading,
        isSessionCacheLoaded,
        sessionDurationUnits,
        setSessionDurationUnits,
        expandedDevices,
        setExpandedDevices,
        deletingSessionId,
        setDeletingSessionId,
        showMassDeleteConfirm,
        setShowMassDeleteConfirm,
        deviceToDelete,
        setDeviceToDelete,
        isDeletingAllSessions,
        isDeletingDevice,
        isDeletingSession,
        activeMatchIndex,
        setActiveMatchIndex,
        activeDeviceMenu,
        setActiveDeviceMenu,
        activeSessionMenu,
        setActiveSessionMenu,
        activeRecentSessionsMenu,
        setActiveRecentSessionsMenu,
        fetchSessionCacheData,
        getSessionMatches,
        scrollToMatch,
        deleteSingleSession,
        deleteDeviceSessions,
        deleteAllSessions
    };
};
