import React from 'react';

// Common utility functions for DevTools
export const getGroupKey = (method: string, url: string) => {
    try {
        const u = new URL(url, window.location.origin);
        u.searchParams.delete('t');
        u.searchParams.delete('_');
        u.searchParams.delete('v');
        return `${method} ${u.pathname}${u.search}`;
    } catch {
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
        
        return false;
    } catch {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes('heartbeat') || 
               lowerUrl.includes('version-control') || 
               lowerUrl.includes('version.json');
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
