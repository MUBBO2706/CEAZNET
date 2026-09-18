import { fetchApi } from "../utils/fetchApi";
import * as LucideIcons from 'lucide-react';
import { loadIcons } from '@iconify/react';
import { getAiClient } from './aiClient';
import type { User } from '@supabase/supabase-js';
import { RAW_CATEGORY_CONFIG } from '../components/finance/categories';
import { getCustomCategories, getDairyItems } from './dbService';

export interface IconItem {
    id: string; // e.g. 'solar:pizza-bold-duotone', 'ph:coffee-duotone', 'Fuel'
    name: string;
    library: string;
    category?: string;
    keywords?: string[];
}

export interface UsedCategoryIconInfo {
    iconId: string;
    library: string;
    libraryName: string;
    category: string;
    type?: string;
}

export const getLibraryFromIconId = (iconId: string): string => {
    if (!iconId) return 'lucide';
    const lower = iconId.toLowerCase().trim();
    if (lower.startsWith('solar:')) return 'solar';
    if (lower.startsWith('ph:')) return 'ph';
    if (lower.startsWith('hugeicons:')) return 'hugeicons';
    if (lower.startsWith('tabler:')) return 'tabler';
    if (lower.startsWith('ri:')) return 'ri';
    if (lower.startsWith('heroicons:')) return 'heroicons';
    if (lower.startsWith('lucide:')) return 'lucide';
    return 'lucide';
};

export const getLibraryDisplayName = (lib: string): string => {
    switch (lib.toLowerCase()) {
        case 'solar': return 'Solar Icons';
        case 'ph': return 'Phosphor Icons';
        case 'hugeicons': return 'Hugeicons';
        case 'tabler': return 'Tabler Icons';
        case 'ri': return 'Remix Icons';
        case 'heroicons': return 'Heroicons';
        case 'lucide': return 'Lucide';
        default: return lib;
    }
};

export const getAllUsedCategoryIcons = async (user?: User | null): Promise<UsedCategoryIconInfo[]> => {
    const usedMap = new Map<string, UsedCategoryIconInfo>();

    const addIcon = (iconId: string, category: string, type?: string) => {
        if (!iconId) return;
        const trimmed = iconId.trim();
        const key = trimmed.toLowerCase();
        if (!usedMap.has(key)) {
            const lib = getLibraryFromIconId(trimmed);
            usedMap.set(key, {
                iconId: trimmed,
                library: lib,
                libraryName: getLibraryDisplayName(lib),
                category,
                type: type || 'expense'
            });
        }
    };

    // 1. Standard categories
    if (RAW_CATEGORY_CONFIG) {
        RAW_CATEGORY_CONFIG.expense?.forEach(c => addIcon(c.iconName, c.label || c.id, 'expense'));
        RAW_CATEGORY_CONFIG.income?.forEach(c => addIcon(c.iconName, c.label || c.id, 'income'));
        RAW_CATEGORY_CONFIG.transfer?.forEach(c => addIcon(c.iconName, c.label || c.id, 'transfer'));
    }

    // 2. Custom categories
    try {
        const customCats = await getCustomCategories(user || null);
        if (Array.isArray(customCats)) {
            customCats.forEach(c => addIcon(c.iconName, c.label || c.id, c.type));
        }
    } catch (e) {
        console.warn('Could not fetch custom categories for used icons:', e);
    }

    // 3. Dairy / Khata items
    try {
        const dairyItems = await getDairyItems(user || null);
        if (Array.isArray(dairyItems)) {
            dairyItems.forEach(item => {
                if (item.icon) {
                    addIcon(item.icon, `Daily Khata: ${item.name}`, 'expense');
                }
            });
        }
    } catch (e) {
        console.warn('Could not fetch dairy items for used icons:', e);
    }

    return Array.from(usedMap.values());
};

export const formatUsedIconsForPrompt = (usedIcons: UsedCategoryIconInfo[]): string => {
    return usedIcons
        .map(u => `- Icon: "${u.iconId}" | Library: "${u.library}" (${u.libraryName}) | Category: "${u.category}" (${u.type || 'category'})`)
        .join('\n');
};

export type LibraryFilter = 'all' | 'solar' | 'ph' | 'hugeicons' | 'tabler' | 'ri' | 'heroicons' | 'lucide';

