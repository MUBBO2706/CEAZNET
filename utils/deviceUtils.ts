import { UAParser } from 'ua-parser-js';

export const getBatteryPercentage = async (): Promise<number | null> => {
    try {
        if ('getBattery' in navigator) {
            const battery: any = await (navigator as any).getBattery();
            return Math.round(battery.level * 100);
        }
    } catch (e) {
        console.warn('Battery API not supported or failed', e);
    }
    return null;
};

export const getExactDeviceName = async (): Promise<string> => {
    if (typeof window === 'undefined') return 'Unknown Node';

    let detectedName = 'Unknown Node';

    // 1. Try modern User-Agent Client Hints API (Best for Chrome/Android)
    if ('userAgentData' in navigator && (navigator as any).userAgentData) {
        try {
            const uaData = await (navigator as any).userAgentData.getHighEntropyValues(['model', 'platform']);
            if (uaData.model) {
                detectedName = uaData.model.toUpperCase();
            } else if (uaData.platform) {
                detectedName = `${uaData.platform} System`.toUpperCase();
            }
        } catch (e) {
            console.warn('Client Hints API error:', e);
        }
    }

    // 2. Fallback to Open Source UAParser for older browsers & iOS
    if (detectedName === 'Unknown Node') {
        try {
            const parser = new UAParser(window.navigator.userAgent);
            const device = parser.getDevice();
            const os = parser.getOS();
            const browser = parser.getBrowser();

            if (device.vendor && device.model) {
                detectedName = `${device.vendor} ${device.model}`;
            } else if (device.vendor) {
                detectedName = `${device.vendor} Device`;
            } else if (os.name) {
                detectedName = `${os.name} System`;
            }

            // Append browser config for extra precision
            if (browser.name) {
                detectedName += ` [${browser.name}]`;
            }
        } catch (err) {
            detectedName = 'Encrypted Node';
        }
    }

    detectedName = detectedName.toUpperCase();

    // 3. Resolve using external device list database via Backend
    try {
      const response = await fetch('/api/device-mapper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: detectedName })
      });
      if (response.ok) {
        const { name } = await response.json();
        if (name) {
           return name.toUpperCase();
        }
      }
    } catch (e) {
      console.warn("Device mapper API failed to resolve:", e);
    }

    const deduplicateWords = (str: string) => {
        const words = str.split(/\s+/);
        const seen = new Set<string>();
        return words.filter(word => {
            const lower = word.toLowerCase();
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
        }).join(' ');
    };

    return deduplicateWords(detectedName);
};

const DEVICE_ID_KEY = "ceaznet_device_id";

// Helper for IndexedDB
const getIndexedDBId = (): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open("CeaznetDB", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("device_info")) {
          db.createObjectStore("device_info");
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction("device_info", "readonly");
        const store = tx.objectStore("device_info");
        const getReq = store.get(DEVICE_ID_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

const setIndexedDBId = (id: string): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open("CeaznetDB", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("device_info")) {
          db.createObjectStore("device_info");
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction("device_info", "readwrite");
        const store = tx.objectStore("device_info");
        store.put(id, DEVICE_ID_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

const generateDeviceFingerprint = async (): Promise<string> => {
  const components = [];
  
  // 1. User Agent (less reliable across app updates, but good base)
  components.push(navigator.userAgent);
  
  // 2. Screen details
  components.push(window.screen.width + "x" + window.screen.height);
  components.push(window.screen.colorDepth);
  
  // 3. Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  // 4. Hardware details
  components.push(navigator.hardwareConcurrency || "unknown");
  components.push((navigator as any).deviceMemory || "unknown");
  
  // 5. Canvas fingerprint (survives incognito)
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Ceaznet Persistent Fingerprint, 😃", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("Ceaznet Persistent Fingerprint, 😃", 4, 17);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    // Ignore canvas errors
  }
  
  // 6. WebGL fingerprint
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push((gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch (e) {
    // Ignore webgl errors
  }
  
  const rawString = components.join("|||");
  
  // Hash the string using SHA-256
  try {
    const msgBuffer = new TextEncoder().encode(rawString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return hashHex.substring(0, 32);
  } catch (e) {
    // Fallback if crypto fails
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
        const char = rawString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16) + Date.now().toString(16);
  }
};

export const getPersistentDeviceId = async (): Promise<string> => {
  // 1. Try LocalStorage
  const localId = localStorage.getItem(DEVICE_ID_KEY);
  if (localId && localId.startsWith("fp_")) {
    setIndexedDBId(localId); // Sync to IDB
    return localId;
  }
  
  // 2. Try IndexedDB Backup
  const idbId = await getIndexedDBId();
  if (idbId && idbId.startsWith("fp_")) {
    localStorage.setItem(DEVICE_ID_KEY, idbId); // Restore to LocalStorage
    return idbId;
  }
  
  // 3. Generate Hardware/Browser Fingerprint (survives incognito/clear data mostly)
  const fingerprintId = await generateDeviceFingerprint();
  const finalId = `fp_${fingerprintId}`;
  
  localStorage.setItem(DEVICE_ID_KEY, finalId);
  await setIndexedDBId(finalId);
  
  return finalId;
};

