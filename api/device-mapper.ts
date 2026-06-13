import deviceListLib from 'android-device-list';
import { GoogleGenAI } from '@google/genai';
import NodeCache from 'node-cache';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { loadDeviceCacheUnified, saveDeviceCacheUnified } from '../src/utils/deviceCacheShared.js';

const localCache = new NodeCache({ stdTTL: 0 });

function safeParseGeminiJson(text: string): { brand?: string; name?: string } | null {
  if (!text) return null;
  let cleanText = text.trim();
  if (cleanText.includes('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanText = match[1].trim();
    }
  }
  try {
    return JSON.parse(cleanText);
  } catch (err) {
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
  } catch (err) { }
  return undefined;
}

async function executeWithGeminiRotation<T>(
  category: string,
  operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
  const supabaseUrl = getEnvValue('VITE_SUPABASE_URL') || getEnvValue('SUPABASE_URL') || 'https://itjurgqbvsqniphuehiz.supabase.co';
  const supabaseKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY') || getEnvValue('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: keys, error: fetchError } = await supabase
    .from('news_api_keys')
    .select('id, api_key')
    .eq('provider', 'gemini')
    .eq('status', 'active')
    .order('last_used_at', { ascending: true, nullsFirst: true });

  if (fetchError || !keys || keys.length === 0) {
    const errorMsg = fetchError ? fetchError.message : "No active Gemini keys found.";
    throw new Error(`[Gemini Rotation] Failed: ${errorMsg}`);
  }

  let lastError: any = null;
  for (let i = 0; i < keys.length; i++) {
    const keyConfig = keys[i];
    try {
      const ai = new GoogleGenAI({ apiKey: keyConfig.api_key });
      const result = await operation(ai);
      await supabase.rpc('mark_news_key_used', { key_id: keyConfig.id, cat: category });
      return result;
    } catch (err: any) {
      lastError = err;
      try {
        await supabase.rpc('mark_news_key_failed', { key_id: keyConfig.id, err_msg: err.message, max_failures: 10 });
      } catch (trackErr: any) {}

      if (i + 1 < keys.length) {
        const nextKeyConfig = keys[i + 1];
        try {
          await supabase.rpc('log_api_key_audit', {
            failed_id: keyConfig.id,
            fallback_id: nextKeyConfig.id,
            cat: category,
            err: err.message
          });
        } catch (auditErr: any) {}
      }
    }
  }
  throw lastError || new Error("All active Gemini keys failed.");
}

