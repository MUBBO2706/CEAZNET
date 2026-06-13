/// <reference types="vite/client" />
// services/telegramStorage.ts

// We use import.meta.env for the keys. 
// In a real production app, you might want to move this to a Supabase Edge Function to hide the bot token.
// But for this "jugaad", running it client-side works perfectly and is easy to set up.
export const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8";
export const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || "5965153830";

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
    
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    
    // Telegram API requires a filename for blobs to recognize them as files
    if (file instanceof Blob && !filename) {
        filename = `file_${Date.now()}.webm`;
    }
    
    const isVideo = file.type.startsWith('video/') || (filename && filename.toLowerCase().endsWith('.mp4'));
    const isAudio = file.type.startsWith('audio/');
    
    let endpoint = 'sendDocument';
    let fileKey = 'document';
    
    if (isVideo) {
        endpoint = 'sendVideo';
        fileKey = 'video';
    } else if (isAudio) {
        endpoint = 'sendAudio';
        fileKey = 'audio';
    }
    
    formData.append(fileKey, file, filename);

    if (metadata) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const date = metadata.uploadedAt ? new Date(metadata.uploadedAt) : new Date();
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

        const uId = metadata.userId || 'N/A';
        const uName = metadata.userName || 'N/A';
        const uEmail = metadata.userEmail || 'N/A';
        const uTime = formattedDate;
        const fName = filename || 'N/A';
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
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${endpoint}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Telegram Storage] Upload failed:', response.status, response.statusText, errorData);
            throw new Error(`Upload failed: ${errorData.description || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.ok) {
            console.error('[Telegram Storage] Telegram API Error:', data.description);
            throw new Error(data.description || 'Telegram API Error');
        }

        console.log('[Telegram Storage] Upload successful');
        // Extract file_id from the response
        const result = data.result;
        const media = result.document || result.video || result.audio || result.animation || result.video_note || result.voice;
        let fileId = media?.file_id;
        const thumbFileId = media?.thumbnail?.file_id || media?.thumb?.file_id;
        
        if (!fileId) {
            // Fallback for photos (Telegram returns an array of photo sizes)
            if (result.photo && result.photo.length > 0) {
                fileId = result.photo[result.photo.length - 1].file_id;
            } else {
                console.error('[Telegram Storage] Full result for debugging:', result);
                throw new Error('Could not extract file_id from Telegram response');
            }
        }

        const messageId = data.result.message_id;

        // Return a custom URI scheme so our app knows it's a Telegram file, including message_id for deletion and thumb for preview
        let finalUrl = `tg://${fileId}?msg=${messageId}`;
        if (thumbFileId) finalUrl += `&thumb=${thumbFileId}`;
        return finalUrl;
    } catch (err: any) {
        console.error('[Telegram Storage] Network or Fetch Error during upload:', err);
        if (err.message === 'Failed to fetch') {
            throw new Error('Network error: Could not reach Telegram. Please check your internet or VPN.');
        }
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
            console.error('[Telegram Storage] Failed to delete message from Telegram:', response.statusText);
            return false;
        }

        const data = await response.json();
        if (!data.ok) {
            console.error('[Telegram Storage] Telegram API error on delete:', data.description);
            return false;
        }

        console.log('[Telegram Storage] Successfully deleted message from Telegram.');
        return true;
    } catch (err) {
        console.error('[Telegram Storage] Error deleting Telegram file:', err);
        return false;
    }
};

// Simple in-memory cache for resolved URLs (valid for current session)
const urlCache = new Map<string, { url: string, timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const pendingPromises = new Map<string, Promise<string>>();

/**
 * Gets a temporary download URL (valid for 1 hour) for a given Telegram file_id or tg:// URL.
 * @param urlOrId The tg:// URL or file_id
 * @param useThumb If true, tries to get the thumbnail URL instead of the main file
 */
export const getFileUrlFromTelegram = async (urlOrId: string, useThumb: boolean = false): Promise<string> => {
    if (!urlOrId) return '';
    
    // If it's already a standard HTTP URL, just return it
    if (urlOrId.startsWith('http')) {
        return urlOrId;
    }
    
    // Check cache first (with thumb suffix if needed)
    const cacheKey = useThumb ? `${urlOrId}_thumb` : urlOrId;
    const cached = urlCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.url;
    }

    // Check if there is already a pending promise for this key to prevent concurrent duplicate calls
    const pending = pendingPromises.get(cacheKey);
    if (pending) {
        return pending;
    }

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
            // Use encodeURIComponent for safety, though file_ids are usually URL-safe
            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
            
            let data;
            if (!response.ok) {
                data = await response.json().catch(() => ({}));
                console.error('[Telegram Storage] Telegram API error:', response.status, data);
            } else {
                data = await response.json();
            }
            
            if (!data.ok) {
                console.error('[Telegram Storage] Telegram API error:', data.description);
                // If file is too big (>20MB), Telegram returns an error here
                if (data.description?.toLowerCase().includes('too big')) {
                    return '__TOO_LARGE__';
                }
                if (data.description?.toLowerCase().includes('invalid file id') || data.description?.toLowerCase().includes('not found') || data.description?.toLowerCase().includes('file is unavailable')) {
                    return '__NOT_FOUND__';
                }
                return '';
            }

            const filePath = data.result.file_path;
            if (!filePath) return '';

            const finalUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
            
            // Save to cache using the correct cacheKey
            urlCache.set(cacheKey, { url: finalUrl, timestamp: Date.now() });
            
            return finalUrl;
        } catch (err) {
            console.error('[Telegram Storage] Error fetching Telegram file URL:', err);
            return '';
        } finally {
            // Remove from the pending map once resolution is complete
            pendingPromises.delete(cacheKey);
        }
    })();

    pendingPromises.set(cacheKey, fetchPromise);
    return fetchPromise;
};
