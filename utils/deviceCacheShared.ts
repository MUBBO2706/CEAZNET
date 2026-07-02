import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Get environment values (handling both server-side process.env)
function getEnvValue(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
}

const supabaseUrl = getEnvValue('VITE_SUPABASE_URL') || getEnvValue('SUPABASE_URL') || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY') || getEnvValue('VITE_SUPABASE_ANON_KEY') || getEnvValue('SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

interface CacheIndex {
  deviceCache?: { messageId: number; fileId: string };
  imageCache?: { messageId: number; fileId: string };
  sessionCache?: { messageId: number; fileId: string };
}

let deviceMemoryCache: Record<string, string | null> | null = null;
let imageMemoryCache: Record<string, { dataUrl: string; timestamp: number }> | null = null;
let sessionMemoryCache: Record<string, any> | null = null;

let lastDeviceFetchTime = 0;
let lastImageFetchTime = 0;
let lastSessionFetchTime = 0;
const MEMORY_CACHE_TTL = 30000; // 30 seconds local in-memory TTL to avoid repeated hits on API calls

// Dynamically fetch and resolve Telegram Bot secrets so that changes can be made from environment or Supabase platform settings!
export async function getTelegramCredentials(): Promise<{ token: string; cacheChatId: string; isConfigured: boolean }> {
  let token = getEnvValue('TELEGRAM_BOT_TOKEN') || getEnvValue('VITE_TELEGRAM_BOT_TOKEN');
  let cacheChatId = getEnvValue('TELEGRAM_CACHE_CHAT_ID') || getEnvValue('VITE_TELEGRAM_CACHE_CHAT_ID') || getEnvValue('TELEGRAM_CHAT_ID') || getEnvValue('VITE_TELEGRAM_CHAT_ID');

  // fallback database check to allow dynamic management through Admin Panel settings without redeploying!
  if (!token || !cacheChatId) {
    try {
      const { data } = await supabaseAdmin
        .from('platform_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['telegram_bot_token', 'telegram_cache_chat_id', 'telegram_chat_id']);
      
      if (data) {
        const tokenRow = data.find(r => r.setting_key === 'telegram_bot_token');
        const cacheChatRow = data.find(r => r.setting_key === 'telegram_cache_chat_id') || data.find(r => r.setting_key === 'telegram_chat_id');
        if (tokenRow?.setting_value) token = String(tokenRow.setting_value);
        if (cacheChatRow?.setting_value) cacheChatId = String(cacheChatRow.setting_value);
      }
    } catch (err) {
      console.warn("Could not query platform settings for Telegram:", err);
    }
  }

  const isDev = getEnvValue('NODE_ENV') !== 'production';
  const defaultToken = isDev ? "8403959177:AAFJrkcRCeTHTyS5uVBwlLKTE79dwq_HYzU" : "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8";
  const defaultChatId = isDev ? "-1003984567697" : "5965153830";

  if (!token) token = defaultToken;
  if (!cacheChatId) cacheChatId = defaultChatId;

  const isConfigured = !!token && !!cacheChatId && !token.includes('MY_BOT_TOKEN');
  
  return {
    token: token || "",
    cacheChatId: cacheChatId || "",
    isConfigured
  };
}

let cachedIndex: CacheIndex | null = null;
let cachedPinnedMessageId: number | null = null;
let lastIndexFetchTime = 0;
const INDEX_CACHE_TTL = 10000; // 10 seconds

async function getCacheIndex(token: string, cacheChatId: string): Promise<{ index: CacheIndex, pinnedMessageId: number | null }> {
  const now = Date.now();
  try {
    const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cacheChatId })
    });
    if (!chatRes.ok) return { index: cachedIndex || {}, pinnedMessageId: cachedPinnedMessageId };
    
    const chatData = await chatRes.json();
    if (!chatData.ok || !chatData.result || !chatData.result.pinned_message) {
      return { index: cachedIndex || {}, pinnedMessageId: cachedPinnedMessageId };
    }
    
    const pinnedMessage = chatData.result.pinned_message;
    const text = pinnedMessage.text || pinnedMessage.caption || "";
    const match = text.match(/(\{.*\})/s);
    let parsedIndex: CacheIndex = {};
    if (match) {
      try {
        parsedIndex = JSON.parse(match[1]);
      } catch (err) {}
    }
    cachedIndex = parsedIndex;
    cachedPinnedMessageId = pinnedMessage.message_id;
    lastIndexFetchTime = now;
    return { index: { ...parsedIndex }, pinnedMessageId: pinnedMessage.message_id };
  } catch (err) {
    return { index: cachedIndex || {}, pinnedMessageId: cachedPinnedMessageId };
  }
}

