import * as LucideIcons from 'lucide-react';
import { getAiClient } from './aiClient';
import { CATEGORY_CONFIG, AVAILABLE_ICON_NAMES, LUCIDE_ICON_MAP } from '../components/finance/categories';

// Category presets for quick navigation
export interface IconCategoryPreset {
    id: string;
    label: string;
    icons: string[];
}

export interface AiIconCandidate {
    iconName: string;
    reason: string;
    relevance?: string;
}

// Built-in curated popular icons for quick browsing
export const POPULAR_ICON_PRESETS: IconCategoryPreset[] = [
    {
        id: 'popular',
        label: 'Popular',
        icons: [
            'Wallet', 'CreditCard', 'Banknote', 'PiggyBank', 'Receipt', 'Coins', 'Landmark', 'TrendingUp',
            'Utensils', 'Pizza', 'Coffee', 'Car', 'Fuel', 'Plane', 'Home', 'Lightbulb',
            'Zap', 'Droplets', 'Wifi', 'Smartphone', 'Film', 'Gamepad2', 'ShoppingBag', 'Shirt',
            'HeartPulse', 'Stethoscope', 'Dumbbell', 'Briefcase', 'GraduationCap', 'Gift', 'Sparkles', 'Tag'
        ]
    },
    {
        id: 'food',
        label: 'Food & Dining',
        icons: [
            'Utensils', 'UtensilsCrossed', 'Pizza', 'Coffee', 'Sandwich', 'Apple', 'Carrot', 'Milk',
            'CupSoda', 'Beer', 'Wine', 'Cake', 'CookingPot', 'Soup', 'Cookie', 'Cherry',
            'Citrus', 'Grape', 'Fish', 'Egg', 'Hop', 'IceCream', 'Salad', 'Wheat'
        ]
    },
    {
        id: 'transport',
        label: 'Transport & Travel',
        icons: [
            'Car', 'CarFront', 'CarTaxiFront', 'Fuel', 'Plane', 'PlaneTakeoff', 'PlaneLanding', 'Train',
            'TrainTrack', 'TramFront', 'Bus', 'BusFront', 'Bike', 'Navigation', 'MapPin', 'Map',
            'Compass', 'Luggage', 'Ticket', 'Ship', 'Anchor', 'Gauge', 'ParkingCircle', 'Key'
        ]
    },
    {
        id: 'bills',
        label: 'Bills & Utilities',
        icons: [
            'Zap', 'Lightbulb', 'Droplets', 'Flame', 'Wifi', 'Smartphone', 'Tv', 'Plug',
            'BatteryCharging', 'Router', 'Radio', 'Signal', 'Shield', 'ShieldCheck', 'Hammer', 'Wrench',
            'Trash2', 'Sparkles', 'SprayCan', 'KeyRound', 'Server', 'Cpu'
        ]
    },
    {
        id: 'health',
        label: 'Health & Fitness',
        icons: [
            'HeartPulse', 'Heart', 'Stethoscope', 'BriefcaseMedical', 'Dumbbell', 'Activity', 'Pill', 'Thermometer',
            'Syringe', 'Cross', 'Apple', 'Footprints', 'Flame', 'Trophy', 'Award', 'Smile',
            'Eye', 'BedDouble', 'ShieldPlus', 'Brain', 'Accessibility'
        ]
    },
    {
        id: 'shopping',
        label: 'Shopping & Style',
        icons: [
            'ShoppingBag', 'ShoppingBasket', 'ShoppingCart', 'Shirt', 'Store', 'Tag', 'Sparkles', 'Gem',
            'Watch', 'Glasses', 'Gift', 'Package', 'Scissors', 'Footprints', 'Umbrella', 'Crown',
            'Barcode', 'Receipt', 'Percent', 'Boxes'
        ]
    },
    {
        id: 'finance',
        label: 'Finance & Wealth',
        icons: [
            'Wallet', 'CreditCard', 'Banknote', 'PiggyBank', 'Landmark', 'TrendingUp', 'TrendingDown', 'Receipt',
            'Coins', 'DollarSign', 'Percent', 'Handshake', 'Scale', 'Calculator', 'LineChart', 'BarChart3',
            'PieChart', 'BadgeDollarSign', 'Building2', 'Vault', 'CircleDollarSign'
        ]
    },
    {
        id: 'work',
        label: 'Work & Learning',
        icons: [
            'Briefcase', 'GraduationCap', 'Laptop', 'Monitor', 'BookOpen', 'BookText', 'School', 'Backpack',
            'Pencil', 'PenTool', 'FileText', 'Folder', 'Calendar', 'Clock', 'Mail', 'Send',
            'Users', 'UserCheck', 'Award', 'Trophy', 'Target', 'Compass'
        ]
    },
    {
        id: 'entertainment',
        label: 'Fun & Life',
        icons: [
            'Film', 'Tv', 'Clapperboard', 'Gamepad2', 'Music', 'Headphones', 'Camera', 'Video',
            'PartyPopper', 'Cake', 'Sparkles', 'Palette', 'Dices', 'Ticket', 'Popcorn', 'Mic'
        ]
    }
];

