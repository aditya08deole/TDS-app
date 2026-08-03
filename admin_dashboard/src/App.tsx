import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
// Fix #33: ReactQueryDevtools guarded by import.meta.env.DEV — excluded from prod builds
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import { AlertProvider } from './context/AlertContext'
import { RoleProvider } from './context/RoleContext'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationProvider } from './context/NotificationContext'
import { GlassEffectProvider } from './components/GlassEffectProvider'
import Layout from './components/Layout'
import Login from './pages/Login'
import AuthGuard from './components/AuthGuard'
import ReloadPrompt from './components/ReloadPrompt'
import NotificationManager from './components/NotificationManager'
import { OfflineBadge, OnlineIndicator } from './components/OfflineBadge'
import { Toaster } from './components/ui/sonner'
import { initOfflineSync } from './lib/syncQueue'
import { initWebVitals } from './lib/webVitals'
import { initErrorTracking } from './lib/errorTracking'
import { useNotifications } from './hooks/useNotifications'

import { MapPageWrapper, MapPageErrorBoundary } from './components/MapPageWrapper'

// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MapPage = lazy(() => import('./pages/MapPage'))
const DeviceList = lazy(() => import('./pages/Devices'))
const Alerts = lazy(() => import('./pages/Alerts'))
const ScanDevice = lazy(() => import('./pages/ScanDevice'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Users = lazy(() => import('./pages/Users'))

// Loading Component
const PageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
)

import { ErrorBoundary } from 'react-error-boundary'

// Fallback Component for Error Boundary
const ErrorFallback = ({ error, resetErrorBoundary }: { error: unknown, resetErrorBoundary: () => void }) => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center',
            justifyContent: 'center', backgroundColor: '#05070a', color: '#fff',
            fontFamily: 'Inter, sans-serif', padding: '2rem', zIndex: 9999
        }}>
            <div style={{ maxWidth: '600px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '1rem' }}>System Runtime Error</h1>
                <pre style={{
                    backgroundColor: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem',
                    textAlign: 'left', fontSize: '0.8rem', overflow: 'auto', color: '#cbd5e1',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all', border: '1px solid rgba(255,255,255,0.1)'
                }}>{errorMessage}</pre>
                <button onClick={resetErrorBoundary} style={{
                    marginTop: '1.5rem', padding: '0.6rem 2rem', backgroundColor: '#3b82f6',
                    border: 'none', borderRadius: '0.5rem', color: '#fff', cursor: 'pointer',
                    fontWeight: '600'
                }}>Restart System</button>
            </div>
        </div>
    )
}

// App Wrapper to initialize offline sync and monitoring
function AppWrapper({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        try {
            console.log('🚀 Initializing system services...')
            const cleanup = initOfflineSync()
            initWebVitals()
            initErrorTracking()
            return cleanup
        } catch (err) {
            console.error('AppWrapper init error:', err)
        }
    }, [])

    // Initialize FCM Web Push
    useNotifications()

    return <>{children}</>
}

// Note: 'motion' from dependencies is actually framer-motion

function RoutesWrapper() {
    return (
        <Routes>
            <Route path="/login" element={
                <Suspense fallback={<PageLoader />}>
                    <Login />
                </Suspense>
            } />
            <Route path="/" element={
                <Suspense fallback={<PageLoader />}>
                    <AuthGuard>
                        <Layout />
                    </AuthGuard>
                </Suspense>
            }>
                <Route index element={<Dashboard />} />
                <Route path="map" element={
                    <Suspense fallback={<PageLoader />}>
                        <MapPageErrorBoundary>
                            <MapPageWrapper>
                                <MapPage />
                            </MapPageWrapper>
                        </MapPageErrorBoundary>
                    </Suspense>
                } />
                <Route path="devices" element={
                    <Suspense fallback={<PageLoader />}>
                        <DeviceList />
                    </Suspense>
                } />
                <Route path="alerts" element={
                    <Suspense fallback={<PageLoader />}>
                        <Alerts />
                    </Suspense>
                } />
                <Route path="scan" element={
                    <Suspense fallback={<PageLoader />}>
                        <ScanDevice />
                    </Suspense>
                } />
                <Route path="audit" element={
                    <Suspense fallback={<PageLoader />}>
                        <AuthGuard requiredRole="admin">
                            <AuditLog />
                        </AuthGuard>
                    </Suspense>
                } />
                <Route path="reports" element={
                    <Suspense fallback={<PageLoader />}>
                        <Reports />
                    </Suspense>
                } />
                <Route path="users" element={
                    <Suspense fallback={<PageLoader />}>
                        <AuthGuard requiredRole="admin">
                            <Users />
                        </AuthGuard>
                    </Suspense>
                } />
                <Route path="settings" element={
                    <Suspense fallback={<PageLoader />}>
                        <Settings />
                    </Suspense>
                } />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

function App() {
    return (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <BrowserRouter>
                        <UIProvider>
                            <AlertProvider>
                                <AuthProvider>
                                    <RoleProvider>
                                        <NotificationProvider>
                                            <GlassEffectProvider>
                                                <AppWrapper>
                                                    <RoutesWrapper />
                                                    <ReloadPrompt />
                                                    <NotificationManager />
                                                    <OfflineBadge />
                                                    <OnlineIndicator />
                                                </AppWrapper>
                                            </GlassEffectProvider>
                                        </NotificationProvider>
                                    </RoleProvider>
                                </AuthProvider>
                            </AlertProvider>
                        </UIProvider>
                    </BrowserRouter>
                    <Toaster richColors position="top-right" />
                </ThemeProvider>
                {/* Fix #33: Only render devtools in development mode */}
                {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
            </QueryClientProvider>
        </ErrorBoundary>
    )
}

export default App
