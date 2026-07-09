import React from 'react';
import { 
    Database, Search, Trash2, MoreVertical, ChevronDown, ChevronUp, Loader2, EyeOff
} from 'lucide-react';
import { 
    highlightSearchMatchText, 
    formatSessionDateTime 
} from './utils';
import { 
    TrendIndicator, 
    RelativeTimestamp, 
    BrowserCell, 
    OSCell,
    GoogleIcon,
    EmailIcon,
    SessionDuration
} from './UIComponents';

// Types used by Session Components
export interface MetricsProps {
    sessionCacheData: Record<string, any>;
}

const InteractiveStatValue: React.FC<{
    id: string;
    filteredVal: string | number;
    totalVal: string | number;
    colorClass: string;
    valStyle: string;
    qValStyle: string;
    expandedStat: string | null;
    setExpandedStat: (id: string | null) => void;
    filteredTitle?: string;
    totalTitle?: string;
}> = ({
    id,
    filteredVal,
    totalVal,
    colorClass,
    valStyle,
    qValStyle,
    expandedStat,
    setExpandedStat,
    filteredTitle,
    totalTitle
}) => {
    const isExpanded = expandedStat === id;
    const [isHovered, setIsHovered] = React.useState(false);
    const showExpanded = isExpanded || isHovered;

    return (
        <div 
            className="relative h-6 w-full min-w-0 flex items-center select-none"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(e) => {
                e.stopPropagation();
                setExpandedStat(isExpanded ? null : id);
            }}
        >
            <div className={`flex items-baseline leading-none gap-1 font-mono transition-all duration-150 cursor-pointer ${
                showExpanded 
                    ? 'absolute left-0 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] p-1.5 rounded shadow-lg z-30 w-max max-w-[200px] sm:max-w-[260px] whitespace-normal break-all' 
                    : 'absolute left-0 w-full whitespace-nowrap truncate overflow-hidden'
            }`}
            >
                <span className={`${valStyle} ${colorClass}`} title={filteredTitle}>
                    {filteredVal}
                </span>
                <span className={`text-[10px] ${colorClass} opacity-40 font-bold font-sans shrink-0`}>/</span>
                <span className={`${qValStyle} ${colorClass} opacity-70`} title={totalTitle}>
                    {totalVal}
                </span>
            </div>
        </div>
    );
};