async function saveCacheIndex(token: string, cacheChatId: string, index: CacheIndex, pinnedMessageId: number | null) {
  const indexString = JSON.stringify(index);
  const formattedText = `📊 <b>System Caches Index</b>\n\n📂 <b>deviceCache.json</b>\n📂 <b>imageCache.json</b>\n📂 <b>sessionCache.json</b>\n\n<tg-spoiler>${indexString}</tg-spoiler>`;
  
  cachedIndex = { ...index };
  lastIndexFetchTime = Date.now();

  if (pinnedMessageId) {
    const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cacheChatId, message_id: pinnedMessageId, text: formattedText, parse_mode: 'HTML' })
    });
    const editData = await editRes.json();
    if (editData.ok) {
      cachedPinnedMessageId = pinnedMessageId;
      return;
    } else {
      console.warn("[Telegram Cache] Failed to edit index message, trying to send new one:", editData.description);
    }
  }

  // Fallback: send new message and pin it
  const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: cacheChatId, text: formattedText, parse_mode: 'HTML' })
  });
  const sendData = await sendRes.json();
  if (sendData.ok) {
    const newMessageId = sendData.result.message_id;
    cachedPinnedMessageId = newMessageId;
    await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cacheChatId, message_id: newMessageId, disable_notification: true })
    });
    if (pinnedMessageId) {
      await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: cacheChatId, message_id: pinnedMessageId })
      }).catch(() => {});
    }
  }
}

async function loadCacheFileFromTelegram(cacheType: 'deviceCache' | 'imageCache' | 'sessionCache'): Promise<any> {
  const { token, cacheChatId } = await getTelegramCredentials();
  if (!token || !cacheChatId) return null;
  
  const { index } = await getCacheIndex(token, cacheChatId);
  const fileInfo = index[cacheType];
  if (!fileInfo?.fileId) return null;

  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileInfo.fileId}`);
    if (!fileRes.ok) return null;
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) return null;
    
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
    const dataRes = await fetch(downloadUrl);
    if (!dataRes.ok) return null;
    
    return await dataRes.json();
  } catch (err) {
    console.warn(`[Telegram Cache] Failed to load ${cacheType}:`, err);
    return null;
  }
}

let saveQueue: Promise<any> = Promise.resolve();

async function saveCacheFileToTelegram(cacheType: 'deviceCache' | 'imageCache' | 'sessionCache', data: any, captionStr?: string): Promise<boolean> {
  const resultPromise = saveQueue.then(async () => {
    try {
      return await saveCacheFileToTelegramInternal(cacheType, data, captionStr);
    } catch (err: any) {
      console.error(`[Telegram Cache Queue] Sequential save failed for ${cacheType}:`, err.message || err);
      return false;
    }
  });
  saveQueue = resultPromise.then(() => {}).catch(() => {});
  return resultPromise;
}

async function saveCacheFileToTelegramInternal(cacheType: 'deviceCache' | 'imageCache' | 'sessionCache', data: any, captionStr?: string): Promise<boolean> {
  const { token, cacheChatId } = await getTelegramCredentials();
  if (!token || !cacheChatId) return false;

  const { index, pinnedMessageId } = await getCacheIndex(token, cacheChatId);
  const fileInfo = index[cacheType];
  
  const filename = `${cacheType}.json`;
  const cacheString = JSON.stringify(data, null, 2);
  const fileBuffer = Buffer.from(cacheString, 'utf8');

  let success = false;
  let newMessageId = fileInfo?.messageId;
  let newFileId = fileInfo?.fileId;

  // 1. Try to edit existing media message
  if (newMessageId) {
    try {
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const mediaObj: any = { type: 'document', media: `attach://${cacheType}` };
      if (captionStr) {
        mediaObj.caption = captionStr;
        mediaObj.parse_mode = 'Markdown';
      }
      
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${cacheChatId}\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="message_id"\r\n\r\n${newMessageId}\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="media"\r\n\r\n${JSON.stringify(mediaObj)}\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="${cacheType}"; filename="${filename}"\r\nContent-Type: application/json\r\n\r\n`
      ];

      const payload = Buffer.concat([
        Buffer.from(parts[0], 'utf8'),
        Buffer.from(parts[1], 'utf8'),
        Buffer.from(parts[2], 'utf8'),
        Buffer.from(parts[3], 'utf8'),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
      ]);

      const editRes = await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: payload
      });
      const editData = await editRes.json();
      if (editData.ok) {
        success = true;
        newFileId = editData.result.document.file_id;
        console.log(`[Telegram Cache] Successfully edited existing ${cacheType} message (${newMessageId}).`);
      } else {
        console.warn(`[Telegram Cache] Failed to edit existing ${cacheType} message (ID: ${newMessageId}):`, editData.description);
      }
    } catch (err: any) {
      console.error(`[Telegram Cache] Exception editing ${cacheType} message:`, err.message || err);
    }
  }

  // 2. Fallback to sending new document
  if (!success) {
    try {
      console.log(`[Telegram Cache] Creating a brand-new ${cacheType} file message...`);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${cacheChatId}\r\n`,
        captionStr ? `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${captionStr}\r\n` : '',
        captionStr ? `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n` : '',
        `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/json\r\n\r\n`
      ].filter(Boolean);

      const buffers = parts.map(p => Buffer.from(p, 'utf8'));
      buffers.push(fileBuffer);
      buffers.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

      const payload = Buffer.concat(buffers);

      const uploadRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body: payload
      });
      const uploadData = await uploadRes.json();
      if (uploadData.ok) {
        success = true;
        newMessageId = uploadData.result.message_id;
        newFileId = uploadData.result.document.file_id;
        console.log(`[Telegram Cache] Sent brand-new ${cacheType} file (Message ID: ${newMessageId}, File ID: ${newFileId}).`);
        
        // Clean up old message to avoid clutter
        if (fileInfo?.messageId) {
          console.log(`[Telegram Cache] Deleting older ${cacheType} message (${fileInfo.messageId}) to prevent clutter.`);
          fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: cacheChatId, message_id: fileInfo.messageId })
          }).catch((err) => {
            console.error(`[Telegram Cache] Failed to delete older message:`, err.message || err);
          });
        }
      } else {
        console.error(`[Telegram Cache] Failed to send brand-new ${cacheType} file:`, uploadData.description);
      }
    } catch (err: any) {
      console.error(`[Telegram Cache] Exception sending new ${cacheType} document:`, err.message || err);
    }
  }

  // 3. Update index if needed
  if (success && (fileInfo?.messageId !== newMessageId || fileInfo?.fileId !== newFileId)) {
    index[cacheType] = { messageId: newMessageId as number, fileId: newFileId as string };
    await saveCacheIndex(token, cacheChatId, index, pinnedMessageId);
  }

  return success;
}

