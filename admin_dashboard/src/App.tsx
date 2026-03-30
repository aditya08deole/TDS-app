import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import { AlertProvider } from './context/AlertContext'
import { RoleProvider } from './context/RoleContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import AuthGuard from './components/AuthGuard'
import ReloadPrompt from './components/ReloadPrompt'
import NotificationManager from './components/NotificationManager'
import { Toaster } from './components/ui/sonner'
import { initOfflineSync } from './lib/syncQueue'
import { initWebVitals } from './lib/webVitals'
import { initErrorTracking } from './lib/errorTracking'

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

// Safe error boundary that always shows something
function SafeErrorBoundary({ children }: { children: React.ReactNode }) {
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const handler = (event: ErrorEvent) => {
            console.error('SafeErrorBoundary caught error:', event.error);
            setError(event.message)
            event.preventDefault()
        }
        const rejectionHandler = (event: PromiseRejectionEvent) => {
            console.error('SafeErrorBoundary caught rejection:', event.reason);
            setError(String(event.reason))
            event.preventDefault()
        }
        window.addEventListener('error', handler)
        window.addEventListener('unhandledrejection', rejectionHandler)
        return () => {
            window.removeEventListener('error', handler)
            window.removeEventListener('unhandledrejection', rejectionHandler)
        }
    }, [])

    if (error) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center',
                justifyContent: 'center', backgroundColor: 'var(--background)', color: 'var(--foreground)',
                fontFamily: 'Inter, sans-serif', padding: '2rem', zIndex: 9999
            }}>
                <div style={{ maxWidth: '600px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '1rem' }}>Runtime Error Caught</h1>
                    <pre style={{
                        backgroundColor: 'var(--secondary)', padding: '1rem', borderRadius: '0.5rem',
                        textAlign: 'left', fontSize: '0.8rem', overflow: 'auto', color: 'var(--primary)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all', border: '1px solid var(--accent)'
                    }}>{error}</pre>
                    <button onClick={() => window.location.reload()} style={{
                        marginTop: '1rem', padding: '0.5rem 1.5rem', backgroundColor: 'var(--primary)',
                        border: 'none', borderRadius: '0.5rem', color: 'var(--primary-foreground)', cursor: 'pointer'
                    }}>Reload System</button>
                    <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                        Please share this error message with the developer.
                    </p>
                </div>
            </div>
        )
    }

    return <>{children}</>
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

    return <>{children}</>
}

function App() {
    return (
        <SafeErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                    <BrowserRouter>
                        <UIProvider>
                                        <AlertProvider>
                            <AuthProvider>
                                <RoleProvider>
                                    <AppWrapper>
                                        <Routes>
                                            {/* Public Routes */}
                                            <Route path="/login" element={<Login />} />

                                            {/* Protected Routes - Wrapped with AuthGuard */}
                                            <Route element={<AuthGuard />}>
                                                <Route path="/" element={<Layout />}>
                                                    <Route index element={
                                                        <Suspense fallback={<PageLoader />}>
                                                            <Dashboard />
                                                        </Suspense>
                                                    } />
                                                    <Route path="map" element={
                                                        <Suspense fallback={<PageLoader />}>
                                                            <MapPage />
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
                                                            <AuthGuard requiredRole="admin">
                                                                <ScanDevice />
                                                            </AuthGuard>
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
                                            </Route>
                                        </Routes>
                                        <ReloadPrompt />
                                        <NotificationManager />
                                    </AppWrapper>
                                </RoleProvider>
                            </AuthProvider>
                                        </AlertProvider>
                        </UIProvider>
                    </BrowserRouter>
                    <Toaster richColors position="top-right" />
                </ThemeProvider>
                <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
        </SafeErrorBoundary>
    )
}

export default App
