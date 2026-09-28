
import { getAiClient } from "./aiClient";

const translateSystemInstruction = `You are an expert translator. Your only task is to translate text.
- Detect source language if set to "auto".
- Translate the text to the target language.
- **CRITICAL:** Your response must ONLY be the translated text. No extra words, explanations, or greetings.`;

export const translateText = async (
    text: string,
    targetLang: string,
    sourceLang: string = 'auto',
    model: string = 'gemini-3.8-flash'
): Promise<{ translatedText: string, inputTokens: number, outputTokens: number }> => {
    if (!text.trim()) return { translatedText: '', inputTokens: 0, outputTokens: 0 };
    
    let prompt: string;
    if (sourceLang === 'auto' || sourceLang === 'Auto Detect') {
        prompt = `Detect the language of the following text and translate it to ${targetLang}:\n\n"${text}"`;
    } else {
        prompt = `Translate the following text from ${sourceLang} to ${targetLang}:\n\n"${text}"`;
    }

    try {
        const ai = getAiClient();
        const selectedModel = model || 'gemini-3.8-flash';

        // Single generation call: no separate countTokens request needed
        const response = await ai.models.generateContent({
            model: selectedModel,
            contents: prompt,
            config: {
                systemInstruction: translateSystemInstruction,
            }
        });
        
        const translatedText = response.text ? response.text.trim() : '';
        const totalPromptTokens = response.usageMetadata?.promptTokenCount ?? 0;

        // Base prompt overhead (system instructions + prompt template) is ~76 tokens
        // Subtracting this base overhead gives the exact token count of the user's input text in a single request.
        const baseTemplateOverhead = 76;
        const inputTokens = totalPromptTokens > baseTemplateOverhead 
            ? totalPromptTokens - baseTemplateOverhead 
            : Math.max(1, Math.ceil(text.trim().length / 4));
            
        const outputTokens = response.usageMetadata?.candidatesTokenCount ?? Math.max(1, Math.ceil(translatedText.length / 4));

        return { translatedText, inputTokens, outputTokens };
    } catch (error) {
        console.error("Error translating text:", error);
        let errorMessage = "Error: Could not translate.";
        if (error instanceof Error) {
            errorMessage = `Error: Could not translate. ${error.message}`;
        }
        return { translatedText: errorMessage, inputTokens: 0, outputTokens: 0 };
    }
};
