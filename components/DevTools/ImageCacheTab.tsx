import React, { useState, useEffect } from 'react';
import { Image, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import ConfirmationModal from '../ConfirmationModal';
import { 
    serverImageCacheSummary, 
    isImageCacheLoading, 
    isImageCacheLoaded, 
    showFlushConfirm, 
    setShowFlushConfirm, 
    fetchImageCacheData, 
    handleClearServerImageCache,
    listeners
} from './store';
import { LiveAvgTimeLeft, TrendIndicator } from './UIComponents';
import { formatSize } from './utils';

interface ImageCacheTabProps {
    isOpen: boolean;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
}

export const ImageCacheTab: React.FC<ImageCacheTabProps> = ({ isOpen, copiedId, handleCopy }) => {
    const [, forceRender] = useState(0);
    const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null);
    const [isDeletingImage, setIsDeletingImage] = useState<string | null>(null);

    const trendMode = 'historical';

    // Subscribe to store updates
    useEffect(() => {
        const listener = () => forceRender(n => n + 1);
        listeners.push(listener);
        return () => {
            const idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    }, []);

    // Fetch data on open if not loaded yet
    useEffect(() => {
        if (isOpen && !isImageCacheLoaded) {
            fetchImageCacheData();
        }
    }, [isOpen, isImageCacheLoaded]);

    if (!isOpen) return null;

    return (
        <div className="flex-1 flex flex-col md:flex-row w-full h-full md:min-h-0 overflow-y-auto md:overflow-hidden bg-[var(--dev-console-bg)]">
            {/* Left Side: Caching Engine Controls & Analytics Dashboard */}
            <div className="w-full md:w-[350px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--dev-console-border)] p-4 flex flex-col gap-4 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-2 shrink-0 select-none">
                    <h3 className="text-sm font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2">
                        <Image size={16} className="text-[#10b981]" />
                        Cache Analytics Dashboard
                    </h3>
                </div>
                
                {(() => {
                    const items = serverImageCacheSummary.items || [];
                    const totalCount = items.length;
                    const expiredCount = items.filter(i => i.isExpired).length;
                    const activeCount = totalCount - expiredCount;
                    const totalBytes = serverImageCacheSummary.totalSizeBytes || 0;
                    const averageSizeBytes = totalCount > 0 ? Math.round(totalBytes / totalCount) : 0;

                    const domainMap: Record<string, number> = {};
                    items.forEach(item => {
                        let hostname = 'Unknown Origin';
                        try {
                            hostname = new URL(item.url).hostname;
                        } catch {
                            hostname = 'Unknown Origin';
                        }
                        domainMap[hostname] = (domainMap[hostname] || 0) + 1;
                    });
                    
                    const sortedAllDomains = Object.entries(domainMap)
                        .sort((a, b) => b[1] - a[1]);
                    
                    const topDomains = sortedAllDomains.slice(0, 5).map(([name, count]) => ({
                        name, count, percent: totalCount > 0 ? (count / totalCount) * 100 : 0
                    }));

                    const othersCount = sortedAllDomains.slice(5).reduce((acc, [, count]) => acc + count, 0);
                    if (othersCount > 0) {
                        topDomains.push({
                            name: 'Others',
                            count: othersCount,
                            percent: totalCount > 0 ? (othersCount / totalCount) * 100 : 0
                        });
                    }
                    
                    const sortedDomains = topDomains;

                    const activeItems = items.filter(i => !i.isExpired);
                    const avgTimeLeftMinutes = activeItems.length > 0 ? Math.round(activeItems.reduce((acc, i) => acc + (i.timeLeftMinutes || 0), 0) / activeItems.length) : 0;

                    const cacheRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 100;

                    const headerStyle = "text-[var(--dev-console-text)] text-[7.5px] min-[320px]:text-[8px] min-[375px]:text-[9px] lg:text-[10px] uppercase tracking-wider font-mono font-bold leading-none truncate block w-full whitespace-nowrap overflow-hidden";
                    const valStyle = "text-xs min-[340px]:text-sm min-[375px]:text-base lg:text-lg font-bold font-mono leading-none truncate whitespace-nowrap overflow-hidden";
                    const descStyle = "text-[6.5px] min-[320px]:text-[7px] min-[375px]:text-[8px] lg:text-[8.5px] text-[var(--dev-console-text-muted)] mt-1.5 font-mono leading-none truncate block w-full whitespace-nowrap overflow-hidden";

                    return (
                        <div className="flex flex-col gap-4 font-sans">
                            {/* Row 1 Metrics Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                                    <span className={headerStyle}>Total Items</span>
                                    <div className="flex items-center justify-between mt-1.5 w-full">
                                        <div className={`${valStyle} text-[var(--dev-console-stat-indigo)]`} title="Total Items">{totalCount}</div>
                                        <TrendIndicator trend={(serverImageCacheSummary as any).stats?.trends?.count} mode={trendMode} />
                                    </div>
                                    <span className={descStyle}>Cached image assets</span>
                                </div>
                                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                                    <span className={headerStyle}>AVG TIME LEFT</span>
                                    <div className="flex items-center justify-between mt-1.5 w-full">
                                        <div className={`${valStyle} text-[var(--dev-console-stat-green)]`} title="Total Average Time Left"><LiveAvgTimeLeft items={items} ttlMs={serverImageCacheSummary.ttlMs} /></div>
                                        <TrendIndicator trend={(serverImageCacheSummary as any).stats?.trends?.avgTimeLeftMinutes} format={(v) => `${v}m`} mode={trendMode} />
                                    </div>
                                    <span className={descStyle}>Average expiration remaining</span>
                                </div>
                                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                                    <span className={headerStyle}>Total Size</span>
                                    <div className="flex items-center justify-between mt-1.5 w-full font-mono">
                                        <div className={`${valStyle} text-[var(--dev-console-stat-amber)]`} title="Total Size">{formatSize(totalBytes)}</div>
                                        <TrendIndicator trend={(serverImageCacheSummary as any).stats?.trends?.totalSizeBytes} format={formatSize} mode={trendMode} />
                                    </div>
                                    <span className={descStyle}>Proxy footprint</span>
                                </div>
                                <div className="bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] p-3 rounded-md flex flex-col min-w-0">
                                    <span className={headerStyle}>Avg Size</span>
                                    <div className="flex items-center justify-between mt-1.5 w-full font-mono">
                                        <div className={`${valStyle} text-[var(--dev-console-stat-blue)]`} title="Avg Size">{formatSize(averageSizeBytes)}</div>
                                        <TrendIndicator trend={(serverImageCacheSummary as any).stats?.trends?.averageSizeBytes} format={formatSize} mode={trendMode} />
                                    </div>
                                    <span className={descStyle}>Average image weight</span>
                                </div>
                            </div>

                            {/* Cache Efficiency Progress */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center text-[10.5px] font-mono text-[var(--dev-console-text-muted)] mb-0.5 uppercase font-bold">
                                    <span>Cache Health (Active Rate)</span>
                                    <span className="text-[#10b981] font-bold">{cacheRatio}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-[var(--dev-console-border)] rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                                        style={{ width: `${cacheRatio}%` }}
                                    />
                                </div>
                                <p className="text-[9.5px] text-[var(--dev-console-text-muted)] leading-relaxed">
                                    Active images persist in proxy memory with a 2-hour sliding window. Memory locks prevent browser CORS locks.
                                </p>
                            </div>

                            {/* Top Contributing Domains (Proxy Volume Analytics) */}
                            <div className="flex flex-col gap-2">
                                <h4 className="text-[10px] text-[var(--dev-console-text-muted)] font-bold uppercase tracking-wider font-mono border-b border-[var(--dev-console-border)] pb-1">
                                    Top Origin Server Distribution
                                </h4>
                                
                                {sortedDomains.length === 0 ? (
                                    <p className="text-[11px] text-[var(--dev-console-text-muted)] italic py-2 text-center">No hostname distribution metrics available.</p>
                                ) : (
                                    <div className="flex flex-col border-b border-[var(--dev-console-border)] -mx-4">
                                        {sortedDomains.map((dom, i) => (
                                            <div key={dom.name + i} className="flex flex-col bg-[var(--dev-console-bg-hover)]/30 hover:bg-[var(--dev-console-bg-active)] px-4 py-2.5 border-b border-[var(--dev-console-border)] last:border-b-0 transition-all duration-200">
                                                <div className="flex justify-between items-center text-[var(--dev-console-text-muted)] font-mono text-[10px] mb-1.5">
                                                    <span className="truncate max-w-[200px] text-[var(--dev-console-text)] font-bold" title={dom.name}>{dom.name}</span>
                                                    <span className="text-[var(--dev-console-text-muted)] font-bold">{dom.count} img ({Math.round(dom.percent)}%)</span>
                                                </div>
                                                <div className="w-full h-1 bg-[var(--dev-console-border)] rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${
                                                            i === 0 ? 'bg-[#10b981]' : 
                                                            i === 1 ? 'bg-[#3b82f6]' : 
                                                            i === 2 ? 'bg-[#8b5cf6]' : 
                                                            'bg-neutral-600'
                                                        }`} 
                                                        style={{ width: `${dom.percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    );
                })()}
            </div>

            {/* Right Side: Server Cache Visualizer List */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-[500px] md:min-h-0">
                <div className="flex-none p-3 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[var(--dev-console-text)] uppercase tracking-widest font-sans">Server-Side Proxy Cache ({serverImageCacheSummary.count || 0})</span>
                    </div>
                    <span className="text-[10px] text-[var(--dev-console-text-muted)] font-mono font-medium">{formatSize(serverImageCacheSummary.totalSizeBytes || 0)}</span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent font-sans">
                    {(serverImageCacheSummary.items || []).length === 0 ? (
                        <div className="text-neutral-500 italic p-12 text-center text-xs flex flex-col items-center justify-center h-full gap-2 font-sans">
                            <Image size={24} className="opacity-15" />
                            Server memory proxy cache is empty.
                        </div>
                    ) : (() => {
                        const items = serverImageCacheSummary.items || [];
                        return (
                            <div className="flex flex-col divide-y divide-[var(--dev-console-border)] text-xs font-sans">
                                {items.map((item, idx) => (
                                    <div key={item.url + idx} className="p-3 hover:bg-[var(--dev-console-bg-active)] transition-all flex items-start gap-3 group">
                                        {/* Thumbnail Box */}
                                        <div className="w-10 h-10 shrink-0 bg-[var(--dev-console-border)] rounded-md border border-[var(--dev-console-border)] overflow-hidden flex items-center justify-center select-none">
                                            <img src={item.url} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                                        </div>
                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[var(--dev-console-text)] font-mono text-[11px] truncate select-all" title={item.url}>{item.url}</div>
                                            <div className="text-[10px] text-[var(--dev-console-text-muted)] flex items-center gap-2 mt-1 font-mono">
                                                <span>{formatSize(item.sizeBytes)}</span>
                                                <span>•</span>
                                                <span className={item.isExpired ? 'text-red-400' : 'text-[var(--dev-console-text-muted)]'}>
                                                    {item.isExpired ? 'Expired' : `TTL: ${item.timeLeftMinutes ? item.timeLeftMinutes.toFixed(1) : 0}m left`}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Action Elements */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {deletingImageUrl === item.url ? (
                                                <div className="flex items-center gap-1 shrink-0 font-sans">
                                                    <button 
                                                        disabled={isDeletingImage !== null}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingImageUrl(null);
                                                        }}
                                                        className="px-2 py-0.5 bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] rounded-md font-sans text-[10px] cursor-pointer transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        disabled={isDeletingImage !== null}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (isDeletingImage) return;
                                                            setIsDeletingImage(item.url);
                                                            try {
                                                                await fetch('/api/image-cache-delete', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ url: item.url })
                                                                });
                                                                await fetchImageCacheData();
                                                            } catch (err) {
                                                                console.error("Error deleting image cache item:", err);
                                                            } finally {
                                                                setIsDeletingImage(null);
                                                                setDeletingImageUrl(null);
                                                            }
                                                        }}
                                                        className="px-2 py-0.5 bg-red-600 dark:bg-red-900 text-white border border-red-700 dark:border-red-700/80 rounded-md font-bold cursor-pointer font-sans text-[10px] transition-colors shrink-0 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed min-w-[50px]"
                                                    >
                                                        {isDeletingImage === item.url ? (
                                                            <>
                                                                <Loader2 size={10} className="animate-spin shrink-0" />
                                                                <span>Deleting</span>
                                                            </>
                                                        ) : (
                                                            <span>Delete</span>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleCopy(item.url, `srv-copy-${idx}`)}
                                                        className="p-1 hover:bg-[var(--dev-console-border)] rounded-md text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors"
                                                        title="Copy URL"
                                                    >
                                                        {copiedId === `srv-copy-${idx}` ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingImageUrl(item.url);
                                                        }}
                                                        className="p-1 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-md text-[var(--dev-console-text-muted)] hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                        title="Remove Entry"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {showFlushConfirm && (
                    <ConfirmationModal
                        isOpen={showFlushConfirm}
                        onClose={() => setShowFlushConfirm(false)}
                        onConfirm={async () => {
                            setShowFlushConfirm(false);
                            await handleClearServerImageCache();
                        }}
                        title="Flush Server-Side Image Cache"
                        message="Are you sure you want to flush the entire server-side image cache? This will delete all cached proxy images in server memory, forcing subsequent requests to fetch and re-proxy them. This action is destructive and cannot be undone."
                        confirmButtonText="Flush Cache"
                        confirmButtonVariant="danger"
                    />
                )}
            </div>
        </div>
    );
};
