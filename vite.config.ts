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
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__BUILD_ID__': JSON.stringify(buildId)
      },
      resolve: {
        alias: {
          '@': path.resolve(import.meta.dirname, '.'),
        }
      }
    };
});