// Rich semantic dictionary mapping terms (English + Hinglish synonyms) to Lucide icon names
export const SEMANTIC_TERM_MAP: Record<string, string[]> = {
    // Medical & Doctor
    doctor: ['Stethoscope', 'HeartPulse', 'BriefcaseMedical', 'Activity'],
    physician: ['Stethoscope', 'BriefcaseMedical'],
    clinic: ['Stethoscope', 'Building2', 'BriefcaseMedical'],
    hospital: ['Building2', 'BriefcaseMedical', 'HeartPulse', 'Stethoscope'],
    medical: ['BriefcaseMedical', 'Stethoscope', 'Pill', 'HeartPulse'],
    medicine: ['Pill', 'BriefcaseMedical', 'HeartPulse'],
    dawa: ['Pill', 'BriefcaseMedical'],
    pharma: ['Pill', 'BriefcaseMedical'],
    pharmacy: ['Pill', 'BriefcaseMedical', 'Store'],
    checkup: ['Stethoscope', 'HeartPulse', 'Activity'],
    dentist: ['Smile', 'HeartPulse'],
    teeth: ['Smile'],
    
    // Gym & Fitness
    gym: ['Dumbbell', 'Activity', 'HeartPulse', 'Flame', 'Trophy'],
    workout: ['Dumbbell', 'Activity', 'Flame'],
    fitness: ['Dumbbell', 'Activity', 'HeartPulse'],
    exercise: ['Dumbbell', 'Activity', 'Footprints'],
    training: ['Dumbbell', 'Target', 'Trophy'],
    weights: ['Dumbbell', 'Scale'],
    cultfit: ['Dumbbell', 'Flame', 'Activity'],
    yoga: ['Heart', 'Activity', 'Smile'],
    khelo: ['Trophy', 'Dumbbell', 'Activity'],
    sports: ['Trophy', 'Award', 'Activity'],

    // Food & Dining
    food: ['Utensils', 'Pizza', 'Coffee', 'ShoppingBasket', 'Soup'],
    khana: ['Utensils', 'CookingPot', 'Pizza', 'Soup'],
    dinner: ['Utensils', 'Wine', 'Soup', 'CookingPot'],
    lunch: ['Utensils', 'Sandwich', 'Soup'],
    breakfast: ['Coffee', 'Egg', 'CupSoda', 'Cookie'],
    nashta: ['Coffee', 'Cookie', 'CupSoda'],
    restaurant: ['Utensils', 'UtensilsCrossed', 'Store'],
    hotel: ['Utensils', 'Building2', 'BedDouble'],
    swiggy: ['Utensils', 'ShoppingBag', 'Pizza', 'Bike'],
    zomato: ['Utensils', 'Pizza', 'CookingPot', 'Bike'],
    mcdonalds: ['Utensils', 'CupSoda'],
    burger: ['Sandwich', 'Utensils'],
    pizza: ['Pizza', 'Utensils'],
    chai: ['Coffee', 'CupSoda'],
    tea: ['Coffee', 'CupSoda'],
    coffee: ['Coffee', 'CupSoda'],
    cafe: ['Coffee', 'CupSoda', 'Store'],
    boba: ['CupSoda'],
    dudh: ['Milk'],
    milk: ['Milk'],
    bread: ['Sandwich', 'Cookie'],
    bakery: ['Cake', 'Cookie', 'Wheat'],
    sweets: ['Cake', 'Cookie', 'Sparkles'],
    mithai: ['Cake', 'Cookie'],

    // Groceries
    grocery: ['ShoppingBasket', 'ShoppingCart', 'Apple', 'Carrot', 'Package'],
    groceries: ['ShoppingBasket', 'ShoppingCart', 'Apple', 'Package'],
    kirana: ['ShoppingBasket', 'Store', 'Package'],
    zepto: ['ShoppingBasket', 'Zap', 'Clock', 'Bike'],
    blinkit: ['ShoppingBasket', 'Zap', 'Package', 'Bike'],
    instamart: ['ShoppingBasket', 'Package'],
    supermarket: ['ShoppingCart', 'Store'],
    vegetables: ['Carrot', 'Apple', 'Salad'],
    sabzi: ['Carrot', 'Apple'],
    fruits: ['Apple', 'Cherry', 'Citrus', 'Grape'],
    ration: ['Package', 'Wheat', 'ShoppingBasket'],

    // Transport & Vehicles
    petrol: ['Fuel', 'Car', 'Gauge'],
    diesel: ['Fuel', 'Truck', 'Car'],
    fuel: ['Fuel', 'Gauge'],
    cng: ['Fuel', 'Flame'],
    car: ['Car', 'CarFront', 'Navigation'],
    gadi: ['Car', 'CarFront', 'Bike'],
    bike: ['Bike', 'Navigation'],
    scooter: ['Bike'],
    uber: ['Car', 'CarTaxiFront', 'Navigation', 'MapPin'],
    ola: ['Car', 'CarTaxiFront', 'Navigation'],
    taxi: ['CarTaxiFront', 'Car', 'Ticket'],
    cab: ['CarTaxiFront', 'Car'],
    auto: ['CarTaxiFront', 'Navigation'],
    rickshaw: ['CarTaxiFront', 'Navigation'],
    train: ['Train', 'TrainTrack', 'TramFront'],
    railway: ['Train', 'TrainTrack'],
    metro: ['Train', 'TramFront', 'Subway'],
    irctc: ['Train', 'Ticket'],
    flight: ['Plane', 'PlaneTakeoff', 'Ticket', 'Luggage'],
    plane: ['Plane', 'PlaneTakeoff'],
    airport: ['Plane', 'Building2', 'Luggage'],
    airline: ['Plane', 'Ticket'],
    travel: ['Plane', 'Luggage', 'Compass', 'MapPin', 'Globe'],
    trip: ['Luggage', 'Plane', 'Compass'],
    holiday: ['Palmtree', 'Sun', 'Luggage', 'Plane'],
    vacation: ['Palmtree', 'Plane', 'Luggage'],
    toll: ['Receipt', 'Car', 'Barrier'],
    fastag: ['Car', 'Zap', 'CreditCard'],
    parking: ['ParkingCircle', 'Car'],

    // Housing & Utilities
    rent: ['Home', 'Building2', 'Key', 'KeyRound'],
    kiraya: ['Home', 'Building2', 'Key'],
    home: ['Home', 'Building'],
    house: ['Home', 'Building2'],
    flat: ['Building2', 'Home'],
    apartment: ['Building2', 'Home'],
    society: ['Building2', 'Users'],
    maintenance: ['Wrench', 'Hammer', 'Building2'],
    electricity: ['Zap', 'Lightbulb', 'Plug'],
    bijli: ['Zap', 'Lightbulb'],
    power: ['Zap', 'BatteryCharging'],
    water: ['Droplets', 'GlassWater'],
    pani: ['Droplets'],
    gas: ['Flame', 'Gauge'],
    cylinder: ['Flame', 'Gauge'],
    wifi: ['Wifi', 'Router', 'Globe'],
    internet: ['Wifi', 'Globe', 'Router'],
    broadband: ['Wifi', 'Router'],
    fiber: ['Wifi', 'Zap'],
    mobile: ['Smartphone', 'PhoneCall', 'Signal'],
    recharge: ['Smartphone', 'Zap', 'RefreshCw'],
    airtel: ['Signal', 'Smartphone', 'Wifi'],
    jio: ['Signal', 'Smartphone', 'Wifi'],
    phone: ['Smartphone', 'PhoneCall'],

    // Entertainment & OTT
    movie: ['Film', 'Clapperboard', 'Popcorn', 'Ticket'],
    cinema: ['Film', 'Clapperboard', 'Ticket'],
    film: ['Film', 'Camera'],
    theatre: ['Film', 'Ticket'],
    netflix: ['Tv', 'Film', 'Monitor'],
    prime: ['Tv', 'Package', 'Film'],
    hotstar: ['Tv', 'Trophy', 'Film'],
    youtube: ['Video', 'Tv', 'Play'],
    spotify: ['Headphones', 'Music', 'Radio'],
    music: ['Music', 'Headphones', 'Mic'],
    party: ['PartyPopper', 'Beer', 'Cake', 'Sparkles'],
    game: ['Gamepad2', 'Gamepad', 'Joystick', 'Trophy'],
    gaming: ['Gamepad2', 'Gamepad', 'Tv'],
    steam: ['Gamepad2', 'Laptop'],
    playstation: ['Gamepad2', 'Tv'],

    // Shopping & Style
    shopping: ['ShoppingBag', 'ShoppingBasket', 'ShoppingCart', 'Store'],
    clothes: ['Shirt', 'ShoppingBag'],
    kapde: ['Shirt'],
    dress: ['Shirt', 'Sparkles'],
    shoes: ['Footprints'],
    fashion: ['Shirt', 'Gem', 'Watch', 'Sparkles'],
    amazon: ['Package', 'ShoppingCart', 'ShoppingBag'],
    flipkart: ['ShoppingBag', 'Package'],
    myntra: ['Shirt', 'ShoppingBag'],
    meesho: ['ShoppingBag', 'Package'],
    jewellery: ['Gem', 'Sparkles', 'Crown'],
    gold: ['Gem', 'Coins', 'Sparkles'],
    watch: ['Watch', 'Clock'],
    salon: ['Scissors', 'Sparkles'],
    barber: ['Scissors'],
    haircut: ['Scissors'],
    parlour: ['Sparkles', 'Smile'],
    beauty: ['Sparkles', 'Flower2'],

    // Work, Education & Office
    salary: ['Landmark', 'Banknote', 'Briefcase', 'TrendingUp'],
    kamai: ['Banknote', 'Landmark', 'Coins'],
    income: ['TrendingUp', 'Banknote', 'Landmark'],
    bonus: ['Gift', 'TrendingUp', 'Award'],
    office: ['Briefcase', 'Building2', 'Laptop'],
    work: ['Briefcase', 'Laptop'],
    freelance: ['Laptop', 'Code', 'Globe'],
    consulting: ['Briefcase', 'Users'],
    education: ['GraduationCap', 'BookOpen', 'School'],
    school: ['School', 'GraduationCap', 'Backpack'],
    college: ['GraduationCap', 'School', 'BookOpen'],
    fees: ['GraduationCap', 'Receipt', 'CreditCard'],
    tuition: ['GraduationCap', 'BookOpen', 'Pencil'],
    course: ['BookOpen', 'GraduationCap', 'Laptop'],
    books: ['BookOpen', 'BookText'],
    kitab: ['BookOpen'],
    exam: ['FileCheck', 'Pencil', 'GraduationCap'],

    // Wealth, Crypto & Investments
    investment: ['TrendingUp', 'PiggyBank', 'LineChart', 'Landmark'],
    stocks: ['TrendingUp', 'LineChart', 'BarChart3'],
    shares: ['TrendingUp', 'PieChart'],
    mutualfund: ['TrendingUp', 'PieChart', 'PiggyBank'],
    sip: ['PiggyBank', 'RefreshCw', 'TrendingUp'],
    zerodha: ['TrendingUp', 'LineChart'],
    groww: ['TrendingUp', 'PiggyBank'],
    crypto: ['Coins', 'Bitcoin', 'TrendingUp'],
    bitcoin: ['Bitcoin', 'Coins'],
    savings: ['PiggyBank', 'Vault', 'Landmark'],
    bank: ['Landmark', 'CreditCard', 'Vault'],
    atm: ['Banknote', 'CreditCard', 'Landmark'],
    cash: ['Banknote', 'Wallet', 'Coins'],
    wallet: ['Wallet', 'CreditCard'],
    creditcard: ['CreditCard', 'Receipt'],
    loan: ['Handshake', 'Landmark', 'Scale'],
    emi: ['Calendar', 'Landmark', 'CreditCard'],
    udhar: ['Handshake', 'Users'],
    debt: ['Scale', 'Handshake'],
    interest: ['Percent', 'TrendingUp'],
    tax: ['Receipt', 'FileText', 'Scale'],
    gst: ['Receipt', 'Calculator'],
    insurance: ['ShieldCheck', 'Shield', 'FileCheck'],
    lic: ['ShieldCheck', 'Landmark'],

    // Personal, Family & Giving
    gift: ['Gift', 'Sparkles', 'PartyPopper'],
    birthday: ['Cake', 'PartyPopper', 'Gift'],
    anniversary: ['Heart', 'Gift', 'Wine'],
    diwali: ['Sparkles', 'Flame', 'Gift'],
    eid: ['Moon', 'Sparkles', 'Gift'],
    donation: ['HeartHandshake', 'HelpingHand', 'Gift'],
    charity: ['HeartHandshake', 'Heart'],
    zakat: ['HeartHandshake', 'Coins', 'HelpingHand'],
    sadqa: ['HeartHandshake', 'Gift'],
    pet: ['Dog', 'Cat', 'Bone'],
    dog: ['Dog', 'Bone'],
    cat: ['Cat'],
    baby: ['Baby', 'Heart'],
    kids: ['Baby', 'Smile', 'Heart'],
    maid: ['Sparkles', 'SprayCan', 'Shirt'],
    safai: ['Sparkles', 'Trash2', 'SprayCan']
};

