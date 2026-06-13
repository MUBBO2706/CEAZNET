import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import * as cheerio from 'cheerio';
import NodeCache from 'node-cache';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { UAParser } from 'ua-parser-js';

import { 
  resolveCachePath, 
  loadDeviceCacheUnified, 
  saveDeviceCacheUnified, 
  loadDeviceCacheFromDb 
} from './utils/deviceCacheShared.js';

// getPersistentCache and setPersistentCache are defined as asynchronous functions below supabaseAdmin initialization.

function safeParseGeminiJson(text: string): { brand?: string; name?: string } | null {
  if (!text) return null;
  let cleanText = text.trim();
  
  // Remove markdown code blocks if present
  if (cleanText.includes('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanText = match[1].trim();
    }
  }
  
  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to parse Gemini JSON normally, attempting regex extraction. Raw text:", text);
    // Attempt relaxed JSON extraction or manual regex
    const brandMatch = cleanText.match(/"brand"\s*:\s*"([^"]+)"/i);
    const nameMatch = cleanText.match(/"name"\s*:\s*"([^"]+)"/i);
    
    if (brandMatch || nameMatch) {
      return {
        brand: brandMatch ? brandMatch[1] : undefined,
        name: nameMatch ? nameMatch[1] : undefined
      };
    }
  }
  return null;
}

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

// Initialize a memory cache (default TTL 1 hour)
const dbCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Simple way to use the Supabase client already configured
import { supabase } from './services/supabaseClient.js';

// Import our modular API handlers
import sessionsHandler from './api/sessions.js';
import deviceMapperHandler from './api/device-mapper.js';
import urlReaderHandler from './api/url-reader.js';

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

const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');
const supabaseAdminUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');
const supabaseAdmin = (supabaseAdminUrl && supabaseAdminKey)
  ? createClient(supabaseAdminUrl, supabaseAdminKey)
  : new Proxy({}, {
      get: () => {
        throw new Error("SUPABASE_URL and SUPABASE_KEY environment variables are required in production.");
      }
    }) as any;

// Caching is fully integrated via our central shared './utils/deviceCacheShared.js' module.

// Gemini API Key from DB
async function getSystemGeminiApiKey(): Promise<{key: string, id: string} | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('news_api_keys')
            .select('id, api_key')
            .eq('provider', 'gemini')
            .eq('status', 'active')
            .order('last_used_at', { ascending: true, nullsFirst: true })
            .limit(1);
            
        if (!error && data && data.length > 0) {
            return { key: data[0].api_key, id: data[0].id };
        }
    } catch (e) {
        console.error("Error fetching Gemini key from DB:", e);
    }
    
    // Strict policy: Do not fall back to .env or process.env properties
    // as per user request to only use the news_api_keys table.
    return null;
}

async function trackGeminiKeyUsage(keyId: string, category: string) {
    if (keyId === 'env-fallback') return;
    try {
        await supabaseAdmin.rpc('mark_news_key_used', { key_id: keyId, cat: category });
    } catch (e) {
        console.error("Error tracking Gemini key usage:", e);
    }
}

async function trackGeminiKeyFailure(keyId: string, errorMsg: string) {
    if (keyId === 'env-fallback') return;
    try {
        await supabaseAdmin.rpc('mark_news_key_failed', { key_id: keyId, err_msg: errorMsg, max_failures: 10 });
    } catch (e) {
        console.error("Error tracking Gemini key failure:", e);
    }
}

