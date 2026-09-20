import React, { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { formatSize } from './utils';

export interface StorageStatsViewProps {
    localItems: Array<{ key: string; value: string; size: number; type: string; isJson: boolean }>;
    sessionItems: Array<{ key: string; value: string; size: number; type: string; isJson: boolean }>;
    cookieItems: Array<{ key: string; value: string; size: number; type: string; isJson: boolean }>;
    onSelectKey?: (type: 'localStorage' | 'sessionStorage' | 'cookies', key: string) => void;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
}

export const StorageStatsView: React.FC<StorageStatsViewProps> = ({
    localItems,
    sessionItems,
    cookieItems,
    onSelectKey,
    copiedId,
    handleCopy
}) => {
    // 1. Storage Sizes
    const localSize = useMemo(() => localItems.reduce((acc, it) => acc + it.size, 0), [localItems]);
    const sessionSize = useMemo(() => sessionItems.reduce((acc, it) => acc + it.size, 0), [sessionItems]);
    const cookieSize = useMemo(() => cookieItems.reduce((acc, it) => acc + it.size, 0), [cookieItems]);
    const grandTotalSize = localSize + sessionSize + cookieSize;
    const grandTotalKeys = localItems.length + sessionItems.length + cookieItems.length;

    // 2. Quota Calculations (5MB standard for localStorage & sessionStorage)
    const localQuotaMax = 5 * 1024 * 1024;
    const localQuotaPct = Math.min(100, (localSize / localQuotaMax) * 100);
    const localRemainingBytes = Math.max(0, localQuotaMax - localSize);

    const sessionQuotaMax = 5 * 1024 * 1024;
    const sessionQuotaPct = Math.min(100, (sessionSize / sessionQuotaMax) * 100);

    // 3. Combined Type Distribution
    const typeDistribution = useMemo(() => {
        const counts: Record<string, { count: number; bytes: number }> = {
            object: { count: 0, bytes: 0 },
            array: { count: 0, bytes: 0 },
            string: { count: 0, bytes: 0 },
            number: { count: 0, bytes: 0 },
            boolean: { count: 0, bytes: 0 },
            null: { count: 0, bytes: 0 }
        };

        const allItems = [...localItems, ...sessionItems, ...cookieItems];
        allItems.forEach(it => {
            const t = it.type in counts ? it.type : 'string';
            counts[t].count += 1;
            counts[t].bytes += it.size;
        });

        return counts;
    }, [localItems, sessionItems, cookieItems]);

    // 4. Heaviest Top 10 Keys Leaderboard
    const heaviestKeys = useMemo(() => {
        const combined = [
            ...localItems.map(it => ({ ...it, storage: 'localStorage' as const })),
            ...sessionItems.map(it => ({ ...it, storage: 'sessionStorage' as const })),
            ...cookieItems.map(it => ({ ...it, storage: 'cookies' as const }))
        ];
        combined.sort((a, b) => b.size - a.size);
        return combined.slice(0, 10);
    }, [localItems, sessionItems, cookieItems]);

    // 5. Storage Health & Diagnostic Insights
    const healthInsights = useMemo(() => {
        const insights: Array<{ title: string; message: string; severity: 'info' | 'warning' | 'success' }> = [];
        
        // Check oversized items (> 50KB)
        const oversized = localItems.filter(it => it.size > 50 * 1024);
        if (oversized.length > 0) {
            insights.push({
                title: 'High Capacity Keys Detected',
                message: `${oversized.length} item(s) exceed 50KB in localStorage. Consider caching large datasets in IndexedDB.`,
                severity: 'warning'
            });
        }

        // Quota threshold alert
        if (localQuotaPct > 75) {
            insights.push({
                title: 'LocalStorage Quota Approaching Limit',
                message: `You are utilizing ${localQuotaPct.toFixed(1)}% of available browser quota (~5MB). Clean unneeded keys to avoid QuotaExceededError.`,
                severity: 'warning'
            });
        } else {
            insights.push({
                title: 'Storage Health Optimal',
                message: `Storage footprint is well within limits (${localQuotaPct.toFixed(2)}% used). Estimated ${formatSize(localRemainingBytes)} free.`,
                severity: 'success'
            });
        }

        // Check for duplicate values
        const valueMap: Record<string, string[]> = {};
        localItems.forEach(it => {
            if (it.value && it.value.length > 20) {
                if (!valueMap[it.value]) valueMap[it.value] = [];
                valueMap[it.value].push(it.key);
            }
        });
        const duplicateEntries = Object.entries(valueMap).filter(([_, keys]) => keys.length > 1);
        if (duplicateEntries.length > 0) {
            insights.push({
                title: 'Redundant Stored Values',
                message: `${duplicateEntries.length} identical value payload(s) found across multiple keys (${duplicateEntries[0][1].join(', ')}).`,
                severity: 'info'
            });
        }

        return insights;
    }, [localItems, localQuotaPct, localRemainingBytes]);

    const avgLocalItemSize = localItems.length > 0 ? Math.round(localSize / localItems.length) : 0;
    const avgOverallItemSize = grandTotalKeys > 0 ? Math.round(grandTotalSize / grandTotalKeys) : 0;

    return (
        <div className="flex-1 flex flex-col p-2.5 sm:p-3.5 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)] gap-3 font-sans">
            {/* Header Title with Compact Total Badge strictly on opposite right side */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--dev-console-border)] pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded bg-[#007fd4]/10 text-[#007fd4] shrink-0">
                        <Icon icon="solar:chart-2-linear" className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs font-bold text-[var(--dev-console-text)] tracking-wider truncate">
                            Storage Analytics & Metrics
                        </h3>
                        <p className="text-[10px] text-[var(--dev-console-text-muted)] truncate hidden sm:block">
                            Real-time footprint, quota headroom, data types, and heaviest keys
                        </p>
                    </div>
                </div>

                <div className="shrink-0 flex items-center">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] font-mono font-medium text-[var(--dev-console-text-muted)] whitespace-nowrap shadow-2xs">
                        Total <span className="font-bold text-[var(--dev-console-text)]">{grandTotalKeys}</span> Keys <span className="opacity-40">•</span> <span className="font-bold text-[var(--dev-console-text)]">{formatSize(grandTotalSize)}</span>
                    </span>
                </div>
            </div>

            {/* Container-less Storage Engine Breakdown: 3 Columns with Clean Dividers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b border-[var(--dev-console-border)]">
                {/* LocalStorage Section */}
                <div className="flex flex-col justify-between gap-1.5 md:pr-3 md:border-r border-[var(--dev-console-border)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Icon icon="solar:database-linear" className="w-4 h-4 text-[#007fd4]" />
                            <span className="font-bold text-[11px] uppercase tracking-wider">Local Storage</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-[#007fd4] bg-[#007fd4]/10 px-1.5 py-0.2 rounded border border-[#007fd4]/20">
                            {localItems.length} Keys
                        </span>
                    </div>

                    <div className="flex flex-col gap-1 my-0.5">
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm sm:text-base font-bold font-mono text-[var(--dev-console-text)]">{formatSize(localSize)}</span>
                            <span className="text-[10px] text-[var(--dev-console-text-muted)] font-mono">Quota: {localQuotaPct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-[var(--dev-console-border)] overflow-hidden">
                            <div 
                                className="h-full bg-[#007fd4] rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(2, localQuotaPct)}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--dev-console-text-muted)] font-mono pt-0.5">
                        <span>Avg: {formatSize(avgLocalItemSize)}/key</span>
                        <span>Free: ~{formatSize(localRemainingBytes)}</span>
                    </div>
                </div>

                {/* SessionStorage Section */}
                <div className="flex flex-col justify-between gap-1.5 md:px-3 md:border-r border-[var(--dev-console-border)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Icon icon="solar:server-square-linear" className="w-4 h-4 text-purple-500" />
                            <span className="font-bold text-[11px] uppercase tracking-wider">Session Storage</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                            {sessionItems.length} Keys
                        </span>
                    </div>

                    <div className="flex flex-col gap-1 my-0.5">
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm sm:text-base font-bold font-mono text-[var(--dev-console-text)]">{formatSize(sessionSize)}</span>
                            <span className="text-[10px] text-[var(--dev-console-text-muted)] font-mono">Tab Lifecycle</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-[var(--dev-console-border)] overflow-hidden">
                            <div 
                                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(2, sessionQuotaPct)}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--dev-console-text-muted)] font-mono pt-0.5">
                        <span>Scope: Active Tab</span>
                        <span>Auto-cleared</span>
                    </div>
                </div>

                {/* Cookies Section */}
                <div className="flex flex-col justify-between gap-1.5 md:pl-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Icon icon="tabler:cookie" className="w-4 h-4 text-amber-500" />
                            <span className="font-bold text-[11px] uppercase tracking-wider">Cookies</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            {cookieItems.length} Cookies
                        </span>
                    </div>

                    <div className="flex flex-col gap-1 my-0.5">
                        <div className="flex items-baseline justify-between">
                            <span className="text-sm sm:text-base font-bold font-mono text-[var(--dev-console-text)]">{formatSize(cookieSize)}</span>
                            <span className="text-[10px] text-[var(--dev-console-text-muted)] font-mono">Header Bound</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-[var(--dev-console-border)] overflow-hidden">
                            <div 
                                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(2, (cookieSize / (cookieItems.length * 4096 || 4096)) * 100))}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[var(--dev-console-text-muted)] font-mono pt-0.5">
                        <span>Limit: ~4KB/cookie</span>
                        <span>Client Accessible</span>
                    </div>
                </div>
            </div>

            {/* Container-less Middle Section: Type Distribution & Storage Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 pb-3 border-b border-[var(--dev-console-border)]">
                {/* Type Distribution Breakdown */}
                <div className="flex flex-col gap-2">
                    <h4 className="font-bold text-[11px] uppercase tracking-wider text-[var(--dev-console-text)] flex items-center gap-1.5 border-b border-[var(--dev-console-border)] pb-1.5">
                        <Icon icon="solar:pie-chart-2-linear" className="w-3.5 h-3.5 text-[#007fd4]" />
                        Data Type Breakdown
                    </h4>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        {Object.entries(typeDistribution).map(([typeKey, stats]) => {
                            const pct = grandTotalKeys > 0 ? (stats.count / grandTotalKeys) * 100 : 0;
                            return (
                                <div key={typeKey} className="p-2 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between text-[9px]">
                                        <span className="font-bold uppercase font-mono text-[var(--dev-console-text)]">{typeKey}</span>
                                        <span className="text-[var(--dev-console-text-muted)] font-mono">{pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="text-xs sm:text-sm font-bold font-mono text-[var(--dev-console-syntax-property)]">
                                        {stats.count}
                                    </div>
                                    <div className="text-[9px] text-[var(--dev-console-text-muted)] font-mono">
                                        {formatSize(stats.bytes)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Storage Health, Diagnostics & Runtime Performance Specs */}
                <div className="flex flex-col gap-2">
                    <h4 className="font-bold text-[11px] uppercase tracking-wider text-[var(--dev-console-text)] flex items-center gap-1.5 border-b border-[var(--dev-console-border)] pb-1.5">
                        <Icon icon="solar:shield-check-linear" className="w-3.5 h-3.5 text-emerald-500" />
                        Storage Health & Performance Specs
                    </h4>

                    {/* Diagnostic Insights Alert(s) */}
                    <div className="flex flex-col gap-1.5">
                        {healthInsights.map((insight, idx) => (
                            <div 
                                key={idx} 
                                className={`p-2 rounded border flex flex-col gap-0.5 text-xs ${
                                    insight.severity === 'warning' 
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                                        : insight.severity === 'info'
                                        ? 'bg-[#007fd4]/10 border-[#007fd4]/30 text-[#007fd4]'
                                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                }`}
                            >
                                <span className="font-bold flex items-center gap-1.5 text-[10px] sm:text-[11px]">
                                    {insight.severity === 'warning' ? (
                                        <Icon icon="solar:danger-triangle-linear" className="w-3.5 h-3.5 shrink-0" />
                                    ) : (
                                        <Icon icon="solar:shield-check-linear" className="w-3.5 h-3.5 shrink-0" />
                                    )}
                                    {insight.title}
                                </span>
                                <span className="opacity-90 font-sans leading-relaxed text-[10px]">
                                    {insight.message}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Runtime Architecture & Engine Specs Grid to balance visual density */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-0.5">
                        <div className="p-2 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-0.5">
                            <span className="text-[9px] uppercase font-mono text-[var(--dev-console-text-muted)]">Avg Entry Size</span>
                            <span className="text-xs font-bold font-mono text-[var(--dev-console-text)]">{formatSize(avgOverallItemSize)}</span>
                            <span className="text-[9px] text-[var(--dev-console-text-muted)] font-mono">Combined Mean</span>
                        </div>
                        <div className="p-2 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-0.5">
                            <span className="text-[9px] uppercase font-mono text-[var(--dev-console-text-muted)]">I/O Latency</span>
                            <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">Sync / Direct</span>
                            <span className="text-[9px] text-[var(--dev-console-text-muted)] font-mono">Main Thread</span>
                        </div>
                        <div className="p-2 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-0.5">
                            <span className="text-[9px] uppercase font-mono text-[var(--dev-console-text-muted)]">Origin Scope</span>
                            <span className="text-xs font-bold font-mono text-[#007fd4]">Same-Origin</span>
                            <span className="text-[9px] text-[var(--dev-console-text-muted)] font-mono">Port Isolated</span>
                        </div>
                        <div className="p-2 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-0.5">
                            <span className="text-[9px] uppercase font-mono text-[var(--dev-console-text-muted)]">Est. Gzip Size</span>
                            <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatSize(Math.round(grandTotalSize * 0.35))}</span>
                            <span className="text-[9px] text-[var(--dev-console-text-muted)] font-mono">~65% Savings</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-[var(--dev-console-text-muted)] font-mono px-0.5 pt-0.5">
                        <span>Max Quota: ~5MB Local / ~5MB Session</span>
                        <span>Cookies: ~4KB / Domain bound</span>
                    </div>
                </div>
            </div>

            {/* Container-less Heaviest Keys Leaderboard */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-1.5">
                    <h4 className="font-bold text-[11px] uppercase tracking-wider text-[var(--dev-console-text)] flex items-center gap-1.5">
                        <Icon icon="solar:bolt-linear" className="w-3.5 h-3.5 text-amber-500" />
                        Top Storage Consumers (Heaviest Keys)
                    </h4>
                    <span className="text-[10px] text-[var(--dev-console-text-muted)] font-mono whitespace-nowrap">
                        Ranked by byte size
                    </span>
                </div>

                {heaviestKeys.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--dev-console-text-muted)] italic">
                        No storage items found to rank
                    </div>
                ) : (
                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)]">
                        <table className="w-full text-left text-xs font-mono whitespace-nowrap">
                            <thead>
                                <tr className="border-b border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)] text-[9px] uppercase whitespace-nowrap">
                                    <th className="py-1.5 px-2.5 whitespace-nowrap">#</th>
                                    <th className="py-1.5 px-2.5 whitespace-nowrap">Key Name</th>
                                    <th className="py-1.5 px-2.5 whitespace-nowrap">Engine</th>
                                    <th className="py-1.5 px-2.5 whitespace-nowrap">Type</th>
                                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">Size</th>
                                    <th className="py-1.5 px-2.5 text-right whitespace-nowrap">% of Total</th>
                                    <th className="py-1.5 px-2.5 text-center whitespace-nowrap">Inspect</th>
                                </tr>
                            </thead>
                            <tbody>
                                {heaviestKeys.map((item, index) => {
                                    const pct = grandTotalSize > 0 ? ((item.size / grandTotalSize) * 100) : 0;
                                    return (
                                        <tr 
                                            key={`${item.storage}-${item.key}`} 
                                            className="border-b border-[var(--dev-console-border-light)] hover:bg-[var(--dev-console-bg-hover)] transition-colors whitespace-nowrap"
                                        >
                                            <td className="py-1.5 px-2.5 font-bold text-[var(--dev-console-text-muted)] text-[10px] whitespace-nowrap">{index + 1}</td>
                                            <td className="py-1.5 px-2.5 font-semibold text-[var(--dev-console-syntax-property)] text-[11px] whitespace-nowrap">
                                                {item.key}
                                            </td>
                                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold whitespace-nowrap ${
                                                    item.storage === 'localStorage' ? 'bg-[#007fd4]/15 text-[#007fd4]' :
                                                    item.storage === 'sessionStorage' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                                                    'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                                }`}>
                                                    {item.storage === 'localStorage' ? 'Local' : item.storage === 'sessionStorage' ? 'Session' : 'Cookie'}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                <span className="text-[9px] uppercase text-[var(--dev-console-text-muted)] whitespace-nowrap">
                                                    {item.type}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-bold text-[var(--dev-console-text)] text-[11px] whitespace-nowrap">
                                                {formatSize(item.size)}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right text-[var(--dev-console-text-muted)] text-[10px] whitespace-nowrap">
                                                {pct.toFixed(1)}%
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                {onSelectKey && (
                                                    <button
                                                        onClick={() => onSelectKey(item.storage, item.key)}
                                                        className="p-1 text-[#007fd4] hover:bg-[#007fd4]/10 rounded cursor-pointer transition-colors bg-transparent border-0 inline-flex items-center justify-center whitespace-nowrap"
                                                        title="Inspect Key"
                                                    >
                                                        <Icon icon="tabler:arrow-up-right" className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
