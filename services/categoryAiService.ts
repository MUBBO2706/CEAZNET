import { getAiClient } from './aiClient';
import { CATEGORY_CONFIG, LUCIDE_ICON_MAP, AVAILABLE_ICON_NAMES } from '../components/finance/categories';
import { getCustomCategories, CustomCategoryItem, getDairyItems } from './dbService';
import type { User } from '@supabase/supabase-js';

export interface AiIconSuggestion {
    iconName: string;
    reason: string;
    categoryName: string;
    categoryId?: string;
    type: 'expense' | 'income' | 'transfer';
    color?: string;
    bg?: string;
    isExisting?: boolean;
}

export const autoCategorizeByDescription = async (
    description: string,
    type: 'expense' | 'income' | 'transfer' = 'expense',
    user: User | null = null
): Promise<AiIconSuggestion> => {
    const ai = getAiClient();

    const customCats = await getCustomCategories(user);
    const standardCats = CATEGORY_CONFIG[type] || [];
    const dairyItems = await getDairyItems(user);

    const existingList: { label: string; id: string; iconName: string }[] = [];

    standardCats.forEach(c => {
        const matchedName = Object.keys(LUCIDE_ICON_MAP).find(
            key => LUCIDE_ICON_MAP[key] === c.icon
        ) || 'Tag';
        existingList.push({ label: c.label || c.id, id: c.id, iconName: matchedName });
    });

    customCats.forEach(c => {
        existingList.push({ label: c.label || c.id, id: c.id, iconName: c.iconName });
    });

    const existingDairyItems = dairyItems.map(item => ({
        name: item.name,
        icon: item.icon
    }));

    const prompt = `You are an expert AI financial transaction categorizer.
Transaction description: "${description}"
Transaction type: "${type}"

Available existing categories (match one of these ONLY if it is a truly accurate fit):
${JSON.stringify(existingList)}

Available existing Daily Khata / Diary Items (use these to keep category names consistent and avoid duplicate categories if the description matches one of these items):
${JSON.stringify(existingDairyItems)}

Available Lucide icon names for creating a new category:
${JSON.stringify(AVAILABLE_ICON_NAMES)}

CRITICAL DIRECTIVES:
1. Examine the transaction description carefully. If you encounter any brand name, company, app, medicine, product, regional term, or service that you are not 100% certain about, USE GOOGLE SEARCH to look up what it is!
2. If this transaction clearly and logically fits one of the existing categories above, set "isExisting": true and "matchedCategory" to that category's exact label or id.
3. If NO existing category fits the context well (or if existing categories are too broad/unrelated), you MUST create a NEW category. Set "isExisting": false, create a concise, professional category name ("categoryName"), and pick the single best matching Lucide icon name ("iconName") from the available icon list.
4. Provide a clear 1-2 sentence explanation ("reason") detailing why this category was matched or created and how the icon aligns with the item/brand.

Respond strictly in JSON format matching this structure:
{
  "isExisting": boolean,
  "matchedCategory": string,
  "categoryName": string,
  "iconName": string,
  "reason": string
}`;

    let parsed: { isExisting?: boolean; matchedCategory?: string; categoryName?: string; iconName?: string; reason?: string } = {};

    try {
        let responseText = '';
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.2,
                },
            });
            responseText = response.text || '{}';
        } catch (searchError) {
            console.warn("Failed to generate content with Google Search, falling back to standard generation:", searchError);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.2,
                },
            });
            responseText = response.text || '{}';
        }

        let cleanText = responseText.trim();
        if (cleanText.includes('```')) {
            const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                cleanText = match[1].trim();
            }
        }
        parsed = JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to run auto-categorization with Gemini:", e);
    }

    if (parsed.isExisting && parsed.matchedCategory) {
        const foundStandard = standardCats.find(c => c.id.toLowerCase() === parsed.matchedCategory?.toLowerCase() || c.label.toLowerCase() === parsed.matchedCategory?.toLowerCase());
        const foundCustom = customCats.find(c => c.id.toLowerCase() === parsed.matchedCategory?.toLowerCase() || c.label.toLowerCase() === parsed.matchedCategory?.toLowerCase());
        const catLabel = foundStandard ? (foundStandard.label || foundStandard.id) : (foundCustom ? (foundCustom.label || foundCustom.id) : parsed.matchedCategory);
        const catId = foundStandard ? foundStandard.id : (foundCustom ? foundCustom.id : parsed.matchedCategory);
        const icon = foundStandard ? (Object.keys(LUCIDE_ICON_MAP).find(k => LUCIDE_ICON_MAP[k] === foundStandard.icon) || 'Tag') : (foundCustom?.iconName || 'Tag');

        return {
            iconName: icon,
            reason: parsed.reason || `AI matched transaction to existing category "${catLabel}".`,
            categoryName: catLabel,
            categoryId: catId,
            type,
            isExisting: true
        };
    }

    const generatedName = parsed.categoryName || (description.length > 20 ? description.substring(0, 20) : description) || 'General';
    const chosenIconName = parsed.iconName && AVAILABLE_ICON_NAMES.includes(parsed.iconName)
        ? parsed.iconName
        : 'Sparkles';

    return {
        iconName: chosenIconName,
        reason: parsed.reason || `AI created new category "${generatedName}" with matching icon '${chosenIconName}'.`,
        categoryName: generatedName,
        categoryId: generatedName,
        type,
        isExisting: false
    };
};

