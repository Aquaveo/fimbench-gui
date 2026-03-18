import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => ({
  // BASE URL: dev = '/', production = Tethys app URL
  base: mode === 'production' ? '/apps/fimbench-gui/' : '/',

  plugins: [
    react(),
    svgr()
  ],

  build: {
    outDir: path.resolve(
      __dirname,
      '../tethysapp/fimbench_gui/public/frontend'
    ),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'main.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    proxy: {
      '/apps': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}));
