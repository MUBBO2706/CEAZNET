import { getAiClient } from './aiClient';
import { CATEGORY_CONFIG, AVAILABLE_ICON_NAMES } from '../components/finance/categories';
import { getCustomCategories, getDairyItems } from './dbService';
import { getAllUsedCategoryIcons, formatUsedIconsForPrompt, CURATED_ICONS } from './multiIconService';
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
    const usedIcons = await getAllUsedCategoryIcons(user);
    const usedIconSet = new Set(usedIcons.map(u => u.iconId.toLowerCase().trim()));

    const existingList: { label: string; id: string; iconName: string }[] = [];

    standardCats.forEach(c => {
        existingList.push({ label: c.label || c.id, id: c.id, iconName: c.iconName });
    });

    customCats.forEach(c => {
        existingList.push({ label: c.label || c.id, id: c.id, iconName: c.iconName });
    });

    const existingDairyItems = dairyItems.map(item => ({
        name: item.name,
        icon: item.icon
    }));

    const usedIconsFormatted = formatUsedIconsForPrompt(usedIcons);

    const prompt = `You are an expert AI financial transaction categorizer.
Transaction description: "${description}"
Transaction type: "${type}"

Available existing categories (match one of these ONLY if it is a truly accurate fit):
${JSON.stringify(existingList)}

Available existing Daily Khata / Diary Items (use these to keep category names consistent and avoid duplicate categories if the description matches one of these items):
${JSON.stringify(existingDairyItems)}

CURRENTLY USED ICONS ACROSS ALL CATEGORIES (DO NOT REUSE ANY OF THESE IF CREATING A NEW CATEGORY):
The following icons are already assigned to existing categories in the app. Each entry shows the icon ID, its library, and the category it belongs to:
${usedIconsFormatted}

ALLOWED ICON LIBRARIES (When creating a new category, iconName MUST STRICTLY come from one of these 7 libraries):
1. Solar Icons (Duotone format): prefix "solar:" (e.g. "solar:wallet-bold-duotone", "solar:cart-large-minimalistic-bold-duotone", "solar:cup-hot-bold-duotone", "solar:gamepad-bold-duotone", "solar:heart-pulse-bold-duotone", "solar:tv-bold-duotone", "solar:bus-bold-duotone", "solar:ticket-sale-bold-duotone")
2. Phosphor Icons: prefix "ph:" (e.g. "ph:pizza-duotone", "ph:coffee-duotone", "ph:beer-bottle-duotone", "ph:t-shirt-duotone", "ph:gas-pump-duotone", "ph:first-aid-kit-duotone", "ph:train-duotone", "ph:paw-print-duotone")
3. Hugeicons: prefix "hugeicons:" (e.g. "hugeicons:milk-bottle", "hugeicons:noodles", "hugeicons:car-02", "hugeicons:airplane-01", "hugeicons:washing-machine", "hugeicons:atm-01")
4. Tabler Icons: prefix "tabler:" (e.g. "tabler:parking", "tabler:tools", "tabler:receipt-2", "tabler:car-crash", "tabler:device-mobile-cog")
5. Remix Icons: prefix "ri:" (e.g. "ri:restaurant-fill", "ri:car-fill", "ri:shopping-basket-line", "ri:film-line", "ri:bank-card-line")
6. Heroicons: prefix "heroicons:" (e.g. "heroicons:sparkles-solid", "heroicons:shopping-bag-solid", "heroicons:ticket-solid", "heroicons:truck-solid")
7. Lucide Icons: standard PascalCase icon name (e.g. "ShoppingBag", "Utensils", "BookOpen", "HeartPulse", "Fuel", "Sparkles", "Tag")

CRITICAL DIRECTIVES:
1. Examine the transaction description carefully. If you encounter any brand name, company, app, medicine, product, regional term, or service that you are not 100% certain about, USE GOOGLE SEARCH to look up what it is!
2. If this transaction clearly and logically fits one of the existing categories above, set "isExisting": true and "matchedCategory" to that category's exact label or id.
3. If NO existing category fits the context well (or if existing categories are too broad/unrelated), you MUST create a NEW category. Set "isExisting": false, create a concise, professional category name ("categoryName"), and pick the single best matching icon ("iconName").
4. STRICT ICON RULES FOR NEW CATEGORIES:
   a. STRICT 7 LIBRARIES ONLY: The "iconName" MUST strictly belong to one of the 7 supported libraries above.
   b. NO REUSING ICONS: You are STRICTLY FORBIDDEN from using any icon that is in the "CURRENTLY USED ICONS ACROSS ALL CATEGORIES" list above. The new category MUST have a fresh, distinct icon that has not been used yet.
5. Provide a clear 1-2 sentence explanation ("reason") detailing why this category was matched or created and how the icon aligns with the item/brand.

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
        const icon = foundStandard ? (foundStandard.iconName || 'solar:tag-bold-duotone') : (foundCustom?.iconName || 'solar:tag-bold-duotone');

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
    const chosenIconName = resolveFreshCategoryIcon(parsed.iconName, generatedName, usedIconSet);

    return {
        iconName: chosenIconName,
        reason: parsed.reason || `AI created new category "${generatedName}" with matching unused icon '${chosenIconName}'.`,
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

    const usedIcons = await getAllUsedCategoryIcons(user);
    const usedIconSet = new Set(usedIcons.map(u => u.iconId.toLowerCase().trim()));
    const usedIconsFormatted = formatUsedIconsForPrompt(usedIcons);

    const prompt = `You are a financial category icon selector AI assistant.
