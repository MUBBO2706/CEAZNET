import React from 'react';
import { renderLogMessageWithBadges } from './UIComponents';

interface RealtimeDiffViewerProps {
  prefix?: string;
  payload: any;
  logId?: string;
}

export const PREFERRED_FIELD_ORDER = [
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

export const getUnifiedRealtimeData = (payload: any): Record<string, any> => {
  if (!payload || typeof payload !== 'object') return payload || {};

  const eventType = payload.eventType || (payload.new && !payload.old ? 'INSERT' : payload.old && !payload.new ? 'DELETE' : 'UPDATE');
  const oldObj = payload.old || {};
  const newObj = payload.new || {};

  if (payload.new || payload.old) {
    const baseObj = eventType === 'DELETE' ? { ...oldObj } : { ...newObj };
    
    // Sort keys based on preferred order
    const allKeys = Object.keys(baseObj);
    allKeys.sort((a, b) => {
      const idxA = PREFERRED_FIELD_ORDER.indexOf(a.toLowerCase());
      const idxB = PREFERRED_FIELD_ORDER.indexOf(b.toLowerCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    const orderedObj: Record<string, any> = {};
    for (const k of allKeys) {
      orderedObj[k] = baseObj[k];
    }
    return orderedObj;
  }

  return payload;
};

export const getChangedRealtimeKeys = (payload: any): Set<string> => {
  const changed = new Set<string>();
  if (!payload || typeof payload !== 'object') return changed;

  const eventType = payload.eventType || (payload.new && !payload.old ? 'INSERT' : payload.old && !payload.new ? 'DELETE' : 'UPDATE');
  const oldObj = payload.old || {};
  const newObj = payload.new || {};

  if (eventType === 'UPDATE' && payload.new && payload.old) {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (const key of allKeys) {
      const oldVal = oldObj[key];
      const newVal = newObj[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changed.add(key);
      }
    }
  }

  return changed;
};

const formatValue = (v: any): string => {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

export const RealtimeDiffViewer: React.FC<RealtimeDiffViewerProps> = ({ prefix, payload }) => {
  if (!payload || typeof payload !== 'object') return null;

  const eventType = payload.eventType || (payload.new && !payload.old ? 'INSERT' : payload.old && !payload.new ? 'DELETE' : 'UPDATE');
  const oldObj = payload.old || {};
  const newObj = payload.new || {};

  const unifiedData = getUnifiedRealtimeData(payload);
  const keys = Object.keys(unifiedData);

  const formatRawValue = (v: any): string => {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  };

  return (
    <div className="font-mono leading-relaxed select-text">
      {/* Prefix + opening brace */}
      <div className="flex items-baseline flex-wrap">
        {prefix && (
          <span className="mr-1 inline">
            {renderLogMessageWithBadges(prefix)}
          </span>
        )}
        <span className="text-[var(--dev-console-text)]">{`{`}</span>
      </div>

      {/* JSON Object Field Lines */}
      {keys.length === 0 ? (
        <div className="pl-4 text-[var(--dev-console-text-muted)] italic">
          {`// Empty Object`}
        </div>
      ) : (
        <div className="pl-4">
          {keys.map((key, idx) => {
            const isLast = idx === keys.length - 1;
            const hasOld = Object.prototype.hasOwnProperty.call(oldObj, key);
            const hasNew = Object.prototype.hasOwnProperty.call(newObj, key);
            const oldVal = oldObj[key];
            const newVal = newObj[key];

            const oldStr = formatValue(oldVal);
            const newStr = formatValue(newVal);

            const isChanged = eventType === 'UPDATE' && hasOld && hasNew && oldStr !== newStr;
            const isAdded = eventType === 'INSERT' || (!hasOld && hasNew && Object.keys(oldObj).length > 0);
            const isRemoved = eventType === 'DELETE' || (hasOld && !hasNew && Object.keys(newObj).length > 0);

            if (isChanged) {
              const oldDisplay = formatRawValue(oldVal);
              const newDisplay = formatRawValue(newVal);

              return (
                <div key={key} className="my-1 flex flex-col gap-0.5">
                  <div className="flex items-baseline flex-wrap leading-relaxed">
                    <span className="text-[var(--dev-console-syntax-property)]">&quot;{key}&quot;</span>
                    <span className="text-[var(--dev-console-text-muted)]">:</span>
                  </div>
                  <div className="pl-3 sm:pl-4 flex flex-col gap-0.5">
                    {/* Old (Removed) Value with red text & strikethrough */}
                    <div className="flex items-baseline">
                      <span className="text-[var(--diff-removed-text)] font-mono leading-relaxed line-through break-all select-text">
                        - {oldDisplay}
                      </span>
                    </div>
                    {/* New (Added) Value with green text & + prefix */}
                    <div className="flex items-baseline">
                      <span className="text-[var(--diff-added-text)] font-mono leading-relaxed break-all select-text">
                        + {newDisplay}
                      </span>
                      {!isLast && <span className="text-[var(--dev-console-text-muted)] ml-1">,</span>}
                    </div>
                  </div>
                </div>
              );
            }

            if (isAdded) {
              const newDisplay = formatRawValue(newVal);
              return (
                <div key={key} className="my-0.5 flex items-baseline flex-wrap leading-relaxed">
                  <span className="text-[var(--dev-console-syntax-property)]">&quot;{key}&quot;</span>
                  <span className="text-[var(--dev-console-text-muted)]">: </span>
                  <span className="ml-1 text-[var(--diff-added-text)] font-mono break-all select-text">
                    + {newDisplay}
                  </span>
                  {!isLast && <span className="text-[var(--dev-console-text-muted)]">,</span>}
                </div>
              );
            }

            if (isRemoved) {
              const oldDisplay = formatRawValue(oldVal);
              return (
                <div key={key} className="my-0.5 flex items-baseline flex-wrap leading-relaxed">
                  <span className="text-[var(--dev-console-syntax-property)]">&quot;{key}&quot;</span>
                  <span className="text-[var(--dev-console-text-muted)]">: </span>
                  <span className="ml-1 text-[var(--diff-removed-text)] font-mono line-through break-all select-text">
                    - {oldDisplay}
                  </span>
                  {!isLast && <span className="text-[var(--dev-console-text-muted)]">,</span>}
                </div>
              );
            }

            // Normal unchanged field
            const val = unifiedData[key];
            const valFormatted = formatValue(val);

            return (
              <div
                key={key}
                className="flex items-baseline flex-wrap leading-relaxed text-[var(--dev-console-text)]"
              >
                <span className="text-[var(--dev-console-syntax-property)]">&quot;{key}&quot;</span>
                <span className="text-[var(--dev-console-text-muted)]">: </span>
                <span className="ml-1 break-all">
                  {valFormatted}
                </span>
                {!isLast && <span className="text-[var(--dev-console-text-muted)]">,</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Closing brace */}
      <div className="text-[var(--dev-console-text)]">{`}`}</div>
    </div>
  );
};

