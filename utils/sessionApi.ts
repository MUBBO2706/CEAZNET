// Shared Session API Utility with In-Flight Request Deduplication, Filtering & Throttling

export interface SessionStats {
  total: number;
  active: number;
  logged_out: number;
  terminated: number;
  expired: number;
}

export interface FetchSessionsOptions {
  status?: string;
  limit?: number;
  offset?: number;
  search?: string;
  forceRefresh?: boolean;
}

const inFlightPromises = new Map<string, Promise<any>>();
const cacheMap = new Map<string, { data: any; timestamp: number }>();
const SESSIONS_CACHE_TTL_MS = 10000; // 10 seconds cache window

// Fetch optimized session counts without downloading full session data payloads
export async function fetchSessionStats(token: string, forceRefresh = false): Promise<SessionStats> {
  const cacheKey = `stats_${token.slice(-10)}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = cacheMap.get(cacheKey);
    if (cached && (now - cached.timestamp < SESSIONS_CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  if (inFlightPromises.has(cacheKey)) {
    return inFlightPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch('/api/sessions?action=stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      const stats = json.stats || { total: 0, active: 0, logged_out: 0, terminated: 0, expired: 0 };
      cacheMap.set(cacheKey, { data: stats, timestamp: Date.now() });
      return stats;
    } catch (err) {
      console.warn('Failed to fetch session stats:', err);
      return { total: 0, active: 0, logged_out: 0, terminated: 0, expired: 0 };
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  })();

  inFlightPromises.set(cacheKey, promise);
  return promise;
}

// Fetch user sessions on-demand with support for filters and pagination
export async function fetchUserSessions(
  token: string, 
  options: FetchSessionsOptions | boolean = false
): Promise<any> {
  const opts: FetchSessionsOptions = typeof options === 'boolean' 
    ? { forceRefresh: options } 
    : (options || {});

  const { status = 'all', limit = 0, offset = 0, search = '', forceRefresh = false } = opts;
  const cacheKey = `sessions_${token.slice(-10)}_${status}_${limit}_${offset}_${search}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = cacheMap.get(cacheKey);
    if (cached && (now - cached.timestamp < SESSIONS_CACHE_TTL_MS)) {
      return cached.data;
    }
  }

  if (inFlightPromises.has(cacheKey)) {
    return inFlightPromises.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      if (limit > 0) params.set('limit', String(limit));
      if (offset > 0) params.set('offset', String(offset));
      if (search && search.trim()) params.set('search', search.trim());

      const url = `/api/sessions${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      cacheMap.set(cacheKey, { data: json, timestamp: Date.now() });
      return json;
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  })();

  inFlightPromises.set(cacheKey, promise);
  return promise;
}

export function invalidateUserSessionsCache() {
  cacheMap.clear();
  inFlightPromises.clear();
}