The user wants an icon for a category named "${categoryName}" of type "${type}".
${description ? `Transaction description / context: "${description}"` : ''}

CURRENTLY USED ICONS ACROSS ALL CATEGORIES (DO NOT USE ANY OF THESE):
The following icons are already in use in the app with their respective library:
${usedIconsFormatted}

ALLOWED 7 ICON LIBRARIES (iconName MUST STRICTLY come from one of these 7 libraries):
1. Solar Icons (Duotone format): prefix "solar:" (e.g. "solar:wallet-bold-duotone", "solar:cart-large-minimalistic-bold-duotone", "solar:cup-hot-bold-duotone", "solar:gamepad-bold-duotone", "solar:heart-pulse-bold-duotone", "solar:tv-bold-duotone", "solar:bus-bold-duotone", "solar:ticket-sale-bold-duotone")
2. Phosphor Icons: prefix "ph:" (e.g. "ph:pizza-duotone", "ph:coffee-duotone", "ph:beer-bottle-duotone", "ph:t-shirt-duotone", "ph:gas-pump-duotone", "ph:first-aid-kit-duotone", "ph:train-duotone", "ph:paw-print-duotone")
3. Hugeicons: prefix "hugeicons:" (e.g. "hugeicons:milk-bottle", "hugeicons:noodles", "hugeicons:car-02", "hugeicons:airplane-01", "hugeicons:washing-machine", "hugeicons:atm-01")
4. Tabler Icons: prefix "tabler:" (e.g. "tabler:parking", "tabler:tools", "tabler:receipt-2", "tabler:car-crash", "tabler:device-mobile-cog")
5. Remix Icons: prefix "ri:" (e.g. "ri:restaurant-fill", "ri:car-fill", "ri:shopping-basket-line", "ri:film-line", "ri:bank-card-line")
6. Heroicons: prefix "heroicons:" (e.g. "heroicons:sparkles-solid", "heroicons:shopping-bag-solid", "heroicons:ticket-solid", "heroicons:truck-solid")
7. Lucide Icons: standard PascalCase icon name (e.g. "ShoppingBag", "Utensils", "BookOpen", "HeartPulse", "Fuel", "Sparkles", "Tag")

CRITICAL DIRECTIVES:
1. If "${categoryName}" or the transaction description includes any brand name, product, medicine, or technical/regional term you are unsure about, USE GOOGLE SEARCH to research what it is.
2. Choose the single BEST matching icon from the 7 libraries above that visually aligns with "${categoryName}" ${description ? `and transaction context "${description}"` : ''}.
3. STRICT NO DUPLICATE ICONS: You MUST NOT pick any icon that is already assigned to another category in the "CURRENTLY USED ICONS ACROSS ALL CATEGORIES" list. Choose an unused, fresh icon.
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

    const chosenIconName = resolveFreshCategoryIcon(parsed.iconName, categoryName, usedIconSet);

    return {
        iconName: chosenIconName,
        reason: parsed.reason || `AI selected fresh icon '${chosenIconName}' for category '${categoryName}'.`,
        categoryName,
        categoryId: categoryName,
        type,
    };
};

