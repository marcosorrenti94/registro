import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Base path per GitHub Pages: in GitHub Actions si ricava dal nome del repository
 * (https://<utente>.github.io/<repo>/). Forzabile con VITE_BASE. In locale è "/".
 */
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE;
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (process.env.GITHUB_ACTIONS && repo) return repo.endsWith('.github.io') ? '/' : `/${repo}/`;
  return '/';
}

export default defineConfig({
  base: resolveBase(),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Registro',
        short_name: 'Registro',
        description: 'Entrate, uscite e varie della parrucchieria',
        lang: 'it',
        theme_color: '#6d2f57',
        background_color: '#f5f4f7',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // I dati passano dall'API GitHub: mai in cache del service worker
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
