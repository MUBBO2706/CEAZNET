import React, { useState, useEffect, useRef } from 'react';
import { 
    Terminal, Network, X, Maximize2, Minimize2, Trash2, Copy, Check, 
    ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, 
    AlertTriangle, AlertCircle, Info as InfoIcon, Search, Database, 
    Image, RefreshCw, Cpu, Loader2, MoreHorizontal, MoreVertical, 
    EyeOff, User, Clock, MapPin, Activity, Wifi, Smartphone, Key, 
    Globe, Monitor, Compass, Download, ArrowLeftRight 
} from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { DateTimePicker } from '../DateTimePicker';
import { 
    logs, 
    nets, 
    listeners, 
    initDevStore, 
    netStats, 
    findNetTarget,
    serverImageCacheSummary,
    isImageCacheLoading,
    isImageCacheLoaded,
    showFlushConfirm,
    setShowFlushConfirm,
    fetchImageCacheData,
    handleClearServerImageCache
} from './store';
import { ConsoleTab } from './ConsoleTab';
import { ServerLogsTab } from './ServerLogsTab';
import { NetworkTab } from './NetworkTab';
import { ImageCacheTab } from './ImageCacheTab';
import { SessionsTab } from './SessionsTab';
import { DevicesTab } from './DevicesTab';
import { formatSize, safeStringifyWithTruncation } from './utils';

export { initDevStore };

