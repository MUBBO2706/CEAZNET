import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

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

    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ error: "Missing session id to terminate" });
    }

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    try {
      const { data: sessionData } = await userClient
        .from('user_sessions')
        .select('session_key')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
        
      if (sessionData && !sessionData.session_key.startsWith('TERMINATED_')) {
        const { error } = await userClient
          .from('user_sessions')
          .update({ session_key: `TERMINATED_${sessionData.session_key}` })
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      }

      res.json({ success: true });
    } catch (dbErr: any) {
      console.warn("[Session Terminated] Table 'user_sessions' delete failure:", dbErr.message);
      res.json({ success: true, fallback: true });
    }
  } catch (error: any) {
    console.error("Session Terminate Error:", error.message);
    res.status(500).json({ error: error.message });
  }
}
