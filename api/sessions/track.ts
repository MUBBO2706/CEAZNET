import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { UAParser } from 'ua-parser-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

function parseUserAgentAdv(req: any): string {
    const userAgent = req.headers['user-agent'] || '';
    const chModel = req.headers['sec-ch-ua-model'];
    const chPlatform = req.headers['sec-ch-ua-platform'];
    
    let modelName = '';
    let osName = 'Unknown OS';

    if (chModel && typeof chModel === 'string') {
         modelName = chModel.replace(/"/g, '').trim();
    }
    if (chPlatform && typeof chPlatform === 'string') {
         osName = chPlatform.replace(/"/g, '').trim();
    }

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
        if (os.name === 'Windows' && os.version) {
             osName = `Windows ${os.version}`;
        } else if (os.name === 'Mac OS') {
             osName = 'macOS';
        }
    }

    if (modelName && modelName.length > 0) {
        if (osName !== 'Unknown OS') {
            return `${modelName} (${osName})`;
        }
        return modelName;
    }
    
    if (osName !== 'Unknown OS') {
        return osName;
    }

    if (browser.name) {
        return `${browser.name} Browser`;
    }
    
    return "Generic Web Browser";
}

function getClientIp(req: any): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor && typeof forwardedFor === 'string') {
    const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
    return ips[0];
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '127.0.0.1';
}

async function getIpLocation(ip: string): Promise<string> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.")) {
    return "Local Network";
  }
  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 3000 });
    if (res.data && res.data.status === "success") {
      return `${res.data.city}, ${res.data.regionName}, ${res.data.country}`;
    }
  } catch (e) {
    // Ignore error
  }
  return "Unknown Location";
}

async function getReverseGeocoding(lat: number, lon: number): Promise<string | null> {
  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`, {
      headers: { 'User-Agent': 'Ceaznet-Tracker' },
      timeout: 3000,
    });
    
    if (response.data && response.data.address) {
      const addr = response.data.address;
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || "";
      const state = addr.state || addr.region || "";
      const country = addr.country || "";
      
      const parts = [city, state, country].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(", ");
      }
    }
  } catch (err) {
    // Ignore geo error
  }
  return null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "UNAUTHORIZED: Missing token" });
    }
    
    const token = authHeader.split(' ')[1];
    let authError: any = null;
    let user: any = null;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (!payload.sub) throw new Error("Missing sub in token");
      user = { id: payload.sub };
    } catch (e: any) {
      authError = e;
    }
    
    if (authError || !user) {
      return res.status(401).json({ error: "UNAUTHORIZED: Invalid token" });
    }

    const { session_key, client_device_name, latitude, longitude, battery_percentage } = req.body || {};
    if (!session_key) {
      return res.status(400).json({ error: "Missing session_key parameter" });
    }

    const ip = getClientIp(req);
    
    // Server-side parsing of exact device name using UserAgent and Client Hints!
    const deviceName = client_device_name || parseUserAgentAdv(req);
    
    let location = "Unknown Location";
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      const reverseGeoName = await getReverseGeocoding(latitude, longitude);
      if (reverseGeoName) {
        location = reverseGeoName;
      } else {
        location = await getIpLocation(ip);
      }
    } else {
      location = await getIpLocation(ip);
    }

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    try {
      const { data: existing, error: checkError } = await userClient
        .from('user_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_key', session_key)
        .maybeSingle();

      if (checkError) throw checkError;

      const { data: terminatedCheck } = await userClient
        .from('user_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_key', `TERMINATED_${session_key}`)
        .maybeSingle();

      if (terminatedCheck) {
        return res.status(403).json({ error: "Session has been terminated", isTerminated: true });
      }

      if (existing) {
        const { error: updateError } = await userClient
          .from('user_sessions')
          .update({
            device_name: deviceName,
            ip_address: ip,
            location: location,
            battery_percentage: battery_percentage,
            last_active_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await userClient
          .from('user_sessions')
          .insert({
            user_id: user.id,
            session_key: session_key,
            device_name: deviceName,
            ip_address: ip,
            location: location,
            battery_percentage: battery_percentage,
            created_at: new Date().toISOString(),
            last_active_at: new Date().toISOString()
          });

        if (insertError) throw insertError;
      }

      res.json({ success: true, ip, deviceName, location });
    } catch (dbErr: any) {
      res.json({ success: true, fallback: true, message: "Table pending migration", ip, deviceName, location });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
