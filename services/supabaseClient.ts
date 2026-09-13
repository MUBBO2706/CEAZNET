import { createClient } from '@supabase/supabase-js';

// Resolve Supabase URL & Public Anon Key with priority:
// 1. Vercel / Vite env variables (VITE_SUPABASE_URL, SUPABASE_URL)
// 2. Fallback to application's default Supabase instance
export const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
  'https://itjurgqbvsqniphuehiz.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_KEY)) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY)) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// A separate client for the Groq Edge Function Logger.
const supabaseGroqUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL_GROQ) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL_GROQ || process.env.SUPABASE_URL_GROQ)) ||
  'https://txlogzxtdltxcmkhcqsi.supabase.co';

const supabaseGroqAnonKey = 
  (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_KEY_GROQ || import.meta.env?.VITE_SUPABASE_ANON_KEY_GROQ)) ||
  (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_KEY_GROQ || process.env.SUPABASE_KEY_GROQ || process.env.VITE_SUPABASE_ANON_KEY_GROQ)) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bG9nenh0ZGx0eGNta2hjcXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NzU4MzMsImV4cCI6MjA3NjQ1MTgzM30.v73MziZk5eNN4SVoPFoozc6K-o91V5PKcsskaCs-kAI';

export const supabaseGroq = createClient(supabaseGroqUrl, supabaseGroqAnonKey);

