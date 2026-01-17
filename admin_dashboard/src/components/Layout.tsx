import { Outlet } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './AppSidebar'
import { TopBar } from './TopBar'
import ParticleBackground from './ParticleBackground'
import CommandPalette from './CommandPalette'
import DeviceInspector from './DeviceInspector'
import { Toaster } from '@/components/ui/sonner'

export default function Layout() {
    return (
        <SidebarProvider>
            {/* 3D Background - Fixed at z-0, behind everything */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <ParticleBackground />
            </div>

            <AppSidebar />

            <SidebarInset className="relative z-10 bg-transparent flex flex-col transition-all duration-300">
                <TopBar />
                <main className="flex-1 overflow-auto p-4 lg:p-6 animate-fade-in relative">
                    <Outlet />
                </main>
            </SidebarInset>

            {/* Global Overlays */}
            <CommandPalette />
            <DeviceInspector />
            <Toaster />
        </SidebarProvider>
    )
}
