
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export const initializeAiClient = (apiKey: string) => {
    if (!apiKey) {
        throw new Error("API key is required to initialize the AI client.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey });
};

export const getAiClient = (): GoogleGenAI => {
    if (!aiClient) {
        const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        console.log(`[aiClient] Initializing... environment: ${process.env.NODE_ENV}, key present: ${!!envKey}, key length: ${envKey ? envKey.length : 0}`);
        if (envKey) {
            aiClient = new GoogleGenAI({ apiKey: envKey });
            return aiClient;
        }
        window.dispatchEvent(new CustomEvent('request-api-key'));
        throw new Error("AI Client not initialized. Please set your API key.");
    }
    return aiClient;
};
