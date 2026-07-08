import axios from 'axios';
import { loadImageCacheUnified, saveImageCacheUnified, lastImageCacheSource } from '../utils/deviceCacheShared.js';

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours memory cache duration

const inFlightRequests = new Map<string, Promise<{ success: boolean; dataUrl?: string; status?: number; error?: string }>>();

interface ImageResolutionResult {
  dataUrl?: string;
  status: 'cached' | 'processed' | 'failed';
  attempts: number;
  cachedUntil: string | null;
  timeLeftMinutes: number | null;
  error?: string;
}

let isPruningCache = false;

async function getValidImageCache() {
  const cache = await loadImageCacheUnified();
  const now = Date.now();
  let changed = false;

  for (const url of Object.keys(cache)) {
    if (url === '__stats__') continue;
    if (now - cache[url].timestamp >= CACHE_TTL) {
      delete cache[url];
      changed = true;
    }
  }
  
  if (changed && !isPruningCache) {
    isPruningCache = true;
    saveImageCacheUnified(cache, { totalSent: 0, processedCount: 0, cachedCount: Object.keys(cache).filter(k => k !== '__stats__').length, failedCount: 0 })
      .catch(console.error)
      .finally(() => {
        isPruningCache = false;
      });
  }

  return cache;
}

async function resolveImageUrlDetailed(url: string, imageCache: Record<string, { dataUrl: string; timestamp: number; failed?: boolean; unsaved?: boolean }>, skipSave: boolean = false): Promise<ImageResolutionResult> {
  const cached = imageCache[url];
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
    if (cached.failed) {
      // Cache failure for 2 hours to prevent repeated attempts
      if (elapsed < CACHE_TTL) {
        return {
          status: 'failed',
          attempts: 0,
          cachedUntil: new Date(cached.timestamp + CACHE_TTL).toISOString(),
          timeLeftMinutes: (CACHE_TTL - elapsed) / (60 * 1000),
          error: "Image marked as failed (cached failure)"
        };
      } else {
        delete imageCache[url];
      }
    } else {
      if (elapsed < CACHE_TTL) {
        const remainingMs = CACHE_TTL - elapsed;
        return {
          dataUrl: cached.dataUrl,
          status: 'cached',
          attempts: 0,
          cachedUntil: new Date(cached.timestamp + CACHE_TTL).toISOString(),
          timeLeftMinutes: remainingMs / (60 * 1000)
        };
      } else {
        delete imageCache[url];
      }
    }
  }

  let base64 = "";
  let contentType = "application/octet-stream";
  let attempts = 0;
  let finalError = "";

  // Attempt 1: Direct Axios
  attempts++;
  try {
    const urlObj = new URL(url);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
         'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
         'Accept-Language': 'en-US,en;q=0.9',
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
       throw new Error(`Image not found (Status ${response.status})`);
    }

    if (response.status >= 400) {
       throw new Error(`Request failed with status code ${response.status}`);
    }

    contentType = String(response.headers['content-type'] || 'application/octet-stream');
    base64 = Buffer.from(response.data, 'binary').toString('base64');
    
  } catch (err: any) {
    finalError = err.message;
    
    // Attempt 2: wsrv.nl Proxy
    attempts++;
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

      contentType = String(response.headers['content-type'] || 'application/octet-stream');
      base64 = Buffer.from(response.data, 'binary').toString('base64');
    } catch (wsrvErr: any) {
      finalError = wsrvErr.message;
      const cachedErrorMsg = finalError || "Image not found via all proxies";
      // Cache this failure so we don't hammer it again
      imageCache[url] = { dataUrl: "failed", timestamp: Date.now(), failed: true, error: cachedErrorMsg, unsaved: !skipSave } as any;
      return {
        status: 'failed',
        attempts,
        cachedUntil: null,
        timeLeftMinutes: null,
        error: cachedErrorMsg
      };
    }
  }

  if (base64) {
    const dataUrl = `data:${contentType};base64,${base64}`;
    const now = Date.now();
    imageCache[url] = { dataUrl, timestamp: now, unsaved: !skipSave };
    if (!skipSave) {
      await saveImageCacheUnified(imageCache, {
        totalSent: 1,
        processedCount: 1,
        cachedCount: 0,
        failedCount: 0
      }).catch(err => console.error('[Image Cache] Error saving single image cache:', err));
    }
    return {
      dataUrl,
      status: 'processed',
      attempts,
      cachedUntil: new Date(now + CACHE_TTL).toISOString(),
      timeLeftMinutes: CACHE_TTL / (60 * 1000)
    };
  }

  const defaultErrorMsg = finalError || "Unknown resolution failure";
  const isPermanent = attempts >= 12;
  imageCache[url] = { 
    dataUrl: "failed", 
    timestamp: Date.now(), 
    failed: true, 
    error: defaultErrorMsg, 
    unsaved: !skipSave,
    permanentlyFailed: isPermanent
  } as any;
  return {
    status: 'failed',
    attempts,
    cachedUntil: isPermanent ? "indefinite" : null,
    timeLeftMinutes: null,
    error: defaultErrorMsg
  };
}

