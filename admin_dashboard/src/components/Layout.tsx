import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { WifiOff, Bell } from 'lucide-react'
import { useUI } from '../context/UIContext'
import { useAuth } from '../context/AuthContext'
import ParticleBackground from './ParticleBackground'
import CommandPalette from './CommandPalette'
import DeviceInspector from './DeviceInspector'

export default function Layout() {
    const { isDesktop, isOffline } = useUI()
    const { profile } = useAuth()
    // Theme is now enforced to dark mode globally via index.css and layout structure


    return (
        <div className="min-h-screen bg-[var(--bg-app)] text-slate-200 flex relative overflow-hidden selection:bg-cyan-500/30">
            {/* 3D Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <ParticleBackground />
            </div>

            {/* Sidebar (Desktop) */}
            <Sidebar />

            {/* Main Content Area */}
            <main className={`flex-1 transition-all duration-300 flex flex-col relative z-10 ${isDesktop ? 'ml-64' : 'mb-16'
                }`}>

                {/* Mobile Header - Glass Style */}
                {!isDesktop && (
                    <header className="sticky top-0 z-30 px-4 py-3 glass-panel border-b border-[var(--border-color)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20">
                                    {profile?.name?.charAt(0).toUpperCase() || 'E'}
                                </div>
                                <span className="font-bold text-white tracking-wide">Evara<span className="text-cyan-400">TDS</span></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="relative p-2 rounded-xl hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-cyan-400">
                                    <Bell className="h-5 w-5" />
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                </button>
                            </div>
                        </div>
                    </header>
                )}

                {/* Offline Banner */}
                {isOffline && (
                    <div className="bg-amber-500/10 text-amber-500 text-xs py-2 px-4 text-center flex justify-center items-center gap-2 backdrop-blur-sm border-b border-amber-500/20">
                        <WifiOff className="h-3 w-3" />
                        <span>Offline Mode - Showing cached data</span>
                    </div>
                )}

                <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in relative">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Nav (Mobile) */}
            <BottomNav />

            {/* Global Search */}
            <CommandPalette />

            {/* Persistent Inspector Panel */}
            <DeviceInspector />
        </div>
    )
}
