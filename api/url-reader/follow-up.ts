import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseAdminUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
                console.log(`[URL Reader Follow-up Serverless] Found user_settings api_key for user: ${user.id}`);
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

    } catch (err) {
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

  } catch (error) {
    console.error("URL Reader Follow-up Error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}
