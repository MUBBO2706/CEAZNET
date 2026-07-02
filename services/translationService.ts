
import { getAiClient } from "./aiClient";

const translateSystemInstruction = `You are an expert translator. Your only task is to translate text.
- Detect source language if set to "auto".
- Translate the text to the target language.
- **CRITICAL:** Your response must ONLY be the translated text. No extra words, explanations, or greetings.`;

export const translateText = async (
    text: string,
    targetLang: string,
    sourceLang: string = 'auto'
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: translateSystemInstruction,
            }
        });
        
        const translatedText = response.text.trim();
        const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

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