async function executeWithGeminiRotation<T>(
    category: string,
    operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
    // 1. Fetch all active Gemini keys, ordered by last_used_at ASC nulls first to achieve round-robin
    const { data: keys, error: fetchError } = await supabaseAdmin
        .from('news_api_keys')
        .select('id, api_key')
        .eq('provider', 'gemini')
        .eq('status', 'active')
        .order('last_used_at', { ascending: true, nullsFirst: true });

    if (fetchError || !keys || keys.length === 0) {
        const errorMsg = fetchError ? fetchError.message : "No active Gemini keys found in news_api_keys table.";
        throw new Error(`[Gemini Rotation] Failed to retrieve keys: ${errorMsg}`);
    }

    console.log(`[Gemini Rotation Server] Loaded ${keys.length} active keys for category "${category}".`);

    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
        const keyConfig = keys[i];
        console.log(`[Gemini Rotation Server] Attempting operation with key index ${i} (ID: ${keyConfig.id})`);
        
        try {
            const ai = new GoogleGenAI({ apiKey: keyConfig.api_key });
            const result = await operation(ai);
            
            // Success! Mark key used
            await trackGeminiKeyUsage(keyConfig.id, category);
            console.log(`[Gemini Rotation Server] Key ${keyConfig.id} succeeded and tracked as used.`);
            return result;
        } catch (err: any) {
            console.error(`[Gemini Rotation Server] Key ${keyConfig.id} failed: ${err.message}`);
            lastError = err;
            
            // Track key failure in Supabase (automatic exhaustion handling with max_failures = 10)
            await trackGeminiKeyFailure(keyConfig.id, err.message);

            // Log API key audit fallback if there is a next key
            if (i + 1 < keys.length) {
                const nextKeyConfig = keys[i + 1];
                console.log(`[Gemini Rotation Server] Rolling over to next key (ID: ${nextKeyConfig.id}) after failure.`);
                try {
                    await supabaseAdmin.rpc('log_api_key_audit', {
                        failed_id: keyConfig.id,
                        fallback_id: nextKeyConfig.id,
                        cat: category,
                        err: err.message
                    });
                } catch (auditErr: any) {
                    console.error(`[Gemini Rotation Server] Failed to log fallback audit:`, auditErr.message);
                }
            }
        }
    }

    // If we reach here, all keys failed
    throw lastError || new Error("All active Gemini keys failed to execute the request.");
}

// Helper functions for user session tracking
function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  return (req.headers['cf-connecting-ip'] as string) || req.socket.remoteAddress || '127.0.0.1';
}

function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown Device";
  const parser = new UAParser(ua);
  const result = parser.getResult();
  const device = result.device;
  const os = result.os;
  const browser = result.browser;

  let deviceName = '';
  if (device.model) {
    if (device.model === 'K') {
      deviceName = 'Android Device';
    } else {
      deviceName = device.vendor ? `${device.vendor} ${device.model}` : device.model;
    }
  }

  let osName = os.name || 'Unknown OS';
  if (os.name === 'Windows' && os.version) {
     osName = `Windows ${os.version}`;
  } else if (os.name === 'Mac OS') {
     osName = 'macOS';
  }

  if (deviceName && deviceName.trim().length > 0) {
      if (deviceName === 'Android Device') {
           if (browser.name) {
               return `${browser.name} on Android`;
           }
           return 'Android Device';
      }
      if (osName !== 'Unknown OS') {
          return `${deviceName} (${osName})`;
      }
      return deviceName;
  }
  
  if (osName !== 'Unknown OS') {
      return osName;
  }

  if (browser.name) {
      return `${browser.name} Browser`;
  }
  
  return "Generic Web Browser";
}

async function getIpLocation(ip: string): Promise<string> {
  const cleanIp = ip.replace(/^::ffff:/, '');
  if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.')) {
    return "Local Network / Dev";
  }
  try {
    const response = await axios.get(`https://ipapi.co/${cleanIp}/json/`, { timeout: 2000 });
    if (response.data && response.data.city && response.data.country_name) {
      return `${response.data.city}, ${response.data.country_name}`;
    }
  } catch (err) {
    // Graceful fallback
  }
  return "Unknown Location";
}