// In-memory cache for dynamic official tags from lucide-static/tags.json
let officialTagsCache: Record<string, string[]> | null = null;
let isFetchingOfficialTags = false;

// Kebab-case to PascalCase utility (e.g. 'credit-card' -> 'CreditCard')
export function kebabToPascal(str: string): string {
    return str
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

// PascalCase to Kebab-case utility (e.g. 'CreditCard' -> 'credit-card')
export function pascalToKebab(str: string): string {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
}

/**
 * Fetch official tags from cdn.jsdelivr.net/npm/lucide-static/tags.json with caching
 */
export async function loadOfficialLucideTags(): Promise<Record<string, string[]>> {
    if (officialTagsCache) {
        return officialTagsCache;
    }

    // Check localStorage cache
    try {
        const cached = localStorage.getItem('ceaznet_lucide_tags_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') {
                officialTagsCache = parsed;
                return parsed;
            }
        }
    } catch {
        // continue to fetch
    }

    if (isFetchingOfficialTags) {
        return {};
    }

    isFetchingOfficialTags = true;
    try {
        const res = await fetch('https://cdn.jsdelivr.net/npm/lucide-static/tags.json', { cache: 'force-cache' });
        if (res.ok) {
            const data = await res.json();
            officialTagsCache = data;
            try {
                localStorage.setItem('ceaznet_lucide_tags_cache', JSON.stringify(data));
            } catch {
                // Ignore storage limits
            }
            return data;
        }
    } catch (err) {
        console.warn('Could not fetch lucide-static tags.json, using built-in semantic map:', err);
    } finally {
        isFetchingOfficialTags = false;
    }

    return {};
}

