import { createClient } from '@supabase/supabase-js';
const supabaseAdminUrl = process.env.VITE_SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseAdminKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';
const supabase = createClient(supabaseAdminUrl, supabaseAdminKey);

async function checkTriggers() {
    const { data, error } = await supabase.from('user_sessions').select('*').limit(1);
    console.log("Response:", data, error);
}
checkTriggers();
