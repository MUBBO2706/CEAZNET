
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
        let envKey: string | undefined = undefined;
        try {
            if (typeof process !== 'undefined' && process.env) {
                envKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
            }
        } catch (e) {
            // Ignore process reference error
        }

        // Also check Vite's client-side environment variable support if any
        if (!envKey) {
            try {
                envKey = (import.meta.env as any)?.VITE_GEMINI_API_KEY || (import.meta.env as any)?.VITE_API_KEY;
            } catch {
                // Ignore env check error
            }
        }

        const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
        console.log(`[aiClient] Initializing... environment: ${isProd ? 'production' : 'development'}, key present: ${!!envKey}`);

        if (envKey) {
            aiClient = new GoogleGenAI({ apiKey: envKey });
            return aiClient;
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('request-api-key'));
        }
        throw new Error("AI Client not initialized. Please set your API key.");
    }
    return aiClient;
};
