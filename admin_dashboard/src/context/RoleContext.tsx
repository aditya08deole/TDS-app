import React, { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'

// Canonical role type — matches backend roleGuard.ts and Firestore users.role field
// field_engineer = maintenance staff (on-site engineers who can resolve alerts)
export type UserRole = 'viewer' | 'field_engineer' | 'admin' | 'super_admin'

// Display-friendly role name for UI labels
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
    viewer: 'User',
    field_engineer: 'Maintenance',
    admin: 'Admin',
    super_admin: 'Super Admin',
}

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
    // Phase 3: Alert resolution permission
    | 'resolve_alert'
    // Phase 4: Invite management permission
    | 'invite_users'

// Permission matrix for each role
const rolePermissions: Record<UserRole, Permission[]> = {
    // viewer (default role for uninvited signups)
    // Can see dashboards and alerts but cannot take any action
    viewer: [
        'view_dashboard',
        'view_devices',
        'view_map',
        'view_alerts',
        'view_settings',
    ],

    // field_engineer = Maintenance Staff
    // Can resolve alerts and edit device settings on-site
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
        'edit_device',
        'resolve_alert',   // ← Can mark alerts as resolved
    ],

    // admin
    // Full operational control. Can invite maintenance + users.
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
        'maintenance_mode',
        'resolve_alert',   // ← Can mark alerts as resolved
        'invite_users',    // ← Can generate invite links for maintenance/users
    ],

    // super_admin (you)
    // All permissions. Can invite admins. Cannot be downgraded by invite.
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
        'maintenance_mode',
        'resolve_alert',   // ← Can mark alerts as resolved
        'invite_users',    // ← Can generate invite links for any role including admin
    ],
}

interface RoleContextType {
    role: UserRole
    roleDisplayName: string
    permissions: Permission[]
    hasPermission: (permission: Permission) => boolean
    hasAnyPermission: (permissions: Permission[]) => boolean
    hasAllPermissions: (permissions: Permission[]) => boolean
    isAtLeast: (minimumRole: UserRole) => boolean
    isSuperAdmin: boolean
    isAdmin: boolean
    isMaintenance: boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
    const { profile, isAdmin: isFirebaseAdmin } = useAuth()

    const role: UserRole = (profile?.role as UserRole) || 'viewer'
    const permissions = rolePermissions[role] || []

    const hasPermission = (permission: Permission): boolean => {
        return permissions.includes(permission) || isFirebaseAdmin
    }

    const hasAnyPermission = (permissionList: Permission[]): boolean => {
        return permissionList.some(p => hasPermission(p))
    }

    const hasAllPermissions = (permissionList: Permission[]): boolean => {
        return permissionList.every(p => hasPermission(p))
    }

    const roleHierarchy: UserRole[] = ['viewer', 'field_engineer', 'admin', 'super_admin']

    const isAtLeast = (minimumRole: UserRole): boolean => {
        const currentIndex = roleHierarchy.indexOf(role)
        const requiredIndex = roleHierarchy.indexOf(minimumRole)
        return currentIndex >= requiredIndex || isFirebaseAdmin
    }

    return (
        <RoleContext.Provider
            value={{
                role,
                roleDisplayName: ROLE_DISPLAY_NAMES[role] || 'User',
                permissions,
                hasPermission,
                hasAnyPermission,
                hasAllPermissions,
                isAtLeast,
                isSuperAdmin: role === 'super_admin',
                isAdmin: role === 'admin' || role === 'super_admin' || isFirebaseAdmin,
                isMaintenance: role === 'field_engineer',
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
