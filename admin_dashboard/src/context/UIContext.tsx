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
    const [isPWA, setIsPWA] = useState(false)
    const [isOffline, setIsOffline] = useState(!navigator.onLine)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    
    // Use unified viewport hook for consistent device detection
    const { isMobile, isTablet, isDesktop } = useViewport()

    useEffect(() => {
        const handleOffline = () => setIsOffline(true)
        const handleOnline = () => setIsOffline(false)

        // PWA Check
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsPWA(true)
        }

        window.addEventListener('offline', handleOffline)
        window.addEventListener('online', handleOnline)

        return () => {
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('online', handleOnline)
        }
    }, [])
    
    // Auto-close sidebar on mobile/tablet when device type changes
    useEffect(() => {
        if (!isDesktop) {
            setSidebarOpen(false)
        } else {
            setSidebarOpen(true)
        }
    }, [isDesktop])

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
