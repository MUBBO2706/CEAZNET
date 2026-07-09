import deviceListLib from 'android-device-list';
import { GoogleGenAI } from '@google/genai';
import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadDeviceCacheUnified, saveDeviceCacheUnified, lastDeviceCacheSource } from '../utils/deviceCacheShared.js';

function safeParseGeminiJson(text: string): { brand?: string; name?: string } | null {
  if (!text) return null;
  let cleanText = text.trim();
  
  // Remove markdown code blocks if present
  if (cleanText.includes('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanText = match[1].trim();
    }
  }
  
  try {
    return JSON.parse(cleanText);
  } catch (err) {
    console.warn("Failed to parse Gemini JSON normally, attempting regex extraction. Raw text:", text);
    // Attempt relaxed JSON extraction or manual regex
    const brandMatch = cleanText.match(/"brand"\s*:\s*"([^"]+)"/i);
    const nameMatch = cleanText.match(/"name"\s*:\s*"([^"]+)"/i);
    
    if (brandMatch || nameMatch) {
      return {
        brand: brandMatch ? brandMatch[1] : undefined,
        name: nameMatch ? nameMatch[1] : undefined
      };
    }
  }
  return null;
}

function getEnvValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const regex = new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm');
      const match = content.match(regex);
      if (match && match[1]) {
        const val = match[1].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          return val.substring(1, val.length - 1);
        }
        return val;
      }
    }
  } catch (err) {
    console.error(`Error reading ${key} from .env manually:`, err);
  }
  return undefined;
}

async function executeWithGeminiRotation<T>(
  category: string,
  operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');
  
  const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : new Proxy({}, {
        get: () => {
          throw new Error("SUPABASE_URL and SUPABASE_KEY environment variables are required in production.");
        }
      }) as any;

  // 1. Fetch all active Gemini keys, ordered by last_used_at ASC nulls first to achieve round-robin
  const { data: keys, error: fetchError } = await supabase
    .from('news_api_keys')
    .select('id, api_key')
    .eq('provider', 'gemini')
    .eq('status', 'active')
    .order('last_used_at', { ascending: true, nullsFirst: true });

  let keysList = keys ? [...keys] : [];
  const envKey = getEnvValue('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  if (envKey) {
    keysList.push({ id: 'env-fallback', api_key: envKey });
  }

  if (keysList.length === 0) {
    const errorMsg = fetchError ? fetchError.message : "No active Gemini keys found in news_api_keys table or local environment.";
    throw new Error(`[Gemini Rotation] Failed to retrieve keys: ${errorMsg}`);
  }

  console.log(`[Gemini Rotation] Loaded ${keysList.length} active keys for category "${category}".`);

  let lastError: any = null;

  for (let i = 0; i < keysList.length; i++) {
    const keyConfig = keysList[i];
    console.log(`[Gemini Rotation] Attempting operation with key index ${i} (ID: ${keyConfig.id})`);
    
    try {
      const ai = new GoogleGenAI({ apiKey: keyConfig.api_key });
      const result = await operation(ai);
      
      // Success! Mark key used
      if (keyConfig.id !== 'env-fallback') {
        await supabase.rpc('mark_news_key_used', { key_id: keyConfig.id, cat: category });
      }
      console.log(`[Gemini Rotation] Key ${keyConfig.id} succeeded and tracked as used.`);
      return result;
    } catch (err: any) {
      console.error(`[Gemini Rotation] Key ${keyConfig.id} failed: ${err.message}`);
      lastError = err;
      
      // Track key failure in Supabase (automatic exhaustion handling with max_failures = 10)
      if (keyConfig.id !== 'env-fallback') {
        try {
          await supabase.rpc('mark_news_key_failed', { key_id: keyConfig.id, err_msg: err.message, max_failures: 10 });
        } catch (trackErr: any) {
          console.error(`[Gemini Rotation] Failed to track failure for key ${keyConfig.id}:`, trackErr.message);
        }
      }

      // Log API key audit fallback if there is a next key
      if (i + 1 < keysList.length) {
        const nextKeyConfig = keysList[i + 1];
        console.log(`[Gemini Rotation] Rolling over to next key (ID: ${nextKeyConfig.id}) after failure.`);
        if (keyConfig.id !== 'env-fallback' && nextKeyConfig.id !== 'env-fallback') {
          try {
            await supabase.rpc('log_api_key_audit', {
              failed_id: keyConfig.id,
              fallback_id: nextKeyConfig.id,
              cat: category,
              err: err.message
            });
          } catch (auditErr: any) {
            console.error(`[Gemini Rotation] Failed to log fallback audit:`, auditErr.message);
          }
        }
      }
    }
  }

  // If we reach here, all keys failed
  throw lastError || new Error("All active Gemini keys failed to execute the request.");
}

