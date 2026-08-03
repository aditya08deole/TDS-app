import React, { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'

// Fix #4: Unified role type — matches AuthContext.tsx and roleGuard.ts exactly.
// Removed 'operator' and 'engineer' (they don't exist in the database).
// Added 'field_engineer' with appropriate permissions between viewer and admin.
export type UserRole = 'viewer' | 'field_engineer' | 'admin' | 'super_admin'

export type Permission =
    | 'view_dashboard'
    | 'view_devices'
    | 'view_map'
    | 'view_alerts'
    | 'view_audit'
    | 'manage_devices'
    | 'add_device'
    | 'delete_device'
    | 'edit_device'
    | 'bulk_operations'
    | 'export_data'
    | 'manage_users'
    | 'view_settings'
    | 'edit_settings'
    | 'maintenance_mode'

// Define permissions for each role
const rolePermissions: Record<UserRole, Permission[]> = {
    viewer: [
        'view_dashboard',
        'view_devices',
        'view_map',
        'view_alerts',
        'view_settings'
    ],
    // Fix #4: field_engineer replaces the broken 'operator' and 'engineer' roles
    field_engineer: [
        'view_dashboard',
        'view_devices',
        'view_map',
        'view_alerts',
        'view_audit',
        'view_settings',
        'edit_settings',
        'maintenance_mode',
        'export_data',
        'edit_device'
    ],
    admin: [
        'view_dashboard',
        'view_devices',
        'view_map',
        'view_alerts',
        'view_audit',
        'manage_devices',
        'add_device',
        'delete_device',
        'edit_device',
        'bulk_operations',
        'export_data',
        'view_settings',
        'edit_settings',
        'maintenance_mode'
    ],
    super_admin: [
        'view_dashboard',
        'view_devices',
        'view_map',
        'view_alerts',
        'view_audit',
        'manage_devices',
        'add_device',
        'delete_device',
        'edit_device',
        'bulk_operations',
        'export_data',
        'manage_users',
        'view_settings',
        'edit_settings',
        'maintenance_mode'
    ]
}

interface RoleContextType {
    role: UserRole
    permissions: Permission[]
    hasPermission: (permission: Permission) => boolean
    hasAnyPermission: (permissions: Permission[]) => boolean
    hasAllPermissions: (permissions: Permission[]) => boolean
    isAtLeast: (minimumRole: UserRole) => boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
    const { profile, isAdmin } = useAuth()

    // Get user role from profile, default to viewer
    const role: UserRole = (profile?.role as UserRole) || 'viewer'
    const permissions = rolePermissions[role] || []

    const hasPermission = (permission: Permission): boolean => {
        return permissions.includes(permission) || isAdmin
    }

    const hasAnyPermission = (permissionList: Permission[]): boolean => {
        return permissionList.some(p => hasPermission(p))
    }

    const hasAllPermissions = (permissionList: Permission[]): boolean => {
        return permissionList.every(p => hasPermission(p))
    }

    // Fix #4: Hierarchy now matches the 4-role canonical set in AuthContext
    const roleHierarchy: UserRole[] = ['viewer', 'field_engineer', 'admin', 'super_admin']

    const isAtLeast = (minimumRole: UserRole): boolean => {
        const currentIndex = roleHierarchy.indexOf(role)
        const requiredIndex = roleHierarchy.indexOf(minimumRole)
        return currentIndex >= requiredIndex || isAdmin
    }

    return (
        <RoleContext.Provider
            value={{
                role,
                permissions,
                hasPermission,
                hasAnyPermission,
                hasAllPermissions,
                isAtLeast
            }}
        >
            {children}
        </RoleContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRole() {
    const context = useContext(RoleContext)
    if (context === undefined) {
        throw new Error('useRole must be used within a RoleProvider')
    }
    return context
}