export const MetricsSummary: React.FC<MetricsProps> = ({ sessionCacheData }) => {
    const [expandedStat, setExpandedStat] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!expandedStat) return;
        const handleOutsideClick = () => setExpandedStat(null);
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, [expandedStat]);

    const trendMode = 'historical';
    const summary = sessionCacheData._summary || {
        totalDevices: 0,
        activeSessions: 0,
        totalSessions: 0,
        activeUsers: 0,
        avgSessionTime: 0,
        avgSessionsPerDevice: 0,
        privateSessions: 0,
        locations: 0
    };
    
    const filteredMetrics = (() => {
        let devices = 0;
        let activeSessions = 0;
        let totalSessions = 0;
        let activeUsers = 0;
        let totalSessionTime = 0;
        let completedSessionsCount = 0;
        let privateSessions = 0;
        
        Object.entries(sessionCacheData).forEach(([hashId, data]: [string, any]) => {
            if (hashId === '_summary' || hashId === '_resultSummary') return;
            devices++;
            if (data.accounts) {
                const accounts = Object.keys(data.accounts);
                activeUsers += accounts.length;
                accounts.forEach(acc => {
                    const sessions = data.accounts[acc].sessions || [];
                    totalSessions += sessions.length;
                    sessions.forEach((s: any) => {
                        if (s.status === 'active') activeSessions++;
                        if (s.duration) {
                            totalSessionTime += s.duration;
                            completedSessionsCount++;
                        }
                        if (s.is_incognito) privateSessions++;
                    });
                });
            }
        });

        const avgSessionTimeVal = completedSessionsCount > 0 ? Math.round(totalSessionTime / completedSessionsCount) : 0;

        return {
            totalDevices: devices,
            activeSessions,
            totalSessions,
            activeUsers,
            avgSessionTime: avgSessionTimeVal,
            privateSessions
        };
    })();

    const formatDurationMetric = (secs: number) => {
        if (!secs || secs <= 0) return '00:00:00';
        const days = Math.floor(secs / 86400);
        const hrs = Math.floor((secs % 86400) / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);

        const pad = (n: number) => String(n).padStart(2, '0');
        const timeStr = `${pad(hrs)}:${pad(mins)}:${pad(s)}`;
        if (days > 0) {
            return `${days}d ${timeStr}`;
        }
        return timeStr;
    };

    const headerStyle = "text-[7.5px] min-[320px]:text-[8px] min-[375px]:text-[9px] lg:text-[10px] uppercase tracking-wider font-mono font-bold leading-none truncate block w-full whitespace-nowrap overflow-hidden text-[var(--dev-console-text-muted)] dark:text-neutral-400";
    const valStyle = "text-xs min-[340px]:text-sm min-[375px]:text-base lg:text-lg font-bold font-mono leading-none truncate whitespace-nowrap overflow-hidden";
    const qValStyle = "text-[8.5px] min-[340px]:text-[9.5px] min-[375px]:text-[10.5px] lg:text-[11.5px] font-bold font-mono leading-none whitespace-nowrap truncate overflow-hidden";
    const descStyle = "text-[6.5px] min-[320px]:text-[7px] min-[375px]:text-[8px] lg:text-[8.5px] text-[var(--dev-console-text-muted)] mt-1.5 font-mono leading-none truncate block w-full whitespace-nowrap overflow-hidden";

    return (
        <div className="w-full shrink-0 border-b border-[var(--dev-console-border)] p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                    <span className={headerStyle}>TOTAL DEVICES</span>
                    <div className="flex items-center justify-between mt-1.5 w-full">
                        <InteractiveStatValue 
                            id="totalDevices"
                            filteredVal={filteredMetrics.totalDevices}
                            totalVal={summary.totalDevices}
                            colorClass="text-[var(--dev-console-stat-indigo)]"
                            valStyle={valStyle}
                            qValStyle={qValStyle}
                            expandedStat={expandedStat}
                            setExpandedStat={setExpandedStat}
                            filteredTitle="Filtered Devices"
                            totalTitle="Total Devices"
                        />
                        <TrendIndicator trend={summary.trends?.totalDevices} mode={trendMode} />
                    </div>
                    <span className={descStyle}>Unique hardware profiles</span>
                </div>
                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                    <span className={headerStyle}>ACTIVE SESSIONS</span>
                    <div className="flex items-center justify-between mt-1.5 w-full">
                        <InteractiveStatValue 
                            id="activeSessions"
                            filteredVal={filteredMetrics.activeSessions}
                            totalVal={summary.activeSessions}
                            colorClass="text-[var(--dev-console-stat-green)]"
                            valStyle={valStyle}
                            qValStyle={qValStyle}
                            expandedStat={expandedStat}
                            setExpandedStat={setExpandedStat}
                            filteredTitle="Filtered Active Sessions"
                            totalTitle="Total Active Sessions"
                        />
                        <TrendIndicator trend={summary.trends?.activeSessions} mode={trendMode} />
                    </div>
                    <span className={descStyle}>Currently live connections</span>
                </div>
                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                    <span className={headerStyle}>TOTAL SESSIONS</span>
                    <div className="flex items-center justify-between mt-1.5 w-full">
                        <InteractiveStatValue 
                            id="totalSessions"
                            filteredVal={filteredMetrics.totalSessions}
                            totalVal={summary.totalSessions}
                            colorClass="text-[var(--dev-console-text)]"
                            valStyle={valStyle}
                            qValStyle={qValStyle}
                            expandedStat={expandedStat}
                            setExpandedStat={setExpandedStat}
                            filteredTitle="Filtered Total Sessions"
                            totalTitle="Total Sessions"
                        />
                        <TrendIndicator trend={summary.trends?.totalSessions} mode={trendMode} />
                    </div>
                    <span className={descStyle}>Lifetime total connections</span>
                </div>
                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                    <span className={headerStyle}>ACTIVE USERS</span>
                    <div className="flex items-center justify-between mt-1.5 w-full">
                        <InteractiveStatValue 
                            id="activeUsers"
                            filteredVal={filteredMetrics.activeUsers}
                            totalVal={summary.activeUsers}
                            colorClass="text-[var(--dev-console-stat-amber)]"
                            valStyle={valStyle}
                            qValStyle={qValStyle}
                            expandedStat={expandedStat}
                            setExpandedStat={setExpandedStat}
                            filteredTitle="Filtered Active Users"
                            totalTitle="Total Active Users"
                        />
                        <TrendIndicator trend={summary.trends?.activeUsers} mode={trendMode} />
                    </div>
                    <span className={descStyle}>Distinct user accounts</span>
                </div>
                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                    <div className="flex items-center justify-between w-full gap-2">
                        <span className={headerStyle}>AVG DURATION</span>
                        <TrendIndicator trend={summary.trends?.avgSessionTime} format={formatDurationMetric} mode={trendMode} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 w-full">
                        <InteractiveStatValue 
                            id="avgSessionTime"
                            filteredVal={formatDurationMetric(filteredMetrics.avgSessionTime)}
                            totalVal={formatDurationMetric(summary.avgSessionTime)}
                            colorClass="text-[var(--dev-console-stat-purple)]"
                            valStyle={valStyle}
                            qValStyle={qValStyle}
                            expandedStat={expandedStat}
                            setExpandedStat={setExpandedStat}
                            filteredTitle="Filtered Avg Duration"
                            totalTitle="Total Avg Duration"
                        />
                    </div>
                    <span className={descStyle}>Average active duration</span>
                </div>
                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                    <span className={headerStyle}>PRIVATE SESS</span>
                    <div className="flex items-center justify-between mt-1.5 w-full">
                        <InteractiveStatValue 
                            id="privateSessions"
                            filteredVal={filteredMetrics.privateSessions}
                            totalVal={summary.privateSessions !== undefined ? summary.privateSessions : 0}
                            colorClass="text-[var(--dev-console-stat-pink)]"
                            valStyle={valStyle}
                            qValStyle={qValStyle}
                            expandedStat={expandedStat}
                            setExpandedStat={setExpandedStat}
                            filteredTitle="Filtered Private Sessions"
                            totalTitle="Total Private Sessions"
                        />
                        <TrendIndicator trend={summary.trends?.privateSessions} mode={trendMode} />
                    </div>
                    <span className={descStyle}>Private connections count</span>
                </div>
            </div>
        </div>
    );
};