export const generateAiCategoryIcon = async (
    categoryName: string,
    type: 'expense' | 'income' | 'transfer' = 'expense',
    description: string = '',
    user: User | null = null
): Promise<AiIconSuggestion> => {
    const ai = getAiClient();

    const customCats = await getCustomCategories(user);
    const standardCats = CATEGORY_CONFIG[type] || [];
    const dairyItems = await getDairyItems(user);

    const existingList: { label: string; iconName: string }[] = [];

    standardCats.forEach(c => {
        const matchedName = Object.keys(LUCIDE_ICON_MAP).find(
            key => LUCIDE_ICON_MAP[key] === c.icon
        ) || 'Tag';
        existingList.push({ label: c.label || c.id, iconName: matchedName });
    });

    customCats.forEach(c => {
        existingList.push({ label: c.label || c.id, iconName: c.iconName });
    });

    const existingDairyItems = dairyItems.map(item => ({
        name: item.name,
        icon: item.icon
    }));

    const prompt = `You are a financial category icon selector AI assistant.
The user wants an icon for a custom category named "${categoryName}" of type "${type}".
${description ? `Transaction description / context: "${description}"` : ''}

Available Lucide icon names you MUST choose from:
${JSON.stringify(AVAILABLE_ICON_NAMES)}

Existing categories and their currently assigned icons:
${JSON.stringify(existingList.slice(0, 100))}

Available existing Daily Khata / Diary Items (use these to keep icon styles consistent and avoid duplicate or mismatching icons):
${JSON.stringify(existingDairyItems)}

CRITICAL DIRECTIVES:
1. If "${categoryName}" or the transaction description includes any brand name, product, medicine, or technical/regional term you are unsure about, USE GOOGLE SEARCH to research what it is.
2. Choose the single BEST matching Lucide icon name from the available list that visually aligns with "${categoryName}" ${description ? `and transaction context "${description}"` : ''}.
3. Prefer a unique icon if possible, but prioritize semantic accuracy.
4. Provide a clear 1-2 sentence rationale ("reason") explaining why this icon fits.

Respond strictly in JSON format:
{
  "iconName": string,
  "reason": string
}`;

    let parsed: { iconName?: string; reason?: string } = {};

    try {
        let responseText = '';
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.2,
                },
            });
            responseText = response.text || '{}';
        } catch (searchError) {
            console.warn("Failed to generate category icon with Google Search, falling back to standard generation:", searchError);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    temperature: 0.2,
                },
            });
            responseText = response.text || '{}';
        }

        let cleanText = responseText.trim();
        if (cleanText.includes('```')) {
            const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) {
                cleanText = match[1].trim();
            }
        }
        parsed = JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to generate AI icon:", e);
    }

    const chosenIconName = parsed.iconName && AVAILABLE_ICON_NAMES.includes(parsed.iconName)
        ? parsed.iconName
        : 'Sparkles';

    return {
        iconName: chosenIconName,
        reason: parsed.reason || `AI selected '${chosenIconName}' for category '${categoryName}'.`,
        categoryName,
        categoryId: categoryName,
        type,
    };
};

