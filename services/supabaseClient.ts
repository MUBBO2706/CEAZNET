import { createClient } from '@supabase/supabase-js';

const isVercel = typeof process !== 'undefined' && (process.env.VERCEL === '1' || process.env.NOW_BUILD === '1');

// Resolve standard URL & Key with fallback ONLY when not on Vercel
export const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || (isVercel ? '' : 'https://itjurgqbvsqniphuehiz.supabase.co');
const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag');

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({}, {
      get: () => {
        throw new Error("SUPABASE_URL and SUPABASE_KEY environment variables are required in production.");
      }
    }) as any;

// A separate client for the Groq Edge Function Logger.
const supabaseGroqUrl = process.env.SUPABASE_URL_GROQ || (isVercel ? '' : 'https://txlogzxtdltxcmkhcqsi.supabase.co');
const supabaseGroqAnonKey = process.env.SUPABASE_KEY_GROQ || (isVercel ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bG9nenh0ZGx0eGNta2hjcXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NzU4MzMsImV4cCI6MjA3NjQ1MTgzM30.v73MziZk5eNN4SVoPFoozc6K-o91V5PKcsskaCs-kAI');

export const supabaseGroq = (supabaseGroqUrl && supabaseGroqAnonKey)
  ? createClient(supabaseGroqUrl, supabaseGroqAnonKey)
  : new Proxy({}, {
      get: () => {
        throw new Error("SUPABASE_URL_GROQ and SUPABASE_KEY_GROQ environment variables are required in production.");
      }
    }) as any;
