import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

const supabaseAdminUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { action } = req.query;

  // --- FOLLOW-UP ---
  if (action === 'follow_up') {
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
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        
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
                }
            } catch (e: any) {
                console.error("[URL Reader Follow-up Serverless] Error loading user_settings api_key:", e.message);
            }
        }

        const apiKey = clientApiKey || userSettingsKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            res.write(`data: ${JSON.stringify({ error: "Please configure your Gemini API key in the Settings to use this feature." })}\n\n`);
            res.end();
            return;
        }

        let success = false;
        let lastError = null;

        try {
            const ai = new GoogleGenAI({ apiKey });
            
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
                
                const eventData = {
                    text: chunkText,
                    sources: sources
                };
                res.write(`data: ${JSON.stringify(eventData)}\n\n`);
            }
            
            success = true;

        } catch (err: any) {
            lastError = err;
            console.warn(`[URL Reader AI] User ${user.id} API key failed:`, err.message);
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
      return;
  }
  
  // --- DEFAULT READ ---
  else {
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
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
            timeout: 10000,
          });
          html = response.data;
        } catch (err: any) {
          console.warn(`[URL-Reader] Axios failed (${err.message}).`);
          return res.status(500).json({ error: "Failed to fetch URL content." });
        }

        const $ = cheerio.load(html);
        $('script, style, nav, footer, header, aside, .ad, .ads, .advertisement').remove();
        
        let contentElement = $('article');
        if (contentElement.length === 0) contentElement = $('main');
        if (contentElement.length === 0) contentElement = $('body');

        const fallbackText = contentElement.text().replace(/\s+/g, ' ').trim();
        return res.status(200).json({ title: $('title').text() || 'Unknown Title', content: fallbackText });
      } catch (error: any) {
        console.error("URL Reader Error:", error.message);
        return res.status(500).json({ error: error.message });
      }
  }
}
