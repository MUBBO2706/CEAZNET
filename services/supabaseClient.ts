import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and Key from environment variables, with hardcoded fallbacks.
// This is not ideal for production but is suitable for this template.
// A buyer should replace these with their own environment variables.
export const supabaseUrl = process.env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// A separate client for the Groq Edge Function Logger.
const supabaseGroqUrl = process.env.SUPABASE_URL_GROQ || 'https://txlogzxtdltxcmkhcqsi.supabase.co';
const supabaseGroqAnonKey = process.env.SUPABASE_KEY_GROQ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bG9nenh0ZGx0eGNta2hjcXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NzU4MzMsImV4cCI6MjA3NjQ1MTgzM30.v73MziZk5eNN4SVoPFoozc6K-o91V5PKcsskaCs-kAI';
export const supabaseGroq = createClient(supabaseGroqUrl, supabaseGroqAnonKey);
