import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The browser only ever talks to /api on our own server; the OpenRouter key never reaches it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
  build: {
    rollupOptions: { output: { manualChunks: { maplibre: ['maplibre-gl'] } } },
    chunkSizeWarningLimit: 1200,
  },
});
