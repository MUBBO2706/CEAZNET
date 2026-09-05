/// <reference types="vite/client" />
// services/telegramStorage.ts

import { supabase } from './supabaseClient';

const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : false;

export let TELEGRAM_BOT_TOKEN = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_TOKEN)
  || (typeof process !== 'undefined' && process.env?.TELEGRAM_BOT_TOKEN)
  || (isDev ? "8403959177:AAFJrkcRCeTHTyS5uVBwlLKTE79dwq_HYzU" : "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8");

export let TELEGRAM_CHAT_ID = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_CHAT_ID)
  || (typeof process !== 'undefined' && process.env?.TELEGRAM_CHAT_ID)
  || (isDev ? "-1003984567697" : "5965153830");

// Track invalid tokens to avoid continuous 401 Unauthorized hammering
const invalidTokens = new Set<string>();
let lastDbTokenFetch = 0;
const DB_TOKEN_FETCH_INTERVAL = 60 * 1000; // 1 minute

async function getCandidateBotTokens(): Promise<string[]> {
    const tokens: string[] = [];
    
    // 1. Env tokens
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_TOKEN) {
        tokens.push(import.meta.env.VITE_TELEGRAM_BOT_TOKEN);
    }
    if (typeof process !== 'undefined' && process.env?.TELEGRAM_BOT_TOKEN) {
        tokens.push(process.env.TELEGRAM_BOT_TOKEN);
    }
    if (TELEGRAM_BOT_TOKEN) {
        tokens.push(TELEGRAM_BOT_TOKEN);
    }

    // 2. Fetch from Supabase platform_settings dynamically
    const now = Date.now();
    if (now - lastDbTokenFetch > DB_TOKEN_FETCH_INTERVAL) {
        lastDbTokenFetch = now;
        try {
            const { data } = await supabase
                .from('platform_settings')
                .select('setting_key, setting_value')
                .in('setting_key', ['telegram_bot_token', 'telegram_chat_id']);
            
            if (data && Array.isArray(data)) {
                const tokenRow = data.find(r => r.setting_key === 'telegram_bot_token');
                const chatRow = data.find(r => r.setting_key === 'telegram_chat_id');
                if (tokenRow?.setting_value && typeof tokenRow.setting_value === 'string' && tokenRow.setting_value.trim()) {
                    const dbToken = tokenRow.setting_value.trim();
                    TELEGRAM_BOT_TOKEN = dbToken;
                    tokens.unshift(dbToken);
                }
                if (chatRow?.setting_value && typeof chatRow.setting_value === 'string' && chatRow.setting_value.trim()) {
                    TELEGRAM_CHAT_ID = chatRow.setting_value.trim();
                }
            }
        } catch (e) {
            // Silently ignore db fetch errors
        }
    }

    // 3. Fallback tokens
    tokens.push("8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8");
    tokens.push("8403959177:AAFJrkcRCeTHTyS5uVBwlLKTE79dwq_HYzU");

    // Filter out duplicates and known invalid tokens (unless no valid tokens remain)
    const unique = Array.from(new Set(tokens)).filter(Boolean);
    const valid = unique.filter(t => !invalidTokens.has(t));
    return valid.length > 0 ? valid : unique;
}

export const sendTelegramAlert = async (text: string): Promise<boolean> => {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: text
            })
        });
        return response.ok;
    } catch (err) {
        console.error('[Telegram Storage] Failed to send alert', err);
        return false;
    }
};

const formatBytes = (bytes: number, decimals = 2): string => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export interface UploadMetadata {
    userId?: string;
    userName?: string;
    userEmail?: string;
    uploadedAt?: string;
    fileType?: string;
    fileSize?: string;
    mimeType?: string;
}

/**
 * Uploads a file to Telegram and returns a special tg:// URL containing the file_id.
 */
