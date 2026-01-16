import React from 'react'
import { useRole, type Permission } from '../context/RoleContext'
import { ShieldOff } from 'lucide-react'

interface RoleGuardProps {
    children: React.ReactNode
    permission?: Permission
    permissions?: Permission[]
    requireAll?: boolean // If true, requires all permissions; if false, requires any
    fallback?: React.ReactNode
    silent?: boolean // If true, renders nothing instead of fallback
}

/**
 * RoleGuard - Conditionally render children based on user permissions
 * 
 * Usage examples:
 * 
 * Single permission:
 * <RoleGuard permission="manage_devices">
 *   <AdminOnlyComponent />
 * </RoleGuard>
 * 
 * Multiple permissions (any):
 * <RoleGuard permissions={['add_device', 'edit_device']}>
 *   <DeviceEditor />
 * </RoleGuard>
 * 
 * Multiple permissions (all required):
 * <RoleGuard permissions={['add_device', 'delete_device']} requireAll>
 *   <FullDeviceManager />
 * </RoleGuard>
 * 
 * With custom fallback:
 * <RoleGuard permission="manage_users" fallback={<UpgradePrompt />}>
 *   <UserManager />
 * </RoleGuard>
 * 
 * Silent (no fallback):
 * <RoleGuard permission="export_data" silent>
 *   <ExportButton />
 * </RoleGuard>
 */
export default function RoleGuard({
    children,
    permission,
    permissions,
    requireAll = false,
    fallback,
    silent = false
}: RoleGuardProps) {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = useRole()

    let hasAccess = false

    if (permission) {
        hasAccess = hasPermission(permission)
    } else if (permissions && permissions.length > 0) {
        hasAccess = requireAll
            ? hasAllPermissions(permissions)
            : hasAnyPermission(permissions)
    } else {
        // No permissions specified, allow access
        hasAccess = true
    }

    if (hasAccess) {
        return <>{children}</>
    }

    if (silent) {
        return null
    }

    if (fallback) {
        return <>{fallback}</>
    }

    // Default fallback - Access Denied message
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <ShieldOff className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Access Restricted</h3>
            <p className="text-sm text-slate-400 max-w-xs">
                You don't have permission to view this content. Contact an administrator for access.
            </p>
        </div>
    )
}

/**
 * Higher-order component version for wrapping entire components
 */
export function withRoleGuard<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    permission: Permission
) {
    return function WithRoleGuardComponent(props: P) {
        return (
            <RoleGuard permission={permission}>
                <WrappedComponent {...props} />
            </RoleGuard>
        )
    }
}
