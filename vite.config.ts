import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Generate/Retrieve a unique build ID based on the current timestamp
    let buildId = '';
    const tempBuildIdPath = path.resolve(import.meta.dirname, '.build_id.tmp');
    try {
      if (fs.existsSync(tempBuildIdPath)) {
        buildId = fs.readFileSync(tempBuildIdPath, 'utf8').trim();
      } else {
        buildId = Date.now().toString();
        fs.writeFileSync(tempBuildIdPath, buildId, 'utf8');
      }

      const publicDir = path.resolve(import.meta.dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify({ version: buildId }), 'utf8');

      // Also write version.json to api/ folder so Vercel serverless builder automatically bundles it into the Lambda environment
      const apiDir = path.resolve(import.meta.dirname, 'api');
      if (fs.existsSync(apiDir)) {
        fs.writeFileSync(path.join(apiDir, 'version.json'), JSON.stringify({ version: buildId }), 'utf8');
      }
    } catch (err: any) {
      console.warn('[Vite Config] Failed to handle buildId configuration:', err.message);
      buildId = Date.now().toString();
    }

    const buildIdCleanupPlugin = {
      name: 'build-id-cleanup',
      closeBundle() {
        try {
          const tempBuildIdPath = path.resolve(import.meta.dirname, '.build_id.tmp');
          if (fs.existsSync(tempBuildIdPath)) {
            fs.unlinkSync(tempBuildIdPath);
            console.log('[Vite Config] Cleaned up temporary .build_id.tmp file.');
          }
        } catch (err) {}
      }
    };

    const plugins = [react(), buildIdCleanupPlugin];
    
    // Only load PWA Plugin during production builds to avoid development require.loader crashes on Node 20/22
    const isDev = mode === 'development' || process.env.NODE_ENV !== 'production';
    
    if (!isDev) {
      try {
        const { VitePWA } = await import('vite-plugin-pwa');
        plugins.push(VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['logo.png'],
          workbox: {
            maximumFileSizeToCacheInBytes: 15728640 // 15MB
          },
          manifest: {
            name: 'Ceaznet',
            short_name: 'Ceaznet',
            description: 'Ceaznet Application',
            theme_color: '#F9F6F2',
            background_color: '#F9F6F2',
            display: 'standalone',
            icons: [
              {
                src: 'logo.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: 'logo.png',
                sizes: '512x512',
                type: 'image/png'
              }
            ]
          }
        }));
        console.log('[Vite Config] Dynamic VitePWA plugin registered successfully.');
      } catch (e: any) {
        // Skipping VitePWA load due to dynamic import error
      }
    }

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false
      },
      plugins,
      build: {
        sourcemap: false,
        minify: false,
        cssMinify: false,
        cssCodeSplit: false,
        assetsInlineLimit: 0,
        rollupOptions: {
          maxParallelFileOps: 1,
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co'),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://itjurgqbvsqniphuehiz.supabase.co'),
        'process.env.SUPABASE_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag'),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0anVyZ3FidnNxbmlwaHVlaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODM5NTgsImV4cCI6MjA5MDg1OTk1OH0.WSyZbgJ7rcbaTGCwURHTxQCHU9__F_ql75L6upVsVag'),
        'process.env.SUPABASE_URL_GROQ': JSON.stringify(env.SUPABASE_URL_GROQ || 'https://txlogzxtdltxcmkhcqsi.supabase.co'),
        'process.env.SUPABASE_KEY_GROQ': JSON.stringify(env.SUPABASE_KEY_GROQ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bG9nenh0ZGx0eGNta2hjcXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NzU4MzMsImV4cCI6MjA3NjQ1MTgzM30.v73MziZk5eNN4SVoPFoozc6K-o91V5PKcsskaCs-kAI'),
        'process.env.TELEGRAM_BOT_TOKEN': JSON.stringify(env.VITE_TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN || '8403959177:AAFJrkcRCeTHTyS5uVBwlLKTE79dwq_HYzU'),
        'process.env.VITE_TELEGRAM_BOT_TOKEN': JSON.stringify(env.VITE_TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN || '8403959177:AAFJrkcRCeTHTyS5uVBwlLKTE79dwq_HYzU'),
        'process.env.TELEGRAM_CHAT_ID': JSON.stringify(env.VITE_TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID || '-1003984567697'),
        'process.env.VITE_TELEGRAM_CHAT_ID': JSON.stringify(env.VITE_TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID || '-1003984567697'),
        'process.env.TELEGRAM_CACHE_CHAT_ID': JSON.stringify(env.VITE_TELEGRAM_CACHE_CHAT_ID || env.TELEGRAM_CACHE_CHAT_ID || '-1003984567697'),
        'process.env.VITE_TELEGRAM_CACHE_CHAT_ID': JSON.stringify(env.VITE_TELEGRAM_CACHE_CHAT_ID || env.TELEGRAM_CACHE_CHAT_ID || '-1003984567697'),
        '__BUILD_ID__': JSON.stringify(buildId)
      },
      resolve: {
        alias: {
          '@': path.resolve(import.meta.dirname, '.'),
        }
      }
    };
});
