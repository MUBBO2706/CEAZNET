
import { 
    Utensils, Car, ShoppingBag, Zap, Film, HeartPulse, GraduationCap, ShoppingBasket, 
    Home, MoreHorizontal, Banknote, Briefcase, TrendingUp, Gift, RefreshCcw, 
    Plane, Dumbbell, PawPrint, Wrench, Shield, Smartphone, Wifi, Music, 
    BookOpen, Scissors, Baby, BriefcaseMedical, Landmark, Laptop, 
    Tv, Coffee, Gamepad2, Hammer, Flower, Shirt, Gift as GiftIcon,
    DollarSign, PiggyBank, CreditCard, Percent, Video, Mic,
    Coins, User, Handshake, HeartHandshake, Droplets, Wallet, Receipt, PenTool,
    Bus, Train, Fuel, ParkingCircle, Ticket, Hotel, Beer, Cigarette, 
    SprayCan, Sprout, Cat, Dog, Monitor, Server, Cloud, HardDrive,
    Camera, Headphones, Watch, Sun, Umbrella, Snowflake, Flame,
    AlertTriangle, Gavel, Scale, FileText, Printer, Mail,
    Trophy, Medal, Crown, Star, Gem, Key, Lock, Map, Compass,
    Anchor, Bike, BatteryCharging, Plug, Lightbulb, ShowerHead,
    Pizza, PieChart, Tag,
    AppWindow, Award, Clover, Sparkles, Palette,
    Carrot, Apple, CupSoda, Sandwich, Milk
} from 'lucide-react';

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

