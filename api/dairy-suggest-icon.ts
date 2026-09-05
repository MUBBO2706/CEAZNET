import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function trackGeminiKeyUsage(keyId: string, category: string) {
    if (keyId === 'env-fallback') return;
    try {
        await supabaseAdmin.rpc('mark_news_key_used', { key_id: keyId, cat: category });
    } catch (e) {
        console.error("Error tracking Gemini key usage:", e);
    }
}

async function trackGeminiKeyFailure(keyId: string, errorMsg: string) {
    if (keyId === 'env-fallback') return;
    try {
        await supabaseAdmin.rpc('mark_news_key_failed', { key_id: keyId, err_msg: errorMsg, max_failures: 10 });
    } catch (e) {
        console.error("Error tracking Gemini key failure:", e);
    }
}

async function executeWithGeminiRotation<T>(
    category: string,
    operation: (ai: GoogleGenAI) => Promise<T>
): Promise<T> {
    const { data: keys, error: fetchError } = await supabaseAdmin
        .from('news_api_keys')
        .select('id, api_key')
        .eq('provider', 'gemini')
        .eq('status', 'active')
        .order('last_used_at', { ascending: true, nullsFirst: true });

    let keysList = keys ? [...keys] : [];
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
        keysList.push({ id: 'env-fallback', api_key: envKey });
    }

    if (keysList.length === 0) {
        const errorMsg = fetchError ? fetchError.message : "No active Gemini keys found in news_api_keys table or local environment.";
        throw new Error(`[Gemini Rotation] Failed to retrieve keys: ${errorMsg}`);
    }

    let lastError: any = null;

    for (let i = 0; i < keysList.length; i++) {
        const keyConfig = keysList[i];
        try {
            const ai = new GoogleGenAI({ apiKey: keyConfig.api_key });
            const result = await operation(ai);
            await trackGeminiKeyUsage(keyConfig.id, category);
            return result;
        } catch (err: any) {
            console.error(`[Gemini Rotation] Key ${keyConfig.id} failed: ${err.message}`);
            lastError = err;
            await trackGeminiKeyFailure(keyConfig.id, err.message);
        }
    }

    throw lastError || new Error("All Gemini API keys exhausted or failed.");
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { name, existingItems, existingCategories } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: "Missing or invalid name parameter" });
    }

    console.log(`[Dairy AI Icon Vercel] Request received for item name: "${name}"`);

    const resultText = await executeWithGeminiRotation("suggest_dairy_icon", async (ai) => {
      const systemPrompt = `Suggest the single best icon ID for a daily ledger/diary tracker item named "${name}".

Choose ONLY from the following allowed list of icon IDs:
- "milk" (for milk, dairy, dudh, cheese, butter, tiffin, breakfast, dairy products)
- "newspaper" (for newspaper, magazine, journal, akhbar)
- "droplet" (for water, mineral water, bisleri, drinking water, pani, liquid)
- "activity" (for wifi, internet, gym, fitness, health, tracking, speed, network, sports)
- "calendar" (for rent, room rent, kiraya, EMI, monthly subscription, billing, calendar)
- "package" (for groceries, delivery, courier, parcel, order, item, stock, ration, general items, food)
- "tv" (for netflix, cable tv, prime, entertainment, streaming, screen)
- "zap" (for electricity, power bill, electricity bill, bijli, energy, electronics)
- "flame" (for gas cylinder, lpg, gas bill, cylinder, heat, cooking)
- "car" (for petrol, diesel, fuel, car ride, cab, transport, travel, vehicle)
- "bike" (for bike ride, scooter, fuel, delivery bike, motorcycle)
- "heart" (for medicine, doctor, health, yoga, gym, care)
- "coffee" (for tea, chai, coffee, cafe, beverages, bun maska, pav, breakfast, bakery items)
- "apple" (for fruits, vegetables, sabzi, grocery, food, snacks)
- "utensils" (for cook, tiffin service, dinner, lunch, maid, food, restaurant)
- "book" (for tuition fee, classes, book purchase, library, studies, school)
- "scissors" (for saloon, haircut, spa, beauty parlor, grooming)
- "trash" (for garbage disposal, sweep, safai, cleaning service)
- "wrench" (for home repair, maintenance, mechanic, services)
- "shield" (for insurance, security guard, protection)

${existingItems && existingItems.length > 0 ? `Existing daily items already tracked in user's Daily Khata ledger:\n${JSON.stringify(existingItems)}\n` : ''}
${existingCategories && existingCategories.length > 0 ? `Existing transaction categories in user's general account:\n${JSON.stringify(existingCategories)}\n` : ''}

CRITICAL DIRECTIVES:
1. Try to find if any of the existing transaction categories is a perfect fit for "${name}". If a highly specific category already exists (e.g., if "Airtel" is typed and there is an existing "Internet" or "WiFi" category), set "createNewCategory": false, "matchedCategory": "<matching_category_id_or_label>", and "icon": "<that_category_icon>".
2. If NO existing transaction category fits the context of "${name}" well (or is too broad/unrelated), set "createNewCategory": true. Create a concise, professional category name for "suggestedCategoryName" (e.g., "WiFi & Broadband" or "Tuition Fee" or "Trash Disposal") and pick the best aligned icon ID from the allowed list above.
3. Suggest an icon that is consistent with the user's existing items or categories if a similar item exists.
4. Avoid duplicating items/meanings with conflicting icons.
5. Return your response strictly in JSON format matching this structure:
{
  "icon": string,
  "confidence": number,
  "reason": string,
  "createNewCategory": boolean,
  "suggestedCategoryName": string,
  "matchedCategory": string
}
Example: {"icon": "milk", "confidence": 0.95, "reason": "Dudh refers to milk in Hindi", "createNewCategory": false, "suggestedCategoryName": "", "matchedCategory": "Groceries"}`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `${systemPrompt}\n\nCRITICAL DIRECTIVE:\nIf you are confused, uncertain, or encounter any brand name, product, medicine, company, app, or regional Hinglish term (e.g., 'Swiggy', 'Blinkit', 'Zepto', 'Cultfit', 'Fastag', 'Dolo 650', 'Challan', 'Netmeds', 'Zomato', 'Airtel', 'Dudh', 'Kiraya', 'Bun Maska', 'Brun Pav', 'Burun Pav'), USE GOOGLE SEARCH to look up what the product, brand, or service is before selecting the icon!`,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.2,
          }
        });
        return response.text;
      } catch (searchError) {
        console.warn("[Dairy AI Icon Vercel] Failed with Google Search, falling back to standard content generation:", searchError);
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: systemPrompt,
          config: {
            temperature: 0.2,
          }
        });
        return response.text;
      }
    });

    if (resultText) {
      let cleanText = resultText.trim();
      if (cleanText.includes('```')) {
        const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          cleanText = match[1].trim();
        }
      }
      const parsed = JSON.parse(cleanText);
      console.log(`[Dairy AI Icon Vercel] AI response for "${name}":`, parsed);
      return res.json({ 
        success: true, 
        icon: parsed.icon, 
        confidence: parsed.confidence, 
        reason: parsed.reason,
        createNewCategory: !!parsed.createNewCategory,
        suggestedCategoryName: parsed.suggestedCategoryName || "",
        matchedCategory: parsed.matchedCategory || ""
      });
    } else {
      return res.status(500).json({ error: "Empty response from Gemini API" });
    }
  } catch (err: any) {
    console.error("[Dairy AI Icon Vercel] Error during icon suggestion:", err);
    return res.status(500).json({ error: err.message || "Failed to generate icon suggestion" });
  }
}