async function resolveSingleUrl(url: string, imageCache: Record<string, { dataUrl: string; timestamp: number; failed?: boolean; unsaved?: boolean }>): Promise<any> {
  // Pass skipSave=true to prevent Telegram spam when individual images are requested concurrently
  const result = await resolveImageUrlDetailed(url, imageCache, true);
  if (result.status !== 'failed' && result.dataUrl) {
    return { dataUrl: result.dataUrl };
  }
  return { dataUrl: "failed", failed: true, error: result.error, attempts: result.attempts };
}

export default async function handler(req, res) {
  try {
    const urlPath = req.url || '';
    const queryAction = req.query?.action;
    const isStatus = urlPath.includes('image-cache-status') || queryAction === 'status';
    const isClear = urlPath.includes('image-cache-clear') || queryAction === 'clear';
    const isDelete = urlPath.includes('image-cache-delete') || queryAction === 'delete';

    const imageCache = await getValidImageCache();

    if (isStatus) {
      const items: any[] = [];
      let totalSizeCharacters = 0;
      const now = Date.now();
      
      const stats = (imageCache as any)['__stats__'] || {
        totalSent: 0,
        processedCount: 0,
        cachedCount: 0,
        failedCount: 0
      };

      const keys = Object.keys(imageCache).filter(k => k !== '__stats__');
      for (const url of keys) {
        const value = imageCache[url];
        const elapsed = now - value.timestamp;
        const remainingMs = CACHE_TTL - elapsed;
        const isExpired = elapsed >= CACHE_TTL;
        const sizeChars = value.dataUrl.length || 0;
        totalSizeCharacters += sizeChars;

        items.push({
          url,
          timestamp: value.timestamp,
          isExpired,
          timeLeftMinutes: isExpired ? 0 : remainingMs / (60 * 1000),
          sizeBytes: Math.round(sizeChars * 0.75)
        });
      }

      return res.status(200).json({
        count: keys.length,
        totalSizeBytes: Math.round(totalSizeCharacters * 0.75),
        ttlMs: CACHE_TTL,
        stats,
        items
      });
    }

    if (isClear) {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
      }
      const keys = Object.keys(imageCache);
      const count = keys.length;
      for (const key of keys) {
        delete imageCache[key];
      }
      await saveImageCacheUnified(imageCache, { totalSent: 0, processedCount: 0, cachedCount: 0, failedCount: 0 });
      console.log(`[Image Cache] Server cache explicitly cleared. Removed ${count} items.`);
      return res.status(200).json({ success: true, clearedCount: count });
    }

    if (isDelete) {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
      }
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "Missing or invalid url parameter" });
      }
      const existed = !!imageCache[url];
      if (existed) {
        delete imageCache[url];
        await saveImageCacheUnified(imageCache, { totalSent: 0, processedCount: 0, cachedCount: Object.keys(imageCache).length, failedCount: 0 });
        console.log(`[Image Cache] Server cache item deleted: ${url}`);
      }
      return res.status(200).json({ success: true, removed: existed });
    }

    if (req.method === 'POST') {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: "Missing or invalid urls array parameter" });
      }

      const resultsData: Record<string, string> = {};
      const individualResults: any[] = [];
      let processedCount = 0;
      let failedCount = 0;
      let cachedCount = 0;
      let needsSave = false;

      // Filter out empty/invalid URLs first
      const validUrls = urls.filter((url): url is string => !!url && typeof url === 'string');

      // Process in chunks of 8 to avoid overloading the network and causing timeouts
      const CHUNK_SIZE = 8;
      console.log(`[Image-Proxy] Starting batch image resolution for ${validUrls.length} URLs...`);
      for (let i = 0; i < validUrls.length; i += CHUNK_SIZE) {
        const chunk = validUrls.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (url) => {
          try {
            const detail = await resolveImageUrlDetailed(url, imageCache, true);
            const isFirstTime = detail.status === 'processed';
            
            if (detail.status === 'cached') {
              cachedCount++;
              console.log(`[Image-Proxy] Successfully resolved image via Server Cache: ${url}`);
            } else if (detail.status === 'processed') {
              processedCount++;
              needsSave = true;
              console.log(`[Image-Proxy] Successfully resolved image via Direct Origin Fetch: ${url}`);
            } else {
              failedCount++;
              console.log(`[Image-Proxy] Failed to resolve image: ${url} - ${detail.error}`);
              if (detail.attempts > 0) {
                needsSave = true;
              }
            }

            if (detail.status === 'failed') {
              resultsData[url] = "failed";
            } else if (detail.dataUrl) {
              resultsData[url] = detail.dataUrl;
            }

            individualResults.push({
              url,
              status: detail.status,
              isFirstTimeCached: isFirstTime,
              source: isFirstTime ? 'new-origin-fetch' : lastImageCacheSource,
              attempts: detail.attempts,
              cachedUntil: detail.cachedUntil,
              timeLeftMinutes: detail.timeLeftMinutes,
              error: detail.error
            });
          } catch (e: any) {
            failedCount++;
            resultsData[url] = "failed";
            individualResults.push({
              url,
              status: 'failed',
              isFirstTimeCached: false,
              source: 'failed',
              attempts: 1,
              cachedUntil: null,
              timeLeftMinutes: null,
              error: e.message
            });
          }
        }));
      }

      if (needsSave || processedCount > 0) {
        try {
          await saveImageCacheUnified(imageCache, {
            totalSent: urls.length,
            processedCount,
            cachedCount,
            failedCount
          });
        } catch (e: any) {
          console.error('[Image Proxy] Failed to save image cache to Telegram:', e.message || e);
        }
      }

      const summary = {
        totalSent: urls.length,
        processedCount,
        failedCount,
        cachedCount,
        currentTime: new Date().toISOString()
      };

      console.log("=== SERVER BATCH IMAGE CACHING COMPLETED ===");
      console.log(`Sent: ${summary.totalSent} | Cached Already: ${summary.cachedCount} | Newly Processed: ${summary.processedCount} | Failed: ${summary.failedCount}`);
      console.log("============================================");

      return res.status(200).json({
        data: resultsData,
        summary,
        results: individualResults
      });
    }

    // Default to GET behavior (single URL)
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing url query parameter" });

    const result = await resolveSingleUrl(url, imageCache);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.status(200).json(result);

  } catch (error: any) {
    console.error("Image Proxy Error:", error.message);
    return res.status(500).json({ error: `Failed to proxy image: ${error.message}` });
  }
}
