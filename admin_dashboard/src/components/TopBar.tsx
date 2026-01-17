"use client"

import { Bell, Search } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
// import { ModeToggle } from "@/components/mode-toggle" // If we have one, otherwise ignore for now
import { Input } from "@/components/ui/input"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function TopBar() {
    return (
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/60 backdrop-blur-xl px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                {/* Breadcrumbs could go here */}
            </div>

            <div className="ml-auto flex items-center gap-3">
                <div className="relative w-full max-w-sm hidden md:flex">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search devices..."
                        className="w-full bg-background/50 pl-8 md:w-[300px] lg:w-[300px]"
                    />
                    <div className="absolute right-2.5 top-2.5 hidden text-xs text-muted-foreground lg:flex items-center gap-1">
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>

                {/* IIITH Logo */}
                <div className="hidden lg:flex items-center">
                    <img
                        src="/iiith-logo.png"
                        alt="IIIT Hyderabad"
                        className="h-8 object-contain bg-white/90 rounded px-2 py-0.5"
                    />
                </div>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Notifications</TooltipContent>
                </Tooltip>

                {/* <ModeToggle /> */}
            </div>
        </header>
    )
}
