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
import { supabase } from './services/supabaseClient';

// Import session endpoints
import trackSessionHandler from './api/sessions/track.js';
import terminateSessionHandler from './api/sessions/terminate.js';

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

const supabaseAdminUrl = getEnvValue('SUPABASE_URL') || getEnvValue('VITE_SUPABASE_URL') || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseAdminKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY') || getEnvValue('SUPABASE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey);

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

  // Device Mapper API to resolve actual device models from a comprehensive database
  app.post("/api/device-mapper", async (req, res) => {
    try {
      const { model } = req.body;
      if (!model) return res.status(400).json({ error: "Model parameter is required" });
      
      const cleanModel = model.toString().trim().toUpperCase();
      if (!cleanModel) return res.json({ name: null, source: "static" });

      const cacheKey = `device_model_v3_${cleanModel}`;
      
      // 1. Try In-Memory Cache Lookups (infinite TTL with 0)
      const cachedMem = dbCache.get<string | null>(cacheKey);
      if (cachedMem !== undefined) {
        return res.json({ name: cachedMem, source: "cache" });
      }

      // 2. Try Disk/Persistent Cache Lookups (Telegram pipeline integrated!)
      const cacheData = await loadDeviceCacheUnified();
      if (cleanModel in cacheData) {
        const cachedVal = cacheData[cleanModel];
        dbCache.set(cacheKey, cachedVal, 0); // Disable expiration
        return res.json({ name: cachedVal, source: "cache" });
      }

      const { default: deviceList } = await import('android-device-list');
      const list = deviceList.deviceList();
      
      // 3. Try Static Database lookup
      let match = list.find((d: any) => 
        d.model?.toUpperCase() === cleanModel && 
        (d.brand?.trim() || d.name?.trim())
      );
      
      if (!match) {
        match = list.find((d: any) => {
          const dModel = d.model?.toUpperCase();
          const dName = d.name?.toUpperCase();
          
          if (!dModel || dModel.length < 4) return false;
          if (!dName || dName.length < 4) return false;
          if (!d.brand?.trim() && !d.name?.trim()) return false;

          return cleanModel === dModel || cleanModel === dName;
        });
      }

      if (match) {
        const rawName = `${match.brand || ''} ${match.name || ''}`.trim();
        const words = rawName.split(/\s+/);
        const seen = new Set<string>();
        const uniqueWords = words.filter(word => {
          const lower = word.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
        const finalName = uniqueWords.join(' ');
        
        dbCache.set(cacheKey, finalName, 0); // Permanent
        const updatedCache = await loadDeviceCacheUnified();
        updatedCache[cleanModel] = finalName;
        await saveDeviceCacheUnified(updatedCache);
        return res.json({ name: finalName, source: "static" });
      }

      // 4. Try Gemini API Resolver
      try {
        const response = await executeWithGeminiRotation('device_mapper', async (ai) => {
          return await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Identify this mobile device model code: "${cleanModel}".`,
            config: {
              systemInstruction: `You are a professional device model to marketing name resolver.
Identify the official device brand and marketing model name for the given model code (e.g. "SM-S928U" -> Brand: "Samsung", Name: "Galaxy S24 Ultra"; "CPH2581" -> Brand: "OnePlus", Name: "12"; "GC3VE" -> Brand: "Google", Name: "Pixel 8a"; "M1912G7BI" -> Brand: "Xiaomi", Name: "Redmi Note 8 Pro").
Ensure you distinguish between sub-brands like "Poco", "Redmi", "OnePlus", "Samsung", "Google", "Apple", "iPad", etc.
Ensure the returned brand and name are accurate, realistic marketing names.
Provide your response strictly in JSON format with fields "brand" and "name". If the device model code is invalid or completely unidentifiable, return null for both fields. Do not add any conversational text or markdown formatting.`,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  brand: { type: "STRING" },
                  name: { type: "STRING" }
                },
                required: ["brand", "name"]
              },
              thinkingConfig: { thinkingBudget: 0 }
            }
          });
        });

        const text = response.text?.trim() || "";
        const parsed = safeParseGeminiJson(text);
        if (parsed && (parsed.brand || parsed.name)) {
          const brand = (parsed.brand || "").trim();
          const name = (parsed.name || "").trim();
          let fullName = "";
          if (brand && name) {
            if (name.toUpperCase().startsWith(brand.toUpperCase())) {
              fullName = name;
            } else {
              fullName = `${brand} ${name}`;
            }
          } else {
            fullName = name || brand;
          }

          if (fullName) {
            const words = fullName.split(/\s+/);
            const seen = new Set<string>();
            const uniqueWords = words.filter(word => {
              const lower = word.toLowerCase();
              if (seen.has(lower)) return false;
              seen.add(lower);
              return true;
            });
            const finalName = uniqueWords.join(' ');

            dbCache.set(cacheKey, finalName, 0); // Permanent
            const updatedCache = await loadDeviceCacheUnified();
            updatedCache[cleanModel] = finalName;
            await saveDeviceCacheUnified(updatedCache);
            return res.json({ name: finalName, source: "gemini" });
          }
        }
        
        // Explicit null/empty identified by model successfully
        dbCache.set(cacheKey, null, 0); // Permanent
        const updatedCache = await loadDeviceCacheUnified();
        updatedCache[cleanModel] = null;
        await saveDeviceCacheUnified(updatedCache);
        return res.json({ name: null, source: "gemini" });

      } catch (geminiError: any) {
        console.error("Gemini Device Resolver Error:", geminiError.message);
        // Format a clearer error to help the user distinguish between DB issues and Google API issues
        let finalErrorMsg = geminiError.message;
        if (finalErrorMsg.includes("leaked")) {
            finalErrorMsg = "The Gemini API key fetched from your Supabase 'news_api_keys' table has been blocked by Google as leaked. Please replace it in the database.";
        }
        // Do NOT cache a negative/null result because the API crashed or was unavailable/503.
        return res.json({ name: null, source: "gemini", error: finalErrorMsg });
      }
    } catch (e: any) {
      console.error("Device Mapper Error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET all persistent cache mappings for Device Mapper
  app.get("/api/device-mapper/cache", async (req, res) => {
    try {
      const data = await loadDeviceCacheUnified();
      res.json(data);
    } catch (err: any) {
      console.error("Error reading cache list:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST add/update custom model mapping in Device Mapper cache
  app.post("/api/device-mapper/cache", async (req, res) => {
    try {
      const { model, name } = req.body;
      if (!model) return res.status(400).json({ error: "Model parameter is required" });
      const cleanModel = model.toString().trim().toUpperCase();
      const cleanName = name === "" || name === null ? null : name.toString().trim();
      
      const data = await loadDeviceCacheUnified();
      data[cleanModel] = cleanName;
      await saveDeviceCacheUnified(data);
      
      // Update memory cache
      const cacheKey = `device_model_v3_${cleanModel}`;
      dbCache.set(cacheKey, cleanName, 0); // Permanent
      
      res.json({ success: true, model: cleanModel, name: cleanName });
    } catch (err: any) {
      console.error("Error adding/updating cache entry:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST delete a cached entry in Device Mapper cache
  app.post("/api/device-mapper/cache/delete", async (req, res) => {
    try {
      const { model } = req.body;
      if (!model) return res.status(400).json({ error: "Model parameter is required" });
      const cleanModel = model.toString().trim().toUpperCase();
      
      const data = await loadDeviceCacheUnified();
      
      let found = false;
      // Search and delete matching keys case-insensitively
      for (const key of Object.keys(data)) {
        if (key.trim().toUpperCase() === cleanModel) {
          delete data[key];
          found = true;
        }
      }
      
      if (found) {
        await saveDeviceCacheUnified(data);
      }
      
      // Remove from memory cache
      const cacheKey = `device_model_v3_${cleanModel}`;
      dbCache.del(cacheKey);
      
      res.json({ success: true, model: cleanModel });
    } catch (err: any) {
      console.error("Error deleting cache entry:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // User Session & Active Devices Tracking APIs
  app.post("/api/sessions/track", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
      }
      
      const token = authHeader.split(' ')[1];
      let authError: any = null;
      let user: any = null;
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (!payload.sub) throw new Error("Missing sub in token");
        user = { id: payload.sub };
      } catch (e: any) {
        authError = e;
      }
      
      if (authError || !user) {
        console.error("Auth validation failed for /api/sessions/track:", authError);
        return res.status(401).json({ error: "UNAUTHORIZED: Invalid token", details: authError });
      }

      const { session_key, client_device_name, latitude, longitude, battery_percentage } = req.body;
      if (!session_key) {
        return res.status(400).json({ error: "Missing session_key parameter" });
      }

      const ip = getClientIp(req);
      const userAgent = req.headers['user-agent'] || '';
      
      // Render clean device name using ua-parser-js
      const deviceName = client_device_name || parseUserAgent(userAgent);
      
      // Fetch location via coordinates (reverse geocoding) if provided, otherwise fallback to IP Location!
      let location = "Unknown Location";
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        const reverseGeoName = await getReverseGeocoding(latitude, longitude);
        if (reverseGeoName) {
          location = reverseGeoName;
        } else {
          location = await getIpLocation(ip);
        }
      } else {
        location = await getIpLocation(ip);
      }

      // Create a user-scoped client to satisfy RLS policies (auth.uid() = user_id)
      const userClient = createClient(supabaseAdminUrl, supabaseAdminKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });

      // Check if table exists so we can run upsert
      try {
        const { data: terminatedCheck } = await userClient
          .from('user_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_key', `TERMINATED_${session_key}`)
          .maybeSingle();

        if (terminatedCheck) {
          return res.status(403).json({ error: "Session has been terminated", isTerminated: true });
        }

        // Upsert into user_sessions: if session_key exists for this user, update active_at, ip, location.
        // Otherwise insert new row.
        const { data: existing, error: checkError } = await userClient
          .from('user_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_key', session_key)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          const { error: updateError } = await userClient
            .from('user_sessions')
            .update({
              device_name: deviceName,
              ip_address: ip,
              location: location,
              battery_percentage: battery_percentage,
              last_active_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await userClient
            .from('user_sessions')
            .insert({
              user_id: user.id,
              session_key: session_key,
              device_name: deviceName,
              ip_address: ip,
              location: location,
              battery_percentage: battery_percentage,
              created_at: new Date().toISOString(),
              last_active_at: new Date().toISOString()
            });

          if (insertError) throw insertError;
        }

        res.json({ success: true, ip, deviceName, location });
      } catch (dbErr: any) {
        console.warn("[Session Tracking] Table 'user_sessions' might not exist yet or failed:", dbErr.message);
        // Fallback for missing database tables so the client doesn't crash
        res.json({ success: true, fallback: true, message: "Table pending migration", ip, deviceName, location });
      }
    } catch (error: any) {
      console.error("Session Track Error:", error.message);
      res.status(500).json({ error: error.message });
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

  app.get("/api/sessions", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
      }
      
      const token = authHeader.split(' ')[1];
      let authError: any = null;
      let user: any = null;
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (!payload.sub) throw new Error("Missing sub in token");
        user = { id: payload.sub };
      } catch (e: any) {
        authError = e;
      }
      
      if (authError || !user) {
        console.error("Auth validation failed for /api/sessions:", authError);
        return res.status(401).json({ error: "UNAUTHORIZED: Invalid token", details: authError });
      }

      // Create a user-scoped client to satisfy RLS policies (auth.uid() = user_id)
      const userClient = createClient(supabaseAdminUrl, supabaseAdminKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });

      try {
        const { data, error } = await userClient
          .from('user_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('last_active_at', { ascending: false });

        if (error) throw error;

        const enrichedSessions = (data || []).map((s: any) => ({
          ...s,
          last_login_at: user.last_sign_in_at || s.last_active_at || s.created_at
        }));

        res.json({ data: enrichedSessions });
      } catch (dbErr: any) {
        console.warn("[Session Listing] Table 'user_sessions' might not exist yet:", dbErr.message);
        // Fallback gracefully: return a dummy active list representing current browser session
        const userAgent = req.headers['user-agent'] || '';
        const ip = getClientIp(req);
        res.json({
          data: [
            {
              id: "current-dev-fallback",
              user_id: user.id,
              session_key: "current",
              device_name: parseUserAgent(userAgent),
              ip_address: ip,
              location: await getIpLocation(ip),
              created_at: user.created_at || new Date().toISOString(),
              last_active_at: new Date().toISOString(),
              last_login_at: user.last_sign_in_at || new Date().toISOString(),
              is_current: true
            }
          ]
        });
      }
    } catch (error: any) {
      console.error("Session Fetch Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions/terminate", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
      }
      
      const token = authHeader.split(' ')[1];
      let authError: any = null;
      let user: any = null;
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (!payload.sub) throw new Error("Missing sub in token");
        user = { id: payload.sub };
      } catch (e: any) {
        authError = e;
      }
      
      if (authError || !user) {
        return res.status(401).json({ error: "UNAUTHORIZED: Invalid token" });
      }

      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Missing session id to terminate" });
      }

      // Create a user-scoped client to satisfy RLS policies (auth.uid() = user_id)
      const userClient = createClient(supabaseAdminUrl, supabaseAdminKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });

      try {
        const { data: existingSession, error: fetchErr } = await userClient
          .from('user_sessions')
          .select('session_key')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

        if (existingSession && !existingSession.session_key.startsWith('TERMINATED_')) {
          const { error } = await userClient
            .from('user_sessions')
            .update({ session_key: 'TERMINATED_' + existingSession.session_key })
            .eq('id', id)
            .eq('user_id', user.id);

          if (error) throw error;
        }
        res.json({ success: true });
      } catch (dbErr: any) {
        console.warn("[Session Terminated] Table 'user_sessions' update failure:", dbErr.message);
        res.json({ success: true, fallback: true });
      }
    } catch (error: any) {
      console.error("Session Terminate Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sessions/delete", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
      }
      
      const token = authHeader.split(' ')[1];
      let authError: any = null;
      let user: any = null;
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (!payload.sub) throw new Error("Missing sub in token");
        user = { id: payload.sub };
      } catch (e: any) {
        authError = e;
      }
      
      if (authError || !user) {
        return res.status(401).json({ error: "UNAUTHORIZED: Invalid token" });
      }

      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Missing session id to delete" });
      }

      const userClient = createClient(supabaseAdminUrl, supabaseAdminKey, {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      });

      try {
        const { error } = await userClient
          .from('user_sessions')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;
        res.json({ success: true });
      } catch (dbErr: any) {
        console.warn("[Session Delete] Table 'user_sessions' delete failure:", dbErr.message);
        res.json({ success: true, fallback: true });
      }
    } catch (error: any) {
      console.error("Session Delete Error:", error.message);
      res.status(500).json({ error: error.message });
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
  app.post("/api/url-reader", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
      }
      
      const token = authHeader.split(' ')[1];
      let authError: any = null;
      let user: any = null;
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (!payload.sub) throw new Error("Missing sub in token");
        user = { id: payload.sub };
      } catch (e: any) {
        authError = e;
      }
      
      if (authError || !user) {
          return res.status(401).json({ error: "UNAUTHORIZED: Invalid token" });
      }

      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "Missing url parameter" });

      let html = "";
      
      try {
        // Fast path: Axios
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
          timeout: 10000,
        });
        html = response.data;
      } catch (err: any) {
        console.warn(`[URL-Reader] Axios failed (${err.message}), falling back to Puppeteer Stealth for ${url}`);
        // Fallback: Puppeteer Stealth
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
          // Block images/styles to make it fast
          await page.setRequestInterception(true);
          page.on('request', (req: any) => {
              if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
              else req.continue();
          });
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          html = await page.content();
        } finally {
          await page.close();
        }
      }

      const $ = cheerio.load(html);
      $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement').remove();
      
      let contentElement = $('article');
      if (contentElement.length === 0) {
          contentElement = $('main');
      }
      if (contentElement.length === 0) {
          contentElement = $('body');
      }

      const fallbackText = contentElement.text().replace(/\s+/g, ' ').trim();
      res.json({ title: $('title').text() || 'Unknown Title', content: fallbackText });
    } catch (error: any) {
      console.error("URL Reader Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // URL Reader Follow-up (AI) Endpoint
  app.post("/api/url-reader/follow-up", async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.write(`data: ${JSON.stringify({ error: "UNAUTHORIZED: Missing token" })}\n\n`);
          res.end();
          return;
      }
      
      const token = authHeader.split(' ')[1];
      let authError: any = null;
      let user: any = null;
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (!payload.sub) throw new Error("Missing sub in token");
        user = { id: payload.sub };
      } catch (e: any) {
        authError = e;
      }
      
      if (authError || !user) {
          res.write(`data: ${JSON.stringify({ error: "UNAUTHORIZED: Invalid token" })}\n\n`);
          res.end();
          return;
      }

      const { prompt, apiKey: clientApiKey } = req.body;
      if (!prompt) {
         res.write(`data: ${JSON.stringify({ error: "Missing prompt" })}\n\n`);
         res.end();
         return;
      }

      let userSettingsKey = null;
      if (user && user.id) {
          try {
              const { data: usd } = await supabaseAdmin
                  .from('user_settings')
                  .select('api_key')
                  .eq('user_id', user.id)
                  .maybeSingle();
              if (usd?.api_key) {
                  userSettingsKey = usd.api_key;
                  console.log(`[URL Reader Follow-up] Found user_settings api_key for user: ${user.id}`);
              }
          } catch (e: any) {
              console.error("[URL Reader Follow-up] Error loading user_settings api_key:", e.message);
          }
      }

      const apiKey = clientApiKey || userSettingsKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
          res.write(`data: ${JSON.stringify({ error: "Please configure your Gemini API key inside Settings to use this feature." })}\n\n`);
          res.end();
          return;
      }

      let success = false;
      let lastError = null;

      try {
          const ai = new GoogleGenAI({ apiKey });
          
          // Standard stream generator
          const stream = await ai.models.generateContentStream({
              model: 'gemini-2.5-flash',
              contents: prompt,
              config: {
                  tools: [{ googleSearch: {} }],
              }
          });

          for await (const chunk of stream) {
              const chunkText = chunk.text;
              const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c);
              res.write(`data: ${JSON.stringify({ text: chunkText, sources })}` + "\n\n");
          }
          
          success = true;

      } catch (err: any) {
          console.error("[URL Reader Follow-up] Failed:", err.message);
          lastError = err;
      }

      if (!success) {
          res.write(`data: ${JSON.stringify({ error: lastError?.message || "Failed to generate response. Please check your API key." })}\n\n`);
          res.end();
          return;
      }
      
      res.write(`data: [DONE]\n\n`);
      res.end();

    } catch (error: any) {
      console.error("URL Reader Follow-up Error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // Image/File Proxy Endpoint
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing url query parameter" });

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
           return res.status(response.status).json({ error: `Image not found (Status ${response.status})` });
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
             return res.status(404).json({ error: `Image not found via proxy (Status ${response.status})` });
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
              return res.status(404).json({ error: "Image not found via puppeteer" });
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
