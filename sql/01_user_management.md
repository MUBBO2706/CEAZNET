# Ceaznet AI - SQL: User Management

This file contains the database schema and policies related to user authentication and profiles.

**Instructions for Myself (the AI):**
- I MUST consult this and other files in the `sql/` folder before making database-related changes.
- When I generate or modify SQL, I MUST update the relevant file.
- All SQL must be PostgreSQL-compatible for Supabase.
- When providing SQL commands to the user, I MUST also output them in the chat inside a code block.

---

## `profiles` Table (for Supabase `auth.users`)

This table stores public user profile information and is linked one-to-one with the `auth.users` table.

**SQL Commands:**

```sql
-- Create the profiles table to store user-specific data
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  full_name TEXT,
  avatar_url TEXT
);

-- Add comments for clarity
COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';
COMMENT ON COLUMN public.profiles.id IS 'References the user in auth.users.';

-- Set up Row Level Security (RLS) for the profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to all profiles
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

-- Policy: Allow users to create their own profile (handled by trigger)
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Allow users to update their own profile
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Supabase Storage for Avatars

The following SQL sets up a storage bucket named `avatars` for user profile pictures and configures Row Level Security to ensure users can only manage their own files.

**SQL Commands:**

```sql
-- 1. Create a new bucket named 'avatars' and make it public so images can be displayed.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up Row Level Security (RLS) policies for the 'avatars' bucket

-- Policy: Allow anyone to view all avatars.
CREATE POLICY "Avatar images are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Policy: Allow authenticated users to upload their own avatar.
CREATE POLICY "Users can upload their own avatar."
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- Policy: Allow users to update their own avatar.
CREATE POLICY "Users can update their own avatar."
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );

-- Policy: Allow users to delete their own avatar.
CREATE POLICY "Users can delete their own avatar."
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid );
```

## New User Creation Trigger

This single function handles creating associated rows in `profiles` and `user_settings` whenever a new user signs up in `auth.users`.

**SQL Commands:**

```sql
-- First, drop the old trigger and function if they exist, to avoid conflicts.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- This function creates a row in both `profiles` and `user_settings` when a new user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  
  -- Insert into user_settings
  INSERT INTO public.user_settings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to use the updated function.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## `user_sessions` Table (for Device Sessions)

This table stores references to active login sessions per user, allowing detection of logged-in locations, devices, and remote termination of those sessions.

**SQL Commands:**

```sql
-- Create user sessions table
CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_key TEXT NOT NULL,
    device_name TEXT,
    ip_address TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own active sessions
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Allow users to terminate/delete their own sessions
CREATE POLICY "Users can delete their own sessions" ON public.user_sessions
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Allow inserting own sessions
CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow updating own sessions
CREATE POLICY "Users can update their own sessions" ON public.user_sessions
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```