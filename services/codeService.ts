import { Content, Type } from "@google/genai";
import { getAiClient } from "./aiClient";

interface TokenUsage {
    input: number;
    output: number;
}

export const processAndSaveCode = async (
    codeBlock: { language: string; code: string; },
    context: Content[]
): Promise<{ description: string, usage: TokenUsage }> => {
    const ai = getAiClient();
    const systemInstruction = `Analyze the code block and conversation context. Create a one-sentence description of the code's function for future retrieval. Respond ONLY with this JSON: { "description": "Your one-sentence description." }`;
    
    const contextText = context.map(h => `${h.role}: ${h.parts.map(p => (p as any).text || '').join(' ')}`).join('\n');
    const prompt = `CONVERSATION CONTEXT:\n${contextText}\n\nCODE BLOCK (language: ${codeBlock.language}):\n\`\`\`\n${codeBlock.code}\n\`\`\``;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING }
                    },
                    required: ["description"]
                },
            }
        });
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        const usage = {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0,
        };
        return { description: result.description, usage };
    } catch (error) {
        console.error("Error processing code:", error);
        return { 
            description: `A ${codeBlock.language} code snippet.`,
            usage: { input: 0, output: 0 }
        };
    }
};

export const findRelevantCode = async (
    prompt: string,
    codeSnippets: { id: string; description: string }[]
): Promise<{ relevantIds: string[], usage: TokenUsage }> => {
    const ai = getAiClient();
    const systemInstruction = `Find relevant code. Based on the user prompt, identify the most relevant code snippet IDs. Respond ONLY with this JSON: { "relevant_ids": ["id1", "id2", ...] }`;
    
    const snippetsText = codeSnippets.map(s => `ID: ${s.id}, Description: ${s.description}`).join('\n');
    const fullPrompt = `USER PROMPT:\n"${prompt}"\n\nAVAILABLE CODE SNIPPETS:\n${snippetsText}\n\nIdentify the relevant snippet IDs.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        relevant_ids: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["relevant_ids"]
                },
            }
        });
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        const usage = {
            input: response.usageMetadata?.promptTokenCount || 0,
            output: response.usageMetadata?.candidatesTokenCount || 0,
        };
        return { relevantIds: result.relevant_ids || [], usage };
    } catch (error) {
        console.error("Error finding relevant code:", error);
        return { relevantIds: [], usage: { input: 0, output: 0 } };
    }
};