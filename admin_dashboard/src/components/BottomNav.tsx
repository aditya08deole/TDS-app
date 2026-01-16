import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Map, Radio, Bell, Settings } from 'lucide-react'
import { useUI } from '../context/UIContext'

export default function BottomNav() {
    const { pathname } = useLocation()
    const { isMobile } = useUI()

    const navItems = [
        { icon: LayoutDashboard, label: 'Home', path: '/' },
        { icon: Map, label: 'Map', path: '/map' },
        { icon: Radio, label: 'Devices', path: '/devices' },
        { icon: Bell, label: 'Alerts', path: '/alerts' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ]

    if (!isMobile) return null

    return (
        <nav className="bottom-nav fixed bottom-0 left-0 right-0 h-16 flex justify-around items-center z-50 px-2 pb-safe">
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.path
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`bottom-nav-item relative flex flex-col items-center justify-center w-full h-full space-y-1 pressable ${isActive ? 'active' : 'text-slate-500'
                            }`}
                    >
                        <div className={`p-2 rounded-xl transition-all ${isActive
                            ? 'bg-cyan-500/15 scale-110'
                            : 'bg-transparent hover:bg-white/5'
                            }`}>
                            <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-cyan-400' : ''}`} />
                        </div>
                        <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-cyan-400' : ''}`}>
                            {item.label}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
