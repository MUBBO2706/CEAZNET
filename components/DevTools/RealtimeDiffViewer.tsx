import React, { useState } from 'react';
import { FileText, Copy, Check, Code, GitCommit } from 'lucide-react';
import { renderLogMessageWithBadges } from './UIComponents';

interface RealtimeDiffViewerProps {
  prefix?: string;
  payload: any;
  logId?: string;
}

const PREFERRED_FIELD_ORDER = [
  'id',
  'user_id',
  'location',
  'action_by',
  'device_id',
  'created_at',
  'ip_address',
  'action_from',
  'device_name',
  'session_key',
  'browser_name',
  'browser_version',
  'os_name',
  'os_version',
  'is_incognito',
  'battery_percentage',
  'last_active_at',
  'expires_at',
  'status'
];

export const parseRealtimePayload = (data: any): { isRealtime: boolean; payload: any; prefix?: string } => {
  if (!data) return { isRealtime: false, payload: null };

  // If data is already an object
  if (typeof data === 'object') {
    if (
      data &&
      (data.eventType !== undefined || data.new !== undefined || data.old !== undefined || (data.schema && data.table))
    ) {
      return { isRealtime: true, payload: data };
    }
  }

  // If data is string, try parsing as JSON
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed.eventType !== undefined || parsed.new !== undefined || parsed.old !== undefined || (parsed.schema && parsed.table))
        ) {
          return { isRealtime: true, payload: parsed };
        }
      } catch {}
    }
  }

  return { isRealtime: false, payload: null };
};

export const extractRealtimeFromLogArgs = (
  rawArgs?: any[],
  args?: any[]
): { isRealtime: boolean; prefix?: string; payload: any } => {
  // 1. Check rawArgs first
  if (rawArgs && rawArgs.length > 0) {
    if (rawArgs.length === 1) {
      const parsed = parseRealtimePayload(rawArgs[0]);
      if (parsed.isRealtime) return { isRealtime: true, payload: parsed.payload };
    } else {
      // Find which arg is the realtime payload
      for (let i = 0; i < rawArgs.length; i++) {
        const parsed = parseRealtimePayload(rawArgs[i]);
        if (parsed.isRealtime) {
          const prefixParts = rawArgs.slice(0, i).map(a => (typeof a === 'string' ? a : JSON.stringify(a)));
          return { isRealtime: true, prefix: prefixParts.join(' '), payload: parsed.payload };
        }
      }
    }
  }

  // 2. Fallback to string args
  if (args && args.length > 0) {
    if (args.length === 1) {
      const parsed = parseRealtimePayload(args[0]);
      if (parsed.isRealtime) return { isRealtime: true, payload: parsed.payload };
    } else {
      for (let i = 0; i < args.length; i++) {
        const parsed = parseRealtimePayload(args[i]);
        if (parsed.isRealtime) {
          const prefix = args.slice(0, i).join(' ');
          return { isRealtime: true, prefix, payload: parsed.payload };
        }
      }
    }

    // Try joining and detecting substring JSON if logged as single joined string
    const joined = args.join(' ');
    const firstBrace = joined.indexOf('{');
    const lastBrace = joined.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = joined.substring(firstBrace, lastBrace + 1);
      const prefixCandidate = joined.substring(0, firstBrace).trim();
      try {
        const parsed = JSON.parse(jsonCandidate);
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed.eventType !== undefined || parsed.new !== undefined || parsed.old !== undefined || (parsed.schema && parsed.table))
        ) {
          return { isRealtime: true, prefix: prefixCandidate, payload: parsed };
        }
      } catch {}
    }
  }

  return { isRealtime: false, payload: null };
};