export let lastDeviceCacheSource: 'telegram-cache' | 'local-server-fallback' = 'local-server-fallback';
export let lastImageCacheSource: 'telegram-cache' | 'local-server-fallback' = 'local-server-fallback';
export let lastSessionCacheSource: 'telegram-cache' | 'local-server-fallback' | 'local-memory' = 'local-server-fallback';

export async function loadDeviceCacheUnified(): Promise<Record<string, string | null>> {
  const credentials = await getTelegramCredentials();
  if (credentials.isConfigured) {
    try {
      const tgCache = await loadCacheFileFromTelegram('deviceCache');
      if (tgCache) {
        deviceMemoryCache = tgCache;
        lastDeviceFetchTime = Date.now();
        lastDeviceCacheSource = 'telegram-cache';
        return tgCache;
      }
    } catch (err) {
      console.warn("[Device Cache] Telegram fetch failed, falling back to local server-side memory:", err);
    }
  }

  // Fallback to server-side local memory cache
  lastDeviceCacheSource = 'local-server-fallback';
  return deviceMemoryCache || {};
}

export async function saveDeviceCacheUnified(
  cacheData: Record<string, string | null>,
  summaryData?: {
    newlyUpdatedCount?: number;
    newlyUpdatedDevices?: string[];
  }
): Promise<boolean> {
  deviceMemoryCache = cacheData;
  lastDeviceFetchTime = Date.now();
  
  const deviceKeys = Object.keys(cacheData || {});
  const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  
  let newDevicesStr = '';
  if (summaryData?.newlyUpdatedDevices && summaryData.newlyUpdatedDevices.length > 0) {
    newDevicesStr = `\n\n🆕 *Newly Updated (${summaryData.newlyUpdatedCount}):*\n` + 
      summaryData.newlyUpdatedDevices.slice(0, 10).map(d => `• \`${d}\``).join('\n') +
      (summaryData.newlyUpdatedDevices.length > 10 ? `\n...and ${summaryData.newlyUpdatedDevices.length - 10} more` : '');
  }

  const caption = `📱 *Device Cache Summary*\n\n📊 *Stats:*\n• Total Devices: ${deviceKeys.length}\n\n🕒 *Last Update (IST):*\n${istTime}${newDevicesStr}`;
  return saveCacheFileToTelegram('deviceCache', cacheData, caption);
}

