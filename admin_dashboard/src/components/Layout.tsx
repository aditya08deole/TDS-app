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
                    ? "pt-0 pb-0 md:pb-0" 
                    : cn(
                        isLandscape && !isDesktop 
                            ? "pt-20 pb-16 px-8" 
                            : "pt-32 pb-28 md:pt-32 lg:pt-32 md:pb-8",
                        isPortrait && !isDesktop && "px-4"
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

