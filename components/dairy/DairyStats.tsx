import React from 'react';
import { DairyItem, DairyEntry, DairyPayment } from '../../types';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Droplet } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { allocatePayments } from '../../utils/dairyUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DairyStatsProps {
    item: DairyItem;
    entries: DairyEntry[];
    payments: DairyPayment[];
}

const DairyStats: React.FC<DairyStatsProps> = ({ item, entries, payments }) => {
    const totalCost = entries.reduce((sum, e) => sum + e.totalPrice, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const due = totalCost - totalPaid;
    
    const allocatedEntries = allocatePayments(entries, payments);
    const unpaidEntries = allocatedEntries.filter(e => !e.isFullyPaid);
    const currentBill = unpaidEntries.reduce((sum, e) => sum + (e.totalPrice - e.paidAmount), 0);
    const activeCycleTotal = unpaidEntries.reduce((sum, e) => sum + e.totalPrice, 0);
    const currentQuantity = unpaidEntries.reduce((sum, e) => sum + e.quantity, 0);

    // Prepare chart data (last 6 months)
    const chartData = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
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
        '#3b82f6', // blue-500
        '#a855f7'  // purple-500
    ];

    const hoverBackgroundColors = [
        '#dc2626', // red-600
        '#ea580c', // orange-600
        '#ca8a04', // yellow-600
        '#16a34a', // green-600
        '#2563eb', // blue-600
        '#9333ea'  // purple-600
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

    return (
        <div className="space-y-6 md:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-3">
                <div className="bg-white dark:bg-[#050505] p-5 md:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Due</span>
                        <p className={`text-2xl font-bold mt-1 ${due > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            ₹{due.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {activeCycleTotal > 0 ? Math.round((currentBill / activeCycleTotal) * 100) : 0}% of active cycle remaining
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                            <DollarSign className="w-6 h-6 text-red-500" />
                        </div>
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${due > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {due > 0 ? 'Pending' : 'Cleared'}
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#050505] p-5 md:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Bill</span>
                        <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                            ₹{currentBill.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {unpaidEntries.length} unpaid entries
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                            <TrendingUp className="w-6 h-6 md:w-5 md:h-5 text-blue-500" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-blue-500">
                            Active Cycle
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#050505] p-5 md:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Paid</span>
                        <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                            ₹{totalPaid.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            {totalCost > 0 ? Math.round((totalPaid / totalCost) * 100) : 0}% of lifetime bill
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                            <DollarSign className="w-6 h-6 md:w-5 md:h-5 text-green-500" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-green-500">
                            {totalPaid >= totalCost && totalCost > 0 ? 'Settled' : 'Partial'}
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#050505] p-5 md:p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-start justify-between">
                    <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Quantity</span>
                        <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                            {currentQuantity.toFixed(1)} <span className="text-sm font-normal text-gray-500">{item.unit}</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Avg {(unpaidEntries.length > 0 ? (currentQuantity / unpaidEntries.length) : 0).toFixed(1)} / entry
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                            <Droplet className="w-6 h-6 md:w-5 md:h-5 text-purple-500" />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-purple-500">
                            Unpaid
                        </span>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white dark:bg-[#050505] p-6 md:p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg md:text-base font-semibold text-gray-900 dark:text-white mb-6 md:mb-3">Monthly Expense Trend</h3>
                <div className="h-64 md:h-32 w-full">
                    <Bar data={data} options={options} className="outline-none" />
                </div>
            </div>
        </div>
    );
};

export default DairyStats;
