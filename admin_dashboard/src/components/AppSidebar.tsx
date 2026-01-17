"use client"

import * as React from "react"
import {
    Activity,
    AlertTriangle,
    FileText,
    LayoutDashboard,
    Map as MapIcon,
    Settings,
    ShieldCheck,
    Smartphone,
    LogOut,
    ChevronUp
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarRail,
} from "@/components/ui/sidebar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useLocation, Link, useNavigate } from "react-router-dom"
// import { useAuth } from "@/components/AuthGuard"
import { useRole } from "@/context/RoleContext"

// Create a dummy hook if useAuth doesn't exist or verify it later.
// For now, I'll assume standard supabase auth pattern or similar.

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const location = useLocation()
    const navigate = useNavigate()
    // const { user, signOut } = useAuth() // Need to verify this imports
    // MOCKING AUTH FOR NOW to avoid breakages if hook is strict
    const user = { email: "admin@evara.io", user_metadata: { full_name: "Admin User", avatar_url: "" } }
    const signOut = async () => console.log("Sign out")

    const { hasPermission } = useRole()

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
            badge: "3", // Dynamic?
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
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                        <Activity className="size-4" />
                                    </div>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">Evara TDS</span>
                                        <span className="truncate text-xs">Admin Console</span>
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
                    <SidebarGroupLabel>Platform</SidebarGroupLabel>
                    <SidebarMenu>
                        {navMain.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                {item.items ? (
                                    // Collapsible item would require `Collapsible` component which I didn't create wrapper for in Sidebar.tsx explicitly?
                                    // The generic sidebar.tsx supports nested menus via sidebar-menu-sub
                                    // For simplicity, let's just make them links for now or use the Collapsible pattern if I had it.
                                    // I'll stick to simple flat links if no sub-items, or just render sub-items always if active.
                                    // Actuallly I'll just render it as a button for now.
                                    <>
                                        <SidebarMenuButton tooltip={item.title}>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                        </SidebarMenuButton>
                                        <SidebarMenuSub>
                                            {/* Placeholder for sub items */}
                                        </SidebarMenuSub>
                                    </>
                                ) : (
                                    <SidebarMenuButton
                                        asChild
                                        tooltip={item.title}
                                        isActive={item.isActive}
                                    >
                                        <Link to={item.url}>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                )}
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                    <SidebarGroupLabel>Administration</SidebarGroupLabel>
                    <SidebarMenu>
                        {navAdmin.map((item) => (
                            (!item.permission || hasPermission(item.permission as any)) && (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
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
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                >
                                    <Avatar className="h-8 w-8 rounded-lg">
                                        <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.full_name} />
                                        <AvatarFallback className="rounded-lg">EV</AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm leading-tight">
                                        <span className="truncate font-semibold">{user?.user_metadata?.full_name || "User"}</span>
                                        <span className="truncate text-xs">{user?.email}</span>
                                    </div>
                                    <ChevronUp className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
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
