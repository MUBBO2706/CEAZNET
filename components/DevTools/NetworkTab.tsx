import React, { useState, useRef, useEffect } from 'react';
import { 
    Filter, X, Download, AlertCircle, ChevronLeft, ChevronRight, 
    ChevronUp, ChevronDown, Copy, Check, Activity, Globe, 
    Database, Wifi, MoreHorizontal, EyeOff, Eye, Trash2,
    CheckSquare, Square, ListChecks, ShieldAlert, Plus
} from 'lucide-react';
import { 
    formatSize, formatTimestamp, isAutoFireRequest, 
    safeStringifyWithTruncation, getEnhancedRequestName 
} from './utils';
import { InteractivePayloadViewer } from './InteractivePayloadViewer';
import { 
    hiddenPatterns, 
    addHiddenPattern, 
    removeHiddenPattern, 
    hideNetEntries, 
    unhideNetEntries, 
    unhideAllNetEntries, 
    deleteNetEntries 
} from './store';
import { NetEntry, NetHistoryEntry } from './types';

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

    // Bulk selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Hidden Rules modal state
    const [showHiddenRulesModal, setShowHiddenRulesModal] = useState(false);
    const [newPatternInput, setNewPatternInput] = useState('');

    // Long press touch tracking for mobile
    const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const touchPosRef = useRef<{ x: number; y: number } | null>(null);

    const netsEndRef = useRef<HTMLDivElement>(null);
    const prevNetIdRef = useRef<string | null>(null);

    // Visible nets filter
    const visibleNets = nets.filter(n => !n.isHidden);
    const hiddenNetsCount = nets.filter(n => n.isHidden).length;

    // Auto-scroll logic
    useEffect(() => {
        if (isOpen) {
            // Only scroll to bottom if we are NOT returning from detail view
            if (!expandedNetId && prevNetIdRef.current === null && !highlightedNetId) {
                netsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        prevNetIdRef.current = expandedNetId;
    }, [visibleNets.length, isOpen, expandedNetId, networkFilter, highlightedNetId]);

    const filteredNets = visibleNets.filter(net => {
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
            url: groupParent.url,
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
            url: h.url,
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
                totalRequests: visibleNets.length,
                requests: visibleNets.map(n => ({
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

    // Mobile touch handling (500ms long press)
    const handleTouchStart = (e: React.TouchEvent, netId: string) => {
        if (isSelectionMode) return;
        const touch = e.touches[0];
        touchPosRef.current = { x: touch.clientX, y: touch.clientY };
        if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
        touchTimerRef.current = setTimeout(() => {
            const x = Math.min(touch.clientX, window.innerWidth - 220);
            const y = Math.min(touch.clientY, window.innerHeight - 320);
            setContextMenu({ x, y, netId });
        }, 500);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchPosRef.current) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchPosRef.current.y);
        if (dx > 10 || dy > 10) {
            if (touchTimerRef.current) {
                clearTimeout(touchTimerRef.current);
                touchTimerRef.current = null;
            }
        }
    };

    const handleTouchEnd = () => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    };

    const toggleRowSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getContextNet = () => {
        if (!contextMenu) return null;
        return nets.find(n => n.id === contextMenu.netId) || null;
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
            {/* Toolbar */}
            <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center justify-between px-2 sm:px-3 gap-1.5 sm:gap-3 w-full select-none">
                <div className="flex-1 max-w-xs sm:max-w-md flex items-center h-full pr-2 sm:pr-3 border-r border-[var(--dev-console-border)]">
                    <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-1.5 sm:mr-2 shrink-0" />
                    <input 
                        className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full h-full placeholder:text-[var(--dev-console-text-muted)] font-sans" 
                        placeholder="Filter by URL..." 
                        value={networkFilter} 
                        onChange={e => setNetworkFilter(e.target.value)} 
                    />
                    {networkFilter && (
                        <button onClick={() => setNetworkFilter('')} className="shrink-0 ml-1 border-0 bg-transparent cursor-pointer">
                            <X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Multi-Select Toggle Button */}
                    <button
                        onClick={() => {
                            if (isSelectionMode) {
                                setSelectedIds(new Set());
                                setIsSelectionMode(false);
                            } else {
                                setIsSelectionMode(true);
                            }
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1.5 transition-all font-sans font-semibold cursor-pointer border ${
                            isSelectionMode 
                                ? 'bg-[#007fd4] text-white border-[#007fd4]' 
                                : 'bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text)] border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-active)]'
                        }`}
                        title="Toggle bulk selection mode"
                    >
                        <ListChecks size={12} />
                        <span>{isSelectionMode ? 'Selecting' : 'Select'}</span>
                    </button>

                    {/* Hidden Requests & Rules Badge */}
                    {(hiddenNetsCount > 0 || hiddenPatterns.length > 0) && (
                        <button
                            onClick={() => setShowHiddenRulesModal(true)}
                            className="px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-all bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-sans font-semibold cursor-pointer"
                            title="Manage hidden requests and persistent rules"
                        >
                            <EyeOff size={11} />
                            <span>Hidden ({hiddenNetsCount})</span>
                        </button>
                    )}

                    {/* Export / Download XHR Report */}
                    {visibleNets.length > 0 && (
                        <button
                            onClick={handleExportXHR}
                            className="px-2 py-0.5 rounded text-[10px] flex items-center gap-1.5 transition-all bg-[#007fd4] hover:bg-[#0060a3] text-white font-bold uppercase cursor-pointer shadow-xs shadow-[#007fd4]/20 font-sans select-none border-0"
                            title="Export Network XHR/Fetch Logs (JSON)"
                        >
                            <Download size={11} />
                            <span>Download</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Selection Mode Action Bar */}
            {isSelectionMode && (
                <div className="flex-none px-3 py-1.5 bg-[#007fd4]/10 border-b border-[#007fd4]/30 flex flex-wrap items-center justify-between gap-2 text-xs font-sans select-none">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[#007fd4] flex items-center gap-1.5">
                            <CheckSquare size={13} />
                            <span>{selectedIds.size} Selected</span>
                        </span>
                        <span className="text-[var(--dev-console-border)]">|</span>
                        <button
                            onClick={() => {
                                const listToUse = activeGroupNetId ? groupExecutions : filteredNets;
                                if (selectedIds.size === listToUse.length && listToUse.length > 0) {
                                    setSelectedIds(new Set());
                                } else {
                                    setSelectedIds(new Set(listToUse.map(n => n.id)));
                                }
                            }}
                            className="text-[11px] text-[var(--dev-console-text)] hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium"
                        >
                            {selectedIds.size === (activeGroupNetId ? groupExecutions.length : filteredNets.length) && (activeGroupNetId ? groupExecutions.length : filteredNets.length) > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            disabled={selectedIds.size === 0}
                            onClick={() => {
                                hideNetEntries(Array.from(selectedIds));
                                setSelectedIds(new Set());
                                setIsSelectionMode(false);
                            }}
                            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-all"
                            title="Temporarily hide selected requests from view and exports"
                        >
                            <EyeOff size={12} />
                            <span>Hide ({selectedIds.size})</span>
                        </button>

                        <button
                            disabled={selectedIds.size === 0}
                            onClick={() => {
                                deleteNetEntries(Array.from(selectedIds));
                                setSelectedIds(new Set());
                                setIsSelectionMode(false);
                            }}
                            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 border border-red-500/30 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1 transition-all"
                            title="Permanently delete selected requests"
                        >
                            <Trash2 size={12} />
                            <span>Delete ({selectedIds.size})</span>
                        </button>

                        <button
                            onClick={() => {
                                setSelectedIds(new Set());
                                setIsSelectionMode(false);
                            }}
                            className="p-1 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-active)] bg-transparent border-0 cursor-pointer transition-all flex items-center justify-center ml-0.5"
                            title="Exit Selection Mode"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 flex w-full h-full overflow-hidden relative">
                {/* Network List */}
                <div className={`flex flex-col h-full bg-[var(--dev-console-bg)] border-r border-[var(--dev-console-border)] transition-all duration-300 ${selectedNet ? 'w-full md:w-1/2 shrink-0' : 'w-full'}`}>
                    {(filteredNets.length === 0 && !activeGroupNetId) ? (
                        <div className="text-[var(--dev-console-text-muted)] italic p-6 text-center text-xs flex flex-col items-center pt-20 h-full gap-2">
                            <Activity size={32} className="opacity-20 mb-2" />
                            {hiddenNetsCount > 0 ? (
                                <div className="flex flex-col items-center gap-2">
                                    <span>All requests are currently hidden ({hiddenNetsCount} hidden).</span>
                                    <button 
                                        onClick={() => unhideAllNetEntries()}
                                        className="mt-1 px-3 py-1 rounded text-[11px] font-semibold bg-[#007fd4] text-white cursor-pointer"
                                    >
                                        Unhide All Requests
                                    </button>
                                </div>
                            ) : nets.length > 0 ? (
                                'No requests match your filter.'
                            ) : (
                                'Recording network activity...'
                            )}
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

                            {/* Table Header */}
                            <div className="flex items-center px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text-muted)] select-none font-semibold sticky top-0 text-[10px] sm:text-[11px] uppercase w-full shrink-0">
                                {isSelectionMode && (
                                    <div className="flex-none w-[26px] sm:w-[30px] flex items-center justify-center">
                                        <input 
                                            type="checkbox"
                                            checked={
                                                selectedIds.size > 0 && 
                                                selectedIds.size === (activeGroupNetId ? groupExecutions.length : filteredNets.length)
                                            }
                                            onChange={() => {
                                                const listToUse = activeGroupNetId ? groupExecutions : filteredNets;
                                                if (selectedIds.size === listToUse.length) {
                                                    setSelectedIds(new Set());
                                                } else {
                                                    setSelectedIds(new Set(listToUse.map(n => n.id)));
                                                }
                                            }}
                                            className="cursor-pointer rounded accent-[#007fd4]"
                                            title="Select all"
                                        />
                                    </div>
                                )}
                                <div className={`flex-none ${selectedNet ? 'w-[40px] sm:w-[58px]' : 'w-[44px] sm:w-[68px]'}`}>Method</div>
                                <div className="flex-1 min-w-0 pr-1 text-left">Name</div>
                                <div className={`flex-none text-center ${selectedNet ? 'w-[32px] sm:w-[65px]' : 'w-[42px] sm:w-[130px]'}`}>Status</div>
                                <div className={`flex-none text-left ${selectedNet ? 'w-[48px] sm:w-[75px] pl-1 sm:pl-2' : 'w-[55px] sm:w-[90px] pl-1 sm:pl-2'}`}>Timestamp</div>
                                <div className={`flex-none text-center ${selectedNet ? 'w-[44px] sm:w-[65px] pl-1 sm:pl-2' : 'w-[50px] sm:w-[85px] pl-1 sm:pl-2'}`}>Size</div>
                                <div 
                                    className={`flex-none text-right cursor-pointer hover:text-[#818cf8] transition-colors select-none ${selectedNet ? 'w-[44px] sm:w-[60px] pl-1 sm:pl-2' : 'w-[48px] sm:w-[75px] pl-1 sm:pl-2'}`}
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

                            {/* Table Content */}
                            <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                {activeGroupNetId ? (
                                    groupExecutions.map((item) => {
                                        const isContextActive = contextMenu?.netId === item.id;
                                        const isSelected = highlightedNetId === item.id || selectedNet?.id === item.id;
                                        const isChecked = selectedIds.has(item.id);
                                        const isError = item.status === 'error' || (typeof item.status === 'number' && item.status >= 400);
                                        let host = '';
                                        try { host = new URL(groupParent?.url || '', window.location.origin).hostname; } catch(e){}
                                        
                                        const isSupabase = host.includes('supabase.co') || host.includes('supabase.in');
                                        const isInternal = host === window.location.hostname || (groupParent?.url || '').startsWith('/');
                                        const isExternal = !isInternal && !isSupabase && host !== '';

                                        let bgClass = isContextActive
                                            ? 'bg-[#007fd4]/25 ring-1 ring-inset ring-[#007fd4] font-semibold'
                                            : isChecked 
                                                ? 'bg-[#007fd4]/15 cursor-pointer' 
                                                : isSelected 
                                                    ? 'bg-[var(--dev-console-bg-active)] cursor-default' 
                                                    : 'hover:bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                        
                                        if (!isContextActive && !isChecked && isSelected) {
                                            if (isError) bgClass = 'bg-[#3b1515]/20 cursor-default';
                                            else if (isSupabase) bgClass = 'bg-[#12281e]/40 cursor-default';
                                            else if (isInternal) bgClass = 'bg-[var(--dev-console-bg-active)] cursor-default';
                                        } else if (!isContextActive && !isChecked) {
                                            if (isError) bgClass = 'bg-[#290000]/10 hover:bg-[#3b0000]/10 cursor-pointer';
                                            else if (groupParent?.fromConsole) bgClass = 'bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                            else if (isSupabase) bgClass = 'bg-[#0f1f17]/20 hover:bg-[#162d22]/20 cursor-pointer';
                                            else if (isExternal) bgClass = 'bg-[#1f1a0f]/20 hover:bg-[#2e2616]/20 cursor-pointer';
                                        }

                                        let borderClass = isContextActive ? 'border-l-[4px] border-l-[#007fd4]' :
                                            isChecked ? 'border-l-[3px] border-l-[#007fd4]' :
                                            isSelected ? 'border-l-[3px] border-l-[#007fd4] border-t border-b !border-t-[#007fd4] !border-b-[#007fd4]' :
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

                                        const urlToUse = item.url || groupParent?.url || '';
                                        const baseEnhanced = getEnhancedRequestName(urlToUse, item.requestBody || groupParent?.requestBody, false);
                                        const displayName = item.isLatest ? `Latest - ${baseEnhanced}` : `#${item.index} - ${baseEnhanced}`;

                                        return (
                                            <div 
                                                key={item.id}
                                                onClick={() => {
                                                    if (isSelectionMode) {
                                                        toggleRowSelect(item.id);
                                                        return;
                                                    }
                                                    setExpandedNetId(item.id);
                                                    setHighlightedNetId(item.id);
                                                }}
                                                onContextMenu={(e) => handleContextMenuTrigger(e, item.id)}
                                                onTouchStart={(e) => handleTouchStart(e, item.id)}
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={handleTouchEnd}
                                                className={`group px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border-light)] flex items-center ${selectedNet ? 'text-[9.5px] lg:text-[11px]' : 'text-[9.5px] sm:text-[11px]'} w-full shrink-0 select-none ${bgClass} ${borderClass} ${isSelected ? 'text-[var(--dev-console-text)] font-semibold' : groupParent?.fromConsole ? 'text-[#b5cea8]' : isError ? 'text-[#ff8080]' : 'text-[var(--dev-console-text)]'}`}
                                            >
                                                {isSelectionMode && (
                                                    <div className="flex-none w-[26px] sm:w-[30px] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isChecked} 
                                                            onChange={() => toggleRowSelect(item.id)} 
                                                            className="cursor-pointer rounded accent-[#007fd4]" 
                                                        />
                                                    </div>
                                                )}
                                                <div className={`flex-none flex items-center gap-1 sm:gap-1.5 ${selectedNet ? 'w-[40px] sm:w-[58px]' : 'w-[44px] sm:w-[68px]'}`}>
                                                    {isError && <AlertCircle size={10} className="text-[#f48771] hidden sm:inline" />}
                                                    <span className={`font-bold ${isSelected ? 'text-[var(--dev-console-text)]' : getMethodColor(groupParent?.method || 'GET')}`}>
                                                        {groupParent?.method}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1 flex items-center gap-1.5 text-left" title={groupParent?.url}>
                                                    <span className="truncate">{displayName}</span>
                                                    <span className={`shrink-0 border px-1 rounded-[3px] text-[8px] uppercase tracking-wider font-bold hidden sm:inline ${
                                                        isSupabase ? 'border-[#3ecf8e]/30 text-[#3ecf8e] bg-[#3ecf8e]/10' :
                                                        isInternal ? 'border-[#569cd6]/30 text-[#569cd6] bg-[#569cd6]/10' :
                                                        'border-[#e3a324]/30 text-[#e3a324] bg-[#e3a324]/10'
                                                    }`}>
                                                        {isSupabase ? 'Supabase' : isInternal ? 'Local' : 'External'}
                                                    </span>
                                                </div>
                                                <div className={`flex-none flex items-center justify-center min-w-0 ${selectedNet ? 'w-[32px] sm:w-[65px]' : 'w-[42px] sm:w-[130px]'}`} title={getStatusText(item.status) ? `${item.status} ${getStatusText(item.status)}` : String(item.status)}>
                                                    <span className={`${isSelected ? 'text-[var(--dev-console-text)] font-medium' : getStatusColor(item.status)} flex items-center justify-center gap-1 w-full min-w-0`}>
                                                        {item.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></span>}
                                                        <span className="truncate block w-full text-center">
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
                                                <div className={`flex-none text-left opacity-70 font-mono ${selectedNet ? 'w-[48px] sm:w-[75px] pl-1 sm:pl-2' : 'w-[55px] sm:w-[90px] pl-1 sm:pl-2'}`}>
                                                    {formatTimestamp(item.timestamp)}
                                                </div>
                                                <div className={`flex-none text-center opacity-80 whitespace-nowrap font-mono ${selectedNet ? 'w-[44px] sm:w-[65px] pl-1 sm:pl-2' : 'w-[50px] sm:w-[85px] pl-1 sm:pl-2'}`} title={item.responseSize !== undefined ? formatSize(item.responseSize) : ''}>
                                                    {item.responseSize !== undefined ? formatSize(item.responseSize) : '-'}
                                                </div>
                                                <div 
                                                    className={`flex-none text-right opacity-80 whitespace-nowrap cursor-pointer hover:text-[#818cf8] transition-colors ${selectedNet ? 'w-[44px] sm:w-[60px] pl-1 sm:pl-2' : 'w-[48px] sm:w-[75px] pl-1 sm:pl-2'}`}
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
                                        const isContextActive = contextMenu?.netId === net.id;
                                        const isSelected = highlightedNetId === net.id || selectedNet?.id === net.id;
                                        const isChecked = selectedIds.has(net.id);
                                        const isError = net.status === 'error' || (typeof net.status === 'number' && net.status >= 400);
                                        let host = '';
                                        try { host = new URL(net.url, window.location.origin).hostname; } catch(e){}
                                        
                                        const isSupabase = host.includes('supabase.co') || host.includes('supabase.in');
                                        const isInternal = host === window.location.hostname || net.url.startsWith('/');
                                        const isExternal = !isInternal && !isSupabase && host !== '';

                                        let bgClass = isContextActive
                                            ? 'bg-[#007fd4]/25 ring-1 ring-inset ring-[#007fd4] font-semibold'
                                            : isChecked 
                                                ? 'bg-[#007fd4]/15 cursor-pointer' 
                                                : isSelected 
                                                    ? 'bg-[var(--dev-console-bg-active)] cursor-default' 
                                                    : 'hover:bg-[var(--dev-console-bg-hover)] cursor-pointer';

                                        if (!isContextActive && !isChecked && isSelected) {
                                            if (isError) bgClass = 'bg-[#3b1515]/20 cursor-default';
                                            else if (isSupabase) bgClass = 'bg-[#12281e]/40 cursor-default';
                                            else if (isInternal) bgClass = 'bg-[var(--dev-console-bg-active)] cursor-default';
                                        } else if (!isContextActive && !isChecked) {
                                            if (isError) bgClass = 'bg-[#290000]/10 hover:bg-[#3b0000]/10 cursor-pointer';
                                            else if (net.fromConsole) bgClass = 'bg-[var(--dev-console-bg-hover)] cursor-pointer';
                                            else if (isSupabase) bgClass = 'bg-[#0f1f17]/20 hover:bg-[#162d22]/20 cursor-pointer';
                                            else if (isExternal) bgClass = 'bg-[#1f1a0f]/20 hover:bg-[#2e2616]/20 cursor-pointer';
                                        }

                                        let borderClass = isContextActive ? 'border-l-[4px] border-l-[#007fd4]' :
                                            isChecked ? 'border-l-[3px] border-l-[#007fd4]' :
                                            isSelected ? 'border-l-[3px] border-l-[#007fd4] border-t border-b !border-t-[#007fd4] !border-b-[#007fd4]' :
                                            isSupabase ? 'border-l-[3px] border-l-[#3ecf8e]' :
                                            isExternal ? 'border-l-[3px] border-l-[#e3a324]' :
                                            isError ? 'border-l-[3px] border-l-[#ff8080]' :
                                            net.fromConsole ? 'border-l-[3px] border-l-[#b5cea8]' :
                                            'border-l-[3px] border-l-transparent';

                                        let duration = net.duration || 0;
                                        let responseSize = net.responseSize;

                                        if (net.history && net.history.length > 0) {
                                            const allDurations = [];
                                            if (net.duration !== undefined) allDurations.push(net.duration);
                                            net.history.forEach(h => {
                                                if (h.duration !== undefined) allDurations.push(h.duration);
                                            });
                                            if (allDurations.length > 0) {
                                                duration = Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length);
                                            }

                                            let sizeSum = net.responseSize || 0;
                                            net.history.forEach(h => {
                                                sizeSum += (h.responseSize || 0);
                                            });
                                            responseSize = sizeSum;
                                        }
                                        const unit = netDurationUnits[net.id] || 'ms';
                                        let durationDisplay = '...';
                                        if (net.duration !== undefined || (net.history && net.history.length > 0)) {
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
                                                    if (isSelectionMode) {
                                                        toggleRowSelect(net.id);
                                                        return;
                                                    }
                                                    const isAuto = isAutoFireRequest(net.method, net.url);
                                                    const hasMultiple = net.count && net.count > 1;
                                                    if (isAuto && hasMultiple) {
                                                        setActiveGroupNetId(net.id);
                                                        setExpandedNetId(null);
                                                    } else {
                                                        setExpandedNetId(net.id);
                                                        setHighlightedNetId(net.id);
                                                    }
                                                }}
                                                onContextMenu={(e) => handleContextMenuTrigger(e, net.id)}
                                                onTouchStart={(e) => handleTouchStart(e, net.id)}
                                                onTouchMove={handleTouchMove}
                                                onTouchEnd={handleTouchEnd}
                                                className={`group px-2 sm:px-4 py-1.5 border-b border-[var(--dev-console-border-light)] flex items-center ${selectedNet ? 'text-[9.5px] lg:text-[11px]' : 'text-[9.5px] sm:text-[11px]'} w-full shrink-0 select-none ${bgClass} ${borderClass} ${isSelected ? 'text-[var(--dev-console-text)] font-semibold' : net.fromConsole ? 'text-[#b5cea8]' : isError ? 'text-[#ff8080]' : 'text-[var(--dev-console-text)]'}`}
                                            >
                                                {isSelectionMode && (
                                                    <div className="flex-none w-[26px] sm:w-[30px] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isChecked} 
                                                            onChange={() => toggleRowSelect(net.id)} 
                                                            className="cursor-pointer rounded accent-[#007fd4]" 
                                                        />
                                                    </div>
                                                )}
                                                <div className={`flex-none flex items-center gap-1 sm:gap-1.5 ${selectedNet ? 'w-[40px] sm:w-[58px]' : 'w-[44px] sm:w-[68px]'}`}>
                                                    {isError && <AlertCircle size={10} className="text-[#f48771] hidden sm:inline" />}
                                                    <span className={`font-bold ${isSelected ? 'text-[var(--dev-console-text)]' : getMethodColor(net.method)}`}>
                                                        {net.method}
                                                    </span>
                                                    {net.count && net.count > 1 && (
                                                        <span className="ml-1 px-1 py-0.2 min-w-[14px] h-[14px] flex items-center justify-center text-[7.5px] font-bold bg-[#007fd4] text-white rounded-full shrink-0">
                                                            {net.count}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 pr-1 flex items-center gap-1.5 text-left" title={net.url}>
                                                    <span className="truncate">
                                                        {getEnhancedRequestName(net.url, net.requestBody, true)}
                                                    </span>
                                                    <span className={`shrink-0 border px-1 rounded-[3px] text-[8px] uppercase tracking-wider font-bold hidden sm:inline ${
                                                        isSupabase ? 'border-[#3ecf8e]/30 text-[#3ecf8e] bg-[#3ecf8e]/10' :
                                                        isInternal ? 'border-[#569cd6]/30 text-[#569cd6] bg-[#569cd6]/10' :
                                                        'border-[#e3a324]/30 text-[#e3a324] bg-[#e3a324]/10'
                                                    }`}>
                                                        {isSupabase ? 'Supabase' : isInternal ? 'Local' : 'External'}
                                                    </span>
                                                    {!selectedNet && <span className="opacity-40 text-[9px] truncate max-w-[70px] hidden lg:inline">{host}</span>}
                                                </div>
                                                <div className={`flex-none flex items-center justify-center min-w-0 ${selectedNet ? 'w-[32px] sm:w-[65px]' : 'w-[42px] sm:w-[130px]'}`} title={getStatusText(net.status) ? `${net.status} ${getStatusText(net.status)}` : String(net.status)}>
                                                    <span className={`${isSelected ? 'text-[var(--dev-console-text)] font-medium' : getStatusColor(net.status)} flex items-center justify-center gap-1 w-full min-w-0`}>
                                                        {net.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></span>}
                                                        <span className="truncate block w-full text-center">
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
                                                <div className={`flex-none text-left opacity-70 font-mono ${selectedNet ? 'w-[48px] sm:w-[75px] pl-1 sm:pl-2' : 'w-[55px] sm:w-[90px] pl-1 sm:pl-2'}`}>
                                                    {formatTimestamp(net.timestamp)}
                                                </div>
                                                <div className={`flex-none text-center opacity-80 whitespace-nowrap font-mono ${selectedNet ? 'w-[44px] sm:w-[65px] pl-1 sm:pl-2' : 'w-[50px] sm:w-[85px] pl-1 sm:pl-2'}`} title={responseSize !== undefined ? formatSize(responseSize) : ''}>
                                                    {responseSize !== undefined ? formatSize(responseSize) : '-'}
                                                </div>
                                                <div 
                                                    className={`flex-none text-right opacity-80 whitespace-nowrap cursor-pointer hover:text-[#818cf8] transition-colors ${selectedNet ? 'w-[44px] sm:w-[60px] pl-1 sm:pl-2' : 'w-[48px] sm:w-[75px] pl-1 sm:pl-2'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (net.duration !== undefined || (net.history && net.history.length > 0)) {
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
                            <button onClick={() => setExpandedNetId(null)} className="p-1 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] mx-1 border-0 bg-transparent cursor-pointer" title="Close Panel">
                                <X size={14} />
                            </button>
                            <div className="h-4 w-px bg-[var(--dev-console-border)] mx-1"></div>
                            {(['headers', 'payload', 'response'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setNetDetailTab(tab)}
                                    className={`px-4 h-full flex items-center text-[11px] uppercase tracking-wider font-semibold capitalize border-b-2 transition-colors border-0 bg-transparent cursor-pointer ${netDetailTab === tab ? 'border-b-[#007fd4] text-[var(--dev-console-text)]' : 'border-b-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                            <div className="flex-1"></div>
                            <button 
                                onClick={() => handleCopy(selectedNet.url, 'url-copy')}
                                className="p-1 mr-2 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1 border-0 bg-transparent cursor-pointer"
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
                                <div className="text-[12px] h-full flex flex-col">
                                    {!selectedNet.requestBody ? (
                                        <div className="text-neutral-500 italic p-4 text-center">No payload for this request.</div>
                                    ) : (
                                        <InteractivePayloadViewer
                                            data={selectedNet.requestBody}
                                            title="Request Payload"
                                            size={selectedNet.requestSize || 0}
                                            syntaxColorClass="text-[var(--dev-console-syntax-string)]"
                                            copiedId={copiedId}
                                            handleCopy={handleCopy}
                                            copyIdPrefix="payload-copy"
                                            isMobile={false}
                                        />
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
                                        <InteractivePayloadViewer
                                            data={selectedNet.responseBody}
                                            title="Response Data"
                                            size={selectedNet.responseSize || 0}
                                            syntaxColorClass="text-[var(--dev-console-syntax-response)]"
                                            copiedId={copiedId}
                                            handleCopy={handleCopy}
                                            copyIdPrefix="response-copy"
                                            isMobile={false}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Network Details Modal/Sheet (Mobile Only) */}
                {selectedNet && (
                    <div className="fixed inset-0 z-[9999] bg-[var(--dev-console-bg)] flex flex-col h-full w-full md:hidden">
                        <div className="flex-none h-10 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center px-2 justify-between">
                            <button 
                                onClick={() => setExpandedNetId(null)}
                                className="flex items-center gap-1.5 text-[var(--dev-console-text)] hover:text-[var(--dev-console-text-muted)] font-medium text-xs border-0 bg-transparent cursor-pointer p-1"
                            >
                                <ChevronLeft size={16} />
                                <span>Back</span>
                            </button>
                            
                            <div className="flex items-center gap-1">
                                {(['headers', 'payload', 'response'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setNetDetailTab(tab)}
                                        className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded transition-colors border-0 cursor-pointer ${netDetailTab === tab ? 'bg-[#007fd4] text-white' : 'bg-transparent text-[var(--dev-console-text-muted)]'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={() => handleCopy(selectedNet.url, 'url-copy-mobile')}
                                className="p-1 text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] border-0 bg-transparent cursor-pointer"
                                title="Copy Request URL"
                            >
                                {copiedId === 'url-copy-mobile' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto hide-horizontal-scrollbar p-3.5 text-xs">
                            {netDetailTab === 'headers' && (
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <h3 className="text-[var(--dev-console-text)] font-bold mb-2 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">General</h3>
                                        <div className="flex flex-col gap-2 ml-1">
                                            <div>
                                                <div className="text-[var(--dev-console-text-muted)] font-semibold text-[10px]">Request URL:</div>
                                                <div className="text-[var(--dev-console-syntax-property)] break-all select-all font-mono text-[11px] mt-0.5">{selectedNet.url}</div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[var(--dev-console-text-muted)] font-semibold">Method:</span>
                                                <span className="text-[var(--dev-console-syntax-string)] font-bold">{selectedNet.method}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[var(--dev-console-text-muted)] font-semibold">Status:</span>
                                                <span className={getStatusColor(selectedNet.status)}>{selectedNet.status} {getStatusText(selectedNet.status)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[var(--dev-console-text-muted)] font-semibold">Time:</span>
                                                <span className="text-[var(--dev-console-text)] font-mono">{formatTimestamp(selectedNet.timestamp)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {selectedNet.responseHeaders && Object.keys(selectedNet.responseHeaders).length > 0 && (
                                        <div>
                                            <h3 className="text-[var(--dev-console-text)] font-bold mb-2 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Response Headers</h3>
                                            <div className="flex flex-col gap-1.5 ml-1">
                                                {Object.entries(selectedNet.responseHeaders).map(([k, v]) => (
                                                    <div key={k} className="flex flex-col">
                                                        <span className="text-[var(--dev-console-syntax-property)] font-medium text-[10px]">{k}:</span>
                                                        <span className="text-[var(--dev-console-syntax-string)] break-all font-mono text-[11px]">{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedNet.requestHeaders && Object.keys(selectedNet.requestHeaders).length > 0 && (
                                        <div>
                                            <h3 className="text-[var(--dev-console-text)] font-bold mb-2 uppercase text-[10px] tracking-wider border-b border-[var(--dev-console-border)] pb-1">Request Headers</h3>
                                            <div className="flex flex-col gap-1.5 ml-1">
                                                {Object.entries(selectedNet.requestHeaders).map(([k, v]) => (
                                                    <div key={k} className="flex flex-col">
                                                        <span className="text-[var(--dev-console-syntax-property)] font-medium text-[10px]">{k}:</span>
                                                        <span className="text-[var(--dev-console-syntax-string)] break-all font-mono text-[11px]">{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {netDetailTab === 'payload' && (
                                <div className="h-full flex flex-col">
                                    {!selectedNet.requestBody ? (
                                        <div className="text-neutral-500 italic p-4 text-center">No payload for this request.</div>
                                    ) : (
                                        <InteractivePayloadViewer
                                            data={selectedNet.requestBody}
                                            title="Request Payload"
                                            size={selectedNet.requestSize || 0}
                                            syntaxColorClass="text-[var(--dev-console-syntax-string)]"
                                            copiedId={copiedId}
                                            handleCopy={handleCopy}
                                            copyIdPrefix="payload-copy-mobile"
                                            isMobile={true}
                                        />
                                    )}
                                </div>
                            )}

                            {netDetailTab === 'response' && (
                                <div className="h-full flex flex-col">
                                    {selectedNet.status === 'pending' ? (
                                        <div className="text-neutral-500 italic p-4 text-center flex items-center justify-center gap-2 h-full">
                                            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> Waiting for response...
                                        </div>
                                    ) : selectedNet.responseBody === undefined ? (
                                        <div className="text-neutral-500 italic p-4 text-center">No response body.</div>
                                    ) : (
                                        <InteractivePayloadViewer
                                            data={selectedNet.responseBody}
                                            title="Response Data"
                                            size={selectedNet.responseSize || 0}
                                            syntaxColorClass="text-[var(--dev-console-syntax-response)]"
                                            copiedId={copiedId}
                                            handleCopy={handleCopy}
                                            copyIdPrefix="response-copy-mobile"
                                            isMobile={true}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="w-full relative flex-none h-6 border-t border-[var(--dev-console-border)] bg-[#007fd4] text-white flex items-center px-3 sm:px-4 justify-between text-[10px] sm:text-[11px] font-medium select-none">
                <div className="flex items-center gap-2 sm:gap-4 truncate">
                    <span>{filteredNets.length} / {visibleNets.length} requests</span>
                    {hiddenNetsCount > 0 && (
                        <span className="opacity-90 font-bold bg-amber-500/30 px-1.5 py-0.2 rounded text-[9px]">
                            {hiddenNetsCount} hidden
                        </span>
                    )}
                    <span className="w-px h-3 bg-white/30"></span>
                    <span className="truncate">{formatSize(totalSent + totalReceived)} transferred</span>
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
                        {/* Backdrop overlay for mobile */}
                        <div 
                            className="fixed inset-0 z-[9998] bg-black/60 dark:bg-black/75 backdrop-blur-xs md:hidden transition-opacity duration-300 animate-fade-in"
                            onClick={() => setShowDetailedTransfers(false)}
                        />

                        <div 
                            className="fixed bottom-0 left-0 right-0 max-h-[90vh] md:max-h-[440px] md:absolute md:bottom-7 md:right-2 md:left-auto bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] w-full md:w-[350px] z-[9999] flex flex-col gap-2.5 font-sans text-xs select-none rounded-t-2xl md:rounded-xl p-3.5 sm:p-4 shadow-2xl transition-all duration-300 transform translate-y-0"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Mobile Drawer Handle */}
                            <div className="w-12 h-1 bg-[var(--dev-console-border)] hover:bg-neutral-500 rounded-full mx-auto mb-0.5 shrink-0 md:hidden cursor-pointer" onClick={() => setShowDetailedTransfers(false)} />

                            {/* Downward tail for desktop */}
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
                                        <span className="text-[9px] uppercase font-bold text-[var(--dev-console-text-muted)]">Uploaded</span>
                                        <span className="text-[11px] font-mono font-bold text-[var(--dev-console-text)] truncate">{formatSize(totalSent)}</span>
                                    </div>
                                </div>
                                <div className="bg-emerald-500/[0.04] dark:bg-emerald-500/[0.03] border border-emerald-500/10 rounded-lg p-1.5 flex items-center gap-1.5">
                                    <div className="p-1 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                                        <ChevronDown size={12} className="stroke-[3]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] uppercase font-bold text-[var(--dev-console-text-muted)]">Downloaded</span>
                                        <span className="text-[11px] font-mono font-bold text-[var(--dev-console-text)] truncate">{formatSize(totalReceived)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Hidden Rules & Unhide Management Modal (Responsive & Containerless) */}
            {showHiddenRulesModal && (
                <div 
                    className="fixed inset-0 z-[10002] bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in"
                    onClick={() => setShowHiddenRulesModal(false)}
                >
                    <div 
                        className="bg-[var(--dev-console-bg)] border-t md:border border-[var(--dev-console-border)] text-[var(--dev-console-text)] rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-md overflow-hidden flex flex-col font-sans max-h-[90vh] md:max-h-[80vh] transition-all duration-300 transform translate-y-0"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Mobile Drawer Grab Handle */}
                        <div className="w-12 h-1 bg-[var(--dev-console-border)] hover:bg-neutral-500 rounded-full mx-auto mt-2.5 mb-1 shrink-0 md:hidden cursor-pointer" onClick={() => setShowHiddenRulesModal(false)} />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[var(--dev-console-border)]">
                            <div className="flex items-center gap-2">
                                <EyeOff size={16} className="text-amber-500" />
                                <span className="font-bold text-xs sm:text-sm tracking-tight text-[var(--dev-console-text)]">Hidden Requests & Rules</span>
                            </div>
                            <button 
                                onClick={() => setShowHiddenRulesModal(false)}
                                className="p-1 hover:bg-[var(--dev-console-bg-active)] rounded-full text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] border-0 bg-transparent cursor-pointer transition-colors"
                                title="Close"
                            >
                                <X size={15} />
                            </button>
                        </div>

                        {/* Modal Body (Clean, Containerless & Spaced) */}
                        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
                            {/* Session Hidden Requests Banner */}
                            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--dev-console-border)]">
                                <div className="flex flex-col min-w-0">
                                    <div className="font-medium text-[var(--dev-console-text)] flex items-center gap-2">
                                        <span>Current Session Hidden:</span>
                                        <span className="font-mono font-bold text-amber-500 text-xs px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                                            {hiddenNetsCount}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-[var(--dev-console-text-muted)] mt-0.5">
                                        Requests hidden from the table and exported logs.
                                    </span>
                                </div>
                                {hiddenNetsCount > 0 && (
                                    <button
                                        onClick={() => {
                                            unhideAllNetEntries();
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#007fd4]/10 hover:bg-[#007fd4]/20 text-[#007fd4] border border-[#007fd4]/30 cursor-pointer flex items-center gap-1.5 shrink-0 transition-all shadow-xs"
                                    >
                                        <Eye size={12} />
                                        <span>Unhide All</span>
                                    </button>
                                )}
                            </div>

                            {/* Persistent Always-Hide Rules Section */}
                            <div className="flex flex-col gap-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-[var(--dev-console-text)] flex items-center gap-1.5">
                                        <ShieldAlert size={14} className="text-purple-400" />
                                        <span>Persistent Auto-Hide Patterns ({hiddenPatterns.length})</span>
                                    </span>
                                </div>
                                <p className="text-[11px] text-[var(--dev-console-text-muted)] leading-relaxed">
                                    Requests matching these patterns are automatically hidden and remembered across reloads.
                                </p>

                                {/* Add rule form */}
                                <form 
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (newPatternInput.trim()) {
                                            addHiddenPattern(newPatternInput.trim());
                                            setNewPatternInput('');
                                        }
                                    }}
                                    className="flex items-center gap-2 mt-0.5"
                                >
                                    <input 
                                        type="text"
                                        placeholder="e.g. /api/device-mapper or heartbeat"
                                        value={newPatternInput}
                                        onChange={(e) => setNewPatternInput(e.target.value)}
                                        className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text)] outline-none text-xs placeholder:text-[var(--dev-console-text-muted)] font-mono transition-all focus:border-[#007fd4]"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!newPatternInput.trim()}
                                        className="px-3 py-1.5 rounded-lg bg-[#007fd4] hover:bg-[#0060a3] disabled:opacity-40 text-white font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0 border-0 shadow-xs"
                                    >
                                        <Plus size={13} />
                                        <span>Add</span>
                                    </button>
                                </form>

                                {/* Patterns list (Containerless seamless items) */}
                                <div className="flex flex-col gap-1 max-h-52 overflow-y-auto mt-1 scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                    {hiddenPatterns.length === 0 ? (
                                        <div className="text-[var(--dev-console-text-muted)] italic text-center py-4 text-[11px]">
                                            No persistent hide rules configured yet. Right-click any request or type above.
                                        </div>
                                    ) : (
                                        hiddenPatterns.map(pattern => (
                                            <div 
                                                key={pattern}
                                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--dev-console-bg-active)] text-xs transition-colors group"
                                            >
                                                <span className="font-mono text-[var(--dev-console-syntax-property)] truncate mr-2 text-[11px]" title={pattern}>
                                                    {pattern}
                                                </span>
                                                <button 
                                                    onClick={() => removeHiddenPattern(pattern)}
                                                    className="p-1 hover:bg-red-500/10 text-[var(--dev-console-text-muted)] hover:text-red-500 rounded transition-colors border-0 bg-transparent cursor-pointer shrink-0"
                                                    title="Remove Rule"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 sm:px-5 py-3 border-t border-[var(--dev-console-border)] flex justify-end">
                            <button
                                onClick={() => setShowHiddenRulesModal(false)}
                                className="w-full sm:w-auto px-5 py-1.5 rounded-lg bg-[#007fd4] hover:bg-[#0060a3] text-white text-xs font-semibold cursor-pointer transition-colors shadow-xs border-0"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu Dropdown */}
            {contextMenu && (
                <>
                    <div 
                        className="fixed inset-0 z-[10000]" 
                        onClick={() => setContextMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                    />
                    <div 
                        className="fixed z-[10001] bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] text-[11px] shadow-2xl py-1 rounded-md min-w-[220px] max-w-[90vw] select-none font-sans"
                        style={{ 
                            top: Math.min(contextMenu.y, window.innerHeight - 380), 
                            left: Math.min(contextMenu.x, window.innerWidth - 240) 
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Request Manipulation Actions */}
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--dev-console-bg-hover)] transition-colors border-0 bg-transparent flex items-center gap-2 cursor-pointer text-[var(--dev-console-text)]"
                            onClick={() => {
                                hideNetEntries([contextMenu.netId]);
                                setContextMenu(null);
                            }}
                        >
                            <EyeOff size={13} className="text-amber-500 shrink-0" />
                            <span>Hide Request</span>
                        </button>
                        
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--dev-console-bg-hover)] transition-colors border-0 bg-transparent flex items-center gap-2 cursor-pointer text-[var(--dev-console-text)]"
                            onClick={() => {
                                const net = getContextNet();
                                if (net) {
                                    try {
                                        const u = new URL(net.url, window.location.origin);
                                        const pattern = u.pathname + u.search;
                                        addHiddenPattern(pattern || net.url);
                                    } catch {
                                        addHiddenPattern(net.url);
                                    }
                                }
                                setContextMenu(null);
                            }}
                        >
                            <ShieldAlert size={13} className="text-purple-500 shrink-0" />
                            <span className="truncate">Always Hide This URL / Query</span>
                        </button>

                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors border-0 bg-transparent flex items-center gap-2 cursor-pointer"
                            onClick={() => {
                                deleteNetEntries([contextMenu.netId]);
                                setContextMenu(null);
                            }}
                        >
                            <Trash2 size={13} className="shrink-0" />
                            <span>Delete Request</span>
                        </button>

                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[var(--dev-console-bg-hover)] transition-colors border-0 bg-transparent flex items-center gap-2 cursor-pointer text-[var(--dev-console-text)]"
                            onClick={() => {
                                setIsSelectionMode(true);
                                setSelectedIds(new Set([contextMenu.netId]));
                                setContextMenu(null);
                            }}
                        >
                            <ListChecks size={13} className="text-[#007fd4] shrink-0" />
                            <span>Select Multiple (Bulk Mode)</span>
                        </button>

                        <div className="my-1 border-t border-[var(--dev-console-border)]" />

                        {/* Copy Actions */}
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
                            onClick={() => {
                                const net = getContextNet();
                                if (net) handleCopy(net.url, 'url-copy');
                                setContextMenu(null);
                            }}
                        >Copy URL</button>
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
                            onClick={() => {
                                const net = getContextNet();
                                if (net) {
                                    const resp = typeof net.responseBody === 'object' ? JSON.stringify(net.responseBody, null, 2) : String(net.responseBody || '');
                                    handleCopy(resp, 'response-copy');
                                }
                                setContextMenu(null);
                            }}
                        >Copy Response</button>
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
                            onClick={() => {
                                const net = getContextNet();
                                if (net) {
                                    let curl = `curl -X ${net.method} "${net.url}"`;
                                    if (net.requestHeaders) {
                                        Object.entries(net.requestHeaders).forEach(([k, v]) => {
                                            curl += ` -H "${k}: ${v}"`;
                                        });
                                    }
                                    if (net.requestBody) {
                                        const bodyStr = typeof net.requestBody === 'string' ? net.requestBody : JSON.stringify(net.requestBody);
                                        curl += ` -d '${bodyStr.replace(/'/g, `'\\''`)}'`;
                                    }
                                    handleCopy(curl, 'curl-copy');
                                }
                                setContextMenu(null);
                            }}
                        >Copy as cURL</button>
                        <button 
                            className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white transition-colors border-0 bg-transparent block cursor-pointer"
                            onClick={() => {
                                const net = getContextNet();
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
                                const net = getContextNet();
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
                                const net = getContextNet();
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
                                const net = getContextNet();
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
                                const net = getContextNet();
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
