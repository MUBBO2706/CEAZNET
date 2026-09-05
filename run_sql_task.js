const apiKey = 'sk_sync_b4k92jdm10';
const projectId = '407664ed-f183-4269-b305-df6851a61dff';
const sql = `
-- Fix missing columns on activity_logs
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS record_id TEXT;

-- Robust script to enable Realtime and Enforce REPLICA IDENTITY FULL for all required tables
DO $$
DECLARE
    t text;
    rt_tables text[] := ARRAY[
        'activity_logs',
        'support_conversations',
        'support_messages',
        'news_system_config',
        'news_api_keys',
        'user_sessions',
        'broadcasts',
        'update_news_logs',
        'public_news_articles'
    ];
BEGIN
    FOREACH t IN ARRAY rt_tables
    LOOP
        -- Enforce FULL replica identity for each table if it exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
            
            -- Enable realtime publication
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
            END IF;
        END IF;
    END LOOP;
END $$;
`;

fetch('https://task-manager-ceaznet.vercel.app/api/ai/write', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  },
  body: JSON.stringify({
    projectId: projectId,
    title: 'Enable Realtime and enforce FULL replica identity for active tables',
    sql: sql,
    type: 'sql'
  })
}).then(res => res.json()).then(console.log).catch(console.error);