async function getReverseGeocoding(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
      params: {
        format: 'json',
        lat: lat,
        lon: lon,
        zoom: 14,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'Ceaznet-Applet-System/5.0 (fahadhajisahab@gmail.com)'
      },
      timeout: 3000
    });
    if (response.data && response.data.address) {
      const address = response.data.address;
      const road = address.road || address.pedestrian || address.suburb || address.neighbourhood || "";
      const city = address.city || address.town || address.village || address.city_district || "";
      const state = address.state || address.region || "";
      const country = address.country || "";
      
      let parts = [];
      if (road) parts.push(road);
      if (city) parts.push(city);
      else if (state) parts.push(state);
      if (country) parts.push(country);
      
      if (parts.length > 0) {
        return parts.join(', ');
      }
    }
    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }
  } catch (err: any) {
    console.warn("[Reverse Geocoding] Nominatim failed:", err.message);
  }
  return null;
}

// Initialize realtime cache invalidation listener
supabase
  .channel('db-cache-invalidation')
  .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
    const table = payload.table;
    const keys = dbCache.keys().filter(key => key.startsWith(`tbl_${table}_`));
    if (keys.length > 0) {
      dbCache.del(keys);
      console.log(`[Cache] Invalidated ${keys.length} cached queries for table: ${table} due to ${payload.eventType} event.`);
    }
  })
  .subscribe((status) => {
    console.log(`[Cache Invalidation] Realtime status: ${status}`);
  });

