import { Outlet, useLocation } from 'react-router-dom'

import { TopBar } from './TopBar'
import PremiumBackground from './PremiumBackground'
import CommandPalette from './CommandPalette'
import DeviceInspector from './DeviceInspector'
import { Toaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

export default function Layout() {
    const location = useLocation()
    const isMapPage = location.pathname === '/map'

    return (
        <div className="min-h-screen bg-transparent flex flex-col">
            {/* Premium Three.js + Anime atmosphere */}
            <PremiumBackground />

            {/* Unified Top Navigation Header */}
            <TopBar />

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 overflow-auto animate-fade-in relative z-10",
                isMapPage ? "pt-0" : "p-4 lg:p-6 lg:pt-32 pt-32"
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
