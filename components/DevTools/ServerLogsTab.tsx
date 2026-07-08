import React, { useState } from 'react';
import { Filter, X, Terminal, Info as InfoIcon, AlertTriangle, AlertCircle, Copy, Check, Cpu } from 'lucide-react';
import { renderLogMessageWithBadges } from './UIComponents';

interface ServerLog {
    id: string;
    type: 'log' | 'info' | 'warn' | 'error';
    timestamp: string;
    message: string;
}

interface ServerLogsTabProps {
    serverLogsList: ServerLog[];
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
}

export const ServerLogsTab: React.FC<ServerLogsTabProps> = ({ serverLogsList, copiedId, handleCopy }) => {
    const [serverLogsFilter, setServerLogsFilter] = useState('');
    const [serverLogsLevel, setServerLogsLevel] = useState<'all' | 'log' | 'info' | 'warn' | 'error'>('all');

    const filteredServerLogs = serverLogsList.filter(log => {
        if (serverLogsLevel !== 'all' && log.type !== serverLogsLevel) return false;
        if (serverLogsFilter && !log.message.toLowerCase().includes(serverLogsFilter.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
            {/* Toolbar */}
            <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center px-3 gap-3 w-full">
                <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                    <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-2" />
                    <input 
                        className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)]" 
                        placeholder="Filter server logs" 
                        value={serverLogsFilter} 
                        onChange={e => setServerLogsFilter(e.target.value)} 
                    />
                    {serverLogsFilter && <button onClick={() => setServerLogsFilter('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                </div>
                <div className="h-4 w-px bg-[var(--dev-console-border)]"></div>
                <div className="flex gap-1">
                    {(['all', 'log', 'info', 'warn', 'error'] as const).map(level => (
                        <button
                            key={level}
                            onClick={() => setServerLogsLevel(level)}
                            className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 transition-colors ${serverLogsLevel === level ? 'bg-[#007fd4]/20 text-[#007fd4]' : 'text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'}`}
                        >
                            {level === 'log' && <Terminal size={12} className="text-neutral-400" />}
                            {level === 'info' && <InfoIcon size={12} className="text-[#8be9fd]" />}
                            {level === 'warn' && <AlertTriangle size={12} className="text-[#ffb86c]" />}
                            {level === 'error' && <AlertCircle size={12} className="text-[#ff8080]" />}
                            <span className="capitalize">{level}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                <div className="flex flex-col min-h-full">
                    {filteredServerLogs.length === 0 && (
                        <div className="text-[var(--dev-console-text-muted)] italic p-6 text-center text-xs flex flex-col items-center gap-2">
                            <Cpu size={32} className="opacity-20 mb-2 animate-pulse" />
                            {serverLogsList.length > 0 ? 'No server logs match your filter.' : 'Server logs are empty.'}
                        </div>
                    )}
                    {filteredServerLogs.map((log) => {
                        const dateStr = new Date(log.timestamp).toLocaleString();
                        return (
                            <div key={log.id} className={`group py-2.5 px-3 sm:px-5 border-b border-[var(--dev-console-border)] flex flex-col gap-1.5 transition-colors ${
                                log.type === 'error' ? 'bg-red-500/5 dark:bg-[#290000]/15 border-l-[3px] border-l-red-500' : 
                                log.type === 'warn' ? 'bg-amber-500/5 dark:bg-[#332b00]/15 border-l-[3px] border-l-amber-500' : 
                                log.type === 'info' ? 'bg-cyan-500/5 dark:bg-[#8be9fd]/5 border-l-[3px] border-l-cyan-500 dark:border-l-[#8be9fd]' : 
                                'border-l-[3px] border-l-transparent text-[var(--dev-console-text)]'
                            } hover:bg-[var(--dev-console-bg-hover)]`}>
                                {/* Timestamp separate on top with type icon before it if not standard log */}
                                <div className="flex items-center gap-1.5 text-[9px] font-mono select-none tracking-wider opacity-85">
                                    {(log.type === 'info' || log.type === 'warn' || log.type === 'error') && (
                                        <span className="flex items-center gap-1 shrink-0">
                                            {log.type === 'info' && <InfoIcon size={12} className="text-cyan-600 dark:text-[#8be9fd]" />}
                                            {log.type === 'warn' && <AlertTriangle size={12} className="text-amber-600 dark:text-[#ffb86c]" />}
                                            {log.type === 'error' && <AlertCircle size={12} className="text-red-500 dark:text-[#ff8080]" />}
                                        </span>
                                    )}
                                    <span className="text-neutral-500 dark:text-neutral-400">{dateStr}</span>
                                </div>
                                
                                {/* Log Content main row */}
                                <div className="flex items-start gap-2.5 sm:gap-3.5 text-[10px] sm:text-[12px] leading-relaxed">
                                    <div className="flex-1 min-w-0 font-mono text-[var(--dev-console-text)] break-all sm:break-words whitespace-pre-wrap">
                                        {renderLogMessageWithBadges(log.message)}
                                    </div>
                                    <button 
                                        onClick={() => handleCopy(log.message, log.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--dev-console-bg-active)] rounded flex-none self-start transition-opacity"
                                        title="Copy log text"
                                    >
                                        {copiedId === log.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" />}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