// Singleton browser instance
let browserInstance: any = null;
async function getBrowser() {
  if (!browserInstance) {
    console.log("Launching Puppeteer browser instance...");
    browserInstance = await puppeteer.launch({
      headless: true, // Use new headless mode implicitly in newer puppeteer
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browserInstance;
}

// Ensure browser closes on exit
process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Database Query Caching API
  app.post("/api/db/query", async (req, res) => {
    try {
      const { table, select, eq, order, limit, truncateField, truncateLength } = req.body;
      if (!table) return res.status(400).json({ error: "Missing table parameter" });

      const authHeader = req.headers.authorization;
      const cacheGroupKey = authHeader || 'anonymous';
      const cacheKey = `tbl_${table}_${cacheGroupKey}_${JSON.stringify({ select, eq, order, limit, truncateField, truncateLength })}`;
      
      const cachedData = dbCache.get(cacheKey);
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedData);
      }

      const client = authHeader ? createClient(supabaseAdminUrl, supabaseAdminKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }) : supabaseAdmin;

      let query = client.from(table).select(select || '*');
      if (eq) Object.entries(eq).forEach(([key, value]) => { query = query.eq(key, value); });
      if (order) query = query.order(order.column, { ascending: order.ascending });
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;

      let processedData = data;
      if (truncateField && processedData) {
        const len = truncateLength || 50;
        processedData = processedData.map((row: any) => {
          if (row[truncateField] && typeof row[truncateField] === 'string') {
            let text = row[truncateField];
            text = text.replace(/<!-- FINANCE_WIDGET_START -->[\s\S]*?<!-- FINANCE_WIDGET_END -->/g, '');
            text = text.replace(/<!--[\s\S]*?-->/g, '');
            text = text.replace(/<[^>]*>?/gm, ' ');
            text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            text = text.replace(/^(?:[-*_]\s*){3,}$/gm, '');
            text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
            text = text.replace(/(\*|_)(.*?)\1/g, '$2');
            text = text.replace(/~~(.*?)~~/g, '$1');
            text = text.replace(/`{1,3}(.*?)`{1,3}/g, '$1');
            text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            text = text.replace(/^[#]+\s+(.*)$/gm, '$1');
            text = text.replace(/^>+\s+(.*)$/gm, '$1');
            text = text.replace(/^[-*+]\s+(.*)$/gm, '• $1');
            text = text.replace(/^\d+\.\s+(.*)$/gm, '$1');
            text = text.replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();
            const truncated = text.length > len ? text.substring(0, len) + '...' : text;
            return { ...row, [truncateField]: truncated };
          }
          return row;
        });
      }

      dbCache.set(cacheKey, { data: processedData });
      res.setHeader('X-Cache', 'MISS');
      res.json({ data: processedData });
    } catch (error: any) {
      console.error(`DB Query Proxy Error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // News Caching API
  app.get("/api/news", async (req, res) => {
    try {
      const { category, lite, url } = req.query;
      
      if (url && typeof url === 'string') {
        const cacheKey = `news_url_${url}`;
        const cachedData = dbCache.get(cacheKey);
        if (cachedData) {
          res.setHeader('X-Cache', 'HIT');
          return res.json({ data: cachedData });
        }

        const { data, error } = await supabase
          .from('public_news_articles')
          .select('category, article_data, formatted_content_md, views, likes, bookmarks')
          .eq('article_data->>url', url)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          dbCache.set(cacheKey, data, 3600); // 1 hour for specific article
        }
        res.setHeader('X-Cache', 'MISS');
        return res.json({ data });
      }

      if (!category) return res.status(400).json({ error: "Missing category or url parameter" });

      const isLite = lite === 'true';
      const cacheKey = `news_cat_${category}${isLite ? '_lite' : ''}`;
      const cachedData = dbCache.get(cacheKey);
      if (cachedData) {
        res.setHeader('X-Cache', 'HIT');
        // Vercel Edge caching config for downstream
        res.setHeader('Cache-Control', `s-maxage=10800, stale-while-revalidate=600`);
        return res.json({ data: cachedData });
      }

      const selectFields = isLite 
        ? 'category, article_data, views, likes, bookmarks' 
        : 'category, article_data, formatted_content_md, views, likes, bookmarks';

      const { data, error } = await supabase
        .from('public_news_articles')
        .select(selectFields)
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;

      // Strip heavy fields from article_data for lite requests to further reduce payload
      const processedData = isLite 
        ? ((data as any[]) || []).map(row => {
            if (row.article_data) {
                // Return essential fields for card rendering, including a small snippet of description
                const { title, url, image, source, publishedAt, description } = row.article_data;
                return { ...row, article_data: { title, url, image, source, publishedAt, description: description?.substring(0, 100) } };
            }
            return row;
          })
        : data;

      // Calculate next cache invalidation time (5 minutes past every 3rd hour starting at 00:00 UTC)
      // This ensures cron jobs (which run at 00:00, 03:00 UTC, etc. - 05:30 IST) have time to complete
      const now = new Date();
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      const totalMinutes = currentHour * 60 + currentMinute;
      
      const updateIntervals = [
        5,          // 00:05 UTC (05:35 IST)
        3 * 60 + 5, // 03:05 UTC (08:35 IST)
        6 * 60 + 5, // 06:05 UTC (11:35 IST)
        9 * 60 + 5, // 09:05 UTC (14:35 IST)
        12 * 60 + 5,// 12:05 UTC (17:35 IST)
        15 * 60 + 5,// 15:05 UTC (20:35 IST)
        18 * 60 + 5,// 18:05 UTC (23:35 IST)
        21 * 60 + 5,// 21:05 UTC (02:35 IST)
        24 * 60 + 5 // Next day 00:05 UTC
      ];
      
      const nextUpdateMinutes = updateIntervals.find(m => m > totalMinutes) || updateIntervals[updateIntervals.length - 1];
      
      const nextUpdate = new Date(now);
      nextUpdate.setUTCHours(0, 0, 0, 0);
      nextUpdate.setUTCMinutes(nextUpdateMinutes);
      
      const maxAgeSeconds = Math.floor((nextUpdate.getTime() - now.getTime()) / 1000);
      
      // Store in memory cache
      dbCache.set(cacheKey, processedData, maxAgeSeconds);
 
       res.setHeader('X-Cache', 'MISS');
       res.setHeader('Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=60`);
       
       res.json({ data: processedData });
    } catch (error: any) {
      console.error(`News API Proxy Error:`, error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.all('/api/device-mapper', async (req, res) => {
    await deviceMapperHandler(req, res);
  });

  // User Session & Active Devices Tracking APIs
  app.all("/api/sessions", async (req, res) => {
    await sessionsHandler(req, res);
  });

  app.get("/api/debug-triggers", async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin.rpc('execute_sql', { sql_statement: 'SELECT trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = \'user_sessions\';' });
      if (error) {
        // Try direct query if RPC doesn't exist
        const result = await supabaseAdmin.from('information_schema.triggers').select('*').eq('event_object_table', 'user_sessions');
        return res.json(result);
      }
      res.json({ data, error });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });



  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/debug-news-keys", async (req, res) => {
    try {
      const envKeysOfProcess = Object.keys(process.env);
      const { data, error } = await supabaseAdmin
        .from('news_api_keys')
        .select('id, provider, api_key, status, calls_count, failure_count, last_error_message, last_failed_at, cooldown_until');
      
      const adminKeyToUse = supabaseAdminKey;
      const maskedAdminKey = adminKeyToUse.length > 20
        ? `${adminKeyToUse.substring(0, 15)}...${adminKeyToUse.substring(adminKeyToUse.length - 10)}`
        : 'short';

      if (error) {
        return res.status(500).json({ 
          error: error.message,
          supabaseUrl: supabaseAdminUrl,
          supabaseAdminKey: maskedAdminKey,
          envKeysOfProcess
        });
      }

      const maskedData = (data || []).map((row: any) => {
        const key = row.api_key || '';
        const maskedKey = key.length > 10 
          ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}`
          : 'invalid';
        return {
          ...row,
          api_key: maskedKey
        };
      });

      return res.json({ 
        supabaseUrl: supabaseAdminUrl,
        supabaseAdminKey: maskedAdminKey,
        envKeysOfProcess,
        keys: maskedData 
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // URL Reader Endpoint
  app.all("/api/url-reader", async (req, res) => {
    await urlReaderHandler(req, res);
  });  // Image/File Proxy Caching and Resolution
  const serverImageCache = new Map<string, { dataUrl: string; timestamp: number }>();
  const SERVER_CACHE_TTL = 120 * 60 * 1000; // 2 hours server cache
  let hasHydratedTelegramImageCache = false;

  async function ensureServerImageCachePopulated() {
    if (hasHydratedTelegramImageCache) return;
    try {
      const { loadImageCacheUnified } = await import("./utils/deviceCacheShared.js");
      const tgCache = await loadImageCacheUnified();
      if (tgCache && Object.keys(tgCache).length > 0) {
        console.log(`[Image Proxy Backend] Hydrating server memory cache with ${Object.keys(tgCache).length} images from Telegram...`);
        for (const [url, dataUrl] of Object.entries(tgCache)) {
          if (url && dataUrl) {
            serverImageCache.set(url, { dataUrl, timestamp: Date.now() });
          }
        }
      }
    } catch (e: any) {
      console.error("[Image Proxy Backend] Auto hydration failed:", e.message);
    } finally {
      hasHydratedTelegramImageCache = true;
    }
  }

  async function resolveImageUrl(url: string): Promise<string> {
    await ensureServerImageCachePopulated();
    const cached = serverImageCache.get(url);
    if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
      return cached.dataUrl;
    }

    let base64 = "";
    let contentType = "application/octet-stream";

    try {
      // Fast path: Axios
      const urlObj = new URL(url);
      let response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
           'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
           'Accept-Language': 'en-US,en;q=0.5',
           'Referer': urlObj.origin + '/',
           'Sec-Fetch-Dest': 'image',
           'Sec-Fetch-Mode': 'no-cors',
           'Sec-Fetch-Site': 'cross-site'
        },
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true, // resolve on all status codes
      });
      
      if (response.status === 404 || response.status === 400 || response.status === 410) {
         throw new Error(`Image not found (Status ${response.status})`);
      }

      if (response.status >= 400) {
         throw new Error(`Request failed with status code ${response.status}`);
      }

      contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
      base64 = Buffer.from(response.data, 'binary').toString('base64');
      
    } catch (err: any) {
      console.warn(`[Image-Proxy] Axios failed (${err.message}), trying wsrv.nl proxy for ${url}`);
      try {
        const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
        const response = await axios.get(wsrvUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          validateStatus: () => true,
        });

        if (response.status === 404 || response.status === 400 || response.status === 410) {
           throw new Error(`Image not found via proxy (Status ${response.status})`);
        }
        if (response.status >= 400) {
           throw new Error(`Request failed with status code ${response.status}`);
        }

        contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
        base64 = Buffer.from(response.data, 'binary').toString('base64');
      } catch (wsrvErr: any) {
        console.warn(`[Image-Proxy] wsrv.nl failed (${wsrvErr.message}), falling back to Puppeteer Stealth for ${url}`);
        // Fallback: Puppeteer Stealth
        const browser = await getBrowser();
        const page = await browser.newPage();
        
        const urlObj = new URL(url);
        await page.setExtraHTTPHeaders({
             'Accept-Language': 'en-US,en;q=0.5',
             'Referer': urlObj.origin + '/'
        });

        try {
          const response = await page.goto(url, { timeout: 30000, waitUntil: 'networkidle0' });
          if (!response) {
            throw new Error("Puppeteer received null response.");
          }
          if (response.status() === 404 || response.status() === 400 || response.status() === 410) {
            throw new Error("Image not found via puppeteer");
          }
          if (response.status() >= 400) {
            throw new Error(`Puppeteer received error status ${response.status()}`);
          }
          
          const buffer = await response.buffer();
          contentType = response.headers()['content-type'] || 'application/octet-stream';
          base64 = buffer.toString('base64');
        } finally {
          await page.close();
        }
      }
    }

    const dataUrl = `data:${contentType};base64,${base64}`;
    serverImageCache.set(url, { dataUrl, timestamp: Date.now() });

    // Asynchronously update Telegram copy in background
    (async () => {
      try {
        const { saveImageCacheUnified } = await import("./utils/deviceCacheShared.js");
        const outMap: Record<string, string> = {};
        for (const [k, v] of serverImageCache.entries()) {
          outMap[k] = v.dataUrl;
        }
        await saveImageCacheUnified(outMap);
      } catch (errorSave: any) {
        console.warn("[Image Proxy Backend] BG Telegram Save Failed:", errorSave.message);
      }
    })();

    return dataUrl;
  }

  // Support POST on /api/image-proxy for batching multiple image URLs in a single request
  app.post("/api/image-proxy", async (req, res) => {
    try {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: "Missing or invalid urls array parameter" });
      }

      await ensureServerImageCachePopulated();

      const results: Record<string, string> = {};
      const pendingUrls: string[] = [];

      for (const url of urls) {
        if (!url || typeof url !== 'string') continue;
        const cached = serverImageCache.get(url);
        if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL) {
          results[url] = cached.dataUrl;
        } else {
          pendingUrls.push(url);
        }
      }

      if (pendingUrls.length > 0) {
        console.log(`[Image Proxy Backend] Batch fetching ${pendingUrls.length} uncached urls out of ${urls.length}...`);
        const fetchPromises = pendingUrls.map(async (url) => {
          try {
            const dataUrl = await resolveImageUrl(url);
            results[url] = dataUrl;
          } catch (e: any) {
            console.warn(`[Image-Proxy] Batch fetch failed for url: ${url}. Error: ${e.message}`);
          }
        });

        await Promise.all(fetchPromises);

        // Upload unified batch changes to Telegram
        (async () => {
          try {
            const { saveImageCacheUnified } = await import("./utils/deviceCacheShared.js");
            const outMap: Record<string, string> = {};
            for (const [k, v] of serverImageCache.entries()) {
              outMap[k] = v.dataUrl;
            }
            await saveImageCacheUnified(outMap);
          } catch (errorSave: any) {
            console.warn("[Image Proxy Backend] BG Telegram Batch Save Failed:", errorSave.message);
          }
        })();
      }

      res.json({ data: results });
    } catch (error: any) {
      console.error("Batch Image Proxy Error:", error.message);
      res.status(500).json({ error: `Failed to batch proxy images: ${error.message}` });
    }
  });

  // Image/File Proxy Endpoint (GET)
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing url query parameter" });

      const dataUrl = await resolveImageUrl(url);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.json({ dataUrl });

    } catch (error: any) {
      console.error("Image Proxy Error:", error.message);
      res.status(500).json({ error: `Failed to proxy image: ${error.message}` });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
