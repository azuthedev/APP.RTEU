import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', 'icons/**/*.png', 'offline.html'],
        manifest: {
          name: 'Royal Transfer EU Admin Portal',
          short_name: 'RT Admin',
          description: 'Administrative portal for Royal Transfer EU staff and drivers',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'icons/admin/72x72.png',
              sizes: '72x72',
              type: 'image/png'
            },
            {
              src: 'icons/admin/96x96.png',
              sizes: '96x96',
              type: 'image/png'
            },
            {
              src: 'icons/admin/128x128.png',
              sizes: '128x128',
              type: 'image/png'
            },
            {
              src: 'icons/admin/144x144.png',
              sizes: '144x144',
              type: 'image/png'
            },
            {
              src: 'icons/admin/152x152.png',
              sizes: '152x152',
              type: 'image/png'
            },
            {
              src: 'icons/admin/192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icons/admin/384x384.png',
              sizes: '384x384',
              type: 'image/png'
            },
            {
              src: 'icons/admin/512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icons/admin/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          // Workbox options
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/i\.imghippo\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                }
              }
            },
            {
              urlPattern: /\.(?:js|css)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 2 // 2 days
                }
              }
            },
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: ({ url }) => {
                // Don't cache Supabase requests
                if (url.pathname.includes('supabase')) {
                  return false;
                }
                // Cache all other navigation requests
                return url.origin === self.location.origin;
              },
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            }
          ],
          // Skip waiting to update service worker immediately
          skipWaiting: true,
          clientsClaim: true,
          // Custom service worker
          swDest: 'dist/service-worker.js',
          inlineWorkboxRuntime: true
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html'
        }
      })
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ui-vendor': ['lucide-react', 'framer-motion'],
          },
        },
      },
    },
    define: {
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'process.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY),
    }
  };
});