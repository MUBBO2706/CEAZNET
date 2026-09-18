import { getAiClient } from './aiClient';
import { CATEGORY_CONFIG, AVAILABLE_ICON_NAMES } from '../components/finance/categories';
import { getCustomCategories, getDairyItems } from './dbService';
import { getAllUsedCategoryIcons, formatUsedIconsForPrompt, CURATED_ICONS, suggestMultiLibraryIconsWithAi } from './multiIconService';
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

const resolveFreshCategoryIcon = (
    suggestedIcon: string | undefined,
    categoryName: string,
    usedIconSet: Set<string>
): string => {
    if (suggestedIcon) {
        const clean = suggestedIcon.trim();
        const lower = clean.toLowerCase();
        const isValidLib = (
            lower.startsWith('solar:') ||
            lower.startsWith('ph:') ||
            lower.startsWith('hugeicons:') ||
            lower.startsWith('tabler:') ||
            lower.startsWith('ri:') ||
            lower.startsWith('heroicons:') ||
            AVAILABLE_ICON_NAMES.includes(clean)
        );
        if (isValidLib && !usedIconSet.has(lower)) {
            return clean;
        }
    }

    // Try finding an unused icon from CURATED_ICONS matching keywords
    const lowerCat = categoryName.toLowerCase();
    const matchedCurated = CURATED_ICONS.find(c => {
        if (usedIconSet.has(c.id.toLowerCase().trim())) return false;
        return c.keywords?.some(k => lowerCat.includes(k)) || lowerCat.includes(c.name.toLowerCase());
    });
    if (matchedCurated) {
        return matchedCurated.id;
    }

    // Pick first unused from CURATED_ICONS
    const unusedCurated = CURATED_ICONS.find(c => !usedIconSet.has(c.id.toLowerCase().trim()));
    if (unusedCurated) {
        return unusedCurated.id;
    }

    // Safe fallback
    return 'solar:widget-add-bold-duotone';
};

