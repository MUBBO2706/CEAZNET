
import React, { useMemo, useState } from 'react';
import { Transaction } from '../../types';
import { TrendingDown, TrendingUp, Wallet, ArrowUp, ChevronDown, PieChart as PieChartIcon, Activity, CreditCard } from 'lucide-react';
import Tooltip from '../Tooltip';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartJSTooltip,
  Filler,
  Legend as ChartJSLegend,
  ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import TopExpenses from './TopExpenses';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartJSTooltip,
  Filler,
  ChartJSLegend,
  ArcElement
);

interface FinanceAnalyticsProps {
    transactions: Transaction[];
    period: 'this-month' | 'all' | string;
}

const FinanceAnalytics: React.FC<FinanceAnalyticsProps> = ({ transactions, period }) => {
    const [isBreakdownExpanded, setIsBreakdownExpanded] = useState(false);

    const analytics = useMemo(() => {
        const expenseTransactions = transactions.filter(t => t.type === 'expense');
        const incomeTransactions = transactions.filter(t => t.type === 'income');
        
        const totalExpense = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const netBalance = totalIncome - totalExpense;
        
        // 1. Category Breakdown (Expenses)
        const categoryMap: Record<string, number> = {};
        expenseTransactions.forEach(t => {
            categoryMap[t.category] = (categoryMap[t.category] || 0) + Number(t.amount);
        });
        
        const categories = Object.entries(categoryMap)
            .map(([name, value]) => ({ name, value, percentage: totalExpense > 0 ? (value / totalExpense) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);

        // 1b. Category Breakdown (Income)
        const incomeCategoryMap: Record<string, number> = {};
        incomeTransactions.forEach(t => {
            incomeCategoryMap[t.category] = (incomeCategoryMap[t.category] || 0) + Number(t.amount);
        });
        
        const incomeCategories = Object.entries(incomeCategoryMap)
            .map(([name, value]) => ({ name, value, percentage: totalIncome > 0 ? (value / totalIncome) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);

        // 2. Daily Data (Income vs Expense)
        const dailyMap: Record<number, { income: number, expense: number }> = {};
        
        transactions.forEach(t => {
            const date = new Date(t.transaction_date).getDate();
            if (!dailyMap[date]) dailyMap[date] = { income: 0, expense: 0 };
            
            if (t.type === 'income') {
                dailyMap[date].income += Number(t.amount);
            } else {
                dailyMap[date].expense += Number(t.amount);
            }
        });
        
        let daysInMonth = 30; 
        const now = new Date();
        if (period === 'this-month') {
            daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        } else if (period.includes('-')) {
            const [y, m] = period.split('-');
            daysInMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
        } else if (period === 'all') {
            // For 'all' time, maybe use max day observed, or just 31
            const maxDay = Math.max(...Object.keys(dailyMap).map(Number), 31);
            daysInMonth = Math.min(31, maxDay);
        }

        const trendData = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            return { 
                day: `Day ${day}`, 
                income: dailyMap[day]?.income || 0,
                expense: dailyMap[day]?.expense || 0
            };
        });

        const zeroSpendDays = trendData.filter(d => d.expense === 0).length;

        // 3. Smart Stats
        const daysCount = new Set(expenseTransactions.map(t => new Date(t.transaction_date).toDateString())).size || 1;
        const dailyAverage = totalExpense / Math.max(daysCount, 1);
        
        // 4. Top Expenses
        const topExpenses = [...expenseTransactions]
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .slice(0, 5);

        return { 
            totalExpense, totalIncome, netBalance, 
            categories, incomeCategories, trendData, dailyAverage, zeroSpendDays, topExpenses 
        };
    }, [transactions, period]);

    const COLORS = ['#f43f5e', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'];

    // Chart.js configurations
    const lineChartData = {
        labels: analytics.trendData.map(d => d.day.replace('Day ', '')),
        datasets: [
            {
                label: 'Income',
                data: analytics.trendData.map(d => d.income),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
            },
            {
                label: 'Expense',
                data: analytics.trendData.map(d => d.expense),
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
            }
        ]
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: '#111827',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function(context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += '₹' + context.parsed.y.toLocaleString();
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                    drawBorder: false,
                },
                ticks: {
                    color: '#6b7280',
                    font: { size: 10 },
                    maxTicksLimit: 15
                }
            },
            y: {
                grid: {
                    color: 'rgba(107, 114, 128, 0.1)',
                    drawBorder: false,
                },
                ticks: {
                    color: '#6b7280',
                    font: { size: 10 },
                    callback: function(value: any) {
                        return '₹' + (value >= 1000 ? (value/1000).toFixed(1) + 'k' : value);
                    }
                }
            }
        }
    };

    const createDoughnutData = (data: any[]) => ({
        labels: data.map(d => d.name),
        datasets: [
            {
                data: data.map(d => d.value),
                backgroundColor: COLORS,
                borderWidth: 0,
                hoverOffset: 4
            }
        ]
    });

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: '#111827',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function(context: any) {
                        return ` ${context.label}: ₹${context.raw.toLocaleString()}`;
                    }
                }
            }
        }
    };

    return (
        <div className="space-y-4 animate-fade-in-up pb-0">
            
            {/* Overview Cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-[#050505] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2 text-indigo-500">
                        <Activity className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Daily Avg</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">₹{Math.round(analytics.dailyAverage).toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-[#050505] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                        <Wallet className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Zero Spend</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{analytics.zeroSpendDays} <span className="text-sm font-medium text-gray-400">days</span></p>
                </div>
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Cash Flow Trend (Area Chart) */}
                <div className="lg:col-span-2 bg-white dark:bg-[#050505] p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            Cash Flow Trend
                        </h3>
                        <div className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                            {period.replace('-', ' ')}
                        </div>
                    </div>
                    
                    <div className="h-64 sm:h-72 w-full">
                        <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                </div>

                {/* Category Breakdown (Pie Chart) */}
                <div className="bg-white dark:bg-[#050505] p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4 text-purple-500" />
                            Expenses
                        </h3>
                        <div className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                            Total: ₹{analytics.totalExpense >= 1000 ? (analytics.totalExpense/1000).toFixed(1) + 'k' : analytics.totalExpense}
                        </div>
                    </div>
                    
                    {analytics.categories.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 min-h-[160px]">
                            No expense data yet.
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="h-40 sm:h-48 w-full relative">
                                <Doughnut data={createDoughnutData(analytics.categories)} options={doughnutOptions} />
                            </div>
                            
                            <div className="mt-4 space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                                {analytics.categories.map((cat, i) => (
                                    <div key={cat.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-gray-900 dark:text-white font-medium">₹{cat.value.toLocaleString()}</span>
                                            <span className="text-gray-400 w-8 text-right">{cat.percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Income Category Breakdown (Pie Chart) */}
                <div className="bg-white dark:bg-[#050505] p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4 text-emerald-500" />
                            Income
                        </h3>
                        <div className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                            Total: ₹{analytics.totalIncome >= 1000 ? (analytics.totalIncome/1000).toFixed(1) + 'k' : analytics.totalIncome}
                        </div>
                    </div>
                    
                    {analytics.incomeCategories.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-sm text-gray-500 min-h-[160px]">
                            No income data yet.
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col">
                            <div className="h-40 sm:h-48 w-full relative">
                                <Doughnut data={createDoughnutData(analytics.incomeCategories)} options={doughnutOptions} />
                            </div>
                            
                            <div className="mt-4 space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
                                {analytics.incomeCategories.map((cat, i) => (
                                    <div key={cat.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 truncate">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                            <span className="text-gray-700 dark:text-gray-300 truncate">{cat.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-gray-900 dark:text-white font-medium">₹{cat.value.toLocaleString()}</span>
                                            <span className="text-gray-400 w-8 text-right">{cat.percentage.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Expenses List */}
            <TopExpenses transactions={transactions} />

        </div>
    );
};

export default FinanceAnalytics;
