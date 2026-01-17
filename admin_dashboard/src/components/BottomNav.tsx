import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Map, Radio, Bell, Settings } from 'lucide-react'
import { useUI } from '../context/UIContext'

export default function BottomNav() {
    const { pathname } = useLocation()
    const { isMobile } = useUI()

    const navItems = [
        { icon: Map, label: 'Map', path: '/map' },
        { icon: Radio, label: 'Devices', path: '/devices' },
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Bell, label: 'Alerts', path: '/alerts' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ]

    if (!isMobile) return null

    return (
        <nav className="glass-panel fixed bottom-0 left-0 right-0 h-[calc(60px+env(safe-area-inset-bottom))] pb-safe flex justify-around items-center z-50 border-t border-white/10">
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.path
                const isCenter = item.path === '/'

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`relative flex flex-col items-center justify-center w-full h-full transition-colors duration-200 ${isActive ? 'text-[#0a84ff]' : 'text-[#86868b] hover:text-[#f5f5f7]'
                            }`}
                    >
                        {isCenter ? (
                            <div className={`p-3 rounded-full -mt-8 shadow-lg transition-transform duration-200 ${isActive
                                    ? 'bg-[#0a84ff] text-white shadow-[0_4px_15px_rgba(10,132,255,0.4)] transform scale-105'
                                    : 'bg-[#1c1c1e] text-[#86868b] border border-white/10'
                                }`}>
                                <Icon className="h-6 w-6" strokeWidth={2} />
                            </div>
                        ) : (
                            <>
                                <Icon className={`h-6 w-6 transition-transform duration-200 ${isActive ? 'transform scale-105' : ''}`} strokeWidth={1.5} />
                                <span className="text-[10px] mt-1 font-medium tracking-tight">
                                    {item.label}
                                </span>
                            </>
                        )}
                    </Link>
                )
            })}
        </nav>
    )
}
