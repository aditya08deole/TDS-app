import { LayoutDashboard, Map as MapIcon, Smartphone, Bell, Settings, Users, Download } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAlerts } from "../context/AlertContext"
import { useViewport } from "../hooks/useViewport"
import { useRole } from "../context/RoleContext"
import { CurvedBottomNav } from "./CurvedBottomNav"

export function MobileNav() {
    const location = useLocation()
    const { alertCount } = useAlerts()
    const { isLandscape } = useViewport()
    const { hasPermission } = useRole()

    // This bottom bar previously had no way to reach /users at all — the
    // desktop TopBar's "More" dropdown already gates it to manage_users
    // (super_admin), so mirror that here instead of leaving mobile/the
    // native app with no path to user & role management whatsoever.
    const navItems = [
        { title: "Overview", url: "/", icon: LayoutDashboard },
        { title: "Map", url: "/map", icon: MapIcon },
        { title: "Devices", url: "/devices", icon: Smartphone },
        { title: "Alerts", url: "/alerts", icon: Bell, badge: alertCount },
        ...(hasPermission('manage_users') ? [{ title: "Users", url: "/users", icon: Users }] : []),
        { title: "Export", url: "/export", icon: Download },
        { title: "Settings", url: "/settings", icon: Settings },
    ]

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
            </CurvedBottomNav>
        </div>
    )
}
