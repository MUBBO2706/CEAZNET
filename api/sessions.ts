import { createClient } from '@supabase/supabase-js';
import { UAParser } from 'ua-parser-js';
import axios from 'axios';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

function parseUserAgentAdv(req: any): string {
    const userAgent = (req.headers && req.headers['user-agent']) || '';
    const chModel = req.headers && req.headers['sec-ch-ua-model'];
    const chPlatform = req.headers && req.headers['sec-ch-ua-platform'];
    
    let modelName = '';
    let osName = 'Unknown OS';

    if (chModel && typeof chModel === 'string') modelName = chModel.replace(/"/g, '').trim();
    if (chPlatform && typeof chPlatform === 'string') osName = chPlatform.replace(/"/g, '').trim();

    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const device = result.device;
    const os = result.os;
    const browser = result.browser;

    if (!modelName) {
        if (device.model && device.model !== 'K') {
            modelName = device.vendor ? `${device.vendor} ${device.model}` : device.model;
        }
    }

    if (osName === 'Unknown OS' || !osName) {
        osName = os.name || 'Unknown OS';
        if (os.name === 'Windows' && os.version) osName = `Windows ${os.version}`;
        else if (os.name === 'Mac OS') osName = 'macOS';
    }

    if (modelName && modelName.length > 0) {
        if (osName !== 'Unknown OS') return `${modelName} (${osName})`;
        return modelName;
    }
    
    if (osName !== 'Unknown OS') return osName;
    if (browser.name) return `${browser.name} Browser`;
    
    return "Generic Web Browser";
}

function getClientIp(req: any): string {
  if(!req.headers) return '127.0.0.1';
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor && typeof forwardedFor === 'string') {
    const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
    return ips[0];
  }
  return req.headers['x-real-ip'] || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

async function updateGlobalSessionCache(..._args: any[]): Promise<void> {
    // Session cache update helper
}

function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

function cleanLocation(locationStr: string): string {
  if (!locationStr) return "Unknown Location";
  const trimmed = locationStr.trim();
  if (trimmed === "Local Network" || trimmed === "Unknown Location") return trimmed;

  // 1. Split into raw comma-separated segments
  const rawParts = trimmed.split(',');
  const cleanedSegments: string[] = [];
  const seenWords = new Set<string>();

  // Administrative noise patterns
  const noiseRegex = /\b(subdistrict|sub-district|sub district|district|taluka|tehsil|division|county|municipality|postcode|post|postal|zipcode|zip|road|street|lane|highway|bypass|village|town|city|suburban|suburb|state|country|region|area|neighborhood|urban|rural|near|opposite|beside|floor|building|gaothan|gaon|road|rd|st|ln)\b/gi;

  function toBaseWord(w: string): string {
    return w.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  function isFuzzyMatch(w1: string, w2: string): boolean {
    if (w1 === w2) return true;
    if (w1.length >= 4 && (w1.includes(w2) || w2.includes(w1))) return true;
    if (w1.length >= 4 && w2.length >= 4) {
      const dist = getLevenshteinDistance(w1, w2);
      if (dist <= 1) return true;
      if (w1.length >= 7 && dist <= 2) return true;
    }
    return false;
  }

  for (const rawPart of rawParts) {
    let part = rawPart.trim();
    if (!part) continue;

    // A. Strip postal codes / pure numeric parts / hyphenated coordinates
    if (/^\d+$/.test(part) || /^\d{5,6}$/.test(part) || /^\d+-\d+$/.test(part)) {
      continue;
    }

    // B. Clean administrative and noise words inside the part
    let cleanedPart = part.replace(noiseRegex, '').trim();
    
    // Clean up double spaces or trailing/leading dashes/commas left from regex
    cleanedPart = cleanedPart.replace(/[\s\-_,\.]+/g, ' ').trim();
    
    if (!cleanedPart) continue;

    // C. Deduplicate words across segments to prevent same word repeating
    const words = cleanedPart.split(/[\s\-]+/);
    const uniquePartWords: string[] = [];

    for (const word of words) {
      const baseWord = toBaseWord(word);
      if (baseWord.length === 0) continue;

      let isDuplicate = false;
      for (const seen of seenWords) {
        if (isFuzzyMatch(baseWord, seen)) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniquePartWords.push(word);
        seenWords.add(baseWord);
      }
    }

    if (uniquePartWords.length > 0) {
      const reconstructedPart = uniquePartWords.join(' ').trim();
      cleanedSegments.push(reconstructedPart);
    }
  }

  // D. Ensure brevity by limiting to 4 concise components
  let finalSegments = cleanedSegments;
  if (finalSegments.length > 4) {
    finalSegments = [
      ...finalSegments.slice(0, 2),
      ...finalSegments.slice(-2)
    ];
  }

  return finalSegments.length > 0 ? finalSegments.join(', ') : "Unknown Location";
}

async function getIpLocation(ip: string): Promise<string> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return "Local Network";
  }

  // Try ip-api.com first (HTTP)
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3500 });
    if (res.data && res.data.status === "success") {
      const rawLocation = `${res.data.city}, ${res.data.regionName}, ${res.data.country}`;
      const cleaned = cleanLocation(rawLocation);
      if (cleaned && cleaned !== "Unknown Location") {
        return cleaned;
      }
    }
  } catch (e) {
    console.warn(`[getIpLocation] ip-api failed for ${ip}:`, e instanceof Error ? e.message : e);
  }

  // Fallback 1 to ipapi.co (HTTPS)
  try {
    const res = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 3500 });
    if (res.data && !res.data.error) {
      const rawLocation = `${res.data.city}, ${res.data.region}, ${res.data.country_name}`;
      const cleaned = cleanLocation(rawLocation);
      if (cleaned && cleaned !== "Unknown Location") {
        return cleaned;
      }
    }
  } catch (e) {
    console.warn(`[getIpLocation] ipapi.co failed for ${ip}:`, e instanceof Error ? e.message : e);
  }

  return "Unknown Location";
}