export default async function handler(req: any, res: any) {
  const { action } = req.query;

  // --- CACHE LIST ---
  if (action === 'cache' && req.method === 'GET') {
      try {
        const data = await loadDeviceCacheUnified();
        return res.json(data);
      } catch (err: any) {
        console.error("Error reading cache list:", err.message);
        return res.status(500).json({ error: err.message });
      }
  }

  // --- CACHE ADD ---
  else if (action === 'cache' && req.method === 'POST') {
      try {
        const { model, name } = req.body;
        if (!model) return res.status(400).json({ error: "Model parameter is required" });
        const cleanModel = model.toString().trim().toUpperCase();
        const cleanName = name === "" || name === null ? null : name.toString().trim();
        
        const data = await loadDeviceCacheUnified();
        data[cleanModel] = cleanName;
        await saveDeviceCacheUnified(data);
        
        const cacheKey = `device_model_v3_${cleanModel}`;
        localCache.set(cacheKey, cleanName);
        
        return res.json({ success: true, model: cleanModel, name: cleanName });
      } catch (err: any) {
        console.error("Error adding cache entry:", err.message);
        return res.status(500).json({ error: err.message });
      }
  }

  // --- CACHE DELETE ---
  else if (action === 'cache_delete' && req.method === 'POST') {
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
        
        if (found) await saveDeviceCacheUnified(data);
        
        const cacheKey = `device_model_v3_${cleanModel}`;
        localCache.del(cacheKey);
        
        return res.json({ success: true, model: cleanModel });
      } catch (err: any) {
        console.error("Error deleting cache entry:", err.message);
        return res.status(500).json({ error: err.message });
      }
  }

  // --- RESOLVE ---
  else if (req.method === 'POST') {
      try {
        const { model } = req.body;
        if (!model) return res.status(400).json({ error: "Model parameter is required" });
        
        const cleanModel = String(model).trim().toUpperCase();
        if (!cleanModel) return res.status(200).json({ name: null, source: "static" });

        const cacheKey = `device_model_v3_${cleanModel}`;
        
        const cachedMem = localCache.get<string | null>(cacheKey);
        if (cachedMem !== undefined) return res.status(200).json({ name: cachedMem, source: "cache" });

        const cacheData = await loadDeviceCacheUnified();
        if (cleanModel in cacheData) {
          const cachedVal = cacheData[cleanModel];
          localCache.set(cacheKey, cachedVal);
          return res.status(200).json({ name: cachedVal, source: "cache" });
        }

        const list = ('deviceList' in deviceListLib) 
          ? (deviceListLib as any).deviceList() 
          : (deviceListLib as any).default.deviceList();

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
          
          localCache.set(cacheKey, finalName);
          
          const updatedCache = await loadDeviceCacheUnified();
          updatedCache[cleanModel] = finalName;
          await saveDeviceCacheUnified(updatedCache);
          
          return res.status(200).json({ name: finalName, source: "static" });
        }

        try {
          const response = await executeWithGeminiRotation('device_mapper', async (ai) => {
            return await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Identify this mobile device model code: "${cleanModel}".`,
              config: {
                systemInstruction: `You are a professional device model to marketing name resolver.\nIdentify the official device brand and marketing model name for the given model code (e.g. "SM-S928U" -> Brand: "Samsung", Name: "Galaxy S24 Ultra"). Provide strictly in JSON format with fields "brand" and "name".`,
                responseMimeType: "application/json",
                responseSchema: {
                  type: "OBJECT",
                  properties: { brand: { type: "STRING" }, name: { type: "STRING" } },
                  required: ["brand", "name"]
                },
                thinkingConfig: { thinkingBudget: 0 }
              }
            });
          });

          const text = response.text?.trim() || "";
          const parsed = safeParseGeminiJson(text);
          if (parsed && (parsed.brand || parsed.name)) {
            const brand = (parsed.brand || "").trim();
            const name = (parsed.name || "").trim();
            let fullName = "";
            if (brand && name) {
              fullName = name.toUpperCase().startsWith(brand.toUpperCase()) ? name : `${brand} ${name}`;
            } else {
              fullName = name || brand;
            }

            if (fullName) {
              const words = fullName.split(/\s+/);
              const seen = new Set<string>();
              const finalName = words.filter(w => {
                 const l = w.toLowerCase();
                 return seen.has(l) ? false : (seen.add(l), true);
              }).join(' ');

              localCache.set(cacheKey, finalName);
              const updatedCache = await loadDeviceCacheUnified();
              updatedCache[cleanModel] = finalName;
              await saveDeviceCacheUnified(updatedCache);
              
              return res.status(200).json({ name: finalName, source: "gemini" });
            }
          }
          
          localCache.set(cacheKey, null);
          const updatedCache = await loadDeviceCacheUnified();
          updatedCache[cleanModel] = null;
          await saveDeviceCacheUnified(updatedCache);
          
          return res.status(200).json({ name: null, source: "gemini" });

        } catch (geminaError: any) {
          let finalErrorMsg = geminaError.message || "Failed";
          if (finalErrorMsg.includes("leaked")) {
            finalErrorMsg = "Gemini key blocked as leaked.";
          }
          return res.status(200).json({ name: null, source: "gemini", error: finalErrorMsg });
        }
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
