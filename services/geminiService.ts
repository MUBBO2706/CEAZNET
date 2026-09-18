
import { Part, Type } from "@google/genai";
import { getAiClient } from "./aiClient";
import { RouterPlan, ThoughtStep, Note } from "../types";
import { supabaseGroq } from "./supabaseClient"; // Kept for logging

// --- NEW HELPER ---
const getCurrentDateInfo = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const buildPromptWithContext = (prompt: string, images?: { base64: string; mimeType: string; }[], file?: { base64: string; mimeType: string; name: string; }, attachedNote?: Note | null) => {
    const currentDate = getCurrentDateInfo();
    let fullPrompt = `[CURRENT DATE: ${currentDate}]\n\n`;
    
    // Explicitly add Note presence to prompt for Router
    if (attachedNote) {
        fullPrompt += `[ATTACHMENT: A Note titled "${attachedNote.title || 'Untitled'}" is attached. ID: ${attachedNote.id}]\n\n`;
    }

    // Explicitly add Image/File indicators for the Router (so it knows to pick complex tasks)
    if (images && images.length > 0) {
        fullPrompt += `[ATTACHMENT: ${images.length} Image(s) attached. The user wants you to analyze them.]\n\n`;
    }
    if (file) {
        fullPrompt += `[ATTACHMENT: File attached: "${file.name}".]\n\n`;
    }
    
    fullPrompt += `[CURRENT PROMPT]\n${prompt}`;
    
    return fullPrompt.trim() === '' ? ' ' : fullPrompt;
};


// --- System Prompts for Agents (moved from Edge Function) ---

const ROUTER_PROMPT = `You are an AI router. Your job is to analyze the user's prompt and determine the best tool or task to handle it.

### PRIMARY DIRECTIVE: PRIORITIZE WEB SEARCH
- **AGGRESSIVE SEARCH:** Do NOT rely on internal knowledge for facts. If the user asks about a person, company, product, code library, event, or news, you MUST choose 'WEB_SEARCH'.
- **Assume Outdated:** Assume your internal training data is outdated. Only use 'SIMPLE_CHAT' for pure greetings (e.g., "Hi", "How are you") or creative writing without factual constraints.

### PRIMARY DIRECTIVE: VISUAL & FILE ANALYSIS
- If the prompt indicates an **Image** or **File** is attached, you MUST generally choose 'GENERAL_THINKING' to allow for detailed analysis, OR 'WEB_SEARCH' if the user asks to find similar things online.
- Visual analysis is considered a **complex** task.

### PRIMARY DIRECTIVE: TEMPORAL AWARENESS
- **CURRENT DATE:** Refer to the [CURRENT DATE] provided in the prompt.
- If the user asks for "latest", "recent", "new", or specific events, check if they relate to the [CURRENT DATE].

### Task Routing & Logic
You MUST choose a 'task' from this list: ['WEB_SEARCH', 'URL_PRE_PROCESS', 'MOLECULE_PRE_PROCESS', 'CREATOR_INQUIRY', 'CAPABILITIES_INQUIRY', 'GENERAL_THINKING', 'SIMPLE_CHAT'].

**STRICT RULES FOR COMPLEXITY:**
1. **WEB_SEARCH**: Default choice for ANY factual question, technical query, or request for information.
2. **GENERAL_THINKING**: Use this for complex reasoning, planning, multi-step analysis, IMAGE ANALYSIS, or when the answer requires synthesizing multiple pieces of info.
   - **CRITICAL**: If task is 'GENERAL_THINKING', you MUST set 'isComplex' to 'true'.

**Other Tools:**
- 'URL_PRE_PROCESS': ONLY when a URL is provided and the user asks about it.
- 'MOLECULE_PRE_PROCESS': For chemistry, chemical structures, or molecule visualizations.
- 'CREATOR_INQUIRY': ONLY about who created you.
- 'CAPABILITIES_INQUIRY': ONLY about your abilities.
- 'SIMPLE_CHAT': ONLY for "Hi", "Hello", "Thanks".

### Additional Flags
- Set 'needsCodeContext' to 'true' ONLY for prompts related to programming, code, or software development.

Respond ONLY with a valid JSON object: { "task": "...", "isComplex": boolean, "needsCodeContext": boolean }`;

const SEARCH_QUERY_PROMPT = `You are an expert Search Strategist. Your task is to perform a deep analysis of the user's request and formulate a comprehensive search plan.

### CRITICAL: TIME SENSITIVITY
- **CURRENT DATE:** You MUST strictly adhere to the [CURRENT DATE] provided in the prompt.
- **Avoid Outdated References:** Do NOT generate queries with past years (e.g., 2023, 2024) unless the user *explicitly* asks for history.
- **Real-Time:** If the user asks for "latest news", use the current month and year from [CURRENT DATE] in your queries.

### INSTRUCTIONS:
1.  **Generate Search Message:** Create a DETAILED, ANALYTICAL, and SOPHISTICATED first-person narrative (15-30 words) that explains your thought process.
    *   **Goal:** Sound like an advanced AI that is "thinking out loud" about the strategy.
2.  **Generate Queries:** Generate 3-4 distinct, high-quality Google search queries to execute this plan.

Respond ONLY with a valid JSON object: { "searchMessage": "...", "queries": ["query1", "query2", "query3"] }`;

