import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { WifiOff, Bell } from 'lucide-react'
import { useUI } from '../context/UIContext'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
    const { isDesktop, isOffline } = useUI()
    const { profile } = useAuth()

    // Get greeting based on time of day
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 17) return 'Good afternoon'
        return 'Good evening'
    }

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] text-slate-100 flex relative">
            {/* Floating Background Elements */}
            <div className="floating-bg" />
            <div className="floating-orb" />

            {/* Sidebar (Desktop) */}
            <Sidebar />

            {/* Main Content Area */}
            <main className={`flex-1 transition-all duration-300 flex flex-col relative z-10 ${isDesktop ? 'ml-64' : 'mb-16'
                }`}>

                {/* Mobile Header */}
                {!isDesktop && (
                    <header className="h-16 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-white/5 flex items-center px-4 justify-between sticky top-0 z-30">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                {profile?.name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">{getGreeting()},</p>
                                <h1 className="text-sm font-semibold text-white">
                                    {profile?.name || 'Admin'}
                                </h1>
                            </div>
                        </div>
                        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                        </button>
                    </header>
                )}

                {/* Offline Banner */}
                {isOffline && (
                    <div className="bg-orange-500/10 text-orange-400 text-xs py-2 px-4 text-center border-b border-orange-500/20 flex justify-center items-center gap-2">
                        <WifiOff className="h-3 w-3" />
                        <span>Offline Mode - Showing cached data</span>
                    </div>
                )}

                <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Nav (Mobile) */}
            <BottomNav />
        </div>
    )
}
