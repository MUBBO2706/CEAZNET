-- SQL to create the news system config table
CREATE TABLE IF NOT EXISTS public.news_system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default models (you can update these from your admin panel later)
INSERT INTO public.news_system_config (config_key, config_value, description)
VALUES 
('formatting_model', '"gemini-2.5-flash"', 'Model used for formatting articles'),
('summary_model', '"gemini-2.5-flash"', 'Model used for generating admin summaries')
ON CONFLICT (config_key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.news_system_config ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users or service role
CREATE POLICY "Allow read access to config" ON public.news_system_config FOR SELECT USING (true);
-- Allow update access to authenticated users
CREATE POLICY "Allow update access to config" ON public.news_system_config FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Allow insert access to config" ON public.news_system_config FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow delete access to config" ON public.news_system_config FOR DELETE USING (auth.role() = 'authenticated');
