




# Ceaznet AI - SQL: User Data Tables

This file contains the database schema for all tables that store user-specific application data, such as conversations, AI memory, and settings.

**Instructions for Myself (the AI):**
- I MUST consult this and other files in the `sql/` folder before making database-related changes.
- When I generate or modify SQL, I MUST update the relevant file.
- All SQL must be PostgreSQL-compatible for Supabase.
- When providing SQL commands to the user, I MUST also output them in the chat inside a code block.

---

## Data Tables for Logged-in Users

The following tables store user-specific application data. They are all protected by RLS policies ensuring users can only access their own data.

**SQL Commands:**

```sql
-- ========= CONVERSATIONS TABLE =========
-- Stores user chat conversations, including messages.
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  messages JSONB,
  is_pinned BOOLEAN DEFAULT false,
  is_voice_conversation BOOLEAN DEFAULT false,
  summarization_failed BOOLEAN DEFAULT false
);
COMMENT ON TABLE public.conversations IS 'Stores user chat conversations.';
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own conversations." ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- ========= USER SETTINGS TABLE =========
-- A single row per user for all their settings.
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  api_key TEXT, -- Note: It is highly recommended to encrypt this column in Supabase for better security.
  voice_mode_voice TEXT,
  voice_mode_persona_instruction TEXT,
  voice_mode_tone_instruction TEXT,
  voice_mode_custom_instruction TEXT,
  voice_proactive_mode BOOLEAN,
  voice_recording_enabled BOOLEAN DEFAULT true,
  voice_personas JSONB,
  voice_persona TEXT,
  translator_usage JSONB,
  last_molecule TEXT, -- The name of the last viewed molecule
  last_molecule_settings JSONB -- Viewer state (style, hydrogens, etc.) for the last viewed molecule
);
COMMENT ON TABLE public.user_settings IS 'Stores individual settings for each user.';
COMMENT ON COLUMN public.user_settings.last_molecule IS 'The name of the last viewed molecule.';
COMMENT ON COLUMN public.user_settings.last_molecule_settings IS 'The 3D viewer settings (style, hydrogens, etc.) for the last viewed molecule.';
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own settings." ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);

-- ========= ARTICLE CONVERSATIONS TABLE =========
-- Stores follow-up chats for specific news articles.
CREATE TABLE public.article_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  article_url TEXT NOT NULL,
  article_title TEXT,
  messages JSONB
);
COMMENT ON TABLE public.article_conversations IS 'Stores follow-up conversations for news articles.';
-- Create a unique index to allow upserting based on user and article
CREATE UNIQUE INDEX article_conversations_user_article_idx ON public.article_conversations(user_id, article_url);
ALTER TABLE public.article_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own article conversations." ON public.article_conversations
  FOR ALL USING (auth.uid() = user_id);

-- This removes the content column from the user-specific article conversation table,
-- as the content is now stored in the global public_article_cache table.
ALTER TABLE public.article_conversations
DROP COLUMN IF EXISTS article_content;

-- ========= USER ARTICLE INTERACTIONS TABLE =========
-- Stores user-specific interactions with articles (likes, bookmarks).
CREATE TABLE public.user_article_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_url TEXT NOT NULL,
  liked BOOLEAN DEFAULT false,
  bookmarked BOOLEAN DEFAULT false
);

COMMENT ON TABLE public.user_article_interactions IS 'Stores user-specific interactions like liking or bookmarking news articles.';

-- Create a unique index to prevent duplicate entries per user per article.
CREATE UNIQUE INDEX user_article_interactions_user_article_idx ON public.user_article_interactions(user_id, article_url);

ALTER TABLE public.user_article_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own article interactions." ON public.user_article_interactions
  FOR ALL USING (auth.uid() = user_id);

-- ========= NOTES TABLE =========
-- Stores user notes.
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT,
  content TEXT,
  tags TEXT[], -- Array of strings
  is_pinned BOOLEAN DEFAULT false,
  color_theme TEXT DEFAULT 'default' -- For UI styling (e.g., 'amber', 'blue', 'green')
);

COMMENT ON TABLE public.notes IS 'Stores user personal notes.';
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notes." ON public.notes
  FOR ALL USING (auth.uid() = user_id);

-- ========= FINANCE PROFILES TABLE =========
-- Stores different profiles/wallets for finance tracking (e.g., Personal, Business).
CREATE TABLE public.finance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('personal', 'business', 'savings', 'project')),
  currency TEXT DEFAULT 'INR'
);

COMMENT ON TABLE public.finance_profiles IS 'Stores separate finance profiles or wallets for a user.';
ALTER TABLE public.finance_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own finance profiles." ON public.finance_profiles
  FOR ALL USING (auth.uid() = user_id);

-- ========= FINANCE TRANSACTIONS TABLE =========
-- Stores user financial records (expenses, income, transfers).
CREATE TABLE public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.finance_profiles(id) ON DELETE CASCADE, -- Link to profile
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  category TEXT,
  description TEXT, -- Natural language description (e.g. "30 rs paid for dosa")
  payment_method TEXT DEFAULT 'cash', -- cash, online, bank_transfer, etc.
  location JSONB, -- Stores lat/lng and name. Added in v4.2
  metadata JSONB -- Stores extra data like vehicle info, mileage, etc. Added in v4.3
);

COMMENT ON TABLE public.finance_transactions IS 'Stores financial transactions for the user.';
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transactions." ON public.finance_transactions
  FOR ALL USING (auth.uid() = user_id);

-- ========= VEHICLES TABLE =========
-- Stores user vehicles for fuel and mileage tracking.
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT NOT NULL, -- e.g. "Honda City"
  type TEXT NOT NULL DEFAULT 'car', -- 'car' or 'bike'
  number_plate TEXT, -- e.g. "MH 02 AB 1234"
  current_odometer NUMERIC(12, 2) DEFAULT 0 -- Stores the last known reading
);

COMMENT ON TABLE public.vehicles IS 'Stores user vehicles for fuel tracking.';
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own vehicles." ON public.vehicles
  FOR ALL USING (auth.uid() = user_id);

-- ========= VOICE STORAGE =========
-- Bucket for voice conversations
INSERT INTO storage.buckets (id, name, public) VALUES ('voice_conversations', 'voice_conversations', true);

CREATE POLICY "Users can upload their own voice conversations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice_conversations' AND auth.uid() = owner);

CREATE POLICY "Users can view their own voice conversations"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice_conversations' AND auth.uid() = owner);

-- Add audio_url to conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- ========= USER MOLECULES TABLE =========
-- Stores user-saved favorite molecules and their viewing preferences.
CREATE TABLE IF NOT EXISTS public.user_molecules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL, -- Stores the MoleculeData (atoms, bonds, etc.)
    settings JSONB NOT NULL, -- Stores the MoleculeViewerState
    is_favorite BOOLEAN DEFAULT true,
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)
);

COMMENT ON TABLE public.user_molecules IS 'Stores user-saved favorite molecules and their viewing preferences.';

ALTER TABLE public.user_molecules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved molecules." ON public.user_molecules
  FOR ALL USING (auth.uid() = user_id);
