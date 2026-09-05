import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdminUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co';
const supabaseAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag';

const supabaseAdmin = createClient(supabaseAdminUrl, supabaseAdminKey);

export default async function handler(req: any, res: any) {
  // Allow both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let noteId = '';
    let exp = '';
    let sig = '';

    if (req.method === 'GET') {
      noteId = (req.query.id || req.query.noteId) as string;
      exp = req.query.exp as string;
      sig = req.query.sig as string;
    } else {
      noteId = req.body.id || req.body.noteId;
      exp = req.body.exp || req.query.exp;
      sig = req.body.sig || req.query.sig;
    }

    if (!noteId) {
      return res.status(400).json({ success: false, error: "Missing note ID parameter" });
    }

    if (exp && exp !== 'never') {
      // Validate signature to prevent tampering
      const expectedSig = crypto.createHash('sha256').update(noteId + ':' + exp).digest('hex');
      if (sig !== expectedSig) {
        return res.status(403).json({ success: false, error: "Invalid share link signature or link tampered" });
      }
      
      // Check if expired
      const expTime = parseInt(exp, 10);
      if (isNaN(expTime) || Date.now() > expTime) {
        return res.status(410).json({ success: false, error: "expired: This shareable note link has expired." });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('notes')
      .select('id, user_id, title, content, tags, is_pinned, color_theme, created_at, updated_at')
      .eq('id', noteId)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).json({ success: false, error: "Note not found or deleted" });
    }

    return res.status(200).json({
      success: true,
      note: {
        id: data.id,
        user_id: data.user_id,
        title: data.title || 'Untitled Note',
        content: data.content || '',
        tags: data.tags || [],
        isPinned: data.is_pinned,
        colorTheme: data.color_theme || 'default',
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    });
  } catch (err: any) {
    console.error("Error in serverless shared note handler:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