const THOUGHT_GENERATOR_PROMPT = `You are a strategic thinking and visual analysis agent. Your task is to analyze the user's request (including any attached IMAGES or FILES), create a step-by-step plan, AND determine if external information (Web Search) is required.

### 1. VISUAL & FILE ANALYSIS
- If an **Image** is attached: Your first thought steps MUST involve analyzing the image content (e.g., "Phase: Visual Analysis", "Step: Scanning image for identifying features...").
- If a **File** is attached: Your steps should involve reading and processing the file data.

### 2. DECISION: WEB SEARCH?
- **AGGRESSIVE SEARCH POLICY:** You have a very low threshold for searching.
- **ALWAYS SEARCH IF:** The prompt involves specific facts, people, code libraries, documentation, news, prices, or events.
- **IGNORE INTERNAL KNOWLEDGE:** Do not rely on your training data for facts. Assume it is stale.
- **Set Flag:** Set 'requiresWebSearch' to 'true' for almost all queries except pure logic puzzles, creative fiction, or simple greetings.

### 3. PLAN GENERATION (The 'thoughts' array)
Create 3-5 thought steps.
- **Phase:** E.g., 'Visual Analysis', 'Strategy', 'Verification', 'Decision'.
- **Step:** A descriptive sentence of what you are thinking.
- **Concise Step:** 3-5 words summarizing the step.

Respond ONLY with a valid JSON object: 
{ 
  "thoughts": [{ "phase": "...", "step": "...", "concise_step": "..." }, ...],
  "requiresWebSearch": boolean,
  "searchRationale": "..." (optional)
}`;

const URL_EXTRACTOR_PROMPT = `You are a URL extractor. Your task is to find and return the URL from the user's prompt. 
- If the URL is malformed, correct it to the best of your ability. 
Respond ONLY with a valid JSON object: { "extracted_url": "..." }`;

const MOLECULE_PREPROCESSOR_PROMPT = `You are an expert Chemistry AI. Your task is to identify a chemical from a user's request.
- Use your knowledge to identify the correct, common chemical name from various inputs, including: a correct name, a common name, a misspelled name, or a chemical formula.
- **Example:** If the user asks for "C8H10N4O2" or "caffine", you MUST identify it as "Caffeine".
- Respond ONLY with a valid JSON object: { "corrected_molecule_name": "..." }`;


// --- Agent Implementations ---

const getPreprocessorModel = (requestedModel?: string): string => {
    if (requestedModel === 'gemini-2.5-pro') {
        return 'gemini-2.5-flash';
    }
    return requestedModel || 'gemini-2.5-flash';
};

export interface RouterResult {
    plan: RouterPlan;
    usage: { input: number; output: number; };
}

