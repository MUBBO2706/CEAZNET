import * as LucideIcons from 'lucide-react';
import { createUniversalIconComponent, CategoryIcon } from './CategoryIcon';

export { createUniversalIconComponent, CategoryIcon } from './CategoryIcon';
export { Tag, Calendar, Clock } from 'lucide-react';

// Color palettes for consistent UI
const colors = {
    orange: { t: 'text-orange-500', b: 'bg-orange-100 dark:bg-orange-900/30' },
    indigo: { t: 'text-indigo-500', b: 'bg-indigo-100 dark:bg-indigo-900/30' },
    rose: { t: 'text-rose-500', b: 'bg-rose-100 dark:bg-rose-900/30' },
    yellow: { t: 'text-yellow-600', b: 'bg-yellow-100 dark:bg-yellow-900/30' },
    blue: { t: 'text-blue-500', b: 'bg-blue-100 dark:bg-blue-900/30' },
    pink: { t: 'text-pink-500', b: 'bg-pink-100 dark:bg-pink-900/30' },
    green: { t: 'text-green-500', b: 'bg-green-100 dark:bg-green-900/30' },
    teal: { t: 'text-teal-500', b: 'bg-teal-100 dark:bg-teal-900/30' },
    purple: { t: 'text-purple-500', b: 'bg-purple-100 dark:bg-purple-900/30' },
    amber: { t: 'text-amber-600', b: 'bg-amber-100 dark:bg-amber-900/30' },
    cyan: { t: 'text-cyan-500', b: 'bg-cyan-100 dark:bg-cyan-900/30' },
    slate: { t: 'text-slate-600', b: 'bg-slate-100 dark:bg-slate-800' },
    sky: { t: 'text-sky-500', b: 'bg-sky-100 dark:bg-sky-900/30' },
    zinc: { t: 'text-zinc-600', b: 'bg-zinc-100 dark:bg-zinc-800' },
    gray: { t: 'text-gray-500', b: 'bg-gray-100 dark:bg-gray-800' },
    emerald: { t: 'text-emerald-600', b: 'bg-emerald-100 dark:bg-emerald-900/30' },
    fuchsia: { t: 'text-fuchsia-500', b: 'bg-fuchsia-100 dark:bg-fuchsia-900/30' },
    lime: { t: 'text-lime-600', b: 'bg-lime-100 dark:bg-lime-900/30' },
    violet: { t: 'text-violet-500', b: 'bg-violet-100 dark:bg-violet-900/30' },
    red: { t: 'text-red-500', b: 'bg-red-100 dark:bg-red-900/30' },
};

export interface CategoryDefinition {
    id: string;
    label: string;
    iconName: string;
    icon?: any;
    color: string;
    bg: string;
    isCustom?: boolean;
    type?: 'expense' | 'income' | 'transfer';
}

