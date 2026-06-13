import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { table, select, eq, order, limit } = req.body;
    if (!table) return res.status(400).json({ error: "Missing table parameter" });

    let query = supabase.from(table).select(select || '*');
    if (eq) Object.entries(eq).forEach(([key, value]) => { query = query.eq(key, value); });
    if (order) query = query.order(order.column, { ascending: order.ascending });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    // Cache at Vercel Edge for 1 hour (3600 seconds)
    // stale-while-revalidate allows serving stale content while fetching fresh content in background
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=120');
    
    return res.status(200).json({ data });
  } catch (error) {
    console.error(`DB Query Proxy Error:`, error.message);
    return res.status(500).json({ error: error.message });
  }
}