export const routeRequest = async (prompt: string, images?: { base64: string; mimeType: string; }[], file?: { base64: string; mimeType: string; name: string; }, model?: string, attachedNote?: Note | null): Promise<RouterResult> => {
    const ai = getAiClient();
    // Use buildPromptWithContext to notify router about attachments via text
    const fullPrompt = buildPromptWithContext(prompt, images, file, attachedNote);
    const preprocessorModel = getPreprocessorModel(model);

    try {
        const response = await ai.models.generateContent({
            model: preprocessorModel,
            contents: fullPrompt,
            config: {
                systemInstruction: ROUTER_PROMPT,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { task: { type: Type.STRING }, isComplex: { type: Type.BOOLEAN }, needsCodeContext: { type: Type.BOOLEAN } },
                    required: ["task", "isComplex", "needsCodeContext"]
                },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const plan = JSON.parse(response.text.trim());
        const usage = { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 };
        return { plan, usage };
    } catch (error) {
        console.error("Error in routeRequest:", error);
        const fallbackPlan: RouterPlan = { task: 'SIMPLE_CHAT', isComplex: true, needsCodeContext: false };
        return { plan: fallbackPlan, usage: { input: 0, output: 0 } };
    }
};


export interface SearchQueryResult {
    searchMessage: string;
    queries: string[];
    usage: { input: number; output: number; };
}

export const generateSearchQueries = async (prompt: string, model?: string, extraContext?: string): Promise<SearchQueryResult> => {
    const ai = getAiClient();
    let fullPrompt = buildPromptWithContext(prompt);
    
    if (extraContext) {
        fullPrompt += `\n\n[ADDITIONAL CONTEXT FROM THINKING AGENT]\n${extraContext}`;
    }

    const preprocessorModel = getPreprocessorModel(model);
    try {
        const response = await ai.models.generateContent({
            model: preprocessorModel,
            contents: fullPrompt,
            config: {
                systemInstruction: SEARCH_QUERY_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        searchMessage: { type: Type.STRING },
                        queries: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["searchMessage", "queries"]
                },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const data = JSON.parse(response.text.trim());
        const usage = { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 };
        return { ...data, usage };
    } catch (error) {
        console.error("Error in generateSearchQueries:", error);
        return { searchMessage: `Searching for: ${prompt.substring(0, 50)}...`, queries: [prompt], usage: { input: 0, output: 0 } };
    }
};

export interface ThoughtGenerationResult {
    thoughts: ThoughtStep[];
    requiresWebSearch: boolean;
    searchRationale?: string;
    usage: { input: number; output: number; };
}

export const generateThoughts = async (prompt: string, images?: { base64: string; mimeType: string; }[], file?: { base64: string; mimeType: string; name: string; }, model?: string, attachedNote?: Note | null): Promise<ThoughtGenerationResult> => {
    const ai = getAiClient();
    const fullPrompt = buildPromptWithContext(prompt, images, file, attachedNote);
    const preprocessorModel = getPreprocessorModel(model);
    
    try {
        // Construct request parts to actually send images to the Thinking Agent
        const parts: Part[] = [{ text: fullPrompt }];
        
        if (images) {
            images.forEach(img => {
                parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } });
            });
        }
        // Files like PDFs can also be sent via inlineData or text extract, 
        // assuming 'file' here is an image-like blob or text we handle upstream. 
        // For safety, sticking to images for visual analysis here.

        const response = await ai.models.generateContent({
            model: preprocessorModel,
            contents: [{ role: 'user', parts: parts }],
            config: {
                systemInstruction: THOUGHT_GENERATOR_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        thoughts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { phase: { type: Type.STRING }, step: { type: Type.STRING }, concise_step: { type: Type.STRING } },
                                required: ["phase", "step", "concise_step"]
                            }
                        },
                        requiresWebSearch: { type: Type.BOOLEAN },
                        searchRationale: { type: Type.STRING }
                    },
                    required: ["thoughts", "requiresWebSearch"]
                },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const data = JSON.parse(response.text.trim());
        const usage = { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 };
        return { ...data, usage };
    } catch (error) {
        console.error("Error in generateThoughts:", error);
        return { thoughts: [], requiresWebSearch: false, usage: { input: 0, output: 0 } };
    }
};

export interface UrlExtractResult {
    extracted_url: string;
    usage: { input: number; output: number; };
}

export const extractUrlFromRequest = async (prompt: string, model?: string): Promise<UrlExtractResult> => {
    const ai = getAiClient();
    const fullPrompt = buildPromptWithContext(prompt);
    const preprocessorModel = getPreprocessorModel(model);
    try {
         const response = await ai.models.generateContent({
            model: preprocessorModel,
            contents: fullPrompt,
            config: {
                systemInstruction: URL_EXTRACTOR_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        extracted_url: { type: Type.STRING }
                    },
                    required: ["extracted_url"]
                },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const data = JSON.parse(response.text.trim());
        const usage = { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 };
        return { ...data, usage };
    } catch (error) {
        console.error("Error in extractUrlFromRequest:", error);
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const match = prompt.match(urlRegex);
        if (match && match[0]) {
            return { extracted_url: match[0], usage: { input: 0, output: 0 } };
        }
        throw new Error("Failed to extract URL from the prompt.");
    }
};


export interface MoleculePreProcessResult {
    corrected_molecule_name: string;
    usage: { input: number; output: number; };
}

export const preProcessMoleculeRequest = async (prompt: string, model?: string): Promise<MoleculePreProcessResult> => {
    const ai = getAiClient();
    const fullPrompt = buildPromptWithContext(prompt);
    const preprocessorModel = getPreprocessorModel(model);
    try {
        const response = await ai.models.generateContent({
            model: preprocessorModel,
            contents: fullPrompt,
            config: {
                systemInstruction: MOLECULE_PREPROCESSOR_PROMPT,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        corrected_molecule_name: { type: Type.STRING }
                    },
                    required: ["corrected_molecule_name"]
                },
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        const data = JSON.parse(response.text.trim());
        const usage = { input: response.usageMetadata?.promptTokenCount || 0, output: response.usageMetadata?.candidatesTokenCount || 0 };
        return { ...data, usage };
    } catch (error) {
        console.error("Error in preProcessMoleculeRequest:", error);
        throw new Error("Failed to process the molecule request.");
    }
};