export const uploadFileToTelegram = async (
    file: Blob | File, 
    filename?: string,
    metadata?: UploadMetadata
): Promise<string> => {
    console.log(`[Telegram Storage] Uploading ${filename || 'file'} (${file.size} bytes) to Telegram...`);
    
    // Fix for browser fetch + FormData issues (especially iOS Safari and detached files)
    let uploadableFile: Blob | File = file;
    try {
        if (file instanceof File || file instanceof Blob) {
            const buffer = await file.arrayBuffer();
            uploadableFile = new File([buffer], filename || ('name' in file ? (file as File).name : '') || 'file', { type: file.type });
        }
    } catch (e) {
        console.warn('[Telegram Storage] Buffer conversion failed, using original file', e);
    }

    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    
    // Telegram API requires a filename for blobs to recognize them as files
    let finalFilename = filename;
    if (!finalFilename) {
        if (file instanceof File && file.name) {
            finalFilename = file.name;
        } else {
            finalFilename = `file_${Date.now()}.webm`;
        }
    }
    
    const isVideo = file.type.startsWith('video/') || (finalFilename && finalFilename.toLowerCase().endsWith('.mp4'));
    const isAudio = file.type.startsWith('audio/') || (finalFilename && finalFilename.toLowerCase().endsWith('.webm'));
    
    let endpoint = 'sendDocument';
    let fileKey = 'document';
    
    if (isVideo) {
        endpoint = 'sendVideo';
        fileKey = 'video';
    } else if (isAudio) {
        endpoint = 'sendAudio';
        fileKey = 'audio';
    }
    
    formData.append(fileKey, uploadableFile, finalFilename);

    if (metadata) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const date = metadata.uploadedAt ? new Date(metadata.uploadedAt) : new Date();
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

        const uId = metadata.userId || 'N/A';
        const uName = metadata.userName || 'N/A';
        const uEmail = metadata.userEmail || 'N/A';
        const uTime = formattedDate;
        const fName = finalFilename || 'N/A';
        const fType = metadata.fileType || 'N/A';
        const fMime = metadata.mimeType || file.type || 'N/A';
        const fSize = metadata.fileSize || formatBytes(file.size);
        
        const captionText = 
`🗂️ <b>NEW FILE UPLOAD</b>
━━━━━━━━━━━━━━━━━━━
👤 <b>UPLOADER DETAILS</b>
├─ <b>User ID:</b> <code>${uId}</code>
├─ <b>Name:</b> <code>${uName}</code>
└─ <b>Email:</b> <code>${uEmail}</code>

📄 <b>FILE DETAILS</b>
├─ <b>Filename:</b> <code>${fName}</code>
├─ <b>File Type:</b> <code>${fType}</code>
├─ <b>MIME Type:</b> <code>${fMime}</code>
└─ <b>File Size:</b> <code>${fSize}</code>

⏰ <b>TIMESTAMP</b>
└─ <code>${uTime}</code>
━━━━━━━━━━━━━━━━━━━`;
        
        formData.append('caption', captionText);
        formData.append('parse_mode', 'HTML');
    }

    try {
        const candidateTokens = await getCandidateBotTokens();
        const activeToken = candidateTokens[0] || TELEGRAM_BOT_TOKEN;

        // Use XMLHttpRequest as it's more reliable than fetch for large FormData uploads across browsers
        return await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `https://api.telegram.org/bot${activeToken}/${endpoint}`, true);
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (!data.ok) {
                            console.warn('[Telegram Storage] Telegram API Error:', data.description);
                            if (data.error_code === 401 || data.description?.toLowerCase().includes('unauthorized')) {
                                invalidTokens.add(activeToken);
                                reject(new Error('Telegram Bot Token is unauthorized or expired. Please update it in platform settings.'));
                                return;
                            }
                            reject(new Error(data.description || 'Telegram API Error'));
                            return;
                        }

                        console.log('[Telegram Storage] Upload successful');
                        const result = data.result;
                        const media = result.document || result.video || result.audio || result.animation || result.video_note || result.voice;
                        let fileId = media?.file_id;
                        const thumbFileId = media?.thumbnail?.file_id || media?.thumb?.file_id;
                        
                        if (!fileId) {
                            if (result.photo && result.photo.length > 0) {
                                fileId = result.photo[result.photo.length - 1].file_id;
                            } else {
                                console.warn('[Telegram Storage] Full result for debugging:', result);
                                reject(new Error('Could not extract file_id from Telegram response'));
                                return;
                            }
                        }

                        const messageId = data.result.message_id;
                        let finalUrl = `tg://${fileId}?msg=${messageId}`;
                        if (thumbFileId) finalUrl += `&thumb=${thumbFileId}`;
                        resolve(finalUrl);
                    } catch (e) {
                        reject(new Error('Failed to parse Telegram API response'));
                    }
                } else {
                    let errorData: any = {};
                    try { errorData = JSON.parse(xhr.responseText); } catch (e) {}
                    console.warn('[Telegram Storage] Upload failed:', xhr.status, xhr.statusText, errorData);
                    reject(new Error(`Upload failed: ${errorData.description || xhr.statusText || 'Unknown Error'}`));
                }
            };
            
            xhr.onerror = function() {
                console.warn('[Telegram Storage] XMLHttpRequest Error during upload');
                reject(new Error('Network error: Could not reach Telegram. Please check your internet or VPN.'));
            };
            
            xhr.send(formData);
        });
    } catch (err: any) {
        console.warn('[Telegram Storage] Error during upload:', err);
        throw err;
    }
};

