import { createClient } from '@supabase/supabase-js';
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
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

    // Create a user-scoped client to satisfy RLS policies (auth.uid() = user_id)
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    try {
      const { data, error } = await userClient
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_active_at', { ascending: false });

      if (error) throw error;

      const enrichedSessions = (data || []).map((s: any) => ({
        ...s,
        last_login_at: user.last_sign_in_at || s.last_active_at || s.created_at
      }));

      res.json({ data: enrichedSessions });
    } catch (dbErr: any) {
      console.warn("[Session Listing] Table 'user_sessions' might not exist yet:", dbErr.message);
      // Fallback gracefully: return a dummy active list representing current browser session
      const ip = getClientIp(req);
      res.json({
        data: [
          {
            id: "current-dev-fallback",
            user_id: user.id,
            session_key: "current",
            device_name: parseUserAgentAdv(req),
            ip_address: ip,
            location: 'Unknown Location',
            created_at: user.created_at || new Date().toISOString(),
            last_active_at: new Date().toISOString(),
            last_login_at: user.last_sign_in_at || new Date().toISOString(),
            is_current: true
          }
        ]
      });
    }
  } catch (error: any) {
    console.error("Session Fetch Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