export async function loadImageCacheUnified(): Promise<Record<string, { dataUrl: string; timestamp: number }>> {
  const credentials = await getTelegramCredentials();
  if (credentials.isConfigured) {
    try {
      const tgCache = await loadCacheFileFromTelegram('imageCache');
      if (tgCache) {
        imageMemoryCache = tgCache;
        lastImageFetchTime = Date.now();
        lastImageCacheSource = 'telegram-cache';
        return tgCache;
      }
    } catch (err) {
      console.warn("[Image Cache] Telegram fetch failed, falling back to local server-side memory:", err);
    }
  }

  // Fallback to server-side local memory cache
  lastImageCacheSource = 'local-server-fallback';
  return imageMemoryCache || {};
}

export async function saveImageCacheUnified(
  cacheData: Record<string, { dataUrl: string; timestamp: number }>,
  summaryData?: {
    totalSent?: number;
    processedCount?: number;
    cachedCount?: number;
    failedCount?: number;
  }
): Promise<boolean> {
  imageMemoryCache = cacheData;
  lastImageFetchTime = Date.now();
  
  const imageKeys = Object.keys(cacheData || {});
  let totalSizeChars = 0;
  for (const key of imageKeys) {
    if (cacheData[key]?.dataUrl) {
      totalSizeChars += cacheData[key].dataUrl.length;
    }
  }
  const totalSizeBytes = Math.round(totalSizeChars * 0.75);
  const sizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(2);
  const avgKb = imageKeys.length > 0 ? ((totalSizeBytes / imageKeys.length) / 1024).toFixed(2) : '0';

  const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

  const caption = `🖼 *Image Cache Summary*\n\n📊 *Stats:*\n• Total Sent: ${summaryData?.totalSent || 0}\n• Already Cached: ${summaryData?.cachedCount || 0}\n• Newly Cached: ${summaryData?.processedCount || 0}\n• Total Saved (In Cache): ${imageKeys.length}\n\n💾 *Size Details:*\n• Total Size: ${sizeMb} MB\n• Avg Size: ${avgKb} KB\n\n🕒 *Last Update (IST):*\n${istTime}`;

  return saveCacheFileToTelegram('imageCache', cacheData, caption);
}

export async function loadSessionCacheUnified(): Promise<Record<string, any>> {
  if (sessionMemoryCache && (Date.now() - lastSessionFetchTime < MEMORY_CACHE_TTL)) {
    lastSessionCacheSource = 'local-memory';
    return sessionMemoryCache;
  }

  const credentials = await getTelegramCredentials();
  if (credentials.isConfigured) {
    try {
      const tgCache = await loadCacheFileFromTelegram('sessionCache');
      if (tgCache) {
        sessionMemoryCache = tgCache;
        lastSessionFetchTime = Date.now();
        lastSessionCacheSource = 'telegram-cache';
        return tgCache;
      }
    } catch (err) {
      console.warn("[Session Cache] Telegram fetch failed, falling back to local server-side memory:", err);
    }
  }

  // Fallback to server-side local memory cache
  lastSessionCacheSource = 'local-server-fallback';
  return sessionMemoryCache || {};
}

export async function saveSessionCacheUnified(
  cacheData: Record<string, any>,
  summaryData?: {
    activeSessions?: number;
    totalAccounts?: number;
    deviceModel?: string;
  }
): Promise<boolean> {
  sessionMemoryCache = cacheData;
  lastSessionFetchTime = Date.now();
  
  const deviceKeys = Object.keys(cacheData || {});
  let totalSessions = 0;
  let totalAccounts = 0;
  let activeSessions = 0;

  for (const hash of deviceKeys) {
    const device = cacheData[hash];
    if (device?.accounts) {
      const accounts = Object.keys(device.accounts);
      totalAccounts += accounts.length;
      for (const acc of accounts) {
        const sessions = device.accounts[acc].sessions || [];
        totalSessions += sessions.length;
        activeSessions += sessions.filter((s: any) => s.status === 'active').length;
      }
    }
  }

  const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

  let caption = `🔐 *Session Cache Summary*\n\n📊 *Stats:*\n• Devices: ${deviceKeys.length}\n• Total Accounts: ${totalAccounts}\n• Total Sessions: ${totalSessions}\n• Active Sessions: ${activeSessions}\n\n🕒 *Last Update (IST):*\n${istTime}`;
  
  if (summaryData?.deviceModel) {
      caption += `\n\n🆕 *Latest Activity on:* ${summaryData.deviceModel}`;
  }

  return saveCacheFileToTelegram('sessionCache', cacheData, caption);
}