export default async function handler(req: any, res: any) {
  let action = req.query?.action;
  if (!action && req.url) {
     try {
       const urlObj = new URL(req.url, 'http://localhost');
       action = urlObj.searchParams.get('action');
     } catch(e) {}
  }

  if (action === 'cache_list' && req.method === 'GET') {
    try {
      const data = await loadDeviceCacheUnified();
      return res.status(200).json(data);
    } catch (err: any) {
      console.error("Error reading cache list:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'cache_update' && req.method === 'POST') {
    try {
      const { model, name } = req.body;
      if (!model) return res.status(400).json({ error: "Model parameter is required" });
      const cleanModel = model.toString().trim().toUpperCase();
      const cleanName = name === "" || name === null ? null : name.toString().trim();
      
      const data = await loadDeviceCacheUnified();
      data[cleanModel] = cleanName;
      await saveDeviceCacheUnified(data, { newlyUpdatedCount: 1, newlyUpdatedDevices: [cleanModel] });
      
      return res.status(200).json({ success: true, model: cleanModel, name: cleanName });
    } catch (err: any) {
      console.error("Error adding/updating cache entry:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'cache_delete' && req.method === 'POST') {
    try {
      const { model } = req.body;
      if (!model) return res.status(400).json({ error: "Model parameter is required" });
      const cleanModel = model.toString().trim().toUpperCase();
      
      const data = await loadDeviceCacheUnified();
      let found = false;
      for (const key of Object.keys(data)) {
        if (key.trim().toUpperCase() === cleanModel) {
          delete data[key];
          found = true;
        }
      }
      
      if (found) await saveDeviceCacheUnified(data, { newlyUpdatedCount: 1, newlyUpdatedDevices: [`${cleanModel} (Deleted)`] });
      return res.status(200).json({ success: true, model: cleanModel });
    } catch (err: any) {
      console.error("Error deleting cache entry:", err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { model, skipCache, aiModel } = req.body;
    if (!model) return res.status(400).json({ error: "Model parameter is required" });
    
    const cleanModel = String(model).trim().toUpperCase();
    if (!cleanModel) return res.status(200).json({ name: null, source: "static" });

    if (!skipCache) {
      // Always Try Unified cache (Telegram with local server fallback)
      const cacheData = await loadDeviceCacheUnified();
      if (cleanModel in cacheData) {
        const cachedVal = cacheData[cleanModel];
        return res.status(200).json({ name: cachedVal, source: lastDeviceCacheSource });
      }

      // In some environments, it imports as an object with default, in others it's the module itself.
      const list = ('deviceList' in deviceListLib) 
        ? (deviceListLib as any).deviceList() 
        : (deviceListLib as any).default.deviceList();

      // 3. Try Static Database lookup
      let match = list.find((d: any) => 
        d.model?.toUpperCase() === cleanModel && 
        (d.brand?.trim() || d.name?.trim())
      );
      
      if (!match) {
        match = list.find((d: any) => {
          const dModel = d.model?.toUpperCase();
          const dName = d.name?.toUpperCase();
          
          if (!dModel || dModel.length < 4) return false;
          if (!dName || dName.length < 4) return false;
          if (!d.brand?.trim() && !d.name?.trim()) return false;

          return cleanModel === dModel || cleanModel === dName;
        });
      }

      if (match) {
        const rawName = `${match.brand || ''} ${match.name || ''}`.trim();
        const words = rawName.split(/\s+/);
        const seen = new Set<string>();
        const uniqueWords = words.filter((word: string) => {
          const lower = word.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
        const finalName = uniqueWords.join(' ');
        
        const updatedCache = await loadDeviceCacheUnified();
        updatedCache[cleanModel] = finalName;
        await saveDeviceCacheUnified(updatedCache, { newlyUpdatedCount: 1, newlyUpdatedDevices: [cleanModel] });
        
        return res.status(200).json({ name: finalName, source: "static" });
      }
    }

    // 4. Try Gemini API Resolver with Google Search Grounding capabilities!
    try {
      const response = await executeWithGeminiRotation('device_mapper', async (ai) => {
        const validModels = ['gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
        const chosenModel = (aiModel && validModels.includes(aiModel)) ? aiModel : 'gemini-3.5-flash';
        return await ai.models.generateContent({
          model: chosenModel,
          contents: `Identify this mobile device model code: "${cleanModel}".`,
          config: {
            systemInstruction: `You are a professional device model to marketing name resolver.
Identify the official device brand and marketing model name for the given model code (e.g. "SM-S928U" -> Brand: "Samsung", Name: "Galaxy S24 Ultra"; "CPH2581" -> Brand: "OnePlus", Name: "12"; "GC3VE" -> Brand: "Google", Name: "Pixel 8a"; "M1912G7BI" -> Brand: "Xiaomi", Name: "Redmi Note 8 Pro").
Ensure you distinguish between sub-brands like "Poco", "Redmi", "OnePlus", "Samsung", "Google", "Apple", "iPad", etc.
Ensure the returned brand and name are accurate, realistic marketing names.
You CAN and SHOULD perform a Google Search to lookup specifications or find exact brand/name mappings for newer/unfamiliar model codes.
Provide your response strictly in raw JSON format with fields "brand" and "name" inside a markdown code block. If the device model code is invalid or completely unidentifiable, return null for both fields. Do not add any conversational text. Example:
\`\`\`json
{
  "brand": "Samsung",
  "name": "Galaxy S24 Ultra"
}
\`\`\``,
            tools: [{ googleSearch: {} }]
          }
        });
      });

      const text = response.text?.trim() || "";
      const parsed = safeParseGeminiJson(text);

      const metadata = response?.candidates?.[0]?.groundingMetadata;
      const webQueries = metadata?.webSearchQueries || [];
      const groundingChunks = metadata?.groundingChunks || [];
      const usedSearchTool = !!(webQueries && webQueries.length > 0) || !!(groundingChunks && groundingChunks.length > 0);
      const searchMethod = usedSearchTool ? "google_search" : "internal_knowledge";
      
      const sources = usedSearchTool ? (groundingChunks.map((c: any) => {
        const title = c.web?.title || c.webSource?.title || c.title || '';
        const uri = c.web?.uri || c.webSource?.uri || c.uri || '';
        return { title, uri };
      }).filter((s: any) => s.uri)) : [];

      console.log(`[Device Mapper] Model: ${cleanModel}, usedSearchTool: ${usedSearchTool}, groundingMetadata:`, JSON.stringify(metadata, null, 2));

      if (parsed && (parsed.brand || parsed.name)) {
        const brand = (parsed.brand || "").trim();
        const name = (parsed.name || "").trim();
        let fullName = "";
        if (brand && name) {
          if (name.toUpperCase().startsWith(brand.toUpperCase())) {
            fullName = name;
          } else {
            fullName = `${brand} ${name}`;
          }
        } else {
          fullName = name || brand;
        }

        if (fullName) {
          const words = fullName.split(/\s+/);
          const seen = new Set<string>();
          const uniqueWords = words.filter(word => {
            const lower = word.toLowerCase();
            if (seen.has(lower)) return false;
            seen.add(lower);
            return true;
          });
          const finalName = uniqueWords.join(' ');

          const updatedCache = await loadDeviceCacheUnified();
          updatedCache[cleanModel] = finalName;
          await saveDeviceCacheUnified(updatedCache, { newlyUpdatedCount: 1, newlyUpdatedDevices: [cleanModel] });
          
          return res.status(200).json({ 
            name: finalName, 
            source: "gemini",
            usedSearchTool,
            searchMethod,
            sources
          });
        }
      }
      
      // If parsed response has no brand and no name, it's explicitly identified as an invalid/unidentifiable code by the model.
      // We can safely cache negative match in this specific successful empty resolution scenario.
      const updatedCache = await loadDeviceCacheUnified();
      updatedCache[cleanModel] = null;
      await saveDeviceCacheUnified(updatedCache, { newlyUpdatedCount: 1, newlyUpdatedDevices: [`${cleanModel} (Unknown)`] });
      
      return res.status(200).json({ 
        name: null, 
        source: "gemini",
        usedSearchTool,
        searchMethod,
        sources
      });

    } catch (geminiError: any) {
      console.error("Gemini Device Resolver Error:", geminiError.message);
      let finalErrorMsg = geminiError.message;
      if (finalErrorMsg.includes("leaked")) {
        finalErrorMsg = "The Gemini API key fetched from your Supabase 'news_api_keys' table has been blocked by Google as leaked. Please replace it in the database.";
      }
      // Do NOT cache a negative/null result because the API crashed or was unavailable/503.
      return res.status(200).json({ name: null, source: "gemini", error: finalErrorMsg });
    }
  } catch (e: any) {
    console.error("Device Mapper Error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
