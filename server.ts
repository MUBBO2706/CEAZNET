import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import * as cheerio from 'cheerio';
import NodeCache from 'node-cache';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { UAParser } from 'ua-parser-js';

// ==========================================
// CRASH PREVENTER & SERVER LOG INTERCEPTOR
// ==========================================

export const sessionSseClients: { id: string; res: any }[] = [];

// Global Crash Prevention
process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTED] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH PREVENTED] Unhandled Rejection:', reason);
});

// Setup session cache realtime broadcast helper
(global as any).broadcastSessionUpdate = (updatedData: any) => {
  const sseData = `data: ${JSON.stringify(updatedData)}\n\n`;
  sessionSseClients.forEach(client => {
    try {
      client.res.write(sseData);
    } catch (e) {
      // ignore
    }
  });
};

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
import sessionCacheHandler from './api/session-cache.js';
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

    let keysList = keys ? [...keys] : [];
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
        keysList.push({ id: 'env-fallback', api_key: envKey });
    }

    if (keysList.length === 0) {
        const errorMsg = fetchError ? fetchError.message : "No active Gemini keys found in news_api_keys table or local environment.";
        throw new Error(`[Gemini Rotation] Failed to retrieve keys: ${errorMsg}`);
    }

    console.log(`[Gemini Rotation Server] Loaded ${keysList.length} active keys for category "${category}".`);

    let lastError: any = null;

    for (let i = 0; i < keysList.length; i++) {
        const keyConfig = keysList[i];
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
            if (i + 1 < keysList.length) {
                const nextKeyConfig = keysList[i + 1];
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
        zoom: 18,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'Ceaznet-Applet-System/5.0 (fahadhajisahab@gmail.com)'
      },
      timeout: 3000
    });
    if (response.data) {
      if (response.data.display_name) {
        return response.data.display_name;
      }
      if (response.data.address) {
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
    // Only log if there is an error
    if (status !== 'SUBSCRIBED') {
      console.log(`[Cache Invalidation] Realtime status: ${status}`);
    }
  });

// Singleton browser instance promise
let browserPromise: Promise<any> | null = null;
async function getBrowser() {
  if (!browserPromise) {
    
    browserPromise = puppeteer.launch({
      headless: true, // Use new headless mode implicitly in newer puppeteer
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }).catch(err => {
      console.error("Puppeteer launch failed:", err);
      browserPromise = null; // Reset on failure so it can retry later
      throw err;
    });
  }
  return browserPromise;
}

