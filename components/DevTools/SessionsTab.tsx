import React, { useEffect } from 'react';
import { 
    X, Search, Database, Activity, Clock, EyeOff, 
    ArrowLeftRight, Loader2, ChevronDown, ChevronUp 
} from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { DateTimePicker } from '../DateTimePicker';
import { useSessions } from './useSessions';
import { DevSelect } from './UIComponents';
import { MetricsSummary, DeviceAccordion } from './SessionComponents';

interface SessionsTabProps {
    isOpen: boolean;
    onActiveDevicesCountChange?: (count: number) => void;
    clearTrigger?: number;
}

export const SessionsTab: React.FC<SessionsTabProps> = ({ 
    isOpen, 
    onActiveDevicesCountChange, 
    clearTrigger = 0 
}) => {
    const {
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
        getSessionMatches,
        scrollToMatch,
        deleteSingleSession,
        deleteDeviceSessions,
        deleteAllSessions
    } = useSessions({ isOpen, onActiveDevicesCountChange, clearTrigger });

    if (!isOpen) return null;

    const devices = Object.keys(sessionCacheData).filter(k => k !== '_summary' && k !== '_resultSummary');
    const isAllCollapsed = devices.length > 0 && devices.every(id => !expandedDevices[id]);
    const toggleExpandAll = () => {
        if (isAllCollapsed) {
            const next: Record<string, boolean> = {};
            devices.forEach(id => { next[id] = true; });
            setExpandedDevices(next);
        } else {
            setExpandedDevices({});
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full bg-[var(--dev-console-bg)] relative">
            {/* Toolbar Filter Section */}
            <div className="flex-none border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] w-full relative z-20">
                {/* Mobile View Layout (md:hidden) */}
                <div className="md:hidden flex flex-col gap-2 p-2">
                    <div className="flex items-center gap-2 w-full min-w-0">
                        <div className="flex-1 flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 focus-within:border-[#007fd4] transition-colors h-8">
                            <input 
                                className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans h-full" 
                                placeholder="Search email, browser, IP..." 
                                value={sessionCacheSearchInput} 
                                onChange={e => setSessionCacheSearchInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') setSessionCacheSearch(sessionCacheSearchInput); }}
                            />
                            {sessionCacheSearchInput && (
                                <button onClick={() => { setSessionCacheSearchInput(''); setSessionCacheSearch(''); }} className="shrink-0 ml-1">
                                    <X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" />
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={() => setSessionCacheSearch(sessionCacheSearchInput)}
                            disabled={isSessionCacheLoading}
                            className="text-[10px] text-white bg-[#007fd4] hover:bg-[#0060a3] disabled:bg-[#007fd4]/50 disabled:cursor-not-allowed border-none rounded px-3 py-1.5 transition-all font-sans shrink-0 h-8 uppercase font-bold cursor-pointer flex items-center gap-1.5 shadow-sm shadow-[#007fd4]/20"
                            title="Search"
                        >
                            {isSessionCacheLoading ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Search size={12} />
                            )}
                            <span className="inline">{isSessionCacheLoading ? 'Searching' : 'Search'}</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1 w-full bg-[var(--dev-console-bg)]/50 p-1 rounded">
                        <div className="min-w-0">
                            <DevSelect
                                value={sessionCacheStatus}
                                onChange={(val: any) => setSessionCacheStatus(val)}
                                icon={<Activity size={12} />}
                                options={[
                                    { label: 'All Status', value: 'all' },
                                    { label: 'Active', value: 'active' },
                                    { label: 'Abandoned', value: 'abandoned' },
                                    { label: 'Terminated', value: 'terminated' },
                                    { label: 'Logged Out', value: 'logged_out' },
                                ]}
                                align="left"
                            />
                        </div>
                        <div className="min-w-0">
                            <DevSelect
                                value={sessionCacheTime}
                                onChange={(val: any) => setSessionCacheTime(val)}
                                icon={<Clock size={12} />}
                                options={[
                                    { label: 'All Time', value: 'all' },
                                    { label: 'Last 24h', value: '24h' },
                                    { label: 'Last 7d', value: '7d' },
                                    { label: 'Last 30d', value: '30d' },
                                    { label: 'Custom Range', value: 'custom' },
                                ]}
                                align="left"
                            />
                        </div>
                        <div className="min-w-0">
                            <DevSelect
                                value={sessionCacheIncognito}
                                onChange={(val: any) => setSessionCacheIncognito(val)}
                                icon={<EyeOff size={12} />}
                                options={[
                                    { label: 'All Modes', value: 'all' },
                                    { label: 'Normal Mode', value: 'normal' },
                                    { label: 'Private Mode', value: 'private' },
                                ]}
                                align="right"
                            />
                        </div>
                        <div className="min-w-0">
                            <DevSelect
                                value={sessionCacheLimit}
                                onChange={(val: any) => setSessionCacheLimit(Number(val))}
                                icon={<Database size={12} />}
                                options={[
                                    { label: '100 Limit', value: 100 },
                                    { label: '500 Limit', value: 500 },
                                    { label: '1000 Limit', value: 1000 },
                                    { label: 'No Limit', value: 0 },
                                ]}
                                align="right"
                            />
                        </div>
                    </div>
                </div>

                {/* Desktop View Layout (hidden md:flex) */}
                <div className="hidden md:flex md:items-center gap-3 py-1.5 px-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-[120px] min-w-0">
                            <DevSelect
                                value={sessionCacheStatus}
                                onChange={(val: any) => setSessionCacheStatus(val)}
                                icon={<Activity size={12} />}
                                options={[
                                    { label: 'All Status', value: 'all' },
                                    { label: 'Active', value: 'active' },
                                    { label: 'Abandoned', value: 'abandoned' },
                                    { label: 'Terminated', value: 'terminated' },
                                    { label: 'Logged Out', value: 'logged_out' },
                                ]}
                                align="left"
                            />
                        </div>
                        <div className="w-[110px] min-w-0">
                            <DevSelect
                                value={sessionCacheTime}
                                onChange={(val: any) => setSessionCacheTime(val)}
                                icon={<Clock size={12} />}
                                options={[
                                    { label: 'All Time', value: 'all' },
                                    { label: 'Last 24h', value: '24h' },
                                    { label: 'Last 7d', value: '7d' },
                                    { label: 'Last 30d', value: '30d' },
                                    { label: 'Custom Range', value: 'custom' },
                                ]}
                                align="left"
                            />
                        </div>
                        <div className="w-[125px] min-w-0">
                            <DevSelect
                                value={sessionCacheIncognito}
                                onChange={(val: any) => setSessionCacheIncognito(val)}
                                icon={<EyeOff size={12} />}
                                options={[
                                    { label: 'All Modes', value: 'all' },
                                    { label: 'Normal Mode', value: 'normal' },
                                    { label: 'Private Mode', value: 'private' },
                                ]}
                                align="right"
                            />
                        </div>
                        <div className="w-[100px] min-w-0">
                            <DevSelect
                                value={sessionCacheLimit}
                                onChange={(val: any) => setSessionCacheLimit(Number(val))}
                                icon={<Database size={12} />}
                                options={[
                                    { label: '100 Limit', value: 100 },
                                    { label: '500 Limit', value: 500 },
                                    { label: '1000 Limit', value: 1000 },
                                    { label: 'No Limit', value: 0 },
                                ]}
                                align="right"
                            />
                        </div>
                    </div>

                    <div className="flex-1 flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 focus-within:border-[#007fd4] transition-colors h-8">
                        <input 
                            className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans h-full" 
                            placeholder="Search email, browser, IP..." 
                            value={sessionCacheSearchInput} 
                            onChange={e => setSessionCacheSearchInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') setSessionCacheSearch(sessionCacheSearchInput); }}
                        />
                        {sessionCacheSearchInput && (
                            <button onClick={() => { setSessionCacheSearchInput(''); setSessionCacheSearch(''); }} className="shrink-0 ml-1">
                                <X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" />
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={() => setSessionCacheSearch(sessionCacheSearchInput)}
                        disabled={isSessionCacheLoading}
                        className="text-[10px] text-white bg-[#007fd4] hover:bg-[#0060a3] disabled:bg-[#007fd4]/50 disabled:cursor-not-allowed border-none rounded px-3 py-1.5 transition-all font-sans shrink-0 h-8 uppercase font-bold cursor-pointer flex items-center gap-1.5 shadow-sm shadow-[#007fd4]/20"
                        title="Search"
                    >
                        {isSessionCacheLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Search size={12} />
                        )}
                        <span className="inline">{isSessionCacheLoading ? 'Searching' : 'Search'}</span>
                    </button>
                </div>

                {/* Sub-row for custom date/time range inputs */}
                {sessionCacheTime === 'custom' && (
                    <div className="bg-transparent px-2 md:px-2.5 py-1 flex flex-row items-center gap-x-2 text-xs font-sans w-full shrink-0 relative z-30 overflow-visible">
                        <DateTimePicker 
                            value={sessionCacheStartDate} 
                            onChange={setSessionCacheStartDate}
                            placeholder="Select Start Time"
                            align="left"
                            variant="containerless"
                        />
                        
                        <button
                            onClick={() => {
                                const temp = sessionCacheStartDate;
                                setSessionCacheStartDate(sessionCacheEndDate);
                                setSessionCacheEndDate(temp);
                            }}
                            className="p-1 hover:bg-[var(--dev-console-bg-hover)] rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-all cursor-pointer shrink-0"
                            title="Swap Start & End"
                        >
                            <ArrowLeftRight size={11} />
                        </button>

                        <DateTimePicker 
                            value={sessionCacheEndDate} 
                            onChange={setSessionCacheEndDate}
                            placeholder="Select End Time"
                            align="right"
                            variant="containerless"
                        />
                        {(sessionCacheStartDate || sessionCacheEndDate) && (
                            <button 
                                onClick={() => { setSessionCacheStartDate(''); setSessionCacheEndDate(''); }}
                                className="text-[8px] md:text-[9px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider transition-colors shrink-0 h-[24px] md:h-[26px] flex items-center justify-center bg-transparent hover:bg-red-500/10 px-1.5 md:px-2 rounded border-0 cursor-pointer gap-1"
                            >
                                <X size={11} className="shrink-0" />
                                <span>Clear</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Main scrollable body with metrics and table */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent flex flex-col">
                <MetricsSummary sessionCacheData={sessionCacheData} />

                <div className="flex-1 p-4 relative min-h-[300px] flex flex-col pb-16">
                    <h3 className="text-xs font-bold text-[var(--dev-console-text)] tracking-wider mb-4 border-b border-[var(--dev-console-border)] pb-2 flex items-center justify-between gap-4">
                        <span className="whitespace-nowrap">Device Sessions Details</span>
                        <div className="flex items-center gap-3 shrink-0 ml-auto">
                            {sessionCacheData._resultSummary && (
                                <span className="text-[9px] text-[var(--dev-console-text-muted)] font-mono whitespace-nowrap font-normal">
                                    {sessionCacheLimit === 0 ? (
                                        `Showing ${sessionCacheData._resultSummary.totalMatches} results`
                                    ) : (
                                        `Showing ${sessionCacheData._resultSummary.returned} of ${sessionCacheData._resultSummary.totalMatches} results`
                                    )}
                                </span>
                            )}
                            <div className="hidden md:flex items-center gap-2 shrink-0">
                                <button
                                    onClick={toggleExpandAll}
                                    className="text-[10px] text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] flex items-center gap-1.5 bg-transparent border-0 rounded px-1.5 py-1 transition-colors font-sans shrink-0 uppercase font-bold cursor-pointer"
                                >
                                    {isAllCollapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                                    <span>{isAllCollapsed ? 'Expand All' : 'Collapse All'}</span>
                                </button>
                            </div>
                        </div>
                    </h3>

                    {isSessionCacheLoading ? (
                        <div className="h-60 flex flex-col items-center justify-center text-[var(--dev-console-text-muted)] gap-3 transition-all duration-200">
                            <div className="relative flex items-center justify-center">
                                <div className="w-12 h-12 border-2 border-[#007fd4]/20 border-t-[#007fd4] rounded-full animate-spin"></div>
                                <Search size={16} className="absolute text-[#007fd4] animate-pulse" />
                            </div>
                            <div className="flex flex-col items-center gap-1 text-center">
                                <span className="text-[11px] font-bold tracking-widest text-[#007fd4] uppercase animate-pulse">Searching Sessions...</span>
                                <span className="text-[9px] text-[var(--dev-console-text-muted)]">Retrieving fresh device logs & heartbeat status</span>
                            </div>
                        </div>
                    ) : Object.keys(sessionCacheData).filter(k => k !== '_summary' && k !== '_resultSummary').length === 0 ? (
                        (() => {
                            const isEmptyDB = !sessionCacheData._summary || !sessionCacheData._summary.totalSessions || sessionCacheData._summary.totalSessions === 0;
                            return (
                                <div className="h-60 flex flex-col items-center justify-center text-[var(--dev-console-text-muted)] text-[12px] italic gap-3 px-6 text-center">
                                    <div className="p-4 bg-[var(--dev-console-bg-active)] rounded-full text-[var(--dev-console-text-muted)] opacity-50">
                                        {isEmptyDB ? <Database size={32} /> : <Search size={32} />}
                                    </div>
                                    <div className="flex flex-col gap-1 max-w-md">
                                        <span className="font-bold text-[var(--dev-console-text)] not-italic text-[13px]">
                                            {isEmptyDB ? "No Sessions Recorded Yet" : "No Matching Sessions Found"}
                                        </span>
                                        <span className="text-[11px] not-italic leading-relaxed">
                                            {isEmptyDB 
                                                ? "No device connections have been stored on this server yet. Active sessions and heartbeats will register here in real-time."
                                                : "No session cache records matched your current filters or search terms. Try widening your filters or typing a different query."}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()
                    ) : (
                        <DeviceAccordion
                            sessionCacheData={sessionCacheData}
                            sessionCacheSearch={sessionCacheSearch}
                            sessionCacheHighlightSearch={sessionCacheHighlightSearch}
                            expandedDevices={expandedDevices}
                            setExpandedDevices={setExpandedDevices}
                            activeDeviceMenu={activeDeviceMenu}
                            setActiveDeviceMenu={setActiveDeviceMenu}
                            setDeviceToDelete={setDeviceToDelete}
                            sessionPages={sessionPages}
                            setSessionPages={setSessionPages}
                            sessionDurationUnits={sessionDurationUnits}
                            setSessionDurationUnits={setSessionDurationUnits}
                            deletingSessionId={deletingSessionId}
                            setDeletingSessionId={setDeletingSessionId}
                            activeSessionMenu={activeSessionMenu}
                            setActiveSessionMenu={setActiveSessionMenu}
                            activeRecentSessionsMenu={activeRecentSessionsMenu}
                            setActiveRecentSessionsMenu={setActiveRecentSessionsMenu}
                            isDeletingSession={isDeletingSession}
                            setIsDeletingSession={setDeletingSessionId}
                            deleteSingleSession={deleteSingleSession}
                        />
                    )}
                </div>
            </div>

            {/* Mass delete confirmation modal */}
            <ConfirmationModal 
                isOpen={showMassDeleteConfirm}
                onClose={() => setShowMassDeleteConfirm(false)}
                onConfirm={deleteAllSessions}
                title="Wipe Session Cache DB"
                message="Are you absolutely sure you want to permanently delete ALL recorded sessions, history records, and linked devices? This action is irreversible."
                confirmButtonText={isDeletingAllSessions ? "Wiping..." : "Delete All"}
                confirmButtonVariant="danger"
                isLoading={isDeletingAllSessions}
            />

            {/* Device delete confirmation modal */}
            <ConfirmationModal 
                isOpen={deviceToDelete !== null}
                onClose={() => setDeviceToDelete(null)}
                onConfirm={() => {
                    if (deviceToDelete) {
                        deleteDeviceSessions(deviceToDelete.hashId);
                    }
                }}
                title="Wipe Device History"
                message={`Are you sure you want to delete all session history, device settings, and credentials for ${deviceToDelete?.deviceModel}?`}
                confirmButtonText={isDeletingDevice ? "Deleting..." : "Delete Device"}
                confirmButtonVariant="danger"
                isLoading={isDeletingDevice}
            />

            {/* Floating Search Toolbar overlay */}
            {sessionCacheSearch && sessionCacheSearch.trim() && (
                <div className="absolute bottom-0 left-0 right-0 md:bottom-auto md:top-2 md:right-4 md:left-auto md:w-auto z-50 bg-[var(--dev-console-bg)] border-t md:border border-[var(--dev-console-border)] rounded-none md:rounded-md shadow-none py-2 px-4 flex items-center justify-between md:justify-start gap-3 font-sans text-xs">
                    <div className="flex items-center gap-1.5 text-[var(--dev-console-text)] font-semibold border-r border-[var(--dev-console-border)] pr-3 shrink-0">
                        <Search size={12} className="text-[#007fd4]" />
                        <span>
                            {getSessionMatches().length > 0 ? (
                                `${activeMatchIndex + 1} of ${getSessionMatches().length}`
                            ) : (
                                "No matches"
                            )}
                        </span>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors select-none shrink-0">
                        <input
                            type="checkbox"
                            checked={sessionCacheHighlightSearch}
                            onChange={(e) => setSessionCacheHighlightSearch(e.target.checked)}
                            className="rounded border-[var(--dev-console-border)] bg-transparent text-[#007fd4] focus:ring-0 cursor-pointer"
                        />
                        <span className="text-[10px]">Highlight</span>
                    </label>

                    {sessionCacheHighlightSearch && (
                        <>
                            <div className="w-px h-3 bg-[var(--dev-console-border)] shrink-0"></div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    disabled={getSessionMatches().length === 0}
                                    onClick={() => {
                                        const matches = getSessionMatches();
                                        if (matches.length === 0) return;
                                        const prevIndex = (activeMatchIndex - 1 + matches.length) % matches.length;
                                        setActiveMatchIndex(prevIndex);
                                        scrollToMatch(matches[prevIndex]);
                                    }}
                                    className="p-1 text-[var(--dev-console-text-muted)] hover:text-[#007fd4] disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors cursor-pointer bg-transparent border-0 flex items-center justify-center outline-none"
                                    title="Previous Match"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    disabled={getSessionMatches().length === 0}
                                    onClick={() => {
                                        const matches = getSessionMatches();
                                        if (matches.length === 0) return;
                                        const nextIndex = (activeMatchIndex + 1) % matches.length;
                                        setActiveMatchIndex(nextIndex);
                                        scrollToMatch(matches[nextIndex]);
                                    }}
                                    className="p-1 text-[var(--dev-console-text-muted)] hover:text-[#007fd4] disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors cursor-pointer bg-transparent border-0 flex items-center justify-center outline-none"
                                    title="Next Match"
                                >
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </>
                    )}

                    <div className="w-px h-3 bg-[var(--dev-console-border)] shrink-0"></div>

                    <button
                        onClick={() => {
                            setSessionCacheSearchInput('');
                            setSessionCacheSearch('');
                        }}
                        className="p-1 text-[var(--dev-console-text-muted)] hover:text-red-500 rounded transition-colors cursor-pointer bg-transparent border-0 flex items-center justify-center outline-none shrink-0"
                        title="Clear Search"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
};