export const CATEGORY_CONFIG = {
    expense: [
        // --- Food & Drink ---
        { id: 'Food', label: 'Dining Out', icon: Pizza, color: colors.orange.t, bg: colors.orange.b },
        { id: 'Groceries', label: 'Groceries', icon: ShoppingBasket, color: colors.green.t, bg: colors.green.b },
        { id: 'Vegetables', label: 'Vegetables', icon: Carrot, color: colors.green.t, bg: colors.green.b },
        { id: 'Fruits', label: 'Fruits', icon: Apple, color: colors.red.t, bg: colors.red.b },
        { id: 'Dairy', label: 'Milk / Dairy', icon: Milk, color: colors.sky.t, bg: colors.sky.b },
        { id: 'Chai', label: 'Chai / Tea', icon: CupSoda, color: colors.amber.t, bg: colors.amber.b },
        { id: 'StreetFood', label: 'Street Food', icon: Sandwich, color: colors.orange.t, bg: colors.orange.b },
        { id: 'Coffee', label: 'Coffee & Cafe', icon: Coffee, color: colors.amber.t, bg: colors.amber.b },
        { id: 'Alcohol', label: 'Alcohol & Bars', icon: Beer, color: colors.rose.t, bg: colors.rose.b },
        { id: 'Snacks', label: 'Snacks', icon: User, color: colors.yellow.t, bg: colors.yellow.b }, // Using Generic User/Face for snacks or maybe Cookie

        // --- Transport ---
        { id: 'Transport', label: 'Public Transport', icon: Bus, color: colors.blue.t, bg: colors.blue.b },
        { id: 'Fuel', label: 'Fuel / Gas', icon: Fuel, color: colors.red.t, bg: colors.red.b },
        { id: 'Cab', label: 'Taxi / Cab', icon: Car, color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Parking', label: 'Parking', icon: ParkingCircle, color: colors.slate.t, bg: colors.slate.b },
        { id: 'Tolls', label: 'Tolls', icon: Ticket, color: colors.slate.t, bg: colors.slate.b },
        { id: 'Maintenance', label: 'Car Service', icon: Wrench, color: colors.gray.t, bg: colors.gray.b },
        { id: 'Flights', label: 'Flights', icon: Plane, color: colors.sky.t, bg: colors.sky.b },
        { id: 'Train', label: 'Train / Metro', icon: Train, color: colors.blue.t, bg: colors.blue.b },

        // --- Housing & Utilities ---
        { id: 'Rent', label: 'Rent', icon: Home, color: colors.teal.t, bg: colors.teal.b },
        { id: 'Electricity', label: 'Electricity Bill', icon: Lightbulb, color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Water', label: 'Water Bill', icon: Droplets, color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Wifi', label: 'Internet / Wifi', icon: Wifi, color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Gas', label: 'Home Gas', icon: Flame, color: colors.orange.t, bg: colors.orange.b },
        { id: 'Maid', label: 'Househelp / Maid', icon: SprayCan, color: colors.pink.t, bg: colors.pink.b },
        { id: 'Maintenance_Home', label: 'Home Repairs', icon: Hammer, color: colors.gray.t, bg: colors.gray.b },
        { id: 'Decor', label: 'Home Decor', icon: Flower, color: colors.emerald.t, bg: colors.emerald.b },

        // --- Personal & Lifestyle ---
        { id: 'Personal', label: 'Personal Care', icon: User, color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Shopping', label: 'Shopping', icon: ShoppingBag, color: colors.pink.t, bg: colors.pink.b },
        { id: 'Clothes', label: 'Clothing', icon: Shirt, color: colors.violet.t, bg: colors.violet.b },
        { id: 'Salon', label: 'Salon / Barber', icon: Scissors, color: colors.fuchsia.t, bg: colors.fuchsia.b },
        { id: 'Gym', label: 'Gym & Fitness', icon: Dumbbell, color: colors.slate.t, bg: colors.slate.b },
        { id: 'Cosmetics', label: 'Cosmetics', icon: Sparkles, color: colors.pink.t, bg: colors.pink.b },
        { id: 'Laundry', label: 'Laundry', icon: ShowerHead, color: colors.cyan.t, bg: colors.cyan.b }, // ShowerHead as close proxy
        
        // --- Health ---
        { id: 'Health', label: 'Doctor / Health', icon: HeartPulse, color: colors.rose.t, bg: colors.rose.b },
        { id: 'Medicine', label: 'Medicines', icon: BriefcaseMedical, color: colors.red.t, bg: colors.red.b },
        { id: 'Insurance', label: 'Insurance', icon: Shield, color: colors.emerald.t, bg: colors.emerald.b },
        
        // --- Entertainment ---
        { id: 'Entertainment', label: 'Movies & Fun', icon: Film, color: colors.purple.t, bg: colors.purple.b },
        { id: 'Subscriptions', label: 'OTT / Subs', icon: Tv, color: colors.red.t, bg: colors.red.b },
        { id: 'Gaming', label: 'Gaming', icon: Gamepad2, color: colors.violet.t, bg: colors.violet.b },
        { id: 'Events', label: 'Concerts / Events', icon: Ticket, color: colors.amber.t, bg: colors.amber.b },
        { id: 'Hobbies', label: 'Hobbies', icon: Palette, color: colors.orange.t, bg: colors.orange.b }, // Palette needs import? No, reusing generic idea
        
        // --- Tech ---
        { id: 'Mobile', label: 'Mobile Bill', icon: Smartphone, color: colors.zinc.t, bg: colors.zinc.b },
        { id: 'Gadgets', label: 'Electronics', icon: Monitor, color: colors.slate.t, bg: colors.slate.b },
        { id: 'Software', label: 'Software / Apps', icon: AppWindow, color: colors.blue.t, bg: colors.blue.b }, // AppWindow or Code
        { id: 'Server', label: 'Server / Hosting', icon: Server, color: colors.indigo.t, bg: colors.indigo.b },

        // --- Education ---
        { id: 'Education', label: 'Education', icon: GraduationCap, color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'Books', label: 'Books', icon: BookOpen, color: colors.amber.t, bg: colors.amber.b },
        { id: 'Stationery', label: 'Stationery', icon: PenTool, color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Courses', label: 'Online Courses', icon: Laptop, color: colors.blue.t, bg: colors.blue.b },

        // --- Social & Gifts ---
        { id: 'Gift', label: 'Gifts', icon: Gift, color: colors.pink.t, bg: colors.pink.b },
        { id: 'Donation', label: 'Charity / Donation', icon: HeartHandshake, color: colors.rose.t, bg: colors.rose.b },
        { id: 'Tip', label: 'Tips', icon: Coins, color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Udhar_Given', label: 'Lent (Udhar)', icon: Handshake, color: colors.rose.t, bg: colors.rose.b },

        // --- Family & Kids ---
        { id: 'Kids', label: 'Kids / Childcare', icon: Baby, color: colors.lime.t, bg: colors.lime.b },
        { id: 'Pets', label: 'Pet Care', icon: PawPrint, color: colors.amber.t, bg: colors.amber.b },
        
        // --- Miscellaneous ---
        { id: 'Vacation', label: 'Travel / Vacation', icon: Plane, color: colors.sky.t, bg: colors.sky.b },
        { id: 'Taxes', label: 'Taxes', icon: FileText, color: colors.slate.t, bg: colors.slate.b },
        { id: 'Fines', label: 'Fines / Challan', icon: AlertTriangle, color: colors.red.t, bg: colors.red.b },
        { id: 'Cigarettes', label: 'Tobacco', icon: Cigarette, color: colors.gray.t, bg: colors.gray.b },
        { id: 'Other', label: 'Other', icon: MoreHorizontal, color: colors.gray.t, bg: colors.gray.b },
    ],
    
    income: [
        { id: 'MobileRepair', label: 'Mobile Repair', icon: Wrench, color: colors.cyan.t, bg: colors.cyan.b }, // Added as requested
        { id: 'Balance', label: 'Balance', icon: Scale, color: colors.teal.t, bg: colors.teal.b },
        { id: 'Salary', label: 'Salary', icon: Banknote, color: colors.green.t, bg: colors.green.b },
        { id: 'Business', label: 'Business Profit', icon: Briefcase, color: colors.blue.t, bg: colors.blue.b },
        { id: 'Freelance', label: 'Freelancing', icon: Laptop, color: colors.purple.t, bg: colors.purple.b },
        { id: 'Bonus', label: 'Bonus', icon: Star, color: colors.yellow.t, bg: colors.yellow.b },
        { id: 'Investment', label: 'Investment Returns', icon: TrendingUp, color: colors.indigo.t, bg: colors.indigo.b },
        /* Added PieChart to the main import block above to fix the error */
        { id: 'Dividends', label: 'Dividends', icon: PieChart, color: colors.emerald.t, bg: colors.emerald.b }, 
        { id: 'Interest', label: 'Bank Interest', icon: Percent, color: colors.lime.t, bg: colors.lime.b },
        { id: 'Rental', label: 'Rental Income', icon: Home, color: colors.teal.t, bg: colors.teal.b },
        /* Added Tag to the main import block above to fix the error */
        { id: 'Sale', label: 'Sold Items', icon: Tag, color: colors.cyan.t, bg: colors.cyan.b }, 
        { id: 'Cashback', label: 'Cashback / Rewards', icon: RefreshCcw, color: colors.cyan.t, bg: colors.cyan.b },
        { id: 'Gift_In', label: 'Gift Received', icon: GiftIcon, color: colors.pink.t, bg: colors.pink.b },
        { id: 'Refund', label: 'Refunds', icon: Receipt, color: colors.orange.t, bg: colors.orange.b },
        { id: 'Udhar_Back', label: 'Udhar Received', icon: Handshake, color: colors.emerald.t, bg: colors.emerald.b },
        { id: 'Pocket Money', label: 'Pocket Money', icon: Wallet, color: colors.blue.t, bg: colors.blue.b },
        { id: 'Content', label: 'Content Creation', icon: Video, color: colors.red.t, bg: colors.red.b },
        { id: 'Consulting', label: 'Consulting', icon: Mic, color: colors.slate.t, bg: colors.slate.b },
        { id: 'Grant', label: 'Grant / Scholarship', icon: Award, color: colors.yellow.t, bg: colors.yellow.b }, // Award
        { id: 'Lottery', label: 'Lottery / Betting', icon: Clover, color: colors.green.t, bg: colors.green.b }, // Clover
        { id: 'Pension', label: 'Pension', icon: Landmark, color: colors.gray.t, bg: colors.gray.b },
        { id: 'Other', label: 'Other Income', icon: MoreHorizontal, color: colors.gray.t, bg: colors.gray.b },
    ],
    
    transfer: [
        { id: 'Transfer', label: 'Self Transfer', icon: RefreshCcw, color: colors.gray.t, bg: colors.gray.b },
        { id: 'Loan', label: 'Loan / EMI', icon: Landmark, color: colors.indigo.t, bg: colors.indigo.b },
        { id: 'CC Bill', label: 'Credit Card Bill', icon: CreditCard, color: colors.blue.t, bg: colors.blue.b },
        { id: 'Savings', label: 'Move to Savings', icon: PiggyBank, color: colors.emerald.t, bg: colors.emerald.b },
        { id: 'Invest_Out', label: 'Invest Money', icon: TrendingUp, color: colors.violet.t, bg: colors.violet.b },
        { id: 'Withdrawal', label: 'ATM Withdrawal', icon: Banknote, color: colors.green.t, bg: colors.green.b },
        { id: 'Other', label: 'Other', icon: MoreHorizontal, color: colors.gray.t, bg: colors.gray.b },
    ]
};

export { Tag, Calendar, Clock } from 'lucide-react';
