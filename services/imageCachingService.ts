import { useState, useEffect } from 'react';

const DB_NAME = 'ImageProxyCacheDB';
const STORE_NAME = 'images';
const DB_VERSION = 1;

interface CachedImage {
  url: string;
  dataUrl: string;
  timestamp: number;
}

// Initialize clean IndexedDB for storing heavy base64 data safely without size limitations (localStorage has 5MB limit)
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Retrieve singular image from Cache if it is under 2 hours (7200000ms) old
export async function getImage(url: string): Promise<string | null> {
  if (!url || typeof url !== 'string' || url.startsWith('data:')) return url;
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);
      request.onsuccess = () => {
        const result = request.result as CachedImage | undefined;
        if (result) {
          const TWO_HOURS = 2 * 60 * 60 * 1000;
          if (Date.now() - result.timestamp < TWO_HOURS) {
            resolve(result.dataUrl);
            return;
          }
        }
        resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.debug('[Image Cache] Read failed, falling back to direct network', err);
    return null;
  }
}

// Save a singular image to cache with timestamp
export async function saveImage(url: string, dataUrl: string): Promise<void> {
  if (!url || !dataUrl) return;
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ url, dataUrl, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Image Cache] Save failed', err);
  }
}

// Bulk save images resolved from batch request
export async function saveImages(data: Record<string, string>): Promise<void> {
  if (!data || Object.keys(data).length === 0) return;
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const timestamp = Date.now();
      Object.entries(data).forEach(([url, dataUrl]) => {
        if (url && dataUrl) {
          store.put({ url, dataUrl, timestamp });
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Image Cache] Bulk save failed', err);
  }
}

// Trigger single API request to retrieve and cache up to 30 images at once
export async function batchFetchAndCacheImages(urls: string[]): Promise<void> {
  if (!urls || urls.length === 0) return;
  try {
    console.log(`[Image Cache] Batch fetching ${urls.length} images from server...`);
    const response = await fetch('/api/image-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls })
    });
    if (!response.ok) {
      throw new Error(`Batch proxy fetch failed: ${response.status}`);
    }
    const json = await response.json();
    if (json.data && Object.keys(json.data).length > 0) {
      await saveImages(json.data);
      console.log(`[Image Cache] Successfully batched and cached ${Object.keys(json.data).length} images for 2 hours!`);
    }
  } catch (err) {
    console.warn('[Image Cache] Error during batch image resolve:', err);
  }
}

// React Hook to transparently resolve image locally via IndexDB cache or fallback to raw network source
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
    getImage(originalUrl).then((cached) => {
      if (isMounted) {
        if (cached) {
          setImgSrc(cached);
        } else {
          // Fallback to image-proxy endpoint which resolves from Telegram/server cache seamlessly
          setImgSrc(`/api/image-proxy?url=${encodeURIComponent(originalUrl)}`);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [originalUrl]);

  return imgSrc;
}
