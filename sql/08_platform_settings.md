# Platform Settings Setup Instructions

This script sets up the `platform_settings` table in Supabase. This table is used to dynamically manage platform-wide configurations such as the support email, logo URL, and favicon URL without needing to redeploy or modify the codebase.

## How to use

1. Go to your Supabase project dashboard.
2. Navigate to the **SQL Editor**.
3. Create a new query.
4. Copy and paste the SQL script below.
5. Click **Run**.

## SQL Script

```sql
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so the client app can read the logo/email)
CREATE POLICY "Allow public read access on platform_settings" ON public.platform_settings
    FOR SELECT TO public USING (true);

-- Allow authenticated admins to full access
CREATE POLICY "Allow authenticated admins full access on platform_settings" ON public.platform_settings
    FOR ALL TO authenticated USING (auth.role() = 'authenticated');

-- Insert defaults
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES 
    ('support_email', '"Support@ceaznet.com"', 'The email address displayed in the support inbox and client app'),
    ('platform_logo_url', '"/logo.png"', 'The URL of the brand logo displayed in header and inbox'),
    ('platform_favicon_url', '"/logo.png"', 'The URL of the favicon for the application')
ON CONFLICT (setting_key) DO NOTHING;
```