export const SUPPORTED_LIBRARIES = [
    { id: 'all', label: 'All Libraries', description: 'Search all 200k+ icons' },
    { id: 'solar', label: 'Solar Duotone', description: 'Solar Icons' },
    { id: 'ph', label: 'Phosphor', description: 'Phosphor Icons' },
    { id: 'hugeicons', label: 'Hugeicons', description: 'Hugeicons Pro/Free' },
    { id: 'tabler', label: 'Tabler', description: 'Tabler Icons' },
    { id: 'ri', label: 'Remix', description: 'Remix Icons' },
    { id: 'heroicons', label: 'Heroicons', description: 'Heroicons' },
    { id: 'lucide', label: 'Lucide', description: 'Lucide React' },
];

export const MULTI_ICON_PRESETS = [
    { id: 'popular', label: 'Popular' },
    { id: 'food', label: 'Food & Dining' },
    { id: 'transport', label: 'Transport & Travel' },
    { id: 'shopping', label: 'Shopping & Lifestyle' },
    { id: 'bills', label: 'Bills & Utilities' },
    { id: 'health', label: 'Health & Fitness' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'income', label: 'Income & Business' },
];

// Curated top icons across the 7 major libraries (All verified against Iconify)
export const CURATED_ICONS: IconItem[] = [
    // Food & Dining
    { id: 'ph:pizza-duotone', name: 'Pizza', library: 'ph', category: 'food', keywords: ['food', 'dining', 'restaurant', 'fastfood', 'pizza', 'zomato', 'swiggy'] },
    { id: 'solar:cart-large-minimalistic-bold-duotone', name: 'Grocery Cart', library: 'solar', category: 'food', keywords: ['grocery', 'shopping', 'supermarket', 'blinkit', 'zepto', 'instamart'] },
    { id: 'hugeicons:apple', name: 'Fruits', library: 'hugeicons', category: 'food', keywords: ['fruit', 'healthy', 'apple', 'food', 'organic'] },
    { id: 'solar:cup-hot-bold-duotone', name: 'Tea / Chai', library: 'solar', category: 'food', keywords: ['tea', 'chai', 'hot drink', 'coffee', 'cafe'] },
    { id: 'solar:bottle-bold-duotone', name: 'Water Bottle', library: 'solar', category: 'food', keywords: ['water', 'drink', 'beverage', 'bisleri'] },
    { id: 'ph:carrot-duotone', name: 'Vegetables', library: 'ph', category: 'food', keywords: ['vegetable', 'veggies', 'healthy', 'organic', 'sabzi'] },
    { id: 'ph:coffee-duotone', name: 'Coffee', library: 'ph', category: 'food', keywords: ['coffee', 'cafe', 'espresso', 'latte', 'starbucks'] },
    { id: 'ph:beer-bottle-duotone', name: 'Bar & Alcohol', library: 'ph', category: 'food', keywords: ['beer', 'bar', 'alcohol', 'drinks', 'pub', 'wine'] },
    { id: 'ph:cookie-duotone', name: 'Snacks & Bakery', library: 'ph', category: 'food', keywords: ['snacks', 'cookie', 'biscuit', 'bakery', 'sweets'] },
    { id: 'ph:hamburger-duotone', name: 'Burger', library: 'ph', category: 'food', keywords: ['burger', 'fastfood', 'mcdonalds', 'kfc'] },
    { id: 'hugeicons:milk-bottle', name: 'Milk & Dairy', library: 'hugeicons', category: 'food', keywords: ['milk', 'dairy', 'cheese', 'paneer', 'dahi', 'doodh'] },
    { id: 'hugeicons:noodles', name: 'Street Food', library: 'hugeicons', category: 'food', keywords: ['noodles', 'street food', 'chinese', 'chowmein'] },

    // Transport & Vehicles
    { id: 'solar:bus-bold-duotone', name: 'Bus', library: 'solar', category: 'transport', keywords: ['bus', 'public transport', 'transit', 'redbus'] },
    { id: 'tabler:parking', name: 'Parking', library: 'tabler', category: 'transport', keywords: ['parking', 'car', 'vehicle', 'park'] },
    { id: 'solar:routing-2-bold-duotone', name: 'Toll & Route', library: 'solar', category: 'transport', keywords: ['toll', 'fastag', 'route', 'highway'] },
    { id: 'ph:tree-palm-duotone', name: 'Vacation', library: 'ph', category: 'transport', keywords: ['vacation', 'holiday', 'trip', 'travel', 'resort'] },
    { id: 'ph:gas-pump-duotone', name: 'Fuel & Petrol', library: 'ph', category: 'transport', keywords: ['petrol', 'diesel', 'fuel', 'cng', 'gas', 'shell'] },
    { id: 'ph:train-duotone', name: 'Metro & Train', library: 'ph', category: 'transport', keywords: ['train', 'metro', 'railway', 'ticket', 'irctc'] },
    { id: 'hugeicons:car-02', name: 'Cab & Taxi', library: 'hugeicons', category: 'transport', keywords: ['cab', 'taxi', 'uber', 'ola', 'car', 'rapido'] },
    { id: 'hugeicons:airplane-01', name: 'Flight & Airlines', library: 'hugeicons', category: 'transport', keywords: ['flight', 'air', 'travel', 'plane', 'indigo'] },
    { id: 'tabler:car-crash', name: 'Service & Repair', library: 'tabler', category: 'transport', keywords: ['car service', 'maintenance', 'repair', 'garage'] },

    // Bills, Rent & Housing
    { id: 'solar:home-smile-bold-duotone', name: 'Home Rent', library: 'solar', category: 'bills', keywords: ['rent', 'house', 'apartment', 'flat', 'landlord'] },
    { id: 'solar:water-bold-duotone', name: 'Water Bill', library: 'solar', category: 'bills', keywords: ['water', 'utility', 'bill', 'jal'] },
    { id: 'solar:wi-fi-router-bold-duotone', name: 'Wifi & Broadband', library: 'solar', category: 'bills', keywords: ['wifi', 'internet', 'broadband', 'airtel', 'jio'] },
    { id: 'solar:flame-bold-duotone', name: 'Cooking Gas', library: 'solar', category: 'bills', keywords: ['gas', 'cylinder', 'lpg', 'indane', 'hp'] },
    { id: 'solar:broom-bold-duotone', name: 'Househelp', library: 'solar', category: 'bills', keywords: ['maid', 'cleaner', 'servant', 'househelp'] },
    { id: 'solar:sofa-2-bold-duotone', name: 'Home Decor', library: 'solar', category: 'bills', keywords: ['furniture', 'decor', 'interior', 'ikea'] },
    { id: 'ph:lightning-duotone', name: 'Electricity', library: 'ph', category: 'bills', keywords: ['electricity', 'power', 'current', 'bill', 'light'] },
    { id: 'tabler:tools', name: 'Repairs', library: 'tabler', category: 'bills', keywords: ['tools', 'repair', 'plumber', 'electrician'] },

    // Shopping, Personal & Lifestyle
    { id: 'solar:bag-heart-bold-duotone', name: 'Shopping Bag', library: 'solar', category: 'shopping', keywords: ['shopping', 'mall', 'purchase', 'amazon', 'flipkart'] },
    { id: 'solar:scissors-bold-duotone', name: 'Salon & Haircut', library: 'solar', category: 'shopping', keywords: ['salon', 'barber', 'haircut', 'spa', 'parlour'] },
    { id: 'solar:dumbbell-large-bold-duotone', name: 'Gym & Workout', library: 'solar', category: 'shopping', keywords: ['gym', 'fitness', 'workout', 'protein', 'cult'] },
    { id: 'solar:magic-stick-3-bold-duotone', name: 'Cosmetics', library: 'solar', category: 'shopping', keywords: ['makeup', 'cosmetics', 'beauty', 'nykaa'] },
    { id: 'ph:user-circle-duotone', name: 'Personal Care', library: 'ph', category: 'shopping', keywords: ['personal', 'self', 'grooming'] },
    { id: 'ph:t-shirt-duotone', name: 'Clothes', library: 'ph', category: 'shopping', keywords: ['clothing', 'apparel', 'shirt', 'dress', 'myntra'] },
    { id: 'hugeicons:washing-machine', name: 'Laundry', library: 'hugeicons', category: 'shopping', keywords: ['laundry', 'dry clean', 'wash'] },
    { id: 'hugeicons:baby-boy-dress', name: 'Kids & Childcare', library: 'hugeicons', category: 'shopping', keywords: ['baby', 'kids', 'child', 'firstcry'] },
    { id: 'ph:paw-print-duotone', name: 'Pet Care', library: 'ph', category: 'shopping', keywords: ['pet', 'dog', 'cat', 'vet', 'heads up for tails'] },

    // Health & Insurance
    { id: 'solar:heart-pulse-bold-duotone', name: 'Doctor & Clinic', library: 'solar', category: 'health', keywords: ['doctor', 'hospital', 'health', 'clinic', 'checkup'] },
    { id: 'solar:shield-check-bold-duotone', name: 'Insurance Policy', library: 'solar', category: 'health', keywords: ['insurance', 'policy', 'protection', 'lic'] },
    { id: 'ph:first-aid-kit-duotone', name: 'Pharmacy & Medicine', library: 'ph', category: 'health', keywords: ['medicine', 'pharma', 'tablets', 'drugs', 'apollo', '1mg'] },

    // Entertainment, Gaming & Tech
    { id: 'solar:tv-bold-duotone', name: 'Television & OTT', library: 'solar', category: 'entertainment', keywords: ['tv', 'netflix', 'prime', 'movies', 'hotstar'] },
    { id: 'solar:gamepad-bold-duotone', name: 'Gaming', library: 'solar', category: 'entertainment', keywords: ['gaming', 'steam', 'playstation', 'game', 'xbox'] },
    { id: 'solar:ticket-sale-bold-duotone', name: 'Concert & Cinema', library: 'solar', category: 'entertainment', keywords: ['cinema', 'movie', 'concert', 'ticket', 'bookmyshow'] },
    { id: 'solar:palette-bold-duotone', name: 'Hobbies & Art', library: 'solar', category: 'entertainment', keywords: ['art', 'drawing', 'hobby', 'craft'] },
    { id: 'solar:smartphone-bold-duotone', name: 'Mobile Recharge', library: 'solar', category: 'bills', keywords: ['mobile', 'recharge', 'phone', 'prepaid', 'postpaid'] },
    { id: 'solar:laptop-minimalistic-bold-duotone', name: 'Electronics', library: 'solar', category: 'entertainment', keywords: ['laptop', 'tech', 'gadget', 'apple'] },
    { id: 'solar:code-square-bold-duotone', name: 'Software', library: 'solar', category: 'entertainment', keywords: ['software', 'subscription', 'dev', 'saas'] },
    { id: 'solar:server-square-bold-duotone', name: 'Hosting & Server', library: 'solar', category: 'entertainment', keywords: ['server', 'aws', 'vps', 'cloud'] },
    { id: 'ph:film-strip-duotone', name: 'OTT Streaming', library: 'ph', category: 'entertainment', keywords: ['ott', 'streaming', 'shows', 'youtube'] },

    // Income & Finance
    { id: 'solar:hand-money-bold-duotone', name: 'Salary / Hand Cash', library: 'solar', category: 'income', keywords: ['salary', 'income', 'cash', 'money', 'payroll'] },
    { id: 'solar:banknote-2-bold-duotone', name: 'Business Revenue', library: 'solar', category: 'income', keywords: ['business', 'revenue', 'profit', 'sales'] },
    { id: 'solar:chart-2-bold-duotone', name: 'Stock Trading', library: 'solar', category: 'income', keywords: ['stocks', 'trading', 'shares', 'equity', 'zerodha', 'groww'] },
    { id: 'solar:videocamera-record-bold-duotone', name: 'YouTube Revenue', library: 'solar', category: 'income', keywords: ['youtube', 'video', 'adsense', 'creator'] },
    { id: 'solar:graph-up-bold-duotone', name: 'Mutual Funds / Growth', library: 'solar', category: 'income', keywords: ['mutual fund', 'growth', 'invest', 'sip'] },
    { id: 'solar:pie-chart-2-bold-duotone', name: 'Dividends', library: 'solar', category: 'income', keywords: ['dividends', 'payout', 'yield'] },
    { id: 'solar:sale-bold-duotone', name: 'Interest & Offers', library: 'solar', category: 'income', keywords: ['interest', 'fd', 'savings', 'cashback', 'rewards'] },
    { id: 'solar:wallet-money-bold-duotone', name: 'Pocket Money', library: 'solar', category: 'income', keywords: ['pocket money', 'allowance', 'cash'] },
    { id: 'solar:card-transfer-bold-duotone', name: 'Self Transfer', library: 'solar', category: 'popular', keywords: ['transfer', 'bank transfer', 'neft', 'upi', 'gpay'] },
    { id: 'solar:gift-bold-duotone', name: 'Gift', library: 'solar', category: 'popular', keywords: ['gift', 'present', 'birthday', 'shagun'] },
    { id: 'ph:handshake-duotone', name: 'Sponsorship', library: 'ph', category: 'income', keywords: ['sponsor', 'deal', 'collab'] },
    { id: 'ph:bank-duotone', name: 'Bank & Loan EMI', library: 'ph', category: 'popular', keywords: ['loan', 'emi', 'bank', 'mortgage', 'hdfc', 'sbi'] },
    { id: 'hugeicons:atm-01', name: 'ATM Withdrawal', library: 'hugeicons', category: 'popular', keywords: ['atm', 'withdrawal', 'cash'] },
];

