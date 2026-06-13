import React from 'react';
import { Transaction } from '../../types';
import { CreditCard, TrendingDown, HelpCircle } from 'lucide-react';
import { CATEGORY_CONFIG } from './categories';

interface TopExpensesProps {
    transactions: Transaction[];
}

const CategoryIcon: React.FC<{ categoryId: string, type: string, className?: string }> = ({ categoryId, type, className }) => {
    const configList = CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.expense;
    const categoryData = configList.find(c => c.id === categoryId);
    
    if (categoryData) {
        const IconComponent = categoryData.icon;
        return <IconComponent className={className} />;
    }

    return <HelpCircle className={className} />;
}

const getCategoryColor = (categoryId: string, type: string) => {
    const configList = CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.expense;
    const categoryData = configList.find(c => c.id === categoryId);
    return categoryData ? `${categoryData.color} ${categoryData.bg}` : 'text-gray-500 bg-gray-100 dark:bg-gray-800';
}

const TopExpenses: React.FC<TopExpensesProps> = ({ transactions }) => {
    // We only care about expenses and top 5
    const topExpenses = [...transactions]
        .filter(t => t.type === 'expense')
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 5);

    if (topExpenses.length === 0) return null;

    return (
        <div className="bg-white dark:bg-[#050505] p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden transition-all duration-300">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.02] pointer-events-none">
                <TrendingDown className="w-48 h-48 -rotate-12" />
            </div>
            
            <div className="flex items-center justify-between mb-5 relative z-10">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-lg">
                    <span className="p-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
                        <CreditCard className="w-5 h-5" />
                    </span>
                    Top Expenses
                </h3>
            </div>
            
            <div className="space-y-3 relative z-10">
                {topExpenses.map((t, i) => {
                    const colorClass = getCategoryColor(t.category, t.type);
                    
                    return (
                        <div 
                            key={t.id} 
                            className="group flex flex-row items-center justify-between p-3 sm:p-4 rounded-2xl bg-gray-50/80 hover:bg-gray-100 dark:bg-gray-900/40 dark:hover:bg-gray-900/70 border border-transparent hover:border-gray-200 dark:hover:border-gray-800 transition-all duration-300"
                        >
                            <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                <div className="relative">
                                    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full ${colorClass} flex items-center justify-center shadow-sm shrink-0`}>
                                        <CategoryIcon categoryId={t.category} type={t.type} className="w-4 h-4 md:w-5 md:h-5" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[9px] md:text-[10px] shadow-sm border-2 border-white dark:border-gray-900 transition-transform group-hover:scale-110">
                                        {i + 1}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                        {t.description || t.category}
                                    </p>
                                    <div className="flex items-center gap-1.5 md:gap-2 mt-0.5">
                                        <span className="text-[10px] md:text-xs font-medium px-1.5 py-0.5 rounded-full bg-white dark:bg-black/50 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 shadow-sm truncate">
                                            {t.category}
                                        </span>
                                        <span className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 shrink-0">
                                            {new Date(t.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end shrink-0 pl-2">
                                <span className="font-bold text-sm md:text-base text-rose-600 dark:text-rose-400 tracking-tight">
                                    -₹{Number(t.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TopExpenses;