export const autoCategorizeByDescription = async (
    description: string,
    type: 'expense' | 'income' | 'transfer' = 'expense',
    user: User | null = null
): Promise<AiIconSuggestion> => {
    const ai = getAiClient();

    const customCats = await getCustomCategories(user);
    const standardCats = CATEGORY_CONFIG[type] || [];
    const dairyItems = await getDairyItems(user);

    // Build ultra-compact list of existing categories (Label only / Label + ID)
    const existingCategoryNames: string[] = [];
    const categoryLookup = new Map<string, { label: string; id: string; iconName: string }>();

    standardCats.forEach(c => {
        const label = c.label || c.id;
        existingCategoryNames.push(label);
        categoryLookup.set(label.toLowerCase(), { label, id: c.id, iconName: c.iconName });
        categoryLookup.set(c.id.toLowerCase(), { label, id: c.id, iconName: c.iconName });
    });

    // Filter custom categories matching the transaction type (or untyped general categories)
    const matchingCustomCats = customCats.filter(c => !c.type || c.type === type);

    matchingCustomCats.forEach(c => {
        const label = c.label || c.id;
        if (!existingCategoryNames.includes(label)) {
            existingCategoryNames.push(label);
        }
        categoryLookup.set(label.toLowerCase(), { label, id: c.id, iconName: c.iconName });
        categoryLookup.set(c.id.toLowerCase(), { label, id: c.id, iconName: c.iconName });
    });

    const diaryNames = dairyItems.map(d => d.name).filter(Boolean);

    // STEP 1: Fast Categorization Matching Pass (Super-lightweight prompt ~200 tokens)
    // If not matched, AI returns suggestedCategoryName AND an iconSearchQuery for tag generation & Iconify search
    const matchPrompt = `You are a financial transaction categorizer.
Transaction: "${description}" (Type: ${type})

EXISTING CATEGORIES (Choose from here ONLY if it is an accurate fit):
${existingCategoryNames.join(', ')}
${diaryNames.length > 0 ? `\nEXISTING DIARY/KHATA ITEMS (match category name if description fits):\n${diaryNames.join(', ')}` : ''}

Task:
1. If the transaction clearly fits one of the EXISTING CATEGORIES, set "isExisting": true and "matchedCategory" to that exact category name.
2. If NO existing category fits accurately, set "isExisting": false, suggest a concise 1-3 word "suggestedCategoryName", and a 1-3 word visual search term "iconSearchQuery" (e.g. "protein fitness", "medicine pill", "cricket bat").
3. Provide a brief 1-sentence "reason".

Respond strictly in JSON:
{
  "isExisting": boolean,
  "matchedCategory": string,
  "suggestedCategoryName": string,
  "iconSearchQuery": string,
  "reason": string
}`;

    let matchParsed: { isExisting?: boolean; matchedCategory?: string; suggestedCategoryName?: string; iconSearchQuery?: string; reason?: string } = {};

    try {
        let responseText = '';
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: matchPrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    temperature: 0.1,
                },
            });
            responseText = response.text || '{}';
        } catch (searchError) {
            console.warn("Failed with Google Search, falling back to standard generation:", searchError);
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: matchPrompt,
                config: {
                    temperature: 0.1,
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
        matchParsed = JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to run Step 1 auto-categorization matching:", e);
    }

    // If successfully matched to an existing category, return immediately with local icon!
    if (matchParsed.isExisting && matchParsed.matchedCategory) {
        const matchedKey = matchParsed.matchedCategory.toLowerCase().trim();
        const found = categoryLookup.get(matchedKey);
        const catLabel = found ? found.label : matchParsed.matchedCategory;
        const catId = found ? found.id : matchParsed.matchedCategory;
        const icon = found?.iconName || 'solar:tag-bold-duotone';

        return {
            iconName: icon,
            reason: matchParsed.reason || `AI matched transaction to existing category "${catLabel}".`,
            categoryName: catLabel,
            categoryId: catId,
            type,
            isExisting: true
        };
    }

    // STEP 2 & 3: Creation Pipeline via Multi-Library Tag Generation & Iconify Live Search
    // Fired ONLY when isExisting === false
    const newCategoryName = matchParsed.suggestedCategoryName
        || (description.length > 20 ? description.substring(0, 20) : description)
        || 'General';

    const searchQuery = matchParsed.iconSearchQuery || newCategoryName || description;

    // Fetch live icons using the full AI tag generation + Iconify search + filtered ranking pipeline
    // maxCandidates: 54 provides balanced multi-tag coverage with rapid sub-second generation
    const aiIconResults = await suggestMultiLibraryIconsWithAi(searchQuery, {
        categoryName: newCategoryName,
        searchQuery: searchQuery,
        type,
        description,
        user,
        maxCandidates: 54
    });

    const chosenIconName = aiIconResults.topPick 
        || (aiIconResults.suggestions?.[0]?.iconId) 
        || 'solar:widget-add-bold-duotone';

    const finalReason = matchParsed.reason 
        || aiIconResults.suggestions?.[0]?.reason 
        || aiIconResults.rationale 
        || `AI created new category "${newCategoryName}" with fresh icon '${chosenIconName}'.`;

    return {
        iconName: chosenIconName,
        reason: finalReason,
        categoryName: newCategoryName,
        categoryId: newCategoryName,
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
    // Directly leverage the robust multi-library tag generation and Iconify live search pipeline
    const aiIconResults = await suggestMultiLibraryIconsWithAi(categoryName, {
        categoryName,
        searchQuery: categoryName,
        type,
        description,
        user
    });

    const chosenIconName = aiIconResults.topPick 
        || (aiIconResults.suggestions?.[0]?.iconId) 
        || 'solar:widget-add-bold-duotone';

    const reason = aiIconResults.suggestions?.[0]?.reason 
        || aiIconResults.rationale 
        || `AI selected fresh icon '${chosenIconName}' for category '${categoryName}'.`;

    return {
        iconName: chosenIconName,
        reason,
        categoryName,
        categoryId: categoryName,
        type,
    };
};

