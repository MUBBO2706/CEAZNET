import React from 'react';

// Common utility functions for DevTools
const stableStringify = (obj: any): string => {
    if (obj === null || typeof obj !== 'object') {
        return String(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(stableStringify).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    return '{' + sortedKeys.map(k => `${k}:${stableStringify(obj[k])}`).join(',') + '}';
};

export const getGroupKey = (method: string, url: string, requestBody?: any) => {
    try {
        const u = new URL(url, window.location.origin);
        
        // If it's a Gemini request, we standardize the model part of the URL and include the payload footprint
        if (u.hostname.includes('generativelanguage.googleapis') || u.pathname.includes('/models/gemini-')) {
            const normalizedPathname = u.pathname.replace(/\/models\/gemini-[a-zA-Z0-9.-]+/g, '/models/gemini-model');
            
            // Generate stable payload signature
            const payloadSig = requestBody ? stableStringify(requestBody) : '';
            return `${method} ${u.hostname}${normalizedPathname}:${payloadSig}`;
        }

        if (u.hostname === 'api.iconify.design' && u.pathname.includes('/search')) {
            return `${method} api.iconify.design/search`;
        }

        if (u.pathname.includes('/api/news')) {
            return `${method} /api/news`;
        }

        if (u.pathname.includes('/api/image-proxy')) {
            return `${method} /api/image-proxy`;
        }

        u.searchParams.delete('t');
        u.searchParams.delete('_');
        u.searchParams.delete('v');
        return `${method} ${u.pathname}${u.search}`;
    } catch {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('generativelanguage.googleapis.com') || lowerUrl.includes('/models/gemini-')) {
            const normalizedUrl = url.replace(/\/models\/gemini-[a-zA-Z0-9.-]+/g, '/models/gemini-model');
            const payloadSig = requestBody ? stableStringify(requestBody) : '';
            return `${method} ${normalizedUrl}:${payloadSig}`;
        }
        if (url.includes('api.iconify.design') && url.includes('/search')) {
            return `${method} api.iconify.design/search`;
        }
        if (url.includes('/api/news')) {
            return `${method} /api/news`;
        }
        if (url.includes('/api/image-proxy')) {
            return `${method} /api/image-proxy`;
        }
        return `${method} ${url}`;
    }
};

export const isAutoFireRequest = (method: string, url: string): boolean => {
    try {
        const urlObj = new URL(url, window.location.origin);
        const path = urlObj.pathname;
        const search = urlObj.search;
        
        // Match standard automated/polling background routes that fire automatically on an interval
        if (path.includes('/api/sessions') && search.includes('action=heartbeat')) {
            return true;
        }
        
        if (path.includes('/api/version-control') || path.includes('version.json')) {
            return true;
        }
        
        if (urlObj.hostname === 'api.iconify.design' && path.includes('/search')) {
            return true;
        }

        if (urlObj.hostname.includes('generativelanguage.googleapis') || path.includes('/models/gemini-')) {
            return true;
        }

        if (path.includes('/api/news') || path.includes('/api/image-proxy')) {
            return true;
        }
        
        return false;
    } catch {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('heartbeat') || 
               lowerUrl.includes('version-control') || 
               lowerUrl.includes('version.json') ||
               lowerUrl.includes('generativelanguage.googleapis.com') ||
               lowerUrl.includes('/models/gemini-') ||
               lowerUrl.includes('/api/news') ||
               lowerUrl.includes('/api/image-proxy') ||
               (lowerUrl.includes('api.iconify.design') && lowerUrl.includes('/search'));
    }
};

export const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getBodySize = (body: any) => {
    if (!body) return 0;
    if (typeof body === 'string') return new Blob([body]).size;
    try {
        return new Blob([JSON.stringify(body)]).size;
    } catch {
        return 0;
    }
};

export const getRelativeDateAnd24hTime = (dateInput: string | number | Date | null | undefined) => {
    if (!dateInput) return { relativeDate: '-', time24h: '-', exactString: '-' };
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return { relativeDate: '-', time24h: '-', exactString: '-' };

    // Format 24-hour time
    const time24h = d.toLocaleTimeString('en-GB', { 
        timeZone: 'Asia/Kolkata', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });

    // Exact Date string e.g., "2 June 26, 14:30:15"
    const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Asia/Kolkata' });
    const year = d.toLocaleDateString('en-GB', { year: '2-digit', timeZone: 'Asia/Kolkata' });
    const exactString = `${day} ${month} ${year}, ${time24h}`;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relativeDate = '';
    if (diffMs < 0) {
        relativeDate = 'Today';
    } else if (diffDays === 0) {
        relativeDate = 'Today';
    } else if (diffDays === 1) {
        relativeDate = 'Yesterday';
    } else if (diffDays < 7) {
        relativeDate = `${diffDays} days ago`;
    } else if (diffDays >= 7 && diffDays < 14) {
        relativeDate = '1 week ago';
    } else if (diffDays >= 14 && diffDays < 21) {
        relativeDate = '2 weeks ago';
    } else if (diffDays >= 21 && diffDays < 30) {
        relativeDate = '3 weeks ago';
    } else if (diffDays >= 30 && diffDays < 60) {
        relativeDate = '1 month ago';
    } else if (diffDays >= 60 && diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        relativeDate = `${months} months ago`;
    } else {
        const years = Math.floor(diffDays / 365);
        relativeDate = years === 1 ? '1 year ago' : `${years} years ago`;
    }

    return { relativeDate, time24h, exactString };
};

export const highlightSearchMatchText = (
    text: string | null | undefined, 
    searchQuery: string, 
    enabled: boolean, 
    type: 'yellow' | 'blue' | 'purple' | 'green' = 'yellow'
): React.ReactNode => {
    if (!text) return '';
    if (!enabled || !searchQuery || !searchQuery.trim()) {
        return <span>{text}</span>;
    }

    const query = searchQuery.trim();
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    let bgVar = 'var(--dev-highlight-yellow-bg)';
    let textVar = 'var(--dev-highlight-yellow-text)';
    
    if (type === 'blue') {
        bgVar = 'var(--dev-highlight-blue-bg)';
        textVar = 'var(--dev-highlight-blue-text)';
    } else if (type === 'purple') {
        bgVar = 'var(--dev-highlight-purple-bg)';
        textVar = 'var(--dev-highlight-purple-text)';
    } else if (type === 'green') {
        bgVar = 'var(--dev-highlight-green-bg)';
        textVar = 'var(--dev-highlight-green-text)';
    }

    return (
        <>
            {parts.map((part, index) => {
                const isMatch = part.toLowerCase() === query.toLowerCase();
                return isMatch ? (
                    <mark 
                        key={index} 
                        className="session-match-mark"
                        style={{ 
                            backgroundColor: bgVar, 
                            color: textVar, 
                            paddingLeft: '2px', 
                            paddingRight: '2px',
                            borderRadius: '2px',
                        }}
                    >
                        {part}
                    </mark>
                ) : (
                    part
                );
            })}
        </>
    );
};

export const formatSessionDateTime = (dateInput: string | number | Date | null | undefined) => {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';

    // Date part: e.g., "2 June 26"
    const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Asia/Kolkata' });
    const month = d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Asia/Kolkata' });
    const year = d.toLocaleDateString('en-GB', { year: '2-digit', timeZone: 'Asia/Kolkata' });
    
    // Time part: 24h format
    const time24h = d.toLocaleTimeString('en-GB', { 
        timeZone: 'Asia/Kolkata', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
    });

    return `${day} ${month} ${year}, ${time24h}`;
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
        
        // Only truncate the array itself if it is explicitly a binary chunk/payload container
        if (isBinaryKey && processed.length > 3) {
            const firstN = processed.slice(0, 2);
            return [
                ...firstN,
                `... [TRUNCATED ${processed.length - 2} additional items of total array of ${processed.length}] ...`
            ];
        }
        
        // For standard data/human containers, do not truncate the array. Return all processed elements.
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

export const getEnhancedRequestName = (rawUrl: string, requestBody?: any): string => {
    if (!rawUrl) return 'Unknown Request';
    try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const urlObj = new URL(rawUrl, origin);
        const pathname = urlObj.pathname;
        const fullUrl = rawUrl.toLowerCase();
        const search = urlObj.search.toLowerCase();
        const bodyStr = requestBody ? JSON.stringify(requestBody).toLowerCase() : '';

        // 1. News API
        if (pathname.includes('/api/news') || fullUrl.includes('/news')) {
            const cat = urlObj.searchParams.get('category');
            if (cat) {
                const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
                return `${formattedCat} News`;
            }
            return 'Fetch All News';
        }

        // 2. Notes Query
        const isNotesReq = 
            pathname.includes('/api/notes') || 
            pathname.includes('/notes') || 
            pathname.includes('/rest/v1/notes') ||
            (pathname.includes('/api/db/query') && (search.includes('notes') || bodyStr.includes('"table":"notes"') || bodyStr.includes('"notes"')));

        if (isNotesReq) {
            const qParam = urlObj.searchParams.get('q') || '';
            let isSaveAction = false;
            if (typeof requestBody === 'object' && requestBody !== null) {
                if (requestBody.insert || requestBody.upsert || requestBody.action === 'save' || requestBody.action === 'insert') {
                    isSaveAction = true;
                }
            }
            if (qParam.includes('save') || qParam.includes('insert') || qParam.includes('create') || qParam.includes('update_note')) {
                isSaveAction = true;
            }
            return isSaveAction ? 'Save User Notes' : 'Fetch User Notes';
        }

        // 3. Session Track
        if (
            search.includes('action=track') || 
            pathname.includes('/track-session') || 
            pathname.includes('/session/track') ||
            (pathname.includes('/api/sessions') && (search.includes('track') || bodyStr.includes('track')))
        ) {
            return 'Track Live Session';
        }

        // 4. Session Heartbeat
        if (
            search.includes('action=heartbeat') || 
            pathname.includes('/heartbeat') || 
            (pathname.includes('/api/sessions') && (search.includes('heartbeat') || bodyStr.includes('heartbeat')))
        ) {
            return 'Ping Active Session';
        }

        // 5. Other Session Actions
        if (pathname.includes('/api/sessions')) {
            const action = urlObj.searchParams.get('action');
            if (action === 'terminate') return 'Terminate User Session';
            if (action === 'delete') return 'Delete User Session';
            return 'Manage User Sessions';
        }

        // 6. Device Mapper
        if (pathname.includes('/api/device-mapper')) {
            const action = urlObj.searchParams.get('action');
            if (action === 'api_keys_list') return 'Fetch API Keys';
            if (action === 'api_key_create') return 'Create API Key';
            if (action === 'api_key_delete') return 'Delete API Key';
            if (action === 'set_ai_model') return 'Switch AI Model';
            if (action === 'init_devices_tab') return 'Load Device Settings';
            if (action === 'cache_update') return 'Sync Device Cache';
            if (action === 'cache_delete') return 'Purge Device Cache';
            if (action === 'clear_audit_logs') return 'Purge Audit Logs';
            return 'Device Mapper API';
        }

        // 7. Image Proxy & Image Cache
        if (pathname.includes('/api/image-proxy')) {
            const imgUrl = urlObj.searchParams.get('url');
            const action = urlObj.searchParams.get('action');
            if (action === 'batch_warmup' || !imgUrl) {
                return 'Proxy Batch Warmup';
            }
            const filename = imgUrl.split('/').pop()?.split('?')[0] || 'Image';
            const cleanFile = filename.length > 10 ? filename.substring(0, 8) + '..' : filename;
            return `Proxy ${cleanFile}`;
        }
        if (pathname.includes('/api/image-cache-status')) return 'Check Image Cache';
        if (pathname.includes('/api/image-cache-clear')) return 'Clear Image Cache';
        if (pathname.includes('/api/image-cache-delete')) return 'Delete Image Cache';

        // 8. Database Query Inspection
        if (pathname.includes('/api/db/query')) {
            const qParam = urlObj.searchParams.get('q') || '';
            if (typeof requestBody === 'object' && requestBody !== null) {
                if (requestBody.insert || requestBody.upsert) return 'Insert DB Record';
                if (requestBody.update || requestBody.data) return 'Update DB Record';
                if (requestBody.delete) return 'Delete DB Record';
                if (requestBody.select) return 'Query DB Data';
            }
            if (qParam.includes('insert')) return 'Insert DB Record';
            if (qParam.includes('update')) return 'Update DB Record';
            if (qParam.includes('delete')) return 'Delete DB Record';
            if (qParam.includes('fetch') || qParam.includes('select') || qParam.includes('get')) return 'Query DB Data';
            return 'Execute DB Query';
        }

        // 9. Other Server APIs
        if (pathname.includes('/api/url-reader')) {
            const action = urlObj.searchParams.get('action');
            if (action === 'follow-up') return 'URL Reader Followup';
            return 'Fetch URL Content';
        }
        if (pathname.includes('/api/version-control') || pathname.includes('/api/version/check')) return 'Check App Version';
        if (pathname.includes('/api/dairy/suggest-icon')) return 'Suggest Icon AI';
        if (pathname.includes('/api/health')) return 'Health Check';
        if (pathname.includes('/api/db/clear-cache')) return 'Clear DB Cache';
        if (pathname.includes('/api/debug-triggers')) return 'Debug DB Triggers';
        if (pathname.includes('/api/debug-news-keys')) return 'Debug News Keys';
        if (pathname.includes('/api/session-cache/stream')) return 'Stream Session Cache';

        // 9. External Services
        if (urlObj.hostname === 'api.iconify.design' && pathname.includes('/search')) {
            const qParam = urlObj.searchParams.get('query');
            return qParam ? `Iconify "${qParam.slice(0, 10)}"` : 'Iconify Search';
        }
        if (urlObj.hostname.includes('generativelanguage.googleapis') || pathname.includes('/models/gemini-')) {
            const modelMatch = pathname.match(/\/models\/([a-zA-Z0-9.-]+)/);
            const modelName = modelMatch ? modelMatch[1].replace('gemini-', '') : 'AI';
            return `Gemini ${modelName}`;
        }
        if (urlObj.hostname.includes('pubchem.ncbi.nlm.nih.gov')) {
            return 'PubChem Compound Data';
        }

        // 10. Fallback: Parse last segment or domain, limit strictly to max 3 words
        const rawSegment = pathname.split('/').filter(Boolean).pop() || urlObj.hostname;
        const cleaned = rawSegment
            .replace(/[._-]/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .trim();
        
        const words = cleaned.split(/\s+/).filter(Boolean);
        if (words.length === 0) return 'Network Request';
        
        const resultWords = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1));
        return resultWords.join(' ');
    } catch {
        return 'Network Request';
    }
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

export const formatTimestamp = (dateInput: Date | string | undefined | null) => {
    if (!dateInput) return '-';
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return '-';
    const hrs = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
};
