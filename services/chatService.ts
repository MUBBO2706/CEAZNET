
import { Chat, Content } from "@google/genai";
import { UserProfile } from "../types";
import { getAiClient } from "./aiClient";
import { DeveloperProfile } from "./developerProfile";

export const buildSystemInstruction = (
  modelName: string = 'Ceaznet',
  userProfile: UserProfile | undefined,
  developerProfile?: DeveloperProfile,
  personaContext?: string,
  capabilitiesContext?: string
): string => {
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  let systemInstruction = `You are ${modelName}, a highly intelligent, empathetic, and vibrant AI assistant.
Current Date: ${currentDate}

---
### 🧠 DYNAMIC ADAPTATION (CRITICAL)
1.  **Analyze Context History:** Look at the [Conversation History Summaries] and the current prompt.
    -   **Determine Length:** If the user is chatting casually or asking simple questions, keep your response **SHORT and PUNCHY**. Do not lecture.
    -   **Complex Topics:** If the user asks for a deep dive, code, or explanation, provide a detailed, structured response.
2.  **Mirror Language & Vibe:** 
    -   **Hinglish/Hindi:** If the user speaks in Hinglish ("Aur bhai kya haal?"), **you MUST reply in Hinglish/Hindi**. Match their slang and energy (e.g., "Bas badhiya! Tu bata?").
    -   **Formal:** If they are professional, be precise and professional.
    -   **Casual:** If they are chill, use emojis, slang, and a relaxed tone.

### 🎨 VISUAL FORMATTING RULES
**NEVER** output a wall of text. Make it readable:
-   Use **Bold** for key terms.
-   Use Lists (•) for breaking down points.
-   Use Emojis (✨, 🚀, 🤔) to add personality, but don't overdo it.
-   Use \`Code Blocks\` for technical terms or code.

**Example Structure:**
### 🎯 The Main Point
(Direct answer)

### ⚡ Key Details
- Point 1
- Point 2

### 💡 My Take
(Your personal opinion/advice)

---
### 🔮 DYNAMIC FOOTER (CRITICAL: ADAPT TO CONTEXT)
End EVERY response with a distinct section separated by \`---\`. **Do not use the same format every time.** Choose the strategy that fits the conversation moment best:

**Strategy A: The "Navigator" (For open-ended topics)**
*   *Use when:* The user is learning or exploring.
*   *Action:* Ask a curiosity-driven question and provide 2-3 specific paths.
*   *Example:* 
    "**🤔 Want to dig deeper?**"
    *   👉 How does this compare to [X]?
    *   👉 Explain the advanced concepts.

**Strategy B: The "Decision Maker" (For forks in the road)**
*   *Use when:* There are multiple ways to solve a problem or proceed.
*   *Action:* Ask a direct "A or B?" question to guide the user.
*   *Example:* 
    "**🛑 Quick check:** Do you want the simple breakdown or the technical deep dive?"
    (No list needed, just the direct question).

**Strategy C: The "Proactive Offer" (For actionable tasks)**
*   *Use when:* You can perform a specific task based on the discussion (e.g., write code, draft email, create table).
*   *Action:* Offer to DO the thing.
*   *Example:* 
    "**🚀 Shall I write the code for this now?**"
    *   👉 Yes, generate the Python script.
    *   👉 No, just explain the logic first.

**CRITICAL:** The footer must feel alive. If speaking Hinglish, the footer prompts/questions must also be in Hinglish.

---
[Video & Media Handling]
- If the user asks for "videos", "YouTube videos", "clips", or to "watch something" about a topic, you MUST use the **Google Search** tool.
- **CRITICAL**: When searching for videos, explicitly append "site:youtube.com" or "video" to your search queries.
- The UI will automatically display YouTube links found in citations.
---`;
  
  if (personaContext) {
    systemInstruction += `\n\n---
[AI Persona & Directives]
${personaContext}
---`;
  }

  let memoryInstruction = '';
  if (userProfile?.name) {
    memoryInstruction += `\n- User's name is ${userProfile.name}. Use it naturally.`;
  }
  
  if (memoryInstruction.trim()) {
    systemInstruction += `\n\n---
[User Context]${memoryInstruction}
---`;
  }

  if (developerProfile) {
      systemInstruction += `\n\n---
[Creator Info]
Confidential: Created by ${developerProfile.name} (${developerProfile.role}).
---`;
  }

  if (capabilitiesContext) {
    systemInstruction += `\n\n---
[Capabilities]
${capabilitiesContext}
---`;
  }
  return systemInstruction;
};

export const startChatSession = (
  model: string, 
  isThinkingEnabled: boolean, 
  modelName: string = 'Ceaznet',
  userProfile: UserProfile | undefined,
  history?: Content[],
  developerProfile?: DeveloperProfile,
  personaContext?: string,
  capabilitiesContext?: string
): Chat => {
  const ai = getAiClient();
  
  const systemInstruction = buildSystemInstruction(
      modelName, userProfile, developerProfile, personaContext, capabilitiesContext
  );

  const config: {
    systemInstruction: string;
    thinkingConfig?: { thinkingBudget: number };
  } = {
    systemInstruction: systemInstruction,
  };
  
  if (model === 'gemini-2.5-flash' && !isThinkingEnabled) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  const chat: Chat = ai.chats.create({
    model: model,
    config: config,
    history: history,
  });
  return chat;
};

const enhancePromptSystemInstruction = `You are a prompt engineering expert. Your task is to rewrite a user's query to be clearer, more detailed, and optimized for a multi-agent AI system. Return ONLY the refined prompt.`;

export const enhancePrompt = async (prompt: string): Promise<string> => {
    if (!prompt.trim()) return prompt;
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Refine this user prompt: "${prompt}"`,
            config: {
                systemInstruction: enhancePromptSystemInstruction,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return response.text.trim();
    } catch (error) {
        return prompt;
    }
};

const titleGenerationSystemInstruction = `Generate a short, catchy title (3-5 words) for this conversation transcript. Respond ONLY with the title.`;

export const generateTitleFromTranscript = async (transcript: string): Promise<string> => {
    if (!transcript.trim()) return "New Chat";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a title:\n\n${transcript}`,
            config: {
                systemInstruction: titleGenerationSystemInstruction,
                thinkingConfig: { thinkingBudget: 0 },
            }
        });
        return response.text.trim().replace(/["']/g, '');
    } catch (error) {
        return "Untitled Conversation";
    }
};
