import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
      manualChunks: {
        react: ['react', 'react-dom', 'react-dom/client'],
        router: ['react-router-dom'],
        icons: ['lucide-react'],
      },
    },
    },
  },
});