// Add clean Lucide icons into the local list
const LUCIDE_ICONS: IconItem[] = Object.keys(LucideIcons)
    .filter(name => /^[A-Z]/.test(name) && !name.endsWith('Icon') && name !== 'Loader2' && name !== 'createLucideIcon' && name !== 'LucideProps')
    .slice(0, 150)
    .map(name => ({
        id: name,
        name: name.replace(/([A-Z])/g, ' $1').trim(),
        library: 'lucide',
        category: 'popular',
        keywords: [name.toLowerCase()]
    }));

const ALL_LOCAL_ICONS = [...CURATED_ICONS, ...LUCIDE_ICONS];

/**
 * Local search across curated & Lucide icons
 */
export const searchMultiLibraryIcons = (
    query: string, 
    options?: { libraryFilter?: string; categoryPreset?: string; limit?: number }
): IconItem[] => {
    const q = (query || '').toLowerCase().trim();
    const lib = options?.libraryFilter || 'all';
    const preset = options?.categoryPreset || 'popular';
    const limit = options?.limit || 120;

    return ALL_LOCAL_ICONS.filter(item => {
        // Library filter
        if (lib !== 'all' && item.library !== lib) {
            return false;
        }

        // Search text matching
        if (q) {
            const matchesId = item.id.toLowerCase().includes(q);
            const matchesName = item.name.toLowerCase().includes(q);
            const matchesKeywords = item.keywords?.some(k => k.includes(q)) ?? false;
            return matchesId || matchesName || matchesKeywords;
        }

        // Category filter if no search query
        if (preset !== 'popular' && item.category !== preset) {
            return false;
        }

        return true;
    }).slice(0, limit);
};