// Curated definitions using the best matched icons across all 7 libraries
export const RAW_CATEGORY_CONFIG: {
    expense: CategoryDefinition[];
    income: CategoryDefinition[];
    transfer: CategoryDefinition[];
} = {
    expense: [
        // --- Food & Drink ---
        { id: 'Food', label: 'Dining Out', iconName: 'hugeicons:serving-food', color: colors.orange.t, bg: colors.orange.b },
        { id: 'Groceries', label: 'Groceries', iconName: 'heroicons:shopping-cart', color: colors.green.t, bg: colors.green.b },
        { id: 'Vegetables', label: 'Vegetables', iconName: 'ph:carrot-duotone', color: colors.green.t, bg: colors.green.b },
        { id: 'Fruits', label: 'Fruits', iconName: 'tabler:apple', color: colors.red.t, bg: colors.red.b },
        { id: 'Dairy', label: 'Milk / Dairy', iconName: 'hugeicons:milk-bottle', color: colors.sky.t, bg: colors.sky.b },
        { id: 'Breakfast', label: 'Breakfast', iconName: 'tabler:egg-fried', color: colors.amber.t, bg: colors.amber.b },
        { id: 'Chai', label: 'Chai / Tea', iconName: 'solar:cup-hot-bold-duotone', color: colors.amber.t, bg: colors.amber.b },
        { id: 'StreetFood', label: 'Street Food', iconName: 'hugeicons:noodles', color: colors.orange.t, bg: colors.orange.b },
        { id: 'Coffee', label: 'Coffee & Cafe', iconName: 'ph:coffee-duotone', color: colors.amber.t, bg: colors.amber.b },
        { id: 'Alcohol', label: 'Alcohol & Bars', iconName: 'ph:beer-bottle-duotone', color: colors.rose.t, bg: colors.rose.b },
        { id: 'Snacks', label: 'Snacks', iconName: 'hugeicons:biscuit', color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Soft Drinks', label: 'Soft Drinks', iconName: 'hugeicons:soft-drink-02', color: colors.teal.t, bg: colors.teal.b },
        { id: 'WaterBottle', label: 'Drinking Water', iconName: 'solar:bottle-bold-duotone', color: colors.sky.t, bg: colors.sky.b },
        { id: 'FastFood_Junk', label: 'Burgers & Pizza', iconName: 'ph:hamburger-duotone', color: colors.orange.t, bg: colors.orange.b },

        // --- Transport ---
        { id: 'Transport', label: 'Public Transport', iconName: 'solar:bus-bold', color: colors.blue.t, bg: colors.blue.b },
        { id: 'Fuel', label: 'Fuel / Gas', iconName: 'ri:gas-station-fill', color: colors.red.t, bg: colors.red.b },
        { id: 'Cab', label: 'Taxi / Cab', iconName: 'hugeicons:car-02', color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Parking', label: 'Parking', iconName: 'tabler:parking', color: colors.slate.t, bg: colors.slate.b },
        { id: 'Tolls', label: 'Tolls', iconName: 'solar:routing-2-bold-duotone', color: colors.slate.t, bg: colors.slate.b },
        { id: 'Maintenance', label: 'Car Service', iconName: 'tabler:car-crash', color: colors.gray.t, bg: colors.gray.b },
        { id: 'Bike Repair', label: 'Bike Repair', iconName: 'hugeicons:motorbike-01', color: colors.blue.t, bg: colors.blue.b },
        { id: 'Flights', label: 'Flights', iconName: 'hugeicons:airplane-01', color: colors.sky.t, bg: colors.sky.b },
        { id: 'Train', label: 'Train / Metro', iconName: 'ph:train-duotone', color: colors.blue.t, bg: colors.blue.b },

        // --- Housing & Utilities ---
        { id: 'Rent', label: 'Rent', iconName: 'hugeicons:real-estate-01', color: colors.teal.t, bg: colors.teal.b },
        { id: 'Electricity', label: 'Electricity Bill', iconName: 'ph:lightning-duotone', color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Water', label: 'Water Bill', iconName: 'solar:water-bold-duotone', color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Wifi', label: 'Internet / Wifi', iconName: 'ph:wifi-high-duotone', color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Gas', label: 'Home Gas', iconName: 'solar:flame-bold-duotone', color: colors.orange.t, bg: colors.orange.b },
        { id: 'Maid', label: 'Househelp / Maid', iconName: 'solar:broom-bold-duotone', color: colors.pink.t, bg: colors.pink.b },
        { id: 'Maintenance_Home', label: 'Home Repairs', iconName: 'lucide:drill', color: colors.gray.t, bg: colors.gray.b },
        { id: 'Building Materials', label: 'Building Materials', iconName: 'lucide:brick-wall', color: colors.orange.t, bg: colors.orange.b },
        { id: 'Decor', label: 'Home Decor', iconName: 'solar:sofa-2-bold-duotone', color: colors.emerald.t, bg: colors.emerald.b },

        // --- Personal & Lifestyle ---
        { id: 'Personal', label: 'Personal Care', iconName: 'ph:user-circle-duotone', color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Personal Payments', label: 'Personal Payments', iconName: 'hugeicons:peer-to-peer-01', color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Shopping', label: 'Shopping', iconName: 'solar:bag-heart-bold-duotone', color: colors.pink.t, bg: colors.pink.b },
        { id: 'Clothes', label: 'Clothing', iconName: 'ph:t-shirt-duotone', color: colors.violet.t, bg: colors.violet.b },
        { id: 'Accessories', label: 'Accessories', iconName: 'hugeicons:belt', color: colors.purple.t, bg: colors.purple.b },
        { id: 'Salon', label: 'Salon / Barber', iconName: 'solar:scissors-bold-duotone', color: colors.fuchsia.t, bg: colors.fuchsia.b },
        { id: 'Gym', label: 'Gym & Fitness', iconName: 'solar:dumbbell-large-bold-duotone', color: colors.slate.t, bg: colors.slate.b },
        { id: 'Cosmetics', label: 'Cosmetics', iconName: 'solar:magic-stick-3-bold-duotone', color: colors.pink.t, bg: colors.pink.b },
        { id: 'Laundry', label: 'Laundry', iconName: 'hugeicons:washing-machine', color: colors.cyan.t, bg: colors.cyan.b },
        
        // --- Health ---
        { id: 'Health', label: 'Doctor / Health', iconName: 'solar:heart-pulse-bold-duotone', color: colors.rose.t, bg: colors.rose.b },
        { id: 'Medicine', label: 'Medicines', iconName: 'ph:first-aid-kit-duotone', color: colors.red.t, bg: colors.red.b },
        { id: 'Insurance', label: 'Insurance', iconName: 'hugeicons:policy', color: colors.emerald.t, bg: colors.emerald.b },
        
        // --- Entertainment ---
        { id: 'Entertainment', label: 'Movies & Fun', iconName: 'solar:tv-bold-duotone', color: colors.purple.t, bg: colors.purple.b },
        { id: 'Subscriptions', label: 'OTT / Subs', iconName: 'ph:film-strip-duotone', color: colors.red.t, bg: colors.red.b },
        { id: 'Gaming', label: 'Gaming', iconName: 'solar:gamepad-bold-duotone', color: colors.violet.t, bg: colors.violet.b },
        { id: 'Events', label: 'Concerts / Events', iconName: 'solar:ticket-sale-bold-duotone', color: colors.amber.t, bg: colors.amber.b },
        { id: 'Hobbies', label: 'Hobbies', iconName: 'solar:palette-bold-duotone', color: colors.orange.t, bg: colors.orange.b },
        
        // --- Tech ---
        { id: 'Mobile', label: 'Mobile Bill', iconName: 'hugeicons:smartphone-wifi', color: colors.zinc.t, bg: colors.zinc.b },
        { id: 'Mobile Repair', label: 'Mobile Repair', iconName: 'solar:smartphone-update-bold-duotone', color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Gadgets', label: 'Electronics', iconName: 'solar:laptop-minimalistic-bold-duotone', color: colors.slate.t, bg: colors.slate.b },
        { id: 'Software', label: 'Software / Apps', iconName: 'hugeicons:app-store', color: colors.blue.t, bg: colors.blue.b },
        { id: 'Server', label: 'Server / Hosting', iconName: 'solar:server-square-bold-duotone', color: colors.indigo.t, bg: colors.indigo.b },

        // --- Education ---
        { id: 'Education', label: 'Education', iconName: 'ph:graduation-cap-duotone', color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Tuition Fees', label: 'Tuition Fees', iconName: 'hugeicons:global-education', color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Books', label: 'Books', iconName: 'ph:book-open-duotone', color: colors.amber.t, bg: colors.amber.b },
        { id: 'Stationery', label: 'Stationery', iconName: 'ph:pen-nib-duotone', color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Courses', label: 'Online Courses', iconName: 'solar:laptop-2-bold-duotone', color: colors.blue.t, bg: colors.blue.b },

        // --- Social & Gifts ---
        { id: 'Gift', label: 'Gifts', iconName: 'lucide:gift', color: colors.pink.t, bg: colors.pink.b },
        { id: 'Donation', label: 'Charity / Donation', iconName: 'hugeicons:charity', color: colors.rose.t, bg: colors.rose.b },
        { id: 'Religious Event Expenses', label: 'Religious Event Expenses', iconName: 'hugeicons:zakat', color: colors.emerald.t, bg: colors.emerald.b },
        { id: 'Tip', label: 'Tips', iconName: 'ph:coins-duotone', color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Udhar_Given', label: 'Lent Given', iconName: 'hugeicons:money-send-01', color: colors.rose.t, bg: colors.rose.b },
        { id: 'Loan Repayment', label: 'Lent Repayment', iconName: 'hugeicons:payment-02', color: colors.indigo.t, bg: colors.indigo.b },

        // --- Family & Kids ---
        { id: 'Kids', label: 'Kids / Childcare', iconName: 'hugeicons:baby-boy-dress', color: colors.lime.t, bg: colors.lime.b },
        { id: 'Pets', label: 'Pet Care', iconName: 'ph:paw-print-duotone', color: colors.amber.t, bg: colors.amber.b },
        
        // --- Miscellaneous ---
        { id: 'Vacation', label: 'Travel / Vacation', iconName: 'ph:airplane-takeoff-duotone', color: colors.sky.t, bg: colors.sky.b },
        { id: 'Taxes', label: 'Taxes', iconName: 'tabler:receipt-2', color: colors.slate.t, bg: colors.slate.b },
        { id: 'Fines', label: 'Fines / Challan', iconName: 'tabler:gavel', color: colors.red.t, bg: colors.red.b },
        { id: 'Bank Fees', label: 'Bank Fees', iconName: 'solar:banknote-bold-duotone', color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Government Services', label: 'Government Services', iconName: 'ri:government-line', color: colors.slate.t, bg: colors.slate.b },
        { id: 'Lost Cash', label: 'Lost Cash', iconName: 'tabler:cash-off', color: colors.red.t, bg: colors.red.b },
        { id: 'Cigarettes', label: 'Tobacco', iconName: 'ph:cigarette-duotone', color: colors.gray.t, bg: colors.gray.b },
        { id: 'Other', label: 'Other', iconName: 'solar:menu-dots-bold-duotone', color: colors.gray.t, bg: colors.gray.b },
    ],
    
    income: [
        { id: 'Udhar_Back', label: 'Udhar Received', iconName: 'solar:users-group-rounded-bold-duotone', color: colors.emerald.t, bg: colors.emerald.b },
        { id: 'Udhar taken', label: 'Udhar taken', iconName: 'hugeicons:yen-receive', color: colors.teal.t, bg: colors.teal.b },
        { id: 'Salary', label: 'Salary', iconName: 'solar:hand-money-linear', color: colors.green.t, bg: colors.green.b },
        { id: 'Mobile Repair', label: 'Mobile Repair', iconName: 'solar:smartphone-update-bold-duotone', color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'MobileRepair', label: 'Mobile Repair', iconName: 'solar:smartphone-update-bold-duotone', color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Balance', label: 'Balance', iconName: 'solar:scale-bold-duotone', color: colors.teal.t, bg: colors.teal.b },
        { id: 'Business', label: 'Business Profit', iconName: 'solar:banknote-2-bold-duotone', color: colors.blue.t, bg: colors.blue.b },
        { id: 'Freelance', label: 'Freelancing', iconName: 'solar:laptop-minimalistic-bold-duotone', color: colors.purple.t, bg: colors.purple.b },
        { id: 'Trading', label: 'Stock Trading', iconName: 'solar:chart-2-bold-duotone', color: colors.emerald.t, bg: colors.emerald.b },
        { id: 'Youtube', label: 'Youtube Revenue', iconName: 'solar:videocamera-record-bold-duotone', color: colors.red.t, bg: colors.red.b },
        { id: 'Sponsorship', label: 'Sponsorships', iconName: 'ph:handshake-duotone', color: colors.blue.t, bg: colors.blue.b },
        { id: 'Affiliate', label: 'Affiliate Marketing', iconName: 'hugeicons:affiliate', color: colors.pink.t, bg: colors.pink.b },
        { id: 'Bonus', label: 'Bonus', iconName: 'solar:star-fall-bold-duotone', color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Investment', label: 'Investment Returns', iconName: 'solar:graph-up-bold-duotone', color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Dividends', label: 'Dividends', iconName: 'solar:pie-chart-2-bold-duotone', color: colors.emerald.t, bg: colors.emerald.b }, 
        { id: 'Interest', label: 'Bank Interest', iconName: 'ph:percent-duotone', color: colors.lime.t, bg: colors.lime.b },
        { id: 'Rental', label: 'Rental Income', iconName: 'hugeicons:real-estate-02', color: colors.teal.t, bg: colors.teal.b },
        { id: 'Sale', label: 'Sold Items', iconName: 'hugeicons:sale-tag-01', color: colors.cyan.t, bg: colors.cyan.b }, 
        { id: 'Cashback', label: 'Cashback / Rewards', iconName: 'solar:restart-bold-duotone', color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Gift_In', label: 'Gift Received', iconName: 'hugeicons:gift', color: colors.pink.t, bg: colors.pink.b },
        { id: 'Refund', label: 'Refunds', iconName: 'tabler:receipt-refund', color: colors.orange.t, bg: colors.orange.b },
        { id: 'Religious Event income', label: 'Religious Event Income', iconName: 'hugeicons:zakat', color: colors.emerald.t, bg: colors.emerald.b },
        { id: 'Religious Offering', label: 'Religious Offering', iconName: 'ri:hand-coin-line', color: colors.amber.t, bg: colors.amber.b },
        { id: 'Pocket Money', label: 'Pocket Money', iconName: 'solar:wallet-money-bold-duotone', color: colors.blue.t, bg: colors.blue.b },
        { id: 'Content', label: 'Content Creation', iconName: 'solar:clapperboard-play-bold-duotone', color: colors.red.t, bg: colors.red.b },
        { id: 'Consulting', label: 'Consulting', iconName: 'solar:chat-round-money-bold-duotone', color: colors.slate.t, bg: colors.slate.b },
        { id: 'Grant', label: 'Grant / Scholarship', iconName: 'ph:graduation-cap-fill', color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Lottery', label: 'Lottery / Betting', iconName: 'hugeicons:scratch-card', color: colors.green.t, bg: colors.green.b },
        { id: 'Pension', label: 'Pension', iconName: 'solar:buildings-bold-duotone', color: colors.gray.t, bg: colors.gray.b },
        { id: 'Other', label: 'Other Income', iconName: 'solar:menu-dots-bold-duotone', color: colors.gray.t, bg: colors.gray.b },
    ],
    
    transfer: [
        { id: 'Transfer', label: 'Self Transfer', iconName: 'solar:card-transfer-bold-duotone', color: colors.gray.t, bg: colors.gray.b },
        { id: 'Loan', label: 'Loan / EMI', iconName: 'ph:bank-duotone', color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'CC Bill', label: 'Credit Card Bill', iconName: 'solar:card-2-bold-duotone', color: colors.blue.t, bg: colors.blue.b },
        { id: 'Savings', label: 'Move to Savings', iconName: 'solar:safe-square-bold-duotone', color: colors.emerald.t, bg: colors.emerald.b },
        { id: 'Invest_Out', label: 'Invest Money', iconName: 'solar:chart-square-bold-duotone', color: colors.violet.t, bg: colors.violet.b },
        { id: 'Withdrawal', label: 'ATM Withdrawal', iconName: 'hugeicons:atm-02', color: colors.green.t, bg: colors.green.b },
        { id: 'Other', label: 'Other', iconName: 'solar:menu-dots-bold-duotone', color: colors.gray.t, bg: colors.gray.b },
    ]
};

// Materialize with live universal icon component
export const CATEGORY_CONFIG = {
    expense: RAW_CATEGORY_CONFIG.expense.map(c => ({
        ...c,
        type: 'expense' as const,
        icon: createUniversalIconComponent(c.iconName)
    })),
    income: RAW_CATEGORY_CONFIG.income.map(c => ({
        ...c,
        type: 'income' as const,
        icon: createUniversalIconComponent(c.iconName)
    })),
    transfer: RAW_CATEGORY_CONFIG.transfer.map(c => ({
        ...c,
        type: 'transfer' as const,
        icon: createUniversalIconComponent(c.iconName)
    }))
};

/**
 * Universal Icon Map Proxy
 * Seamlessly resolves any string key (Lucide name, 'solar:*', 'ph:*', 'hugeicons:*', 'tabler:*', etc.)
 * into a valid React component.
 */
export const LUCIDE_ICON_MAP: Record<string, any> = new Proxy({}, {
    get(_target, prop: string | symbol) {
        if (typeof prop !== 'string' || !prop) return undefined;
        
        // Direct Lucide React component check
        if (prop in LucideIcons) {
            return (LucideIcons as any)[prop];
        }

        // Return universal component wrapper that renders any multi-library icon
        return createUniversalIconComponent(prop);
    },
    has(_target, prop: string | symbol) {
        if (typeof prop !== 'string') return false;
        return true;
    }
});

export const AVAILABLE_ICON_NAMES = Object.keys(LucideIcons).filter(name => {
    if (!/^[A-Z]/.test(name)) return false;
    if (name.endsWith('Icon') || name.endsWith('Context') || name.endsWith('Provider')) return false;
    if (name === 'createLucideIcon' || name === 'LucideProps' || name === 'HelpCircle' || name === 'Loader2') return false;
    const item = (LucideIcons as any)[name];
    return typeof item === 'function' || typeof item === 'object';
});

export function getCategoryConfig(
    categoryId: string, 
    type?: string, 
    customCategories: Array<{ id: string; label: string; iconName: string; color?: string; bg?: string; isCustom?: boolean; type?: string }> = []
) {
    if (!categoryId) return null;

    const trimmed = categoryId.trim();
    const lower = trimmed.toLowerCase();
    const normalizedLower = lower.replace(/[_\s-]+/g, ' ');

    const matchesKey = (idOrLabel?: string) => {
        if (!idOrLabel) return false;
        const l = idOrLabel.toLowerCase().trim();
        if (l === lower) return true;
        if (l.replace(/[_\s-]+/g, ' ') === normalizedLower) return true;
        return false;
    };

    // 1. Check custom categories (first matching specific type if provided, then any type)
    const matchingCustom = (type 
        ? customCategories.find(c => (!c.type || c.type === type) && (matchesKey(c.id) || matchesKey(c.label)))
        : null) || customCategories.find(c => matchesKey(c.id) || matchesKey(c.label));

    if (matchingCustom) {
        const IconComp = createUniversalIconComponent(matchingCustom.iconName || 'solar:tag-bold-duotone');
        return {
            id: matchingCustom.id,
            label: matchingCustom.label || matchingCustom.id,
            icon: IconComp,
            iconName: matchingCustom.iconName || 'solar:tag-bold-duotone',
            color: matchingCustom.color || 'text-indigo-500',
            bg: matchingCustom.bg || 'bg-indigo-100 dark:bg-indigo-900/30',
            isCustom: true,
            type: (matchingCustom.type || type || 'expense') as 'expense' | 'income' | 'transfer'
        };
    }

    // 2. Check standard categories:
    // Check preferred type first if specified
    if (type && CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG]) {
        const standardInType = CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG].find(
            c => matchesKey(c.id) || matchesKey(c.label)
        );
        if (standardInType) {
            return {
                ...standardInType,
                type: type as 'expense' | 'income' | 'transfer',
                isCustom: false
            };
        }
    }

    // If not found in specified type (e.g. searching 'Udhar_Back' with type='expense', but it's in 'income')
    // search across ALL standard categories!
    const allStandard = [
        ...CATEGORY_CONFIG.expense,
        ...CATEGORY_CONFIG.income,
        ...CATEGORY_CONFIG.transfer
    ];
    
    const standardAny = allStandard.find(c => matchesKey(c.id) || matchesKey(c.label));
    if (standardAny) {
        return {
            ...standardAny,
            isCustom: false
        };
    }

    // 3. Fallback
    return {
        id: trimmed,
        label: trimmed.replace(/_/g, ' '),
        icon: createUniversalIconComponent('solar:tag-bold-duotone'),
        iconName: 'solar:tag-bold-duotone',
        color: 'text-gray-500',
        bg: 'bg-gray-100 dark:bg-gray-800',
        isCustom: true,
        type: (type || 'expense') as 'expense' | 'income' | 'transfer'
    };
}
