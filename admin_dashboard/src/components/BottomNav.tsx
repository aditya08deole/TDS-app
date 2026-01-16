import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Map, Radio, Bell } from 'lucide-react'
import { useUI } from '../context/UIContext'

export default function BottomNav() {
    const { pathname } = useLocation()
    const { isMobile } = useUI()

    const navItems = [
        { icon: LayoutDashboard, label: 'Home', path: '/' },
        { icon: Map, label: 'Map', path: '/map' },
        { icon: Radio, label: 'Devices', path: '/devices' },
        { icon: Bell, label: 'Alerts', path: '/alerts' },
    ]

    if (!isMobile) return null

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex justify-around items-center z-50 px-2 pb-safe">
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.path
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-cyan-400' : 'text-slate-500'
                            }`}
                    >
                        <div className={`p-1.5 rounded-full transition-all ${isActive ? 'bg-cyan-500/10' : 'bg-transparent'
                            }`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