// In-memory cache for online search results & library collections
const searchCache = new Map<string, IconItem[]>();
const libraryCollectionCache = new Map<string, IconItem[]>();

/**
 * Fetch and cache all icons for a specific library collection
 */
export const fetchLibraryCollection = async (libraryPrefix: string): Promise<IconItem[]> => {
    if (!libraryPrefix || libraryPrefix === 'all') return [];
    if (libraryCollectionCache.has(libraryPrefix)) {
        return libraryCollectionCache.get(libraryPrefix)!;
    }

    try {
        const url = `https://api.iconify.design/collection?prefix=${libraryPrefix}`;
        const res = await fetchApi(url);
        if (!res.ok) return [];

        const data = await res.json();
        const iconNames: string[] = [];

        if (Array.isArray(data.uncategorized)) {
            iconNames.push(...data.uncategorized);
        }
        if (data.categories && typeof data.categories === 'object') {
            for (const catName in data.categories) {
                if (Array.isArray(data.categories[catName])) {
                    iconNames.push(...data.categories[catName]);
                }
            }
        }

        const items: IconItem[] = iconNames.map(name => ({
            id: `${libraryPrefix}:${name}`,
            name: name.replace(/[-_]/g, ' '),
            library: libraryPrefix,
            keywords: [name.toLowerCase(), libraryPrefix]
        }));

        libraryCollectionCache.set(libraryPrefix, items);
        return items;
    } catch (e) {
        console.warn(`Failed to fetch collection for ${libraryPrefix}:`, e);
        return [];
    }
};

