import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Network, X, Maximize2, Minimize2, Trash2, Copy, Check, ChevronRight, ChevronDown, ChevronUp, Filter, AlertTriangle, AlertCircle, Info as InfoIcon, Search, Database } from 'lucide-react';

export type LogEntry = {
    id: string;
    type: 'log' | 'info' | 'warn' | 'error' | 'eval_result';
    timestamp: Date;
    args: any[];
};

export type NetEntry = {
    id: string;
    method: string;
    url: string;
    status: number | string;
    timestamp: Date;
    duration?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: any;
    responseBody?: any;
    requestSize?: number;
    responseSize?: number;
    fromConsole?: boolean;
};

// Global stores outside React
let logs: LogEntry[] = [];
let nets: NetEntry[] = [];
// Metrics
let totalSent = 0;
let totalReceived = 0;

let listeners: (() => void)[] = [];

const notify = () => listeners.forEach(l => l());

let isInitialized = false;

const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getBodySize = (body: any) => {
    if (!body) return 0;
    if (typeof body === 'string') return new Blob([body]).size;
    try {
        return new Blob([JSON.stringify(body)]).size;
    } catch {
        return 0;
    }
};

export const tryParseAndTruncateJson = (str: string, maxLength = 300, key?: string): string | null => {
    if (!str) return null;
    const trimmed = str.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            const parsed = JSON.parse(trimmed);
            const truncatedObj = truncateLongValuesInObject(parsed, maxLength, key);
            return JSON.stringify(truncatedObj);
        } catch {
            return null;
        }
    }
    return null;
};

export const shouldTruncate = (str: string, key?: string): boolean => {
    if (!str) return false;
    
    // 1. Identify human-friendly keys. We avoid truncating strings under these keys 
    // unless they exceed extreme thresholds (e.g., 5000 chars) to prevent freeze-ups.
    if (key) {
        const lowerKey = key.toLowerCase();
        const humanKeys = [
            'name', 'title', 'description', 'desc', 'text', 'content', 'message', 'msg', 
            'note', 'notes', 'summary', 'prompt', 'input', 'output', 'query', 'category', 'id',
            'source', 'author', 'email', 'subject', 'translated', 'translation', 'caption', 
            'status_text', 'display', 'label', 'value', 'formatted', 'result', 'reason', 'markdown'
        ];
        if (humanKeys.some(hk => lowerKey.includes(hk))) {
            if (str.length > 5000) return true;
            return false;
        }
    }

    const trimmed = str.trim();

    // 2. HTTP/HTTPS URLs: Allow up to 1500 characters so standard human links are never truncated
    if ((trimmed.startsWith('http:') || trimmed.startsWith('https:')) && !trimmed.startsWith('data:') && !trimmed.startsWith('blob:')) {
        if (trimmed.length > 1500) return true;
        return false;
    }

    // Always truncate if key suggests file data, base64, token, or URIs (that aren't standard web URLs)
    if (key) {
        const lowerKey = key.toLowerCase();
        if (
            lowerKey.includes('url') || 
            lowerKey.includes('chunk') || 
            lowerKey.includes('file') || 
            lowerKey.includes('avatar') || 
            lowerKey.includes('photo') || 
            lowerKey.includes('image') || 
            lowerKey.includes('audio') || 
            lowerKey.includes('video') || 
            lowerKey.includes('recording') || 
            lowerKey.includes('token') || 
            lowerKey.includes('key')
        ) {
            // For highly binary chunks, hashes, audio, base64 or raw secure tokens, truncate if length > 50
            if (lowerKey.includes('chunk') || lowerKey.includes('token') || lowerKey.includes('audio') || lowerKey.includes('recording') || lowerKey.includes('base64')) {
                if (str.length > 50) return true;
            } else {
                // For files, URLs, keys, images, photos, etc., let's allow up to 500 characters so they are fully readable
                if (str.length > 500) return true;
            }
        }
    }

    // Always truncate non-standard data URLs, blob URLs, or telegram storage paths or http URLs larger than 1500 characters
    if (
        trimmed.startsWith('data:') || 
        trimmed.startsWith('blob:')
    ) {
        return true;
    }
    
    // Telegram storage paths tg:// or paths up to 1500 characters
    if (trimmed.startsWith('tg://')) {
        if (trimmed.length > 1500) return true;
        return false;
    }
    
    // If the trimmed string is a path (contains slashes) or a file-like URL, allow up to 1000 characters
    const isPathOrUrl = trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('%20');
    if (isPathOrUrl) {
        if (trimmed.length > 1000) {
            return true;
        }
        return false;
    }
    
    // Robust detection: Calculate maximum continuous word length (length without any whitespace)
    // Genuine readable text (articles, notes, logs, messages) consists of normal words separated by spaces.
    // Extremely long words (>50 characters) mean it's base64, a hex string, or a huge raw token.
    const words = trimmed.split(/\s+/);
    
    // If it's a multi-word string and has normal human-like spacing:
    if (words.length > 2) {
        // Count how many words are abnormally long (>50 chars)
        const longWords = words.filter(w => w.length > 50);
        // If the vast majority of words are normal, it's likely a sentence/human text, even if it has a long URL or token inside
        if (longWords.length / words.length < 0.2) {
            return false;
        }
    }
    
    const maxWordLength = Math.max(...words.map(w => w.length));
    if (maxWordLength > 50) {
        return true;
    }
    
    // Low whitespace density check: base64/hex blocks contain absolutely zero spaces.
    const spaces = str.match(/\s/g)?.length || 0;
    if (spaces === 0 && str.length > 50) {
        return true;
    }
    
    // Low whitespace density for longer texts
    if (str.length > 120) {
        if (spaces < 5 || (spaces / str.length) < 0.05) {
            return true;
        }
    }
    
    return false;
};

export const truncateString = (str: string, maxLength = 150, key?: string): string => {
    if (!str) return str;
    
    // Try parsing as JSON first to cleanly format nested objects
    const jsonParsed = tryParseAndTruncateJson(str, maxLength, key);
    if (jsonParsed !== null) {
        return jsonParsed;
    }
    
    if (!shouldTruncate(str, key)) return str;
    
    // For non-human binary data or URLs that should be truncated, we use a comfortable display threshold
    const effectiveLimit = 80;
    if (str.length <= effectiveLimit) return str;
    const half = Math.floor((effectiveLimit - 12) / 2);
    return str.substring(0, half) + `...[TRUNCATED ${str.length - (half * 2)} chars]...` + str.substring(str.length - half);
};

