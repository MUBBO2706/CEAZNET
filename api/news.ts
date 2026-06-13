import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const { category, url } = req.query;
    
    // Calculate next cache invalidation time (5 minutes past every 3rd hour starting at 00:00 UTC)
    // This ensures cron jobs (which run at 00:00, 03:00 UTC, etc. - 05:30 IST) have time to complete
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    
    const updateIntervals = [
      5,          // 00:05 UTC (05:35 IST)
      3 * 60 + 5, // 03:05 UTC (08:35 IST)
      6 * 60 + 5, // 06:05 UTC (11:35 IST)
      9 * 60 + 5, // 09:05 UTC (14:35 IST)
      12 * 60 + 5,// 12:05 UTC (17:35 IST)
      15 * 60 + 5,// 15:05 UTC (20:35 IST)
      18 * 60 + 5,// 18:05 UTC (23:35 IST)
      21 * 60 + 5,// 21:05 UTC (02:35 IST)
      24 * 60 + 5 // Next day 00:05 UTC
    ];
    
    const nextUpdateMinutes = updateIntervals.find(m => m > totalMinutes) || updateIntervals[updateIntervals.length - 1];
    
    const nextUpdate = new Date(now);
    nextUpdate.setUTCHours(0, 0, 0, 0);
    nextUpdate.setUTCMinutes(nextUpdateMinutes);
    
    const maxAgeSeconds = Math.floor((nextUpdate.getTime() - now.getTime()) / 1000);

    // If fetching a single article by URL, fetch everything including formatted_content_md
    if (url) {
      const { data, error } = await supabase
          .from('public_news_articles')
          .select('category, article_data, formatted_content_md, views, likes, bookmarks')
          .eq('article_data->>url', url)
          .single();

      if (error) throw error;

      res.setHeader('Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=60`);
      return res.status(200).json({ data });
    }

    if (!category) return res.status(400).json({ error: "Missing category or url parameter" });

    // For category lists, optimize by NOT fetching formatted_content_md
    const { data, error } = await supabase
        .from('public_news_articles')
        .select('category, article_data, views, likes, bookmarks')
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) throw error;

    // Further optimize payload by stripping large 'content' strings from JSONB article_data
    const optimizedData = data.map(item => {
      let article_data = item.article_data;
      if (article_data) {
        // Create a shallow copy to modify
        article_data = { ...article_data };
        delete article_data.content;
      }
      return {
        ...item,
        article_data
      };
    });

    // Edge cache it
    res.setHeader('Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=60`);
    
    return res.status(200).json({ data: optimizedData });
  } catch (error) {
    console.error(`News Proxy Error:`, error.message);
    return res.status(500).json({ error: error.message });
  }
}