/**
 * Async online search using Iconify API with caching and error resilience
 */
export const searchOnlineIconify = async (
    query: string, 
    library: string = 'all'
): Promise<IconItem[]> => {
    const trimmed = (query || '').trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) return [];

    const cacheKey = `${trimmed}:${library}`;
    if (searchCache.has(cacheKey)) {
        return searchCache.get(cacheKey)!;
    }

    try {
        let prefixFilter = '';
        if (library === 'solar') prefixFilter = '&prefixes=solar';
        else if (library === 'ph') prefixFilter = '&prefixes=ph';
        else if (library === 'hugeicons') prefixFilter = '&prefixes=hugeicons';
        else if (library === 'tabler') prefixFilter = '&prefixes=tabler';
        else if (library === 'ri') prefixFilter = '&prefixes=ri';
        else if (library === 'heroicons') prefixFilter = '&prefixes=heroicons';
        else if (library === 'lucide') prefixFilter = '&prefixes=lucide';
        else prefixFilter = '&prefixes=solar,ph,hugeicons,tabler,ri,heroicons,lucide';

        const url = `https://api.iconify.design/search?query=${encodeURIComponent(trimmed)}&limit=64${prefixFilter}`;
        const res = await fetchApi(url);
        if (!res.ok) return [];

        const data = await res.json();
        if (!data || !Array.isArray(data.icons)) return [];

        const items: IconItem[] = data.icons.map((iconStr: string): IconItem => {
            const [prefix, iconName] = iconStr.includes(':') ? iconStr.split(':') : ['solar', iconStr];
            return {
                id: iconStr,
                name: (iconName || iconStr).replace(/[-_]/g, ' '),
                library: prefix || 'solar',
                keywords: [trimmed]
            };
        });

        searchCache.set(cacheKey, items);
        return items;
    } catch (e) {
        console.warn('Iconify search failed:', e);
        return [];
    }
};

