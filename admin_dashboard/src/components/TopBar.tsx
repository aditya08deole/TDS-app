"use client"

import { Bell, Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function TopBar() {
    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-white/5 bg-background/80 backdrop-blur-xl px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4 bg-white/10" />
            </div>

            <div className="ml-auto flex items-center gap-4">
                {/* Search Bar */}
                <div className="relative w-full max-w-sm hidden md:flex">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search devices..."
                        className="w-full bg-white/5 border-white/10 pl-8 md:w-[250px] lg:w-[280px] focus:bg-white/10 transition-all duration-300"
                    />
                    <div className="absolute right-2.5 top-2.5 hidden text-xs text-muted-foreground lg:flex items-center gap-1">
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>

                {/* Partner Logos - Side by Side */}
                <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                    <img
                        src="/evaratech-logo.png"
                        alt="EvaraTech"
                        className="h-6 object-contain opacity-90 hover:opacity-100 transition-opacity"
                    />
                    <div className="w-px h-5 bg-white/20" />
                    <img
                        src="/iiith-logo.png"
                        alt="IIIT Hyderabad"
                        className="h-5 object-contain invert opacity-80 hover:opacity-100 transition-opacity"
                    />
                </div>

                {/* Notifications */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative hover:bg-white/10 transition-all duration-300">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Notifications</TooltipContent>
                </Tooltip>
            </div>
        </header>
    )
}
