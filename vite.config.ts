import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    const plugins = [react()];
    
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
        console.warn('[Vite Config] Skipping VitePWA load due to dynamic import error:', e.message);
      }
    } else {
      console.log('[Vite Config] Running in Development mode. VitePWA is disabled.');
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
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(import.meta.dirname, '.'),
        }
      }
    };
});
