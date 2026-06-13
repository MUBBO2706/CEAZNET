import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// In-memory cache to avoid repeated network hits in the same process
let memoryCache: Record<string, string | null> | null = null;
let lastFetchTime = 0;
const MEMORY_CACHE_TTL = 30000; // 30 seconds local in-memory TTL

let memoryImageCache: Record<string, string> | null = null;
let lastImageFetchTime = 0;

function getEnvValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm');
      const match = content.match(regex);
      if (match && match[1]) {
        const val = match[1].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          return val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  } catch (err) {
    console.error(`Error reading ${key} from .env manually:`, err);
  }
  return undefined;
}

const supabaseUrl = getEnvValue('SUPABASE_URL') || getEnvValue('VITE_SUPABASE_URL') || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY') || getEnvValue('VITE_SUPABASE_ANON_KEY') || getEnvValue('SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export function resolveCachePath(): string {
  const tmpPath = path.join('/tmp', 'device_cache.json');
  const localPath = path.join(process.cwd(), 'device_cache.json');
  
  if (!fs.existsSync(tmpPath)) {
    try {
      if (fs.existsSync(localPath)) {
        fs.copyFileSync(localPath, tmpPath);
      } else {
        fs.writeFileSync(tmpPath, '{}', 'utf8');
      }
    } catch (e) {
      console.warn("Failed to initialize /tmp/device_cache.json, using localPath:", e);
      return localPath;
    }
  }
  return tmpPath;
}

export function resolveImageCachePath(): string {
  const tmpPath = path.join('/tmp', 'image_cache.json');
  if (!fs.existsSync(tmpPath)) {
    try {
      fs.writeFileSync(tmpPath, '{}', 'utf8');
    } catch (e) {
      console.warn("Failed to initialize /tmp/image_cache.json");
    }
  }
  return tmpPath;
}

// Dynamically resolve Telegram Credentials
export async function getTelegramCredentials(): Promise<{ token: string; chatId: string; isConfigured: boolean }> {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    return {
      token: "8403959177:AAFJrkcRCeTHTyS5uVBwlLKTE79dwq_HYzU",
      chatId: "-1003984567697",
      isConfigured: true
    };
  }

  let token = getEnvValue('TELEGRAM_BOT_TOKEN') || getEnvValue('VITE_TELEGRAM_BOT_TOKEN');
  let chatId = getEnvValue('TELEGRAM_CHAT_ID') || getEnvValue('VITE_TELEGRAM_CHAT_ID');

  if (!token || !chatId) {
    try {
      const { data } = await supabaseAdmin
        .from('platform_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['telegram_bot_token', 'telegram_chat_id']);
      
      if (data) {
        const tokenRow = data.find(r => r.setting_key === 'telegram_bot_token');
        const chatRow = data.find(r => r.setting_key === 'telegram_chat_id');
        if (tokenRow?.setting_value) token = String(tokenRow.setting_value);
        if (chatRow?.setting_value) chatId = String(chatRow.setting_value);
      }
    } catch (err) {
      console.warn("Could not query platform settings for Telegram:", err);
    }
  }

  const isConfigured = !!token && !!chatId && !token.includes('MY_BOT_TOKEN');
  return {
    token: token || "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8",
    chatId: chatId || "5965153830",
    isConfigured
  };
}

/**
 * Downloads and parses any JSON file directly from Telegram using a tg:// URL.
 */
export async function loadJsonFromTelegramUrl(tgUrl: string): Promise<any> {
  if (!tgUrl || !tgUrl.startsWith('tg://')) return null;
  try {
    const { token } = await getTelegramCredentials();
    const fileId = tgUrl.replace('tg://', '').split('?')[0];
    
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    if (!fileRes.ok) {
      console.warn(`[Telegram JSON Load] Failed to getFile details for ${fileId}, status: ${fileRes.status}`);
      return null;
    }
    
    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result?.file_path) {
      console.warn(`[Telegram JSON Load] Telegram returned non-ok result for getFile:`, fileData);
      return null;
    }
    
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
    const dataRes = await fetch(downloadUrl);
    if (!dataRes.ok) {
      console.warn(`[Telegram JSON Load] Failed to download actual file from path ${fileData.result.file_path}`);
      return null;
    }
    
    const content = await dataRes.text();
    return JSON.parse(content);
  } catch (err: any) {
    console.warn(`[Telegram JSON Load] Failed to load JSON from ${tgUrl}:`, err.message);
    return null;
  }
}

/**
 * Uploads a JSON object to Telegram as a document, deletes the old message to prevent clutter,
 * and returns the new tg:// URL.
 */
