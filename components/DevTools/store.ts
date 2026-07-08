import { LogEntry, NetEntry } from './types';
import { 
    getGroupKey, 
    isAutoFireRequest, 
    getBodySize, 
    safeStringifyWithTruncation 
} from './utils';

// Shared global state
export const logs: LogEntry[] = [];
export const nets: NetEntry[] = [];

export const netStats = {
    totalSent: 0,
    totalReceived: 0
};

export const listeners: (() => void)[] = [];
export const notify = () => {
    listeners.forEach(l => {
        try {
            l();
        } catch (e) {
            console.error('[DevTools Store] Error notifying listener:', e);
        }
    });
};

export let isInitialized = false;

export const addOrUpdateNetEntry = (entry: NetEntry) => {
    const isAuto = isAutoFireRequest(entry.method, entry.url);
    
    if (isAuto) {
        const key = getGroupKey(entry.method, entry.url);
        // Find existing index that is also classified as auto fire
        const existingIndex = nets.findIndex(n => getGroupKey(n.method, n.url) === key && isAutoFireRequest(n.method, n.url));
        
        if (existingIndex !== -1) {
            const existing = nets[existingIndex];
            if (!existing.history) existing.history = [];
            
            // Unshift the current state of existing into history
            existing.history.unshift({
                id: existing.id,
                status: existing.status,
                timestamp: existing.timestamp,
                duration: existing.duration,
                requestBody: existing.requestBody,
                responseBody: existing.responseBody,
                requestSize: existing.requestSize,
                responseSize: existing.responseSize,
                requestHeaders: existing.requestHeaders,
                responseHeaders: existing.responseHeaders
            });
            if (existing.history.length > 100) existing.history.pop(); // Keep last 100
            
            existing.count = (existing.count || 1) + 1;
            existing.id = entry.id;
            existing.url = entry.url;
            existing.timestamp = entry.timestamp;
            existing.status = entry.status;
            existing.requestHeaders = entry.requestHeaders;
            existing.requestBody = entry.requestBody;
            existing.requestSize = entry.requestSize;
            existing.fromConsole = entry.fromConsole;
            
            existing.responseHeaders = undefined;
            existing.responseBody = undefined;
            existing.responseSize = undefined;
            existing.duration = undefined;
            
            nets.splice(existingIndex, 1);
            nets.push(existing);
        } else {
            entry.count = 1;
            entry.history = [];
            nets.push(entry);
        }
    } else {
        // Normal requests: completely ungrouped, each is a separate entry with history = []
        entry.count = 1;
        entry.history = [];
        nets.push(entry);
    }
    
    if (nets.length > 500) nets.shift();
};

