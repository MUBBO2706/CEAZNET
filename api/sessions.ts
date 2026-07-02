import { createClient } from '@supabase/supabase-js';
import { UAParser } from 'ua-parser-js';
import axios from 'axios';
import { loadSessionCacheUnified, saveSessionCacheUnified } from '../utils/deviceCacheShared.js';

const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImitanVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');

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

async function updateGlobalSessionCache(
  deviceHash: string,
  deviceModel: string,
  username: string,
  sessionId: string,
  status: 'active' | 'terminated' | 'logged_out',
  location?: string,
  ip?: string,
  fullName?: string,
  is_incognito?: boolean,
  browser_name?: string,
  browser_version?: string,
  os_name?: string,
  os_version?: string,
  provider?: string
) {
  if (!deviceHash || !username || !sessionId) return;
  try {
    const data = await loadSessionCacheUnified();
    if (!data[deviceHash]) {
      data[deviceHash] = { deviceModel: deviceModel || 'Unknown Device', accounts: {} };
    }
    if (deviceModel && data[deviceHash].deviceModel === 'Unknown Device') {
      data[deviceHash].deviceModel = deviceModel;
    }
    if (!data[deviceHash].accounts[username]) {
      data[deviceHash].accounts[username] = { sessions: [], fullName: fullName || null };
    } else if (fullName) {
      data[deviceHash].accounts[username].fullName = fullName;
    }

    const sessions = data[deviceHash].accounts[username].sessions;
    const existingSessionIndex = sessions.findIndex((s: any) => s.sessionId === sessionId);
    const now = new Date().toISOString();

    if (existingSessionIndex >= 0) {
      const session = sessions[existingSessionIndex];
      session.status = status;
      session.lastHeartbeat = now;
      if (status !== 'active') {
        session.endTime = now;
        session.duration = Math.floor((new Date(now).getTime() - new Date(session.startTime).getTime()) / 1000);
      }
      if (location) session.location = location;
      if (ip) session.ip = ip;
      if (is_incognito !== undefined) session.is_incognito = is_incognito;
      if (browser_name !== undefined) session.browser_name = browser_name;
      if (browser_version !== undefined) session.browser_version = browser_version;
      if (os_name !== undefined) session.os_name = os_name;
      if (os_version !== undefined) session.os_version = os_version;
      if (provider !== undefined) session.provider = provider;
    } else {
      sessions.push({
        sessionId,
        username,
        startTime: now,
        endTime: null,
        location: location || null,
        ip: ip || null,
        is_incognito: is_incognito || false,
        browser_name: browser_name || "Unknown",
        browser_version: browser_version || "",
        os_name: os_name || "Unknown",
        os_version: os_version || "",
        duration: 0,
        status,
        lastHeartbeat: now,
        provider: provider || 'email'
      });
    }
    await saveSessionCacheUnified(data, { deviceModel: data[deviceHash].deviceModel });
    if (typeof (global as any).broadcastSessionUpdate === 'function') {
      (global as any).broadcastSessionUpdate(data);
    }
  } catch (err) {
    console.error("Failed to update global session cache:", err);
  }
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

    let action = req.query?.action;
    if (!action && req.url) {
       try {
         const urlObj = new URL(req.url, 'http://localhost');
         action = urlObj.searchParams.get('action');
       } catch(e) {}
    }

    if (req.method === 'GET') {
      try {
        const { data, error } = await userClient.from('user_sessions').select('*').eq('user_id', user.id).order('last_active_at', { ascending: false });
        if (error) throw error;
        const enrichedSessions = (data || []).map((s: any) => ({
          ...s, last_login_at: user.last_sign_in_at || s.last_active_at || s.created_at
        }));
        return res.json({ data: enrichedSessions });
      } catch (dbErr: any) {
        return res.json({
          data: [{
            id: "current-dev-fallback", user_id: user.id, session_key: "current",
            device_name: parseUserAgentAdv(req), ip_address: getClientIp(req),
            location: 'Unknown Location', created_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(), is_current: true
          }]
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
          
          if (device_id) {
            const { data } = await userClient.from('user_sessions')
              .select('id, session_key')
              .eq('user_id', user.id)
              .eq('device_id', device_id)
              .order('last_active_at', { ascending: false })
              .limit(1);
            if (data && data.length > 0) existing = data[0];
          }
          
          if (!existing) {
             const { data } = await userClient.from('user_sessions').select('id, session_key').eq('user_id', user.id).eq('session_key', session_key).maybeSingle();
             if (data) existing = data;
          }

          const { data: terminatedCheck } = await userClient.from('user_sessions').select('id, session_key').eq('user_id', user.id).like('session_key', `TERMINATED_${session_key}%`).maybeSingle();
          if (terminatedCheck) {
              return res.status(403).json({ error: "Session has been terminated", isTerminated: true, session_key: terminatedCheck.session_key });
          }

          if (existing) {
            await userClient.from('user_sessions').update({ 
              session_key, 
              device_id, 
              device_name: deviceName, 
              ip_address: ip, 
              location, 
              battery_percentage, 
              created_at: new Date().toISOString(),
              last_active_at: new Date().toISOString() 
            }).eq('id', existing.id);
          } else {
            await userClient.from('user_sessions').insert({ user_id: user.id, session_key, device_id, device_name: deviceName, ip_address: ip, location, battery_percentage, created_at: new Date().toISOString(), last_active_at: new Date().toISOString() });
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

          if (device_id) {
            await updateGlobalSessionCache(device_id, deviceName, user.email, session_key, 'active', location, ip, fullName || undefined, is_incognito, browser_name, browser_version, os_name, os_version, user.provider);
          }

          return res.json({ success: true, ip, deviceName, location });
        } catch (dbErr: any) {
          return res.json({ success: true, fallback: true, message: "Table pending migration", ip, deviceName, location });
        }
      }

      if (action === 'heartbeat') {
        const { session_key, device_id, client_device_name, status_override } = req.body || {};
        if (!session_key) return res.status(400).json({ error: "Missing session_key" });
        try {
          // If status_override is 'tab_closed' or 'background', we don't necessarily want to update last_active_at in supabase (or we can, but it doesn't matter much)
          // We mainly want to update the dev console session cache
          if (!status_override || status_override === 'active') {
             await userClient.from('user_sessions').update({ 
               last_active_at: new Date().toISOString() 
             }).eq('session_key', session_key).eq('user_id', user.id);
          }
          
          if (device_id) {
            const finalStatus = status_override || 'active';
            await updateGlobalSessionCache(
              device_id,
              client_device_name || "Unknown Device",
              user.email,
              session_key,
              finalStatus,
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
          return res.json({ success: true });
        } catch (dbErr: any) {
          return res.json({ success: true, fallback: true });
        }
      }

      if (action === 'terminate') {
        const { id, terminator_device_name } = req.body || {};
        if (!id) return res.status(400).json({ error: "Missing session id to terminate" });
        try {
          const { data: sessionData } = await userClient.from('user_sessions').select('session_key, device_id, device_name').eq('id', id).eq('user_id', user.id).single();
          if (sessionData && !sessionData.session_key.startsWith('TERMINATED_')) {
             let newSessionKey = `TERMINATED_${sessionData.session_key}`;
             if (terminator_device_name) {
                 newSessionKey += `_BY_${terminator_device_name}`;
             }
             await userClient.from('user_sessions').update({ session_key: newSessionKey }).eq('id', id).eq('user_id', user.id);
             
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
          const { data: sessionData } = await userClient.from('user_sessions').select('id, session_key, device_id, device_name').eq('session_key', session_key).eq('user_id', user.id).single();
          if (sessionData && !sessionData.session_key.startsWith('TERMINATED_') && !sessionData.session_key.startsWith('LOGGED_OUT_')) {
             const newSessionKey = `LOGGED_OUT_${sessionData.session_key}_${Date.now()}`;
             await userClient.from('user_sessions').update({ session_key: newSessionKey }).eq('id', sessionData.id).eq('user_id', user.id);
             
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
