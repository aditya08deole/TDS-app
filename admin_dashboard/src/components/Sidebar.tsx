import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Map as MapIcon,
    Bell,
    Settings,
    LogOut,
    Droplets,
    FileText,
    ShieldCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { useRole } from '../context/RoleContext'

const navItems = [
    { label: 'Map View', path: '/map', icon: MapIcon, permission: 'view_map' },
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'view_dashboard' },
    { label: 'Reports', path: '/reports', icon: FileText, permission: 'view_dashboard' }, // Assuming dashboard permission covers reports
    { label: 'Alerts & Logs', path: '/alerts', icon: Bell, permission: 'view_alerts' },
    { label: 'Audit Trail', path: '/audit', icon: ShieldCheck, permission: 'view_audit' },
]

export default function Sidebar() {
    const { pathname } = useLocation()
    const { signOut, user, profile } = useAuth()
    const { isDesktop } = useUI()
    const { hasPermission } = useRole()

    if (!isDesktop) return null

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 glass-panel flex flex-col z-40 transition-transform duration-300">
            {/* Branding - Minimal & Clean */}
            <div className="p-6 flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <Droplets className="h-5 w-5 fill-current" strokeWidth={2} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight leading-none">
                        Evara<span className="text-cyan-400 font-normal">TDS</span>
                    </h1>
                </div>
            </div>

            {/* Navigation - macOS Control Panel Style */}
            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    if (item.permission && !hasPermission(item.permission as any)) return null

                    const Icon = item.icon
                    const isActive = item.path === '/'
                        ? (pathname === '/' || pathname === '/dashboard')
                        : pathname.startsWith(item.path)

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group ${isActive
                                ? 'bg-blue-500/10 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                                }`}
                        >
                            <Icon
                                className={`h-5 w-5 transition-colors duration-300 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                                strokeWidth={item.path === '/' ? 1.5 : 1.75} // Subtle weight adjustment
                            />
                            <span className={`text-sm tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="ml-auto w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_4px_currentColor]" />
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-white/5 space-y-2 bg-black/20 backdrop-blur-md">
                <Link
                    to="/settings"
                    className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group ${pathname === '/settings' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                        }`}
                >
                    <Settings className={`h-5 w-5 ${pathname === '/settings' ? 'text-blue-400' : 'text-slate-500'}`} strokeWidth={1.5} />
                    <span className="font-medium text-sm">Settings</span>
                </Link>

                {/* User Profile - macOS Menu Style */}
                <div className="pt-3">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-default group">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-white shadow-inner border border-white/10">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                                {user?.email?.split('@')[0] || 'Admin'}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                                {profile?.role === 'super_admin' ? 'Super Admin' : 'Administrator'}
                            </p>
                        </div>
                        <button
                            onClick={signOut}
                            className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    )
}
