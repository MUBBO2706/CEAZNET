import axios from 'axios';

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "Missing url query parameter" });

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
         return res.status(response.status).json({ error: `Image not found (Status ${response.status})` });
      }

      if (response.status >= 400) {
         throw new Error(`Request failed with status code ${response.status}`);
      }

      contentType = String(response.headers['content-type'] || 'application/octet-stream');
      base64 = Buffer.from(response.data, 'binary').toString('base64');
      
    } catch (err) {
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

        contentType = String(response.headers['content-type'] || 'application/octet-stream');
        base64 = Buffer.from(response.data, 'binary').toString('base64');
      } catch (wsrvErr) {
        return res.status(404).json({ error: "Image not found via all proxies" });
      }
    }

    const dataUrl = `data:${contentType};base64,${base64}`;
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.status(200).json({ dataUrl });

  } catch (error) {
    console.error("Image Proxy Error:", error.message);
    return res.status(500).json({ error: `Failed to proxy image: ${error.message}` });
  }
}
