import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Configuration des tests
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },

  // Résoudre les imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },

  // Configuration du serveur de développement
  server: {
    port: 3000,
    open: true,
    host: true,
  },

  // Configuration du build
  build: {
    outDir: 'build',
    sourcemap: false, // Désactivé en production pour la sécurité
    chunkSizeWarningLimit: 1000, // Augmenter la limite à 1MB (certaines libs PDF sont grosses)
    rollupOptions: {
      output: {
        manualChunks: {
          // Frameworks
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],

          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],

          // PDF & Documents (grosses librairies)
          'vendor-pdf': ['pdf-lib'],
          'vendor-jspdf': ['jspdf'],
          'vendor-html2canvas': ['html2canvas'],

          // Utilitaires
          'vendor-utils': ['dompurify', 'zustand', '@tanstack/react-query'],
        },
      },
    },
  },

  // Optimisation des dépendances
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});
