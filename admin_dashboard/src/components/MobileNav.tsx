import { LayoutDashboard, Map as MapIcon, Smartphone, Bell, Settings, Users, Download, History, MoreHorizontal } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAlerts } from "../context/AlertContext"
import { useViewport } from "../hooks/useViewport"
import { useRole } from "../context/RoleContext"
import { CurvedBottomNav } from "./CurvedBottomNav"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function MobileNav() {
    const location = useLocation()
    const { alertCount } = useAlerts()
    const { isLandscape } = useViewport()
    const { hasPermission } = useRole()

    // Core, always-present tabs. Manage Users / Export Data / Settings move
    // into the "More" menu below — mirrors the desktop TopBar's structure
    // instead of cramming every page into the fixed-width bottom bar.
    const navItems = [
        { title: "Overview", url: "/", icon: LayoutDashboard },
        { title: "Map", url: "/map", icon: MapIcon },
        { title: "Devices", url: "/devices", icon: Smartphone },
        { title: "Alerts", url: "/alerts", icon: Bell, badge: alertCount },
    ]

    const moreLinks: Array<{ title: string; url: string; icon: typeof Settings; permission?: 'manage_users' | 'export_data' }> = [
        { title: "Manage Users", url: "/users", icon: Users, permission: "manage_users" },
        { title: "Export Data", url: "/export", icon: Download, permission: "export_data" },
        { title: "Activity Log", url: "/activity-log", icon: History, permission: "export_data" },
        { title: "Settings", url: "/settings", icon: Settings },
    ]
    const visibleMoreLinks = moreLinks.filter(link => !link.permission || hasPermission(link.permission))
    const isMoreActive = visibleMoreLinks.some(link => location.pathname === link.url)

    return (
        <div className="block md:hidden">
            <CurvedBottomNav>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.url
                    return (
                        <Link
                            key={item.url}
                            to={item.url}
                            className={cn(
                                "relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-300 min-h-[42px]",
                                isActive
                                    ? "text-cyan-400 bg-cyan-500/15 border border-cyan-400/30 shadow-sm shadow-cyan-500/10 scale-105"
                                    : "text-muted-foreground/70 hover:text-foreground hover:bg-white/5"
                            )}
                            aria-label={item.title}
                        >
                            <item.icon className={cn(isLandscape ? "size-[15px]" : "size-[19px]", isActive && "animate-in zoom-in duration-300")} strokeWidth={isActive ? 2.5 : 2} />
                            <span className={cn("font-bold tracking-tight leading-none", isLandscape ? "text-[8px] mt-0.5" : "text-[9.5px] mt-0.5")}>{item.title}</span>

                            {item.badge !== undefined && item.badge > 0 && (
                                <span
                                    className="absolute -top-1 right-1.5 min-w-[13px] h-[13px] px-0.5 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border border-slate-900 shadow-md animate-pulse pointer-events-none"
                                    aria-label={`${item.badge} alerts`}
                                >
                                    {item.badge > 9 ? '9+' : item.badge}
                                </span>
                            )}
                        </Link>
                    )
                })}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "relative flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl transition-all duration-300 min-h-[42px] outline-none",
                                isMoreActive
                                    ? "text-cyan-400 bg-cyan-500/15 border border-cyan-400/30 shadow-sm shadow-cyan-500/10 scale-105"
                                    : "text-muted-foreground/70 hover:text-foreground hover:bg-white/5"
                            )}
                            aria-label="More"
                        >
                            <MoreHorizontal className={cn(isLandscape ? "size-[15px]" : "size-[19px]")} strokeWidth={isMoreActive ? 2.5 : 2} />
                            <span className={cn("font-bold tracking-tight leading-none", isLandscape ? "text-[8px] mt-0.5" : "text-[9.5px] mt-0.5")}>More</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" sideOffset={12} className="w-52 glass-system-parent p-1 border-0 shadow-2xl">
                        {visibleMoreLinks.map((link) => (
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
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </CurvedBottomNav>
        </div>
    )
}
