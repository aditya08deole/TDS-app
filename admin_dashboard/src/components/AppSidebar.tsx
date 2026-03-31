"use client"

import * as React from "react"
import {
    AlertTriangle,
    FileText,
    LayoutDashboard,
    Map as MapIcon,
    Settings,
    ShieldCheck,
    Smartphone,
    LogOut,
    ChevronUp,
    Users as UsersIcon
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "../context/AuthContext"
import { useRole } from "@/context/RoleContext"
import { useAlerts } from "../context/AlertContext"
import { Link, useLocation, useNavigate } from "react-router-dom"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const location = useLocation()
    const navigate = useNavigate()
    const { user, profile, signOut } = useAuth()
    const { hasPermission } = useRole()
    const { alertCount } = useAlerts()

    const navMain = [
        {
            title: "Overview",
            url: "/",
            icon: LayoutDashboard,
            isActive: location.pathname === "/",
        },
        {
            title: "Map View",
            url: "/map",
            icon: MapIcon,
            isActive: location.pathname === "/map",
        },
        {
            title: "Devices",
            url: "/devices",
            icon: Smartphone,
            isActive: location.pathname === "/devices" || location.pathname.startsWith("/devices/"),
        },
        {
            title: "Alerts",
            url: "/alerts",
            icon: AlertTriangle,
            isActive: location.pathname === "/alerts",
        },
        {
            title: "Reports",
            url: "/reports",
            icon: FileText,
            isActive: location.pathname === "/reports",
        },
    ]

    const navAdmin = [
        {
            title: "Manage Users",
            url: "/users",
            icon: UsersIcon,
            isActive: location.pathname === "/users",
            permission: "manage_users",
        },
        {
            title: "Audit Log",
            url: "/audit",
            icon: ShieldCheck,
            isActive: location.pathname === "/audit",
            permission: "view_audit",
        },
        {
            title: "Settings",
            url: "/settings",
            icon: Settings,
            isActive: location.pathname === "/settings",
        },
    ]

    return (
        <Sidebar collapsible="icon" className="glass-nav-unified border-r border-border" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:glass-active-glow transition-all duration-300"
                                >
                                    <img
                                        src="/pwa-512x512.png"
                                        alt="EvaraTDS"
                                        className="size-8 rounded-lg"
                                    />
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-black tracking-tight text-foreground">EvaraTDS</span>
                                        <span className="truncate text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Water Quality Monitor</span>
                                    </div>
                                    {/* <ChevronsUpDown className="ml-auto" /> */}
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            {/* Could add org switcher here */}
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {navMain.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    tooltip={item.title}
                                    isActive={item.isActive}
                                    className={cn(
                                        "transition-all duration-300",
                                        item.isActive && "glass-active-glow shadow-[0_0_12px_rgba(0,122,255,0.3)]"
                                    )}
                                >
                                    <Link to={item.url} className="flex items-center gap-2 w-full relative">
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                        {item.title === 'Alerts' && alertCount > 0 && (
                                            <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                                                {alertCount > 9 ? '9+' : alertCount}
                                            </span>
                                        )}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenu>
                        {navAdmin.map((item) => (
                            (!item.permission || hasPermission(item.permission as any)) && (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton 
                                        asChild 
                                        tooltip={item.title} 
                                        isActive={item.isActive}
                                        className={cn(
                                            "transition-all duration-300",
                                            item.isActive && "glass-active-glow shadow-[0_0_12px_rgba(0,122,255,0.3)]"
                                        )}
                                    >
                                        <Link to={item.url}>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                {/* Partner Logo */}
                <div className="px-3 py-4 border-b border-border group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center justify-center">
                        <img
                            src="/evaratech-logo.png"
                            alt="EvaraTech"
                            className="h-8 object-contain opacity-80 hover:opacity-100 transition-opacity"
                        />
                    </div>
                </div>

                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:glass-active-glow transition-all duration-300"
                                >
                                    <Avatar className="h-8 w-8 rounded-lg">
                                        <AvatarImage src={profile?.avatar_url} alt={profile?.name || "User"} />
                                        <AvatarFallback className="rounded-lg">EV</AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">{profile?.name || "User"}</span>
                                        <span className="truncate text-xs">{user?.email}</span>
                                    </div>
                                    <ChevronUp className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg liquid-ios-glass glass-layer-4 border border-white/20 shadow-2xl"
                            >
                                <DropdownMenuItem onClick={() => navigate('/settings')}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={signOut}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Log out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