/**
 * Deletes a file (message) from Telegram using the message_id stored in the tg:// URL.
 */
export const deleteFileFromTelegram = async (urlOrId: string): Promise<boolean> => {
    if (!urlOrId || !urlOrId.startsWith('tg://')) return false;
    
    try {
        const url = new URL(urlOrId);
        const messageId = url.searchParams.get('msg');
        
        if (!messageId) {
            console.warn('[Telegram Storage] No message_id found in URL, cannot delete from Telegram:', urlOrId);
            return false;
        }

        console.log(`[Telegram Storage] Deleting message ${messageId} from Telegram...`);
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                message_id: messageId
            })
        });

        if (!response.ok) {
            console.warn('[Telegram Storage] Failed to delete message from Telegram:', response.statusText);
            return false;
        }

        const data = await response.json();
        if (!data.ok) {
            console.warn('[Telegram Storage] Telegram API error on delete:', data.description);
            return false;
        }

        console.log('[Telegram Storage] Successfully deleted message from Telegram.');
        return true;
    } catch (err) {
        console.warn('[Telegram Storage] Error deleting Telegram file:', err);
        return false;
    }
};

// Simple in-memory cache for resolved URLs (valid for current session)
const urlCache = new Map<string, { url: string, timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const pendingPromises = new Map<string, Promise<string>>();

/**
 * Invalidate the memory cache for a given Telegram URL/ID (useful when Telegram 1-hour URL expires).
 */
export const invalidateTelegramUrlCache = (urlOrId: string) => {
    if (!urlOrId) return;
    urlCache.delete(urlOrId);
    urlCache.delete(`${urlOrId}_thumb`);
    pendingPromises.delete(urlOrId);
    pendingPromises.delete(`${urlOrId}_thumb`);
};

/**
 * Helper to check if an image has failed or is marked as permanently failed in local storage.
 */
const isImagePermanentlyFailed = (urlOrId: string): boolean => {
    if (!urlOrId) return false;
    if (urlOrId.includes('failed=true') || urlOrId.includes('failed')) return true;
    
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('ceaznet_failed_images_12');
            if (stored) {
                const urls = JSON.parse(stored);
                if (Array.isArray(urls)) {
                    return urls.some(u => u === urlOrId || u.includes(urlOrId) || urlOrId.includes(u));
                }
            }
        } catch (e) {
            // ignore
        }
    }
    return false;
};

// Candidate bot tokens to try in fallback order if primary token cannot access the file
const CANDIDATE_BOT_TOKENS = Array.from(new Set([
    TELEGRAM_BOT_TOKEN,
    "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8", // Production Bot
    "8403959177:AAFJrkcRCeTHTyS5uVBwlLKTE79dwq_HYzU"  // Dev Bot
])).filter(Boolean);

/**
 * Gets a temporary download URL for a given Telegram file_id or tg:// URL.
 * Supports token fallback across bot instances and auto-refresh for expired URLs.
 * @param urlOrId The tg:// URL or file_id
 * @param useThumb If true, tries to get the thumbnail URL instead of the main file
 * @param forceRefresh If true, bypasses the in-memory cache and fetches a fresh URL from Telegram
 */
