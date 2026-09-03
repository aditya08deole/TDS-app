import React from 'react'
import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface AuthGuardProps {
    children?: React.ReactNode
    requiredRole?: 'super_admin' | 'admin' | 'field_engineer' | 'viewer'
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
    const { user, loading, profile, isAdmin } = useAuth()
    const location = useLocation()

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                    <p className="text-slate-400 text-sm">Loading...</p>
                </div>
            </div>
        )
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // Check role-based access if required
    if (requiredRole) {
        const userRole = profile?.role || 'viewer'
        const roleHierarchy = ['viewer', 'field_engineer', 'admin', 'super_admin']
        const userRoleIndex = roleHierarchy.indexOf(userRole)
        const requiredRoleObject = requiredRole === 'admin' ? 'admin' : requiredRole
        const requiredRoleIndex = roleHierarchy.indexOf(requiredRoleObject)

        // isAdmin is true for BOTH 'admin' and 'super_admin' (see AuthContext), so it
        // must never be used to bypass a super_admin-specific gate — otherwise a plain
        // admin would slip through requiredRole="super_admin" via this escape hatch.
        const canBypassViaIsAdmin = requiredRole !== 'super_admin' && isAdmin

        if (userRoleIndex < requiredRoleIndex && !canBypassViaIsAdmin) {
            // User doesn't have sufficient permissions
            return (
                <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
                    <div className="text-center p-8">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                        <p className="text-slate-400 mb-4">You don't have permission to access this page.</p>
                        <button
                            onClick={() => window.history.back()}
                            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            )
        }
    }

    // If children provided, render them; otherwise render Outlet for nested routes
    return children ? <>{children}</> : <Outlet />
}
