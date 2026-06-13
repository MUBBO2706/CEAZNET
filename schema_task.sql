-- COMPLETE MERGED CONVERSATIONS & ARTICLES SCHEMA

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CONVERSATIONS TABLE (Voice & Chat Master Table)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Safely add all required missing columns (Idempotent)
ALTER TABLE public.conversations 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS summaries JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS planner_context JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_voice_conversation BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS audio_url TEXT,
    ADD COLUMN IF NOT EXISTS summarization_failed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_generating_title BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Ensure owner column is not strictly forcing NOT NULL to avoid insert errors
ALTER TABLE public.conversations ALTER COLUMN owner DROP NOT NULL;

-- Enable RLS and create precise, safe policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;

CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

-- 2. VOICE CONVERSATIONS STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voice_conversations', 'voice_conversations', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload their own voice conversations" ON storage.objects;
CREATE POLICY "Users can upload their own voice conversations" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'voice_conversations' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Users can view their own voice conversations" ON storage.objects;
CREATE POLICY "Users can view their own voice conversations" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'voice_conversations' AND auth.uid() = owner);

-- 3. ARTICLE CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.article_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    article_url TEXT NOT NULL,
    article_title TEXT,
    messages JSONB DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.article_conversations IS 'Stores follow-up conversations for news articles.';

CREATE UNIQUE INDEX IF NOT EXISTS article_conversations_user_article_idx ON public.article_conversations(user_id, article_url);

ALTER TABLE public.article_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own article conversations." ON public.article_conversations;
CREATE POLICY "Users can manage their own article conversations." ON public.article_conversations FOR ALL USING (auth.uid() = user_id);

-- Cleanup old deprecated column safely
ALTER TABLE public.article_conversations DROP COLUMN IF EXISTS article_content;

-- 4. PUBLIC ARTICLE CACHE TABLE
CREATE TABLE IF NOT EXISTS public.public_article_cache (
    article_url TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.public_article_cache IS 'Stores globally cached article content fetched from URLs to reduce redundant API calls.';

ALTER TABLE public.public_article_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public article cache is viewable by everyone." ON public.public_article_cache;
CREATE POLICY "Public article cache is viewable by everyone." ON public.public_article_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert new article content." ON public.public_article_cache;
CREATE POLICY "Authenticated users can insert new article content." ON public.public_article_cache FOR INSERT TO authenticated WITH CHECK (true);