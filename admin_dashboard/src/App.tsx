import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import Layout from './components/Layout'
import Login from './pages/Login'
// import AuthGuard from './components/AuthGuard' // Unused currently
import ReloadPrompt from './components/ReloadPrompt'
import NotificationManager from './components/NotificationManager'
import { ErrorBoundary } from './components/ErrorBoundary'

// Lazy Load Pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MapPage = lazy(() => import('./pages/MapPage'))
const DeviceList = lazy(() => import('./pages/Devices'))
const Alerts = lazy(() => import('./pages/Alerts'))
const ScanDevice = lazy(() => import('./pages/ScanDevice'))
const AuditLog = lazy(() => import('./pages/AuditLog'))

// Loading Component
const PageLoader = () => (
    <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
    </div>
)

function App() {
    return (
        <ErrorBoundary>
            <BrowserRouter>
                <UIProvider>
                    <AuthProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />

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
                                <Route path="alert" element={
                                    <Suspense fallback={<PageLoader />}>
                                        <Alerts />
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
                                        <AuditLog />
                                    </Suspense>
                                } />
                            </Route>

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                        <ReloadPrompt />
                        <NotificationManager />
                    </AuthProvider>
                </UIProvider>
            </BrowserRouter>
        </ErrorBoundary>
    )
}

export default App