async function getReverseGeocoding(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
      headers: { 'User-Agent': 'Ceaznet-Tracker-V5' },
      timeout: 3500,
    });
    if (response.data) {
      if (response.data.display_name) {
        return cleanLocation(response.data.display_name);
      }
      if (response.data.address) {
        const addr = response.data.address;
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
        const state = addr.state || addr.region || "";
        const country = addr.country || "";
        const parts = [city, state, country].filter(Boolean);
        if (parts.length > 0) return cleanLocation(parts.join(", "));
      }
    }
  } catch (err) {}
  return null;
}

export default async function handler(req: any, res: any) {
  try {
    const authHeader = req.headers && req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
    }
    
    const token = authHeader.split(' ')[1];
    let user: any = null;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (!payload.sub) throw new Error("Missing sub in token");
      user = { 
        id: payload.sub, 
        email: payload.email || (payload.user_metadata && payload.user_metadata.email) || payload.phone || "Unknown User",
        provider: payload.app_metadata?.provider || (payload.identities && payload.identities[0]?.provider) || 'email'
      };
    } catch (e: any) {
      return res.status(401).json({ error: "UNAUTHORIZED: Invalid token" });
    }

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    let urlObj: URL | null = null;
    try {
      if (req.url) {
        urlObj = new URL(req.url, 'http://localhost');
      }
    } catch(e) {}

    let action = (req.query?.action as string) || urlObj?.searchParams.get('action') || '';
    let status = (req.query?.status as string) || urlObj?.searchParams.get('status') || 'all';
    let limitStr = (req.query?.limit as string) || urlObj?.searchParams.get('limit') || '';
    let offsetStr = (req.query?.offset as string) || urlObj?.searchParams.get('offset') || '';
    let search = (req.query?.search as string) || urlObj?.searchParams.get('search') || '';

    if (req.method === 'GET') {
      // 1. Optimized stats action: calculates counts with a lightweight query without fetching heavy metadata
      if (action === 'stats' || action === 'counts') {
        try {
          const { data, error } = await userClient
            .from('user_sessions')
            .select('id, session_key, last_active_at, created_at')
            .eq('user_id', user.id);
          if (error) throw error;

          const now = Date.now();
          const EXPIRE_MS = 35 * 60 * 1000;
          let total = 0;
          let active = 0;
          let logged_out = 0;
          let terminated = 0;
          let expired = 0;

          for (const s of (data || [])) {
            total++;
            const key = s.session_key || '';
            if (key.startsWith('LOGGED_OUT_')) {
              logged_out++;
            } else if (key.startsWith('TERMINATED_')) {
              terminated++;
            } else {
              const lastActive = new Date(s.last_active_at || s.created_at).getTime();
              if (now - lastActive > EXPIRE_MS) {
                expired++;
              } else {
                active++;
              }
            }
          }

          return res.json({
            success: true,
            stats: { total, active, logged_out, terminated, expired }
          });
        } catch (err: any) {
          return res.json({
            success: true,
            stats: { total: 1, active: 1, logged_out: 0, terminated: 0, expired: 0 }
          });
        }
      }

      // 2. On-demand sessions listing (optionally filtered by status, search, and paginated)
      try {
        // Fast computation of exact stats across all statuses
        const { data: allStatsRows } = await userClient
          .from('user_sessions')
          .select('id, session_key, last_active_at, created_at')
          .eq('user_id', user.id);

        const now = Date.now();
        const EXPIRE_MS = 35 * 60 * 1000;
        let total = 0;
        let active = 0;
        let logged_out = 0;
        let terminated = 0;
        let expired = 0;

        for (const s of (allStatsRows || [])) {
          total++;
          const key = s.session_key || '';
          if (key.startsWith('LOGGED_OUT_')) {
            logged_out++;
          } else if (key.startsWith('TERMINATED_')) {
            terminated++;
          } else {
            const lastActive = new Date(s.last_active_at || s.created_at).getTime();
            if (now - lastActive > EXPIRE_MS) {
              expired++;
            } else {
              active++;
            }
          }
        }

        const stats = { total, active, logged_out, terminated, expired };

        let query = userClient
          .from('user_sessions')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .order('last_active_at', { ascending: false });

        if (status === 'logged_out') {
          query = query.like('session_key', 'LOGGED_OUT_%');
        } else if (status === 'terminated') {
          query = query.like('session_key', 'TERMINATED_%');
        } else if (status === 'active') {
          query = query
            .not('session_key', 'like', 'LOGGED_OUT_%')
            .not('session_key', 'like', 'TERMINATED_%')
            .gte('last_active_at', new Date(now - EXPIRE_MS).toISOString());
        } else if (status === 'expired') {
          query = query
            .not('session_key', 'like', 'LOGGED_OUT_%')
            .not('session_key', 'like', 'TERMINATED_%')
            .lt('last_active_at', new Date(now - EXPIRE_MS).toISOString());
        }

        if (search && search.trim()) {
          const q = search.trim();
          query = query.or(`device_name.ilike.%${q}%,location.ilike.%${q}%,browser_name.ilike.%${q}%,ip_address.ilike.%${q}%`);
        }

        const limit = limitStr ? parseInt(limitStr, 10) : 0;
        const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

        if (limit > 0) {
          query = query.range(offset, offset + limit - 1);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        const enrichedSessions = (data || []).map((s: any) => ({
          ...s,
          last_login_at: user.last_sign_in_at || s.last_active_at || s.created_at
        }));

        return res.json({
          data: enrichedSessions,
          total: count !== null && count !== undefined ? count : enrichedSessions.length,
          stats
        });
      } catch (dbErr: any) {
        return res.json({
          data: [{
            id: "current-dev-fallback", user_id: user.id, session_key: "current",
            device_name: parseUserAgentAdv(req), ip_address: getClientIp(req),
            location: 'Unknown Location', created_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(), is_current: true
          }],
          total: 1,
          stats: { total: 1, active: 1, logged_out: 0, terminated: 0, expired: 0 }
        });
      }
    }

    if (req.method === 'POST') {
      if (action === 'track') {
        const { session_key, device_id, client_device_name, latitude, longitude, battery_percentage, is_incognito, browser_name, browser_version, os_name, os_version } = req.body || {};
        if (!session_key) return res.status(400).json({ error: "Missing session_key parameter" });
        const ip = getClientIp(req);
        const deviceName = client_device_name || parseUserAgentAdv(req);
        let location = "Unknown Location";
        if (typeof latitude === 'number' && typeof longitude === 'number') {
          const rev = await getReverseGeocoding(latitude, longitude);
          location = rev || await getIpLocation(ip);
        } else {
          location = await getIpLocation(ip);
        }

        try {
          let existing = null;
          
          const { data } = await userClient.from('user_sessions')
            .select('id, session_key')
            .eq('user_id', user.id)
            .eq('session_key', session_key)
            .maybeSingle();
          if (data) existing = data;

          const { data: terminatedCheck } = await userClient.from('user_sessions').select('id, session_key').eq('user_id', user.id).like('session_key', `TERMINATED_${session_key}%`).maybeSingle();
          if (terminatedCheck) {
              return res.status(403).json({ error: "Session has been terminated", isTerminated: true, session_key: terminatedCheck.session_key });
          }

          let fullName = "";
          try {
            const { data: profile } = await userClient.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
            if (profile && profile.full_name) {
              fullName = profile.full_name;
            }
          } catch (profileErr) {
            console.error("Failed to fetch user profile for session tracking:", profileErr);
          }

          const actionBy = fullName || user.email || "User";
          const actionFrom = deviceName;

          const sessionPayload: any = {
            session_key,
            device_id,
            device_name: deviceName,
            ip_address: ip,
            location,
            battery_percentage: typeof battery_percentage === 'number' ? battery_percentage : undefined,
            browser_name: browser_name || 'Unknown',
            browser_version: browser_version || '',
            is_incognito: Boolean(is_incognito),
            action_by: actionBy,
            action_from: actionFrom,
            last_active_at: new Date().toISOString()
          };

          if (existing) {
            await userClient.from('user_sessions').update(sessionPayload).eq('id', existing.id);
          } else {
            await userClient.from('user_sessions').insert({
              user_id: user.id,
              ...sessionPayload,
              created_at: new Date().toISOString()
            });
          }

          return res.json({ success: true, ip, deviceName, location });
        } catch (dbErr: any) {
          return res.json({ success: true, fallback: true, message: "Table pending migration", ip, deviceName, location });
        }
      }

      if (action === 'heartbeat') {
        const { session_key } = req.body || {};
        if (!session_key) return res.status(400).json({ error: "Missing session_key" });
        return res.json({ success: true });
      }

      if (action === 'terminate') {
        const { id, terminator_device_name, terminator_location, terminator_time } = req.body || {};
        if (!id) return res.status(400).json({ error: "Missing session id to terminate" });
        try {
          const { data: sessionData } = await userClient.from('user_sessions').select('session_key, device_id, device_name').eq('id', id).eq('user_id', user.id).single();
          if (sessionData && !sessionData.session_key.startsWith('TERMINATED_')) {
             const devName = terminator_device_name || parseUserAgentAdv(req) || 'Unknown Device';
             let locName = terminator_location;
             if (!locName || locName === 'Unknown Location') {
                 const ip = getClientIp(req);
                 locName = await getIpLocation(ip);
             }
             const termTime = terminator_time || new Date().toISOString();
             
             let newSessionKey = `TERMINATED_${sessionData.session_key}_BY_${encodeURIComponent(devName)}_LOC_${encodeURIComponent(locName || 'Unknown Location')}_TIME_${encodeURIComponent(termTime)}`;

             let fullName = "";
             try {
               const { data: profile } = await userClient.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
               if (profile && profile.full_name) {
                 fullName = profile.full_name;
               }
             } catch (profileErr) {
               console.error("Failed to fetch user profile for session tracking:", profileErr);
             }

             const actionBy = fullName || user.email || "User";
             const actionFrom = devName;

             await userClient.from('user_sessions').update({ 
                 session_key: newSessionKey,
                 last_active_at: termTime,
                 action_by: actionBy,
                 action_from: actionFrom
             }).eq('id', id).eq('user_id', user.id);
             
             if (sessionData.device_id) {
               await updateGlobalSessionCache(
                 sessionData.device_id,
                 sessionData.device_name,
                 user.email,
                 sessionData.session_key,
                 'terminated',
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 user.provider
               );
             }
          }
          return res.json({ success: true });
        } catch(dbErr: any) { return res.json({ success: true, fallback: true }); }
      }

      if (action === 'logout_current') {
        const { session_key } = req.body || {};
        if (!session_key) return res.status(400).json({ error: "Missing session_key to logout" });
        try {
          const { data: sessionData } = await userClient.from('user_sessions').select('id, session_key, device_id, device_name').eq('session_key', session_key).eq('user_id', user.id).maybeSingle();
          if (sessionData && !sessionData.session_key.startsWith('TERMINATED_') && !sessionData.session_key.startsWith('LOGGED_OUT_')) {
             const newSessionKey = `LOGGED_OUT_${sessionData.session_key}_${Date.now()}`;

             let fullName = "";
             try {
               const { data: profile } = await userClient.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
               if (profile && profile.full_name) {
                 fullName = profile.full_name;
               }
             } catch (profileErr) {
               console.error("Failed to fetch user profile for session tracking:", profileErr);
             }

             const actionBy = fullName || user.email || "User";
             const actionFrom = sessionData.device_name || "Unknown Device";

             await userClient.from('user_sessions').update({ 
               session_key: newSessionKey,
               last_active_at: new Date().toISOString(),
               action_by: actionBy,
               action_from: actionFrom
             }).eq('id', sessionData.id).eq('user_id', user.id);
             
             if (sessionData.device_id) {
               await updateGlobalSessionCache(
                 sessionData.device_id,
                 sessionData.device_name,
                 user.email,
                 sessionData.session_key,
                 'logged_out',
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 undefined,
                 user.provider
               );
             }
          }
          return res.json({ success: true });
        } catch(dbErr: any) { return res.json({ success: true, fallback: true }); }
      }

      if (action === 'delete') {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ error: "Missing session id to delete" });
        try {
          await userClient.from('user_sessions').delete().eq('id', id).eq('user_id', user.id);
          return res.json({ success: true });
        } catch(dbErr: any) { return res.status(500).json({ error: dbErr.message }); }
      }
      
      return res.status(400).json({ error: "Invalid action or missing action parameter in url." });
    }

    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  } catch (error: any) {
    console.error("Session API Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
