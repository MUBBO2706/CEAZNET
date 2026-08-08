-- 1. Fix the broken event trigger function first (Safe: Uses OR REPLACE)
CREATE OR REPLACE FUNCTION attach_trigger_to_new_table()
RETURNS event_trigger AS $$
DECLARE
    obj record;
    table_name text;
    trigger_name text;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE'
    LOOP
        table_name := obj.object_identity;
        -- Create a safe trigger name by replacing dots with underscores
        trigger_name := replace(table_name, '.', '_') || '_activity_trigger';
        
        -- Use format() to safely construct the SQL queries
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trigger_name, table_name);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION public.log_table_activity()', trigger_name, table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the new table safely (Safe: Uses IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.news_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider IN ('gnews', 'gemini', 'brevo')),
    api_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted')),
    calls_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.1 Update existing constraint to allow 'brevo'
ALTER TABLE public.news_api_keys DROP CONSTRAINT IF EXISTS news_api_keys_provider_check;
ALTER TABLE public.news_api_keys ADD CONSTRAINT news_api_keys_provider_check CHECK (provider IN ('gnews', 'gemini', 'brevo'));

-- 3. Add new tracking columns to existing news_api_keys table safely
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_used_category TEXT;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_failed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS last_error_message TEXT;
ALTER TABLE public.news_api_keys ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMP WITH TIME ZONE;

-- 4. Create Audit Logs Table (For tracking Fallbacks and Retries)
CREATE TABLE IF NOT EXISTS public.api_key_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    failed_key_id UUID REFERENCES public.news_api_keys(id),
    fallback_key_id UUID REFERENCES public.news_api_keys(id),
    category TEXT,
    error_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Clean up the old article_processing_logs table and function (User requested removal)
DROP TABLE IF EXISTS public.article_processing_logs CASCADE;
DROP FUNCTION IF EXISTS log_skipped_article(TEXT, TEXT, TEXT);

-- 6. Enable RLS on all tables
ALTER TABLE public.news_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Create Policies safely (Safe: Drops old policy before creating new one)
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.news_api_keys;
CREATE POLICY "Allow full access to authenticated users" ON public.news_api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON public.api_key_audit_logs;
CREATE POLICY "Allow full access to authenticated users" ON public.api_key_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Create Advanced RPCs for Edge Function (Safe: Uses OR REPLACE)
CREATE OR REPLACE FUNCTION mark_news_key_used(key_id UUID, cat TEXT) RETURNS void AS $$
BEGIN
    UPDATE public.news_api_keys
    SET calls_count = calls_count + 1, 
        last_used_at = now(), 
        last_used_category = cat,
        failure_count = 0,
        status = 'active',
        cooldown_until = NULL
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_news_key_failed(key_id UUID, err_msg TEXT, max_failures INTEGER) RETURNS void AS $$
DECLARE
    current_failures INTEGER;
    v_provider TEXT;
    next_reset TIMESTAMP WITH TIME ZONE;
    current_utc TIMESTAMP;
BEGIN
    UPDATE public.news_api_keys
    SET failure_count = failure_count + 1,
        last_failed_at = now(),
        last_error_message = err_msg
    WHERE id = key_id
    RETURNING failure_count, provider INTO current_failures, v_provider;

    -- If key fails too many times, calculate precise daily reset target
    IF current_failures >= max_failures THEN
        current_utc := now() AT TIME ZONE 'UTC';
        
        IF v_provider IN ('gnews', 'brevo') THEN
            -- Reset at exactly 05:30 IST (00:00 UTC Midnight)
            next_reset := (date_trunc('day', current_utc) + interval '1 day') AT TIME ZONE 'UTC';
            
        ELSIF v_provider = 'gemini' THEN
            -- Reset at exactly 01:30 IST (20:00 UTC)
            IF extract(hour from current_utc) >= 20 THEN
                -- Already past 20:00 UTC today, target is 20:00 UTC tomorrow
                next_reset := (date_trunc('day', current_utc) + interval '1 day 20 hours') AT TIME ZONE 'UTC';
            ELSE
                -- Still before 20:00 UTC today, target is 20:00 UTC today
                next_reset := (date_trunc('day', current_utc) + interval '20 hours') AT TIME ZONE 'UTC';
            END IF;
            
        ELSE
            -- Safe default
            next_reset := now() + interval '24 hours';
        END IF;

        UPDATE public.news_api_keys
        SET status = 'exhausted', 
            cooldown_until = next_reset
        WHERE id = key_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_api_key_audit(failed_id UUID, fallback_id UUID, cat TEXT, err TEXT) RETURNS void AS $$
BEGIN
    INSERT INTO public.api_key_audit_logs (failed_key_id, fallback_key_id, category, error_reason)
    VALUES (failed_id, fallback_id, cat, err);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
