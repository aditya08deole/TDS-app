import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from "path"

export default defineConfig({
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
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            workbox: {
                // Increase cache limit to handle large Dashboard bundle
                maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MB
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        // Supabase API caching
                        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-api-cache',
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
                name: 'EvaraTDS - Water Quality Monitor',
                short_name: 'EvaraTDS',
                description: 'Real-time water quality monitoring and infrastructure management system',
                theme_color: '#0f172a',
                background_color: '#0f172a',
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
                    // Plotly (very large - 3MB+)
                    'plotly-vendor': ['plotly.js', 'react-plotly.js'],
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
})
