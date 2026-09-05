import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Cpu, Loader2, Search, X, Database, ChevronRight, Trash2, Copy, Check, Globe, ShieldAlert, FileText, Filter, Terminal, ExternalLink, Clock, RotateCw, ChevronDown, Key, BookOpen, Plus, Code, Lock, Server } from 'lucide-react';
import { getPersistentDeviceId } from '../../utils/deviceUtils';
import { DevSelect } from './UIComponents';
import ConfirmationModal from '../ConfirmationModal';

// Global module-level flags to prevent duplicate/concurrent fetches across mounts and Strict Mode double-mounting
let globalIsDeviceCacheLoaded = false;
let globalIsDeviceCacheFetching = false;
let globalIsAiModelLoaded = false;
let globalIsAiModelFetching = false;
let globalAiModelData: string | null = null;
let globalIsAuditLogsLoaded = false;
let globalIsAuditLogsFetching = false;
let globalIsApiKeysLoaded = false;
let globalIsApiKeysFetching = false;

const modelOptions = [
    { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' }
];

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
    // Right side SubTab state ('cache' | 'audit' | 'apikeys' | 'docs')
    const [subTab, setSubTab] = useState<'cache' | 'audit' | 'apikeys' | 'docs'>('cache');

    // Cache management states
    const [cacheData, setCacheData] = useState<Record<string, string | null>>({});
    const [cacheSearch, setCacheSearch] = useState('');
    const [newModel, setNewModel] = useState('');
    const [newName, setNewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [cacheStatusMessage, setCacheStatusMessage] = useState('');
    const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
    const [isDeviceCacheLoading, setIsDeviceCacheLoading] = useState(false);
    const [isDeviceCacheLoaded, setIsDeviceCacheLoaded] = useState(() => globalIsDeviceCacheLoaded);
    const [persistentDeviceId, setPersistentDeviceId] = useState<string>('');

    // Gemini Live Resolver Test states
    const [testModel, setTestModel] = useState('');
    const [resolverResult, setResolverResult] = useState<any | null>(null);
    const [isResolving, setIsResolving] = useState(false);
    const [testError, setTestError] = useState('');
    const [selectedAiModel, setSelectedAiModel] = useState(() => globalAiModelData || 'gemini-2.5-flash');

    // Audit Logs states
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isAuditLogsLoading, setIsAuditLogsLoading] = useState(false);
    const [isAuditLogsLoaded, setIsAuditLogsLoaded] = useState(() => globalIsAuditLogsLoaded);
    const lastAuditFilterRef = useRef<boolean | null>(null);
    const [auditSearch, setAuditSearch] = useState('');
    const [externalOnlyFilter, setExternalOnlyFilter] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [isClearLogsModalOpen, setIsClearLogsModalOpen] = useState(false);
    const [isClearingLogs, setIsClearingLogs] = useState(false);

    // API Keys management states
    const [apiKeys, setApiKeys] = useState<any[]>([]);
    const [isApiKeysLoading, setIsApiKeysLoading] = useState(false);
    const [isApiKeysLoaded, setIsApiKeysLoaded] = useState(() => globalIsApiKeysLoaded);
    const [apiKeySearch, setApiKeySearch] = useState('');
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyDomain, setNewKeyDomain] = useState('');
    const [isCreatingKey, setIsCreatingKey] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<any | null>(null);
    const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
    const [isRevokingKey, setIsRevokingKey] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Active Code Snippet tab in Docs
    const [activeSnippet, setActiveSnippet] = useState<'node' | 'curl' | 'fetch' | 'python'>('node');
    const [docCopyLang, setDocCopyLang] = useState<'node' | 'curl' | 'fetch' | 'python'>('node');
    const [isDocLangDropdownOpen, setIsDocLangDropdownOpen] = useState(false);

    const getSnippetCode = (lang: string) => {
        const origin = 'https://ceaznet.vercel.app';
        if (lang === 'curl') {
            return `# cURL Request Example
curl -X POST "${origin}/api/device-mapper" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: sk_dm_xxxxxxxxxxxxxxxx" \\
  -d '{"model": "SM-S918B"}'`;
        }
        if (lang === 'fetch') {
            return `// JavaScript (Browser Fetch) Example
fetch('${origin}/api/device-mapper', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'sk_dm_xxxxxxxxxxxxxxxx'
  },
  body: JSON.stringify({ model: 'SM-S918B' })
})
.then(res => res.json())
.then(data => console.log('Resolved Device Name:', data.name));`;
        }
        if (lang === 'python') {
            return `# Python requests Example
import requests

url = "${origin}/api/device-mapper"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "sk_dm_xxxxxxxxxxxxxxxx"
}
payload = {"model": "SM-S918B"}

response = requests.post(url, json=payload, headers=headers)
print("Resolved Device Name:", response.json().get("name"))`;
        }
        // Node.js default
        return `// Node.js (Server / Backend Integration)
import fetch from 'node-fetch'; // Built-in fetch supported in Node 18+

export async function resolveDeviceModel(modelCode: string) {
  const response = await fetch('${origin}/api/device-mapper', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'sk_dm_xxxxxxxxxxxxxxxx' // API Key generated from DevTools
    },
    body: JSON.stringify({
      model: modelCode
    })
  });

  const data = await response.json();
  return data.name; // e.g. "Samsung Galaxy S23 Ultra"
}`;
    };

    const getMarkdownContent = (lang: string) => {
        const snippet = getSnippetCode(lang);
        const langTitle = lang === 'node' ? 'Node.js' : lang === 'curl' ? 'cURL / CLI' : lang === 'fetch' ? 'JavaScript (Fetch)' : 'Python';
        const langSyntax = lang === 'python' ? 'python' : lang === 'curl' ? 'bash' : 'javascript';
        const origin = 'https://ceaznet.vercel.app';

        return `# Device Mapper API - Technical Integration Specification

## 1. Overview
The **Device Mapper API** resolves mobile device hardware model codes (e.g. \`SM-S918B\`, \`2201116SG\`, \`iPhone14,2\`) into human-readable commercial device names (e.g. **Samsung Galaxy S23 Ultra**, **Xiaomi 12 Pro**, **iPhone 13 Pro**).

---

## 2. API Endpoint Specification

### Base URL
\`\`\`http
POST ${origin}/api/device-mapper
\`\`\`

### Authentication & Headers
| Header Name | Type | Required | Description |
|---|---|---|---|
| \`Content-Type\` | \`application/json\` | Yes | Payload format |
| \`x-api-key\` | \`string\` | Yes (Recommended) | Registered API key from DevTools (\`sk_dm_...\`) |

### Request Body Parameters (JSON)
| Parameter | Type | Required | Description |
|---|---|---|---|
| \`model\` | \`string\` | **Yes** | Device model code or number (e.g. \`SM-S918B\`) |
| \`skipCache\` | \`boolean\` | No | Set \`true\` to bypass cache and force AI lookup |

### Response Schema (JSON)
\`\`\`json
{
  "name": "Samsung Galaxy S23 Ultra",
  "source": "telegram_cache",
  "usedSearchTool": false
}
\`\`\`

---

## 3. Integration Code Sample (${langTitle})

\`\`\`${langSyntax}
${snippet}
\`\`\`

---
*Generated by Ceaznet DevTools Device Mapper Console*`;
    };

    const fetchApiKeys = async (force = false) => {
        if (globalIsApiKeysFetching) return;
        if (!force && globalIsApiKeysLoaded) return;
        globalIsApiKeysFetching = true;
        setIsApiKeysLoading(true);
        try {
            const res = await fetch('/api/device-mapper?action=api_keys_list');
            if (res.ok) {
                const data = await res.json();
                if (data.keys) {
                    setApiKeys(data.keys);
                    globalIsApiKeysLoaded = true;
                    setIsApiKeysLoaded(true);
                }
            }
        } catch (err) {
            console.error("Failed to fetch API keys:", err);
        } finally {
            globalIsApiKeysFetching = false;
            setIsApiKeysLoading(false);
        }
    };

    const handleCreateApiKey = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newKeyName.trim()) return;
        setIsCreatingKey(true);
        try {
            const res = await fetch('/api/device-mapper?action=api_key_create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName, domain: newKeyDomain })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.key) {
                    setNewlyCreatedKey(data.key);
                    setNewKeyName('');
                    setNewKeyDomain('');
                    setShowCreateForm(false);
                    fetchApiKeys(true);
                }
            }
        } catch (err) {
            console.error("Failed to create API key:", err);
        } finally {
            setIsCreatingKey(false);
        }
    };

    const handleDeleteApiKey = async (id: string) => {
        setIsRevokingKey(true);
        try {
            const res = await fetch('/api/device-mapper?action=api_key_delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                setDeletingKeyId(null);
                fetchApiKeys(true);
            }
        } catch (err) {
            console.error("Failed to delete API key:", err);
        } finally {
            setIsRevokingKey(false);
        }
    };

    const handleAiModelChange = async (model: string) => {
        setSelectedAiModel(model);
        globalAiModelData = model;
        try {
            localStorage.setItem('preferred_device_ai_model', model);
        } catch (e) {}
        try {
            await fetch('/api/device-mapper?action=set_ai_model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiModel: model })
            });
        } catch (err) {
            console.error("Failed to persist AI model choice on backend:", err);
        }
    };

    useEffect(() => {
        if (globalIsAiModelLoaded || globalIsAiModelFetching) return;
        globalIsAiModelFetching = true;
        fetch('/api/device-mapper?action=get_ai_model')
            .then(res => res.json())
            .then(data => {
                globalIsAiModelLoaded = true;
                if (data && data.aiModel) {
                    globalAiModelData = data.aiModel;
                    setSelectedAiModel(data.aiModel);
                    try { localStorage.setItem('preferred_device_ai_model', data.aiModel); } catch(e){}
                } else {
                    const local = localStorage.getItem('preferred_device_ai_model');
                    if (local) {
                        globalAiModelData = local;
                        setSelectedAiModel(local);
                    }
                }
            })
            .catch(() => {
                const local = localStorage.getItem('preferred_device_ai_model');
                if (local) {
                    globalAiModelData = local;
                    setSelectedAiModel(local);
                }
            })
            .finally(() => {
                globalIsAiModelFetching = false;
            });
    }, []);

    const fetchCacheData = async (force = false) => {
        if (globalIsDeviceCacheFetching) return;
        if (!force && globalIsDeviceCacheLoaded) return;
        globalIsDeviceCacheFetching = true;
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
                globalIsDeviceCacheLoaded = true;
                setIsDeviceCacheLoaded(true);
                onDeviceMappingsCountChange(Object.keys(data).length);
            }
        } catch (err) {
            console.error("Failed to fetch device cache data:", err);
        } finally {
            globalIsDeviceCacheFetching = false;
            setIsDeviceCacheLoading(false);
        }
    };

    const fetchAuditLogs = async (force = false) => {
        if (globalIsAuditLogsFetching) return;
        if (!force && globalIsAuditLogsLoaded && lastAuditFilterRef.current === externalOnlyFilter) return;
        globalIsAuditLogsFetching = true;
        setIsAuditLogsLoading(true);
        try {
            const url = `/api/device-mapper?action=audit_logs&limit=200${externalOnlyFilter ? '&externalOnly=true' : ''}`;
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.logs) {
                    setAuditLogs(data.logs);
                    globalIsAuditLogsLoaded = true;
                    setIsAuditLogsLoaded(true);
                    lastAuditFilterRef.current = externalOnlyFilter;
                }
            }
        } catch (err) {
            console.error("Failed to fetch audit logs:", err);
        } finally {
            globalIsAuditLogsFetching = false;
            setIsAuditLogsLoading(false);
        }
    };

    const handleClearAuditLogs = () => {
        setIsClearLogsModalOpen(true);
    };

    const executeClearAuditLogs = async () => {
        setIsClearingLogs(true);
        try {
            const res = await fetch('/api/device-mapper?action=clear_audit_logs', { method: 'POST' });
            if (res.ok) {
                setAuditLogs([]);
                globalIsAuditLogsLoaded = true;
                setIsAuditLogsLoaded(true);
                lastAuditFilterRef.current = externalOnlyFilter;
                setIsClearLogsModalOpen(false);
            }
        } catch (err) {
            console.error("Failed to clear audit logs:", err);
        } finally {
            setIsClearingLogs(false);
        }
    };

    useEffect(() => {
        if (!isDeviceCacheLoaded) {
            fetchCacheData();
        }
    }, [isDeviceCacheLoaded]);

    useEffect(() => {
        if (subTab === 'audit') {
            const filterChanged = lastAuditFilterRef.current !== externalOnlyFilter;
            if (!isAuditLogsLoaded || filterChanged) {
                fetchAuditLogs();
            }
        }
    }, [subTab, externalOnlyFilter, isAuditLogsLoaded]);

    useEffect(() => {
        if (subTab === 'apikeys' && !isApiKeysLoaded) {
            fetchApiKeys();
        }
    }, [subTab, isApiKeysLoaded]);

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
                                Device ID
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
                                fetchCacheData(true);
                                setTimeout(() => setCacheStatusMessage(''), 3000);
                            } else {
                                setCacheStatusMessage('Error saving to cache.');
                            }
                        } catch (err) {
                            setCacheStatusMessage('Network error saving.');
                        } finally {
                            setIsSaving(false);
                        }
                    }} className="flex flex-col gap-2">
                        <div className="flex gap-2 items-end w-full">
                            <div className="flex-1 min-w-0">
                                <label className="block text-[11px] text-[var(--dev-console-text-muted)] mb-1 font-bold uppercase tracking-wider font-mono truncate">Model Code</label>
                                <input 
                                    className="w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono"
                                    placeholder="e.g. SM-S928U"
                                    value={newModel}
                                    onChange={e => setNewModel(e.target.value)}
                                    required
                                />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <label className="block text-[11px] text-[var(--dev-console-text-muted)] mb-1 font-bold uppercase tracking-wider font-mono truncate">Marketing Name</label>
                                <input 
                                    className="w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-1.5 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors"
                                    placeholder="e.g. Pixel 8a"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={isSaving || !newModel.trim()}
                                className="bg-[#007fd4] text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-[#007fd4]/90 disabled:opacity-50 transition-colors cursor-pointer font-sans shrink-0 h-[28px] flex items-center justify-center gap-1.5"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin text-white shrink-0" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <span>Save</span>
                                )}
                            </button>
                        </div>
                        
                        {cacheStatusMessage && (
                            <div className={`text-[11px] font-semibold text-center p-1 rounded font-sans ${cacheStatusMessage.includes('error') || cacheStatusMessage.includes('Error') ? 'bg-red-50 dark:bg-red-950/45 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50' : 'bg-green-50 dark:bg-green-950/45 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50'}`}>
                                {cacheStatusMessage}
                            </div>
                        )}
                    </form>

                    <div className="border-t border-[var(--dev-console-border)] my-2 pt-4 flex flex-col gap-3">
                        <h4 className="text-xs font-semibold text-[var(--dev-console-text)] tracking-wider flex items-center gap-2 uppercase font-mono">
                            <Cpu size={14} className="text-amber-500" />
                            Live Resolver
                        </h4>
                        
                        <p className="text-[10px] text-[var(--dev-console-text-muted)] leading-relaxed font-sans">
                            Test the live resolver. This forces the system to bypass cache and use real-time Google Search grounding to retrieve current specifications.
                        </p>

                        <div className="flex gap-1.5 sm:gap-2 items-end w-full">
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <label className="block text-[9px] sm:text-[10px] text-[var(--dev-console-text-muted)] font-bold uppercase tracking-wider font-mono truncate">
                                    Model Code
                                </label>
                                <input 
                                    className="w-full bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded px-2 py-1 text-xs text-[var(--dev-console-text)] focus:outline-none focus:border-[#007fd4] transition-colors font-mono h-[26px] md:h-7"
                                    placeholder="SM-S928U"
                                    value={testModel}
                                    onChange={e => setTestModel(e.target.value)}
                                    disabled={isResolving}
                                />
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <label className="block text-[9px] sm:text-[10px] text-[var(--dev-console-text-muted)] font-bold uppercase tracking-wider font-mono truncate">
                                    AI Model
                                </label>
                                <DevSelect 
                                    value={selectedAiModel}
                                    options={modelOptions}
                                    onChange={handleAiModelChange}
                                    disabled={isResolving}
                                />
                            </div>
                            
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
                                            body: JSON.stringify({ model: testModel, skipCache: true, aiModel: selectedAiModel })
                                        });
                                        if (response.ok) {
                                            const data = await response.json();
                                            setResolverResult(data);
                                            if (data.error) {
                                                setTestError(data.error);
                                            }
                                            if (subTab === 'audit') fetchAuditLogs(true);
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
                                className="h-[26px] md:h-7 px-2.5 sm:px-3.5 bg-[#007fd4] text-white rounded text-xs font-semibold hover:bg-[#007fd4]/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-1 cursor-pointer font-sans shrink-0 whitespace-nowrap"
                                title={isResolving ? "Resolving..." : "Resolve with Gemini (Live)"}
                            >
                                {isResolving ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin text-white shrink-0" />
                                        <span className="hidden sm:inline">Resolving...</span>
                                    </>
                                ) : (
                                    <span>Resolve</span>
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
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-green-100/50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 font-bold uppercase font-mono">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400 animate-pulse mr-0.5" />
                                                Google Search Tool
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-100/50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 font-bold uppercase font-mono">
                                                Internal Knowledge
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {resolverResult.usedSearchTool && resolverResult.sources && resolverResult.sources.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-[var(--dev-console-border)]">
                                        <span className="text-[10px] text-[var(--dev-console-text-muted)] uppercase tracking-widest font-bold font-mono flex items-center gap-1">
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

                {/* Right Side: Tab Switcher & Sub-Views */}
                <div className="flex-1 flex flex-col shrink-0 min-h-[400px] md:min-h-0 md:shrink-1 overflow-visible md:overflow-hidden md:h-full">
                    {/* Navigation Sub-Tabs Header */}
                    <div className="flex-none px-3 h-9 bg-[var(--dev-console-tab-bg)] border-b border-[var(--dev-console-border)] flex items-center justify-between gap-2 overflow-x-auto select-none">
                        <div className="flex items-center gap-1 h-full">
                            <button
                                onClick={() => setSubTab('cache')}
                                className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                                    subTab === 'cache'
                                        ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                        : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                                }`}
                                title="Device Cache"
                            >
                                <Database size={13} className="shrink-0" />
                                <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                                    subTab === 'cache' ? 'max-w-[140px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                                }`}>
                                    Device Cache
                                </span>
                                <span className={`ml-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                                    subTab === 'cache' ? 'bg-[#007fd4]/15 text-[#007fd4]' : 'bg-[var(--dev-console-badge-bg)] text-[var(--dev-console-badge-text)]'
                                }`}>
                                    {Object.keys(cacheData).length}
                                </span>
                            </button>

                            <button
                                onClick={() => setSubTab('audit')}
                                className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                                    subTab === 'audit'
                                        ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                        : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                                }`}
                                title="External Audit Logs"
                            >
                                <ShieldAlert size={13} className={`shrink-0 ${auditLogs.some(l => l.is_external) ? "text-purple-600 dark:text-purple-400" : ""}`} />
                                <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                                    subTab === 'audit' ? 'max-w-[160px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                                }`}>
                                    External Logs
                                </span>
                                <span className={`ml-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                                    subTab === 'audit' ? 'bg-[#007fd4]/15 text-[#007fd4]' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                                }`}>
                                    {auditLogs.length}
                                </span>
                            </button>

                            <button
                                 onClick={() => setSubTab('apikeys')}
                                className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                                    subTab === 'apikeys'
                                        ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                        : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                                }`}
                                title="API Keys Management"
                            >
                                <Key size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
                                <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                                    subTab === 'apikeys' ? 'max-w-[140px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                                }`}>
                                    API Keys
                                </span>
                                <span className={`ml-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                                    subTab === 'apikeys' ? 'bg-[#007fd4]/15 text-[#007fd4]' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                                }`}>
                                    {apiKeys.length}
                                </span>
                            </button>

                            <button
                                onClick={() => setSubTab('docs')}
                                className={`h-full px-3 text-xs font-semibold flex items-center transition-all duration-200 cursor-pointer whitespace-nowrap border-b-[2px] ${
                                    subTab === 'docs'
                                        ? 'border-[#007fd4] text-[#007fd4] bg-[var(--dev-console-bg)] font-medium'
                                        : 'border-transparent text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-neutral-500/10'
                                }`}
                                title="API Integration Documentation"
                            >
                                <BookOpen size={13} className="shrink-0 text-emerald-400" />
                                <span className={`transition-all duration-300 ease-in-out overflow-hidden flex items-center ${
                                    subTab === 'docs' ? 'max-w-[140px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'
                                }`}>
                                    API Docs
                                </span>
                                <span className="ml-1.5 px-1 py-0.2 rounded text-[8px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                                    Guide
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* SUB-TAB 1: Mapped Device Cache View */}
                    {subTab === 'cache' && (
                        <>
                            <div className="flex-none p-2 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center bg-transparent border border-[var(--dev-console-border)] px-3 py-1.5 focus-within:border-[#007fd4] transition-colors font-sans flex-1">
                                    <Search size={13} className="text-[var(--dev-console-text-muted)] mr-2 shrink-0" />
                                    <input 
                                        className="bg-transparent text-xs text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans" 
                                        placeholder="Search cached models..." 
                                        value={cacheSearch} 
                                        onChange={e => setCacheSearch(e.target.value)} 
                                    />
                                    {cacheSearch && <button onClick={() => setCacheSearch('')}><X size={12} className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]" /></button>}
                                </div>
                                <button 
                                    onClick={() => fetchCacheData(true)}
                                    className="px-2.5 py-1 rounded bg-[var(--dev-console-bg-active)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-xs text-[var(--dev-console-text-muted)] transition-colors font-sans cursor-pointer flex items-center gap-1.5"
                                >
                                    {isDeviceCacheLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
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
                                                                                fetchCacheData(true);
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
                        </>
                    )}

                    {/* SUB-TAB 2: External Request Audit Logs View */}
                    {subTab === 'audit' && (
                        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden w-full">
                            <div className="flex-none p-2 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex items-center bg-transparent border border-[var(--dev-console-border)] px-3 py-1.5 focus-within:border-[#007fd4] transition-colors font-sans flex-1">
                                    <Search size={13} className="text-[var(--dev-console-text-muted)] mr-2 shrink-0" />
                                    <input 
                                        className="bg-transparent text-xs text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans" 
                                        placeholder="Search domain, IP, model code..." 
                                        value={auditSearch} 
                                        onChange={e => setAuditSearch(e.target.value)} 
                                    />
                                    {auditSearch && (
                                        <button onClick={() => setAuditSearch('')} className="p-0.5 hover:text-[var(--dev-console-text)]">
                                            <X size={12} className="text-[var(--dev-console-text-muted)]" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => fetchAuditLogs(true)}
                                        disabled={isAuditLogsLoading}
                                        className="px-2.5 py-1 rounded bg-[var(--dev-console-bg-active)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-xs text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors font-sans cursor-pointer flex items-center gap-1.5"
                                    >
                                        {isAuditLogsLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                                        <span>Refresh</span>
                                    </button>

                                    <button 
                                        onClick={handleClearAuditLogs}
                                        className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-semibold transition-colors font-sans cursor-pointer flex items-center gap-1"
                                    >
                                        <Trash2 size={12} />
                                        <span>Clear</span>
                                    </button>
                                </div>
                            </div>

                            {/* Network-style Table Header */}
                            <div className="flex items-center px-3 py-1.5 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text-muted)] select-none font-semibold sticky top-0 text-[10px] sm:text-[11px] uppercase w-full shrink-0 font-mono whitespace-nowrap overflow-x-auto scrollbar-hide">
                                <div className="w-[85px] sm:w-[110px] shrink-0 whitespace-nowrap">Method / Status</div>
                                <div className="flex-1 min-w-[100px] pr-2 whitespace-nowrap truncate">Origin / Domain</div>
                                <div className="w-[80px] sm:w-[110px] shrink-0 hidden sm:block whitespace-nowrap">Model</div>
                                <div className="w-[60px] sm:w-[75px] shrink-0 text-right whitespace-nowrap">Time</div>
                                <div className="w-[70px] sm:w-[90px] shrink-0 text-right whitespace-nowrap">Timestamp</div>
                            </div>

                            {/* Network-style Edge-to-Edge List */}
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                {isAuditLogsLoading && auditLogs.length === 0 ? (
                                    <div className="p-12 text-center text-xs text-[var(--dev-console-text-muted)] flex flex-col items-center justify-center gap-2">
                                        <Loader2 size={24} className="animate-spin text-[#007fd4]" />
                                        <span>Loading device resolver audit logs...</span>
                                    </div>
                                ) : auditLogs.length === 0 ? (
                                    <div className="text-[var(--dev-console-text-muted)] italic p-12 text-center text-xs flex flex-col items-center gap-2 justify-center h-full">
                                        <Globe size={32} className="opacity-20 mb-2 text-[#007fd4]" />
                                        <span>No external device mapper requests logged yet.</span>
                                        <p className="text-[10px] text-neutral-500 max-w-sm leading-relaxed mt-1 font-sans">
                                            Any external website, API client, or domain calling <code className="font-mono text-[#007fd4]">/api/device-mapper</code> will automatically record origin domain, IP, headers, requested model, and execution latency here.
                                        </p>
                                    </div>
                                ) : (() => {
                                    const filteredLogs = auditLogs.filter((log: any) => {
                                        if (!auditSearch) return true;
                                        const query = auditSearch.toLowerCase();
                                        return (log.app_name || '').toLowerCase().includes(query) ||
                                               (log.domain || '').toLowerCase().includes(query) ||
                                               (log.model || '').toLowerCase().includes(query) ||
                                               (log.client_ip || '').toLowerCase().includes(query) ||
                                               (log.action || '').toLowerCase().includes(query) ||
                                               (log.node_agent || '').toLowerCase().includes(query) ||
                                               (log.user_agent || '').toLowerCase().includes(query) ||
                                               (log.origin || '').toLowerCase().includes(query);
                                    });

                                    if (filteredLogs.length === 0) {
                                        return (
                                            <div className="text-[var(--dev-console-text-muted)] italic p-12 text-center text-xs">
                                                No audit records match "{auditSearch}".
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col w-full">
                                            {filteredLogs.map((log: any) => {
                                                const isExpanded = expandedLogId === log.id;
                                                const isSuccess = log.status_code >= 200 && log.status_code < 300;
                                                const method = log.method || 'GET';
                                                const statusCode = log.status_code || 200;

                                                const formatTime = (isoString?: string) => {
                                                    if (!isoString) return 'N/A';
                                                    try {
                                                        const d = new Date(isoString);
                                                        return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                    } catch {
                                                        return 'N/A';
                                                    }
                                                };

                                                const methodColorClass = method === 'POST' 
                                                    ? 'text-emerald-600 dark:text-[#4ec9b0]' 
                                                    : 'text-blue-600 dark:text-[#569cd6]';

                                                const statusColorClass = isSuccess 
                                                    ? 'text-green-700 dark:text-[#89d185]' 
                                                    : 'text-red-600 dark:text-[#f48771]';

                                                return (
                                                    <div key={log.id || Math.random()} className="border-b border-[var(--dev-console-border-light)] w-full">
                                                        {/* Compact Row */}
                                                        <div 
                                                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                            className={`px-3 py-1.5 flex items-center text-[10px] sm:text-[11px] font-mono cursor-pointer transition-colors select-none ${
                                                                isExpanded ? 'bg-[var(--dev-console-bg-active)]' : 'hover:bg-[var(--dev-console-bg-hover)]'
                                                            } border-l-[3px] ${log.is_external ? 'border-l-purple-500' : 'border-l-gray-400'}`}
                                                        >
                                                            {/* Method & Status */}
                                                            <div className="w-[85px] sm:w-[110px] shrink-0 flex items-center gap-1.5">
                                                                <span className={`font-bold ${methodColorClass}`}>{method}</span>
                                                                <span className={`font-semibold ${statusColorClass}`}>{statusCode}</span>
                                                                {log.is_external && (
                                                                    <span className="px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 hidden sm:inline-block">
                                                                        EXT
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* App Name & Domain & Endpoint */}
                                                            <div className="flex-1 min-w-0 pr-2 flex items-center gap-1.5">
                                                                <span className="font-bold text-[var(--dev-console-text)] truncate" title={log.app_name || log.domain || 'Unknown App'}>
                                                                    {log.app_name ? `${log.app_name}${log.domain && log.domain !== log.app_name ? ` (${log.domain})` : ''}` : (log.domain || 'Unknown')}
                                                                </span>
                                                                <span className="text-[var(--dev-console-text-muted)] text-[9px] truncate hidden md:inline">
                                                                    ({log.action || 'resolve_device'})
                                                                </span>
                                                            </div>

                                                            {/* Model */}
                                                            <div className="w-[80px] sm:w-[110px] shrink-0 hidden sm:block truncate text-blue-400 font-bold text-[10px]">
                                                                {log.model ? log.model : <span className="text-[var(--dev-console-text-muted)] font-normal italic">N/A</span>}
                                                            </div>

                                                            {/* Execution Time */}
                                                            <div className="w-[60px] sm:w-[75px] shrink-0 text-right text-[var(--dev-console-text)] font-semibold text-[10px]">
                                                                {log.execution_time_ms ? `${log.execution_time_ms}ms` : '<1ms'}
                                                            </div>

                                                            {/* Timestamp */}
                                                            <div className="w-[70px] sm:w-[90px] shrink-0 text-right text-[var(--dev-console-text-muted)] text-[10px] pl-1 font-mono">
                                                                {formatTime(log.created_at)}
                                                            </div>
                                                        </div>

                                                        {/* Expanded Request Details Panel */}
                                                        {isExpanded && (
                                                            <div className="p-3 border-t border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-3 font-mono text-[11px] select-text">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px]">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Origin App Name</span>
                                                                        <span className="text-[var(--dev-console-text)] break-all font-semibold">{log.app_name || log.domain || 'Unknown App'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Origin Domain</span>
                                                                        <span className="text-[var(--dev-console-text)] break-all">{log.domain || 'None'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Referer</span>
                                                                        <span className="text-[var(--dev-console-text)] break-all">{log.referer || 'None'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Client IP</span>
                                                                        <span className="text-[var(--dev-console-text)] font-bold">{log.client_ip || 'Unknown'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">HTTP Method & Status</span>
                                                                        <span className="text-[var(--dev-console-text)] font-bold">
                                                                            <span className={methodColorClass}>{method}</span> <span className={statusColorClass}>{statusCode}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Action / Endpoint</span>
                                                                        <span className="text-[#007fd4] font-bold">{log.action || 'resolve_device'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Response Time</span>
                                                                        <span className="text-amber-600 dark:text-amber-400 font-bold">{log.execution_time_ms ? `${log.execution_time_ms}ms` : '<1ms'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5 sm:col-span-2">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Timestamp</span>
                                                                        <span className="text-[var(--dev-console-text)]">{log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Node Agent & User Agent Section */}
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 border-t border-[var(--dev-console-border)] pt-2">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">Node Agent</span>
                                                                        <span className="text-[#007fd4] font-mono break-all text-[10px] font-bold">{log.node_agent || log.user_agent || 'Node.js / Server API Client'}</span>
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className="text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase">User Agent</span>
                                                                        <span className="text-[var(--dev-console-text)] break-all text-[10px] opacity-90">{log.user_agent || 'N/A'}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Request Query & Body JSON */}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] text-[var(--dev-console-text-muted)] font-bold uppercase">Request Payload</span>
                                                                        <pre className="p-2 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded text-[10px] text-emerald-600 dark:text-emerald-400 overflow-x-auto max-h-36 font-mono">
                                                                            {JSON.stringify({ query: log.request_query || {}, body: log.request_body || {} }, null, 2)}
                                                                        </pre>
                                                                    </div>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] text-[var(--dev-console-text-muted)] font-bold uppercase">Response Payload</span>
                                                                        <pre className="p-2 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded text-[10px] text-blue-600 dark:text-blue-400 overflow-x-auto max-h-36 font-mono">
                                                                            {JSON.stringify(log.response_body || {}, null, 2)}
                                                                        </pre>
                                                                    </div>
                                                                </div>

                                                                {log.error_message && (
                                                                    <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[11px] font-sans">
                                                                        <strong>Error Message: </strong>{log.error_message}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* SUB-TAB 3: API Keys Management View */}
                    {subTab === 'apikeys' && (
                        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden w-full">
                            <div className="flex-none p-2 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center bg-transparent border border-[var(--dev-console-border)] px-3 py-1.5 focus-within:border-[#007fd4] transition-colors font-sans flex-1">
                                    <Search size={12} className="text-[var(--dev-console-text-muted)] mr-1.5 shrink-0" />
                                    <input 
                                        className="bg-transparent text-xs text-[var(--dev-console-text)] outline-none w-full placeholder:text-[var(--dev-console-text-muted)] font-sans" 
                                        placeholder="Search API keys..." 
                                        value={apiKeySearch} 
                                        onChange={e => setApiKeySearch(e.target.value)} 
                                    />
                                    {apiKeySearch && (
                                        <button onClick={() => setApiKeySearch('')} className="p-0.5 hover:text-[var(--dev-console-text)]">
                                            <X size={11} className="text-[var(--dev-console-text-muted)]" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={() => fetchApiKeys(true)}
                                        disabled={isApiKeysLoading}
                                        className="px-2 py-0.5 rounded bg-[var(--dev-console-bg-active)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] text-xs text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors font-sans cursor-pointer flex items-center gap-1"
                                    >
                                        {isApiKeysLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />}
                                        <span>Refresh</span>
                                    </button>

                                    <button 
                                        onClick={() => {
                                            setShowCreateForm(!showCreateForm);
                                            setNewlyCreatedKey(null);
                                        }}
                                        className="px-2.5 py-0.5 rounded bg-[#007fd4] hover:bg-[#007fd4]/90 text-white text-xs font-semibold transition-colors font-sans cursor-pointer flex items-center gap-1 shadow-sm"
                                    >
                                        <Plus size={12} />
                                        <span>Create API Key</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                {/* Create New API Key Form Card */}
                                {showCreateForm && (
                                    <div className="p-3 pb-0">
                                        <form onSubmit={handleCreateApiKey} className="bg-[var(--dev-console-bg)] border border-[#007fd4]/40 rounded p-3 flex flex-col gap-2.5 shadow-md shrink-0">
                                            <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Key size={13} className="text-amber-400" />
                                                    <span className="text-xs font-bold text-[var(--dev-console-text)] font-sans">Generate New API Key</span>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowCreateForm(false)} 
                                                    className="text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>

                                            {/* Desktop: single row for inputs + buttons. Mobile: 2-column inputs side-by-side + action buttons below right */}
                                            <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                                                <div className="grid grid-cols-2 gap-2.5 flex-1 min-w-0">
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <label className="text-[9px] font-bold text-[var(--dev-console-text-muted)] uppercase tracking-wider font-mono truncate">
                                                            Client App Name <span className="text-red-400">*</span>
                                                        </label>
                                                        <input 
                                                            type="text" 
                                                            required 
                                                            placeholder="e.g. Yotube" 
                                                            value={newKeyName} 
                                                            onChange={e => setNewKeyName(e.target.value)} 
                                                            className="w-full bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] rounded px-2 py-1 text-xs text-[var(--dev-console-text)] outline-none focus:border-[#007fd4] font-sans h-7"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <label className="text-[9px] font-bold text-[var(--dev-console-text-muted)] uppercase tracking-wider font-mono truncate">
                                                            Domain (Optional)
                                                        </label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. example.com" 
                                                            value={newKeyDomain} 
                                                            onChange={e => setNewKeyDomain(e.target.value)} 
                                                            className="w-full bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] rounded px-2 py-1 text-xs text-[var(--dev-console-text)] outline-none focus:border-[#007fd4] font-sans h-7"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-end gap-1.5 shrink-0 pt-0.5 sm:pt-0">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setShowCreateForm(false)} 
                                                        className="px-2.5 py-1 rounded bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] border border-[var(--dev-console-border)] text-xs font-sans cursor-pointer h-7"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        type="submit" 
                                                        disabled={isCreatingKey || !newKeyName.trim()} 
                                                        className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs font-sans cursor-pointer disabled:opacity-50 flex items-center gap-1 h-7 whitespace-nowrap"
                                                    >
                                                        {isCreatingKey ? <Loader2 size={11} className="animate-spin" /> : <Key size={11} />}
                                                        <span>Generate Key</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {/* Newly Created Key Display */}
                                {newlyCreatedKey && (
                                    <div className="p-3 pb-0">
                                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded p-2.5 flex flex-col gap-1.5 shrink-0 animate-fade-in">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                                                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-sans">API Key Created Successfully!</span>
                                                </div>
                                                <button 
                                                    onClick={() => setNewlyCreatedKey(null)} 
                                                    className="text-emerald-600/70 dark:text-neutral-400 hover:text-emerald-900 dark:hover:text-white"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-emerald-700 dark:text-emerald-200/70 font-sans leading-normal">
                                                Make sure to copy this key now. External callers must pass this inside the <code className="font-mono text-emerald-800 dark:text-emerald-300 font-bold">x-api-key</code> header.
                                            </p>
                                            <div className="flex items-center gap-2 bg-emerald-100/50 dark:bg-black/40 border border-emerald-200 dark:border-emerald-500/20 rounded px-2 py-1 mt-0.5">
                                                <span className="font-mono text-xs text-emerald-800 dark:text-emerald-300 font-bold truncate flex-1 select-all">{newlyCreatedKey.key}</span>
                                                <button 
                                                    onClick={() => handleCopy(newlyCreatedKey.key, `key-${newlyCreatedKey.id}`)}
                                                    className="px-2 py-0.5 bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black font-bold rounded text-[10px] hover:bg-emerald-700 dark:hover:bg-emerald-400 flex items-center gap-1 shrink-0 cursor-pointer"
                                                >
                                                    {copiedId === `key-${newlyCreatedKey.id}` ? <Check size={11} /> : <Copy size={11} />}
                                                    <span>{copiedId === `key-${newlyCreatedKey.id}` ? 'Copied' : 'Copy'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Edge-to-Edge List Wrapper */}
                                <div className="flex-1 flex flex-col mt-2.5">
                                    {/* Compact Table Header */}
                                    <div className="flex items-center px-4 py-1.5 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text-muted)] select-none font-semibold text-[9px] sm:text-[10px] uppercase w-full shrink-0 font-mono whitespace-nowrap">
                                        <div className="w-[120px] sm:w-[160px] shrink-0 truncate whitespace-nowrap">Client App Name</div>
                                        <div className="flex-1 min-w-0 font-mono truncate whitespace-nowrap">Masked Key</div>
                                        <div className="w-[120px] sm:w-[180px] shrink-0 hidden sm:block truncate whitespace-nowrap">Target Domain</div>
                                        <div className="w-[90px] shrink-0 hidden md:block truncate whitespace-nowrap">Created At</div>
                                        <div className="w-[80px] shrink-0 text-right truncate whitespace-nowrap">Actions</div>
                                    </div>

                                    {/* List of Keys in Compact List Layout */}
                                    {isApiKeysLoading && apiKeys.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-[var(--dev-console-text-muted)] flex items-center justify-center gap-2">
                                            <Loader2 size={14} className="animate-spin text-[#007fd4]" />
                                            <span>Loading keys...</span>
                                        </div>
                                    ) : apiKeys.length === 0 ? (
                                        <div className="text-[var(--dev-console-text-muted)] italic p-8 text-center text-xs flex flex-col items-center gap-2 justify-center">
                                            <Key size={24} className="opacity-20 text-amber-400 mb-1" />
                                            <span>No API keys created yet.</span>
                                            <p className="text-[10px] text-neutral-500 max-w-sm font-sans leading-relaxed">
                                                Generate an API key to let external clients make calls to <code className="font-mono text-[#007fd4]">/api/device-mapper</code>.
                                            </p>
                                        </div>
                                    ) : (() => {
                                        const filtered = apiKeys.filter(k => {
                                            if (!apiKeySearch) return true;
                                            const q = apiKeySearch.toLowerCase();
                                            return k.name.toLowerCase().includes(q) || (k.domain && k.domain.toLowerCase().includes(q)) || k.maskedKey.toLowerCase().includes(q);
                                        });

                                        return (
                                            <div className="flex flex-col bg-[var(--dev-console-bg)]">
                                                {filtered.map((k: any) => (
                                                    <div 
                                                        key={k.id} 
                                                        className="px-4 py-1.5 flex items-center text-[10px] sm:text-[11px] font-mono border-b last:border-b-0 border-[var(--dev-console-border-light)] border-l-[3px] border-l-amber-500 hover:bg-[var(--dev-console-bg-hover)] transition-colors select-none"
                                                    >
                                                        <div className="w-[120px] sm:w-[160px] shrink-0 flex items-center gap-1.5 min-w-0 pr-2">
                                                            <Key size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                            <span className="font-bold text-[var(--dev-console-text)] truncate" title={k.name}>
                                                                {k.name}
                                                            </span>
                                                        </div>

                                                        <div className="flex-1 min-w-0 pr-2 font-mono text-[10px] text-amber-700 dark:text-amber-300 font-semibold truncate">
                                                            <code>{k.maskedKey}</code>
                                                        </div>

                                                        <div className="w-[120px] sm:w-[180px] shrink-0 hidden sm:block font-mono text-[10px] text-[var(--dev-console-text-muted)] truncate">
                                                            {k.domain || <span className="opacity-40 italic">Any (Auto-Detect)</span>}
                                                        </div>

                                                        <div className="w-[90px] shrink-0 hidden md:block text-[10px] text-[var(--dev-console-text-muted)]">
                                                            {new Date(k.created_at).toLocaleDateString()}
                                                        </div>

                                                        <div className="w-[80px] shrink-0 flex items-center justify-end gap-1">
                                                            <button 
                                                                onClick={() => handleCopy(k.key || k.maskedKey, `keylist-${k.id}`)}
                                                                className="p-1 hover:bg-[var(--dev-console-bg-active)] rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] transition-colors cursor-pointer"
                                                                title="Copy API Key"
                                                            >
                                                                {copiedId === `keylist-${k.id}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                                            </button>

                                                            {deletingKeyId === k.id ? (
                                                                <div className="flex items-center gap-1 shrink-0 font-sans">
                                                                    <button 
                                                                        type="button"
                                                                        disabled={isRevokingKey}
                                                                        onClick={() => setDeletingKeyId(null)} 
                                                                        className="px-1.5 py-0.5 text-[9px] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text)] border border-[var(--dev-console-border)] rounded hover:bg-[var(--dev-console-bg-hover)] cursor-pointer font-semibold disabled:opacity-50"
                                                                    >
                                                                        No
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        disabled={isRevokingKey}
                                                                        onClick={() => handleDeleteApiKey(k.id)} 
                                                                        className="px-2 py-0.5 text-[9px] bg-red-600 hover:bg-red-700 text-white rounded font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                                                    >
                                                                        {isRevokingKey ? <Loader2 size={10} className="animate-spin" /> : null}
                                                                        <span>{isRevokingKey ? 'Revoking...' : 'Revoke'}</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setDeletingKeyId(k.id)}
                                                                    className="text-red-400 hover:text-red-300 hover:underline font-sans font-medium text-[10px] cursor-pointer px-1 py-0.5"
                                                                    title="Revoke API Key"
                                                                >
                                                                    Revoke
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
                    )}

                    {/* SUB-TAB 4: API Integration Documentation View */}
                    {subTab === 'docs' && (
                        <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden w-full">
                            {/* Flat, Container-less Top Action Header */}
                            <div className="flex-none px-3 sm:px-4 py-2 border-b border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex items-center justify-between gap-2 relative z-30">
                                <div className="flex items-center gap-1.5 font-sans min-w-0">
                                    <span className="text-xs font-bold text-[var(--dev-console-text)] whitespace-nowrap truncate">API Integration Documentation</span>
                                </div>
                                
                                <div className="flex items-center gap-1.5 sm:gap-2 font-sans text-xs shrink-0">
                                    <span className="text-[var(--dev-console-text-muted)] text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Include Snippet Language:</span>
                                    
                                    {/* Custom Dropdown language selector */}
                                    <div className="relative font-sans text-xs shrink-0">
                                        <button
                                            onClick={() => setIsDocLangDropdownOpen(!isDocLangDropdownOpen)}
                                            className="flex items-center justify-between gap-1.5 bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] text-[var(--dev-console-text)] text-[11px] rounded px-2 py-0.5 outline-none font-semibold hover:border-[#007fd4] transition-colors cursor-pointer select-none h-6 min-w-[70px]"
                                            title="Select Snippet Language"
                                        >
                                            <span>
                                                {docCopyLang === 'node' ? 'Node.js' : 
                                                 docCopyLang === 'curl' ? 'cURL' : 
                                                 docCopyLang === 'fetch' ? 'Fetch' : 'Python'}
                                            </span>
                                            <ChevronDown size={11} className={`transition-transform text-[var(--dev-console-text-muted)] ${isDocLangDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        
                                        {isDocLangDropdownOpen && (
                                            <>
                                                {/* Backdrop to close dropdown on outside clicks */}
                                                <div 
                                                    className="fixed inset-0 z-10" 
                                                    onClick={() => setIsDocLangDropdownOpen(false)}
                                                />
                                                <div className="absolute left-0 mt-1 w-max max-w-none bg-[var(--dev-console-bg)] border border-[var(--dev-console-border)] rounded shadow-xl overflow-hidden z-50 font-sans text-[11px]">
                                                    {[
                                                        { id: 'node', label: 'Node.js', desc: 'Server' },
                                                        { id: 'curl', label: 'cURL', desc: 'CLI' },
                                                        { id: 'fetch', label: 'Fetch', desc: 'JS' },
                                                        { id: 'python', label: 'Python', desc: 'Requests' }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => {
                                                                setDocCopyLang(opt.id as any);
                                                                setIsDocLangDropdownOpen(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 hover:bg-[var(--dev-console-bg-hover)] flex flex-row items-center gap-2 cursor-pointer border-b border-[var(--dev-console-border-light)] last:border-0 ${
                                                                docCopyLang === opt.id ? 'bg-[var(--dev-console-bg-active)]' : ''
                                                            }`}
                                                        >
                                                            <span className="font-semibold text-[var(--dev-console-text)] whitespace-nowrap">{opt.label}</span>
                                                            <span className="text-[9px] text-[var(--dev-console-text-muted)] whitespace-nowrap">({opt.desc})</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Copy Markdown Button with text visible on mobile as well */}
                                    <button
                                        onClick={() => {
                                            const md = getMarkdownContent(docCopyLang);
                                            handleCopy(md, 'full-md-docs');
                                        }}
                                        className="px-2.5 py-0.5 rounded bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-[10px] sm:text-[11px] transition-colors flex items-center gap-1 cursor-pointer shadow-sm shrink-0 h-6"
                                        title="Copy entire documentation as structured Markdown"
                                    >
                                        {copiedId === 'full-md-docs' ? <Check size={11} /> : <Copy size={11} />}
                                        <span>
                                            {copiedId === 'full-md-docs' ? (
                                                <>
                                                    <span className="sm:hidden">Copied!</span>
                                                    <span className="hidden sm:inline">Copied MD!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="sm:hidden">Markdown</span>
                                                    <span className="hidden sm:inline">Copy Markdown</span>
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Clean, Container-less Document Canvas */}
                            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent font-sans text-xs flex flex-col gap-5 leading-relaxed text-[var(--dev-console-text)] select-text">
                                
                                {/* Section 1: Overview */}
                                <div className="flex flex-col gap-1.5 pb-4 border-b border-[var(--dev-console-border-light)]">
                                    <h2 className="text-sm font-bold text-[var(--dev-console-text)]">
                                        1. System Overview & Architecture
                                    </h2>
                                    <p className="text-[12px] text-[var(--dev-console-text-muted)]">
                                        The Device Mapper API is a high-performance, real-time microservice that accepts hardware model codes (e.g. <code className="font-mono text-[#007fd4] font-bold">SM-S918B</code>, <code className="font-mono text-[#007fd4] font-bold">2201116SG</code>) and maps them to clean commercial brand names (e.g. <span className="text-emerald-400 font-semibold">Samsung Galaxy S23 Ultra</span>). This translation powers client dashboards, analytical telemetry, and system-wide device logging.
                                    </p>
                                </div>

                                {/* Section 2: REST API Reference */}
                                <div className="flex flex-col gap-2 pb-4 border-b border-[var(--dev-console-border-light)]">
                                    <h2 className="text-sm font-bold text-[var(--dev-console-text)]">
                                        2. REST API Specification
                                    </h2>
                                    
                                    <div className="flex flex-col gap-3 font-sans mt-1">
                                        <div className="flex items-center gap-2 bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)] rounded px-2.5 py-1 w-fit font-mono text-[11px]">
                                            <span className="font-bold text-emerald-400">POST</span>
                                            <span className="text-[var(--dev-console-text)]">/api/device-mapper</span>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dev-console-text-muted)] font-mono">HTTP Headers</span>
                                            <div className="-mx-4 w-[calc(100%+2rem)] border-y border-[var(--dev-console-border)] overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                                <table className="min-w-[500px] w-full text-left border-collapse text-[11px] font-sans">
                                                    <thead>
                                                        <tr className="bg-[var(--dev-console-tab-bg)] border-b border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase font-mono">
                                                            <th className="px-4 py-1.5 whitespace-nowrap">Header</th>
                                                            <th className="px-4 py-1.5 whitespace-nowrap">Required</th>
                                                            <th className="px-4 py-1.5 whitespace-nowrap">Description</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[var(--dev-console-border-light)] text-[var(--dev-console-text)]">
                                                        <tr>
                                                            <td className="px-4 py-1.5 font-mono text-emerald-600 dark:text-emerald-300 whitespace-nowrap">Content-Type</td>
                                                            <td className="px-4 py-1.5 text-amber-600 dark:text-amber-400 whitespace-nowrap">Yes</td>
                                                            <td className="px-4 py-1.5 text-[var(--dev-console-text-muted)] whitespace-nowrap">Must be <code className="font-mono text-[var(--dev-console-text)]">application/json</code></td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-4 py-1.5 font-mono text-emerald-600 dark:text-emerald-300 whitespace-nowrap">x-api-key</td>
                                                            <td className="px-4 py-1.5 text-blue-600 dark:text-blue-400 whitespace-nowrap">Recommended</td>
                                                            <td className="px-4 py-1.5 text-[var(--dev-console-text-muted)] whitespace-nowrap">Pass your registered client token (e.g. <code className="font-mono text-[var(--dev-console-text)]">sk_dm_...</code>) to authenticate</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--dev-console-text-muted)] font-mono">Payload Parameters (JSON Body)</span>
                                            <div className="-mx-4 w-[calc(100%+2rem)] border-y border-[var(--dev-console-border)] overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] scrollbar-track-transparent">
                                                <table className="min-w-[500px] w-full text-left border-collapse text-[11px] font-sans">
                                                    <thead>
                                                        <tr className="bg-[var(--dev-console-tab-bg)] border-b border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)] font-bold text-[10px] uppercase font-mono">
                                                            <th className="px-4 py-1.5 whitespace-nowrap">Parameter</th>
                                                            <th className="px-4 py-1.5 whitespace-nowrap">Type</th>
                                                            <th className="px-4 py-1.5 whitespace-nowrap">Required</th>
                                                            <th className="px-4 py-1.5 whitespace-nowrap">Description</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-[var(--dev-console-border-light)] text-[var(--dev-console-text)]">
                                                        <tr>
                                                            <td className="px-4 py-1.5 font-mono text-emerald-600 dark:text-emerald-300 whitespace-nowrap">model</td>
                                                            <td className="px-4 py-1.5 font-mono text-purple-600 dark:text-purple-400 whitespace-nowrap">string</td>
                                                            <td className="px-4 py-1.5 text-amber-600 dark:text-amber-400 whitespace-nowrap">Yes</td>
                                                            <td className="px-4 py-1.5 text-[var(--dev-console-text-muted)] whitespace-nowrap">Device hardware code (e.g. <code className="font-mono text-[var(--dev-console-text)]">SM-S918B</code>)</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="px-4 py-1.5 font-mono text-emerald-600 dark:text-emerald-300 whitespace-nowrap">skipCache</td>
                                                            <td className="px-4 py-1.5 font-mono text-purple-600 dark:text-purple-400 whitespace-nowrap">boolean</td>
                                                            <td className="px-4 py-1.5 text-blue-600 dark:text-blue-400 whitespace-nowrap">No</td>
                                                            <td className="px-4 py-1.5 text-[var(--dev-console-text-muted)] whitespace-nowrap">Force direct live resolution, skipping system cache</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Code Snippets Switcher */}
                                <div className="flex flex-col gap-2 pb-2">
                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
                                        <h2 className="text-sm font-bold text-[var(--dev-console-text)]">
                                            3. Code Integration Sample
                                        </h2>

                                        {/* Container holding Language Tabs + Adjacent Copy Button on desktop, opposite on mobile */}
                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                                            {/* Snippet Switcher Tabs */}
                                            <div className="flex items-center gap-0.5 bg-[var(--dev-console-tab-bg)] p-0.5 rounded border border-[var(--dev-console-border)] font-mono text-[10px]">
                                                {(['node', 'curl', 'fetch', 'python'] as const).map((lang) => (
                                                    <button 
                                                        key={lang}
                                                        onClick={() => setActiveSnippet(lang)}
                                                        className={`px-2 py-0.5 rounded transition-colors font-bold cursor-pointer ${
                                                            activeSnippet === lang ? 'bg-[#007fd4] text-white' : 'text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] hover:bg-[var(--dev-console-bg-hover)]'
                                                        }`}
                                                    >
                                                        {lang === 'node' ? 'Node.js' : lang === 'curl' ? 'cURL' : lang === 'fetch' ? 'Fetch' : 'Python'}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Copy Snippet Button (Adjacent to tabs on desktop, opposite side of tabs on mobile) */}
                                            <button 
                                                onClick={() => handleCopy(getSnippetCode(activeSnippet), `snippet-${activeSnippet}`)}
                                                className="px-2.5 py-1 bg-[var(--dev-console-bg-active)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] rounded text-[10px] text-[var(--dev-console-text)] flex items-center gap-1 cursor-pointer font-sans h-6 font-semibold shadow-sm transition-colors shrink-0"
                                                title="Copy Sample Code"
                                            >
                                                {copiedId === `snippet-${activeSnippet}` ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                                <span>{copiedId === `snippet-${activeSnippet}` ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Snippet Code Viewer Box */}
                                    <div className="relative bg-[var(--dev-console-tab-bg)] border border-[var(--dev-console-border)] rounded p-3.5 font-mono text-[11px] mt-1 shadow-sm">
                                        <pre className="text-emerald-800 dark:text-emerald-300 overflow-x-auto leading-relaxed pt-1 select-all">
                                            {getSnippetCode(activeSnippet)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Status Bar */}
            <div className="flex-none border-t border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] text-[var(--dev-console-text-muted)] flex items-center px-3 h-7 text-[11px] font-mono select-none gap-4">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007fd4] shrink-0" />
                    <span className="font-semibold text-[var(--dev-console-text)]">{Object.keys(cacheData).length}</span>
                    <span>mappings cached</span>
                </div>
                <div className="w-px h-3.5 bg-[var(--dev-console-border)]" />
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007fd4] shrink-0" />
                    <span className="font-semibold text-[var(--dev-console-text)]">{auditLogs.length}</span>
                    <span>external logs</span>
                </div>
                <div className="w-px h-3.5 bg-[var(--dev-console-border)]" />
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-semibold text-[var(--dev-console-text)]">{apiKeys.length}</span>
                    <span>API keys</span>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isClearLogsModalOpen}
                onClose={() => {
                    setIsClearingLogs(false);
                    setIsClearLogsModalOpen(false);
                }}
                onConfirm={executeClearAuditLogs}
                title="Clear Audit Logs"
                message="Are you sure you want to clear all device mapper audit logs? This action cannot be undone."
                confirmButtonText="Clear Logs"
                confirmButtonVariant="danger"
                isLoading={isClearingLogs}
            />
        </div>
    );
};

