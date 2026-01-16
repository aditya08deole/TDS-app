import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { WifiOff } from 'lucide-react'
import { useUI } from '../context/UIContext'

export default function Layout() {
    const { isDesktop, isOffline } = useUI()

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
            {/* Sidebar (Desktop) */}
            <Sidebar />

            {/* Main Content Area */}
            <main className={`flex-1 transition-all duration-300 flex flex-col relative ${isDesktop ? 'ml-64' : 'mb-16' /* Bottom Nav spacing */
                }`}>

                {/* Mobile Header */}
                {!isDesktop && (
                    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex items-center px-4 justify-between sticky top-0 z-30">
                        <div className="flex items-center gap-3">
                            {/* <button onClick={toggleSidebar} className="p-2 -ml-2 text-slate-400">
                                <Menu className="h-6 w-6" />
                            </button> */}
                            <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                EvaraTDS
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* User avatar or notificatons could go here */}
                        </div>
                    </header>
                )}

                {/* Offline Banner */}
                {isOffline && (
                    <div className="bg-slate-800 text-slate-300 text-xs py-1 px-4 text-center border-b border-slate-700 flex justify-center items-center gap-2">
                        <WifiOff className="h-3 w-3" />
                        <span>Offline Mode - Showing cached data</span>
                    </div>
                )}

                <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
                    <Outlet />
                </div>
            </main>

            {/* Bottom Nav (Mobile) */}
            <BottomNav />
        </div>
    )
}
