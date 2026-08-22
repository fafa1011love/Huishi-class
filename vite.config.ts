import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiPort = env.API_PORT || '4000';
    return {
      server: {
        port: 3000,
        // The API validates WebSocket origins against CLIENT_ORIGIN. Silently
        // moving the web app to 3001 leaves normal HTTP requests looking
        // healthy while ASR/TTS upgrades are rejected by the API on 4000.
        strictPort: true,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: `http://localhost:${apiPort}`,
            changeOrigin: true,
            xfwd: true,
            ws: true,
          },
          '/tts': {
            target: env.XIAOZHI_TTS_ORIGIN || 'http://127.0.0.1:8787',
            changeOrigin: true,
          },
        },
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