export const DevTools = () => {
    const [isOpen, setIsOpen] = useState(() => {
        try {
            const saved = localStorage.getItem('devToolsIsOpen') ?? localStorage.getItem('devConsoleIsOpen');
            return saved !== null ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });
    const [isMaximized, setIsMaximized] = useState(false);
    const [showHideConfirmation, setShowHideConfirmation] = useState(false);
    const [activeTab, setActiveTab] = useState<'console' | 'network' | 'cache' | 'image-cache' | 'session-cache' | 'server-logs'>(() => {
        try {
            const saved = localStorage.getItem('devToolsActiveTab') ?? localStorage.getItem('devConsoleActiveTab');
            if (saved && ['console', 'network', 'cache', 'image-cache', 'session-cache', 'server-logs'].includes(saved)) {
                return saved as 'console' | 'network' | 'cache' | 'image-cache' | 'session-cache' | 'server-logs';
            }
        } catch {}
        return 'console';
    });
    const trendMode = 'historical';

    useEffect(() => {
        try {
            localStorage.setItem('devToolsIsOpen', JSON.stringify(isOpen));
        } catch {}
    }, [isOpen]);

    useEffect(() => {
        try {
            localStorage.setItem('devToolsActiveTab', activeTab);
        } catch {}
    }, [activeTab]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showDetailedTransfers, setShowDetailedTransfers] = useState(false);
    
    // Server Logs states
    const [serverLogsList, setServerLogsList] = useState<{ id: string; type: 'log' | 'info' | 'warn' | 'error'; timestamp: string; message: string }[]>([]);
    const [serverLogsFilter, setServerLogsFilter] = useState('');
    const [serverLogsLevel, setServerLogsLevel] = useState<'all' | 'log' | 'info' | 'warn' | 'error'>('all');
    
    const fetchServerLogs = async () => {
        try {
            const response = await fetch('/api/server-logs');
            if (response.ok) {
                const data = await response.json();
                if (data.logs) {
                    setServerLogsList(data.logs);
                }
            }
        } catch (e) {}
    };
    
    // Session Cache states
    const [activeDevicesCount, setActiveDevicesCount] = useState(0);
    const [sessionClearTrigger, setSessionClearTrigger] = useState(0);
    const [netDurationUnits, setNetDurationUnits] = useState<Record<string, 'ms' | 's' | 'm'>>({});

    
    // Device mapping count state (to support tab badge in DevTools header)
    const [deviceMappingsCount, setDeviceMappingsCount] = useState(0);

    // Fetch server logs in the background using SSE (Server-Sent Events) to keep real-time updates and counts
    useEffect(() => {
        let eventSource: EventSource | null = null;
        let streamServiceClosed = false;
        
        const handleCustomServerLog = (e: any) => {
            if (e.detail) {
                setServerLogsList(prev => {
                    const logObj = {
                        id: Math.random().toString(36).slice(2, 9),
                        type: e.detail.type || 'log',
                        timestamp: e.detail.timestamp || new Date().toISOString(),
                        message: e.detail.message
                    };
                    const updated = [...prev, logObj];
                    return updated.length > 2000 ? updated.slice(updated.length - 2000) : updated;
                });
            }
        };
        window.addEventListener('add-server-log', handleCustomServerLog);
        
        try {
            eventSource = new EventSource('/api/server-logs/stream');
            
            // Listen for the complete initial list of server logs
            eventSource.addEventListener('initial', (event: MessageEvent) => {
                try {
                    const logs = JSON.parse(event.data);
                    if (Array.isArray(logs)) {
                        setServerLogsList(logs);
                        // If we are in serverless production mode, close the connection immediately
                        // to prevent browser EventSource from entering an infinite reconnect loop.
                        if (logs.some(l => l.id === 'prod-mode')) {
                            streamServiceClosed = true;
                            eventSource?.close();
                        }
                    }
                } catch (err) {
                    console.error("[SSE DevTools] Failed to parse initial load:", err);
                }
            });
            
            // Listen to stream messages for individual new log entries
            eventSource.onmessage = (event: MessageEvent) => {
                if (streamServiceClosed) return;
                try {
                    const newLog = JSON.parse(event.data);
                    if (newLog && newLog.id) {
                        setServerLogsList(prev => {
                            if (prev.some(l => l.id === newLog.id)) return prev;
                            const updated = [...prev, newLog];
                            return updated.length > 2000 ? updated.slice(updated.length - 2000) : updated;
                        });
                    }
                } catch (err) {
                    console.error("[SSE DevTools] Failed to parse stream event:", err);
                }
            };
            
            // Listen to a clear logs trigger sent by the server
            eventSource.addEventListener('clear', () => {
                setServerLogsList([]);
            });
            
            eventSource.onerror = (err) => {
                if (streamServiceClosed) return;
                // Avoid logging normal serverless disconnects on production console outside of local development mode
                if (import.meta.env.DEV) {
                    console.warn("[SSE DevTools] EventSource connection update:", err);
                }
            };
        } catch (e) {
            console.error("[SSE DevTools] Failed to initialize EventSource, falling back to one-time query:", e);
            fetchServerLogs();
        }
        
        return () => {
            window.removeEventListener('add-server-log', handleCustomServerLog);
            if (eventSource) {
                eventSource.close();
            }
        };
    }, []);
    const [expandedNetId, setExpandedNetId] = useState<string | null>(null);
    const [highlightedNetId, setHighlightedNetId] = useState<string | null>(null);
    const [activeGroupNetId, setActiveGroupNetId] = useState<string | null>(null);
    
    // Filters
    const [consoleFilter, setConsoleFilter] = useState('');
    const [consoleLevel, setConsoleLevel] = useState<'all' | 'log' | 'info' | 'warn' | 'error'>('all');
    const [networkFilter, setNetworkFilter] = useState('');
    const [netDetailTab, setNetDetailTab] = useState<'headers' | 'payload' | 'response'>('headers');
    
    const [consoleInput, setConsoleInput] = useState('');
    const [contextMenu, setContextMenu] = useState<{x: number, y: number, netId: string} | null>(null);

    // Subscribe to store
    const [, forceRender] = useState(0);
    useEffect(() => {
        const listener = () => forceRender(n => n + 1);
        listeners.push(listener);
        
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        
        return () => {
            const idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
            window.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const processResult = async (val: any) => {
        if (val instanceof Response) {
            try {
                const clone = val.clone();
                let text = await clone.text();
                try { return JSON.stringify(JSON.parse(text), null, 2); } 
                catch { return text || `Response { status: ${val.status} }`; }
            } catch {
                return `Response { status: ${val.status} }`;
            }
        }
        if (val === null) return 'null';
        if (typeof val === 'object') {
            try {
                const str = JSON.stringify(val, null, 2);
                if (str === '{}' && val.toString() !== '[object Object]') return val.toString();
                return str;
            } catch { return String(val); }
        }
        return String(val);
    };

    const handleRunJS = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!consoleInput.trim()) return;
        
        const input = consoleInput;
        setConsoleInput('');
        
        // Use timeout to let state clear input first
        setTimeout(() => {
            (window as any).__fromConsole = true;
            try {
                logs.push({
                    id: Math.random().toString(36).slice(2, 9),
                    type: 'log',
                    timestamp: new Date(),
                    args: [`> ${input}`]
                });
                
                let result;
                try {
                    result = (window as any).eval(`(${input})`);
                } catch (e) {
                    result = (window as any).eval(input);
                }
                
                if (result instanceof Promise) {
                    result.then(async (val) => {
                        const formatted = await processResult(val);
                        logs.push({
                            id: Math.random().toString(36).slice(2, 9),
                            type: 'eval_result',
                            timestamp: new Date(),
                            args: [formatted]
                        });
                        forceRender(n => n + 1);
                    }).catch(err => {
                        logs.push({
                            id: Math.random().toString(36).slice(2, 9),
                            type: 'error',
                            timestamp: new Date(),
                            args: [String(err)]
                        });
                        forceRender(n => n + 1);
                    });
                } else if (result !== undefined) {
                    processResult(result).then(formatted => {
                        logs.push({
                            id: Math.random().toString(36).slice(2, 9),
                            type: 'eval_result',
                            timestamp: new Date(),
                            args: [formatted]
                        });
                        forceRender(n => n + 1);
                    });
                }
                forceRender(n => n + 1);
            } catch (error: any) {
                console.error(error);
            } finally {
                setTimeout(() => { (window as any).__fromConsole = false; }, 50);
            }
        }, 10);
    };

    const handleContextMenu = (e: React.MouseEvent, netId: string) => {
        e.preventDefault(); // Prevent default browser context menu
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, netId });
    };

    const logsEndRef = useRef<HTMLDivElement>(null);
    const netsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    const prevNetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (isOpen && activeTab === 'console') {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (isOpen && activeTab === 'network') {
            // Only scroll to bottom if we are NOT returning from detail view
            if (!expandedNetId && prevNetIdRef.current === null && !highlightedNetId) {
                netsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        prevNetIdRef.current = expandedNetId;
    }, [logs.length, nets.length, isOpen, activeTab, expandedNetId, consoleFilter, consoleLevel, networkFilter, highlightedNetId]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleCopyAll = () => {
        if (activeTab === 'console') {
            const allText = logs.map(l => {
                const istStr = l.timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
                return `[${istStr}] ${l.type.toUpperCase()}: ${l.args.join(' ')}`;
            }).join('\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-console');
        } else if (activeTab === 'server-logs') {
            const allText = serverLogsList.map(l => {
                const dateStr = new Date(l.timestamp).toLocaleString();
                return `[${dateStr}] ${l.type.toUpperCase()}: ${l.message}`;
            }).join('\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-server-logs');
        } else {
            const allText = nets.map(n => {
                const istStr = n.timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
                let parts = [`[${istStr}] ${n.method} ${n.url} - ${n.status} (${n.duration}ms)`];
                if (n.requestBody) parts.push(`Payload: ${safeStringifyWithTruncation(n.requestBody, 2)}`);
                if (n.responseBody) parts.push(`Response: ${safeStringifyWithTruncation(n.responseBody, 2)}`);
                return parts.join('\n');
            }).join('\n\n-------------------\n\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-network');
        }
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleClear = async () => {
        if (activeTab === 'console') {
            logs.length = 0;
        } else if (activeTab === 'server-logs') {
            try {
                const response = await fetch('/api/server-logs-clear', { method: 'POST' });
                if (response.ok) {
                    setServerLogsList([]);
                }
            } catch (e) {}
        } else if (activeTab === 'session-cache') {
            setSessionClearTrigger(prev => prev + 1);
        } else if (activeTab === 'image-cache') {
            setShowFlushConfirm(true);
        } else {
            nets.length = 0;
            netStats.totalSent = 0;
            netStats.totalReceived = 0;
            setExpandedNetId(null);
        }
        forceRender(n => n + 1);
    };

    const handleExportXHR = () => {
        try {
            const reportData = {
                title: "Ceaznet DevTools Network XHR Report",
                exportedAt: new Date().toISOString(),
                totalRequests: nets.length,
                requests: nets.map(n => ({
                    id: n.id,
                    method: n.method,
                    url: n.url,
                    status: n.status,
                    timestamp: n.timestamp instanceof Date ? n.timestamp.toISOString() : n.timestamp,
                    duration: n.duration,
                    requestHeaders: n.requestHeaders,
                    responseHeaders: n.responseHeaders,
                    requestBody: n.requestBody,
                    responseBody: n.responseBody,
                    requestSize: n.requestSize,
                    responseSize: n.responseSize,
                    history: n.history ? n.history.map(h => ({
                        id: h.id,
                        status: h.status,
                        timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : h.timestamp,
                        duration: h.duration,
                        requestBody: h.requestBody,
                        responseBody: h.responseBody,
                        requestHeaders: h.requestHeaders,
                        responseHeaders: h.responseHeaders
                    })) : undefined
                }))
            };
            
            const jsonString = JSON.stringify(reportData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            
            link.href = url;
            link.download = `network_xhr_report_${dateStr}_${timeStr}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export XHR report:', error);
        }
    };

    const filteredLogs = logs.filter(log => {
        if (consoleLevel !== 'all' && log.type !== consoleLevel) return false;
        if (consoleFilter && !log.args.join(' ').toLowerCase().includes(consoleFilter.toLowerCase())) return false;
        return true;
    });

    const filteredServerLogs = serverLogsList.filter(log => {
        if (serverLogsLevel !== 'all' && log.type !== serverLogsLevel) return false;
        if (serverLogsFilter && !log.message.toLowerCase().includes(serverLogsFilter.toLowerCase())) return false;
        return true;
    });

    const filteredNets = nets.filter(net => {
        if (networkFilter && !net.url.toLowerCase().includes(networkFilter.toLowerCase())) return false;
        return true;
    });

    const groupParent = (() => {
        if (!activeGroupNetId) return null;
        const { target } = findNetTarget(activeGroupNetId);
        return target;
    })();
    const groupExecutions = (() => {
        if (!groupParent) return [];
        const latest = {
            id: groupParent.id,
            status: groupParent.status,
            timestamp: groupParent.timestamp,
            duration: groupParent.duration,
            responseSize: groupParent.responseSize,
            requestBody: groupParent.requestBody,
            responseBody: groupParent.responseBody,
            requestHeaders: groupParent.requestHeaders,
            responseHeaders: groupParent.responseHeaders,
            isLatest: true,
            index: groupParent.count || 1
        };
        const history = (groupParent.history || []).map((h, index) => ({
            id: h.id,
            status: h.status,
            timestamp: h.timestamp,
            duration: h.duration,
            responseSize: h.responseSize,
            requestBody: h.requestBody,
            responseBody: h.responseBody,
            requestHeaders: h.requestHeaders,
            responseHeaders: h.responseHeaders,
            isLatest: false,
            index: (groupParent.count || 1) - index - 1
        }));
        return [latest, ...history];
    })();

    const getEnvironmentStats = () => {
        let localSent = 0, localReceived = 0;
        let supabaseSent = 0, supabaseReceived = 0;
        let externalSent = 0, externalReceived = 0;

        nets.forEach(net => {
            const lowerUrl = (net.url || '').toLowerCase();
            const sent = net.requestSize || 0;
            const received = net.responseSize || 0;

            const isSupabaseRoute = 
                lowerUrl.includes('/api/db/query') || 
                lowerUrl.includes('/api/news') || 
                lowerUrl.includes('/api/sessions') || 
                lowerUrl.includes('/api/device-mapper') || 
                lowerUrl.includes('/api/debug-triggers') || 
                lowerUrl.includes('/api/debug-news-keys');

            if (isSupabaseRoute || lowerUrl.includes('supabase.co') || lowerUrl.includes('supabase.net') || lowerUrl.includes('supabase')) {
                supabaseSent += sent;
                supabaseReceived += received;
            } else if (lowerUrl.startsWith('/') || lowerUrl.includes('localhost') || lowerUrl.includes('127.0.0.1') || lowerUrl.includes(window.location.host)) {
                localSent += sent;
                localReceived += received;
            } else {
                externalSent += sent;
                externalReceived += received;
            }
        });

        return {
            local: { sent: localSent, received: localReceived },
            supabase: { sent: supabaseSent, received: supabaseReceived },
            external: { sent: externalSent, received: externalReceived }
        };
    };

    const selectedNet = (() => {
        if (!expandedNetId) return null;
        const { target, targetHistory } = findNetTarget(expandedNetId);
        if (!target) return null;
        if (targetHistory) {
            return {
                id: targetHistory.id,
                method: target.method,
                url: target.url,
                status: targetHistory.status,
                timestamp: targetHistory.timestamp,
                duration: targetHistory.duration,
                requestBody: targetHistory.requestBody,
                responseBody: targetHistory.responseBody,
                requestSize: targetHistory.requestSize,
                responseSize: targetHistory.responseSize,
                requestHeaders: targetHistory.requestHeaders || target.requestHeaders,
                responseHeaders: targetHistory.responseHeaders || target.responseHeaders
            } as any;
        }
        return target;
    })();

    const getStatusColor = (status: number | string) => {
        if (status === 'pending') return 'text-yellow-600 dark:text-yellow-400';
        if (status === 'error' || (typeof status === 'number' && status >= 400)) return 'text-red-600 dark:text-[#f48771]';
        return 'text-green-700 dark:text-[#89d185]';
    };

    const getStatusText = (status: number | string) => {
        if (typeof status !== 'number') return '';
        switch(status) {
            case 200: return 'OK';
            case 201: return 'Created';
            case 202: return 'Accepted';
            case 204: return 'No Content';
            case 301: return 'Moved';
            case 302: return 'Found';
            case 304: return 'Not Modified';
            case 400: return 'Bad Request';
            case 401: return 'Unauthorized';
            case 403: return 'Forbidden';
            case 404: return 'Not Found';
            case 422: return 'Unprocessable Entity';
            case 429: return 'Too Many Requests';
            case 500: return 'Internal Error';
            case 502: return 'Bad Gateway';
            case 503: return 'Service Unavailable';
            case 504: return 'Gateway Timeout';
            default: return '';
        }
    };

    const getMethodColor = (method: string) => {
        switch (method.toUpperCase()) {
            case 'GET': return 'text-blue-600 dark:text-[#569cd6]';
            case 'POST': return 'text-emerald-600 dark:text-[#4ec9b0]';
            case 'PUT': return 'text-yellow-600 dark:text-[#dcdcaa]';
            case 'DELETE': return 'text-red-600 dark:text-[#f44747]';
            case 'PATCH': return 'text-green-600 dark:text-[#b5cea8]';
            case 'HEAD': return 'text-purple-600 dark:text-[#c586c0]';
            case 'OPTIONS': return 'text-amber-600 dark:text-[#ce9178]';
            default: return 'text-[var(--dev-console-text-muted)]';
        }
    };

    useEffect(() => {
        if (isOpen) {
            const padSize = isMaximized ? '0px' : 'calc(45vh + 30px)';
            document.documentElement.style.setProperty('--dev-console-padding', padSize);
        } else {
            document.documentElement.style.setProperty('--dev-console-padding', '32px');
        }
        return () => {
            document.documentElement.style.setProperty('--dev-console-padding', '0px');
        };
    }, [isOpen, isMaximized]);

    return (
        <div 
            className={`fixed z-[9999] text-[13px] font-mono transition-all duration-300 ease-in-out flex flex-col overflow-hidden ${
                isOpen 
                    ? (isMaximized 
                        ? 'inset-0 h-[100dvh] w-screen border-none bg-[var(--dev-console-bg)] shadow-[var(--dev-console-shadow)] pointer-events-auto' 
                        : 'inset-x-0 bottom-0 h-[calc(45vh+30px)] bg-transparent border-none pointer-events-none'
                      ) 
                    : 'inset-x-0 bottom-0 h-8 border-t border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] shadow-[var(--dev-console-shadow)] hover:bg-[var(--dev-console-bg-hover)] cursor-pointer w-full pointer-events-auto'
            }`}
            onClick={() => !isOpen && setIsOpen(true)}
        >
            {!isOpen ? (
                <div className="h-full flex justify-between items-center px-4 gap-4 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] font-mono text-[11px] uppercase tracking-widest font-bold transition-colors w-full pointer-events-auto">
                    <div className="flex items-center gap-6 overflow-x-auto scrollbar-hide">
                        <div className="flex items-center gap-1.5 shrink-0" title="Console Logs">
                            <Terminal size={14} /> 
                            <span className="hidden sm:inline">Console</span>
                            {logs.length > 0 && <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] rounded-full text-[9px] font-medium font-mono">{logs.length}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" title="Server Logs">
                            <Cpu size={14} /> 
                            <span className="hidden sm:inline">Server</span>
                            {serverLogsList.length > 0 && <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-red-800/80 text-white rounded-full text-[9px] font-medium font-mono">{serverLogsList.length}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" title="Network Requests">
                            <Network size={14} /> 
                            <span className="hidden sm:inline">Network</span>
                            {nets.length > 0 && <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] rounded-full text-[9px] font-medium font-mono">{nets.length}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" title="Device Models Mapping">
                            <Smartphone size={14} /> 
                            <span className="hidden sm:inline">Devices</span>
                            {deviceMappingsCount > 0 && <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] rounded-full text-[9px] font-medium font-mono">{deviceMappingsCount}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" title="Image Cache Dashboard">
                            <Image size={14} /> 
                            <span className="hidden sm:inline">Image</span>
                            {serverImageCacheSummary.count > 0 && <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 rounded-full text-[9px] font-medium font-mono">{serverImageCacheSummary.count}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0" title="Device Sessions Details">
                            <Clock size={14} /> 
                            <span className="hidden sm:inline">Sessions</span>
                            {activeDevicesCount > 0 && <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[#818cf8]/20 text-[#818cf8] border border-[#818cf8]/30 rounded-full text-[9px] font-medium font-mono">{activeDevicesCount}</span>}
                        </div>
                    </div>
                    <ChevronUp size={16} className="shrink-0" />
                </div>
            ) : (
                <>
                    {/* Top Action Tab Bar */}
                    <div className="flex-none flex justify-between bg-transparent select-none z-10 w-full pointer-events-none pr-0">
                        {/* Left Action: Hide Console */}
                        <div className="pointer-events-auto flex items-center bg-[var(--dev-console-tab-bg)] border-t border-r border-[var(--dev-console-border)] rounded-tr-xl px-4 py-1.5 gap-2 text-[var(--dev-console-text-muted)] text-xs">
                            <button 
                                onClick={() => {
                                    setShowHideConfirmation(true);
                                }} 
                                className="p-1 text-red-500 hover:text-red-600 rounded transition-colors flex items-center gap-1 cursor-pointer font-medium bg-transparent border-0 outline-none focus:outline-none" 
                                title="Hide Developer Console"
                            >
                                <EyeOff size={13} />
                                <span className="hidden sm:inline text-[10px]">Hide Console</span>
                            </button>
                        </div>

                        {/* Right Actions */}
                        <div className="pointer-events-auto flex items-center bg-[var(--dev-console-tab-bg)] border-t border-l border-[var(--dev-console-border)] rounded-tl-xl px-4 py-1.5 gap-2 text-[var(--dev-console-text-muted)] text-xs">
                            {activeTab === 'session-cache' ? (
                                <button 
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('refresh-session-cache'));
                                    }}
                                    className="p-1 text-[#007fd4] hover:text-[#005a96] rounded transition-colors flex items-center gap-1 cursor-pointer font-medium bg-transparent border-0 outline-none focus:outline-none"
                                    title="Sync Sessions"
                                >
                                    <svg 
                                        width="13" 
                                        height="13" 
                                        viewBox="0 0 24 24" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        strokeWidth="2.5" 
                                        strokeLinecap="round" 
                                        strokeLinejoin="round"
                                        className="shrink-0"
                                    >
                                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                        <path d="M21 3v5h-5" />
                                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                                        <path d="M3 21v-5h5" />
                                        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
                                    </svg>
                                </button>
                            ) : (
                                <button onClick={handleCopyAll} className="p-1 hover:text-[var(--dev-console-text)] rounded transition-colors flex items-center gap-1 bg-transparent border-0 outline-none focus:outline-none" title="Copy All">
                                    {copiedId === (activeTab === 'console' ? 'all-console' : activeTab === 'server-logs' ? 'all-server-logs' : 'all-network') ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                                    <span>Copy</span>
                                </button>
                            )}
                            {activeTab === 'image-cache' && (
                                <>
                                    <button 
                                        onClick={fetchImageCacheData}
                                        disabled={isImageCacheLoading}
                                        className="p-1 text-[#007fd4] hover:text-[#005a96] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-0 outline-none focus:outline-none" 
                                        title="Refresh Cache Analytics"
                                    >
                                        <RefreshCw size={13} className={`${isImageCacheLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={handleClear} 
                                className={`p-1 rounded transition-colors cursor-pointer bg-transparent border-0 outline-none focus:outline-none ${
                                    (activeTab === 'session-cache' || activeTab === 'image-cache')
                                        ? 'text-red-500 hover:text-red-400' 
                                        : 'hover:text-[var(--dev-console-text)]'
                                  }`} 
                                title={activeTab === 'session-cache' ? "Clear All Session Logs" : activeTab === 'image-cache' ? "Flush Image Cache" : "Clear (Cmd/Ctrl+K)"}
                            >
                                <Trash2 size={13} className={(activeTab === 'session-cache' || activeTab === 'image-cache') ? 'text-red-500' : ''} />
                            </button>
                            <div className="w-px h-3 bg-[var(--dev-console-border)]"></div>
                            <button onClick={() => setIsMaximized(!isMaximized)} className="p-1 hover:text-[var(--dev-console-text)] rounded transition-colors bg-transparent border-0 outline-none focus:outline-none" title={isMaximized ? 'Minimize' : 'Maximize'}>
                                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:text-[var(--dev-console-text)] rounded transition-colors bg-transparent border-0 outline-none focus:outline-none" title="Close DevTools">
                                <ChevronDown size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Main Console Box (Tabs + Contents) */}
                    <div className="flex-1 flex flex-col bg-[var(--dev-console-bg)] border-t border-[var(--dev-console-border)] overflow-hidden pointer-events-auto w-full">
                        {/* Tabs in one row */}
                        <div className="flex h-9 w-full overflow-x-auto scrollbar-hide border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] select-none">
                            <button 
                                onClick={() => setActiveTab('console')}
                                className={`px-3.5 h-full flex shrink-0 items-center justify-center gap-1.5 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'console' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Terminal size={14} className="shrink-0" /> Console 
                                {logs.length > 0 && <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] rounded-full text-[9px] font-mono font-medium">{logs.length}</span>}
                            </button>
                            <button 
                                onClick={() => setActiveTab('server-logs')}
                                className={`px-3.5 h-full flex shrink-0 items-center justify-center gap-1.5 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'server-logs' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Cpu size={14} className="shrink-0" /> Server
                                {serverLogsList.length > 0 && <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-red-800/80 text-white rounded-full text-[9px] font-mono font-medium">{serverLogsList.length}</span>}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('network'); setExpandedNetId(null); }}
                                className={`px-3.5 h-full flex shrink-0 items-center justify-center gap-1.5 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'network' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Network size={14} className="shrink-0" /> Network
                                {nets.length > 0 && <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] rounded-full text-[9px] font-mono font-medium">{nets.length}</span>}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('cache'); }}
                                className={`px-3.5 h-full flex shrink-0 items-center justify-center gap-1.5 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'cache' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Smartphone size={14} className="shrink-0" /> Devices
                                {deviceMappingsCount > 0 && <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)] rounded-full text-[9px] font-mono font-medium">{deviceMappingsCount}</span>}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('image-cache'); }}
                                className={`px-3.5 h-full flex shrink-0 items-center justify-center gap-1.5 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'image-cache' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Image size={14} className="shrink-0" /> Image
                                {serverImageCacheSummary.count > 0 && (
                                    <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 rounded-full text-[9px] font-mono font-medium">
                                        {serverImageCacheSummary.count}
                                    </span>
                                )}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('session-cache'); }}
                                className={`px-3.5 h-full flex shrink-0 items-center justify-center gap-1.5 border-b-[2px] transition-colors text-[11px] sm:text-[13px] whitespace-nowrap ${activeTab === 'session-cache' ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                            >
                                <Clock size={14} className="shrink-0" /> Sessions
                                {activeDevicesCount > 0 && (
                                    <span className="ml-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-[#818cf8]/20 text-[#818cf8] border border-[#818cf8]/30 rounded-full text-[9px] font-mono font-medium">
                                        {activeDevicesCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 min-h-0 overflow-hidden bg-[var(--dev-console-bg)] flex w-full">
                            {activeTab === 'console' && (
                                <ConsoleTab 
                                    isOpen={isOpen}
                                    copiedId={copiedId}
                                    handleCopy={handleCopy}
                                />
                            )}

                            {activeTab === 'server-logs' && (
                                <ServerLogsTab 
                                    serverLogsList={serverLogsList}
                                    copiedId={copiedId}
                                    handleCopy={handleCopy}
                                />
                            )}
                            
                            {activeTab === 'network' && (
                                <NetworkTab 
                                    nets={nets}
                                    copiedId={copiedId}
                                    handleCopy={handleCopy}
                                    totalSent={netStats.totalSent}
                                    totalReceived={netStats.totalReceived}
                                    getEnvironmentStats={getEnvironmentStats}
                                    isOpen={isOpen}
                                />
                            )}

                            <SessionsTab 
                                isOpen={activeTab === 'session-cache'}
                                onActiveDevicesCountChange={setActiveDevicesCount}
                                clearTrigger={sessionClearTrigger}
                            />

                            <ImageCacheTab 
                                isOpen={activeTab === 'image-cache'}
                                copiedId={copiedId}
                                handleCopy={handleCopy}
                            />

                            <DevicesTab 
                                isOpen={activeTab === 'cache'}
                                copiedId={copiedId}
                                handleCopy={handleCopy}
                                onDeviceMappingsCountChange={setDeviceMappingsCount}
                            />
                        </div>
                        {activeTab === 'image-cache' && (
                            <div className="flex-none min-h-[24px] h-auto py-1 sm:h-6 sm:py-0 border-t border-[var(--dev-console-border)] bg-[#007fd4] text-white flex flex-wrap items-center px-3 text-[10px] sm:text-[11px] font-medium gap-x-3 gap-y-1">
                                <span>Server Cache: Unlimited</span>
                                <span className="hidden sm:inline w-px h-3 bg-white/30"></span>
                                <span>Cached proxy items: {serverImageCacheSummary.count} ({formatSize(serverImageCacheSummary.totalSizeBytes || 0)})</span>
                            </div>
                        )}
                    </div>
                </>
            )}
            
            {contextMenu && (
                <div 
                    className="fixed z-[10000] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] shadow-xl rounded py-1 w-56 text-[12px] font-mono text-[var(--dev-console-text)] select-none pointer-events-auto"
                    style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 280) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) handleCopy(net.url, `url-copy`);
                            setContextMenu(null);
                        }}
                    >Copy URL</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net && net.responseBody !== undefined) {
                                handleCopy(safeStringifyWithTruncation(net.responseBody, 2), 'response-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy Response</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)]"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                let curl = `curl "${net.url}" -X "${net.method}"`;
                                if (net.requestHeaders) {
                                    Object.entries(net.requestHeaders).forEach(([k, v]) => {
                                        curl += ` -H "${k}: ${v}"`;
                                    });
                                }
                                if (net.requestBody) {
                                    const bodyStr = typeof net.requestBody === 'string' ? net.requestBody : JSON.stringify(net.requestBody);
                                    curl += ` --data-raw ${JSON.stringify(bodyStr)}`;
                                }
                                handleCopy(curl, 'curl-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy as cURL</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                const headersStr = net.requestHeaders ? JSON.stringify(net.requestHeaders, null, 2).replace(/\n/g, '\n  ') : '{}';
                                const bodyVal = net.requestBody ? `, body: ${typeof net.requestBody === 'string' ? JSON.stringify(net.requestBody) : JSON.stringify(JSON.stringify(net.requestBody))}` : '';
                                const code = `import fetch from 'node-fetch';\n\nfetch("${net.url}", {\n  method: "${net.method}",\n  headers: ${headersStr}${bodyVal}\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
                                handleCopy(code, 'node-fetch-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy as Node fetch</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                let code = `fetch("${net.url}", {\n  "method": "${net.method}"`;
                                if (net.requestHeaders && Object.keys(net.requestHeaders).length > 0) {
                                    code += `,\n  "headers": ${JSON.stringify(net.requestHeaders, null, 4).replace(/\n/g, '\n  ')}`;
                                }
                                if (net.requestBody) {
                                    code += `,\n  "body": ${typeof net.requestBody === 'string' ? JSON.stringify(net.requestBody) : JSON.stringify(JSON.stringify(net.requestBody))}`;
                                }
                                code += `\n});`;
                                handleCopy(code, 'fetch-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy as fetch</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)]"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net && net.requestHeaders) {
                                const headersText = Object.entries(net.requestHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
                                handleCopy(headersText, 'req-headers-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy Request Headers</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net && net.responseHeaders) {
                                const headersText = Object.entries(net.responseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
                                handleCopy(headersText, 'resp-headers-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy Response Headers</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)]"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) {
                                const istStr = net.timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
                                let parts = [`[${istStr}] ${net.method} ${net.url} - ${net.status} (${net.duration}ms)`];
                                if (net.requestHeaders) parts.push(`Request Headers:\n${safeStringifyWithTruncation(net.requestHeaders, 2)}`);
                                if (net.requestBody) parts.push(`Payload:\n${safeStringifyWithTruncation(net.requestBody, 2)}`);
                                if (net.responseHeaders) parts.push(`Response Headers:\n${safeStringifyWithTruncation(net.responseHeaders, 2)}`);
                                if (net.responseBody) parts.push(`Response:\n${safeStringifyWithTruncation(net.responseBody, 2)}`);
                                handleCopy(parts.join('\n\n'), 'request-copy');
                            }
                            setContextMenu(null);
                        }}
                    >Copy request</button>
                </div>
            )}

            {showHideConfirmation && (
                <div 
                    className="fixed inset-0 z-[10001] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px] pointer-events-auto"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <div className="bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] max-w-sm w-full p-5 rounded-lg shadow-xl flex flex-col gap-4 font-sans">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-red-500/10 text-red-500 shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="font-bold text-sm text-[var(--dev-console-text)]">Hide Developer Tools?</h3>
                                <p className="text-[12px] text-[var(--dev-console-text-muted)] leading-relaxed">
                                    This will disable the developer tools and reload the application.
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2.5 justify-end text-xs font-medium">
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowHideConfirmation(false);
                                }}
                                className="px-3.5 py-1.5 rounded border border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    localStorage.removeItem(['_', 's', 'y', 's', 'o', 'v', 'r'].join(''));
                                    window.location.reload();
                                }}
                                className="px-3.5 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer font-bold"
                            >
                                Confirm & Hide
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevTools;
