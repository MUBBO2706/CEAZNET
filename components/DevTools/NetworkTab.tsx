import React, { useState, useRef, useEffect } from 'react';
import { 
    Filter, X, Download, AlertCircle, ChevronLeft, ChevronRight, 
    ChevronUp, ChevronDown, Copy, Check, Activity, Globe, 
    Database, Wifi, MoreHorizontal 
} from 'lucide-react';
import { 
    formatSize, formatTimestamp, isAutoFireRequest, 
    safeStringifyWithTruncation 
} from './utils';

export type NetHistoryEntry = {
    id: string;
    status: number | string;
    timestamp: Date;
    duration?: number;
    requestBody?: any;
    responseBody?: any;
    requestSize?: number;
    responseSize?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
};

export type NetEntry = {
    id: string;
    status: number | string;
    method: string;
    url: string;
    timestamp: Date;
    duration?: number;
    requestBody?: any;
    responseBody?: any;
    requestSize?: number;
    responseSize?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    fromConsole?: boolean;
    count?: number;
    history?: NetHistoryEntry[];
};

interface NetworkTabProps {
    nets: NetEntry[];
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
    totalSent: number;
    totalReceived: number;
    getEnvironmentStats: () => {
        local: { sent: number; received: number };
        supabase: { sent: number; received: number };
        external: { sent: number; received: number };
    };
    isOpen: boolean;
}

