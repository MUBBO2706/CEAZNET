// Shared Session API Utility with In-Flight Request Deduplication & Throttling
let inFlightSessionsPromise: Promise<any> | null = null;
let cachedSessionsData: any = null;
let lastFetchTimestamp = 0;
const SESSIONS_CACHE_TTL_MS = 10000; // 10 seconds cache window for non-force-refreshed concurrent calls

export async function fetchUserSessions(token: string, forceRefresh = false): Promise<any> {
  const now = Date.now();

  // Return cached data if fresh and forceRefresh is false
  if (!forceRefresh && cachedSessionsData && (now - lastFetchTimestamp < SESSIONS_CACHE_TTL_MS)) {
    return cachedSessionsData;
  }

  // If a request is already in-flight, deduplicate and reuse the existing Promise
  if (inFlightSessionsPromise) {
    return inFlightSessionsPromise;
  }

  inFlightSessionsPromise = (async () => {
    try {
      const res = await fetch('/api/sessions', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const json = await res.json();
      cachedSessionsData = json;
      lastFetchTimestamp = Date.now();
      return json;
    } finally {
      inFlightSessionsPromise = null;
    }
  })();

  return inFlightSessionsPromise;
}

export function invalidateUserSessionsCache() {
  cachedSessionsData = null;
  lastFetchTimestamp = 0;
}
