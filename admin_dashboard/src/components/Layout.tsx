import { Outlet, useLocation } from 'react-router-dom'

import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import PremiumBackground from './PremiumBackground'
import CommandPalette from './CommandPalette'
import DeviceInspector from './DeviceInspector'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import { useViewport } from '../hooks/useViewport'

export default function Layout() {
    const location = useLocation()
    const { isPortrait, isLandscape, isDesktop } = useViewport()
    const isMapPage = location.pathname === '/map'

    return (
        <div className="min-h-dvh bg-transparent flex flex-col">
            {/* Premium Three.js + Anime atmosphere */}
            <PremiumBackground />

            {/* Unified Top Navigation Header (Desktop Only) */}
            <div className="hidden md:block">
                <TopBar />
            </div>

            {/* Mobile Bottom Navigation Bar (Mobile Only) */}
            <div className="md:hidden">
                <MobileNav />
            </div>

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 overflow-auto animate-fade-in relative z-10 transition-all duration-500",
                // Map page: no top padding, bottom padding for MobileNav on mobile
                isMapPage 
                    ? "pb-0 md:pb-0 pt-safe" 
                    : cn(
                        // Desktop: use TopBar height offset
                        isDesktop && "pt-28 pb-8",
                        // Landscape phone: reduce vertical padding
                        isLandscape && !isDesktop && "pt-16 pb-16 px-8",
                        // Portrait phone: safe area top avoids notch, pb-28 avoids bottom nav
                        isPortrait && !isDesktop && "pt-safe pb-28 px-0"
                    )
            )}>
                <Outlet />
            </main>

            {/* Global Overlays */}
            <CommandPalette />
            <DeviceInspector />
            <Toaster />
        </div>
    )
}