export async function uploadJsonToTelegram(
  filename: string,
  data: any,
  oldTgUrl?: string | null
): Promise<string | null> {
  try {
    const { token, chatId } = await getTelegramCredentials();
    if (!token || !chatId) return null;

    const cacheString = JSON.stringify(data, null, 2);
    const fileBuffer = Buffer.from(cacheString, 'utf8');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: application/json\r\n\r\n`
    ];

    const payload = Buffer.concat([
      Buffer.from(parts[0], 'utf8'),
      Buffer.from(parts[1], 'utf8'),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
    ]);

    const uploadRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: payload
    });

    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      if (uploadData.ok) {
        const newMessageId = uploadData.result.message_id;
        const fileId = uploadData.result.document.file_id;
        console.log(`[Telegram JSON Upload] Successfully uploaded ${filename}. MsgID: ${newMessageId}`);

        // Clean up old file to prevent infinite channel clutter!
        if (oldTgUrl && oldTgUrl.startsWith('tg://')) {
          try {
            const urlObj = new URL(oldTgUrl);
            const oldMessageId = urlObj.searchParams.get('msg');
            if (oldMessageId) {
              await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: parseInt(oldMessageId, 10)
                })
              });
              console.log(`[Telegram JSON Upload] Successfully deleted orphaned Telegram message details: ${oldMessageId}`);
            }
          } catch (e: any) {
            console.warn('[Telegram JSON Upload] Could not cleanup old message:', e.message);
          }
        }

        return `tg://${fileId}?msg=${newMessageId}`;
      }
    } else {
      console.warn(`[Telegram JSON Upload] Failed upload of ${filename}, server returned ${uploadRes.status}`);
    }
  } catch (err: any) {
    console.error(`[Telegram JSON Upload] Error uploading ${filename}:`, err.message);
  }
  return null;
}

/**
 * Legacy backup: load device_cache using pinned message search if database row remains empty/uninitialized
 */
export async function loadDeviceCacheFromTelegramGenericBackup(): Promise<Record<string, string | null> | null> {
  try {
    const { token, chatId } = await getTelegramCredentials();
    if (!token || !chatId) return null;

    const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId })
    });

    if (chatRes.ok) {
      const chatData = await chatRes.json();
      const pinnedMessage = chatData.result?.pinned_message;
      if (pinnedMessage) {
        const fileId = pinnedMessage.document?.file_id;
        if (fileId) {
          const loaded = await loadJsonFromTelegramUrl(`tg://${fileId}`);
          if (loaded) return loaded;
        }
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Loads device mappings from Supabase platform_settings or local fallback.
 */
export async function loadDeviceCacheFromDb(): Promise<Record<string, string | null>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'device_cache')
      .maybeSingle();
    
    if (!error && data && data.setting_value) {
      const val = data.setting_value as any;
      if (val && typeof val === 'object') {
        if (val.type === 'unified_telegram_registry') {
          if (val.device_cache_url) {
            const tgData = await loadJsonFromTelegramUrl(val.device_cache_url);
            if (tgData) {
              // Local filesystem mirror sync for speed/fallbacks
              try {
                fs.writeFileSync(resolveCachePath(), JSON.stringify(tgData, null, 2), 'utf8');
              } catch (e) {}
              return tgData;
            }
          }
          return val.device_cache_fallback || {};
        }
        return val as Record<string, string | null>;
      }
    }
  } catch (err) {
    console.warn("[DB Cache] Error fetching device_cache from Supabase:", err);
  }
  
  // Local file fallback
  try {
    const cachePath = resolveCachePath();
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8') || '{}');
    }
  } catch (err) {
    console.error("[Local File Cache] Error reading local cache file:", err);
  }
  return {};
}

/**
 * Saves device mappings to Supabase platform_settings as well as local disk / Telegram mirror.
 */