export const NetworkTab: React.FC<NetworkTabProps> = ({
    nets,
    copiedId,
    handleCopy,
    totalSent,
    totalReceived,
    getEnvironmentStats,
    isOpen
}) => {
    const [networkFilter, setNetworkFilter] = useState('');
    const [expandedNetId, setExpandedNetId] = useState<string | null>(null);
    const [highlightedNetId, setHighlightedNetId] = useState<string | null>(null);
    const [activeGroupNetId, setActiveGroupNetId] = useState<string | null>(null);
    const [netDetailTab, setNetDetailTab] = useState<'headers' | 'payload' | 'response'>('headers');
    const [netDurationUnits, setNetDurationUnits] = useState<Record<string, 'ms' | 's' | 'm'>>({});
    const [showDetailedTransfers, setShowDetailedTransfers] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; netId: string } | null>(null);

    const netsEndRef = useRef<HTMLDivElement>(null);
    const prevNetIdRef = useRef<string | null>(null);

    // Auto-scroll logic
    useEffect(() => {
        if (isOpen) {
            // Only scroll to bottom if we are NOT returning from detail view
            if (!expandedNetId && prevNetIdRef.current === null && !highlightedNetId) {
                netsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        prevNetIdRef.current = expandedNetId;
    }, [nets.length, isOpen, expandedNetId, networkFilter, highlightedNetId]);

    const filteredNets = nets.filter(net => {
        if (networkFilter && !net.url.toLowerCase().includes(networkFilter.toLowerCase())) return false;
        return true;
    });

    const findNetTarget = (id: string) => {
        for (const n of nets) {
            if (n.id === id) return { target: n, targetHistory: null };
            if (n.history) {
                const hist = n.history.find(h => h.id === id);
                if (hist) return { target: n, targetHistory: hist };
            }
        }
        return { target: null, targetHistory: null };
    };

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
            } as NetEntry;
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
            default: return 'text-[var(--dev-console-text)]';
        }
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
        } catch (err) {
            console.error("Failed to export Network Report", err);
        }
    };

    const handleContextMenuTrigger = (e: React.MouseEvent, netId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, netId });
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
            {/* Toolbar */}
            <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center justify-between px-3 w-full">
                <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                    <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-2" />
                    <input 
                        className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)]" 
                        placeholder="Filter by URL" 
                        value={networkFilter} 
                        onChange={e => setNetworkFilter(e.target.value)} 
                    />
                    {networkFilter && <button onClick={() => setNetworkFilter('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                </div>
                {nets.length > 0 && (
                    <button
                        onClick={handleExportXHR}
                        className="px-2 py-0.5 rounded text-[10px] flex items-center gap-1.5 transition-all bg-[#007fd4] hover:bg-[#0060a3] text-white font-bold uppercase cursor-pointer shadow-sm shadow-[#007fd4]/20 font-sans select-none"
                        title="Export Network XHR/Fetch Logs (JSON)"
                    >
                        <Download size={11} />
                        <span>Export XHR Report</span>
                    </button>
                )}
            </div>

            {/* Main Area */}
            <div className="flex-1 flex w-full h-full overflow-hidden relative">
                {/* Network List */}
                <div className={`flex flex-col h-full bg-[var(--dev-console-bg)] border-r border-[var(--dev-console-border)] transition-all duration-300 ${selectedNet ? 'w-full md:w-1/2 shrink-0' : 'w-full'}`}>
                    {(filteredNets.length === 0 && !activeGroupNetId) ? (
                        <div className="text-[var(--dev-console-text-muted)] italic p-6 text-center text-xs flex flex-col items-center pt-20 h-full gap-2">
                            <Activity size={32} className="opacity-20 mb-2" />
                            {nets.length > 0 ? 'No requests match your filter.' : 'Recording network activity...'}
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {activeGroupNetId && (
                                <div className="flex items-center px-2 sm:px-4 py-2 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text)] select-none font-semibold sticky top-0 text-[10px] sm:text-[11px] uppercase w-full shrink-0 justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <button 
                                            onClick={() => {
                                                setActiveGroupNetId(null);
                                                setExpandedNetId(null);
                                            }}
                                            className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center transition-colors border-0 bg-transparent p-0 outline-none cursor-pointer shrink-0"
                                            title="Back to all requests"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className="h-4 w-px bg-[var(--dev-console-border)]"></div>
                                        <span className="truncate text-[var(--dev-console-text)] font-semibold">Group History</span>
                                    </div>
                                    <span className="text-[var(--dev-console-text-muted)] font-semibold shrink-0">
                                        ({groupParent ? (groupParent.count || 1) : 0})
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text-muted)] select-none font-semibold sticky top-0 text-[10px] sm:text-[11px] uppercase w-full shrink-0">
                                <div className={`flex-none ${selectedNet ? 'w-[40px] sm:w-[50px]' : 'w-[40px] sm:w-[80px]'}`}>Method</div>
                                <div className="flex-1 min-w-0 pr-1.5 sm:pr-4">Name</div>
                                <div className={`flex-none ${selectedNet ? 'w-[35px] sm:w-[55px]' : 'w-[35px] sm:w-[130px]'}`}>Status</div>
                                <div className={`flex-none text-right ${selectedNet ? 'w-[65px] sm:w-[75px] pl-2' : 'w-[70px] sm:w-[90px] pl-2'}`}>Timestamp</div>
                                <div className={`flex-none text-right ${selectedNet ? 'w-[55px] sm:w-[65px] pl-2' : 'w-[65px] sm:w-[85px] pl-2'}`}>Size</div>
                                <div 
                                    className={`flex-none text-right cursor-pointer hover:text-[#818cf8] transition-colors select-none ${selectedNet ? 'w-[50px] sm:w-[60px] pl-2' : 'w-[55px] sm:w-[75px] pl-2'}`}
                                    onClick={() => {
                                        const listToUse = activeGroupNetId ? groupExecutions : filteredNets;
                                        const currentFirstUnit = listToUse.length > 0 ? (netDurationUnits[listToUse[0].id] || 'ms') : 'ms';
                                        const nextUnit = currentFirstUnit === 'ms' ? 's' : currentFirstUnit === 's' ? 'm' : 'ms';
                                        
                                        const updatedUnits = { ...netDurationUnits };
                                        listToUse.forEach(net => {
                                            updatedUnits[net.id] = nextUnit;
                                        });
                                        setNetDurationUnits(updatedUnits);
                                    }}
                                    title="Click to toggle all: ms -> s -> minutes"
                                >
                                    Time
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                {activeGroupNetId ? (
                                    groupExecutions.map((item) => {
                                        const isSelected = highlightedNetId === item.id || selectedNet?.id === item.id;
                                        const isError = item.status === 'error' || (typeof item.status === 'number' && item.status >= 400);
                                        let host = '';
                                        try { host = new URL(groupParent?.url || '', window.location.origin).hostname; } catch(e){}
                                        
                                        const isSupabase = host.includes('supabase.co') || host.includes('supabase.in');
                                        const isInternal = host === window.location.hostname || (groupParent?.url || '').startsWith('/');
                                        const isExternal = !isInternal && !isSupabase && host !== '';

                                        let bgClass = isSelected ? 'bg-[var(--dev-console-bg-active)] cursor-default' : 'hover:bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                        if (isSelected) {
                                            if (isError) bgClass = 'bg-[#3b1515]/20 cursor-default';
                                            else if (isSupabase) bgClass = 'bg-[#12281e]/40 cursor-default';
                                            else if (isInternal) bgClass = 'bg-[var(--dev-console-bg-active)] cursor-default';
                                        } else {
                                            if (isError) bgClass = 'bg-[#290000]/10 hover:bg-[#3b0000]/10 cursor-pointer';
                                            else if (groupParent?.fromConsole) bgClass = 'bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                            else if (isSupabase) bgClass = 'bg-[#0f1f17]/20 hover:bg-[#162d22]/20 cursor-pointer';
                                            else if (isExternal) bgClass = 'bg-[#1f1a0f]/20 hover:bg-[#2e2616]/20 cursor-pointer';
                                        }

                                        let borderClass = isSelected ? 'border-l-[3px] border-l-[#007fd4]' :
                                            isSupabase ? 'border-l-[3px] border-l-[#3ecf8e]' :
                                            isExternal ? 'border-l-[3px] border-l-[#e3a324]' :
                                            isError ? 'border-l-[3px] border-l-[#ff8080]' :
                                            groupParent?.fromConsole ? 'border-l-[3px] border-l-[#b5cea8]' :
                                            'border-l-[3px] border-l-transparent';

                                        const duration = item.duration || 0;
                                        const unit = netDurationUnits[item.id] || 'ms';
                                        let durationDisplay = '...';
                                        if (item.duration !== undefined) {
                                            if (unit === 'ms') {
                                                durationDisplay = `${duration}ms`;
                                            } else if (unit === 's') {
                                                durationDisplay = `${(duration / 1000).toFixed(2)}s`;
                                            } else {
                                                const totalSecs = Math.floor(duration / 1000);
                                                const hrs = Math.floor(totalSecs / 3600);
                                                const mins = Math.floor((totalSecs % 3600) / 60);
                                                const secs = totalSecs % 60;
                                                const mm = String(mins).padStart(2, '0');
                                                const ss = String(secs).padStart(2, '0');
                                                if (hrs > 0) {
                                                    const hh = String(hrs).padStart(2, '0');
                                                    durationDisplay = `${hh}:${mm}:${ss}`;
                                                } else {
                                                    durationDisplay = `${mm}:${ss}`;
                                                }
                                            }
                                        }

                                        const displayName = item.isLatest 
                                            ? `Latest - ${new URL(groupParent?.url || '', window.location.origin).pathname.split('/').pop() || groupParent?.url}`
                                            : `#${item.index} - ${new URL(groupParent?.url || '', window.location.origin).pathname.split('/').pop() || groupParent?.url}`;

                                        return (
                                            <div 
                                                key={item.id}
                                                onClick={() => {
                                                    setExpandedNetId(item.id);
                                                    setHighlightedNetId(item.id);
                                                }}
                                                className={`group px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border-light)] flex items-center text-[10px] sm:text-[11px] w-full shrink-0 select-none ${bgClass} ${borderClass} ${isSelected ? 'text-[var(--dev-console-text)] font-semibold' : groupParent?.fromConsole ? 'text-[#b5cea8]' : isError ? 'text-[#ff8080]' : 'text-[var(--dev-console-text)]'}`}
                                            >
                                                <div className={`flex-none flex items-center gap-0.5 sm:gap-1.5 ${selectedNet ? 'w-[40px] sm:w-[50px]' : 'w-[40px] sm:w-[80px]'}`}>
                                                    {isError && <AlertCircle size={10} className="text-[#f48771] hidden sm:inline" />}
                                                    <span className={`font-bold ${isSelected ? 'text-[var(--dev-console-text)]' : getMethodColor(groupParent?.method || 'GET')}`}>
                                                        {groupParent?.method}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1.5 sm:pr-4 flex items-center gap-1.5" title={groupParent?.url}>
                                                    <span className="truncate">{displayName}</span>
                                                    <span className={`shrink-0 border px-1 rounded-[3px] text-[8px] uppercase tracking-wider font-bold hidden sm:inline ${
                                                        isSupabase ? 'border-[#3ecf8e]/30 text-[#3ecf8e] bg-[#3ecf8e]/10' :
                                                        isInternal ? 'border-[#569cd6]/30 text-[#569cd6] bg-[#569cd6]/10' :
                                                        'border-[#e3a324]/30 text-[#e3a324] bg-[#e3a324]/10'
                                                    }`}>
                                                        {isSupabase ? 'Supabase' : isInternal ? 'Local' : 'External'}
                                                    </span>
                                                </div>
                                                <div className={`flex-none flex items-center min-w-0 pr-1 ${selectedNet ? 'w-[35px] sm:w-[55px]' : 'w-[35px] sm:w-[130px]'}`} title={getStatusText(item.status) ? `${item.status} ${getStatusText(item.status)}` : String(item.status)}>
                                                    <span className={`${isSelected ? 'text-[var(--dev-console-text)] font-medium' : getStatusColor(item.status)} flex items-center gap-1 w-full min-w-0`}>
                                                        {item.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></span>}
                                                        <span className="truncate block w-full">
                                                            {selectedNet ? (
                                                                item.status
                                                            ) : (
                                                                <>
                                                                    <span>{item.status}</span>
                                                                    {typeof item.status === 'number' && getStatusText(item.status) && (
                                                                        <span className="hidden sm:inline"> {getStatusText(item.status)}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className={`flex-none text-right opacity-70 font-mono ${selectedNet ? 'w-[65px] sm:w-[75px] pl-2' : 'w-[70px] sm:w-[90px] pl-2'}`}>
                                                    {formatTimestamp(item.timestamp)}
                                                </div>
                                                <div className={`flex-none text-right opacity-80 whitespace-nowrap ${selectedNet ? 'w-[55px] sm:w-[65px] pl-2' : 'w-[65px] sm:w-[85px] pl-2'}`} title={item.responseSize !== undefined ? formatSize(item.responseSize) : ''}>
                                                    {item.responseSize !== undefined ? formatSize(item.responseSize) : '-'}
                                                </div>
                                                <div 
                                                    className={`flex-none text-right opacity-80 whitespace-nowrap cursor-pointer hover:text-[#818cf8] transition-colors ${selectedNet ? 'w-[50px] sm:w-[60px] pl-2' : 'w-[55px] sm:w-[75px] pl-2'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (item.duration !== undefined) {
                                                            setNetDurationUnits(prev => {
                                                                const current = prev[item.id] || 'ms';
                                                                const next = current === 'ms' ? 's' : current === 's' ? 'm' : 'ms';
                                                                return { ...prev, [item.id]: next };
                                                            });
                                                        }
                                                    }}
                                                    title="Tap to convert: ms -> s -> minutes"
                                                >
                                                    {durationDisplay}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    filteredNets.map((net) => {
                                        const isSelected = highlightedNetId === net.id || selectedNet?.id === net.id;
                                        const isError = net.status === 'error' || (typeof net.status === 'number' && net.status >= 400);
                                        let host = '';
                                        try { host = new URL(net.url, window.location.origin).hostname; } catch(e){}
                                        
                                        const isSupabase = host.includes('supabase.co') || host.includes('supabase.in');
                                        const isInternal = host === window.location.hostname || net.url.startsWith('/');
                                        const isExternal = !isInternal && !isSupabase && host !== '';

                                        let bgClass = isSelected ? 'bg-[var(--dev-console-bg-active)] cursor-default' : 'hover:bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                        if (isSelected) {
                                            if (isError) bgClass = 'bg-[#3b1515]/20 cursor-default';
                                            else if (isSupabase) bgClass = 'bg-[#12281e]/40 cursor-default';
                                            else if (isInternal) bgClass = 'bg-[var(--dev-console-bg-active)] cursor-default';
                                        } else {
                                            if (isError) bgClass = 'bg-[#290000]/10 hover:bg-[#3b0000]/10 cursor-pointer';
                                            else if (net.fromConsole) bgClass = 'bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                            else if (isSupabase) bgClass = 'bg-[#0f1f17]/20 hover:bg-[#162d22]/20 cursor-pointer';
                                            else if (isExternal) bgClass = 'bg-[#1f1a0f]/20 hover:bg-[#2e2616]/20 cursor-pointer';
                                        }

                                        let borderClass = isSelected ? 'border-l-[3px] border-l-[#007fd4]' :
                                            isSupabase ? 'border-l-[3px] border-l-[#3ecf8e]' :
                                            isExternal ? 'border-l-[3px] border-l-[#e3a324]' :
                                            isError ? 'border-l-[3px] border-l-[#ff8080]' :
                                            net.fromConsole ? 'border-l-[3px] border-l-[#b5cea8]' :
                                            'border-l-[3px] border-l-transparent';

                                        const duration = net.duration || 0;
                                        const unit = netDurationUnits[net.id] || 'ms';
                                        let durationDisplay = '...';
                                        if (net.duration !== undefined) {
                                            if (unit === 'ms') {
                                                durationDisplay = `${duration}ms`;
                                            } else if (unit === 's') {
                                                durationDisplay = `${(duration / 1000).toFixed(2)}s`;
                                            } else {
                                                const totalSecs = Math.floor(duration / 1000);
                                                const hrs = Math.floor(totalSecs / 3600);
                                                const mins = Math.floor((totalSecs % 3600) / 60);
                                                const secs = totalSecs % 60;
                                                const mm = String(mins).padStart(2, '0');
                                                const ss = String(secs).padStart(2, '0');
                                                if (hrs > 0) {
                                                    const hh = String(hrs).padStart(2, '0');
                                                    durationDisplay = `${hh}:${mm}:${ss}`;
                                                } else {
                                                    durationDisplay = `${mm}:${ss}`;
                                                }
                                            }
                                        }

                                        return (
                                            <div 
                                                key={net.id}
                                                onClick={() => {
                                                    const isAuto = isAutoFireRequest(net.method, net.url);
                                                    if (isAuto) {
                                                        setActiveGroupNetId(net.id);
                                                        setExpandedNetId(null);
                                                    } else {
                                                        setExpandedNetId(net.id);
                                                        setHighlightedNetId(net.id);
                                                    }
                                                }}
                                                onContextMenu={(e) => handleContextMenuTrigger(e, net.id)}
                                                className={`group px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border-light)] flex items-center text-[10px] sm:text-[11px] w-full shrink-0 select-none ${bgClass} ${borderClass} ${isSelected ? 'text-[var(--dev-console-text)] font-semibold' : net.fromConsole ? 'text-[#b5cea8]' : isError ? 'text-[#ff8080]' : 'text-[var(--dev-console-text)]'}`}
                                            >
                                                <div className={`flex-none flex items-center gap-0.5 sm:gap-1.5 ${selectedNet ? 'w-[40px] sm:w-[50px]' : 'w-[40px] sm:w-[80px]'}`}>
                                                    {isError && <AlertCircle size={10} className="text-[#f48771] hidden sm:inline" />}
                                                    <span className={`font-bold ${isSelected ? 'text-[var(--dev-console-text)]' : getMethodColor(net.method)}`}>
                                                        {net.method}
                                                    </span>
                                                    {net.count && net.count > 1 && (
                                                        <span className="ml-1 px-1.5 py-0.5 text-[8px] font-bold bg-[#007fd4] text-white rounded-full">
                                                            {net.count}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1.5 sm:pr-4 flex items-center gap-1.5" title={net.url}>
                                                    <span className="truncate">{new URL(net.url, window.location.origin).pathname.split('/').pop() || net.url}</span>
                                                    <span className={`shrink-0 border px-1 rounded-[3px] text-[8px] uppercase tracking-wider font-bold hidden sm:inline ${
                                                        isSupabase ? 'border-[#3ecf8e]/30 text-[#3ecf8e] bg-[#3ecf8e]/10' :
                                                        isInternal ? 'border-[#569cd6]/30 text-[#569cd6] bg-[#569cd6]/10' :
                                                        'border-[#e3a324]/30 text-[#e3a324] bg-[#e3a324]/10'
                                                    }`}>
                                                        {isSupabase ? 'Supabase' : isInternal ? 'Local' : 'External'}
                                                    </span>
                                                    {!selectedNet && <span className="opacity-40 text-[9px] truncate max-w-[70px] hidden lg:inline">{host}</span>}
                                                </div>
                                                <div className={`flex-none flex items-center min-w-0 pr-1 ${selectedNet ? 'w-[35px] sm:w-[55px]' : 'w-[35px] sm:w-[130px]'}`} title={getStatusText(net.status) ? `${net.status} ${getStatusText(net.status)}` : String(net.status)}>
                                                    <span className={`${isSelected ? 'text-[var(--dev-console-text)] font-medium' : getStatusColor(net.status)} flex items-center gap-1 w-full min-w-0`}>
                                                        {net.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></span>}
                                                        <span className="truncate block w-full">
                                                            {selectedNet ? (
                                                                net.status
                                                            ) : (
                                                                <>
                                                                    <span>{net.status}</span>
                                                                    {typeof net.status === 'number' && getStatusText(net.status) && (
                                                                        <span className="hidden sm:inline"> {getStatusText(net.status)}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className={`flex-none text-right opacity-70 font-mono ${selectedNet ? 'w-[65px] sm:w-[75px] pl-2' : 'w-[70px] sm:w-[90px] pl-2'}`}>
                                                    {formatTimestamp(net.timestamp)}
                                                </div>
                                                <div className={`flex-none text-right opacity-80 whitespace-nowrap ${selectedNet ? 'w-[55px] sm:w-[65px] pl-2' : 'w-[65px] sm:w-[85px] pl-2'}`} title={net.responseSize !== undefined ? formatSize(net.responseSize) : ''}>
                                                    {net.responseSize !== undefined ? formatSize(net.responseSize) : '-'}
                                                </div>
                                                <div 
                                                    className={`flex-none text-right opacity-80 whitespace-nowrap cursor-pointer hover:text-[#818cf8] transition-colors ${selectedNet ? 'w-[50px] sm:w-[60px] pl-2' : 'w-[55px] sm:w-[75px] pl-2'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (net.duration !== undefined) {
                                                            setNetDurationUnits(prev => {
                                                                const current = prev[net.id] || 'ms';
                                                                const next = current === 'ms' ? 's' : current === 's' ? 'm' : 'ms';
                                                                return { ...prev, [net.id]: next };
                                                            });
                                                        }
                                                    }}
                                                    title="Tap to convert: ms -> s -> minutes"
                                                >
                                                    {durationDisplay}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={netsEndRef} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Network Details Panel (Desktop) */}
                {selectedNet && (
                    <div className="flex-1 min-w-0 flex flex-col h-full bg-[var(--dev-console-bg)] overflow-hidden hidden md:flex">
                        <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center px-1">
                            <button onClick={() => setExpandedNetId(null)} className="p-1 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] mx-1" title="Close Panel">
                                <X size={14} />
                            </button>
                            <div className="h-4 w-px bg-[var(--dev-console-border)] mx-1"></div>
                            {(['headers', 'payload', 'response'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setNetDetailTab(tab)}
                                    className={`px-4 h-full flex items-center text-[11px] uppercase tracking-wider font-semibold capitalize border-b-2 transition-colors ${netDetailTab === tab ? 'border-[#007fd4] text-[var(--dev-console-text)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                            <div className="flex-1"></div>
                            <button 
                                onClick={() => handleCopy(selectedNet.url, 'url-copy')}
                                className="p-1 mr-2 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1"
                                title="Copy Request URL"
                            >
                                {copiedId === 'url-copy' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto hide-horizontal-scrollbar p-4 scrollbar-thin scrollbar-thumb-[#424242] scrollbar-track-transparent">
                            {netDetailTab === 'headers' && (
                                <div className="flex flex-col gap-6 text-[12px]">
                                    <div>
                                        <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">General</h3>
                                        <div className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1.5 ml-2">
                                            <span className="text-[var(--dev-console-text-muted)] font-semibold">Request URL:</span>
                                            <span className="text-[var(--dev-console-syntax-property)] break-all select-all">{selectedNet.url}</span>
                                            <span className="text-[var(--dev-console-text-muted)] font-semibold">Request Method:</span>
                                            <span className="text-[var(--dev-console-syntax-string)] font-bold">{selectedNet.method}</span>
                                            <span className="text-[var(--dev-console-text-muted)] font-semibold">Status Code:</span>
                                            <span className={getStatusColor(selectedNet.status)}>{selectedNet.status} {getStatusText(selectedNet.status)}</span>
                                            <span className="text-[var(--dev-console-text-muted)] font-semibold">Timestamp:</span>
                                            <span className="text-[var(--dev-console-text)] font-mono">
                                                {formatTimestamp(selectedNet.timestamp)}
                                                <span className="text-[10px] text-[var(--dev-console-text-muted)] ml-2 font-sans">
                                                    ({new Date(selectedNet.timestamp).toLocaleDateString()})
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {selectedNet.responseHeaders && Object.keys(selectedNet.responseHeaders).length > 0 && (
                                        <div>
                                            <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Response Headers</h3>
                                            <div className="grid grid-cols-[160px_1fr] gap-x-2 gap-y-1 ml-2">
                                                {Object.entries(selectedNet.responseHeaders).map(([k, v]) => (
                                                    <React.Fragment key={k}>
                                                        <span className="text-[var(--dev-console-syntax-property)] capitalize">{k}:</span>
                                                        <span className="text-[var(--dev-console-syntax-string)] break-all">{v}</span>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {selectedNet.requestHeaders && Object.keys(selectedNet.requestHeaders).length > 0 && (
                                        <div>
                                            <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Request Headers</h3>
                                            <div className="grid grid-cols-[160px_1fr] gap-x-2 gap-y-1 ml-2">
                                                {Object.entries(selectedNet.requestHeaders).map(([k, v]) => (
                                                    <React.Fragment key={k}>
                                                        <span className="text-[var(--dev-console-syntax-property)] capitalize">{k}:</span>
                                                        <span className="text-[var(--dev-console-syntax-string)] break-all">{v}</span>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {netDetailTab === 'payload' && (
                                <div className="text-[12px]">
                                    {!selectedNet.requestBody ? (
                                        <div className="text-neutral-500 italic p-4 text-center">No payload for this request.</div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-end mb-2 border-b border-[var(--dev-console-border)] pb-1">
                                                <h3 className="text-[var(--dev-console-text)] font-bold uppercase text-[10px] tracking-wider">Request Payload <span className="text-[var(--dev-console-text-muted)] font-normal ml-2">({formatSize(selectedNet.requestSize || 0)})</span></h3>
                                                <button 
                                                    onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.requestBody, 2), 'payload-copy')}
                                                    className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[10px] uppercase font-mono border-0 bg-transparent"
                                                >
                                                    {copiedId === 'payload-copy' ? <><Check size={10} className="text-green-400" /> Copied</> : <><Copy size={10} /> Copy</>}
                                                </button>
                                            </div>
                                            <pre className="font-mono text-[var(--dev-console-syntax-string)] text-[11px] whitespace-pre-wrap break-all max-w-full overflow-x-auto bg-[var(--dev-console-bg-active)] p-2.5 rounded ml-2 mt-2">
                                                {safeStringifyWithTruncation(selectedNet.requestBody, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}

                            {netDetailTab === 'response' && (
                                <div className="text-[12px] h-full flex flex-col">
                                    {selectedNet.status === 'pending' ? (
                                        <div className="text-neutral-500 italic p-4 text-center flex items-center justify-center gap-2 h-full">
                                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> Waiting for response...
                                        </div>
                                    ) : selectedNet.responseBody === undefined ? (
                                        <div className="text-neutral-500 italic p-4 text-center">No response body.</div>
                                    ) : (
                                        <div className="flex flex-col h-full">
                                            <div className="flex justify-between items-end mb-2 border-b border-[var(--dev-console-border)] pb-1 flex-none">
                                                <h3 className="text-[var(--dev-console-text)] font-bold uppercase text-[10px] tracking-wider">Response Body <span className="text-[var(--dev-console-text-muted)] font-normal ml-2">({formatSize(selectedNet.responseSize || 0)})</span></h3>
                                                <button 
                                                    onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.responseBody, 2), 'response-copy')}
                                                    className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[10px] uppercase font-mono border-0 bg-transparent"
                                                >
                                                    {copiedId === 'response-copy' ? <><Check size={10} className="text-green-400" /> Copied</> : <><Copy size={10} /> Copy</>}
                                                </button>
                                            </div>
                                            <div className="flex-1 overflow-auto">
                                                <pre className="font-mono text-[var(--dev-console-syntax-response)] text-[11px] whitespace-pre-wrap break-all max-w-full overflow-x-auto bg-[var(--dev-console-bg-active)] p-2.5 rounded ml-2 mt-2">
                                                    {safeStringifyWithTruncation(selectedNet.responseBody, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Network Details Panel (Mobile overlay) */}
                {selectedNet && (
                    <div className="absolute inset-0 bg-[var(--dev-console-bg)] flex flex-col z-20 md:hidden animate-in slide-in-from-right-2 duration-200">
                        <div className="flex-none h-11 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center px-4">
                            <button onClick={() => setExpandedNetId(null)} className="p-2 -ml-2 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-2 border-0 bg-transparent">
                                <ChevronRight size={18} className="rotate-180" /> Back to Network
                            </button>
                        </div>
                        <div className="flex-none h-10 border-b border-[var(--dev-console-border)] flex">
                            {(['headers', 'payload', 'response'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setNetDetailTab(tab)}
                                    className={`flex-1 h-full flex items-center justify-center text-[11px] uppercase tracking-wider font-semibold capitalize border-b-2 transition-colors ${netDetailTab === tab ? 'border-[#007fd4] text-[var(--dev-console-text)] bg-[var(--dev-console-bg-active)]' : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] bg-[var(--dev-console-bg)]'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 overflow-auto p-4">
                             {netDetailTab === 'headers' && (
                                <div className="flex flex-col gap-6 text-[12px]">
                                    <div>
                                        <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">General</h3>
                                        <div className="flex flex-col gap-2 ml-1">
                                            <div><div className="text-[var(--dev-console-text-muted)] font-semibold mb-0.5">Request URL:</div><div className="text-[var(--dev-console-syntax-property)] break-all">{selectedNet.url}</div></div>
                                            <div><div className="text-[var(--dev-console-text-muted)] font-semibold mb-0.5">Request Method:</div><div className="text-[var(--dev-console-syntax-string)] font-bold">{selectedNet.method}</div></div>
                                            <div><div className="text-[var(--dev-console-text-muted)] font-semibold mb-0.5">Status Code:</div><div className={getStatusColor(selectedNet.status)}>{selectedNet.status}</div></div>
                                            <div>
                                                <div className="text-[var(--dev-console-text-muted)] font-semibold mb-0.5">Timestamp:</div>
                                                <div className="text-[var(--dev-console-text)] font-mono text-[11px]">
                                                    {formatTimestamp(selectedNet.timestamp)}
                                                    <span className="text-[10px] text-[var(--dev-console-text-muted)] ml-1.5 font-sans">
                                                        ({new Date(selectedNet.timestamp).toLocaleDateString()})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedNet.responseHeaders && Object.keys(selectedNet.responseHeaders).length > 0 && (
                                        <div>
                                            <h3 className="text-[var(--dev-console-text)] font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Response Headers</h3>
                                            <div className="flex flex-col gap-1.5 ml-1">
                                                {Object.entries(selectedNet.responseHeaders).map(([k, v]) => (
                                                    <div key={k} className="break-all border-b border-[var(--dev-console-border)] pb-1">
                                                        <span className="text-[var(--dev-console-syntax-property)] capitalize mr-2">{k}:</span>
                                                        <span className="text-[var(--dev-console-syntax-string)]">{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {netDetailTab === 'payload' && (
                                <div className="text-[12px]">
                                    {!selectedNet.requestBody ? (
                                        <div className="text-neutral-500 italic p-4 text-center">No payload.</div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-center mb-2 border-b border-[var(--dev-console-border)] pb-1.5">
                                                <span className="text-[10.5px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold">Request Payload</span>
                                                <button 
                                                    onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.requestBody, 2), 'payload-copy-mobile')}
                                                    className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[11px] uppercase font-semibold transition-colors border-0 bg-transparent"
                                                >
                                                    {copiedId === 'payload-copy-mobile' ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
                                                </button>
                                            </div>
                                            <pre className="font-mono text-[var(--dev-console-syntax-string)] text-[11px] whitespace-pre-wrap break-all bg-[var(--dev-console-bg-active)] p-3 rounded max-w-full overflow-x-auto">
                                                {safeStringifyWithTruncation(selectedNet.requestBody, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                            {netDetailTab === 'response' && (
                                <div className="text-[12px]">
                                    {selectedNet.responseBody === undefined ? (
                                        <div className="text-neutral-500 italic p-4 text-center">No response.</div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-center mb-2 border-b border-[var(--dev-console-border)] pb-1.5">
                                                <span className="text-[10.5px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold">Response Body</span>
                                                <button 
                                                    onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.responseBody, 2), 'response-copy-mobile')}
                                                    className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 text-[11px] uppercase font-semibold transition-colors border-0 bg-transparent"
                                                >
                                                    {copiedId === 'response-copy-mobile' ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
                                                </button>
                                            </div>
                                            <pre className="font-mono text-[var(--dev-console-syntax-response)] text-[11px] whitespace-pre-wrap break-all bg-[var(--dev-console-bg-active)] p-3 rounded max-w-full overflow-x-auto">
                                                {safeStringifyWithTruncation(selectedNet.responseBody, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="w-full relative flex-none h-6 border-t border-[var(--dev-console-border)] bg-[#007fd4] text-white flex items-center px-4 justify-between text-[11px] font-medium select-none">
                <div className="flex items-center gap-4">
                    <span>{filteredNets.length} / {nets.length} requests</span>
                    <span className="w-px h-3 bg-white/30"></span>
                    <span>{formatSize(totalSent + totalReceived)} transferred</span>
                </div>
                
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailedTransfers(prev => !prev);
                    }}
                    className="ml-auto p-1 hover:bg-white/15 active:bg-white/20 rounded cursor-pointer transition-all flex items-center justify-center shrink-0 border-0 bg-transparent"
                    title="Show detailed transfer information"
                >
                    <MoreHorizontal size={14} className="text-white" />
                </button>

                {showDetailedTransfers && (
                    <>
                        {/* Backdrop overlay for mobile to make it immersive and engaging */}
                        <div 
                            className="fixed inset-0 z-[9998] bg-black/60 dark:bg-black/75 backdrop-blur-[2px] md:hidden transition-opacity duration-300 animate-fade-in"
                            onClick={() => setShowDetailedTransfers(false)}
                        />

                        <div 
                            className="fixed bottom-0 left-0 right-0 max-h-[90vh] md:max-h-[440px] md:absolute md:bottom-7 md:right-2 md:left-auto bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] w-full md:w-[350px] z-[9999] flex flex-col gap-2.5 font-sans text-xs select-none rounded-t-2xl md:rounded-xl p-3.5 sm:p-4 shadow-2xl transition-all duration-300 transform translate-y-0"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Mobile Drawer Handle Indicator */}
                            <div className="w-12 h-1 bg-[var(--dev-console-border)] hover:bg-neutral-500 rounded-full mx-auto mb-0.5 shrink-0 md:hidden cursor-pointer" onClick={() => setShowDetailedTransfers(false)} />

                            {/* Downward pointing Tail to trigger button (desktop only) */}
                            <div className="hidden md:block absolute bottom-[-5px] right-3 w-2.5 h-2.5 bg-[var(--dev-console-bg)] border-r border-b border-[var(--dev-console-border)] rotate-45 z-10" />

                            <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-2 shrink-0">
                                <span className="font-bold text-xs tracking-wider text-[var(--dev-console-text)] flex items-center gap-2">
                                    <Activity size={14} className="text-blue-500 animate-pulse" /> Network Traffic Analytics
                                </span>
                                <button 
                                    onClick={() => setShowDetailedTransfers(false)}
                                    className="p-1 hover:bg-[var(--dev-console-bg-active)] rounded-full text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] cursor-pointer transition-colors border-0 bg-transparent"
                                    title="Close Panel"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Segmented Traffic Distribution Progress Bar */}
                            {(() => {
                                const stats = getEnvironmentStats();
                                const localTotal = stats.local.sent + stats.local.received;
                                const supabaseTotal = stats.supabase.sent + stats.supabase.received;
                                const externalTotal = stats.external.sent + stats.external.received;
                                const grandTotal = localTotal + supabaseTotal + externalTotal;
                                
                                const localPct = grandTotal > 0 ? (localTotal / grandTotal) * 100 : 0;
                                const supabasePct = grandTotal > 0 ? (supabaseTotal / grandTotal) * 100 : 0;
                                const externalPct = grandTotal > 0 ? (externalTotal / grandTotal) * 100 : 0;

                                return (
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <div className="flex justify-between items-center text-[10px] font-mono text-[var(--dev-console-text-muted)] font-bold uppercase tracking-wider">
                                            <span>Bandwidth Allocation</span>
                                            <span className="text-[var(--dev-console-text)]">{formatSize(grandTotal)}</span>
                                        </div>
                                        <div className="flex h-2 w-full bg-[var(--dev-console-border)]/55 rounded-full overflow-hidden shrink-0">
                                            {localTotal === 0 && supabaseTotal === 0 && externalTotal === 0 ? (
                                                <div className="h-full w-full bg-neutral-600/35 animate-pulse" />
                                            ) : (
                                                <>
                                                    {localPct > 0 && <div className="h-full bg-blue-500 hover:brightness-110 transition-all duration-300" style={{ width: `${localPct}%` }} title={`Local: ${formatSize(localTotal)} (${Math.round(localPct)}%)`} />}
                                                    {supabasePct > 0 && <div className="h-full bg-[#3ecf8e] hover:brightness-110 transition-all duration-300" style={{ width: `${supabasePct}%` }} title={`Supabase: ${formatSize(supabaseTotal)} (${Math.round(supabasePct)}%)`} />}
                                                    {externalPct > 0 && <div className="h-full bg-amber-500 hover:brightness-110 transition-all duration-300" style={{ width: `${externalPct}%` }} title={`External: ${formatSize(externalTotal)} (${Math.round(externalPct)}%)`} />}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Sent vs Received Comparative cards */}
                            <div className="grid grid-cols-2 gap-2 shrink-0">
                                <div className="bg-blue-500/[0.04] dark:bg-blue-500/[0.03] border border-blue-500/10 rounded-lg p-1.5 flex items-center gap-1.5">
                                    <div className="p-1 rounded-full bg-blue-500/10 text-blue-500 shrink-0">
                                        <ChevronUp size={12} className="stroke-[3]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[8.5px] text-[var(--dev-console-text-muted)] font-mono font-bold uppercase tracking-widest leading-none">Upload</span>
                                        <span className="font-mono text-[10.5px] font-bold text-[var(--dev-console-text)] mt-0.5">{formatSize(totalSent)}</span>
                                    </div>
                                </div>
                                <div className="bg-[#3ecf8e]/[0.04] dark:bg-[#3ecf8e]/[0.03] border border-[#3ecf8e]/10 rounded-lg p-1.5 flex items-center gap-1.5">
                                    <div className="p-1 rounded-full bg-[#3ecf8e]/10 text-[#3ecf8e] shrink-0">
                                        <ChevronDown size={12} className="stroke-[3]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[8.5px] text-[var(--dev-console-text-muted)] font-mono font-bold uppercase tracking-widest leading-none">Download</span>
                                        <span className="font-mono text-[10.5px] font-bold text-[var(--dev-console-text)] mt-0.5">{formatSize(totalReceived)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Environment Breakdowns list */}
                            {(() => {
                                const stats = getEnvironmentStats();
                                const items = [
                                    { name: 'Local API Server', key: 'local', desc: 'Relative proxy endpoints', icon: <Globe size={12} />, colorClass: 'text-blue-500 bg-blue-500/10 border-blue-500/15', barBg: 'bg-blue-500' },
                                    { name: 'Supabase DB', key: 'supabase', desc: 'Database & authentication', icon: <Database size={12} />, colorClass: 'text-[#3ecf8e] bg-[#3ecf8e]/10 border-[#3ecf8e]/15', barBg: 'bg-[#3ecf8e]' },
                                    { name: 'External CDNs', key: 'external', desc: 'Image proxy, maps & utilities', icon: <Wifi size={12} />, colorClass: 'text-amber-500 bg-amber-500/10 border-amber-500/15', barBg: 'bg-amber-500' }
                                ];
                                return (
                                    <div className="flex flex-col gap-1.5 overflow-y-auto pr-0.5 scrollbar-thin max-h-[220px] md:max-h-none shrink-0">
                                        {items.map(item => {
                                            const stat = stats[item.key as keyof typeof stats];
                                            const total = stat.sent + stat.received;
                                            
                                            return (
                                                <div key={item.key} className="flex flex-col bg-[var(--dev-console-bg-active)]/50 border border-[var(--dev-console-border)]/60 rounded-lg p-2 hover:bg-[var(--dev-console-bg-active)] transition-all">
                                                    <div className="flex justify-between items-start gap-1.5 mb-1">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <div className={`p-1 rounded-md border ${item.colorClass} shrink-0`}>
                                                                {item.icon}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold text-[10.5px] text-[var(--dev-console-text)] truncate">{item.name}</span>
                                                                <span className="text-[8.5px] text-[var(--dev-console-text-muted)] truncate leading-none mt-0.5">{item.desc}</span>
                                                            </div>
                                                        </div>
                                                        <span className="font-mono text-[10px] font-bold text-[var(--dev-console-text)] shrink-0 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)]/50 px-1 py-0.5 rounded-md">{formatSize(total)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] text-[var(--dev-console-text-muted)] font-mono">
                                                        <span>Up (↑): {formatSize(stat.sent)}</span>
                                                        <span>Down (↓): {formatSize(stat.received)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                )}
            </div>

            {/* Context Menu Overlay */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-[9999]" onClick={() => setContextMenu(null)} />
                    <div 
                        className="fixed z-[10000] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] shadow-xl rounded py-1 w-56 text-[12px] font-mono text-[var(--dev-console-text)] select-none pointer-events-auto"
                        style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 280) }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
                            onClick={() => {
                                const net = nets.find(n => n.id === contextMenu.netId);
                                if (net) handleCopy(net.url, `url-copy`);
                                setContextMenu(null);
                            }}
                        >Copy URL</button>
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
                            onClick={() => {
                                const net = nets.find(n => n.id === contextMenu.netId);
                                if (net && net.responseBody !== undefined) {
                                    handleCopy(safeStringifyWithTruncation(net.responseBody, 2), 'response-copy');
                                }
                                setContextMenu(null);
                            }}
                        >Copy Response</button>
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)] border-0 bg-transparent block cursor-pointer"
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
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
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
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
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
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)] border-0 bg-transparent block cursor-pointer"
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
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
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
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-t border-[var(--dev-console-border)] border-0 bg-transparent block cursor-pointer"
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
                </>
            )}
        </div>
    );
};
