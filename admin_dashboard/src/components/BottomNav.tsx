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
        <nav className="ios-nav fixed bottom-0 left-0 right-0 h-16 flex justify-around items-center z-50 pb-safe">
            {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.path
                const isCenter = item.path === '/'

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`ios-nav-item relative flex flex-col items-center justify-center px-3 py-1 ${isActive ? 'active' : 'text-[var(--text-tertiary)]'
                            }`}
                    >
                        {isCenter ? (
                            <div className={`p-3 rounded-full -mt-6 ${isActive
                                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30'
                                : 'bg-[var(--card)] text-[var(--text-secondary)]'
                                }`}>
                                <Icon className="h-5 w-5" />
                            </div>
                        ) : (
                            <>
                                <Icon className="h-5 w-5" />
                                <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                            </>
                        )}
                    </Link>
                )
            })}
        </nav>
    )
}