export const findNetTarget = (id: string) => {
    for (const n of nets) {
        if (n.id === id) return { target: n, targetHistory: null };
        if (n.history) {
            const hist = n.history.find(h => h.id === id);
            if (hist) return { target: n, targetHistory: hist };
        }
    }
    return { target: null, targetHistory: null };
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
                
                addOrUpdateNetEntry(entry);
                netStats.totalSent += reqSize;
                notify();

                const startTime = performance.now();
                try {
                    const response = await originalFetch(...args);
                    const duration = Math.round(performance.now() - startTime);
                    const { target, targetHistory } = findNetTarget(id);
                    
                    let respSize = 0;
                    const lenHeader = response.headers.get('content-length');
                    if (lenHeader) respSize = parseInt(lenHeader, 10);
                    
                    let resBody: any = '[Could not read body]';
                    try {
                        const clone = response.clone();
                        const text = await clone.text();
                        if (!respSize) respSize = new Blob([text]).size;
                        try { resBody = JSON.parse(text); } 
                        catch { resBody = text; }
                    } catch (e) {}

                    let resHeaders: Record<string, string> = {};
                    try { resHeaders = Object.fromEntries(response.headers.entries()); } catch(e) {}
                    
                    if (targetHistory) {
                        targetHistory.status = response.status;
                        targetHistory.duration = duration;
                        targetHistory.responseSize = respSize;
                        targetHistory.responseBody = resBody;
                        targetHistory.requestHeaders = reqHeaders;
                        targetHistory.responseHeaders = resHeaders;
                    } else if (target) {
                        target.status = response.status;
                        target.duration = duration;
                        target.responseSize = respSize;
                        target.responseBody = resBody;
                        target.responseHeaders = resHeaders;
                    }
                    netStats.totalReceived += respSize;
                    notify();
                    return response;
                } catch (e: any) {
                    const duration = Math.round(performance.now() - startTime);
                    const { target, targetHistory } = findNetTarget(id);
                    if (targetHistory) {
                        targetHistory.status = 'error';
                        targetHistory.duration = duration;
                    } else if (target) {
                        target.status = 'error';
                        target.duration = duration;
                    }
                    notify();
                    throw e;
                }
            }
        });
    } catch (err) {
        console.warn("Could not override window.fetch for DevTools", err);
    }

    // --- XHR Override ---
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(this: XMLHttpRequest & { _devId?: string, _reqHeaders?: Record<string, string> }, method: string, url: string | URL, ...rest: any[]) {
        const id = Math.random().toString(36).slice(2, 9);
        this._devId = id;
        this._reqHeaders = {};
        const entry: NetEntry = {
            id,
            url: String(url),
            method,
            status: 'pending',
            timestamp: new Date(),
            requestHeaders: this._reqHeaders,
            fromConsole: !!(window as any).__fromConsole
        };
        addOrUpdateNetEntry(entry);
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
        
        if (id) {
           const { target } = findNetTarget(id);
           if (target) {
               target.requestSize = this._reqSize;
               if (body) {
                   try { target.requestBody = typeof body === 'string' ? JSON.parse(body) : body; } 
                   catch { target.requestBody = body; }
               }
           }
           if (this._reqSize) netStats.totalSent += this._reqSize;
        }

        if (id) {
            const updateNet = (status: number | string, isError = false) => {
                const { target, targetHistory } = findNetTarget(id);
                
                let respSize = 0;
                let resBody: any = undefined;
                let resHeaders: Record<string, string> = {};
                
                if (!isError) {
                    try {
                        resBody = this.responseType === '' || this.responseType === 'text' ? JSON.parse(this.responseText) : this.response;
                    } catch {
                        resBody = this.responseText || this.response;
                    }
                    
                    const lenHeader = this.getResponseHeader('content-length');
                    if (lenHeader) respSize = parseInt(lenHeader, 10);
                    else respSize = getBodySize(this.responseText || this.response);
                    
                    const headersStr = this.getAllResponseHeaders();
                    headersStr.trim().split(/[\n]+/).forEach(line => {
                        const parts = line.split(': ');
                        const head = parts.shift();
                        const val = parts.join(': ');
                        if (head) resHeaders[head.toLowerCase()] = val;
                    });
                }
                
                if (targetHistory) {
                    targetHistory.status = status;
                    targetHistory.duration = Math.round(performance.now() - startTime);
                    targetHistory.responseSize = respSize;
                    targetHistory.responseBody = resBody;
                    targetHistory.requestHeaders = (this as any)._reqHeaders;
                    targetHistory.responseHeaders = resHeaders;
                } else if (target) {
                    target.status = status;
                    target.duration = Math.round(performance.now() - startTime);
                    target.responseSize = respSize;
                    target.responseBody = resBody;
                    target.responseHeaders = resHeaders;
                }
                
                if (!isError) netStats.totalReceived += respSize;
                notify();
            };
            this.addEventListener('load', () => updateNet(this.status));
            this.addEventListener('error', () => updateNet('error', true));
        }
        return originalSend.apply(this, [body]);
    };
};

// --- Image Cache Store State and Methods ---
export let serverImageCacheSummary = { count: 0, totalSizeBytes: 0, items: [] as any[], ttlMs: 7200000 };
export let isImageCacheLoading = false;
export let isImageCacheLoaded = false;
export let showFlushConfirm = false;

export const setShowFlushConfirm = (show: boolean) => {
    showFlushConfirm = show;
    notify();
};

export const fetchImageCacheData = async () => {
    isImageCacheLoading = true;
    notify();
    try {
        const sResponse = await fetch('/api/image-cache-status');
        if (sResponse.ok) {
            const sData = await sResponse.json();
            serverImageCacheSummary = sData;
            isImageCacheLoaded = true;
        }
    } catch (err) {
        console.error("Failed to fetch image cache statistics:", err);
    } finally {
        isImageCacheLoading = false;
        notify();
    }
};

export const handleClearServerImageCache = async () => {
    try {
        const response = await fetch('/api/image-cache-clear', {
            method: 'POST'
        });
        if (response.ok) {
            await fetchImageCacheData();
        }
    } catch (err) {
         console.error("Failed to clear server image cache:", err);
    }
};

