import { Outlet, useLocation } from 'react-router-dom'

import { TopBar } from './TopBar'
import { MobileNav } from './MobileNav'
import PremiumBackground from './PremiumBackground'
import CommandPalette from './CommandPalette'
import DeviceInspector from './DeviceInspector'
import { cn } from '@/lib/utils'
import { useViewport } from '../hooks/useViewport'

export default function Layout() {
    const location = useLocation()
    const { isPortrait, isLandscape, isDesktop } = useViewport()
    const isMapPage = location.pathname === '/map'

    return (
        <div className={cn("bg-transparent flex flex-col", isMapPage ? "h-dvh overflow-hidden" : "min-h-dvh")}>
            {/* Premium Three.js + Anime atmosphere */}
            <PremiumBackground />

            {/* Unified Top Navigation Header (Desktop Only) */}
            <div className="hidden md:block z-[1000] relative">
                <TopBar />
            </div>

            {/* Mobile Bottom Navigation Bar (Mobile Only) */}
            <div className="md:hidden">
                <MobileNav />
            </div>

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 relative z-10 transition-all duration-500",
                isMapPage 
                    ? "p-0 m-0 h-full w-full overflow-hidden flex flex-col fixed inset-0 max-h-screen" 
                    : "overflow-auto animate-fade-in " + cn(
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
        </div>
    )
}

