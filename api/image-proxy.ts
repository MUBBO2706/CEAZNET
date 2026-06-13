import axios from 'axios';

// In-memory cache for resolved Base64 image URLs and in-flight fetches to prevent costly redundant egress.
const imageCache = new Map<string, { dataUrl: string; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<{ success: boolean; dataUrl?: string; status?: number; error?: string }>>();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours memory cache duration (specified in user request)

async function resolveSingleUrl(url: string): Promise<string> {
  const cached = imageCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.dataUrl;
  }

  // Coalesce concurrent redundant requests if already in-flight
  if (inFlightRequests.has(url)) {
    const result = await inFlightRequests.get(url)!;
    if (result.success && result.dataUrl) {
      return result.dataUrl;
    } else {
      throw new Error(result.error || "Failed to fetch image via in-flight coalescence");
    }
  }

  const fetchPromise = (async () => {
    let base64 = "";
    let contentType = "application/octet-stream";

    try {
      // Fast path: Axios
      const urlObj = new URL(url);
      const response = await axios.get(url, {
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
         return { success: false, status: response.status, error: `Image not found (Status ${response.status})` };
      }

      if (response.status >= 400) {
         throw new Error(`Request failed with status code ${response.status}`);
      }

      contentType = String(response.headers['content-type'] || 'application/octet-stream');
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
           return { success: false, status: 404, error: `Image not found via proxy (Status ${response.status})` };
        }
        if (response.status >= 400) {
           throw new Error(`Request failed with status code ${response.status}`);
        }

        contentType = String(response.headers['content-type'] || 'application/octet-stream');
        base64 = Buffer.from(response.data, 'binary').toString('base64');
      } catch (wsrvErr) {
        return { success: false, status: 404, error: "Image not found via all proxies" };
      }
    }

    const dataUrl = `data:${contentType};base64,${base64}`;
    imageCache.set(url, { dataUrl, timestamp: Date.now() });
    return { success: true, dataUrl };
  })();

  inFlightRequests.set(url, fetchPromise);

  try {
    const result = await fetchPromise;
    if (result.success && result.dataUrl) {
      return result.dataUrl;
    } else {
      throw new Error(result.error || 'Failed to resolve image url');
    }
  } finally {
    inFlightRequests.delete(url);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: "Missing or invalid urls array parameter" });
      }

      const results: Record<string, string> = {};
      const fetchPromises = urls.map(async (url) => {
        if (!url || typeof url !== 'string') return;
        try {
          const dataUrl = await resolveSingleUrl(url);
          results[url] = dataUrl;
        } catch (e: any) {
          console.warn(`[Image-Proxy] Batch fetch failed for ${url}: ${e.message}`);
        }
      });

      await Promise.all(fetchPromises);
      return res.status(200).json({ data: results });
    }

    // Default to GET behavior (single URL)
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing url query parameter" });

    const dataUrl = await resolveSingleUrl(url);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.status(200).json({ dataUrl });

  } catch (error: any) {
    console.error("Image Proxy Error:", error.message);
    return res.status(500).json({ error: `Failed to proxy image: ${error.message}` });
  }
}
