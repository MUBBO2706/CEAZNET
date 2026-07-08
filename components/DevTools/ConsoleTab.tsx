import React, { useState, useEffect, useRef } from 'react';
import { Filter, X, AlertTriangle, AlertCircle, ChevronRight, Terminal, Info as InfoIcon, Check, Copy } from 'lucide-react';
import { logs, listeners } from './store';
import { renderLogMessageWithBadges } from './UIComponents';

interface ConsoleTabProps {
    isOpen: boolean;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
}

export const ConsoleTab: React.FC<ConsoleTabProps> = ({ isOpen, copiedId, handleCopy }) => {
    const [consoleFilter, setConsoleFilter] = useState('');
    const [consoleLevel, setConsoleLevel] = useState<'all' | 'log' | 'info' | 'warn' | 'error'>('all');
    const [consoleInput, setConsoleInput] = useState('');
    const [, forceRender] = useState(0);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Subscribe to store updates
    useEffect(() => {
        const listener = () => forceRender(n => n + 1);
        listeners.push(listener);
        return () => {
            const idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
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
                } else {
                    forceRender(n => n + 1);
                }
            } catch (error: any) {
                console.error(error);
            } finally {
                setTimeout(() => { (window as any).__fromConsole = false; }, 50);
            }
        }, 10);
    };

    // Auto-scroll logic
    useEffect(() => {
        if (isOpen) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [logs.length, isOpen, consoleFilter, consoleLevel]);

    const filteredLogs = logs.filter(log => {
        if (consoleLevel !== 'all' && log.type !== consoleLevel) return false;
        if (consoleFilter && !log.args.join(' ').toLowerCase().includes(consoleFilter.toLowerCase())) return false;
        return true;
    });

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
            {/* Console Toolbar */}
            <div className="flex-none h-8 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-bg-hover)] flex items-center px-3 gap-3 w-full">
                <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                    <Filter size={12} className="text-[var(--dev-console-text-muted)] mr-2" />
                    <input 
                        className="bg-transparent text-[11px] text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)]" 
                        placeholder="Filter logs" 
                        value={consoleFilter} 
                        onChange={e => setConsoleFilter(e.target.value)}
                    />
                    {consoleFilter && <button onClick={() => setConsoleFilter('')}><X size={12} className="text-neutral-400 hover:text-white" /></button>}
                </div>
                <div className="h-4 w-px bg-neutral-600"></div>
                <div className="flex gap-1">
                    {(['all', 'info', 'warn', 'error'] as const).map(level => (
                        <button
                            key={level}
                            onClick={() => setConsoleLevel(level)}
                            className={`px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 transition-colors ${consoleLevel === level ? 'bg-[#007fd4]/20 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'}`}
                        >
                            {level === 'info' && <InfoIcon size={12} className="text-[#8be9fd]" />}
                            {level === 'warn' && <AlertTriangle size={12} className="text-[#ffb86c]" />}
                            {level === 'error' && <AlertCircle size={12} className="text-[#ff8080]" />}
                            <span className="capitalize">{level}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                <div className="flex flex-col min-h-full">
                    {filteredLogs.length === 0 && (
                        <div className="text-[var(--dev-console-text-muted)] italic p-6 text-center text-xs flex flex-col items-center gap-2">
                            <Terminal size={32} className="opacity-20 mb-2" />
                            {logs.length > 0 ? 'No logs match your filter.' : 'Console is clear.'}
                        </div>
                    )}
                    {filteredLogs.map((log) => (
                        <div key={log.id} className={`group py-2 px-2 sm:px-4 border-b border-[var(--dev-console-border)] break-words whitespace-pre-wrap flex gap-2 sm:gap-3 text-[10px] sm:text-[12px] leading-relaxed ${
                            log.type === 'error' ? 'bg-[#290000]/10 text-[#ff8080] border-l-[3px] border-l-[#ff8080]' : 
                            log.type === 'warn' ? 'bg-[#332b00]/10 text-[#ffb86c] border-l-[3px] border-l-[#ffb86c]' : 
                            log.type === 'info' ? 'text-[#8be9fd] border-l-[3px] border-l-transparent' : 
                            log.type === 'eval_result' ? 'text-[#a6e22e] font-bold border-l-[3px] border-l-transparent bg-[var(--dev-console-bg-active)]' :
                            'text-[var(--dev-console-text)] border-l-[3px] border-l-transparent'
                        } hover:bg-[var(--dev-console-bg-hover)]`}>
                            {(log.type === 'info' || log.type === 'warn' || log.type === 'error') && (
                                <div className="flex-none mt-0.5">
                                    {log.type === 'info' && <InfoIcon size={14} className="text-[#8be9fd]" />}
                                    {log.type === 'warn' && <AlertTriangle size={14} className="text-[#ffb86c]" />}
                                    {log.type === 'error' && <AlertCircle size={14} className="text-[#ff8080]" />}
                                </div>
                            )}
                            <div className="flex-1 min-w-0 font-mono">
                                {renderLogMessageWithBadges(log.args.join(' '))}
                            </div>
                            <button 
                                onClick={() => handleCopy(log.args.join(' '), log.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-neutral-700/80 rounded flex-none self-start transition-opacity"
                                title="Copy log text"
                            >
                                {copiedId === log.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-neutral-400" />}
                            </button>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>

            {/* Evaluate Panel */}
            <form onSubmit={handleRunJS} className="flex-none min-h-8 py-1.5 border-t border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] flex items-end px-3 gap-2 w-full">
                <ChevronRight size={16} className="text-[#007fd4] mb-0.5" />
                <textarea 
                    className="bg-transparent text-[12px] text-[var(--dev-console-text)] outline-none w-full font-mono placeholder:text-[var(--dev-console-text-muted)] resize-none max-h-[58px]" 
                    placeholder="evaluate JavaScript" 
                    style={{ height: '20px' }}
                    value={consoleInput} 
                    onChange={e => {
                        setConsoleInput(e.target.value);
                        e.target.style.height = '20px';
                        e.target.style.height = Math.min(e.target.scrollHeight, 58) + 'px';
                    }} 
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleRunJS();
                        }
                    }}
                    spellCheck={false}
                    autoComplete="off"
                />
            </form>
        </div>
    );
};
