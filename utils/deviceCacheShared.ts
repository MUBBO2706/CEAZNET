import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// In-memory memory cache to avoid even hitting Telegram/Supabase repeatedly in the same worker process execution!
let memoryCache: Record<string, string | null> | null = null;
let lastFetchTime = 0;
const MEMORY_CACHE_TTL = 30000; // 30 seconds local in-memory TTL to avoid repeated hits on API calls

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

// Dynamically fetch and resolve Telegram Bot secrets so that changes can be made from environment or Supabase platform settings!
export async function getTelegramCredentials(): Promise<{ token: string; chatId: string; isConfigured: boolean }> {
  let token = getEnvValue('TELEGRAM_BOT_TOKEN') || getEnvValue('VITE_TELEGRAM_BOT_TOKEN');
  let chatId = getEnvValue('TELEGRAM_CHAT_ID') || getEnvValue('VITE_TELEGRAM_CHAT_ID');

  // fallback database check to allow dynamic management through Admin Panel settings without redeploying!
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
  
  // Codebase defaults
  return {
    token: token || "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8",
    chatId: chatId || "5965153830",
    isConfigured
  };
}

/**
 * Loads device mappings from Telegram pinned message.
 * Supports direct JSON inline text or dynamic JSON files/documents uploaded and pinned!
 */
export async function loadDeviceCacheFromTelegram(): Promise<Record<string, string | null> | null> {
  try {
    const { token, chatId } = await getTelegramCredentials();
    if (!token || !chatId) return null;

    // 1. Fetch channel/chat to resolve pinned message
    const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId })
    });

    if (!chatRes.ok) {
      console.warn("[Telegram Cache] Failed to fetch Chat details:", chatRes.status);
      return null;
    }

    const chatData = await chatRes.json();
    if (!chatData.ok || !chatData.result || !chatData.result.pinned_message) {
      console.warn("[Telegram Cache] No pinned cache configuration found in Telegram chat.");
      return null;
    }

    const pinnedMessage = chatData.result.pinned_message;

    // A. Check if the pinned message text is the JSON itself (highly optimal for < 4KB)
    if (pinnedMessage.text && pinnedMessage.text.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(pinnedMessage.text.trim());
        console.log("[Telegram Cache] Successfully decoded JSON directly from Telegram message text!");
        return parsed;
      } catch (err) {
        console.warn("[Telegram Cache] Failed to parse pinned text message as JSON:", err);
      }
    }

    // B. Or check if there is an uploaded document/file
    const fileId = pinnedMessage.document?.file_id;
    if (!fileId) {
      console.warn("[Telegram Cache] Pinned message does not contain direct JSON text or document.");
      return null;
    }

    // Resolve file details
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    if (!fileRes.ok) {
      console.warn("[Telegram Cache] getFile failed on Telegram:", fileRes.status);
      return null;
    }

    const fileData = await fileRes.json();
    if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
      console.warn("[Telegram Cache] Telegram failed to return path for cache document:", fileData);
      return null;
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    // Download document text
    const dataRes = await fetch(downloadUrl);
    if (!dataRes.ok) {
      console.warn("[Telegram Cache] Failed to download cache file from Telegram link.");
      return null;
    }

    const content = await dataRes.text();
    const parsed = JSON.parse(content);
    console.log("[Telegram Cache] Decoded cache JSON file downloaded from Telegram successfully! Size:", Object.keys(parsed).length);
    return parsed;
  } catch (err: any) {
    console.warn("[Telegram Cache] Error loading from Telegram:", err.message);
    return null;
  }
}

/**
 * Saves device mappings to Telegram:
 * Attempts to modify the existing pinned message in place using editMessageMedia (always saving as a JSON file).
 * If no pinned message exists yet or update fails, falls back to uploading a new document and pinning it.
 */