export const truncateLongValuesInObject = (obj: any, maxLength = 300, key?: string): any => {
    if (typeof obj === 'string') {
        const jsonParsed = tryParseAndTruncateJson(obj, maxLength, key);
        if (jsonParsed !== null) {
            return jsonParsed;
        }
        return truncateString(obj, maxLength, key);
    }
    if (Array.isArray(obj)) {
        const isBinaryKey = key && (
            key.toLowerCase().includes('chunk') || 
            key.toLowerCase().includes('audio') || 
            key.toLowerCase().includes('recording') || 
            key.toLowerCase().includes('base64') ||
            key.toLowerCase().includes('bytes') ||
            key.toLowerCase().includes('raw')
        );

        const processed = obj.map(item => truncateLongValuesInObject(item, maxLength, key));
        
        // If the processed array is long and contains binary chunks, truncate the array itself
        if (isBinaryKey && processed.length > 3) {
            const firstN = processed.slice(0, 2);
            return [
                ...firstN,
                `... [TRUNCATED ${processed.length - 2} additional items of total array of ${processed.length}] ...`
            ];
        }
        
        // For standard arrays (e.g. data records), prevent aggressive truncation to 2 items
        if (processed.length > 25) {
            const firstN = processed.slice(0, 20);
            return [
                ...firstN,
                `... [TRUNCATED ${processed.length - 20} additional items of total array of ${processed.length}] ...`
            ];
        }
        
        return processed;
    }
    if (typeof obj === 'object' && obj !== null) {
        try {
            const copy: any = {};
            for (const [k, value] of Object.entries(obj)) {
                if (typeof value === 'string') {
                    copy[k] = truncateString(value, maxLength, k);
                } else {
                    copy[k] = truncateLongValuesInObject(value, maxLength, k);
                }
            }
            return copy;
        } catch {
            return obj;
        }
    }
    return obj;
};

export const safeStringifyWithTruncation = (val: any, space = 2, maxLength = 300): string => {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'string') {
        try {
            const trimmed = val.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                const parsed = JSON.parse(trimmed);
                const truncatedObj = truncateLongValuesInObject(parsed, maxLength);
                return JSON.stringify(truncatedObj, null, space);
            }
        } catch {}
        return truncateString(val, maxLength);
    }
    if (typeof val !== 'object') {
        return String(val);
    }
    try {
        const truncatedObj = truncateLongValuesInObject(val, maxLength);
        return JSON.stringify(truncatedObj, null, space);
    } catch {
        return String(val);
    }
};

export const initDevStore = () => {
    if (isInitialized || typeof window === 'undefined') return;
    isInitialized = true;

    // --- Console Overrides ---
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    const addLog = (type: 'log' | 'info' | 'warn' | 'error', args: any[]) => {
        logs.push({
            id: Math.random().toString(36).slice(2, 9),
            type,
            timestamp: new Date(),
            args: args.map(a => {
                try {
                    if (a instanceof Error) {
                        return `${a.name}: ${a.message}\n${a.stack || ''}`;
                    }
                    if (typeof a === 'object' && a !== null) {
                        let str = safeStringifyWithTruncation(a, 2);
                        if (str === '{}') {
                            const props = Object.getOwnPropertyNames(a);
                            if (props.length > 0) {
                                const obj: any = {};
                                props.forEach(p => obj[p] = (a as any)[p]);
                                str = safeStringifyWithTruncation(obj, 2);
                            }
                        }
                        return str;
                    }
                    return safeStringifyWithTruncation(a, 2);
                } catch {
                    return String(a);
                }
            })
        });
        if (logs.length > 1000) logs.shift(); // Keep last 1000
        notify();
    };

        console.log = (...args) => { originalConsole.log(...args); addLog('log', args); };
    console.info = (...args) => { originalConsole.info(...args); addLog('info', args); };
    console.warn = (...args) => { originalConsole.warn(...args); addLog('warn', args); };
    console.error = (...args) => { originalConsole.error(...args); addLog('error', args); };

    // --- Fetch Override ---
    const originalFetch = window.fetch;
    try {
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            writable: true,
            value: async (...args: Parameters<typeof window.fetch>) => {
                const id = Math.random().toString(36).slice(2, 9);
                const url = (args[0] instanceof Request) ? args[0].url : String(args[0]);
                const method = (args[0] instanceof Request) ? args[0].method : (args[1]?.method || 'GET');
                let requestBody = undefined;
                if (args[1]?.body) {
                    try {
                        requestBody = typeof args[1].body === 'string' ? JSON.parse(args[1].body) : args[1].body;
                    } catch {
                        requestBody = args[1].body;
                    }
                }
                
                let reqHeaders: Record<string, string> = {};
                if (args[1]?.headers) {
                    try {
                        reqHeaders = Object.fromEntries(new Headers(args[1].headers).entries());
                    } catch (e) {}
                }

                let reqSize = getBodySize(requestBody);

                const entry: NetEntry = {
                    id,
                    url,
                    method,
                    status: 'pending',
                    timestamp: new Date(),
                    requestHeaders: reqHeaders,
                    requestBody,
                    requestSize: reqSize,
                    fromConsole: !!(window as any).__fromConsole
                };
                nets.push(entry);
                totalSent += reqSize;
                if (nets.length > 500) nets.shift(); // Keep last 500
                notify();

                const startTime = performance.now();
                try {
                    const response = await originalFetch(...args);
                    const duration = Math.round(performance.now() - startTime);
                    const target = nets.find(n => n.id === id);
                    if (target) {
                        target.status = response.status;
                        target.duration = duration;
                        let respSize = 0;
                        const lenHeader = response.headers.get('content-length');
                        if (lenHeader) respSize = parseInt(lenHeader, 10);
                        
                        try {
                            const clone = response.clone();
                            const text = await clone.text();
                            if (!respSize) respSize = new Blob([text]).size;
                            try { target.responseBody = JSON.parse(text); } 
                            catch { target.responseBody = text; }
                        } catch (e) {
                            target.responseBody = '[Could not read body]';
                        }
                        
                        let resHeaders: Record<string, string> = {};
                        try { resHeaders = Object.fromEntries(response.headers.entries()); } catch(e) {}
                        target.responseHeaders = resHeaders;
                        
                        target.responseSize = respSize;
                        totalReceived += respSize;
                        notify();
                    }
                    return response;
                } catch (e: any) {
                    const duration = Math.round(performance.now() - startTime);
                    const target = nets.find(n => n.id === id);
                    if (target) {
                        target.status = 'error';
                        target.duration = duration;
                        notify();
                    }
                    throw e;
                }
            }
        });
    } catch (err) {
        console.warn("Could not override window.fetch for DevConsole", err);
    }

    // --- XHR Override ---
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(this: XMLHttpRequest & { _devId?: string, _reqHeaders?: Record<string, string> }, method: string, url: string | URL, ...rest: any[]) {
        const id = Math.random().toString(36).slice(2, 9);
        this._devId = id;
        this._reqHeaders = {};
        nets.push({
            id,
            url: String(url),
            method,
            status: 'pending',
            timestamp: new Date(),
            requestHeaders: this._reqHeaders,
            fromConsole: !!(window as any).__fromConsole
        });
        if (nets.length > 500) nets.shift();
        notify();
        // @ts-ignore
        return originalOpen.apply(this, [method, url, ...rest]);
    };
    
    XMLHttpRequest.prototype.setRequestHeader = function(this: XMLHttpRequest & { _reqHeaders?: Record<string, string> }, header: string, value: string) {
        if (this._reqHeaders) {
            this._reqHeaders[header] = value;
        }
        return originalSetRequestHeader.apply(this, [header, value]);
    };

    XMLHttpRequest.prototype.send = function(this: XMLHttpRequest & { _devId?: string, _reqSize?: number }, body?: Document | XMLHttpRequestBodyInit | null) {
        const id = this._devId;
        const startTime = performance.now();
        this._reqSize = getBodySize(body);
        if (id && this._reqSize) {
           const target = nets.find(n => n.id === id);
           if (target) target.requestSize = this._reqSize;
           totalSent += this._reqSize;
        }

        if (id) {
            const updateNet = (status: number | string, isError = false) => {
                const target = nets.find(n => n.id === id);
                if (target) {
                    target.status = status;
                    target.duration = Math.round(performance.now() - startTime);
                    if (body) {
                         try { target.requestBody = typeof body === 'string' ? JSON.parse(body) : body; } 
                         catch { target.requestBody = body; }
                    }
                    let respSize = 0;
                    if (!isError) {
                        try {
                            target.responseBody = this.responseType === '' || this.responseType === 'text' ? JSON.parse(this.responseText) : this.response;
                        } catch {
                            target.responseBody = this.responseText || this.response;
                        }
                        
                        const lenHeader = this.getResponseHeader('content-length');
                        if (lenHeader) respSize = parseInt(lenHeader, 10);
                        else respSize = getBodySize(this.responseText || this.response);
                        
                        const headersStr = this.getAllResponseHeaders();
                        const headersObj: Record<string, string> = {};
                        headersStr.trim().split(/[\r\n]+/).forEach(line => {
                            const parts = line.split(': ');
                            const head = parts.shift();
                            const val = parts.join(': ');
                            if (head) headersObj[head.toLowerCase()] = val;
                        });
                        target.responseHeaders = headersObj;
                    }
                    target.responseSize = respSize;
                    totalReceived += respSize;
                    notify();
                }
            };
            this.addEventListener('load', () => updateNet(this.status));
            this.addEventListener('error', () => updateNet('error', true));
        }
        return originalSend.apply(this, [body]);
    };
};

