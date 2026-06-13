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

