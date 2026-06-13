CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. PROFILES TABLE SETUP

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    updated_at TIMESTAMPTZ,

    full_name TEXT,

    avatar_url TEXT,

    is_suspended BOOLEAN DEFAULT FALSE
);

-- Safely add missing columns if table already existed previously
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone."
ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone."
ON public.profiles
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile."
ON public.profiles;

CREATE POLICY "Users can insert their own profile."
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile."
ON public.profiles;

CREATE POLICY "Users can update own profile."
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- 2. USER SETTINGS TABLE SETUP

CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    api_key TEXT,

    voice_mode_voice TEXT,

    voice_mode_persona_instruction TEXT,

    voice_mode_tone_instruction TEXT,

    voice_mode_custom_instruction TEXT,

    voice_proactive_mode BOOLEAN,

    voice_recording_enabled BOOLEAN DEFAULT true,

    translator_usage JSONB,

    voice_personas JSONB,
    voice_persona TEXT,

    ui_theme TEXT DEFAULT 'system',

    ui_font TEXT DEFAULT 'Geist Sans',

    ui_density TEXT DEFAULT 'comfortable'
);

-- Safely add missing columns in case an older version exists
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS api_key TEXT;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_mode_voice TEXT;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_mode_persona_instruction TEXT;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_mode_tone_instruction TEXT;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_mode_custom_instruction TEXT;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_proactive_mode BOOLEAN;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS translator_usage JSONB;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS ui_theme TEXT DEFAULT 'system';

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS ui_font TEXT DEFAULT 'Geist Sans';

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS ui_density TEXT DEFAULT 'comfortable';

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_recording_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_personas JSONB;

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS voice_persona TEXT;

COMMENT ON COLUMN public.user_settings.ui_theme
IS 'User preference for app theme (light, dark, system)';

COMMENT ON COLUMN public.user_settings.ui_font
IS 'User selected font family';

COMMENT ON COLUMN public.user_settings.ui_density
IS 'Layout density: comfortable (default) or compact';

ALTER TABLE public.user_settings
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own settings."
ON public.user_settings;

CREATE POLICY "Users can manage their own settings."
ON public.user_settings
FOR ALL
USING (auth.uid() = user_id);

-- 3. PLATFORM SETTINGS TABLE

CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    setting_key TEXT UNIQUE NOT NULL,

    setting_value JSONB,

    description TEXT,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.platform_settings
ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
"Allow public read access on platform_settings"
ON public.platform_settings;

CREATE POLICY
"Allow public read access on platform_settings"
ON public.platform_settings
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS
"Allow authenticated admins full access on platform_settings"
ON public.platform_settings;

CREATE POLICY
"Allow authenticated admins full access on platform_settings"
ON public.platform_settings
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated');

-- Safe specific public policy for persistent client-side device caching
DROP POLICY IF EXISTS "Allow public full access on device_cache setting" ON public.platform_settings;
CREATE POLICY "Allow public full access on device_cache setting" ON public.platform_settings
    FOR ALL
    TO public
    USING (setting_key = 'device_cache')
    WITH CHECK (setting_key = 'device_cache');

-- Insert defaults safely
INSERT INTO public.platform_settings (
    setting_key,
    setting_value,
    description
)
VALUES
(
    'support_email',
    '"Support@ceaznet.com"',
    'The email address displayed in the support inbox and client app'
),
(
    'platform_logo_url',
    '"/logo.png"',
    'The URL of the brand logo displayed in header and inbox'
),
(
    'platform_favicon_url',
    '"/logo.png"',
    'The URL of the favicon for the application'
)
ON CONFLICT (setting_key)
DO NOTHING;

-- 4. AUTH TRIGGER FUNCTION

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN

    -- Insert into profiles table
    INSERT INTO public.profiles (
        id,
        full_name,
        avatar_url
    )
    VALUES (
        new.id,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id)
    DO NOTHING;

    -- Insert into user_settings table
    INSERT INTO public.user_settings (
        user_id
    )
    VALUES (
        new.id
    )
    ON CONFLICT (user_id)
    DO NOTHING;

    RETURN new;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. AUTH USER CREATED TRIGGER

DROP TRIGGER IF EXISTS on_auth_user_created
ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT
ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();

-- 6. STORAGE BUCKETS & POLICIES

-- 6.1 AVATARS STORAGE

INSERT INTO storage.buckets (
    id,
    name,
    public
)
VALUES (
    'avatars',
    'avatars',
    true
)
ON CONFLICT (id)
DO NOTHING;

DROP POLICY IF EXISTS
"Avatar images are publicly accessible."
ON storage.objects;

CREATE POLICY
"Avatar images are publicly accessible."
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'avatars'
);

DROP POLICY IF EXISTS
"Users can upload their own avatar."
ON storage.objects;

CREATE POLICY
"Users can upload their own avatar."
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() = (storage.foldername(name))[1]::uuid
);

DROP POLICY IF EXISTS
"Users can update their own avatar."
ON storage.objects;

CREATE POLICY
"Users can update their own avatar."
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND auth.uid() = (storage.foldername(name))[1]::uuid
);

DROP POLICY IF EXISTS
"Users can delete their own avatar."
ON storage.objects;

CREATE POLICY
"Users can delete their own avatar."
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND auth.uid() = (storage.foldername(name))[1]::uuid
);

-- 6.2 USER UPLOADS STORAGE

INSERT INTO storage.buckets (
    id,
    name,
    public
)
VALUES (
    'user_uploads',
    'user_uploads',
    true
)
ON CONFLICT (id)
DO NOTHING;

DROP POLICY IF EXISTS
"Uploaded files are publicly accessible."
ON storage.objects;

CREATE POLICY
"Uploaded files are publicly accessible."
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'user_uploads'
);

DROP POLICY IF EXISTS
"Users can upload their own files."
ON storage.objects;

CREATE POLICY
"Users can upload their own files."
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user_uploads'
    AND auth.uid() = (storage.foldername(name))[1]::uuid
);

DROP POLICY IF EXISTS
"Users can delete their own files."
ON storage.objects;

CREATE POLICY
"Users can delete their own files."
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'user_uploads'
    AND auth.uid() = (storage.foldername(name))[1]::uuid
);

-- 7. USER SESSIONS & ACTIVE DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_key TEXT NOT NULL,
    device_name TEXT,
    ip_address TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure correct columns are present if table existed
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS session_key TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS battery_percentage NUMERIC;

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Select/View own records
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Policy: Delete own records
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.user_sessions;
CREATE POLICY "Users can delete their own sessions" ON public.user_sessions
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policy: Insert and updates
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
CREATE POLICY "Users can update their own sessions" ON public.user_sessions
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DONE