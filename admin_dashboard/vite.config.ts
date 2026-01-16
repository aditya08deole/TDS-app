import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
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
                screenshots: [
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        form_factor: 'wide'
                    }
                ],
                shortcuts: [
                    {
                        name: 'Dashboard',
                        short_name: 'Dashboard',
                        description: 'View system dashboard',
                        url: '/',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    },
                    {
                        name: 'Map View',
                        short_name: 'Map',
                        description: 'View device locations',
                        url: '/map',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    },
                    {
                        name: 'Devices',
                        short_name: 'Devices',
                        description: 'Manage devices',
                        url: '/devices',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    },
                    {
                        name: 'Alerts',
                        short_name: 'Alerts',
                        description: 'View active alerts',
                        url: '/alerts',
                        icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
                    }
                ],
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
    ]
})