export const getFileUrlFromTelegram = async (
    urlOrId: string, 
    useThumb: boolean = false,
    forceRefresh: boolean = false
): Promise<string> => {
    if (!urlOrId) return '';
    
    // If it's already a standard HTTP URL, just return it
    if (urlOrId.startsWith('http')) {
        return urlOrId;
    }
    
    // Check cache first (with thumb suffix if needed)
    const cacheKey = useThumb ? `${urlOrId}_thumb` : urlOrId;
    if (!forceRefresh) {
        const cached = urlCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.url;
        }
    } else {
        urlCache.delete(cacheKey);
    }

    // Check if there is already a pending promise for this key to prevent concurrent duplicate calls
    const pending = pendingPromises.get(cacheKey);
    if (pending && !forceRefresh) {
        return pending;
    }

    const isFailedImage = isImagePermanentlyFailed(urlOrId);
    const logError = (...args: any[]) => {
        if (isFailedImage) {
            console.warn('[Telegram Storage] [Warn/Failed Image]', ...args);
        } else {
            console.error(...args);
        }
    };

    const fetchPromise = (async () => {
        // Extract file_id if it's our custom tg:// scheme
        let fileId = urlOrId;
        if (urlOrId.startsWith('tg://')) {
            const urlObj = new URL(urlOrId);
            if (useThumb) {
                const thumbId = urlObj.searchParams.get('thumb');
                if (thumbId) {
                    fileId = thumbId;
                } else if (urlOrId.includes('thumb=')) {
                    // Fallback for manual parsing if URL constructor fails
                    fileId = urlOrId.split('thumb=')[1].split('&')[0];
                } else {
                    // No thumb available
                    return '';
                }
            } else {
                fileId = urlOrId.replace('tg://', '').split('?')[0];
            }
        }

        try {
            const candidateTokens = await getCandidateBotTokens();
            let lastErrorDesc = '';
            
            for (const botToken of candidateTokens) {
                try {
                    const response = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`);
                    let data: any = {};
                    try {
                        data = await response.json();
                    } catch {
                        data = {};
                    }
                    
                    if (data && data.ok && data.result?.file_path) {
                        const filePath = data.result.file_path;
                        const finalUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
                        
                        // Save to cache using the correct cacheKey
                        urlCache.set(cacheKey, { url: finalUrl, timestamp: Date.now() });
                        return finalUrl;
                    }
                    
                    if (data?.error_code === 401 || data?.description?.toLowerCase().includes('unauthorized')) {
                        invalidTokens.add(botToken);
                        lastErrorDesc = 'Unauthorized';
                    } else if (data?.description) {
                        lastErrorDesc = data.description;
                        if (data.description.toLowerCase().includes('too big')) {
                            return '__TOO_LARGE__';
                        }
                    }
                } catch (botErr) {
                    // try next candidate token
                }
            }

            if (lastErrorDesc) {
                if (lastErrorDesc.toLowerCase().includes('unauthorized')) {
                    console.warn('[Telegram Storage] Telegram bot token is unauthorized or expired. Please update it in platform settings.');
                    // Cache the empty result for 5 minutes so we don't spam network requests
                    urlCache.set(cacheKey, { url: '', timestamp: Date.now() - CACHE_TTL + 5 * 60 * 1000 });
                    return '';
                }

                logError('[Telegram Storage] Telegram file resolution:', lastErrorDesc);
                if (lastErrorDesc.toLowerCase().includes('invalid file id') || 
                    lastErrorDesc.toLowerCase().includes('wrong file identifier') ||
                    lastErrorDesc.toLowerCase().includes('not found') || 
                    lastErrorDesc.toLowerCase().includes('file is unavailable')) {
                    urlCache.set(cacheKey, { url: '__NOT_FOUND__', timestamp: Date.now() });
                    return '__NOT_FOUND__';
                }
            }

            return '';
        } catch (err) {
            console.warn('[Telegram Storage] Error fetching Telegram file URL:', err);
            return '';
        } finally {
            // Remove from the pending map once resolution is complete
            pendingPromises.delete(cacheKey);
        }
    })();

    pendingPromises.set(cacheKey, fetchPromise);
    return fetchPromise;
};