/**
 * Intelligent Multi-Step AI Search Pipeline across 7 Icon Libraries
 * Step 1: AI generates semantic tags and search queries
 * Step 2: Executes parallel internet searches on Iconify API & local databases using those tags
 * Step 3: AI evaluates and ranks candidates for visual accuracy & library diversity
 * Step 4: Preloads icon SVG assets for instant flicker-free rendering
 */
export const suggestMultiLibraryIconsWithAi = async (
    query: string,
    context?: {
        categoryName?: string;
        type?: string;
        description?: string;
        onStatusUpdate?: (status: string) => void;
        user?: User | null;
        usedIcons?: UsedCategoryIconInfo[];
    }
): Promise<{
    suggestions: Array<{ iconId: string; iconName: string; library: string; reason: string; relevance: string }>;
    rationale: string;
    topPick: string;
}> => {
    const searchText = (context?.categoryName || query || 'General').trim();
    const type = context?.type || 'expense';
    const description = context?.description || '';
    const onStatusUpdate = context?.onStatusUpdate;

    // Fetch all currently used category icons across standard, custom, and dairy items
    const usedIcons = (context?.usedIcons && context.usedIcons.length > 0)
        ? context.usedIcons
        : await getAllUsedCategoryIcons(context?.user);
    const usedIconSet = new Set(usedIcons.map(u => u.iconId.toLowerCase().trim()));

    let generatedSearchTags: string[] = [searchText];

    // Step 1: AI Tag & Keyword Generation Pass
    onStatusUpdate?.('Analyzing category & generating smart tags...');
    try {
        const ai = getAiClient();
        const tagPrompt = `You are an AI search tool agent for UI icon databases.
Generate highly relevant, precise search keywords/tags to find relevant icons for category "${searchText}" (Type: ${type}, Description: "${description}").
Include direct synonyms, actions, related objects, and visual metaphors.
Do NOT limit yourself to a fixed count like 5. Generate as many highly relevant tags as appropriate for the category name to find the best match.

Respond strictly in valid JSON array of strings:
["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", ...]`;

        const tagResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: tagPrompt,
            config: { temperature: 0.3 }
        });

        const rawText = tagResponse.text || '';
        let cleanJson = rawText.trim();
        if (cleanJson.includes('```')) {
            const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) cleanJson = match[1].trim();
        }

        const tags = JSON.parse(cleanJson);
        if (Array.isArray(tags) && tags.length > 0) {
            generatedSearchTags = Array.from(new Set([searchText, ...tags.map(t => String(t).toLowerCase().trim())]));
        }
    } catch (e) {
        console.warn('AI tag generation fallback:', e);
        // Fallback token extraction
        const tokens = searchText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        generatedSearchTags = Array.from(new Set([searchText, ...tokens]));
    }

    // Step 2: Execute Parallel Internet Searches across all 7 libraries for generated tags
    onStatusUpdate?.('Searching 200,000+ icons across 7 libraries...');
    const candidateMap = new Map<string, IconItem>();

    // Always include local curated matches (excluding already-used icons)
    const localMatches = searchMultiLibraryIcons(searchText, { limit: 24 });
    localMatches.forEach(item => {
        if (!usedIconSet.has(item.id.toLowerCase().trim())) {
            candidateMap.set(item.id, item);
        }
    });

    // Parallel Iconify online search calls for each generated AI tag
    const searchPromises = generatedSearchTags.map(tag => searchOnlineIconify(tag, 'all'));
    const onlineSearchResults = await Promise.allSettled(searchPromises);

    onlineSearchResults.forEach(result => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            result.value.forEach(item => {
                if (!usedIconSet.has(item.id.toLowerCase().trim()) && !candidateMap.has(item.id)) {
                    candidateMap.set(item.id, item);
                }
            });
        }
    });

    const liveCandidatePool = Array.from(candidateMap.values()).slice(0, 80);

    let candidates: Array<{ iconId: string; iconName: string; library: string; reason: string; relevance: string }> = [];

    // Step 3: AI Selection & Ranking Pass over the live retrieved candidate pool
    onStatusUpdate?.('AI evaluating visual metaphors & ranking top picks...');
    try {
        const ai = getAiClient();
        const candidateListFormatted = liveCandidatePool
            .map(c => `- ID: "${c.id}" | Name: "${c.name}" | Library: "${c.library}"`)
            .join('\n');

        const usedIconsFormatted = formatUsedIconsForPrompt(usedIcons);

        const rankingPrompt = `You are a chief UI icon designer selecting icons for transaction category: "${searchText}" (Type: ${type}).
AI Search Tags Used: ${generatedSearchTags.join(', ')}

CURRENTLY USED ICONS (DO NOT RECOMMEND OR USE ANY OF THESE ICONS):
The following icons are already assigned to existing categories in the app. Each entry indicates the icon, which library it belongs to, and what category it is used in:
${usedIconsFormatted}

Here is the live pool of icons retrieved from internet search across 7 libraries (Solar, Phosphor, Hugeicons, Tabler, Remix, Heroicons, Lucide):
${candidateListFormatted || 'No live results'}

Your Task:
1. Select the best visual icons from the live pool above that represent "${searchText}".
2. STRICT NEGATIVE CONSTRAINT: DO NOT recommend or suggest ANY icon that is in the "CURRENTLY USED ICONS" list above. Every recommended icon MUST be completely unused, fresh, and visually distinct.
3. Do not restrict the count of suggestions to 5. Recommend as many as are relevant and useful, but set a maximum limit of 15 suggestions (do not suggest more than 15, but feel free to suggest anywhere up to 15 if they are a strong fit).
4. Classify each suggestion with a recommendation rating in "relevance": "High", "Medium", "Intermediate", or "Low". High and Medium are most recommended and highlighted.
5. Ensure visual diversity across libraries (e.g. include Solar Duotone, Phosphor, Hugeicons, Tabler if available).
6. Provide a clear, natural reason for why each icon fits the category.

CRITICAL RULE FOR iconId: You MUST copy the EXACT string from the "ID:" field in the list above (e.g. "solar:ticket-bold-duotone" or "ph:dice-five-duotone"). DO NOT use human words or spaced titles in iconId!

Respond strictly in valid JSON:
{
  "rationale": "A short summary explaining the icon selection strategy for ${searchText}",
  "suggestions": [
    {
      "iconId": "exact_ID_string_from_candidate_list",
      "iconName": "Human Friendly Icon Name",
      "library": "solar|ph|hugeicons|tabler|ri|heroicons|lucide",
      "reason": "Why this icon is a great visual fit",
      "relevance": "High" | "Medium" | "Intermediate" | "Low"
    }
  ]
}`;

        const rankingResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: rankingPrompt,
            config: { temperature: 0.2 }
        });

        const rawText = rankingResponse.text || '';
        let cleanJson = rawText.trim();
        if (cleanJson.includes('```')) {
            const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match && match[1]) cleanJson = match[1].trim();
        }

        const parsed = JSON.parse(cleanJson);
        if (parsed && Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
            // Sanitize and validate every AI returned candidate to ensure valid renderable icon IDs
            const rawCandidates = parsed.suggestions.map((s: any) => {
                let rawId = (s.iconId || '').trim();
                let name = (s.iconName || rawId).trim();
                let lib = (s.library || '').toLowerCase();
                let relevanceVal = String(s.relevance || 'High').trim();
                // Normalize relevance to match casing precisely
                let rel = 'High';
                if (relevanceVal.toLowerCase() === 'medium') rel = 'Medium';
                else if (relevanceVal.toLowerCase() === 'intermediate') rel = 'Intermediate';
                else if (relevanceVal.toLowerCase() === 'low') rel = 'Low';

                // 1. Direct ID match in candidate pool
                const directMatch = liveCandidatePool.find(c => c.id === rawId || c.id.toLowerCase() === rawId.toLowerCase());
                if (directMatch) {
                    return {
                        iconId: directMatch.id,
                        iconName: directMatch.name,
                        library: directMatch.library,
                        reason: s.reason || `Matched in ${directMatch.library}`,
                        relevance: rel
                    };
                }

                // 2. Name match in candidate pool
                const nameMatch = liveCandidatePool.find(c => c.name.toLowerCase() === name.toLowerCase() || c.name.toLowerCase().includes(name.toLowerCase()));
                if (nameMatch) {
                    return {
                        iconId: nameMatch.id,
                        iconName: nameMatch.name,
                        library: nameMatch.library,
                        reason: s.reason || `Matched in ${nameMatch.library}`,
                        relevance: rel
                    };
                }

                // 3. Fallback resolution for non-prefixed IDs (e.g., "Slot Machine" or "Lottery Ticket")
                if (!rawId.includes(':')) {
                    const localResults = searchMultiLibraryIcons(name || rawId, { libraryFilter: lib !== 'all' ? lib : undefined });
                    if (localResults.length > 0) {
                        return {
                            iconId: localResults[0].id,
                            iconName: localResults[0].name,
                            library: localResults[0].library,
                            reason: s.reason || `Matched in ${localResults[0].library}`,
                            relevance: rel
                        };
                    }
                }

                return {
                    iconId: rawId,
                    iconName: name,
                    library: lib || 'solar',
                    reason: s.reason || 'Category icon match',
                    relevance: rel
                };
            });

            // STRICT FILTER: remove any candidate that is in the already-used set
            candidates = rawCandidates.filter(c => !usedIconSet.has(c.iconId.toLowerCase().trim()));

            // Ensure suggestions are sorted by priority: High (4) -> Medium (3) -> Intermediate (2) -> Low (1)
            const relevanceOrder: Record<string, number> = {
                'high': 4,
                'medium': 3,
                'intermediate': 2,
                'low': 1
            };
            candidates.sort((a, b) => {
                const rA = relevanceOrder[a.relevance.toLowerCase()] || 0;
                const rB = relevanceOrder[b.relevance.toLowerCase()] || 0;
                return rB - rA;
            });

            // Step 4: Preload icon SVG assets so they render instantly
            const idsToPreload = candidates.map(c => c.iconId).filter(id => id.includes(':'));
            if (idsToPreload.length > 0) {
                loadIcons(idsToPreload, () => {});
            }

            if (candidates.length > 0) {
                return {
                    suggestions: candidates,
                    rationale: parsed.rationale || `AI generated search tags (${generatedSearchTags.slice(0, 4).join(', ')}) and matched top icons across 7 libraries.`,
                    topPick: candidates[0].iconId
                };
            }
        }
    } catch (err) {
        console.warn('Gemini AI ranking pass fallback:', err);
    }

    // Step 4 Fallback: Deduplicated candidate list if AI ranking fails (strictly excluding used icons)
    for (const item of liveCandidatePool) {
        if (!usedIconSet.has(item.id.toLowerCase().trim())) {
            candidates.push({
                iconId: item.id,
                iconName: item.name,
                library: item.library,
                reason: `Direct internet search match for "${searchText}" in ${item.library}`,
                relevance: 'High'
            });
            if (candidates.length >= 6) break;
        }
    }

    if (candidates.length === 0) {
        // Find an unused icon from CURATED_ICONS
        const fallback = CURATED_ICONS.find(c => !usedIconSet.has(c.id.toLowerCase().trim())) || {
            id: 'solar:widget-add-bold-duotone',
            name: 'Category Tag',
            library: 'solar'
        };
        candidates.push({
            iconId: fallback.id,
            iconName: fallback.name,
            library: fallback.library,
            reason: 'Universal transaction category tag',
            relevance: 'Medium'
        });
    }

    // Preload fallback icon SVGs
    const fallbackIds = candidates.map(c => c.iconId).filter(id => id.includes(':'));
    if (fallbackIds.length > 0) {
        loadIcons(fallbackIds, () => {});
    }

    return {
        suggestions: candidates,
        rationale: `Matched top icons for "${searchText}" across verified icon libraries using AI search tags (${generatedSearchTags.slice(0, 3).join(', ')}).`,
        topPick: candidates[0].iconId
    };
};
