import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Map, Radio, Bell, LogOut, Settings, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'

export default function Sidebar() {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { signOut } = useAuth()
    const { isDesktop } = useUI()

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Map, label: 'Map', path: '/map' },
        { icon: Radio, label: 'Devices', path: '/devices' },
        { icon: Bell, label: 'Alerts', path: '/alerts' },
    ]

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    if (!isDesktop) return null

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-40 transition-transform duration-300">
            <div className="p-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    EvaraTDS
                </h1>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Enterprise Monitor</p>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.path
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/5'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Icon className={`h-5 w-5 ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-white'}`} />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t border-slate-800 space-y-2">
                <button className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                    <Settings className="h-5 w-5" />
                    <span className="font-medium">Settings</span>
                </button>
                <Link
                    to="/audit"
                    className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all ${pathname === '/audit' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/5' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                >
                    <Shield className={`h-5 w-5 ${pathname === '/audit' ? 'text-cyan-400' : 'text-slate-500 group-hover:text-white'}`} />
                    <span className="font-medium">Audit Log</span>
                </Link>
                <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Sign Out</span>
                </button>
            </div>
        </aside>
    )
}