export const DevConsole = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [activeTab, setActiveTab] = useState<'console' | 'network' | 'cache'>('console');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    
    // Cache management states
    const [cacheData, setCacheData] = useState<Record<string, string | null>>({});
    const [cacheSearch, setCacheSearch] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newName, setNewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [cacheStatusMessage, setCacheStatusMessage] = useState('');
    const [deletingModelId, setDeletingModelId] = useState<string | null>(null);

    const fetchCacheData = async () => {
        try {
            const response = await fetch('/api/device-mapper/cache');
            if (response.ok) {
                const data = await response.json();
                setCacheData(data);
            }
        } catch (err) {
            console.error("Failed to fetch device cache data:", err);
        }
    };

    useEffect(() => {
        if (activeTab === 'cache') {
            fetchCacheData();
        }
    }, [activeTab]);
    const [expandedNetId, setExpandedNetId] = useState<string | null>(null);
    const [highlightedNetId, setHighlightedNetId] = useState<string | null>(null);
    
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
            listeners = listeners.filter(l => l !== listener);
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
                    result = eval(`(${input})`);
                } catch (e) {
                    result = eval(input);
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
            const allText = logs.map(l => `[${l.timestamp.toISOString()}] ${l.type.toUpperCase()}: ${l.args.join(' ')}`).join('\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-console');
        } else {
            const allText = nets.map(n => {
                let parts = [`[${n.timestamp.toISOString()}] ${n.method} ${n.url} - ${n.status} (${n.duration}ms)`];
                if (n.requestBody) parts.push(`Payload: ${safeStringifyWithTruncation(n.requestBody, 2)}`);
                if (n.responseBody) parts.push(`Response: ${safeStringifyWithTruncation(n.responseBody, 2)}`);
                return parts.join('\n');
            }).join('\n\n-------------------\n\n');
            navigator.clipboard.writeText(allText);
            setCopiedId('all-network');
        }
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleClear = () => {
        if (activeTab === 'console') {
            logs = [];
        } else {
            nets = [];
            totalSent = 0;
            totalReceived = 0;
            setExpandedNetId(null);
        }
        forceRender(n => n + 1);
    };



    const filteredLogs = logs.filter(log => {
        if (consoleLevel !== 'all' && log.type !== consoleLevel) return false;
        if (consoleFilter && !log.args.join(' ').toLowerCase().includes(consoleFilter.toLowerCase())) return false;
        return true;
    });

    const filteredNets = nets.filter(net => {
        if (networkFilter && !net.url.toLowerCase().includes(networkFilter.toLowerCase())) return false;
        return true;
    });

    const selectedNet = nets.find(n => n.id === expandedNetId);

    const getStatusColor = (status: number | string) => {
        if (status === 'pending') return 'text-yellow-400';
        if (status === 'error' || (typeof status === 'number' && status >= 400)) return 'text-[#f48771]';
        return 'text-[#89d185]';
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
            case 'GET': return 'text-[#569cd6]';
            case 'POST': return 'text-[#4ec9b0]';
            case 'PUT': return 'text-[#dcdcaa]';
            case 'DELETE': return 'text-[#f44747]';
            case 'PATCH': return 'text-[#b5cea8]';
            case 'HEAD': return 'text-[#c586c0]';
            case 'OPTIONS': return 'text-[#ce9178]';
            default: return 'text-[#d4d4d4]';
        }
    };

    return (
        <div 
            className={`fixed z-[9999] bg-[#000000] border-neutral-800 text-[13px] font-mono shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${isOpen ? (isMaximized ? 'inset-x-0 bottom-0 border-t h-[90vh]' : 'inset-x-0 bottom-0 border-t h-[45vh]') : 'right-4 bottom-0 h-8 rounded-t-lg border-t border-l border-r hover:bg-[#111111] cursor-pointer w-fit'}`}
            onClick={() => !isOpen && setIsOpen(true)}
        >
            {!isOpen ? (
                <div className="h-full flex justify-between items-center px-4 gap-4 text-neutral-500 hover:text-neutral-300 font-mono text-[11px] uppercase tracking-widest font-bold transition-colors w-full">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2" title="Console Logs">
                            <Terminal size={14} /> 
                            <span className="hidden sm:inline">Console</span>
                            {logs.length > 0 && <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] text-neutral-400">{logs.length}</span>}
                        </div>
                        <div className="flex items-center gap-2" title="Network Requests">
                            <Network size={14} /> 
                            <span className="hidden sm:inline">Network</span>
                            {nets.length > 0 && <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] text-neutral-400">{nets.length}</span>}
                        </div>
                    </div>
                    <ChevronUp size={16} />
                </div>
            ) : (
                <>
                    {/* Top Navigation Bar */}
                    <div className="flex-none h-11 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-2 w-full select-none overflow-hidden">
                        <div className="flex h-full min-w-0 overflow-x-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <button 
                        onClick={() => setActiveTab('console')}
                        className={`px-5 h-full flex shrink-0 items-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] ${activeTab === 'console' ? 'border-[#007fd4] text-white bg-[#000000]' : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/5'}`}
                    >
                        <Terminal size={15} className="shrink-0" /> Console 
                        {logs.length > 0 && <span className="ml-1 bg-neutral-800 px-1.5 py-0.5 rounded text-[10px]">{logs.length}</span>}
                    </button>
                    <button 
                        onClick={() => { setActiveTab('network'); setExpandedNetId(null); }}
                        className={`px-5 h-full flex shrink-0 items-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] ${activeTab === 'network' ? 'border-[#007fd4] text-white bg-[#000000]' : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/5'}`}
                    >
                        <Network size={15} className="shrink-0" /> Network
                        {nets.length > 0 && <span className="ml-1 bg-neutral-800 px-1.5 py-0.5 rounded text-[10px]">{nets.length}</span>}
                    </button>
                    <button 
                        onClick={() => { setActiveTab('cache'); }}
                        className={`px-5 h-full flex shrink-0 items-center gap-2 border-b-[2px] transition-colors text-[11px] sm:text-[13px] ${activeTab === 'cache' ? 'border-[#007fd4] text-white bg-[#000000]' : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/5'}`}
                    >
                        <Database size={15} className="shrink-0" /> Device Cache
                        {Object.keys(cacheData).length > 0 && <span className="ml-1 bg-neutral-800 px-1.5 py-0.5 rounded text-[10px]">{Object.keys(cacheData).length}</span>}
                    </button>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-400 shrink-0 bg-[#0a0a0a] pl-2 z-10 box-shadow-[-10px_0_10px_#0a0a0a]">
                    <button onClick={handleCopyAll} className="p-1.5 hover:text-white hover:bg-neutral-700 rounded transition-colors flex items-center gap-1" title="Copy All">
                        {copiedId === (activeTab === 'console' ? 'all-console' : 'all-network') ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        <span className="hidden sm:inline text-xs ml-1">Copy</span>
                    </button>
                    <button onClick={handleClear} className="p-1.5 hover:text-white hover:bg-neutral-700 rounded transition-colors" title="Clear (Cmd/Ctrl+K)">
                        <Trash2 size={15} />
                    </button>
                    <div className="w-px h-5 bg-neutral-600 mx-1"></div>
                    <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 hover:text-white hover:bg-neutral-700 rounded transition-colors" title={isMaximized ? 'Minimize' : 'Maximize'}>
                        {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1.5 hover:text-white hover:bg-neutral-700 rounded transition-colors" title="Close DevTools">
                        <ChevronDown size={18} />
                    </button>
                </div>
            </div>
            
            {/* Tool Bar */}
            {activeTab === 'console' && (
                <div className="flex-none h-8 border-b border-[#222] bg-[#111111] flex items-center px-3 gap-3 w-full">
                    <div className="flex items-center bg-[#000000] border border-neutral-800 rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                        <Filter size={12} className="text-neutral-400 mr-2" />
                        <input 
                            className="bg-transparent text-[11px] text-white outline-none w-full placeholder:text-neutral-500" 
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
            )}

            {activeTab === 'network' && (
                <div className="flex-none h-8 border-b border-[#222] bg-[#111111] flex items-center px-3 gap-3 w-full">
                    <div className="flex items-center bg-[#000000] border border-neutral-800 rounded px-2 py-0.5 w-64 focus-within:border-[#007fd4] transition-colors">
                        <Filter size={12} className="text-neutral-400 mr-2" />
                        <input 
                            className="bg-transparent text-[11px] text-white outline-none w-full placeholder:text-neutral-500" 
                            placeholder="Filter by URL" 
                            value={networkFilter} 
                            onChange={e => setNetworkFilter(e.target.value)} 
                        />
                        {networkFilter && <button onClick={() => setNetworkFilter('')}><X size={12} className="text-neutral-400 hover:text-white" /></button>}
                    </div>
                </div>
            )}
            
            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden bg-[#000000] flex w-full">
                
                {activeTab === 'console' && (
                    <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
                        <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
                            <div className="flex flex-col min-h-full">
                            {filteredLogs.length === 0 && (
                                <div className="text-neutral-500 italic p-6 text-center text-xs flex flex-col items-center gap-2">
                                    <Terminal size={32} className="opacity-20 mb-2" />
                                    {logs.length > 0 ? 'No logs match your filter.' : 'Console is clear.'}
                                </div>
                            )}
                            {filteredLogs.map((log) => (
                                <div key={log.id} className={`group py-2 px-2 sm:px-4 border-b border-neutral-900 break-words whitespace-pre-wrap flex gap-2 sm:gap-3 text-[10px] sm:text-[12px] leading-relaxed ${
                                    log.type === 'error' ? 'bg-[#290000] text-[#ff8080] border-l-[3px] border-l-[#ff8080]' : 
                                    log.type === 'warn' ? 'bg-[#332b00] text-[#ffb86c] border-l-[3px] border-l-[#ffb86c]' : 
                                    log.type === 'info' ? 'text-[#8be9fd] border-l-[3px] border-l-transparent' : 
                                    log.type === 'eval_result' ? 'text-[#a6e22e] font-bold border-l-[3px] border-l-transparent bg-[#111111]' :
                                    'text-[#d4d4d4] border-l-[3px] border-l-transparent'
                                } hover:bg-neutral-900`}>
                                    <div className="flex-none mt-0.5">
                                        {log.type === 'info' && <InfoIcon size={14} className="text-[#8be9fd]" />}
                                        {log.type === 'warn' && <AlertTriangle size={14} className="text-[#ffb86c]" />}
                                        {log.type === 'error' && <AlertCircle size={14} className="text-[#ff8080]" />}
                                        {log.type === 'eval_result' && <ChevronRight size={14} className="text-[#a6e22e] rotate-180" />}
                                        {log.type === 'log' && <ChevronRight size={14} className="text-neutral-600" />}
                                    </div>
                                    <div className="flex-1 min-w-0 font-mono">
                                        {log.args.join(' ')}
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
                            <style>{`
                                .hide-horizontal-scrollbar::-webkit-scrollbar:horizontal { display: none; }
                                .hide-horizontal-scrollbar { scrollbar-width: none; }
                            `}</style>
                        </div>
                    </div>
                    <form onSubmit={handleRunJS} className="flex-none min-h-8 py-1.5 border-t border-[#222] bg-[#000000] flex items-end px-3 gap-2 w-full">
                        <ChevronRight size={16} className="text-[#007fd4] mb-0.5" />
                        <textarea 
                            className="bg-transparent text-[12px] text-white outline-none w-full font-mono placeholder:text-neutral-600 resize-none max-h-[58px]" 
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
                )}
                
                {activeTab === 'network' && (
                    <div className="flex-1 flex w-full h-full overflow-hidden">
                        {/* Network List */}
                        <div className={`flex flex-col h-full bg-[#000000] border-r border-[#222] transition-all duration-300 ${selectedNet ? 'w-full md:w-[45%] lg:w-[35%] shrink-0' : 'w-full'}`}>
                            {filteredNets.length === 0 ? (
                                <div className="text-neutral-500 italic p-6 text-center text-xs flex flex-col items-center pt-20 h-full gap-2">
                                    <Network size={32} className="opacity-20 mb-2" />
                                    {nets.length > 0 ? 'No requests match your filter.' : 'Recording network activity...'}
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center px-2 sm:px-4 py-1.5 border-b border-neutral-800 bg-[#0a0a0a] text-neutral-400 select-none font-semibold sticky top-0 text-[10px] sm:text-[11px] uppercase w-full shrink-0">
                                        <div className="w-[45px] sm:w-[80px] flex-none">Method</div>
                                        <div className="flex-1 min-w-0 pr-2 sm:pr-4">Name</div>
                                        <div className="w-[50px] sm:w-[130px] flex-none">Status</div>
                                        <div className="w-[50px] sm:w-[80px] flex-none text-right">Size</div>
                                        <div className="w-[45px] sm:w-[60px] flex-none text-right">Time</div>
                                    </div>
                                    <div className="flex-1 overflow-auto hide-horizontal-scrollbar scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
                                        {filteredNets.map((net) => {
                                            const isSelected = highlightedNetId === net.id || selectedNet?.id === net.id;
                                            const isError = net.status === 'error' || (typeof net.status === 'number' && net.status >= 400);
                                            let host = '';
                                            try { host = new URL(net.url, window.location.origin).hostname; } catch(e){}
                                            
                                            // Determine log origin
                                            const isSupabase = host.includes('supabase.co') || host.includes('supabase.in');
                                            const isInternal = host === window.location.hostname || net.url.startsWith('/');
                                            const isExternal = !isInternal && !isSupabase && host !== '';

                                            // Highlight light colors for different requests
                                            let bgClass = isSelected ? 'bg-[#1b2b34] cursor-default' : 'hover:bg-[#111111] cursor-pointer';
                                            if (isSelected) {
                                                if (isError) bgClass = 'bg-[#3b1515] cursor-default';
                                                else if (isSupabase) bgClass = 'bg-[#12281e] cursor-default';
                                                else if (isInternal) bgClass = 'bg-[#1e1e1e] cursor-default';
                                            } else {
                                                if (isError) bgClass = 'bg-[#290000] hover:bg-[#3b0000] cursor-pointer';
                                                else if (net.fromConsole) bgClass = 'bg-[#151515] hover:bg-[#1a1a1a] cursor-pointer';
                                                else if (isSupabase) bgClass = 'bg-[#0f1f17] hover:bg-[#162d22] cursor-pointer'; // Very faint green tint
                                                else if (isExternal) bgClass = 'bg-[#1f1a0f] hover:bg-[#2e2616] cursor-pointer'; // Very faint orange tint
                                            }

                                            let borderClass = isSelected ? 'border-l-[3px] border-l-[#007fd4]' :
                                                isSupabase ? 'border-l-[3px] border-l-[#3ecf8e]' :
                                                isExternal ? 'border-l-[3px] border-l-[#e3a324]' :
                                                isError ? 'border-l-[3px] border-l-[#ff8080]' :
                                                net.fromConsole ? 'border-l-[3px] border-l-[#b5cea8]' :
                                                'border-l-[3px] border-l-transparent';

                                            return (
                                            <div 
                                                key={net.id}
                                                onClick={() => {
                                                    setExpandedNetId(net.id);
                                                    setHighlightedNetId(net.id);
                                                }}
                                                onContextMenu={(e) => handleContextMenu(e, net.id)}
                                                className={`group px-2 sm:px-4 py-1.5 border-b border-[#111] flex items-center text-[10px] sm:text-[11px] w-full shrink-0 ${bgClass} ${borderClass} ${isSelected ? 'text-white' : net.fromConsole ? 'text-[#b5cea8]' : isError ? 'text-[#ff8080]' : 'text-[#d4d4d4]'}`}
                                            >
                                                <div className="w-[45px] sm:w-[80px] flex-none flex items-center gap-0.5 sm:gap-1.5">
                                                    {isError && <AlertCircle size={10} className="text-[#f48771] hidden sm:inline" />}
                                                    <span className={`font-bold ${isSelected ? 'text-white' : getMethodColor(net.method)}`}>
                                                        {net.method}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0 pr-2 sm:pr-4 flex items-center gap-1.5" title={net.url}>
                                                    <span className="truncate">{new URL(net.url, window.location.origin).pathname.split('/').pop() || net.url}</span>
                                                    <span className={`shrink-0 border px-1 rounded-[3px] text-[8px] uppercase tracking-wider font-bold hidden sm:inline ${
                                                        isSupabase ? 'border-[#3ecf8e]/30 text-[#3ecf8e] bg-[#3ecf8e]/10' :
                                                        isInternal ? 'border-[#569cd6]/30 text-[#569cd6] bg-[#569cd6]/10' :
                                                        'border-[#e3a324]/30 text-[#e3a324] bg-[#e3a324]/10'
                                                    }`}>
                                                        {isSupabase ? 'Supabase' : isInternal ? 'Local' : 'External'}
                                                    </span>
                                                    <span className="opacity-40 text-[9px] truncate max-w-[70px] hidden lg:inline">{host}</span>
                                                </div>
                                                <div className="w-[50px] sm:w-[130px] flex-none flex items-center min-w-0 pr-1" title={getStatusText(net.status) ? `${net.status} ${getStatusText(net.status)}` : String(net.status)}>
                                                    <span className={`${isSelected ? 'text-white font-medium' : getStatusColor(net.status)} flex items-center gap-1 w-full min-w-0`}>
                                                        {net.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0"></span>}
                                                        <span className="truncate block w-full">{net.status} {getStatusText(net.status)}</span>
                                                    </span>
                                                </div>
                                                <div className="w-[50px] sm:w-[80px] flex-none text-right opacity-80 whitespace-nowrap" title={net.responseSize !== undefined ? formatSize(net.responseSize) : ''}>
                                                    {net.responseSize !== undefined ? formatSize(net.responseSize) : '-'}
                                                </div>
                                                <div className="w-[45px] sm:w-[60px] flex-none text-right opacity-80 pl-1 sm:pl-2 whitespace-nowrap">
                                                    {net.duration !== undefined ? `${net.duration}ms` : '...'}
                                                </div>
                                            </div>
                                        )})}
                                        <div ref={netsEndRef} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Network Details Panel */}
                        {selectedNet && (
                            <div className="flex-1 min-w-0 flex flex-col h-full bg-[#000000] overflow-hidden hidden md:flex">
                                <div className="flex-none h-8 border-b border-[#222] bg-[#0a0a0a] flex items-center px-1">
                                    <button onClick={() => setExpandedNetId(null)} className="p-1 text-neutral-400 hover:text-white mx-1" title="Close Panel">
                                        <X size={14} />
                                    </button>
                                    <div className="h-4 w-px bg-neutral-800 mx-1"></div>
                                    {(['headers', 'payload', 'response'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setNetDetailTab(tab)}
                                            className={`px-4 h-full flex items-center text-[11px] uppercase tracking-wider font-semibold capitalize border-b-2 transition-colors ${netDetailTab === tab ? 'border-[#007fd4] text-white' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                    <div className="flex-1"></div>
                                    <button 
                                        onClick={() => handleCopy(selectedNet.url, 'url-copy')}
                                        className="p-1 mr-2 text-neutral-400 hover:text-white flex items-center gap-1"
                                        title="Copy Request URL"
                                    >
                                        {copiedId === 'url-copy' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-auto hide-horizontal-scrollbar p-4 scrollbar-thin scrollbar-thumb-[#424242] scrollbar-track-transparent">
                                    {netDetailTab === 'headers' && (
                                        <div className="flex flex-col gap-6 text-[12px]">
                                            <div>
                                                <h3 className="text-white font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[#333] pb-1">General</h3>
                                                <div className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1.5 ml-2">
                                                    <span className="text-neutral-400 font-semibold">Request URL:</span>
                                                    <span className="text-[#9cdcfe] break-all select-all">{selectedNet.url}</span>
                                                    <span className="text-neutral-400 font-semibold">Request Method:</span>
                                                    <span className="text-[#ce9178] font-bold">{selectedNet.method}</span>
                                                    <span className="text-neutral-400 font-semibold">Status Code:</span>
                                                    <span className={getStatusColor(selectedNet.status)}>{selectedNet.status} {getStatusText(selectedNet.status)}</span>
                                                </div>
                                            </div>
                                            
                                            {selectedNet.responseHeaders && Object.keys(selectedNet.responseHeaders).length > 0 && (
                                                <div>
                                                    <h3 className="text-white font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[#333] pb-1">Response Headers</h3>
                                                    <div className="grid grid-cols-[160px_1fr] gap-x-2 gap-y-1 ml-2">
                                                        {Object.entries(selectedNet.responseHeaders).map(([k, v]) => (
                                                            <React.Fragment key={k}>
                                                                <span className="text-[#9cdcfe] capitalize">{k}:</span>
                                                                <span className="text-[#ce9178] break-all">{v}</span>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {selectedNet.requestHeaders && Object.keys(selectedNet.requestHeaders).length > 0 && (
                                                <div>
                                                    <h3 className="text-white font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[#333] pb-1">Request Headers</h3>
                                                    <div className="grid grid-cols-[160px_1fr] gap-x-2 gap-y-1 ml-2">
                                                        {Object.entries(selectedNet.requestHeaders).map(([k, v]) => (
                                                            <React.Fragment key={k}>
                                                                <span className="text-[#9cdcfe] capitalize">{k}:</span>
                                                                <span className="text-[#ce9178] break-all">{v}</span>
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
                                                    <div className="flex justify-between items-end mb-2 border-b border-[#333] pb-1">
                                                        <h3 className="text-white font-bold uppercase text-[10px] tracking-wider">Request Payload <span className="text-neutral-500 font-normal ml-2">({formatSize(selectedNet.requestSize || 0)})</span></h3>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.requestBody, 2), 'payload-copy')}
                                                            className="text-neutral-400 hover:text-white flex items-center gap-1 text-[10px] uppercase"
                                                        >
                                                            {copiedId === 'payload-copy' ? <><Check size={10} className="text-green-400" /> Copied</> : <><Copy size={10} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <pre 
                                                        className="font-mono text-[#ce9178] text-[11px] whitespace-pre-wrap break-all max-w-full overflow-x-auto bg-[#1a1a1a]/50 p-2.5 rounded ml-2 mt-2"
                                                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                    >
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
                                                    <div className="flex justify-between items-end mb-2 border-b border-[#333] pb-1 flex-none">
                                                        <h3 className="text-white font-bold uppercase text-[10px] tracking-wider">Response Body <span className="text-neutral-500 font-normal ml-2">({formatSize(selectedNet.responseSize || 0)})</span></h3>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.responseBody, 2), 'response-copy')}
                                                            className="text-neutral-400 hover:text-white flex items-center gap-1 text-[10px] uppercase"
                                                        >
                                                            {copiedId === 'response-copy' ? <><Check size={10} className="text-green-400" /> Copied</> : <><Copy size={10} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <div className="flex-1 overflow-auto">
                                                        <pre 
                                                            className="font-mono text-[#dcdcaa] text-[11px] whitespace-pre-wrap break-all max-w-full overflow-x-auto bg-[#1a1a1a]/50 p-2.5 rounded ml-2 mt-2"
                                                            style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                        >
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
                        
                        {/* Selected overlay on mobile */}
                        {selectedNet && (
                            <div className="absolute inset-0 bg-[#1e1e1e] flex flex-col z-20 md:hidden animate-in slide-in-from-right-2 duration-200">
                                <div className="flex-none h-11 border-b border-[#333] bg-[#252526] flex items-center px-4">
                                    <button onClick={() => setExpandedNetId(null)} className="p-2 -ml-2 text-neutral-400 hover:text-white flex items-center gap-2">
                                        <ChevronRight size={18} className="rotate-180" /> Back to Network
                                    </button>
                                </div>
                                <div className="flex-none h-10 border-b border-[#333] flex">
                                    {(['headers', 'payload', 'response'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setNetDetailTab(tab)}
                                            className={`flex-1 h-full flex items-center justify-center text-[11px] uppercase tracking-wider font-semibold capitalize border-b-2 transition-colors ${netDetailTab === tab ? 'border-[#007fd4] text-white bg-[#2d2d2d]' : 'border-transparent text-neutral-400 hover:text-neutral-200 bg-[#1e1e1e]'}`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex-1 overflow-auto p-4">
                                     {/* Duplicate mobile view logic to reuse the detail blocks */}
                                     {netDetailTab === 'headers' && (
                                        <div className="flex flex-col gap-6 text-[12px]">
                                            <div>
                                                <h3 className="text-white font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[#333] pb-1">General</h3>
                                                <div className="flex flex-col gap-2 ml-1">
                                                    <div><div className="text-neutral-400 font-semibold mb-0.5">Request URL:</div><div className="text-[#9cdcfe] break-all">{selectedNet.url}</div></div>
                                                    <div><div className="text-neutral-400 font-semibold mb-0.5">Request Method:</div><div className="text-[#ce9178] font-bold">{selectedNet.method}</div></div>
                                                    <div><div className="text-neutral-400 font-semibold mb-0.5">Status Code:</div><div className={getStatusColor(selectedNet.status)}>{selectedNet.status}</div></div>
                                                </div>
                                            </div>
                                            {/* We skip full mobile header lists for brevity, just keeping it simple */}
                                            {selectedNet.responseHeaders && Object.keys(selectedNet.responseHeaders).length > 0 && (
                                                <div>
                                                    <h3 className="text-white font-bold mb-3 uppercase text-[10px] tracking-wider border-b border-[#333] pb-1">Response Headers</h3>
                                                    <div className="flex flex-col gap-1.5 ml-1">
                                                        {Object.entries(selectedNet.responseHeaders).map(([k, v]) => (
                                                            <div key={k} className="break-all border-b border-neutral-800/50 pb-1">
                                                                <span className="text-[#9cdcfe] capitalize mr-2">{k}:</span>
                                                                <span className="text-[#ce9178]">{v}</span>
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
                                                    <div className="flex justify-between items-center mb-2 border-b border-neutral-800/80 pb-1.5">
                                                        <span className="text-[10.5px] text-neutral-400 uppercase tracking-widest font-bold">Request Payload</span>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.requestBody, 2), 'payload-copy-mobile')}
                                                            className="text-neutral-400 hover:text-white flex items-center gap-1 text-[11px] uppercase font-semibold transition-colors"
                                                        >
                                                            {copiedId === 'payload-copy-mobile' ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <pre 
                                                        className="font-mono text-[#ce9178] text-[11px] whitespace-pre-wrap break-all bg-[#181818] p-3 rounded max-w-full overflow-x-auto"
                                                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                    >
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
                                                    <div className="flex justify-between items-center mb-2 border-b border-neutral-800/80 pb-1.5">
                                                        <span className="text-[10.5px] text-neutral-400 uppercase tracking-widest font-bold">Response Body</span>
                                                        <button 
                                                            onClick={() => handleCopy(safeStringifyWithTruncation(selectedNet.responseBody, 2), 'response-copy-mobile')}
                                                            className="text-neutral-400 hover:text-white flex items-center gap-1 text-[11px] uppercase font-semibold transition-colors"
                                                        >
                                                            {copiedId === 'response-copy-mobile' ? <><Check size={11} className="text-green-400" /> Copied</> : <><Copy size={11} /> Copy</>}
                                                        </button>
                                                    </div>
                                                    <pre 
                                                        className="font-mono text-[#dcdcaa] text-[11px] whitespace-pre-wrap break-all bg-[#181818] p-3 rounded max-w-full overflow-x-auto"
                                                        style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}
                                                    >
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
                )}
                
                {activeTab === 'cache' && (
                    <div className="flex-1 flex flex-col md:flex-row w-full h-full md:min-h-0 overflow-y-auto md:overflow-hidden bg-[#000000]">
                        {/* Left Side: Operations / Add-Edit */}
                        <div className="w-full md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-neutral-800 p-4 flex flex-col gap-4">
                            <h3 className="text-sm font-semibold text-neutral-200 tracking-wider flex items-center gap-2 border-b border-neutral-800 pb-2 shrink-0">
                                <Database size={16} className="text-[#007fd4]" />
                                Cache Mapping
                            </h3>
                            
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (!newModel.trim()) return;
                                setIsSaving(true);
                                setCacheStatusMessage('');
                                try {
                                    const response = await fetch('/api/device-mapper/cache', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ model: newModel, name: newName || null })
                                    });
                                    if (response.ok) {
                                        setNewModel('');
                                        setNewName('');
                                        setCacheStatusMessage('Saved successfully!');
                                        fetchCacheData();
                                        setTimeout(() => setCacheStatusMessage(''), 3000);
                                    } else {
                                        setCacheStatusMessage('Error saving to cache.');
                                    }
                                } catch (err) {
                                    setCacheStatusMessage('Network error saving.');
                                } finally {
                                    setIsSaving(false);
                                }
                            }} className="flex flex-col gap-3">
                                <div>
                                    <label className="block text-[11px] text-neutral-400 mb-1 font-bold uppercase tracking-wider font-mono">Device Model Code</label>
                                    <input 
                                        className="w-full bg-[#111111] border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#007fd4] transition-colors font-mono"
                                        placeholder="e.g. GC3VE, SM-S928U, 2201116PI"
                                        value={newModel}
                                        onChange={e => setNewModel(e.target.value)}
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-[11px] text-neutral-400 mb-1 font-bold uppercase tracking-wider font-mono">Marketing Name (Leave blank for negative match)</label>
                                    <input 
                                        className="w-full bg-[#111111] border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#007fd4] transition-colors"
                                        placeholder="e.g. Google Pixel 8a"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                    />
                                </div>
                                
                                <button 
                                    type="submit"
                                    disabled={isSaving || !newModel.trim()}
                                    className="w-full bg-[#007fd4] text-white rounded py-2 text-xs font-semibold hover:bg-[#007fd4]/90 disabled:opacity-50 transition-colors cursor-pointer mt-1 font-sans"
                                >
                                    {isSaving ? 'Saving...' : 'Save Mapping'}
                                </button>
                                
                                {cacheStatusMessage && (
                                    <div className={`text-[11px] font-semibold text-center p-1 rounded font-sans ${cacheStatusMessage.includes('error') || cacheStatusMessage.includes('Error') ? 'bg-red-950/45 text-red-400 border border-red-900/50' : 'bg-green-950/45 text-green-400 border border-green-900/50'}`}>
                                        {cacheStatusMessage}
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Right Side: Search / List View */}
                        <div className="flex-1 flex flex-col shrink-0 min-h-[400px] md:min-h-0 md:shrink-1 overflow-visible md:overflow-hidden">
                            <div className="flex-none p-3 border-b border-neutral-800 bg-[#0a0a0a] flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center bg-[#111111] border border-neutral-800 rounded px-2.5 py-1 w-full sm:w-72 focus-within:border-[#007fd4] transition-colors font-sans flex-1">
                                    <Search size={13} className="text-neutral-400 mr-2" />
                                    <input 
                                        className="bg-transparent text-xs text-white outline-none w-full placeholder:text-neutral-500 font-sans" 
                                        placeholder="Search cached models..." 
                                        value={cacheSearch} 
                                        onChange={e => setCacheSearch(e.target.value)} 
                                    />
                                    {cacheSearch && <button onClick={() => setCacheSearch('')}><X size={12} className="text-neutral-400 hover:text-white" /></button>}
                                </div>
                                <button 
                                    onClick={fetchCacheData}
                                    className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 transition-colors font-sans cursor-pointer"
                                >
                                    Refresh List
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-visible md:overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                                {Object.entries(cacheData).length === 0 ? (
                                    <div className="text-neutral-500 italic p-12 text-center text-xs flex flex-col items-center gap-2 justify-center h-full">
                                        <Database size={32} className="opacity-20 mb-2" />
                                        Cache is currently empty or loading.
                                    </div>
                                ) : (() => {
                                    const filtered = Object.entries(cacheData).filter(([model, name]) => {
                                        if (!cacheSearch) return true;
                                        const cleanQuery = cacheSearch.toLowerCase();
                                        return model.toLowerCase().includes(cleanQuery) || 
                                               (!!name && name.toLowerCase().includes(cleanQuery));
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="text-neutral-500 italic p-12 text-center text-xs flex flex-col items-center gap-2 justify-center h-full font-sans">
                                                No cached entries found matching "{cacheSearch}".
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col">
                                            {filtered.map(([model, name]) => (
                                                <div key={model} className="flex justify-between items-center px-4 py-2.5 border-b border-neutral-900 hover:bg-neutral-950 transition-colors text-xs group">
                                                    <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                                                        <div className="font-bold text-neutral-200 font-mono tracking-wider">{model}</div>
                                                        <div className="text-neutral-400 font-sans truncate">
                                                            {name === null ? (
                                                                <span className="text-amber-500/80 italic font-mono text-[10px]">Negative Match Locked (will skip Gemini resolution)</span>
                                                            ) : name}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            onClick={() => {
                                                                setNewModel(model);
                                                                setNewName(name || '');
                                                            }}
                                                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-opacity cursor-pointer"
                                                            title="Edit Entry"
                                                        >
                                                            <ChevronRight size={14} />
                                                        </button>
                                                        {deletingModelId === model ? (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button 
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            const response = await fetch('/api/device-mapper/cache/delete', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ model })
                                                                            });
                                                                            if (response.ok) {
                                                                                setDeletingModelId(null);
                                                                                fetchCacheData();
                                                                            }
                                                                        } catch (err) {
                                                                            console.error("Error deleting cached item:", err);
                                                                        }
                                                                    }}
                                                                    className="px-2 py-0.5 bg-red-900 text-white border border-red-700/80 rounded font-bold cursor-pointer font-sans text-[10px] transition-colors shrink-0"
                                                                >
                                                                    Confirm
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeletingModelId(null);
                                                                    }}
                                                                    className="px-2 py-0.5 bg-neutral-800 text-neutral-300 border border-neutral-700 rounded font-sans text-[10px] cursor-pointer transition-colors shrink-0"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeletingModelId(model);
                                                                }}
                                                                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-950/45 rounded text-neutral-400 hover:text-[#ff8080] transition-opacity cursor-pointer"
                                                                title="Delete Entry"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Status Bar */}
            {activeTab === 'network' && (
                <div className="flex-none h-6 border-t border-[#333] bg-[#007fd4] text-white flex items-center px-3 text-[11px] font-medium gap-4">
                    <span>{filteredNets.length} / {nets.length} requests</span>
                    <span className="w-px h-3 bg-white/30"></span>
                    <span>{formatSize(totalSent + totalReceived)} transferred</span>
                </div>
            )}
            {activeTab === 'cache' && (
                <div className="flex-none h-6 border-t border-[#333] bg-[#007fd4] text-white flex items-center px-3 text-[11px] font-medium gap-4">
                    <span>{Object.keys(cacheData).length} device mappings cached</span>
                    <span className="w-px h-3 bg-white/30"></span>
                    <span>100% Offline Efficiency</span>
                </div>
            )}
                </>
            )}
            
            {contextMenu && (
                <div 
                    className="fixed z-[10000] bg-[#111111] border border-[#222] shadow-xl rounded py-1 w-48 text-[12px] font-mono text-[#d4d4d4]"
                    style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 150) }}
                >
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net) handleCopy(net.url, `url-copy`);
                            setContextMenu(null);
                        }}
                    >Copy URL</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white"
                        onClick={() => {
                            const net = nets.find(n => n.id === contextMenu.netId);
                            if (net && net.responseBody) handleCopy(safeStringifyWithTruncation(net.responseBody, 2), 'response-copy');
                            setContextMenu(null);
                        }}
                    >Copy Response</button>
                    <button 
                        className="w-full text-left px-3 py-1.5 hover:bg-[#007fd4] hover:text-white"
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
                </div>
            )}
        </div>
    );
};

export default DevConsole;