export const RealtimeDiffViewer: React.FC<RealtimeDiffViewerProps> = ({ prefix, payload, logId }) => {
  const [viewMode, setViewMode] = useState<'diff' | 'raw'>('diff');
  const [copied, setCopied] = useState(false);

  if (!payload || typeof payload !== 'object') return null;

  const eventType = payload.eventType || (payload.new && !payload.old ? 'INSERT' : payload.old && !payload.new ? 'DELETE' : 'UPDATE');
  const table = payload.table || '';
  const schema = payload.schema || 'public';
  const newObj = payload.new || {};
  const oldObj = payload.old || {};

  // Collect all unique keys
  const allKeysSet = new Set<string>([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const allKeys = Array.from(allKeysSet);

  // Sort keys according to preferred order, then alphabetically
  allKeys.sort((a, b) => {
    const idxA = PREFERRED_FIELD_ORDER.indexOf(a.toLowerCase());
    const idxB = PREFERRED_FIELD_ORDER.indexOf(b.toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const formatValue = (v: any): string => {
    if (v === null) return 'null';
    if (v === undefined) return '';
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  };

  // Compute diffs
  const diffItems = allKeys.map(key => {
    const hasOld = Object.prototype.hasOwnProperty.call(oldObj, key);
    const hasNew = Object.prototype.hasOwnProperty.call(newObj, key);
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    const oldFormatted = formatValue(oldVal);
    const newFormatted = formatValue(newVal);

    let isChanged = false;
    let isAdded = false;
    let isRemoved = false;

    if (eventType === 'DELETE') {
      isRemoved = true;
    } else if (eventType === 'INSERT') {
      isAdded = true;
    } else if (hasOld && hasNew) {
      if (oldFormatted !== newFormatted) {
        isChanged = true;
      }
    } else if (!hasOld && hasNew && Object.keys(oldObj).length > 0) {
      isAdded = true;
    } else if (hasOld && !hasNew && Object.keys(newObj).length > 0) {
      isRemoved = true;
    }

    return {
      key,
      hasOld,
      hasNew,
      oldFormatted,
      newFormatted,
      isChanged,
      isAdded,
      isRemoved
    };
  });

  const changedCount = diffItems.filter(d => d.isChanged || d.isAdded || d.isRemoved).length;

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewMode(prev => (prev === 'diff' ? 'raw' : 'diff'));
  };

  return (
    <div className="w-full flex flex-col my-1">
      {/* Optional log prefix e.g. [Realtime Session Change] Event received: */}
      {prefix && (
        <div className="mb-2 text-[11px] sm:text-[12px] font-mono leading-relaxed">
          {renderLogMessageWithBadges(prefix)}
        </div>
      )}

      {/* Main Diff Card */}
      <div className="w-full rounded-xl border border-[var(--dev-console-border)] bg-[var(--dev-console-bg)] shadow-[var(--dev-console-shadow)] overflow-hidden">
        {/* Card Header */}
        <div className="px-3.5 py-2.5 bg-[var(--dev-console-tab-bg)] border-b border-[var(--dev-console-border)] flex items-center justify-between gap-2 flex-wrap select-none">
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-[var(--dev-console-text-muted)] shrink-0" />
            <span className="text-[11px] sm:text-[11.5px] font-mono font-bold tracking-wider text-[var(--dev-console-text-muted)] uppercase">
              EVENT DETAILS ({table ? table.toUpperCase() : 'RESPONSE'})
            </span>
            {eventType && (
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${
                  eventType === 'UPDATE'
                    ? 'bg-[var(--dev-highlight-yellow-bg)] text-[var(--dev-highlight-yellow-text)] border-[var(--dev-console-stat-amber)]/30'
                    : eventType === 'INSERT'
                    ? 'bg-[var(--diff-added-bg)] text-[var(--diff-added-text)] border-[var(--diff-added-border)]'
                    : 'bg-[var(--diff-removed-bg)] text-[var(--diff-removed-text)] border-[var(--diff-removed-border)]'
                }`}
              >
                {eventType}
              </span>
            )}
            {changedCount > 0 && eventType === 'UPDATE' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium text-[var(--dev-console-stat-amber)] bg-[var(--dev-console-bg-active)] border border-[var(--dev-console-border)]">
                {changedCount} changed
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleView}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] transition-colors flex items-center gap-1 cursor-pointer"
              title={viewMode === 'diff' ? 'Show Raw JSON' : 'Show Diff View'}
            >
              <Code size={11} />
              <span>{viewMode === 'diff' ? 'Raw JSON' : 'Diff View'}</span>
            </button>
            <button
              onClick={handleCopyJson}
              className="p-1 rounded text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)] bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] transition-colors cursor-pointer"
              title="Copy Payload JSON"
            >
              {copied ? <Check size={12} className="text-[var(--diff-added-text)]" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {/* Card Body */}
        {viewMode === 'diff' ? (
          <div className="p-3.5 sm:p-4 space-y-4 overflow-x-auto">
            {diffItems.length === 0 ? (
              <div className="text-[11px] font-mono text-[var(--dev-console-text-muted)] italic">
                No payload record fields available.
              </div>
            ) : (
              diffItems.map(item => (
                <div key={item.key} className="flex flex-col gap-1">
                  {/* Field Name Label */}
                  <div className="text-[10px] sm:text-[10.5px] font-mono font-bold tracking-wider text-[var(--dev-console-text-muted)] uppercase">
                    {item.key}
                  </div>

                  {/* Field Value: Changed vs Unchanged */}
                  {item.isChanged ? (
                    <div className="border-l-[3px] border-[var(--dev-console-stat-amber)] pl-3 py-1 space-y-1.5 my-0.5">
                      {/* Removed (Old) Value */}
                      <div>
                        <span className="inline-block bg-[var(--diff-removed-bg)] text-[var(--diff-removed-text)] border border-[var(--diff-removed-border)] px-2.5 py-1 rounded-md text-[11px] sm:text-[12px] font-mono leading-relaxed line-through select-text break-all">
                          — {item.oldFormatted}
                        </span>
                      </div>
                      {/* Added (New) Value */}
                      <div>
                        <span className="inline-block bg-[var(--diff-added-bg)] text-[var(--diff-added-text)] border border-[var(--diff-added-border)] px-2.5 py-1 rounded-md text-[11px] sm:text-[12px] font-mono leading-relaxed select-text break-all">
                          + {item.newFormatted}
                        </span>
                      </div>
                    </div>
                  ) : item.isAdded ? (
                    <div className="border-l-[3px] border-[var(--diff-added-border)] pl-3 py-0.5 my-0.5">
                      <span className="inline-block bg-[var(--diff-added-bg)] text-[var(--diff-added-text)] border border-[var(--diff-added-border)] px-2.5 py-1 rounded-md text-[11px] sm:text-[12px] font-mono leading-relaxed select-text break-all">
                        + {item.newFormatted}
                      </span>
                    </div>
                  ) : item.isRemoved ? (
                    <div className="border-l-[3px] border-[var(--diff-removed-border)] pl-3 py-0.5 my-0.5">
                      <span className="inline-block bg-[var(--diff-removed-bg)] text-[var(--diff-removed-text)] border border-[var(--diff-removed-border)] px-2.5 py-1 rounded-md text-[11px] sm:text-[12px] font-mono leading-relaxed line-through select-text break-all">
                        — {item.oldFormatted}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] sm:text-[12px] font-mono text-[var(--dev-console-text)] select-text break-all font-normal">
                      {item.newFormatted || item.oldFormatted || '-'}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="p-3 bg-[var(--dev-console-bg)] overflow-x-auto">
            <pre className="text-[11px] sm:text-[12px] font-mono text-[var(--dev-console-text)] leading-relaxed whitespace-pre-wrap select-text">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
