import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { prerenderPlugin } from './vite-plugins/prerender.js';

// https://vite.dev/config/
export default defineConfig({
  // prerenderPlugin : ecrit un HTML par route publique (metadonnees + contenu texte) pour les
  // crawlers qui n'executent pas JavaScript, plus sitemap.xml et robots.txt.
  plugins: [react(), tailwindcss(), prerenderPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@pokegames/shared-types': fileURLToPath(
        new URL('../../packages/shared-types/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
  },
});
