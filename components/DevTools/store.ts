import { fetchApi } from "../../utils/fetchApi";
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

// LocalStorage persistence for hidden URL/Query patterns
const LS_HIDDEN_PATTERNS_KEY = 'devToolsNetHiddenPatterns';

export const loadHiddenPatterns = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(LS_HIDDEN_PATTERNS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed.filter(p => typeof p === 'string' && p.trim().length > 0);
        }
    } catch {}
    return [];
};

export const hiddenPatterns: string[] = loadHiddenPatterns();

export const saveHiddenPatterns = () => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LS_HIDDEN_PATTERNS_KEY, JSON.stringify(hiddenPatterns));
    } catch (e) {
        console.warn('Failed to save hidden patterns to localStorage', e);
    }
};

export const isUrlMatchingHiddenPatterns = (url: string, patterns: string[] = hiddenPatterns): string | null => {
    if (!patterns || patterns.length === 0 || !url) return null;
    const lowerUrl = url.toLowerCase();
    for (const pat of patterns) {
        if (!pat) continue;
        const lowerPat = pat.trim().toLowerCase();
        if (!lowerPat) continue;
        if (lowerUrl.includes(lowerPat)) return pat;
        try {
            const urlObj = new URL(url, window.location.origin);
            const fullPath = (urlObj.pathname + urlObj.search).toLowerCase();
            if (fullPath.includes(lowerPat)) return pat;
        } catch {}
    }
    return null;
};

export const addHiddenPattern = (pattern: string) => {
    const trimmed = pattern.trim();
    if (!trimmed) return;
    if (!hiddenPatterns.includes(trimmed)) {
        hiddenPatterns.push(trimmed);
        saveHiddenPatterns();
    }
    // Apply to existing nets
    nets.forEach(n => {
        const match = isUrlMatchingHiddenPatterns(n.url);
        if (match) {
            n.isHidden = true;
            n.hiddenRuleMatch = match;
        }
    });
    notify();
};

export const removeHiddenPattern = (pattern: string) => {
    const idx = hiddenPatterns.indexOf(pattern);
    if (idx !== -1) {
        hiddenPatterns.splice(idx, 1);
        saveHiddenPatterns();
    }
    // Re-evaluate existing nets that matched this pattern
    nets.forEach(n => {
        const remainingMatch = isUrlMatchingHiddenPatterns(n.url);
        if (remainingMatch) {
            n.isHidden = true;
            n.hiddenRuleMatch = remainingMatch;
        } else if (n.hiddenRuleMatch === pattern) {
            n.isHidden = false;
            n.hiddenRuleMatch = undefined;
        }
    });
    notify();
};

export const hideNetEntries = (ids: string[]) => {
    const idSet = new Set(ids);
    nets.forEach(n => {
        if (idSet.has(n.id)) {
            n.isHidden = true;
        }
    });
    notify();
};

export const unhideNetEntries = (ids: string[]) => {
    const idSet = new Set(ids);
    nets.forEach(n => {
        if (idSet.has(n.id)) {
            n.isHidden = false;
            n.hiddenRuleMatch = undefined;
        }
    });
    notify();
};

export const unhideAllNetEntries = () => {
    nets.forEach(n => {
        n.isHidden = false;
        n.hiddenRuleMatch = undefined;
    });
    notify();
};

export const deleteNetEntries = (ids: string[]) => {
    const idSet = new Set(ids);
    for (let i = nets.length - 1; i >= 0; i--) {
        if (idSet.has(nets[i].id)) {
            nets.splice(i, 1);
        }
    }
    notify();
};

export const netStats = {
    totalSent: 0,
    totalReceived: 0
};

export const originalConsole = typeof window !== 'undefined' ? {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
} : {
    log: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
};

export const listeners: (() => void)[] = [];
let notifyScheduled = false;

export const notify = () => {
    if (notifyScheduled) return;
    notifyScheduled = true;
    const scheduleFn = typeof queueMicrotask === 'function' ? queueMicrotask : (fn: () => void) => setTimeout(fn, 0);
    scheduleFn(() => {
        notifyScheduled = false;
        listeners.forEach(l => {
            try {
                l();
            } catch (e) {
                originalConsole.error('[DevTools Store] Error notifying listener:', e);
            }
        });
    });
};

export let isInitialized = false;

export const addOrUpdateNetEntry = (entry: NetEntry) => {
    // Check if matching any hidden pattern rule
    const ruleMatch = isUrlMatchingHiddenPatterns(entry.url);
    if (ruleMatch) {
        entry.isHidden = true;
        entry.hiddenRuleMatch = ruleMatch;
    }

    const isAuto = isAutoFireRequest(entry.method, entry.url);
    
    if (isAuto) {
        const key = getGroupKey(entry.method, entry.url, entry.requestBody);
        // Find existing index that is also classified as auto fire
        const existingIndex = nets.findIndex(n => getGroupKey(n.method, n.url, n.requestBody) === key && isAutoFireRequest(n.method, n.url));
        
        if (existingIndex !== -1) {
            const existing = nets[existingIndex];
            if (!existing.history) existing.history = [];
            
            // Unshift the current state of existing into history
            existing.history.unshift({
                id: existing.id,
                url: existing.url,
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
            
            if (entry.isHidden !== undefined) {
                existing.isHidden = entry.isHidden;
                existing.hiddenRuleMatch = entry.hiddenRuleMatch;
            }
            
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

    const addLog = (type: 'log' | 'info' | 'warn' | 'error', args: any[]) => {
        logs.push({
            id: Math.random().toString(36).slice(2, 9),
            type,
            timestamp: new Date(),
            rawArgs: args,
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
        const sResponse = await fetchApi('/api/image-cache-status');
        if (sResponse.ok) {
            const sData = await sResponse.json();
            serverImageCacheSummary = sData;
            isImageCacheLoaded = true;
        }
    } catch (err) {
        console.warn("Failed to fetch image cache statistics:", err);
    } finally {
        isImageCacheLoading = false;
        notify();
    }
};

export const handleClearServerImageCache = async () => {
    try {
        const response = await fetchApi('/api/image-cache-clear', {
            method: 'POST'
        });
        if (response.ok) {
            await fetchImageCacheData();
        }
    } catch (err) {
         console.warn("Failed to clear server image cache:", err);
    }
};

