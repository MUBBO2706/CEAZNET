import React, { useState, useEffect, useRef } from 'react';
import { DairyItem, DairyEntry, DairyPayment } from '../../types';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Droplet, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { allocatePayments } from '../../utils/dairyUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const TrendMonthPicker: React.FC<{
    selectedYear: number;
    selectedMonth: number;
    onChange: (year: number, month: number) => void;
}> = ({ selectedYear, selectedMonth, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewYear, setViewYear] = useState(selectedYear);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setViewYear(selectedYear);
    }, [selectedYear]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedLabel = `${MONTH_NAMES[selectedMonth]} '${String(selectedYear).slice(-2)}`;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-neutral-900 dark:hover:bg-neutral-850 border border-gray-200 dark:border-neutral-800 text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
            >
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <span>{formattedLabel}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-all duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1 z-45 w-56 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl p-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-2.5 px-1">
                        <button
                            type="button"
                            onClick={() => setViewYear(prev => prev - 1)}
                            className="p-1 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-xs text-gray-900 dark:text-white tracking-wide">
                            {viewYear}
                        </span>
                        <button
                            type="button"
                            onClick={() => setViewYear(prev => prev + 1)}
                            className="p-1 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                        {MONTH_NAMES.map((mName, idx) => {
                            const isSelected = viewYear === selectedYear && idx === selectedMonth;
                            return (
                                <button
                                    key={mName}
                                    type="button"
                                    onClick={() => {
                                        onChange(viewYear, idx);
                                        setIsOpen(false);
                                    }}
                                    className={`py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-sm font-bold'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    {mName}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface DairyStatsProps {
    item: DairyItem;
    entries: DairyEntry[];
    payments: DairyPayment[];
}

const DairyStats: React.FC<DairyStatsProps> = ({ item, entries, payments }) => {
    const [trendMonth, setTrendMonth] = useState<number>(new Date().getMonth());
    const [trendYear, setTrendYear] = useState<number>(new Date().getFullYear());

    const totalCost = entries.reduce((sum, e) => sum + e.totalPrice, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const due = totalCost - totalPaid;
    
    const allocatedEntries = allocatePayments(entries, payments);
    const unpaidEntries = allocatedEntries.filter(e => !e.isFullyPaid);
    const currentBill = unpaidEntries.reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0);
    const activeCycleTotal = unpaidEntries.reduce((sum, e) => sum + e.totalPrice, 0);
    const currentQuantity = unpaidEntries.reduce((sum, e) => sum + e.quantity, 0);

    // Prepare chart data (last 1 year / 12 months)
    const chartData = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthName = d.toLocaleString('default', { month: 'short' });
        const year = d.getFullYear();
        const month = d.getMonth();

        const monthEntries = entries.filter(e => {
            const entryDate = new Date(e.date);
            return entryDate.getMonth() === month && entryDate.getFullYear() === year;
        });

        const monthCost = monthEntries.reduce((sum, e) => sum + e.totalPrice, 0);
        
        chartData.push({
            name: monthName,
            cost: monthCost
        });
    }

    const backgroundColors = [
        '#ef4444', // red-500
        '#f97316', // orange-500
        '#eab308', // yellow-500
        '#22c55e', // green-500
        '#06b6d4', // cyan-500
        '#3b82f6', // blue-500
        '#6366f1', // indigo-500
        '#a855f7', // purple-500
        '#d946ef', // fuchsia-500
        '#ec4899', // pink-500
        '#f43f5e', // rose-500
        '#10b981'  // emerald-500
    ];

    const hoverBackgroundColors = [
        '#dc2626', // red-600
        '#ea580c', // orange-600
        '#ca8a04', // yellow-600
        '#16a34a', // green-600
        '#0891b2', // cyan-600
        '#2563eb', // blue-600
        '#4f46e5', // indigo-600
        '#9333ea', // purple-600
        '#c026d3', // fuchsia-600
        '#db2777', // pink-600
        '#e11d48', // rose-600
        '#059669'  // emerald-600
    ];

    const data = {
        labels: chartData.map(d => d.name),
        datasets: [
            {
                label: 'Expense',
                data: chartData.map(d => d.cost),
                backgroundColor: backgroundColors,
                hoverBackgroundColor: hoverBackgroundColors,
                borderRadius: 6,
                borderWidth: 0,
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: '#ffffff',
                titleColor: '#6B7280',
                bodyColor: '#111827',
                borderColor: '#F3F4F6',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function(context: any) {
                        return `₹${context.parsed.y}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: '#6B7280',
                    font: {
                        size: 12,
                        weight: 500
                    }
                }
            },
            y: {
                grid: {
                    color: '#E5E7EB',
                    tickLength: 0,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: '#6B7280',
                    font: {
                        size: 12,
                        weight: 500
                    },
                    callback: function(value: any) {
                        return `₹${value}`;
                    }
                }
            }
        },
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
    };

    // Filter entries for selected trend month & year
    const trendMonthEntries = entries.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === trendMonth && d.getFullYear() === trendYear;
    });

    const daysInSelectedMonth = new Date(trendYear, trendMonth + 1, 0).getDate();

    const dailyTrendData = Array.from({ length: daysInSelectedMonth }, (_, i) => {
        const day = i + 1;
        const dayEntries = trendMonthEntries.filter(e => {
            const d = new Date(e.date);
            return d.getDate() === day;
        });
        const cost = dayEntries.reduce((sum, e) => sum + e.totalPrice, 0);
        return { day, cost };
    });

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    
    // Theme-aware styles
    const themeColor = '#3b82f6'; 
    const fillGradientColor = isDark ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.08)';
    const gridLineColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
    const tickColor = isDark ? 'rgba(255, 255, 255, 0.6)' : '#6b7280';
    const tooltipBg = isDark ? '#171717' : '#ffffff';
    const tooltipBorder = isDark ? '#262626' : '#f3f4f6';
    const tooltipText = isDark ? '#f5f5f5' : '#111827';
    const tooltipTextMuted = isDark ? '#a3a3a3' : '#6b7280';

    const lineData = {
        labels: dailyTrendData.map(d => d.day),
        datasets: [
            {
                label: 'Expense',
                data: dailyTrendData.map(d => d.cost),
                borderColor: themeColor,
                backgroundColor: fillGradientColor,
                borderWidth: 2.5,
                pointBackgroundColor: themeColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 3.5,
                pointHoverRadius: 5.5,
                pointHoverBackgroundColor: themeColor,
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 1.5,
                tension: 0.38,
                fill: true,
            }
        ]
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: tooltipBg,
                titleColor: tooltipTextMuted,
                bodyColor: tooltipText,
                borderColor: tooltipBorder,
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                    title: function(context: any) {
                        const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return `${mNames[trendMonth]} ${context[0].label}, ${trendYear}`;
                    },
                    label: function(context: any) {
                        return `₹${context.parsed.y}`;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: tickColor,
                    font: {
                        size: 11,
                        weight: 500
                    }
                }
            },
            y: {
                grid: {
                    color: gridLineColor,
                    tickLength: 0,
                },
                border: {
                    display: false,
                },
                ticks: {
                    color: tickColor,
                    font: {
                        size: 11,
                        weight: 500
                    },
                    callback: function(value: any) {
                        return `₹${value}`;
                    }
                }
            }
        },
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* Left Section: 2x2 Grid of 4 Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-3 h-full">
                    {/* 1. Total Due */}
                    <div className="bg-white dark:bg-[#050505] p-5 md:p-4 rounded-2xl border border-red-200/80 dark:border-red-900/40 shadow-sm flex flex-col justify-between min-w-0 h-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">Total Due</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <DollarSign className="w-4 h-4 text-red-500" />
                                </div>
                                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${due > 0 ? 'bg-red-50 text-red-500 dark:bg-red-900/30' : 'bg-green-50 text-green-500 dark:bg-green-900/30'}`}>
                                    {due > 0 ? 'Pending' : 'Cleared'}
                                </span>
                            </div>
                        </div>

                        <div className="my-1">
                            <p className={`text-2xl font-bold truncate ${due > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                ₹{due.toFixed(2)}
                            </p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center justify-between">
                                <span>Cycle status</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {activeCycleTotal > 0 ? Math.round((currentBill / activeCycleTotal) * 100) : 0}% remaining
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Pending count</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {unpaidEntries.length} {unpaidEntries.length === 1 ? 'entry' : 'entries'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Current Bill */}
                    <div className="bg-white dark:bg-[#050505] p-5 md:p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 shadow-sm flex flex-col justify-between min-w-0 h-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">Current Bill</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                </div>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-500 dark:bg-blue-900/30">
                                    Active Cycle
                                </span>
                            </div>
                        </div>

                        <div className="my-1">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                                ₹{currentBill.toFixed(2)}
                            </p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center justify-between">
                                <span>Unpaid entries</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {unpaidEntries.length} {unpaidEntries.length === 1 ? 'entry' : 'entries'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Avg per entry</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    ₹{(unpaidEntries.length > 0 ? (currentBill / unpaidEntries.length) : 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Total Paid */}
                    <div className="bg-white dark:bg-[#050505] p-5 md:p-4 rounded-2xl border border-green-200/80 dark:border-green-900/40 shadow-sm flex flex-col justify-between min-w-0 h-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">Total Paid</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="p-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <DollarSign className="w-4 h-4 text-green-500" />
                                </div>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-green-50 text-green-500 dark:bg-green-900/30">
                                    {totalPaid >= totalCost && totalCost > 0 ? 'Settled' : 'Partial'}
                                </span>
                            </div>
                        </div>

                        <div className="my-1">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                                ₹{totalPaid.toFixed(2)}
                            </p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center justify-between">
                                <span>Settlement</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {totalCost > 0 ? Math.round((totalPaid / totalCost) * 100) : 0}% of lifetime
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Payments count</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {payments.length} {payments.length === 1 ? 'record' : 'records'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Current Quantity */}
                    <div className="bg-white dark:bg-[#050505] p-5 md:p-4 rounded-2xl border border-purple-200/80 dark:border-purple-900/40 shadow-sm flex flex-col justify-between min-w-0 h-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">Current Quantity</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <Droplet className="w-4 h-4 text-purple-500" />
                                </div>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-500 dark:bg-purple-900/30">
                                    Unpaid
                                </span>
                            </div>
                        </div>

                        <div className="my-1">
                            <p className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                                {currentQuantity.toFixed(1)} <span className="text-sm font-normal text-gray-500">{item.unit}</span>
                            </p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/60 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center justify-between">
                                <span>Avg per entry</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {(unpaidEntries.length > 0 ? (currentQuantity / unpaidEntries.length) : 0).toFixed(1)} {item.unit}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Standard rate</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    ₹{item.defaultPrice} / {item.unit}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Section: Monthly Expense Trend Chart */}
                <div className="bg-white dark:bg-[#050505] p-5 md:p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between w-full h-full min-h-[280px]">
                    <h3 className="text-lg md:text-base font-bold text-gray-900 dark:text-white mb-3">Monthly Expense Trend</h3>
                    <div className="h-56 sm:h-64 lg:h-60 w-full min-h-[180px] flex-1">
                        <Bar data={data} options={options} className="outline-none" />
                    </div>
                </div>
            </div>

            {/* Daily Expense Trend Line Graph Section */}
            <div className="bg-white dark:bg-[#050505] p-5 md:p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col w-full min-h-[340px]">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h3 className="text-lg md:text-base font-bold text-gray-900 dark:text-white">Daily Expense Trend</h3>
                    <TrendMonthPicker
                        selectedYear={trendYear}
                        selectedMonth={trendMonth}
                        onChange={(year, month) => {
                            setTrendYear(year);
                            setTrendMonth(month);
                        }}
                    />
                </div>
                <div className="h-64 sm:h-72 w-full flex-1">
                    <Line data={lineData} options={lineOptions} className="outline-none" />
                </div>
            </div>
        </div>
    );
};

export default DairyStats;
