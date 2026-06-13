
import React, { useMemo } from 'react';
import { Transaction } from '../../types';
import { TrendingUp, TrendingDown, Calendar, AlertCircle, CheckCircle2, DollarSign, Activity } from 'lucide-react';

interface FinancialFitnessCardProps {
    transactions: Transaction[];
    budget: number;
    period: 'this-month' | 'all' | string;
    className?: string;
}

const FinancialFitnessCard: React.FC<FinancialFitnessCardProps> = ({ transactions, budget, period, className }) => {
    const stats = useMemo(() => {
        const now = new Date();
        let daysInPeriod = 0;
        let daysPassed = 0;
        let daysRemaining = 0;
        let isCurrentPeriod = false;

        if (period === 'this-month') {
            daysInPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            daysPassed = now.getDate();
            daysRemaining = Math.max(1, daysInPeriod - daysPassed + 1);
            isCurrentPeriod = true;
        } else if (period === 'all') {
            // All Time - Estimate based on transaction range
            if (transactions.length > 0) {
                const dates = transactions.map(t => new Date(t.transaction_date).getTime());
                const minDate = Math.min(...dates);
                const maxDate = Math.max(...dates);
                const diffTime = Math.abs(maxDate - minDate);
                daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
                daysInPeriod = daysPassed;
            } else {
                daysPassed = 1;
                daysInPeriod = 1;
            }
        } else if (period.includes('-')) {
            const [y, m] = period.split('-');
            const targetMonth = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
            daysInPeriod = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
            
            if (targetMonth.getFullYear() === now.getFullYear() && targetMonth.getMonth() === now.getMonth()) {
                daysPassed = now.getDate();
                daysRemaining = Math.max(1, daysInPeriod - daysPassed + 1);
                isCurrentPeriod = true;
            } else if (targetMonth > now) {
                daysPassed = 0;
                daysRemaining = daysInPeriod;
                isCurrentPeriod = true; // Future month 
            } else {
                daysPassed = daysInPeriod;
                daysRemaining = 0;
            }
        }

        // Calculate totals from passed transactions (already filtered by parent)
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
        
        // Active Limit: Budget if set, otherwise Income (for this/last month). For All Time, use Income.
        const activeLimit = (period === 'all' || budget === 0) ? income : budget; 
        const remaining = activeLimit - expense;
        
        // 1. Daily Metric
        // This Month: Safe Limit (Remaining / Days Remaining)
        // Past/All: Average Spend (Expense / Days Passed)
        let dailyMetric = 0;
        let dailyMetricLabel = '';
        
        if (isCurrentPeriod) {
            dailyMetric = remaining > 0 ? remaining / daysRemaining : 0;
            dailyMetricLabel = 'Daily Safe Limit';
        } else {
            dailyMetric = expense / Math.max(1, daysPassed);
            dailyMetricLabel = 'Daily Avg Spend';
        }

        // 2. Progress Logic
        const timeProgress = (daysPassed / daysInPeriod) * 100;
        const budgetProgress = activeLimit > 0 ? (expense / activeLimit) * 100 : 0;
        
        // Status
        const isUnderBudget = expense <= activeLimit;
        const diffPercent = Math.abs(timeProgress - budgetProgress);
        
        return {
            dailyMetric,
            dailyMetricLabel,
            remaining,
            activeLimit,
            timeProgress,
            budgetProgress,
            isUnderBudget,
            diffPercent,
            daysRemaining,
            isCurrentPeriod,
            income,
            expense
        };
    }, [transactions, budget, period]);

    return (
        <div className={`w-full bg-white dark:bg-[#050505] rounded-3xl lg:rounded-[1.5rem] p-6 lg:p-4 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-6 lg:gap-4 ${className || ''}`}>
            
            {/* Top Row: Daily Metric & Status */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {stats.isCurrentPeriod ? (
                            <Calendar className="w-4 h-4 text-gray-400" />
                        ) : (
                            <Activity className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{stats.dailyMetricLabel}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl lg:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            ₹{Math.floor(stats.dailyMetric).toLocaleString('en-IN')}
                        </span>
                        <span className="text-sm lg:text-xs font-medium text-gray-500">/ day</span>
                    </div>
                    <p className="text-xs lg:text-[10px] text-gray-500 mt-1 lg:mt-0.5">
                        {stats.isCurrentPeriod 
                            ? `To last the remaining ${stats.daysRemaining} days.`
                            : `Average spending over ${period === 'all' ? 'all time' : 'the month'}.`
                        }
                    </p>
                </div>

                <div className={`flex items-center gap-2 lg:gap-1.5 px-3 py-1.5 lg:px-2.5 lg:py-1 rounded-full border ${
                    stats.isUnderBudget 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/50 dark:text-emerald-400' 
                        : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-900/20 dark:border-rose-900/50 dark:text-rose-400'
                }`}>
                    {stats.isUnderBudget ? <TrendingUp className="w-4 h-4 lg:w-3.5 lg:h-3.5" /> : <TrendingDown className="w-4 h-4 lg:w-3.5 lg:h-3.5" />}
                    <span className="text-xs lg:text-[10px] font-bold">
                        {stats.isUnderBudget ? 'Under Budget' : 'Over Budget'}
                    </span>
                </div>
            </div>

            {/* Middle Row: Progress Bar */}
            <div>
                <div className="flex justify-between text-xs lg:text-[10px] font-medium mb-2 lg:mb-1.5">
                    <span className="text-gray-500">
                        {stats.isCurrentPeriod ? `Month Progress (${Math.round(stats.timeProgress)}%)` : 'Period Complete'}
                    </span>
                    <span className={`${stats.isUnderBudget ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Budget Used ({Math.round(stats.budgetProgress)}%)
                    </span>
                </div>
                
                <div className="relative h-4 lg:h-2.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    {/* Background Bar (Time Passed) */}
                    <div 
                        className="absolute top-0 bottom-0 left-0 bg-gray-200 dark:bg-gray-700 border-r-2 border-white dark:border-[#050505] z-0" 
                        style={{ width: `${stats.timeProgress}%` }}
                    />
                    
                    {/* Foreground Bar (Money Spent) */}
                    <div 
                        className={`absolute top-0 bottom-0 left-0 h-full rounded-full transition-all duration-1000 ease-out z-10 ${
                            stats.budgetProgress > 100 ? 'bg-red-600' :
                            stats.isUnderBudget ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(stats.budgetProgress, 100)}%` }}
                    />
                </div>
                
                {/* Insight Text */}
                <div className="mt-3 lg:mt-2 flex items-start gap-2 lg:gap-1.5 text-xs lg:text-[10px] text-gray-500 dark:text-gray-400">
                    {stats.isUnderBudget ? (
                        <CheckCircle2 className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                        <AlertCircle className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-rose-500 flex-shrink-0" />
                    )}
                    <p>
                        {stats.isCurrentPeriod
                            ? (stats.isUnderBudget 
                                ? `You are spending ${stats.diffPercent.toFixed(0)}% slower than time passing. Great job!` 
                                : `You are spending ${stats.diffPercent.toFixed(0)}% faster than time passing. Slow down slightly.`)
                            : (stats.isUnderBudget
                                ? `You saved ₹${(stats.activeLimit - stats.expense).toLocaleString('en-IN')} this period!`
                                : `You overspent by ₹${(stats.expense - stats.activeLimit).toLocaleString('en-IN')} this period.`)
                        }
                    </p>
                </div>
            </div>
            
            {/* Footer: Hard Numbers */}
            <div className="flex justify-between items-center pt-4 lg:pt-3 border-t border-gray-100 dark:border-gray-800">
                <div>
                    <p className="text-[10px] lg:text-[9px] uppercase font-bold text-gray-400">
                        {stats.isUnderBudget ? 'Savings' : 'Overspend'}
                    </p>
                    <p className={`text-sm lg:text-xs font-bold ${stats.isUnderBudget ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        ₹{Math.abs(stats.remaining).toLocaleString('en-IN')}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] lg:text-[9px] uppercase font-bold text-gray-400">
                        {period === 'all' ? 'Total Income' : 'Monthly Limit'}
                    </p>
                    <p className="text-sm lg:text-xs font-bold text-gray-900 dark:text-white">₹{stats.activeLimit.toLocaleString('en-IN')}</p>
                </div>
            </div>

        </div>
    );
};

export default FinancialFitnessCard;
