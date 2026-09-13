import { getAiClient } from './aiClient';
import type { User } from '@supabase/supabase-js';

export const enhanceDescriptionWithAi = async (
    userDescription: string,
    amount: string,
    type: 'expense' | 'income' | 'transfer',
    category: string,
    paymentMethod: string,
    user: User | null = null
): Promise<string> => {
    const ai = getAiClient();

    const cleanDesc = (userDescription || '').trim();
    const cleanAmount = (amount || '').trim();

    const prompt = `You are an intelligent financial ledger assistant. Your job is to transform rough notes or shorthand input into natural, human-written, clear, and contextually detailed transaction descriptions for a personal finance tracker.

CRITICAL INSTRUCTIONS TO AVOID ROBOTIC OUTPUT:
1. NEVER start every sentence with repetitive boilerplate like "Paid to {amount}" or "Paid ₹X for". Vary your sentence starters naturally based on the action!
2. Use natural human phrasing, such as:
   - "Filled the bike's tank with petrol at Momin petrol pump."
   - "Purchased pav from Shopping Center for office lunch."
   - "Tea from B1 Canteen beside Rupa Solitaire."
   - "Paid to Mudabbir for birthday gift."
   - "Given Sadaqah."
   - "Rickshaw fare from Ghansoli Station to MBP."
   - "Received ₹2,400 in borrowed money from Roman; amount is now settled."
   - "Paid for bike's side mirror from garage in front of Kausa Petrol Pump."
   - "Renewed bike insurance for ₹784."
3. DO NOT artificially inject "Paid to {amount}" at the beginning. Include amounts (e.g. ₹100 or ₹2,400) only when relevant or natural for settlements/reimbursements/fees.
4. Keep all specific names (e.g., Mudabbir, Roman, Sanchita, Sameer, Abba, Mamu), locations (e.g., MBP, Mumbra, Ghansoli, Khau Galli, Thane, Vashi), shop names (e.g., Lalit Dairy, Patte Ki Dukan, Jhim Jhim Hotel, Akhlaq General Store), and specific items intact.
5. If the input is minimal (e.g. "sadaqah"), keep it minimal (e.g. "Given Sadaqah." or "Sadaqah.").

TRANSACTION CONTEXT:
- User Shorthand Input: "${cleanDesc || '(None provided)'}"
- Amount: "${cleanAmount ? `₹${cleanAmount}` : '(None provided)'}"
- Type: "${type}"
- Category: "${category || '(None provided)'}"
- Payment Mode: "${paymentMethod || '(None provided)'}"

EXAMPLES OF PREFERRED NATURAL DESCRIPTIONS:
- Input: "momin petrol pump bike tank" -> "Filled the bike's tank with petrol at Momin petrol pump."
- Input: "pav shopping center lunch" -> "Purchased pav from Shopping Center Mumbra Devi Road for office lunch."
- Input: "mudabbir birthday gift 100" -> "Paid to Mudabbir for birthday gift."
- Input: "sadaqah" -> "Given Sadaqah."
- Input: "chai b1 canteen rupa solitair" -> "Tea from B1 Canteen beside Rupa Solitaire."
- Input: "kausa garage side mirror" -> "Paid for bike's one side mirror from garage in front of Kausa Petrol Pump."
- Input: "bus fare roman and me" -> "Paid for bus fare for Roman and me."
- Input: "rickshaw ghansoli to mbp" -> "Rickshaw fare from Ghansoli Station to MBP."
- Input: "bike insurance 784" -> "Renewed bike insurance for ₹784."
- Input: "lalit dairy milk breakfast" -> "Purchased milk from Lalit Dairy store for breakfast."
- Input: "patte ki dukan stationery project" -> "Paid for project paper, pen, pencil and eraser set from Patte Ki Dukan stationery shop in Jeevan Baug."

Return ONLY the refined description text. Do NOT wrap in quotes, do NOT add introductory text.`;

    try {
        let responseText = '';
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.3,
                },
            });
            responseText = response.text || '';
        } catch (searchError) {
            console.warn("Failed to generate enhanced description with Google Search, falling back to standard generation:", searchError);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.3,
                },
            });
            responseText = response.text || '';
        }

        let cleanText = responseText.trim();
        // Strip any wrapping quotes that the AI might have accidentally added
        if (cleanText.startsWith('"') && cleanText.endsWith('"')) {
            cleanText = cleanText.substring(1, cleanText.length - 1).trim();
        } else if (cleanText.startsWith("'") && cleanText.endsWith("'")) {
            cleanText = cleanText.substring(1, cleanText.length - 1).trim();
        }

        return cleanText || userDescription;
    } catch (e) {
        console.error("Failed to enhance description with Gemini:", e);
        return userDescription; // fallback to original input on failure
    }
};