export async function saveDeviceCacheToDb(cacheData: Record<string, string | null>): Promise<boolean> {
  try {
    const cachePath = resolveCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (err) {
    console.error("[Local File Cache] Error updating local cache file:", err);
  }

  try {
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({
        setting_key: 'device_cache',
        setting_value: cacheData,
        description: 'Dynamic device mapping cache stored in Supabase'
      }, { onConflict: 'setting_key' });
    
    return !error;
  } catch (err: any) {
    console.error("[DB Cache] Error upserting device_cache to Supabase:", err.message);
    return false;
  }
}

/**
 * Unifies the storage loading cycle:
 * Memory cache -> Supabase/Telegram Registry -> Local fallback
 */
export async function loadDeviceCacheUnified(): Promise<Record<string, string | null>> {
  const now = Date.now();
  if (memoryCache && (now - lastFetchTime < MEMORY_CACHE_TTL)) {
    return memoryCache;
  }

  const dbCache = await loadDeviceCacheFromDb();
  if (dbCache && Object.keys(dbCache).length > 0) {
    memoryCache = dbCache;
    lastFetchTime = now;
    return dbCache;
  }

  // Backup fallback
  const fallback = await loadDeviceCacheFromTelegramGenericBackup();
  if (fallback) {
    memoryCache = fallback;
    lastFetchTime = now;
    return fallback;
  }

  return {};
}

/**
 * Unifies the storage saving cycle:
 * Saves locally + Memory Cache -> Upload to Telegram -> Update Supabase Registry.
 */
export async function saveDeviceCacheUnified(cacheData: Record<string, string | null>): Promise<boolean> {
  memoryCache = cacheData;
  lastFetchTime = Date.now();

  try {
    const cachePath = resolveCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (e) {}

  try {
    // 1. Fetch current registry row first
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'device_cache')
      .maybeSingle();

    let reg: any = data?.setting_value || { type: 'unified_telegram_registry' };
    if (!reg || typeof reg !== 'object' || reg.type !== 'unified_telegram_registry') {
      const legacyDevices = reg || {};
      reg = {
        type: 'unified_telegram_registry',
        device_cache_url: null,
        device_cache_fallback: legacyDevices,
        image_cache_url: null,
        image_cache_fallback: {}
      };
    }

    // 2. Upload file to Telegram
    const newTgUrl = await uploadJsonToTelegram('device_cache.json', cacheData, reg.device_cache_url);
    if (newTgUrl) {
      reg.device_cache_url = newTgUrl;
    }
    reg.device_cache_fallback = cacheData;

    // 3. Upsert Registry row
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({
        setting_key: 'device_cache',
        setting_value: reg,
        description: 'Unified Registry (Devices + Images proxy cache) stored in Telegram/DB'
      }, { onConflict: 'setting_key' });

    if (!error) {
      console.log("[Unified Device Cache] Unified registry updated successfully in Supabase & Telegram.");
      return true;
    } else {
      console.error("[Unified Device Cache] DB registration failed:", error.message);
    }
  } catch (err: any) {
    console.warn("[Unified Device Cache] Telegram failed, falling back to pure DB save.", err.message);
  }

  return saveDeviceCacheToDb(cacheData);
}

/**
 * Unified Image Cache Loader: Loads the persistent image proxy map from Telegram
 */
export async function loadImageCacheUnified(): Promise<Record<string, string>> {
  const now = Date.now();
  if (memoryImageCache && (now - lastImageFetchTime < MEMORY_CACHE_TTL)) {
    return memoryImageCache;
  }

  // Check local container cache first
  try {
    const p = resolveImageCachePath();
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      if (content && content.trim().startsWith('{')) {
        const parsed = JSON.parse(content);
        if (Object.keys(parsed).length > 0) {
          memoryImageCache = parsed;
          lastImageFetchTime = now;
          return parsed;
        }
      }
    }
  } catch (err) {}

  try {
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'device_cache')
      .maybeSingle();

    if (data && data.setting_value) {
      const reg = data.setting_value as any;
      if (reg && reg.type === 'unified_telegram_registry' && reg.image_cache_url) {
        console.log("[Image Cache] Loading image cache from Registered Telegram URL:", reg.image_cache_url);
        const tgData = await loadJsonFromTelegramUrl(reg.image_cache_url);
        if (tgData) {
          memoryImageCache = tgData;
          lastImageFetchTime = now;
          
          // Write local copy for quick reuse across the same worker process
          try {
            fs.writeFileSync(resolveImageCachePath(), JSON.stringify(tgData, null, 2), 'utf8');
          } catch (e) {}

          return tgData;
        }
        if (reg.image_cache_fallback) {
          return reg.image_cache_fallback;
        }
      }
    }
  } catch (err: any) {
    console.warn("[Unified Image Cache] Failed to fetch layout from Supabase/Telegram:", err.message);
  }

  return {};
}

/**
 * Unified Image Cache Saver: Saves image cache maps onto Telegram and updates the registry
 */
export async function saveImageCacheUnified(imageCacheData: Record<string, string>): Promise<boolean> {
  memoryImageCache = imageCacheData;
  lastImageFetchTime = Date.now();

  // Update local filesystem
  try {
    fs.writeFileSync(resolveImageCachePath(), JSON.stringify(imageCacheData, null, 2), 'utf8');
  } catch (e) {}

  try {
    // 1. Fetch current registry
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'device_cache')
      .maybeSingle();

    let reg: any = data?.setting_value || { type: 'unified_telegram_registry' };
    if (!reg || typeof reg !== 'object' || reg.type !== 'unified_telegram_registry') {
      const legacyDevices = reg || {};
      reg = {
        type: 'unified_telegram_registry',
        device_cache_url: null,
        device_cache_fallback: legacyDevices,
        image_cache_url: null,
        image_cache_fallback: {}
      };
    }

    // 2. Upload file to Telegram
    const oldUrl = reg.image_cache_url;
    console.log(`[Image Cache] Uploading fresh image_cache.json to Telegram...`);
    const newTgUrl = await uploadJsonToTelegram('image_cache.json', imageCacheData, oldUrl);
    
    if (newTgUrl) {
      reg.image_cache_url = newTgUrl;
      reg.image_cache_fallback = imageCacheData;
      
      // 3. Update the registry in Supabase
      const { error } = await supabaseAdmin
        .from('platform_settings')
        .upsert({
          setting_key: 'device_cache',
          setting_value: reg,
          description: 'Unified Registry (Devices + Images proxy cache) stored in Telegram/DB'
        }, { onConflict: 'setting_key' });
        
      if (!error) {
        console.log("[Unified Image Cache] Image proxy cache successfully persisted and registered on Telegram.");
        return true;
      } else {
        console.error("[Unified Image Cache] DB registration failed:", error.message);
      }
    }
  } catch (err: any) {
    console.error("[Unified Image Cache] Failed to save/update image cache on Telegram:", err.message);
  }
  return false;
}
