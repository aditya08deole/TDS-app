import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { WifiOff, Moon, Sun, Bell } from 'lucide-react'
import { useUI } from '../context/UIContext'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Layout() {
    const { isDesktop, isOffline } = useUI()
    const { profile } = useAuth()
    const { setTheme, resolvedTheme } = useTheme()

    return (
        <div className={`min-h-screen bg-[var(--bg)] text-[var(--text-primary)] flex relative ${resolvedTheme === 'light' ? 'light' : ''}`}>
            {/* Sidebar (Desktop) */}
            <Sidebar />

            {/* Main Content Area */}
            <main className={`flex-1 transition-all duration-300 flex flex-col relative z-10 ${isDesktop ? 'ml-64' : 'mb-16'
                }`}>

                {/* Mobile Header - iOS Style */}
                {!isDesktop && (
                    <header className="ios-header sticky top-0 z-30 px-4 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                                    {profile?.name?.charAt(0).toUpperCase() || 'A'}
                                </div>
                                <span className="font-semibold text-[var(--text-primary)]">EvaraTDS</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Theme Toggle */}
                                <button
                                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                                    className="p-2 rounded-full hover:bg-[var(--card)] transition-colors"
                                >
                                    {resolvedTheme === 'dark' ? (
                                        <Sun className="h-5 w-5 text-[var(--text-secondary)]" />
                                    ) : (
                                        <Moon className="h-5 w-5 text-[var(--text-secondary)]" />
                                    )}
                                </button>
                                {/* Notifications */}
                                <button className="relative p-2 rounded-full hover:bg-[var(--card)] transition-colors">
                                    <Bell className="h-5 w-5 text-[var(--text-secondary)]" />
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--danger)] rounded-full" />
                                </button>
                            </div>
                        </div>
                    </header>
                )}

                {/* Offline Banner */}
                {isOffline && (
                    <div className="bg-[var(--warning)]/10 text-[var(--warning)] text-xs py-2 px-4 text-center flex justify-center items-center gap-2">
                        <WifiOff className="h-3 w-3" />
                        <span>Offline Mode - Showing cached data</span>
                    </div>
                )}

                <div className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full animate-fade-in">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Nav (Mobile) */}
            <BottomNav />
        </div>
    )
}