export async function saveDeviceCacheToTelegram(cacheData: Record<string, string | null>): Promise<boolean> {
  try {
    const { token, chatId } = await getTelegramCredentials();
    if (!token || !chatId) return false;

    const cacheString = JSON.stringify(cacheData, null, 2);
    
    // 1. Get current pinned message first to see if we can update it in place
    let pinnedMessageId: number | null = null;
    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId })
      });
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        if (chatData.ok && chatData.result?.pinned_message) {
          pinnedMessageId = chatData.result.pinned_message.message_id;
        }
      }
    } catch (err: any) {
      console.warn("[Telegram Cache] Failed to check for existing pinned message:", err.message);
    }

    const filename = 'device_cache.json';
    const fileBuffer = Buffer.from(cacheString, 'utf8');

    // 2. If we found a pinned message, try to edit its media inline!
    if (pinnedMessageId) {
      console.log(`[Telegram Cache] Found existing pinned message ID: ${pinnedMessageId}. Attempting in-place update...`);
      try {
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        
        const parts = [
          `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`,
          `--${boundary}\r\nContent-Disposition: form-data; name="message_id"\r\n\r\n${pinnedMessageId}\r\n`,
          `--${boundary}\r\nContent-Disposition: form-data; name="media"\r\n\r\n${JSON.stringify({ type: 'document', media: 'attach://device_cache' })}\r\n`,
          `--${boundary}\r\nContent-Disposition: form-data; name="device_cache"; filename="${filename}"\r\nContent-Type: application/json\r\n\r\n`
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
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`
          },
          body: payload
        });

        if (editRes.ok) {
          const editData = await editRes.json();
          if (editData.ok) {
            console.log("[Telegram Cache] Successfully edited the pinned message in-place!");
            return true;
          } else {
            console.warn("[Telegram Cache] In-place edit rejected by Telegram:", editData.description);
          }
        } else {
          console.warn("[Telegram Cache] In-place edit server error code:", editRes.status);
        }
      } catch (editError: any) {
        console.warn("[Telegram Cache] Error during editMessageMedia, falling back to new upload:", editError.message);
      }
    }

    // 3. Fallback: Upload a new document and pin it (and optionally delete the old pinned message to avoid channel noise!)
    console.log("[Telegram Cache] Uploading a fresh device_cache.json document...");
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
        console.log("[Telegram Cache] Dynamic cache file uploaded successfully. Message ID:", newMessageId);

        // Pin the newly created cache message
        const pinRes = await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: newMessageId,
            disable_notification: true
          })
        });

        if (pinRes.ok) {
          const pinData = await pinRes.json();
          console.log("[Telegram Cache] Pin command status:", pinData.ok);
          
          // Clean up: delete the old pinned message so there's zero clutter in the Telegram chat!
          if (pinnedMessageId) {
            try {
              await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: pinnedMessageId
                })
              });
              console.log("[Telegram Cache] Deleted old pinned message to prevent chat clutter.");
            } catch (delError) {
              console.warn("[Telegram Cache] Could not delete old pinned message:", delError);
            }
          }
          return pinData.ok;
        }
      }
    }
    return false;
  } catch (err: any) {
    console.error("[Telegram Cache] Error saving to Telegram:", err.message);
    return false;
  }
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
      return data.setting_value as Record<string, string | null>;
    }
  } catch (err) {
    console.warn("[DB Cache] Error fetching device_cache from Supabase:", err);
  }
  
  // Fallback to local file
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
 * Saves device mappings to Supabase platform_settings and local disk.
 */
export async function saveDeviceCacheToDb(cacheData: Record<string, string | null>): Promise<boolean> {
  // 1. Save locally
  try {
    const cachePath = resolveCachePath();
    const tempPath = cachePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(cacheData, null, 2), 'utf8');
    fs.renameSync(tempPath, cachePath);
  } catch (err) {
    console.error("[Local File Cache] Error updating local cache file:", err);
  }

  // 2. Save/Upsert in Supabase
  try {
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({
        setting_key: 'device_cache',
        setting_value: cacheData,
        description: 'Dynamic device mapping cache stored in Supabase'
      }, { onConflict: 'setting_key' });
    
    if (error) {
      console.error("[DB Cache] Error saving device_cache to Supabase:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("[DB Cache] Error upserting device_cache to Supabase:", err.message);
    return false;
  }
}

/**
 * Unifies the storage loading cycle:
 * Memory cache -> Telegram Cache (if configured and works) -> Supabase Cache -> Local disk cache.
 */
export async function loadDeviceCacheUnified(): Promise<Record<string, string | null>> {
  const now = Date.now();
  if (memoryCache && (now - lastFetchTime < MEMORY_CACHE_TTL)) {
    return memoryCache;
  }

  // 1. Try from Telegram
  const tgCache = await loadDeviceCacheFromTelegram();
  if (tgCache) {
    memoryCache = tgCache;
    lastFetchTime = now;
    
    // Asynchronously back it up to local filesystem for fast access if server loses internet
    try {
      const cachePath = resolveCachePath();
      fs.writeFileSync(cachePath, JSON.stringify(tgCache, null, 2), 'utf8');
    } catch (e) {}
    
    return tgCache;
  }

  // 2. Fallback to Supabase
  const dbCache = await loadDeviceCacheFromDb();
  memoryCache = dbCache;
  lastFetchTime = now;
  return dbCache;
}

/**
 * Unifies the storage saving cycle:
 * Saves locally + Memory Cache -> Telegram (if configured and works) -> Supabase Cache.
 */
export async function saveDeviceCacheUnified(cacheData: Record<string, string | null>): Promise<boolean> {
  memoryCache = cacheData;
  lastFetchTime = Date.now();

  // 1. Sync locally first
  try {
    const cachePath = resolveCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (e) {}

  // 2. Try saving to Telegram (non-blocking if successful)
  const tgSuccess = await saveDeviceCacheToTelegram(cacheData);
  if (tgSuccess) {
    console.log("[Unified Cache] Successfully persisted and pinned update on Telegram. Skipping heavy DB updates!");
    return true;
  }

  // 3. If Telegram failed or is not configured, fall back to Supabase
  console.log("[Unified Cache] Telegram storage skipped or failed. Falling back to Supabase DB...");
  return saveDeviceCacheToDb(cacheData);
}
