import React, { createContext, useContext, useEffect, useState } from 'react'

interface UIContextType {
    isMobile: boolean
    isTablet: boolean
    isDesktop: boolean
    isPWA: boolean
    isOffline: boolean
    toggleSidebar: () => void
    sidebarOpen: boolean
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [isMobile, setIsMobile] = useState(false)
    const [isTablet, setIsTablet] = useState(false)
    const [isDesktop, setIsDesktop] = useState(true)
    const [isPWA, setIsPWA] = useState(false)
    const [isOffline, setIsOffline] = useState(!navigator.onLine)
    const [sidebarOpen, setSidebarOpen] = useState(true)

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth
            setIsMobile(width < 768)
            setIsTablet(width >= 768 && width < 1024)
            setIsDesktop(width >= 1024)

            // Auto-close sidebar on mobile/tablet
            if (width < 1024) setSidebarOpen(false)
            else setSidebarOpen(true)
        }

        const handleOffline = () => setIsOffline(true)
        const handleOnline = () => setIsOffline(false)

        // Initial check
        handleResize()

        // PWA Check
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsPWA(true)
        }

        window.addEventListener('resize', handleResize)
        window.addEventListener('offline', handleOffline)
        window.addEventListener('online', handleOnline)

        return () => {
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('online', handleOnline)
        }
    }, [])

    const toggleSidebar = () => setSidebarOpen(prev => !prev)

    return (
        <UIContext.Provider value={{
            isMobile,
            isTablet,
            isDesktop,
            isPWA,
            isOffline,
            toggleSidebar,
            sidebarOpen
        }}>
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