export interface DeviceAccordionProps {
    sessionCacheData: Record<string, any>;
    sessionCacheSearch: string;
    sessionCacheHighlightSearch: boolean;
    expandedDevices: Record<string, boolean>;
    setExpandedDevices: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    activeDeviceMenu: string | null;
    setActiveDeviceMenu: (val: string | null) => void;
    setDeviceToDelete: (val: { hashId: string; deviceModel: string } | null) => void;
    sessionPages: Record<string, number>;
    setSessionPages: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    sessionDurationUnits: Record<string, 's' | 'm'>;
    setSessionDurationUnits: React.Dispatch<React.SetStateAction<Record<string, 's' | 'm'>>>;
    deletingSessionId: string | null;
    setDeletingSessionId: (val: string | null) => void;
    activeSessionMenu: string | null;
    setActiveSessionMenu: (val: string | null) => void;
    activeRecentSessionsMenu: string | null;
    setActiveRecentSessionsMenu: (val: string | null) => void;
    isDeletingSession: string | null;
    setIsDeletingSession: React.Dispatch<React.SetStateAction<string | null>>;
    deleteSingleSession: (hashId: string, username: string, sessionId: string) => Promise<void>;
}

export const DeviceAccordion: React.FC<DeviceAccordionProps> = ({
    sessionCacheData,
    sessionCacheSearch,
    sessionCacheHighlightSearch,
    expandedDevices,
    setExpandedDevices,
    activeDeviceMenu,
    setActiveDeviceMenu,
    setDeviceToDelete,
    sessionPages,
    setSessionPages,
    sessionDurationUnits,
    setSessionDurationUnits,
    deletingSessionId,
    setDeletingSessionId,
    activeSessionMenu,
    setActiveSessionMenu,
    activeRecentSessionsMenu,
    setActiveRecentSessionsMenu,
    isDeletingSession,
    setIsDeletingSession,
    deleteSingleSession
}) => {
    return (
        <div className="space-y-6">
            {Object.entries(sessionCacheData)
                .filter(([hashId, data]: [string, any]) => hashId !== '_summary' && hashId !== '_resultSummary')
                .map(([hashId, data]: [string, any]) => {
                    const totalDeviceSessions = Number(Object.values(data.accounts || {}).reduce((acc: number, val: any) => acc + (val.sessions?.length || 0), 0));
                    const isExpanded = !!expandedDevices[hashId];
                    return (
                        <div key={hashId} id={`device-header-${hashId}`} className="bg-[var(--dev-console-bg)] rounded-none border-y border-x-0 border-[var(--dev-console-border)] shadow-sm -mx-4 scroll-mt-10 transition-all duration-300 relative">
                            <div 
                                onClick={() => setExpandedDevices(prev => ({ ...prev, [hashId]: !isExpanded }))}
                                className="bg-[var(--dev-console-bg-hover)] border-b border-[var(--dev-console-border)] px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-[var(--dev-console-bg-active)] transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="font-bold text-[var(--dev-console-text)] text-sm tracking-wide uppercase shrink-0">
                                        {highlightSearchMatchText(data.deviceModel || 'Unknown Device', sessionCacheSearch, sessionCacheHighlightSearch, 'yellow')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setActiveDeviceMenu(activeDeviceMenu === hashId ? null : hashId);
                                                setActiveSessionMenu(null);
                                                setActiveRecentSessionsMenu(null);
                                            }}
                                            className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors p-1 bg-transparent border-none outline-none hover:bg-neutral-500/10 rounded cursor-pointer shrink-0 flex items-center justify-center"
                                            title="More Actions"
                                        >
                                            <MoreVertical size={14} />
                                        </button>
                                        {activeDeviceMenu === hashId && (
                                            <div 
                                                className="absolute right-0 mt-2 w-32 rounded-md shadow-lg bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] ring-1 ring-black ring-opacity-5 z-50 py-1"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="absolute -top-[5px] right-[10px] w-2.5 h-2.5 rotate-45 bg-[var(--dev-console-bg)] border-t border-l border-[var(--dev-console-border)] z-40" />
                                                
                                                <div className="relative z-50 bg-[var(--dev-console-bg)] rounded-md">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveDeviceMenu(null);
                                                            setDeviceToDelete({ hashId, deviceModel: data.deviceModel || 'Unknown Device' });
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors flex items-center gap-1.5 bg-transparent border-none cursor-pointer font-sans rounded-md"
                                                    >
                                                        <Trash2 size={12} />
                                                        <span>Delete Device</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {isExpanded && (
                                <div className="p-4">
                                    <div className="flex flex-row justify-between items-center mb-4 text-[11px] gap-4">
                                        <div className="font-mono text-[#818cf8] break-all flex-1">
                                            {highlightSearchMatchText(hashId, sessionCacheSearch, sessionCacheHighlightSearch, 'yellow')}
                                        </div>
                                        <div className="text-[var(--dev-console-text-muted)] shrink-0 font-mono">
                                            {totalDeviceSessions} sessions
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {Object.entries(data.accounts || {}).map(([username, accountData]: [string, any]) => {
                                            const sessions = (accountData.sessions || []).slice().reverse();
                                            let firstLogin = sessions.length > 0 ? sessions[sessions.length - 1].startTime : null;
                                            let lastLogin = sessions.length > 0 ? sessions[0].startTime : null;
                                            
                                            const pageKey = `${hashId}_${username}`;
                                            const currentPage = sessionPages[pageKey] || 1;
                                            const pageSize = 15;
                                            const totalSessions = sessions.length;
                                            const totalPages = Math.ceil(totalSessions / pageSize);
                                            const paginatedSessions = sessions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
                                            
                                            return (
                                                <div key={username} id={`user-info-${hashId}-${username}`} className="space-y-3 scroll-mt-10 transition-all duration-300">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                                                        <div>
                                                            <div className="text-[9px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold mb-1.5">Linked Users</div>
                                                            <div className="text-[var(--dev-console-text)] font-semibold flex flex-row flex-wrap items-center gap-x-2 gap-y-1">
                                                                <span>{highlightSearchMatchText(accountData.fullName || (username.includes('@') ? username.split('@')[0] : username), sessionCacheSearch, sessionCacheHighlightSearch, 'yellow')}</span>
                                                                {username.includes('@') && (
                                                                    <span className="text-[var(--dev-console-text-muted)] text-[10px] font-normal font-mono">({highlightSearchMatchText(username, sessionCacheSearch, sessionCacheHighlightSearch, 'yellow')})</span>
                                                                )}
                                                                {totalDeviceSessions !== sessions.length && (
                                                                    <span className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)] text-[9px] px-1.5 py-0.5 rounded font-mono">
                                                                        {sessions.length}x
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[9px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold mb-1.5">Activity Range</div>
                                                            
                                                            {/* Desktop Layout */}
                                                            <div className="hidden md:flex flex-row items-center flex-nowrap whitespace-nowrap gap-4 font-mono text-[10px] overflow-x-auto scrollbar-none">
                                                                <div className="flex flex-row items-center gap-1.5 whitespace-nowrap">
                                                                    <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold">First Login:</span>
                                                                    <RelativeTimestamp dateInput={firstLogin} />
                                                                </div>
                                                                <div className="h-4 w-px bg-[var(--dev-console-border)] shrink-0"></div>
                                                                <div className="flex flex-row items-center gap-1.5 whitespace-nowrap">
                                                                    <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold">Last Login:</span>
                                                                    <RelativeTimestamp dateInput={lastLogin} />
                                                                </div>
                                                            </div>

                                                            {/* Mobile Layout */}
                                                            <div className="grid md:hidden grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold mb-0.5">First Login</span>
                                                                    <RelativeTimestamp dateInput={firstLogin} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[var(--dev-console-text-muted)] text-[9.5px] uppercase tracking-wider font-semibold mb-0.5">Last Login</span>
                                                                    <RelativeTimestamp dateInput={lastLogin} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="border-y border-x-0 border-[var(--dev-console-border)] rounded-none -mx-4 bg-[var(--dev-console-bg)] shadow-sm relative">
                                                        <div className="bg-[var(--dev-console-bg-active)] px-4 py-1.5 border-b border-[var(--dev-console-border)] flex items-center justify-between gap-3">
                                                            <span className="font-bold text-[11px] text-[var(--dev-console-text)]">Recent Sessions</span>
                                                            <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        const key = `${hashId}_${username}`;
                                                                        setActiveRecentSessionsMenu(activeRecentSessionsMenu === key ? null : key);
                                                                        setActiveDeviceMenu(null);
                                                                        setActiveSessionMenu(null);
                                                                    }}
                                                                    className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors p-1 bg-transparent border-none outline-none hover:bg-neutral-500/10 rounded cursor-pointer shrink-0 flex items-center justify-center"
                                                                    title="More Actions"
                                                                >
                                                                    <MoreVertical size={13} />
                                                                </button>
                                                                {activeRecentSessionsMenu === `${hashId}_${username}` && (
                                                                    <div 
                                                                        className="absolute right-0 mt-2 w-32 rounded-md shadow-lg bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] ring-1 ring-black ring-opacity-5 z-50 py-1"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <div className="absolute -top-[5px] right-[10px] w-2.5 h-2.5 rotate-45 bg-[var(--dev-console-bg)] border-t border-l border-[var(--dev-console-border)] z-40" />
                                                                        
                                                                        <div className="relative z-50 bg-[var(--dev-console-bg)] rounded-md">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setActiveRecentSessionsMenu(null);
                                                                                    setDeviceToDelete({ hashId, deviceModel: data.deviceModel || 'Unknown Device' });
                                                                                }}
                                                                                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors flex items-center gap-1.5 bg-transparent border-none cursor-pointer font-sans rounded-md"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                                <span>Delete Device</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                                            <table className="w-full text-center border-collapse min-w-[1250px]">
                                                                <thead>
                                                                    <tr className="text-[9px] uppercase tracking-widest text-[var(--dev-console-text-muted)] font-bold">
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">User</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Session Key</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Browser</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Version</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">OS</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">OS Version</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Mode</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Start Time</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">End Time</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Location/IP</th>
                                                                        <th 
                                                                            className="px-2 py-2 font-medium whitespace-nowrap text-center cursor-pointer hover:text-[#818cf8] transition-colors select-none"
                                                                            onClick={() => {
                                                                                if (sessions && sessions.length > 0) {
                                                                                    const firstSessionId = sessions[0].sessionId;
                                                                                    const nextUnit = sessionDurationUnits[firstSessionId] === 'm' ? 's' : 'm';
                                                                                    const next: Record<string, 's' | 'm'> = { ...sessionDurationUnits };
                                                                                    sessions.forEach((s: any) => { next[s.sessionId] = nextUnit; });
                                                                                    setSessionDurationUnits(next);
                                                                                }
                                                                            }}
                                                                            title="Click to toggle all durations: Seconds <-> Minutes/Seconds"
                                                                        >
                                                                            Duration
                                                                        </th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Status</th>
                                                                        <th className="px-2 py-2 font-medium whitespace-nowrap text-center">Action</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="text-[10px] font-mono divide-y divide-[var(--dev-console-border)]/50">
                                                                    {paginatedSessions.map((s: any, idx: number) => {
                                                                        const isCurrentDeleting = deletingSessionId === s.sessionId;
                                                                        const rowBgColors: Record<string, string> = {
                                                                            active: 'bg-emerald-500/5 dark:bg-emerald-500/10',
                                                                            background: 'bg-purple-500/5 dark:bg-purple-500/10',
                                                                            tab_closed: 'bg-indigo-500/5 dark:bg-indigo-500/10',
                                                                            abandoned: 'bg-amber-500/5 dark:bg-amber-500/10',
                                                                            logged_out: 'bg-neutral-500/5 dark:bg-neutral-500/10',
                                                                            terminated: 'bg-red-500/5 dark:bg-red-500/10',
                                                                        };
                                                                        const rowBgClass = rowBgColors[s.status] || '';
                                                                        return (
                                                                            <tr 
                                                                                key={idx} 
                                                                                id={`session-row-${s.sessionId}`}
                                                                                className={`hover:bg-[var(--dev-console-bg-hover)] transition-colors group duration-300 ${rowBgClass}`}
                                                                            >
                                                                                <td 
                                                                                    className="px-2 py-1.5 truncate max-w-[180px] cursor-pointer whitespace-nowrap text-center" 
                                                                                    onClick={(e) => { e.currentTarget.classList.toggle('truncate'); e.currentTarget.classList.toggle('whitespace-normal'); e.currentTarget.classList.toggle('break-all'); e.currentTarget.classList.toggle('max-w-[180px]'); }}
                                                                                    title={username}
                                                                                >
                                                                                    <div className="flex items-center justify-center gap-1.5 inline-flex text-[var(--dev-console-text)]">
                                                                                        {s.provider === 'google' ? (
                                                                                            <span title="Logged in with Google" className="inline-flex shrink-0 cursor-help text-[var(--dev-console-text)]">
                                                                                                <GoogleIcon />
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span title="Logged in with Email & Password" className="inline-flex shrink-0 cursor-help text-[var(--dev-console-text)]">
                                                                                                <EmailIcon />
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="text-[var(--dev-console-text)]">{highlightSearchMatchText(username, sessionCacheSearch, sessionCacheHighlightSearch, 'yellow')}</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td 
                                                                                    className="px-2 py-1.5 truncate max-w-[120px] cursor-pointer whitespace-nowrap text-center text-[var(--dev-console-text-muted)] text-[9px]" 
                                                                                    onClick={(e) => { e.currentTarget.classList.toggle('truncate'); e.currentTarget.classList.toggle('whitespace-normal'); e.currentTarget.classList.toggle('break-all'); e.currentTarget.classList.toggle('max-w-[120px]'); }}
                                                                                    title={s.sessionId}
                                                                                >
                                                                                    {highlightSearchMatchText(s.sessionId, sessionCacheSearch, sessionCacheHighlightSearch, 'blue')}
                                                                                </td>
                                                                                <BrowserCell session={s} searchQuery={sessionCacheSearch} highlightEnabled={sessionCacheHighlightSearch} />
                                                                                <td className="px-2 py-1.5 text-center text-[var(--dev-console-text)] whitespace-nowrap">
                                                                                    {s.browser_version || <span className="text-[var(--dev-console-text-muted)]">-</span>}
                                                                                </td>
                                                                                <OSCell session={s} searchQuery={sessionCacheSearch} highlightEnabled={sessionCacheHighlightSearch} />
                                                                                <td className="px-2 py-1.5 text-center text-[var(--dev-console-text-muted)] whitespace-nowrap">
                                                                                    {s.os_version || <span className="text-[var(--dev-console-text-muted)]">-</span>}
                                                                                </td>
                                                                                <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                                                                    {s.is_incognito ? (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                                                                                            <EyeOff className="w-2.5 h-2.5 mr-1" />
                                                                                            Private
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                                                                            Normal
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="px-2 py-1.5 text-[var(--dev-console-text)] whitespace-nowrap text-center">{formatSessionDateTime(s.startTime)}</td>
                                                                                <td className="px-2 py-1.5 text-[var(--dev-console-text)] whitespace-nowrap text-center">{s.endTime ? formatSessionDateTime(s.endTime) : <span className="text-[var(--dev-console-text-muted)]">-</span>}</td>
                                                                                <td className="px-2 py-1.5 whitespace-nowrap text-center">
                                                                                    <div 
                                                                                        className="flex flex-row items-center justify-center gap-1.5 max-w-[200px] cursor-pointer mx-auto"
                                                                                        onClick={(e) => { 
                                                                                            e.currentTarget.classList.toggle('max-w-[200px]'); 
                                                                                            const spans = e.currentTarget.querySelectorAll('span');
                                                                                            spans.forEach(span => {
                                                                                                span.classList.toggle('truncate');
                                                                                                span.classList.toggle('whitespace-normal');
                                                                                                span.classList.toggle('break-words');
                                                                                                span.classList.toggle('max-w-[200px]');
                                                                                            });
                                                                                        }}
                                                                                    >
                                                                                        {s.location && <span className="truncate text-[var(--dev-console-text)] whitespace-nowrap">{highlightSearchMatchText(s.location, sessionCacheSearch, sessionCacheHighlightSearch, 'green')}</span>}
                                                                                        {s.ip && <span className="text-[9px] text-[var(--dev-console-text-muted)] truncate whitespace-nowrap">• {highlightSearchMatchText(s.ip, sessionCacheSearch, sessionCacheHighlightSearch, 'green')}</span>}
                                                                                    </div>
                                                                                </td>
                                                                                <SessionDuration
                                                                                    startTime={s.startTime}
                                                                                    endTime={s.endTime}
                                                                                    initialDuration={s.duration || s.durationSecs || 0}
                                                                                    status={s.status}
                                                                                    isMinutes={sessionDurationUnits[s.sessionId] === 'm'}
                                                                                    onToggle={() => {
                                                                                        setSessionDurationUnits(prev => ({
                                                                                            ...prev,
                                                                                            [s.sessionId]: prev[s.sessionId] === 'm' ? 's' : 'm'
                                                                                        }));
                                                                                    }}
                                                                                />
                                                                                <td className="px-2 py-1.5 text-center">
                                                                                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide whitespace-nowrap ${
                                                                                        s.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 
                                                                                        s.status === 'background' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:text-purple-400 dark:bg-purple-500/10 dark:border-purple-500/20' :
                                                                                        s.status === 'tab_closed' ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/20' :
                                                                                        s.status === 'abandoned' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20' :
                                                                                        s.status === 'logged_out' ? 'bg-neutral-500/10 text-neutral-600 border border-neutral-500/20 dark:text-neutral-400 dark:bg-neutral-500/10 dark:border-neutral-500/20' : 
                                                                                        s.status === 'terminated' ? 'bg-red-500/10 text-red-600 border border-red-500/20 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20' :
                                                                                        'bg-[var(--dev-console-bg-active)] text-[var(--dev-console-text-muted)] border border-[var(--dev-console-border)]'
                                                                                    }`}>
                                                                                        {s.status === 'active' ? 'Logged In' : s.status === 'background' ? 'Background' : s.status === 'tab_closed' ? 'Tab Closed' : s.status === 'abandoned' ? 'Abandoned' : s.status === 'logged_out' ? 'Logged Out' : s.status === 'terminated' ? 'Terminated' : s.status}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-2 py-1.5 text-center">
                                                                                    {deletingSessionId === s.sessionId ? (
                                                                                        <div className="flex items-center justify-center gap-1 font-sans">
                                                                                            <button 
                                                                                                disabled={isDeletingSession !== null}
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setDeletingSessionId(null);
                                                                                                }}
                                                                                                className="px-1.5 py-0.5 bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] rounded text-[9px] cursor-pointer transition-colors hover:bg-[var(--dev-console-bg-hover)] shrink-0 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                Cancel
                                                                                            </button>
                                                                                            <button 
                                                                                                disabled={isDeletingSession !== null}
                                                                                                onClick={async (e) => {
                                                                                                    e.stopPropagation();
                                                                                                    if (isDeletingSession) return;
                                                                                                    setIsDeletingSession(s.sessionId);
                                                                                                    await deleteSingleSession(hashId, username, s.sessionId);
                                                                                                }}
                                                                                                className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[9px] cursor-pointer transition-colors shrink-0 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                            >
                                                                                                {isDeletingSession === s.sessionId ? '...' : 'Confirm'}
                                                                                            </button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                setDeletingSessionId(s.sessionId);
                                                                                            }}
                                                                                            className="text-red-500 hover:text-red-600 p-1 bg-transparent border-none outline-none hover:bg-red-500/10 rounded cursor-pointer flex items-center justify-center mx-auto transition-colors"
                                                                                            title="Delete Session"
                                                                                        >
                                                                                            <Trash2 size={13} />
                                                                                        </button>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        
                                                        {totalPages > 1 && (
                                                            <div className="bg-[var(--dev-console-bg-active)] border-t border-[var(--dev-console-border)] px-4 py-2 flex items-center justify-between gap-3 text-[11px] font-sans">
                                                                <button
                                                                    disabled={currentPage === 1}
                                                                    onClick={() => setSessionPages(prev => ({ ...prev, [pageKey]: currentPage - 1 }))}
                                                                    className="px-2.5 py-1 rounded border border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium bg-transparent cursor-pointer"
                                                                >
                                                                    Prev
                                                                </button>
                                                                <span className="text-[var(--dev-console-text-muted)] font-mono text-[10px]">
                                                                    Page {currentPage} of {totalPages}
                                                                </span>
                                                                <button
                                                                    disabled={currentPage === totalPages}
                                                                    onClick={() => setSessionPages(prev => ({ ...prev, [pageKey]: currentPage + 1 }))}
                                                                    className="px-2.5 py-1 rounded border border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium bg-transparent cursor-pointer"
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
        </div>
    );
};