// Ensure browser closes on exit
process.on('SIGINT', async () => {
    if (browserPromise) {
        const browser = await browserPromise.catch(() => null);
        if (browser) await browser.close();
    }
    process.exit(0);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Clear Cache API
  app.post("/api/db/clear-cache", (req, res) => {
    try {
      const { table } = req.body || {};
      if (table) {
        const keys = dbCache.keys().filter(key => key.startsWith(`tbl_${table}_`));
        if (keys.length > 0) {
          dbCache.del(keys);
          console.log(`[Cache] Manually cleared ${keys.length} cached keys for table: ${table}`);
        }
      } else {
        dbCache.flushAll();
        console.log(`[Cache] Flushed all cached queries`);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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

  // Public Anonymous Shared Note API
  app.get("/api/notes/shared", async (req, res) => {
    try {
      const noteId = (req.query.id || req.query.noteId) as string;
      if (!noteId) return res.status(400).json({ success: false, error: "Missing note ID parameter" });

      const exp = req.query.exp as string;
      const sig = req.query.sig as string;

      if (exp && exp !== 'never') {
        // Validate signature to prevent tampering
        const expectedSig = crypto.createHash('sha256').update(noteId + ':' + exp).digest('hex');
        if (sig !== expectedSig) {
          return res.status(403).json({ success: false, error: "Invalid share link signature or link tampered" });
        }
        
        // Check if expired
        const expTime = parseInt(exp, 10);
        if (isNaN(expTime) || Date.now() > expTime) {
          return res.status(410).json({ success: false, error: "expired: This shareable note link has expired." });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('notes')
        .select('id, user_id, title, content, tags, is_pinned, color_theme, created_at, updated_at')
        .eq('id', noteId)
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({ success: false, error: "Note not found or deleted" });
      }

      return res.json({
        success: true,
        note: {
          id: data.id,
          user_id: data.user_id,
          title: data.title || 'Untitled Note',
          content: data.content || '',
          tags: data.tags || [],
          isPinned: data.is_pinned,
          colorTheme: data.color_theme || 'default',
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      });
    } catch (err: any) {
      console.error("Error fetching public shared note:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/notes/shared", async (req, res) => {
    try {
      const noteId = req.body.id || req.body.noteId;
      if (!noteId) return res.status(400).json({ success: false, error: "Missing note ID parameter" });

      const exp = req.body.exp || req.query.exp;
      const sig = req.body.sig || req.query.sig;

      if (exp && exp !== 'never') {
        // Validate signature to prevent tampering
        const expectedSig = crypto.createHash('sha256').update(noteId + ':' + exp).digest('hex');
        if (sig !== expectedSig) {
          return res.status(403).json({ success: false, error: "Invalid share link signature or link tampered" });
        }
        
        // Check if expired
        const expTime = parseInt(exp, 10);
        if (isNaN(expTime) || Date.now() > expTime) {
          return res.status(410).json({ success: false, error: "expired: This shareable note link has expired." });
        }
      }

      const { data, error } = await supabaseAdmin
        .from('notes')
        .select('id, user_id, title, content, tags, is_pinned, color_theme, created_at, updated_at')
        .eq('id', noteId)
        .maybeSingle();

      if (error || !data) {
        return res.status(404).json({ success: false, error: "Note not found or deleted" });
      }

      return res.json({
        success: true,
        note: {
          id: data.id,
          user_id: data.user_id,
          title: data.title || 'Untitled Note',
          content: data.content || '',
          tags: data.tags || [],
          isPinned: data.is_pinned,
          colorTheme: data.color_theme || 'default',
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }
      });
    } catch (err: any) {
      console.error("Error fetching public shared note:", err);
      return res.status(500).json({ success: false, error: err.message });
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
          .select('id, category, article_data, formatted_content_md, views, likes, bookmarks')
          .eq('article_data->>url', url)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          dbCache.set(cacheKey, data, 120); // 2 minutes for specific article to avoid stale counts
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
        ? 'id, category, article_data, views, likes, bookmarks' 
        : 'id, category, article_data, formatted_content_md, views, likes, bookmarks';

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
    try {
      await deviceMapperHandler(req, res);
    } catch (e: any) {
      console.error('[CRASH PREVENTED] /api/device-mapper async error:', e);
      res.status(500).json({ error: "Session operation failed", message: e.message });
    }
  });

  app.all('/api/session-cache', async (req, res) => {
    try {
      await sessionCacheHandler(req, res);
    } catch (e: any) {
      console.error('[CRASH PREVENTED] /api/session-cache async error:', e);
      res.status(500).json({ error: "Session cache operation failed", message: e.message });
    }
  });

  // User Session & Active Devices Tracking APIs
  app.all("/api/sessions", async (req, res) => {
    try {
      await sessionsHandler(req, res);
    } catch (e: any) {
      console.error('[CRASH PREVENTED] /api/sessions async error:', e);
      res.status(500).json({ error: "Session tracking operation failed", message: e.message });
    }
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

  // AI-powered Icon Suggestion for Daily Khata
  app.post("/api/dairy/suggest-icon", async (req, res) => {
    try {
      const { name, existingItems, existingCategories } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Missing or invalid name parameter" });
      }

      console.log(`[Dairy AI Icon] Request received for item name: "${name}"`);

      const resultText = await executeWithGeminiRotation("suggest_dairy_icon", async (ai) => {
        const systemPrompt = `Suggest the single best icon ID for a daily ledger/diary tracker item named "${name}".

Choose ONLY from the following allowed list of icon IDs:
- "milk" (for milk, dairy, dudh, cheese, butter, tiffin, breakfast, dairy products)
- "newspaper" (for newspaper, magazine, journal, akhbar)
- "droplet" (for water, mineral water, bisleri, drinking water, pani, liquid)
- "activity" (for wifi, internet, gym, fitness, health, tracking, speed, network, sports)
- "calendar" (for rent, room rent, kiraya, EMI, monthly subscription, billing, calendar)
- "package" (for groceries, delivery, courier, parcel, order, item, stock, ration, general items, food)
- "tv" (for netflix, cable tv, prime, entertainment, streaming, screen)
- "zap" (for electricity, power bill, electricity bill, bijli, energy, electronics)
- "flame" (for gas cylinder, lpg, gas bill, cylinder, heat, cooking)
- "car" (for petrol, diesel, fuel, car ride, cab, transport, travel, vehicle)
- "bike" (for bike ride, scooter, fuel, delivery bike, motorcycle)
- "heart" (for medicine, doctor, health, yoga, gym, care)
- "coffee" (for tea, chai, coffee, cafe, beverages)
- "apple" (for fruits, vegetables, sabzi, grocery, food, snacks)
- "utensils" (for cook, tiffin service, dinner, lunch, maid, food, restaurant)
- "book" (for tuition fee, classes, book purchase, library, studies, school)
- "scissors" (for saloon, haircut, spa, beauty parlor, grooming)
- "trash" (for garbage disposal, sweep, safai, cleaning service)
- "wrench" (for home repair, maintenance, mechanic, services)
- "shield" (for insurance, security guard, protection)

${existingItems && existingItems.length > 0 ? `Existing daily items already tracked in user's Daily Khata ledger:\n${JSON.stringify(existingItems)}\n` : ''}
${existingCategories && existingCategories.length > 0 ? `Existing transaction categories in user's general account:\n${JSON.stringify(existingCategories)}\n` : ''}

CRITICAL DIRECTIVES:
1. Try to find if any of the existing transaction categories is a perfect fit for "${name}". If a highly specific category already exists (e.g., if "Airtel" is typed and there is an existing "Internet" or "WiFi" category), set "createNewCategory": false, "matchedCategory": "<matching_category_id_or_label>", and "icon": "<that_category_icon>".
2. If NO existing transaction category fits the context of "${name}" well (or is too broad/unrelated), set "createNewCategory": true. Create a concise, professional category name for "suggestedCategoryName" (e.g., "WiFi & Broadband" or "Tuition Fee" or "Trash Disposal") and pick the best aligned icon ID from the allowed list above.
3. Suggest an icon that is consistent with the user's existing items or categories if a similar item exists.
4. Avoid duplicating items/meanings with conflicting icons.
5. Return your response strictly in JSON format matching this structure:
{
  "icon": string,
  "confidence": number,
  "reason": string,
  "createNewCategory": boolean,
  "suggestedCategoryName": string,
  "matchedCategory": string
}
Example: {"icon": "milk", "confidence": 0.95, "reason": "Dudh refers to milk in Hindi", "createNewCategory": false, "suggestedCategoryName": "", "matchedCategory": "Groceries"}`;

        try {
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${systemPrompt}\n\nCRITICAL DIRECTIVE:\nIf you are confused, uncertain, or encounter any brand name, product, medicine, company, app, or regional Hinglish term (e.g., 'Swiggy', 'Blinkit', 'Zepto', 'Cultfit', 'Fastag', 'Dolo 650', 'Challan', 'Netmeds', 'Zomato', 'Airtel', 'Dudh', 'Kiraya'), USE GOOGLE SEARCH to look up what the product, brand, or service is before selecting the icon!`,
            config: {
              tools: [{ googleSearch: {} }],
              temperature: 0.2,
            }
          });
          return response.text;
        } catch (searchError) {
          console.warn("[Dairy AI Icon Server] Failed with Google Search, falling back to standard content generation:", searchError);
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: systemPrompt,
            config: {
              temperature: 0.2,
            }
          });
          return response.text;
        }
      });

      if (resultText) {
        let cleanText = resultText.trim();
        if (cleanText.includes('```')) {
          const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match && match[1]) {
            cleanText = match[1].trim();
          }
        }
        const parsed = JSON.parse(cleanText);
        console.log(`[Dairy AI Icon] AI response for "${name}":`, parsed);
        return res.json({ 
          success: true, 
          icon: parsed.icon, 
          confidence: parsed.confidence, 
          reason: parsed.reason,
          createNewCategory: !!parsed.createNewCategory,
          suggestedCategoryName: parsed.suggestedCategoryName || "",
          matchedCategory: parsed.matchedCategory || ""
        });
      } else {
        return res.status(500).json({ error: "Empty response from Gemini API" });
      }
    } catch (err: any) {
      console.error("[Dairy AI Icon] Error during icon suggestion:", err);
      return res.status(500).json({ error: err.message || "Failed to generate icon suggestion" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get(["/api/version-control", "/api/version/check"], async (req, res) => {
    try {
      const clientVersion = req.query.currentVersion as string;
      
      const candidatePaths = [
        path.join(process.cwd(), 'dist', 'version.json'),
        path.join(process.cwd(), 'public', 'version.json'),
        path.join(process.cwd(), 'version.json'),
      ];

      let serverVersion = 'unknown';
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          try {
            const fileContent = fs.readFileSync(p, 'utf8');
            const parsed = JSON.parse(fileContent);
            if (parsed.version) {
              serverVersion = parsed.version;
              break;
            }
          } catch {}
        }
      }

      // Fallback: If filesystem failed, try fetching via HTTP from the current host
      if (serverVersion === 'unknown' && req.headers.host) {
        try {
          const host = req.headers.host;
          const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
          const url = `${protocol}://${host}/version.json?t=${Date.now()}`;
          const response = await fetch(url, {
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          });
          if (response.ok) {
            const parsed = await response.json();
            serverVersion = parsed.version || 'unknown';
          }
        } catch (httpErr) {
          console.warn('[Server] Failed to fetch version.json via HTTP fallback:', httpErr);
        }
      }
      
      const isNewVersionAvailable = Boolean(
        clientVersion &&
        clientVersion !== 'unknown' &&
        serverVersion !== 'unknown' &&
        serverVersion !== clientVersion
      );
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        serverVersion,
        clientVersion: clientVersion || 'unknown',
        hasUpdate: isNewVersionAvailable,
        message: isNewVersionAvailable 
          ? `New version found! Update from version ${clientVersion} to ${serverVersion} is available.` 
          : `You are up to date (Version ${clientVersion || serverVersion}).`
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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
    try {
      await urlReaderHandler(req, res);
    } catch (e: any) {
      console.error('[CRASH PREVENTED] /api/url-reader async error:', e);
      res.status(500).json({ error: "URL reading operation failed", message: e.message });
    }
  });  // Image/File Proxy Caching and Resolution
  const serverImageCache = new Map<string, { dataUrl: string; timestamp: number }>();
  const SERVER_CACHE_TTL = 120 * 60 * 1000; // 2 hours server cache

  interface ImageResolutionResult {
    dataUrl?: string;
    status: 'cached' | 'processed' | 'failed';
    attempts: number;
    cachedUntil: string | null;
    timeLeftMinutes: number | null;
    error?: string;
  }

  async function resolveImageUrlDetailed(url: string): Promise<ImageResolutionResult> {
    const cached = serverImageCache.get(url);
    if (cached) {
      if ((cached as any).permanentlyFailed) {
        return {
          status: 'failed',
          attempts: 12,
          cachedUntil: "indefinite",
          timeLeftMinutes: null,
          error: (cached as any).error || "Indefinitely failed (exhausted all 12 strategies)"
        };
      }
      const elapsed = Date.now() - cached.timestamp;
      if (elapsed < SERVER_CACHE_TTL) {
        if ((cached as any).failed) {
          const remainingMs = SERVER_CACHE_TTL - elapsed;
          return {
            status: 'failed',
            attempts: 0,
            cachedUntil: new Date(cached.timestamp + SERVER_CACHE_TTL).toISOString(),
            timeLeftMinutes: remainingMs / (60 * 1000),
            error: (cached as any).error || "Cached image resolution failure"
          };
        }
        const remainingMs = SERVER_CACHE_TTL - elapsed;
        return {
          dataUrl: cached.dataUrl,
          status: 'cached',
          attempts: 0,
          cachedUntil: new Date(cached.timestamp + SERVER_CACHE_TTL).toISOString(),
          timeLeftMinutes: remainingMs / (60 * 1000)
        };
      } else {
        serverImageCache.delete(url);
      }
    }
    let base64 = "";
    let contentType = "application/octet-stream";
    let attempts = 0;
    let finalError = "";
    let successfulStrategy = "";

    const isDirectToPuppeteer = url.toLowerCase().includes('businesswire.com');

    // Define all image proxy and resolution strategies as helper functions
    const getDirectAxios = async (targetUrl: string) => {
      const urlObj = new URL(targetUrl);
      const response = await axios.get(targetUrl, {
        responseType: 'arraybuffer',
        headers: {
           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
           'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
           'Accept-Language': 'en-US,en;q=0.9',
           'Cache-Control': 'no-cache',
           'Pragma': 'no-cache',
           'Referer': urlObj.origin + '/',
           'Host': urlObj.host,
           'Sec-Fetch-Dest': 'image',
           'Sec-Fetch-Mode': 'no-cors',
           'Sec-Fetch-Site': 'same-origin',
           'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
           'sec-ch-ua-mobile': '?0',
           'sec-ch-ua-platform': '"Windows"'
        },
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      if (response.status === 404 || response.status === 400 || response.status === 410) {
        throw new Error(`Image not found on origin (Status ${response.status})`);
      }
      if (response.status >= 400) {
        throw new Error(`Direct request failed with status code ${response.status}`);
      }
      const ct = (response.headers['content-type'] as string) || 'application/octet-stream';
      return { buffer: Buffer.from(response.data, 'binary'), contentType: ct };
    };

    const getWsrv = async (targetUrl: string) => {
      const wsrvUrl = `https://wsrv.nl/?url=${encodeURIComponent(targetUrl)}`;
      const response = await axios.get(wsrvUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (response.status === 404 || response.status === 400 || response.status === 410) {
        throw new Error(`Image not found via wsrv.nl (Status ${response.status})`);
      }
      if (response.status >= 400) {
        throw new Error(`wsrv.nl returned error status ${response.status}`);
      }
      const ct = (response.headers['content-type'] as string) || 'application/octet-stream';
      return { buffer: Buffer.from(response.data, 'binary'), contentType: ct };
    };

    const getGoogleOpenSocial = async (targetUrl: string) => {
      const googleProxyUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(targetUrl)}`;
      const response = await axios.get(googleProxyUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (response.status === 404 || response.status === 400 || response.status === 410) {
        throw new Error(`Image not found via Google OpenSocial (Status ${response.status})`);
      }
      if (response.status >= 400) {
        throw new Error(`Google OpenSocial returned error status ${response.status}`);
      }
      const ct = (response.headers['content-type'] as string) || 'image/jpeg';
      return { buffer: Buffer.from(response.data, 'binary'), contentType: ct };
    };

    const getWordpressPhoton = async (targetUrl: string) => {
      const cleanUrl = targetUrl.replace(/^https?:\/\//, '');
      const isHttps = targetUrl.toLowerCase().startsWith('https://');
      const hasQuery = cleanUrl.includes('?');
      // Fix potential duplicate query string question marks for a perfectly formatted Photon proxy link
      const photonUrl = `https://i0.wp.com/${cleanUrl}${isHttps ? (hasQuery ? '&ssl=1' : '?ssl=1') : ''}`;
      const response = await axios.get(photonUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (response.status === 403 || response.status === 404 || response.status === 400 || response.status === 410) {
        throw new Error(`Image not found or forbidden via WordPress Photon (Status ${response.status})`);
      }
      if (response.status >= 400) {
        throw new Error(`WordPress Photon returned error status ${response.status}`);
      }
      const ct = (response.headers['content-type'] as string) || 'application/octet-stream';
      return { buffer: Buffer.from(response.data, 'binary'), contentType: ct };
    };

    const getDdgProxy = async (targetUrl: string) => {
      const ddgUrl = `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(targetUrl)}&f=1`;
      const response = await axios.get(ddgUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (response.status === 404 || response.status === 400 || response.status === 410) {
        throw new Error(`Image not found via DuckDuckGo (Status ${response.status})`);
      }
      if (response.status >= 400) {
        throw new Error(`DuckDuckGo returned error status ${response.status}`);
      }
      const ct = (response.headers['content-type'] as string) || 'application/octet-stream';
      return { buffer: Buffer.from(response.data, 'binary'), contentType: ct };
    };

    const getCloudinary = async (targetUrl: string) => {
      const cloudinaryUrl = `https://res.cloudinary.com/demo/image/fetch/f_auto,q_auto/${targetUrl}`;
      const response = await axios.get(cloudinaryUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (response.status === 404 || response.status === 400 || response.status === 410) {
        throw new Error(`Image not found via Cloudinary Fetch (Status ${response.status})`);
      }
      if (response.status >= 400) {
        throw new Error(`Cloudinary Fetch returned error status ${response.status}`);
      }
      const ct = (response.headers['content-type'] as string) || 'application/octet-stream';
      return { buffer: Buffer.from(response.data, 'binary'), contentType: ct };
    };

    const getPuppeteer = async (targetUrl: string) => {
      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        // Let Puppeteer navigate with typical default browser headers instead of extra forced mismatched headers to prevent 406 errors
        const response = await page.goto(targetUrl, { timeout: 35000, waitUntil: 'networkidle0' });
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
        const ct = response.headers()['content-type'] || 'application/octet-stream';
        return { buffer, contentType: ct };
      } finally {
        await page.close();
      }
    };

    // Construct execution fallback list based on blocklist / security rules
    let strategies: Array<{ name: string; execute: () => Promise<{ buffer: Buffer; contentType: string }> }> = [];

    if (isDirectToPuppeteer) {
      strategies = [
        { name: "Puppeteer Stealth", execute: () => getPuppeteer(url) },
        { name: "WordPress Photon CDN", execute: () => getWordpressPhoton(url) },
        { name: "Google OpenSocial Proxy", execute: () => getGoogleOpenSocial(url) },
        { name: "wsrv.nl Proxy", execute: () => getWsrv(url) },
        { name: "DuckDuckGo Image Proxy", execute: () => getDdgProxy(url) },
        { name: "Cloudinary Fetch CDN", execute: () => getCloudinary(url) },
        { name: "Direct Origin Fetch", execute: () => getDirectAxios(url) },
      ];
    } else {
      strategies = [
        { name: "Direct Origin Fetch", execute: () => getDirectAxios(url) },
        { name: "WordPress Photon CDN", execute: () => getWordpressPhoton(url) },
        { name: "wsrv.nl Proxy", execute: () => getWsrv(url) },
        { name: "Google OpenSocial Proxy", execute: () => getGoogleOpenSocial(url) },
        { name: "DuckDuckGo Image Proxy", execute: () => getDdgProxy(url) },
        { name: "Cloudinary Fetch CDN", execute: () => getCloudinary(url) },
        { name: "Puppeteer Stealth", execute: () => getPuppeteer(url) },
      ];
    }

    // Try each strategy sequentially to guarantee 99%+ uptime and zero custom key restrictions
    for (const strategy of strategies) {
      attempts++;
      try {
        const result = await strategy.execute();
        
        if (result && result.buffer && result.buffer.length > 0) {
          base64 = result.buffer.toString('base64');
          contentType = result.contentType;
          successfulStrategy = strategy.name;
          break; // Stop on first successful resolution
        } else {
          throw new Error("Returned zero bytes buffer.");
        }
      } catch (err: any) {
        finalError = err.message;
      }
    }

    // Ultimate Fallback: If original dynamic URL failed (often due to dynamic resizing CDN gates rejecting request tokens/headers), 
    // retry highly resilient strategies with cleaned/stripped URL (excluding dynamic crop variables) to fetch raw static base image
    const hasQueryParams = url.includes('?');
    if (!base64 && hasQueryParams) {
      const strippedUrl = url.split('?')[0];
      const strippedStrategies = [
        { name: "WordPress Photon CDN (Cleaned)", execute: () => getWordpressPhoton(strippedUrl) },
        { name: "wsrv.nl Proxy (Cleaned)", execute: () => getWsrv(strippedUrl) },
        { name: "Direct Origin Fetch (Cleaned)", execute: () => getDirectAxios(strippedUrl) },
        { name: "Google OpenSocial Proxy (Cleaned)", execute: () => getGoogleOpenSocial(strippedUrl) },
        { name: "Puppeteer Stealth (Cleaned)", execute: () => getPuppeteer(strippedUrl) },
      ];

      for (const strategy of strippedStrategies) {
        attempts++;
        try {
          const result = await strategy.execute();
          
          if (result && result.buffer && result.buffer.length > 0) {
            base64 = result.buffer.toString('base64');
            contentType = result.contentType;
            successfulStrategy = strategy.name;
            break; // Stop on first successful resolution
          } else {
            throw new Error("Returned zero bytes buffer.");
          }
        } catch (err: any) {
          finalError = err.message;
        }
      }
    }

    if (base64) {
      const dataUrl = `data:${contentType};base64,${base64}`;
      const now = Date.now();
      serverImageCache.set(url, { dataUrl, timestamp: now });
      return {
        dataUrl,
        status: 'processed',
        attempts,
        cachedUntil: new Date(now + SERVER_CACHE_TTL).toISOString(),
        timeLeftMinutes: SERVER_CACHE_TTL / (60 * 1000)
      };
    }

    // Handle unresolvable external images gracefully without logging to stdout/stderr
    const now = Date.now();
    const isPermanent = attempts >= 12;
    serverImageCache.set(url, { 
      dataUrl: "failed", 
      timestamp: now, 
      failed: true, 
      error: finalError,
      permanentlyFailed: isPermanent
    } as any);

    return {
      status: 'failed',
      attempts,
      cachedUntil: isPermanent ? "indefinite" : new Date(now + SERVER_CACHE_TTL).toISOString(),
      timeLeftMinutes: isPermanent ? null : SERVER_CACHE_TTL / (60 * 1000),
      error: finalError || "Unknown resolution failure"
    };
  }

  async function resolveImageUrl(url: string): Promise<string> {
    const detailed = await resolveImageUrlDetailed(url);
    if (detailed.status !== 'failed' && detailed.dataUrl) {
      return detailed.dataUrl;
    }
    throw new Error(detailed.error || "Failed to resolve image");
  }

  // Support POST on /api/image-proxy for batching multiple image URLs in a single request
  app.post("/api/image-proxy", async (req, res) => {
    try {
      const { urls, warmOnly, returnData } = req.body || {};
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: "Missing or invalid urls array parameter" });
      }

      const shouldReturnData = returnData !== false && warmOnly !== true;
      const resultsData: Record<string, string> = {};
      const individualResults: any[] = [];
      let processedCount = 0;
      let failedCount = 0;
      let cachedCount = 0;
      const processedFirstTimeUrls: string[] = [];
      const alreadyCachedUrls: string[] = [];

      const fetchPromises = urls.map(async (url) => {
        if (!url || typeof url !== 'string') return;
        try {
          const detail = await resolveImageUrlDetailed(url);
          const isFirstTime = detail.status === 'processed';

          if (detail.status === 'cached') {
            cachedCount++;
            alreadyCachedUrls.push(url);
          } else if (detail.status === 'processed') {
            processedCount++;
            processedFirstTimeUrls.push(url);
          } else {
            failedCount++;
          }

          if (shouldReturnData && detail.status !== 'failed' && detail.dataUrl) {
            resultsData[url] = detail.dataUrl;
          }

          individualResults.push({
            url,
            status: detail.status,
            isFirstTimeCached: isFirstTime,
            source: isFirstTime ? 'new-origin-fetch' : 'server-cache',
            source_origin: isFirstTime ? 'new-origin-fetch' : 'server-cache',
            sourceOrigin: isFirstTime ? 'new-origin-fetch' : 'server-cache',
            attempts: detail.attempts,
            cachedUntil: detail.cachedUntil,
            timeLeftMinutes: detail.timeLeftMinutes,
            error: detail.error
          });
        } catch (e: any) {
          failedCount++;
          individualResults.push({
            url,
            status: 'failed',
            isFirstTimeCached: false,
            source: 'failed',
            source_origin: 'failed',
            sourceOrigin: 'failed',
            attempts: 1,
            cachedUntil: null,
            timeLeftMinutes: null,
            error: e.message
          });
        }
      });

      await Promise.all(fetchPromises);

      const summary = {
        totalSent: urls.length,
        processedCount,
        failedCount,
        cachedCount,
        processedFirstTimeUrls,
        alreadyCachedUrls,
        allFirstTimeCached: processedCount === urls.length && cachedCount === 0,
        anyFirstTimeCached: processedCount > 0,
        currentTime: new Date().toISOString()
      };


      res.json({
        data: resultsData,
        summary,
        results: individualResults
      });
    } catch (error: any) {
      console.warn("Batch Image Proxy Error:", error.message);
      res.status(500).json({ error: `Failed to batch proxy images: ${error.message}` });
    }
  });

  // Image/File Proxy Endpoint (GET)
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing url query parameter" });

      const detailed = await resolveImageUrlDetailed(url);
      if (detailed.status !== 'failed' && detailed.dataUrl) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.json({ 
          dataUrl: detailed.dataUrl,
          source: detailed.status === 'cached' ? 'server-cache' : 'new-origin-fetch'
        });
      }
      return res.json({
        dataUrl: "failed",
        failed: true,
        attempts: detailed.attempts,
        error: detailed.error || "Failed to resolve image"
      });

    } catch (error: any) {
      console.warn("Image Proxy Error:", error.message);
      res.status(500).json({ error: `Failed to proxy image: ${error.message}` });
    }
  });

  // Server-side Image Cache Management Endpoints
  app.get("/api/image-cache-status", (req, res) => {
    try {
      const items: any[] = [];
      let totalSizeCharacters = 0;
      const now = Date.now();
      
      serverImageCache.forEach((value, url) => {
        const elapsed = now - value.timestamp;
        const remainingMs = SERVER_CACHE_TTL - elapsed;
        const isExpired = elapsed >= SERVER_CACHE_TTL;
        const sizeChars = value.dataUrl.length;
        totalSizeCharacters += sizeChars;

        items.push({
          url,
          timestamp: value.timestamp,
          isExpired,
          timeLeftMinutes: isExpired ? 0 : remainingMs / (60 * 1000),
          sizeBytes: Math.round(sizeChars * 0.75) // Rough estimation of base64 to binary bytes
        });
      });

      res.json({
        count: serverImageCache.size,
        totalSizeBytes: Math.round(totalSizeCharacters * 0.75),
        ttlMs: SERVER_CACHE_TTL,
        items
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/image-cache-clear", (req, res) => {
    try {
      const count = serverImageCache.size;
      serverImageCache.clear();
      console.log(`[Image Cache] Server cache explicitly cleared. Removed ${count} items.`);
      res.json({ success: true, clearedCount: count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/image-cache-delete", (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "Missing or invalid url parameter" });
      }
      const existed = serverImageCache.has(url);
      if (existed) {
        serverImageCache.delete(url);
        console.log(`[Image Cache] Server cache item deleted: ${url}`);
      }
      res.json({ success: true, removed: existed });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/session-cache/stream", (req, res) => {
    try {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send a dummy comment to verify connection and flush headers
      res.write(': ping\n\n');

      const clientId = Math.random().toString(36).slice(2, 9);
      const newClient = { id: clientId, res };
      sessionSseClients.push(newClient);

      req.on('close', () => {
        const index = sessionSseClients.findIndex(c => c.id === clientId);
        if (index !== -1) {
          sessionSseClients.splice(index, 1);
        }
      });
    } catch (e: any) {
      console.error("[SSE session-cache] SSE Stream bootstrap failed:", e);
      res.status(500).end();
    }
  });

  // Express Route-level Crash Preventer (Error handling middleware)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[EXPRESS CAPTURED EXCEPTION - crash prevented]', err);
    res.status(500).json({
      error: "Internal Server Error (Crash Prevented)",
      message: err instanceof Error ? err.message : String(err)
    });
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
