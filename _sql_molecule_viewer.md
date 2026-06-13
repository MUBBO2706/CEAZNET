# Kalina AI - SQL: Molecule Viewer Persistence

This file contains the database schema for the molecule viewer, including the table for saved molecules and extensions to the user settings.

## `user_molecules` Table

Stores user-saved favorite molecules and their viewing preferences.

**SQL Commands:**

```sql
-- Create user_molecules table
CREATE TABLE IF NOT EXISTS public.user_molecules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL, -- Stores the MoleculeData (atoms, bonds, etc.)
    settings JSONB NOT NULL, -- Stores the MoleculeViewerState
    is_favorite BOOLEAN DEFAULT true,
    last_viewed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name) -- Prevent duplicate saves of the same molecule for the same user
);

COMMENT ON TABLE public.user_molecules IS 'Stores user-saved favorite molecules and their viewing preferences.';

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_molecules ENABLE ROW LEVEL SECURITY;

-- Create Policies for user_molecules
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_molecules' 
    AND policyname = 'Users can manage their own saved molecules.'
  ) THEN
    CREATE POLICY "Users can manage their own saved molecules." 
    ON public.user_molecules
    FOR ALL 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Enable Realtime for syncing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'user_molecules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_molecules;
  END IF;
END $$;
```

## `user_settings` Extensions

Adds columns for the last viewed molecule and its display state.

**SQL Commands:**

```sql
-- Add columns to user_settings safely
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS last_molecule TEXT,
ADD COLUMN IF NOT EXISTS last_molecule_settings JSONB;

COMMENT ON COLUMN public.user_settings.last_molecule IS 'The name of the last viewed molecule.';
COMMENT ON COLUMN public.user_settings.last_molecule_settings IS 'The 3D viewer settings (style, hydrogens, etc.) for the last viewed molecule.';
```
