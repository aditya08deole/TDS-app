import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"
import fs from "fs"
import type { Plugin } from 'vite'

// Fix #2: Dev-time Service Worker env injection middleware.
// In production, closeBundle() injects values. In dev, this middleware serves
// the SW with real env values so background push works without building first.
function swEnvInjectionPlugin(env: Record<string, string>): Plugin {
    return {
        name: 'sw-env-injection',
        configureServer(server) {
            server.middlewares.use('/firebase-messaging-sw.js', (req, res, next) => {
                const swPath = path.resolve(__dirname, 'public/firebase-messaging-sw.js');
                if (!fs.existsSync(swPath)) { next(); return; }
                let content = fs.readFileSync(swPath, 'utf8');
                const placeholders: Record<string, string> = {
                    '__FIREBASE_API_KEY__': env.VITE_FIREBASE_API_KEY || '',
                    '__FIREBASE_AUTH_DOMAIN__': env.VITE_FIREBASE_AUTH_DOMAIN || '',
                    '__FIREBASE_PROJECT_ID__': env.VITE_FIREBASE_PROJECT_ID || '',
                    '__FIREBASE_STORAGE_BUCKET__': env.VITE_FIREBASE_STORAGE_BUCKET || '',
                    '__FIREBASE_MESSAGING_SENDER_ID__': env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
                    '__FIREBASE_APP_ID__': env.VITE_FIREBASE_APP_ID || '',
                    '__FIREBASE_MEASUREMENT_ID__': env.VITE_FIREBASE_MEASUREMENT_ID || '',
                };
                Object.entries(placeholders).forEach(([k, v]) => { content = content.split(k).join(v); });
                // Fix #15: Explicitly set SW scope to root via header
                res.setHeader('Content-Type', 'application/javascript');
                res.setHeader('Service-Worker-Allowed', '/');
                res.end(content);
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
        server: {
            port: 8080,
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        plugins: [
            react(),
            // Fix #2: Dev middleware for SW env injection
            swEnvInjectionPlugin(env),
            {
                name: 'inject-sw-config',
                closeBundle() {
                    // Fix #2: Inject env vars into the copied SW file at build time
                    const swPath = path.resolve(__dirname, 'dist/firebase-messaging-sw.js');
                    if (!fs.existsSync(swPath)) {
                        console.warn('⚠️  dist/firebase-messaging-sw.js not found — SW env injection skipped.');
                        return;
                    }
                    let content = fs.readFileSync(swPath, 'utf8');
                    const placeholders: Record<string, string> = {
                        '__FIREBASE_API_KEY__': env.VITE_FIREBASE_API_KEY || '',
                        '__FIREBASE_AUTH_DOMAIN__': env.VITE_FIREBASE_AUTH_DOMAIN || '',
                        '__FIREBASE_PROJECT_ID__': env.VITE_FIREBASE_PROJECT_ID || '',
                        '__FIREBASE_STORAGE_BUCKET__': env.VITE_FIREBASE_STORAGE_BUCKET || '',
                        '__FIREBASE_MESSAGING_SENDER_ID__': env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
                        '__FIREBASE_APP_ID__': env.VITE_FIREBASE_APP_ID || '',
                        '__FIREBASE_MEASUREMENT_ID__': env.VITE_FIREBASE_MEASUREMENT_ID || '',
                    };
                    const missing = Object.entries(placeholders).filter(([, v]) => !v).map(([k]) => k);
                    if (missing.length > 0) {
                        console.warn('⚠️  Missing env vars for SW injection:', missing.join(', '));
                    }
                    Object.entries(placeholders).forEach(([placeholder, value]) => {
                        content = content.split(placeholder).join(value);
                    });
                    fs.writeFileSync(swPath, content);
                    console.log('✅ Injected environment variables into firebase-messaging-sw.js');
                }
            },
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'Ev-Logo.png'],
                workbox: {
                    // Force new service workers to activate immediately on all tabs.
                    // Without these, the old cached version keeps serving until ALL tabs are closed.
                    // With these, a new Railway deployment is reflected to users within seconds.
                    skipWaiting: true,
                    clientsClaim: true,
                    // Increase cache limit to handle large Dashboard bundle
                    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MB
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                    runtimeCaching: [
                        {
                            // Firebase/Firestore API caching
                            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'firebase-api-cache',
                                expiration: {
                                    maxEntries: 100,
                                    maxAgeSeconds: 60 * 60 // 1 hour
                                },
                                cacheableResponse: {
                                    statuses: [0, 200]
                                }
                            }
                        },
                        {
                            // ThingSpeak API caching
                            urlPattern: /^https:\/\/api\.thingspeak\.com\/.*/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'thingspeak-api-cache',
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 15 // 15 seconds (matches polling)
                                },
                                cacheableResponse: {
                                    statuses: [0, 200]
                                }
                            }
                        },
                        {
                            // Images and static assets
                            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'images-cache',
                                expiration: {
                                    maxEntries: 60,
                                    maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
                                }
                            }
                        }
                    ]
                },
                manifest: {
                    name: 'EvaraTDS Dashboard',
                    short_name: 'EvaraTDS',
                    description: 'Professional water quality monitoring for infrastructure',
                    theme_color: '#0a0c10',
                    background_color: '#0a0c10',
                    display: 'standalone',
                    orientation: 'portrait',
                    scope: '/',
                    start_url: '/',
                    categories: ['utilities', 'productivity'],
                    icons: [
                        {
                            src: 'pwa-192x192.png',
                            sizes: '192x192',
                            type: 'image/png'
                        },
                        {
                            src: 'pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png'
                        },
                        {
                            src: 'pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'maskable'
                        }
                    ]
                }
            })
        ],
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        // React core libraries
                        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                        // Chart library (large dependency)
                        'charts-vendor': ['recharts'],
                        // ECharts (replaced Plotly)
                        'echarts-vendor': ['echarts', 'echarts-for-react'],
                        // UI component libraries
                        'ui-vendor': [
                            '@radix-ui/react-tabs',
                            '@radix-ui/react-select',
                            '@radix-ui/react-dialog',
                            '@radix-ui/react-dropdown-menu',
                            '@radix-ui/react-slot',
                            '@radix-ui/react-label'
                        ],
                        // Map libraries
                        'map-vendor': ['leaflet', 'react-leaflet'],
                        // State management and data fetching
                        'query-vendor': ['@tanstack/react-query']
                    },
                    // Ensure consistent hashing for cache busting
                    entryFileNames: 'assets/[name].[hash].js',
                    chunkFileNames: 'assets/[name].[hash].js',
                    assetFileNames: 'assets/[name].[hash].[ext]'
                }
            },
            // Increase chunk size warning limit to 1000 kB
            chunkSizeWarningLimit: 1000
        }
    }
})
