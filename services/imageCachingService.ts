import { useState, useEffect } from 'react';

// Client-side in-memory caching to optimize session performance and prevent duplicate network requests
const memoryCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();
const permanentlyFailedImages = new Set<string>();

// Load from LocalStorage if available to permanently cache failed images
const FAILED_IMAGES_KEY = 'ceaznet_failed_images_12';
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(FAILED_IMAGES_KEY);
    if (stored) {
      const urls = JSON.parse(stored);
      if (Array.isArray(urls)) {
        urls.forEach(u => permanentlyFailedImages.add(u));
      }
    }
  } catch (e) {
    console.warn('[Image Cache] Failed to load permanently failed images:', e);
  }
}

function addToPermanentlyFailed(url: string) {
  if (!url || url.startsWith('data:')) return;
  if (!permanentlyFailedImages.has(url)) {
    permanentlyFailedImages.add(url);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(FAILED_IMAGES_KEY, JSON.stringify(Array.from(permanentlyFailedImages)));
        console.log(`[Image Cache] Added image to permanent failed list (exhausted 12 attempts): ${url}`);
      } catch (e) {
        console.warn('[Image Cache] Failed to save permanently failed images:', e);
      }
    }
  }
}

export interface ClientCacheSummary {
  count: number;
  totalSizeBytes: number;
  items: { url: string; timestamp: number; sizeBytes: number }[];
}

export async function getImage(url: string): Promise<string | null> {
  return memoryCache.get(url) || null;
}

export async function saveImage(url: string, dataUrl: string): Promise<void> {
  memoryCache.set(url, dataUrl);
}

export async function saveImages(data: Record<string, string>): Promise<void> {
  for (const [url, dataUrl] of Object.entries(data)) {
    if (dataUrl && dataUrl !== 'failed') {
      memoryCache.set(url, dataUrl);
    }
  }
}

// Unified client-side image proxy fetcher with de-duplication
export async function fetchImageProxy(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  // 1. Check in-memory cache
  if (memoryCache.has(url)) {
    return memoryCache.get(url)!;
  }

  // Check permanently failed list
  if (permanentlyFailedImages.has(url)) {
    return url; // Skip server call entirely and return original URL
  }

  // 2. Check if there's already an active request for this URL
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url)!;
  }

  // 3. Initiate a new de-duplicated request and cache the promise
  const fetchPromise = (async () => {
    try {
      const response = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const json = await response.json();
        if (json.dataUrl === 'failed' || json.failed) {
          if (json.attempts >= 12) {
            addToPermanentlyFailed(url);
          }
          memoryCache.set(url, url);
          return url;
        }
        if (json.dataUrl) {
          const result = json.dataUrl === 'failed' ? url : json.dataUrl;
          memoryCache.set(url, result);
          return result;
        }
      }
      return url; // Fallback to original URL on failure
    } catch (err) {
      console.warn('[Image Cache] Error fetching image proxy:', err);
      return url; // Fallback to original URL on error
    } finally {
      // Clean up the pending request once completed
      pendingRequests.delete(url);
    }
  })();

  pendingRequests.set(url, fetchPromise);
  return fetchPromise;
}

// Warm the server memory cache (Telegram image cache) in batch and populate client cache
export async function batchFetchAndCacheImages(urls: string[]): Promise<void> {
  if (!urls || urls.length === 0) return;

  // Filter out any URLs that are known to be permanently failed
  const filteredUrls = urls.filter(url => !permanentlyFailedImages.has(url));
  if (filteredUrls.length === 0) return;

  try {
    const response = await fetch('/api/image-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls: filteredUrls })
    });
    if (!response.ok) {
      throw new Error(`Batch proxy processing failed: ${response.status}`);
    }
    const json = await response.json();

    // Populate local in-memory cache with pre-fetched images
    if (json.data) {
      for (const [url, dataUrl] of Object.entries(json.data)) {
        if (dataUrl && dataUrl !== 'failed') {
          memoryCache.set(url, dataUrl as string);
        }
      }
    }

    if (json.summary) {
      const istTime = new Date(json.summary.currentTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
      const summaryMsg = `[Image-Proxy] Batch complete. Sent: ${json.summary.totalSent} | Cached: ${json.summary.cachedCount} | Processed: ${json.summary.processedCount} | Failed: ${json.summary.failedCount} (IST: ${istTime})`;
      if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('add-server-log', {
              detail: {
                  type: 'log',
                  message: summaryMsg,
                  timestamp: new Date().toISOString()
              }
          }));
      }
    }
    
    if (json.results && Array.isArray(json.results)) {
      json.results.forEach((res: any) => {
        // Track permanent failure if it failed after 12 attempts
        if (res.status === 'failed' && res.attempts >= 12) {
          addToPermanentlyFailed(res.url);
        }
        let msg = '';
        if (res.status === 'processed') {
           msg = `[Image-Proxy] Successfully resolved image via ${res.source === 'telegram' ? 'Telegram' : 'Direct Origin Fetch'}: ${res.url}`;
        } else if (res.status === 'cached') {
           msg = `[Image-Proxy] Successfully resolved image via Server Cache: ${res.url}`;
        } else {
           msg = `[Image-Proxy] Failed to resolve image: ${res.url} - ${res.error}`;
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('add-server-log', {
                detail: {
                    type: res.status === 'failed' ? 'error' : 'log',
                    message: msg,
                    timestamp: new Date().toISOString()
                }
            }));
        }
      });
    }

  } catch (err) {
    console.warn('[Image Cache] Error warming up server cache:', err);
  }
}

export async function clearClientCache(): Promise<void> {
  memoryCache.clear();
}

export async function deleteClientImage(url: string): Promise<void> {
  memoryCache.delete(url);
}

export async function getClientCacheInfo(): Promise<ClientCacheSummary> {
  let totalSizeBytes = 0;
  const items: any[] = [];
  
  for (const [url, dataUrl] of memoryCache.entries()) {
    const sizeBytes = dataUrl.length * 0.75;
    totalSizeBytes += sizeBytes;
    items.push({
      url,
      timestamp: Date.now(),
      sizeBytes,
    });
  }

  return {
    count: memoryCache.size,
    totalSizeBytes,
    items,
  };
}

export function useCachedImage(originalUrl: string | null): string | null {
  const [imgSrc, setImgSrc] = useState<string | null>(originalUrl);

  useEffect(() => {
    if (!originalUrl) {
      setImgSrc(null);
      return;
    }
    if (originalUrl.startsWith('data:')) {
      setImgSrc(originalUrl);
      return;
    }

    let isMounted = true;
    fetchImageProxy(originalUrl).then((resolvedUrl) => {
      if (isMounted) {
        setImgSrc(resolvedUrl || originalUrl);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [originalUrl]);

  return imgSrc;
}