// Start loading official tags in background immediately
loadOfficialLucideTags().catch(() => {});

/**
 * Clean list of all valid Lucide icon component names
 */
export const VALID_LUCIDE_NAMES: string[] = (() => {
    return Object.keys(LucideIcons).filter(name => {
        if (!/^[A-Z]/.test(name)) return false;
        if (name.endsWith('Icon') || name.endsWith('Context') || name.endsWith('Provider')) return false;
        if (name === 'createLucideIcon' || name === 'LucideProps' || name === 'HelpCircle') return false;
        // AGENTS.md rule: NEVER use Loader2
        if (name === 'Loader2') return false;
        const item = (LucideIcons as any)[name];
        return typeof item === 'function' || typeof item === 'object';
    });
})();

/**
 * Native Lucide React Search Engine
 * Searches across PascalCase names, synonyms, semantic terms, and official tags.
 */
export function searchLucideIcons(
    query: string,
    options?: {
        categoryPreset?: string;
        limit?: number;
    }
): string[] {
    const cleanQuery = (query || '').trim().toLowerCase();
    const limit = options?.limit || 72;

    // If category preset selected (and no query), return preset icons
    if (!cleanQuery && options?.categoryPreset && options.categoryPreset !== 'all') {
        const preset = POPULAR_ICON_PRESETS.find(p => p.id === options.categoryPreset);
        if (preset) {
            return preset.icons.filter(name => (LUCIDE_ICON_MAP as any)[name]);
        }
    }

    // If query is empty, default to popular icons followed by general icons
    if (!cleanQuery) {
        const popular = POPULAR_ICON_PRESETS[0].icons;
        const rest = VALID_LUCIDE_NAMES.filter(n => !popular.includes(n));
        return [...popular, ...rest].slice(0, limit);
    }

    const scoredMap = new Map<string, number>();

    const assignScore = (iconName: string, score: number) => {
        if (!VALID_LUCIDE_NAMES.includes(iconName)) return;
        const current = scoredMap.get(iconName) || 0;
        if (score > current) {
            scoredMap.set(iconName, score);
        }
    };

    // 1. Check direct semantic map matches
    for (const [term, icons] of Object.entries(SEMANTIC_TERM_MAP)) {
        if (term === cleanQuery) {
            icons.forEach((ic, idx) => assignScore(ic, 120 - idx * 2));
        } else if (cleanQuery.includes(term) || term.includes(cleanQuery)) {
            icons.forEach((ic, idx) => assignScore(ic, 85 - idx * 2));
        }
    }

    // 2. Check official tags from lucide-static if available
    if (officialTagsCache) {
        for (const [kebab, tags] of Object.entries(officialTagsCache)) {
            const pascal = kebabToPascal(kebab);
            if (!VALID_LUCIDE_NAMES.includes(pascal)) continue;

            if (kebab === cleanQuery || kebab.replace(/-/g, '') === cleanQuery) {
                assignScore(pascal, 110);
            } else if (kebab.startsWith(cleanQuery)) {
                assignScore(pascal, 95);
            } else if (kebab.includes(cleanQuery)) {
                assignScore(pascal, 80);
            }

            if (Array.isArray(tags)) {
                for (const tag of tags) {
                    const tagLower = tag.toLowerCase();
                    if (tagLower === cleanQuery) {
                        assignScore(pascal, 90);
                        break;
                    } else if (tagLower.startsWith(cleanQuery)) {
                        assignScore(pascal, 75);
                    } else if (tagLower.includes(cleanQuery)) {
                        assignScore(pascal, 60);
                    }
                }
            }
        }
    }

    // 3. Check icon names directly
    const queryParts = cleanQuery.split(/[\s_-]+/).filter(Boolean);
    for (const name of VALID_LUCIDE_NAMES) {
        const lowerName = name.toLowerCase();
        
        // Exact name match
        if (lowerName === cleanQuery) {
            assignScore(name, 100);
            continue;
        }

        // Prefix match
        if (lowerName.startsWith(cleanQuery)) {
            assignScore(name, 85);
            continue;
        }

        // Multi-word / camelCase parts match
        const pascalParts = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
        if (pascalParts.includes(cleanQuery)) {
            assignScore(name, 70);
            continue;
        }

        // Partial word match
        const allPartsMatched = queryParts.every(p => lowerName.includes(p) || pascalParts.includes(p));
        if (allPartsMatched && queryParts.length > 0) {
            assignScore(name, 65);
        }
    }

    // Sort by descending score
    const results = Array.from(scoredMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

    return results.slice(0, limit);
}

/**
 * AI-powered Icon Search & Suggestion Engine
 * Interprets brand names, contextual prompts, Hinglish, or complex terms using Gemini.
 */
export async function suggestIconsWithAi(
    queryOrName: string,
    context?: {
        categoryName?: string;
        type?: 'expense' | 'income' | 'transfer';
        description?: string;
    }
): Promise<{
    suggestions: AiIconCandidate[];
    topPick: string;
    rationale: string;
}> {
    const ai = getAiClient();
    const query = (queryOrName || context?.categoryName || '').trim();
    const categoryType = context?.type || 'expense';
    const description = context?.description || '';

    if (!query) {
        return {
            suggestions: [],
            topPick: 'Tag',
            rationale: 'Please provide a category name or search query for AI suggestions.'
        };
    }

    const prompt = `You are a specialized icon curator for an advanced personal finance and digital ledger application.
Task: The user wants the best possible Lucide React icon(s) for the concept, brand, or category: "${query}".
Category Type: ${categoryType}
${description ? `Context/Transaction Description: "${description}"` : ''}

CRITICAL RULES:
1. Brand & Regional Identification: If "${query}" is a company, app, restaurant, fintech, medicine, Hinglish slang, or brand name (such as Swiggy, Zomato, Cultfit, Zepto, Blinkit, CRED, Fastag, Zerodha, Groww, Spotify, Netflix, Dunzo, Apollo, Dolo 650, Challan, Kirana, Dudh, Bijli, Udhar), USE GOOGLE SEARCH to research what product/service it represents!
2. Lucide Icon Matching: Choose 6 to 8 unique, highly relevant icon names available in Lucide React (PascalCase, e.g., "Dumbbell", "Utensils", "Pizza", "Fuel", "Plane", "CreditCard", "PiggyBank", "Stethoscope", "Pill", "ShoppingBag", "Gamepad2", "Zap", "Film").
3. DO NOT output "Loader2" or non-existent icon names.
4. For each icon, provide a punchy 1-sentence explanation of why it aligns with the search term/brand.
5. Identify the single best top pick ("topPick").

Respond strictly in valid JSON format matching this schema:
{
  "topPick": string,
  "rationale": string,
  "candidates": [
    {
      "iconName": string,
      "reason": string,
      "relevance": string
    }
  ]
}`;

    let parsed: { topPick?: string; rationale?: string; candidates?: Array<{ iconName: string; reason: string; relevance?: string }> } = {};

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
            console.warn('[AI Icon Search] Google Search tool unavailable, falling back to standard model generation:', searchError);
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
    } catch (err) {
        console.error('[AI Icon Search] Error executing AI icon search:', err);
    }

    // Filter valid Lucide candidates that actually exist in lucide-react
    const candidates: AiIconCandidate[] = [];
    if (Array.isArray(parsed.candidates)) {
        for (const cand of parsed.candidates) {
            if (cand.iconName && VALID_LUCIDE_NAMES.includes(cand.iconName)) {
                if (!candidates.some(c => c.iconName === cand.iconName)) {
                    candidates.push({
                        iconName: cand.iconName,
                        reason: cand.reason || `AI matched ${cand.iconName} for ${query}`,
                        relevance: cand.relevance || 'High'
                    });
                }
            }
        }
    }

    // If topPick is valid, ensure it's first
    let topPick = parsed.topPick && VALID_LUCIDE_NAMES.includes(parsed.topPick) 
        ? parsed.topPick 
        : candidates[0]?.iconName || 'Tag';

    // If candidates list is empty (e.g. AI returned unknown icons), fallback to native search
    if (candidates.length === 0) {
        const nativeMatches = searchLucideIcons(query, { limit: 6 });
        nativeMatches.forEach(name => {
            candidates.push({
                iconName: name,
                reason: `Semantic match for "${query}"`,
                relevance: 'Match'
            });
        });
        if (nativeMatches.length > 0) {
            topPick = nativeMatches[0];
        }
    }

    return {
        suggestions: candidates,
        topPick,
        rationale: parsed.rationale || `AI analyzed "${query}" and suggested ${candidates.length} matching Lucide icons.`
    };
}
