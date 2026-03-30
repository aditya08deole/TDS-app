"use client"

import { Bell, Search, Sun, Moon, Laptop, AlertTriangle, X } from "lucide-react"
import { useTheme } from "../context/ThemeContext"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { useAlerts } from "../context/AlertContext"
import { useState, useEffect } from "react"
import { getDeviceDisplayName } from "../lib/constants"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function TopBar() {
    const { theme, setTheme } = useTheme()
    const { alertCount, criticalDevices } = useAlerts()
    const [blinking, setBlinking] = useState(false)
    const [alertOpen, setAlertOpen] = useState(false)

    // Blink badge every 3 seconds when there are alerts
    useEffect(() => {
        if (alertCount === 0) { setBlinking(false); return }
        const interval = setInterval(() => setBlinking(b => !b), 3000)
        return () => clearInterval(interval)
    }, [alertCount])

    return (
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 px-4 transition-all ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 border-b border-white/[0.03]">
            <div className="flex items-center gap-2 px-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
            </div>

            <div className="ml-auto flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative w-full max-w-sm hidden md:flex">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search devices..."
                        className="w-full glass-card bg-background/50 border-black/5 pl-8 md:w-[220px] lg:w-[260px] focus:bg-background/80 transition-all duration-300 shadow-sm"
                    />
                </div>

                {/* Theme Toggle */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-accent/50">
                            {theme === 'light' ? (
                                <Sun className="h-5 w-5" />
                            ) : theme === 'dark' ? (
                                <Moon className="h-5 w-5" />
                            ) : (
                                <Laptop className="h-5 w-5" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-card">
                        <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
                            <Sun className="h-4 w-4" /> Light
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
                            <Moon className="h-4 w-4" /> Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
                            <Laptop className="h-4 w-4" /> System
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Alert Bell with live count */}
                <DropdownMenu open={alertOpen} onOpenChange={setAlertOpen}>
                    <TooltipProvider>
                        <Tooltip>
                            <DropdownMenuTrigger asChild>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="relative hover:bg-accent/50 transition-all duration-300"
                                    >
                                        <Bell className={`h-5 w-5 ${alertCount > 0 ? 'text-red-400' : 'text-foreground'} transition-colors duration-300`} />
                                        {alertCount > 0 && (
                                            <span
                                                className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-background transition-all duration-300 ${blinking ? 'opacity-100 scale-110' : 'opacity-80 scale-100'}`}
                                            >
                                                {alertCount > 9 ? '9+' : alertCount}
                                            </span>
                                        )}
                                        {alertCount === 0 && (
                                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-green-500 border-2 border-background" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                            </DropdownMenuTrigger>
                            <TooltipContent>
                                {alertCount > 0 ? `${alertCount} Critical Alert${alertCount > 1 ? 's' : ''}` : 'No Alerts'}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Alert Dropdown Panel */}
                    <DropdownMenuContent align="end" className="w-80 p-0 glass-card border border-border/50">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4 text-foreground" />
                                <span className="text-sm font-semibold text-foreground">Alerts</span>
                                {alertCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                                        {alertCount}
                                    </span>
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setAlertOpen(false)}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <div className="max-h-72 overflow-y-auto">
                            {alertCount === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                                        <Bell className="h-5 w-5 text-green-500" />
                                    </div>
                                    <p className="text-sm font-medium text-foreground">All Clear</p>
                                    <p className="text-xs text-muted-foreground mt-1">No critical alerts at this time</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {criticalDevices.map((device, i) => (
                                        <div key={device.id} className="flex items-start gap-3 px-4 py-3 hover:bg-red-500/5 transition-colors"
                                            style={{ animationDelay: `${i * 50}ms` }}>
                                            <div className="mt-0.5 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-red-400">Critical TDS Alert</p>
                                                <p className="text-sm font-medium text-foreground truncate">
                                                    {getDeviceDisplayName(device)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {device.latest_tds ? `${device.latest_tds.toFixed(0)} ppm` : 'Unknown TDS'}
                                                    {device.latest_temperature && ` • ${device.latest_temperature.toFixed(1)}°C`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {alertCount > 0 && (
                            <div className="px-4 py-2 border-t border-border">
                                <a
                                    href="/alerts"
                                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                                    onClick={() => setAlertOpen(false)}
                                >
                                    View all in Alerts page →
                                </a>
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}
