import React, { createContext, useContext, useEffect, useState } from 'react'
import { useViewport } from '../hooks/useViewport'

interface UIContextType {
    isMobile: boolean
    isTablet: boolean
    isDesktop: boolean
    isPWA: boolean
    isOffline: boolean
    toggleSidebar: () => void
    sidebarOpen: boolean
    inspectorDeviceId: string | null
    openInspector: (deviceId: string) => void
    closeInspector: () => void
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [inspectorDeviceId, setInspectorDeviceId] = useState<string | null>(null)
    const [isPWA, setIsPWA] = useState(() => 
        typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
    )
    const [isOffline, setIsOffline] = useState(!navigator.onLine)
    const [sidebarOpen, setSidebarOpen] = useState(true) // Initialized to true, effect will sync if needed
    
    // Use unified viewport hook for consistent device detection
    const { isMobile, isTablet, isDesktop } = useViewport()

    useEffect(() => {
        const handleOffline = () => setIsOffline(true)
        const handleOnline = () => setIsOffline(false)

        // PWA Check - already handled in state initializer, but we can keep the listener if display-mode can change
        // (usually it doesn't change without reload, but for safety:)
        const pwaMedia = window.matchMedia('(display-mode: standalone)')
        const handlePWAMatch = (e: MediaQueryListEvent) => setIsPWA(e.matches)
        pwaMedia.addEventListener('change', handlePWAMatch)

        window.addEventListener('offline', handleOffline)
        window.addEventListener('online', handleOnline)

        return () => {
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('online', handleOnline)
            pwaMedia.removeEventListener('change', handlePWAMatch)
        }
    }, [])
    
    const [prevIsDesktop, setPrevIsDesktop] = useState(isDesktop)
    if (isDesktop !== prevIsDesktop) {
        setPrevIsDesktop(isDesktop)
        setSidebarOpen(isDesktop)
    }

    const toggleSidebar = React.useCallback(() => setSidebarOpen(prev => !prev), [])

    const openInspector = React.useCallback((deviceId: string) => setInspectorDeviceId(deviceId), [])
    const closeInspector = React.useCallback(() => setInspectorDeviceId(null), [])

    const uiContextValue = React.useMemo(() => ({
        isMobile,
        isTablet,
        isDesktop,
        isPWA,
        isOffline,
        toggleSidebar,
        sidebarOpen,
        inspectorDeviceId,
        openInspector,
        closeInspector
    }), [
        isMobile,
        isTablet,
        isDesktop,
        isPWA,
        isOffline,
        toggleSidebar,
        sidebarOpen,
        inspectorDeviceId,
        openInspector,
        closeInspector
    ])

    return (
        <UIContext.Provider value={uiContextValue}>
            {children}
        </UIContext.Provider>
    )
}

export const useUI = () => {
    const context = useContext(UIContext)
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider')
    }
    return context
}
