"use client"
import { Bell, AlertTriangle, MoreVertical, LayoutDashboard, Map as MapIcon, Smartphone, FileText, Settings, ShieldCheck, Users as UsersIcon, LogOut } from "lucide-react"
import { ThemeToggle } from "./ThemeToggle"
import { Button } from "@/components/ui/button"
import { useAlerts } from "../context/AlertContext"
import { useAuth } from "../context/AuthContext"
import { useRole } from "@/context/RoleContext"
import { useState, useEffect } from "react"
import { getDeviceDisplayName } from "../lib/constants"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function TopBar() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, profile, signOut } = useAuth()
    const { hasPermission, role } = useRole()
    const { alertCount, criticalDevices } = useAlerts()
    const [blinking, setBlinking] = useState(false)
    const [alertOpen, setAlertOpen] = useState(false)

    // Nav Links for the main header
    const mainLinks = [
        { title: "Overview", url: "/", icon: LayoutDashboard },
        { title: "Map View", url: "/map", icon: MapIcon },
        { title: "Devices", url: "/devices", icon: Smartphone },
    ]

    // More Links for the dropdown
    const moreLinks = [
        { title: "Alerts", url: "/alerts", icon: AlertTriangle },
        { title: "Reports", url: "/reports", icon: FileText },
        { title: "Manage Users", url: "/users", icon: UsersIcon, permission: "manage_users" },
        { title: "Audit Log", url: "/audit", icon: ShieldCheck, permission: "view_audit" },
        { title: "Settings", url: "/settings", icon: Settings },
    ]

    // Blink badge every 3 seconds when there are alerts
    useEffect(() => {
        if (alertCount === 0) { setBlinking(false); return }
        const interval = setInterval(() => setBlinking(b => !b), 3000)
        return () => clearInterval(interval)
    }, [alertCount])

    return (
        <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex h-16 w-auto min-w-[72%] max-w-[95%] items-center gap-8 px-6 glass-nav-unified shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2.25rem]">
            {/* Logo Section */}
            <Link to="/" className="flex items-center gap-3.5 hover:opacity-80 transition-opacity shrink-0">
                <img src="/pwa-512x512.png" alt="EvaraTDS" className="size-10 rounded-2xl shadow-inner" />
                <div className="flex flex-col">
                    <span className="text-[15px] font-bold tracking-tight text-foreground leading-none">EvaraTDS</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold leading-none mt-1">Water Systems</span>
                </div>
            </Link>

            <nav className="flex items-center gap-1 ml-2">
                {mainLinks.map((link) => (
                    <div key={link.url}>
                        <Link
                            to={link.url}
                            className={cn(
                                "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[15px] font-bold transition-all duration-300 border-transparent border",
                                location.pathname === link.url 
                                    ? "glass-system-active" 
                                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                            )}
                        >
                            <link.icon className="size-[18px]" strokeWidth={2.5} />
                            <span>{link.title}</span>
                        </Link>
                    </div>
                ))}

                {/* More Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[15px] font-bold text-muted-foreground hover:text-foreground hover:glass-system-child hover:border-white/10 h-auto transition-all outline-none border border-transparent"
                        >
                            <MoreVertical className="size-[18px]" strokeWidth={2.5} />
                            <span>More</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 glass-system-parent p-1 mt-2 border-0 shadow-2xl">
                        {moreLinks.map((link) => (
                            (!link.permission || hasPermission(link.permission as any)) && (
                                <DropdownMenuItem key={link.url} asChild>
                                    <Link 
                                        to={link.url} 
                                        className={cn(
                                            "flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all",
                                            location.pathname === link.url ? "bg-primary/20 text-primary" : "hover:bg-accent/30"
                                        )}
                                    >
                                        <link.icon className={cn("size-4", location.pathname === link.url ? "text-primary" : "text-muted-foreground")} />
                                        <span className="font-medium text-sm">{link.title}</span>
                                    </Link>
                                </DropdownMenuItem>
                            )
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </nav>

            {/* Right Controls */}
            <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />

                {/* Alert Bell */}
                <DropdownMenu open={alertOpen} onOpenChange={setAlertOpen}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="relative size-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all outline-none"
                                    >
                                        <Bell className={cn("size-[19px] transition-colors", alertCount > 0 ? "text-primary fill-primary/20" : "text-muted-foreground")} strokeWidth={2.25} />
                                        {alertCount > 0 && (
                                            <span className={cn(
                                                "absolute top-0 right-0 size-5 bg-white text-[#ff3b30] text-[11px] font-black flex items-center justify-center rounded-full shadow-lg animate-in zoom-in duration-300",
                                                blinking ? "opacity-100 scale-110" : "opacity-90 scale-100"
                                            )}>
                                                {alertCount > 9 ? '9+' : alertCount}
                                            </span>
                                        )}
                                    </button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] font-bold bg-primary text-white border-none glass-layer-4">System Alerts</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <DropdownMenuContent align="end" className="w-80 p-0 liquid-ios-glass glass-layer-4 border border-white/20 overflow-hidden shadow-2xl mt-2">
                        <div className="px-4 py-3 border-b border-border/50 bg-accent/10 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-widest opacity-95">Live Alerts</span>
                            {alertCount > 0 && <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{alertCount}</span>}
                        </div>
                        <div className="max-h-[350px] overflow-y-auto thin-scrollbar">
                            {alertCount === 0 ? (
                                <div className="py-10 text-center flex flex-col items-center gap-3">
                                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Bell className="size-5 text-primary opacity-50" />
                                    </div>
                                    <span className="text-[11px] font-medium text-muted-foreground">All systems normal</span>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {criticalDevices.map((device) => (
                                        <Link key={device.id} to="/alerts" onClick={() => setAlertOpen(false)} className="flex gap-4 p-4 hover:bg-white/5 transition-colors group">
                                            <div className="size-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                                                <AlertTriangle className="size-4 text-red-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">{getDeviceDisplayName(device)}</span>
                                                    <span className="text-[9px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">Critical</span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground leading-snug">
                                                    High TDS pulse detected: <span className="text-foreground font-medium">{device.latest_tds?.toFixed(0)} ppm</span>
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-2 border-t border-white/10 bg-white/5">
                            <Button variant="ghost" className="w-full h-8 text-[11px] font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary" onClick={() => { navigate('/alerts'); setAlertOpen(false) }}>
                                View All Notifications
                            </Button>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* User Profile */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex items-center gap-3 pl-2 pr-2 py-1.5 rounded-2xl hover:bg-white/5 transition-all group shrink-0 outline-none"
                        >
                            <div className="size-[36px] rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-white/10 text-sm font-bold text-primary shadow-inner">
                                {user?.email?.substring(0, 2).toUpperCase() || 'EV'}
                            </div>
                            <div className="flex flex-col items-start text-left">
                                <span className="text-[13px] font-semibold text-foreground leading-none">{user?.email?.split('@')[0] || 'User'}</span>
                                <span className="text-[10px] font-semibold text-muted-foreground leading-none mt-1 uppercase tracking-tighter">{(role as string)?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Operator'}</span>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 liquid-ios-glass glass-layer-4 border border-white/20 p-1 mt-2">
                        <div className="px-3 py-3 border-b border-white/10 mb-1">
                            <p className="text-xs font-bold truncate">{profile?.name || user?.email}</p>
                            <p className="text-[9px] font-medium opacity-80 uppercase tracking-widest mt-1">Authorized Account</p>
                        </div>
                        <DropdownMenuItem onClick={() => navigate('/settings')} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white/5">
                            <Settings className="size-3.5" />
                            <span className="text-xs font-medium">System Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-red-500/10 text-red-400">
                            <LogOut className="size-3.5" />
                            <span className="text-xs font-medium">Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
