import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  // CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { table, select, eq, order, limit, truncateField, truncateLength } = req.body || {};
    if (!table) return res.status(400).json({ error: "Missing table parameter" });

    let query = supabase.from(table).select(select || '*');
    if (eq) Object.entries(eq).forEach(([key, value]) => { query = query.eq(key, value); });
    if (order) query = query.order(order.column, { ascending: order.ascending });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;

    let processedData = data;
    if (truncateField && processedData) {
      const len = truncateLength || 50;
      processedData = processedData.map((row: any) => {
        if (row[truncateField] && typeof row[truncateField] === 'string') {
          let text = row[truncateField];
          text = text.replace(/<!-- FINANCE_WIDGET_START -->[\s\S]*?<!-- FINANCE_WIDGET_END -->/g, '');
          text = text.replace(/<!--[\s\S]*?-->/g, '');
          text = text.replace(/<[^>]*>?/gm, ' ');
          text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          text = text.replace(/^(?:[-*_]\s*){3,}$/gm, '');
          text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
          text = text.replace(/(\*|_)(.*?)\1/g, '$2');
          text = text.replace(/~~(.*?)~~/g, '$1');
          text = text.replace(/`{1,3}(.*?)`{1,3}/g, '$1');
          text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
          text = text.replace(/^[#]+\s+(.*)$/gm, '$1');
          text = text.replace(/^>+\s+(.*)$/gm, '$1');
          text = text.replace(/^[-*+]\s+(.*)$/gm, '• $1');
          text = text.replace(/^\d+\.\s+(.*)$/gm, '$1');
          text = text.replace(/\n{3,}/g, '\n\n').replace(/\s+/g, ' ').trim();
          const truncated = text.length > len ? text.substring(0, len) + '...' : text;
          return { ...row, [truncateField]: truncated };
        }
        return row;
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json({ data: processedData });
  } catch (error: any) {
    console.error(`DB Query Proxy Error:`, error.message);
    return res.status(500).json({ error: error.message });
  }
}

