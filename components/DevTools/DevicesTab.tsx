import React, { useState, useEffect } from 'react';
import { Smartphone, Cpu, Loader2, Search, X, Database, ChevronRight, Trash2, Copy, Check } from 'lucide-react';
import { getPersistentDeviceId } from '../../utils/deviceUtils';

interface DevicesTabProps {
    isOpen: boolean;
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
    onDeviceMappingsCountChange: (count: number) => void;
}

export const DevicesTab: React.FC<DevicesTabProps> = ({ 
    isOpen, 
    copiedId, 
    handleCopy, 
    onDeviceMappingsCountChange 
}) => {
    // Cache management states
    const [cacheData, setCacheData] = useState<Record<string, string | null>>({});
    const [cacheSearch, setCacheSearch] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newName, setNewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [cacheStatusMessage, setCacheStatusMessage] = useState('');
    const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
    const [isDeviceCacheLoading, setIsDeviceCacheLoading] = useState(false);
    const [isDeviceCacheLoaded, setIsDeviceCacheLoaded] = useState(false);
    const [persistentDeviceId, setPersistentDeviceId] = useState<string>('');

    // Gemini Live Resolver Test states
    const [testModel, setTestModel] = useState('');
    const [resolverResult, setResolverResult] = useState<any | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [testError, setTestError] = useState('');

    const fetchCacheData = async () => {
        setIsDeviceCacheLoading(true);
        try {
            try {
                const pId = await getPersistentDeviceId();
                setPersistentDeviceId(pId);
            } catch (pIdErr) {
                console.warn("Failed to get persistent device id:", pIdErr);
            }
            
            const response = await fetch('/api/device-mapper?action=cache_list');
            if (response.ok) {
                const data = await response.json();
                setCacheData(data);
                setIsDeviceCacheLoaded(true);
                onDeviceMappingsCountChange(Object.keys(data).length);
            }
        } catch (err) {
            console.error("Failed to fetch device cache data:", err);
        } finally {
            setIsDeviceCacheLoading(false);
        }
    };

    useEffect(() => {
        if (!isDeviceCacheLoaded) {
            fetchCacheData();
        }
    }, [isDeviceCacheLoaded]);

    // Handle updates when mapped count changes
    useEffect(() => {
        onDeviceMappingsCountChange(Object.keys(cacheData).length);
    }, [cacheData, onDeviceMappingsCountChange]);

    if (!isOpen) return null;

    return (
        <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col md:flex-row w-full h-full md:min-h-0 overflow-y-auto md:overflow-hidden bg-[var(--dev-console-bg)]">
                {/* Left Side: Operations / Add-Edit */}
                <div className="w-full md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-[var(--dev-console-border)] p-4 flex flex-col gap-4 overflow-visible md:overflow-y-auto md:h-full md:min-h-0">
                    <h3 className="text-sm font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2 border-b border-[var(--dev-console-border)] pb-2 shrink-0">
                        <Smartphone size={16} className="text-[#007fd4]" />
                        Device Model Mapping
                    </h3>
                    
                    {persistentDeviceId && (
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase text-[var(--dev-console-text-muted)] tracking-wider">
                                Persistent Device Hash
                            </span>
                            <div className="p-2.5 bg-gray-100 dark:bg-black rounded-md border border-[var(--dev-console-border)] flex items-center justify-between gap-3">
                                <span className="font-mono text-xs text-[var(--dev-console-text)] break-all select-all">
                                    {persistentDeviceId}
                                </span>
                                <button 
                                    onClick={() => handleCopy(persistentDeviceId, 'hash-id')}
                                    className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors shrink-0"
                                    title="Copy Hash ID"
                                >
                                    {copiedId === 'hash-id' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                    )}
                    
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newModel.trim()) return;
                        setIsSaving(true);
                        setCacheStatusMessage('');
                        try {
                            const response = await fetch('/api/device-mapper?action=cache_update', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ model: newModel, name: newName || null })
                            });
                            if (response.ok) {
                                setNewModel('');
                                setNewName('');
                                setCacheStatusMessage('Saved successfully!');
                                fetchCacheData();
                                setTimeout(() => setCacheStatusMessage(''), 3000);
                            } else {
                                setCacheStatusMessage('Error saving to cache.');
                            }
                        } catch (err) {
                            setCacheStatusMessage('Network error saving.');
                        } finally {
                            setIsSaving(false);
                        }
                    }} className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <div className="flex-1 min-w-0">
                                <label className="block text-[11px] text-[var(--dev-console-text-muted)] mb-1 font-bold uppercase tracking-wider font-mono truncate">Device Model Code</label>
                                <input 
                                    className="w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono"
                                    placeholder="e.g. SM-S928U"
                                    value={newModel}
                                    onChange={e => setNewModel(e.target.value)}
                                    required
                                />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <label className="block text-[11px] text-[var(--dev-console-text-muted)] mb-1 font-bold uppercase tracking-wider font-mono truncate">Marketing Name</label>
                                <input 
                                    className="w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors"
                                    placeholder="e.g. Google Pixel 8a"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <button 
                            type="submit"
                            disabled={isSaving || !newModel.trim()}
                            className="w-full bg-[#007fd4] text-white rounded py-2 text-xs font-semibold hover:bg-[#007fd4]/90 disabled:opacity-50 transition-colors cursor-pointer mt-1 font-sans"
                        >
                            {isSaving ? 'Saving...' : 'Save Mapping'}
                        </button>
                        
                        {cacheStatusMessage && (
                            <div className={`text-[11px] font-semibold text-center p-1 rounded font-sans ${cacheStatusMessage.includes('error') || cacheStatusMessage.includes('Error') ? 'bg-red-50 dark:bg-red-950/45 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-950/45 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50'}`}>
                                {cacheStatusMessage}
                            </div>
                        )}
                    </form>

                    <div className="border-t border-[var(--dev-console-border)] my-2 pt-4 flex flex-col gap-3">
                        <h4 className="text-xs font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2 uppercase font-mono">
                            <Cpu size={14} className="text-amber-500" />
                            Gemini Live Resolver
                        </h4>
                        
                        <p className="text-[10px] text-[var(--dev-console-text-muted)] leading-relaxed font-sans">
                            Test the Gemini API resolver live. This forces the model to bypass cache and use real-time Google Search grounding to retrieve current specifications.
                        </p>

                        <div className="flex gap-2 w-full">
                            <input 
                                className="w-[70%] bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono shrink-0"
                                placeholder="Enter model code, e.g. SM-S928U"
                                value={testModel}
                                onChange={e => setTestModel(e.target.value)}
                                disabled={isResolving}
                            />
                            
                            <button 
                                type="button"
                                onClick={async () => {
                                    if (!testModel.trim()) return;
                                    setIsResolving(true);
                                    setTestError('');
                                    setResolverResult(null);
                                    try {
                                        const response = await fetch('/api/device-mapper', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ model: testModel, skipCache: true })
                                        });
                                        if (response.ok) {
                                            const data = await response.json();
                                            setResolverResult(data);
                                            if (data.error) {
                                                setTestError(data.error);
                                            }
                                        } else {
                                            setTestError('Failed to resolve device model.');
                                        }
                                    } catch (err: any) {
                                        setTestError(err.message || 'Network error occurred.');
                                    } finally {
                                        setIsResolving(false);
                                    }
                                }}
                                disabled={isResolving || !testModel.trim()}
                                className="w-[30%] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-hover)] text-[var(--dev-console-text)] rounded py-2 text-xs font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sans shrink-0 overflow-hidden"
                                title={isResolving ? "Resolving..." : "Resolve with Gemini (Live)"}
                            >
                                {isResolving ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin text-[#007fd4] shrink-0" />
                                        <span className="truncate">Resolving...</span>
                                    </>
                                ) : (
                                    <span className="truncate">Resolve</span>
                                )}
                            </button>
                        </div>

                        {testError && (
                            <div className="text-[11px] bg-red-50 dark:bg-red-950/45 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-950/40 px-2 py-1.5 rounded font-sans leading-tight">
                                {testError}
                            </div>
                        )}

                        {resolverResult && (
                            <div className="bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded p-3 flex flex-col gap-2 font-sans text-xs">
                                <div className="flex flex-col gap-0.5 pb-2 border-b border-[var(--dev-console-border)]">
                                    <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold font-mono">Resolved Name</span>
                                    <span className="font-semibold text-[var(--dev-console-text)] font-sans text-[13px]">{resolverResult.name || 'Unknown / Not Found'}</span>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold font-mono">Knowledge Base Source</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        {resolverResult.usedSearchTool ? (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 font-bold uppercase font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mr-0.5" />
                                                Google Search Tool
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase font-mono">
                                                Internal Knowledge
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {resolverResult.usedSearchTool && resolverResult.sources && resolverResult.sources.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-neutral-900">
                                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold font-mono flex items-center gap-1">
                                            Reference Web Sources ({resolverResult.sources.length})
                                        </span>
                                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                                            {resolverResult.sources.map((src: any, index: number) => (
                                                <a 
                                                    key={index} 
                                                    href={src.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    referrerPolicy="no-referrer" 
                                                    className="flex items-center gap-1 p-1 rounded hover:bg-[var(--dev-console-bg-active)] transition-colors text-blue-500 hover:text-blue-600 text-[11px] truncate"
                                                >
                                                    <span className="font-mono text-[var(--dev-console-text-muted)]">[{index + 1}]</span>
                                                    <span className="truncate flex-1">{src.title || src.uri}</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Search / List View */}
                <div className="flex-1 flex flex-col shrink-0 min-h-[400px] md:min-h-0 md:shrink-1 overflow-visible md:overflow-hidden md:h-full">
                    <div className="flex-none p-3 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2.5 py-1 w-full sm:w-72 focus-within:border-[#007fd4] transition-colors font-sans flex-1">
                            <Search size={13} className="text-[var(--dev-console-text-muted)] mr-2" />
                            <input 
                                className="bg-transparent text-xs text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans" 
                                placeholder="Search cached models..." 
                                value={cacheSearch} 
                                onChange={e => setCacheSearch(e.target.value)} 
                            />
                            {cacheSearch && <button onClick={() => setCacheSearch('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                        </div>
                        <button 
                            onClick={fetchCacheData}
                            className="px-2.5 py-1 rounded bg-[var(--dev-console-bg-active)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-xs text-[var(--dev-console-text-muted)] transition-colors font-sans cursor-pointer"
                        >
                            Refresh List
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-visible md:overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                        {Object.entries(cacheData).length === 0 ? (
                            <div className="text-[var(--dev-console-text-muted)] italic p-12 text-center text-xs flex flex-col items-center gap-2 justify-center h-full">
                                <Database size={32} className="opacity-20 mb-2" />
                                Cache is currently empty or loading.
                            </div>
                        ) : (() => {
                            const filtered = Object.entries(cacheData).filter(([model, name]) => {
                                if (!cacheSearch) return true;
                                const cleanQuery = cacheSearch.toLowerCase();
                                return model.toLowerCase().includes(cleanQuery) || 
                                       (!!name && name.toLowerCase().includes(cleanQuery));
                            });

                            if (filtered.length === 0) {
                                return (
                                    <div className="text-[var(--dev-console-text-muted)] italic p-12 text-center text-xs flex flex-col items-center gap-2 justify-center h-full font-sans">
                                        No cached entries found matching "{cacheSearch}".
                                    </div>
                                );
                            }

                            return (
                                <div className="flex flex-col">
                                    {filtered.map(([model, name]) => (
                                        <div key={model} className="flex justify-between items-center px-4 py-2.5 border-b border-[var(--dev-console-border)] hover:bg-[var(--dev-console-bg-active)] transition-colors text-xs group">
                                            <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                                                <div className="font-bold text-[var(--dev-console-text)] font-mono tracking-wider">{model}</div>
                                                <div className="text-[var(--dev-console-text-muted)] font-sans truncate">
                                                    {name === null ? (
                                                        <span className="text-amber-500/80 italic font-mono text-[10px]">Negative Match Locked (will skip Gemini resolution)</span>
                                                    ) : name}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button 
                                                    onClick={() => {
                                                        setNewModel(model);
                                                        setNewName(name || '');
                                                    }}
                                                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--dev-console-border)] rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-opacity cursor-pointer"
                                                    title="Edit Entry"
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                                {deletingModelId === model ? (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeletingModelId(null);
                                                            }}
                                                            className="px-2 py-0.5 bg-[var(--dev-console-bg)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] rounded font-sans text-[10px] cursor-pointer transition-colors shrink-0"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    const response = await fetch('/api/device-mapper?action=cache_delete', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ model })
                                                                    });
                                                                    if (response.ok) {
                                                                        setDeletingModelId(null);
                                                                        fetchCacheData();
                                                                    }
                                                                } catch (err) {
                                                                    console.error("Error deleting cached item:", err);
                                                                }
                                                            }}
                                                            className="px-2 py-0.5 bg-red-600 dark:bg-red-900 text-white border border-red-700 dark:border-red-700/80 rounded font-bold cursor-pointer font-sans text-[10px] transition-colors shrink-0"
                                                        >
                                                            Confirm
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingModelId(model);
                                                        }}
                                                        className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-950/45 rounded text-[var(--dev-console-text-muted)] hover:text-red-600 dark:hover:text-red-400 transition-opacity cursor-pointer"
                                                        title="Delete Entry"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Footer Status Bar */}
            <div className="flex-none h-6 border-t border-[var(--dev-console-border)] bg-[#007fd4] text-white flex items-center px-3 text-[11px] font-medium gap-4 select-none">
                <span>{Object.keys(cacheData).length} device mappings cached</span>
                <span className="w-px h-3 bg-white/30"></span>
                <span>100% Offline Efficiency</span>
            </div>
        </div>
    );
};
