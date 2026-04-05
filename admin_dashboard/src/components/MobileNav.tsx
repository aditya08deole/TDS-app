import { LayoutDashboard, Map as MapIcon, Smartphone, Bell, MoreHorizontal } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAlerts } from "../context/AlertContext"
import { useViewport } from "../hooks/useViewport"

export function MobileNav() {
    const location = useLocation()
    const { alertCount } = useAlerts()
    const { isLandscape } = useViewport()

    const navItems = [
        { title: "Overview", url: "/", icon: LayoutDashboard },
        { title: "Map", url: "/map", icon: MapIcon },
        { title: "Devices", url: "/devices", icon: Smartphone },
        { title: "Alerts", url: "/alerts", icon: Bell, badge: alertCount },
    ]

    return (
        <nav className={cn(
            "fixed left-1/2 -translate-x-1/2 z-[100] flex md:hidden items-center gap-1 p-1.5 transition-all duration-500",
            // Perfect Fit: Tighter positioning for mobile landscape
            isLandscape ? "bottom-3 w-[96%] max-w-[500px]" : "bottom-6 w-[92%] max-w-[400px]",
            // Safe area support for iPhone X+ devices
            "pb-[env(safe-area-inset-bottom)]",
            "glass-nav-unified shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-full border border-border backdrop-blur-3xl"
        )}>
            {navItems.map((item) => {
                const isActive = location.pathname === item.url
                return (
                    <Link
                        key={item.url}
                        to={item.url}
                        className={cn(
                            "relative flex flex-col items-center justify-center flex-1 rounded-full transition-all duration-300 min-h-[44px]",
                            isLandscape ? "py-1" : "py-2",
                            isActive 
                                ? "glass-system-active text-foreground" 
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label={item.title}
                    >
                        <item.icon className={cn(isLandscape ? "size-4" : "size-5", isActive && "animate-in zoom-in duration-300")} strokeWidth={isActive ? 2.5 : 2} />
                        <span className={cn("font-bold tracking-tight", isLandscape ? "text-[8px] mt-0.5" : "text-[10px] mt-1")}>{item.title}</span>
                        
                        {item.badge && item.badge > 0 && (
                            <span 
                                className="absolute -top-0.5 right-1/4 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border border-border shadow-lg animate-pulse pointer-events-none"
                                aria-label={`${item.badge} alerts`}
                            >
                                {item.badge > 9 ? '9+' : item.badge}
                            </span>
                        )}
                    </Link>
                )
            })}
            
            {/* More / Settings Link */}
            <Link
                to="/settings"
                className={cn(
                    "flex flex-col items-center justify-center flex-1 rounded-full text-muted-foreground transition-all duration-300 min-h-[44px]",
                    isLandscape ? "py-1" : "py-2",
                    location.pathname === "/settings" && "glass-system-active text-foreground"
                )}
                aria-label="Settings"
            >
                <MoreHorizontal className={isLandscape ? "size-4" : "size-5"} />
                <span className={cn("font-bold tracking-tight", isLandscape ? "text-[8px] mt-0.5" : "text-[10px] mt-1")}>More</span>
            </Link>
        </nav>
    )
}
