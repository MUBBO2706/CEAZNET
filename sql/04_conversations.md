-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the table if it completely doesn't exist
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
);

-- 2. Add missing columns one by one (Idempotent)
DO $$
BEGIN
    -- user_id (crucial for RLS and matching your data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'user_id') THEN
        ALTER TABLE public.conversations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Make owner nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'owner' AND is_nullable = 'NO') THEN
        ALTER TABLE public.conversations ALTER COLUMN owner DROP NOT NULL;
    END IF;

    -- created_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'created_at') THEN
        ALTER TABLE public.conversations ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- title
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'title') THEN
        ALTER TABLE public.conversations ADD COLUMN title TEXT;
    END IF;

    -- messages
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'messages') THEN
        ALTER TABLE public.conversations ADD COLUMN messages JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- is_pinned
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'is_pinned') THEN
        ALTER TABLE public.conversations ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE;
    END IF;

    -- is_voice_conversation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'is_voice_conversation') THEN
        ALTER TABLE public.conversations ADD COLUMN is_voice_conversation BOOLEAN DEFAULT FALSE;
    END IF;

    -- audio_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'audio_url') THEN
        ALTER TABLE public.conversations ADD COLUMN audio_url TEXT;
    END IF;
END $$;


-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any to ensure idempotency when rerunning
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;

-- 5. Create Row Level Security Policies
-- SELECT policy (Checking either user_id or owner to be fully backward-compatible)
CREATE POLICY "Users can view their own conversations"
ON public.conversations FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = owner);

-- INSERT policy
CREATE POLICY "Users can insert their own conversations"
ON public.conversations FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() = owner);

-- UPDATE policy
CREATE POLICY "Users can update their own conversations"
ON public.conversations FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = owner)
WITH CHECK (auth.uid() = user_id OR auth.uid() = owner);

-- DELETE policy
CREATE POLICY "Users can delete their own conversations"
ON public.conversations FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = owner);
