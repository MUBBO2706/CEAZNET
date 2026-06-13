import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const supabaseAdminUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
    }
    
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
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
    } catch (err) {
      console.warn(`[URL-Reader] Axios failed (${err.message}). Puppeteer is unsupported on Vercel.`);
      return res.status(500).json({ error: "Failed to fetch URL content." });
    }

    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement').remove();
    
    // We try to find the main content article if it exists, otherwise use body
    let contentElement = $('article');
    if (contentElement.length === 0) {
        contentElement = $('main');
    }
    if (contentElement.length === 0) {
        contentElement = $('body');
    }

    const fallbackText = contentElement.text().replace(/\s+/g, ' ').trim();
    return res.status(200).json({ title: $('title').text() || 'Unknown Title', content: fallbackText });
  } catch (error) {
    console.error("URL Reader Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
