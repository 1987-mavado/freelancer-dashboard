import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Done',
        short_name: 'Done',
        description: 'Verwaltung für Bewerbungen, Projekte, KVAs, Rechnungen und Deadlines',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Die Daten liegen jetzt in Supabase/Postgres statt in einer lokalen
        // IndexedDB — ohne Runtime-Caching wäre die App bei fehlender
        // Verbindung komplett leer, obwohl die App-Shell (s.o.) offline
        // startet. NetworkFirst liefert bei bestehender Verbindung immer
        // frische Daten, fällt bei Timeout/Offline aber auf die zuletzt
        // gesehene Antwort zurück, sodass zumindest ein Lesezugriff auf
        // zuvor geladene Daten offline funktioniert. Nur GET-Requests
        // werden von Workbox überhaupt gecacht — Schreibzugriffe (POST/
        // PATCH/DELETE) laufen unverändert direkt gegen das Netzwerk durch
        // und schlagen offline sichtbar fehl, statt still verloren zu gehen.
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-rest-cache',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
