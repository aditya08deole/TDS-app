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

import type { Permission } from '../context/RoleContext'

interface NavItem {
    label: string
    path: string
    icon: React.ComponentType<{ className?: string, strokeWidth?: number }>
    permission: Permission
}

const navItems: NavItem[] = [
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
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                    <Droplets className="h-5 w-5 fill-current" strokeWidth={2} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">
                        Evara<span className="text-primary font-normal">TDS</span>
                    </h1>
                </div>
            </div>

            {/* Navigation - macOS Control Panel Style */}
            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    if (item.permission && !hasPermission(item.permission)) return null

                    const Icon = item.icon
                    const isActive = item.path === '/'
                        ? (pathname === '/' || pathname === '/dashboard')
                        : pathname.startsWith(item.path)

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group ${isActive
                                ? 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                        >
                            <Icon
                                className={`h-5 w-5 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                                strokeWidth={item.path === '/' ? 1.5 : 1.75} // Subtle weight adjustment
                            />
                            <span className={`text-sm tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                {item.label}
                            </span>
                            {isActive && (
                                <div className="ml-auto w-1 h-1 rounded-full bg-primary shadow-[0_0_4px_currentColor]" />
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-border/40 space-y-2 glass-panel !bg-transparent">
                <Link
                    to="/settings"
                    className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group ${pathname === '/settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                >
                    <Settings className={`h-5 w-5 ${pathname === '/settings' ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                    <span className="font-medium text-sm">Settings</span>
                </Link>

                {/* User Profile - macOS Menu Style */}
                <div className="pt-3">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl glass-card border border-border/40 hover:bg-white/[0.05] transition-colors cursor-default group">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-600 to-slate-500 flex items-center justify-center text-xs font-bold text-white shadow-inner border border-white/10">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate transition-colors">
                                {user?.email?.split('@')[0] || 'Admin'}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                                {profile?.role === 'super_admin' ? 'Super Admin' : 'Administrator'}
                            </p>
                        </div>
                        <button
                            onClick={signOut}
                            className="p-1.5 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
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
