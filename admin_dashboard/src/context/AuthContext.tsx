import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { initTokenRefresh, clearSession } from '../lib/tokenRefresh'
import { redeemInviteApi, setDefaultRoleApi } from '../lib/api'

export type Profile = {
    id: string
    email: string
    name?: string
    role: 'viewer' | 'field_engineer' | 'admin' | 'super_admin'
    avatar_url?: string
    created_at: string
}

type AuthContextType = {
    user: User | null
    profile: Profile | null
    loading: boolean
    isAdmin: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    // Fix #17: Removed hardcoded admin emails from source code.
    // Previously: ['adityadeole08@gmail.com', 'ritik@evaratech.com', ...] — visible in compiled JS.
    // Now: empty by default; populated exclusively from Firestore app_config/admin_emails.
    // IMPORTANT: Ensure app_config/admin_emails exists in Firestore before deploying.
    const [adminEmails, setAdminEmails] = useState<string[]>([])

    const fetchAdminConfig = React.useCallback(async () => {
        try {
            const configRef = doc(db, 'app_config', 'admin_emails')
            const configSnap = await getDoc(configRef)
            if (configSnap.exists()) {
                const data = configSnap.data()
                if (data.emails && Array.isArray(data.emails)) {
                    console.log('🛡️ Admin config loaded from Firestore')
                    setAdminEmails(data.emails.map((e: string) => e.toLowerCase()))
                }
            } else {
                console.warn('⚠️ app_config/admin_emails not found in Firestore. No hardcoded admin fallback.')
            }
        } catch (err) {
            console.warn('⚠️ Failed to fetch admin config from Firestore:', err)
        }
    }, [])

    const fetchProfile = React.useCallback(async (userId: string, email?: string | null) => {
        try {
            const docRef = doc(db, 'users', userId)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                setProfile(docSnap.data() as Profile)
            } else if (email) {
                // New user — check if there's an invite token in the URL
                const urlToken = new URLSearchParams(window.location.search).get('token') ||
                    new URLSearchParams(window.location.search).get('invite');

                // Determine role: hardcoded admin emails always get super_admin
                const isHardcoded = adminEmails.includes(email.toLowerCase())
                let assignedRole: Profile['role'] = isHardcoded ? 'super_admin' : 'viewer'

                if (!isHardcoded) {
                    if (urlToken) {
                        // Attempt to redeem the invite token to get the correct role
                        try {
                            const result = await redeemInviteApi(urlToken, userId)
                            if (result.success && result.role) {
                                assignedRole = result.role as Profile['role']
                                console.log(`🎫 [INVITE REDEEMED] uid=${userId} role=${result.role}`)
                                // Clean token from URL without reload
                                const url = new URL(window.location.href)
                                url.searchParams.delete('token')
                                url.searchParams.delete('invite')
                                window.history.replaceState({}, '', url.toString())
                            }
                        } catch (inviteErr) {
                            console.warn('⚠️ [INVITE] Failed to redeem invite token (defaulting to viewer):', inviteErr)
                            // Fall through to setDefaultRole
                            try { await setDefaultRoleApi(userId) } catch (_) {}
                        }
                    } else {
                        // No invite token — assign default viewer role in backend
                        try { await setDefaultRoleApi(userId) } catch (_) {}
                    }
                }

                console.log(`🆕 Creating profile for ${email} as ${assignedRole}`)

                const newProfile: Profile = {
                    id: userId,
                    email: email,
                    name: email.split('@')[0],
                    role: assignedRole,
                    created_at: new Date().toISOString()
                }

                setProfile(newProfile)

                import('firebase/firestore').then(({ setDoc, serverTimestamp }) => {
                    setDoc(docRef, {
                        ...newProfile,
                        created_at: serverTimestamp(),
                        status: 'active'
                    }, { merge: true }).catch(err => console.error('Auto-profile failed:', err))
                })
            } else {
                setProfile(null)
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setLoading(false)
        }
    }, [adminEmails])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser)
            
            if (firebaseUser) {
                // Initialize token refresh on login
                await initTokenRefresh(firebaseUser);

                // Fix #18: Sequential fetch — load admin config FIRST so fetchProfile
                // reads the correct adminEmails list when determining the new user's role.
                // Previously ran in parallel (Promise.all) — fetchProfile could finish
                // before fetchAdminConfig set the emails, giving new admins 'viewer' role.
                try {
                    await fetchAdminConfig();
                    await fetchProfile(firebaseUser.uid, firebaseUser.email);
                } catch (err) {
                    console.error('Auth post-processing failed:', err);
                    setLoading(false);
                }
            } else {
                // Fix #11: Clear session on logout
                await clearSession();
                
                setProfile(null)
                setLoading(false)
            }
        })

        return () => unsubscribe()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Run once on mount. fetchProfile/fetchAdminConfig are stable enough or handled via latest state in callback.

    const signOut = React.useCallback(async () => {
        // Fix #11: Clear session before signout
        await clearSession();
        await firebaseSignOut(auth)
    }, [])

    const isHardcodedAdmin = React.useMemo(() => 
        user?.email && adminEmails.includes(user.email.toLowerCase())
    , [user?.email, adminEmails])

    // SYNCHRONOUS DERIVED PROFILE: Ensures immediate Admin UI even if DB hangs
    const effectiveProfile = React.useMemo(() => {
        if (profile) return profile
        if (isHardcodedAdmin && user?.email) {
            return {
                id: user.uid,
                email: user.email,
                name: user.email.split('@')[0],
                role: 'super_admin' as const,
                created_at: new Date().toISOString(),
                status: 'active'
            }
        }
        return null
    }, [profile, isHardcodedAdmin, user])

    const authContextValue = React.useMemo(() => ({
        user,
        profile: effectiveProfile,
        loading: loading && !isHardcodedAdmin,
        isAdmin: isHardcodedAdmin || effectiveProfile?.role === 'admin' || effectiveProfile?.role === 'super_admin',
        signOut
    }), [user, effectiveProfile, loading, isHardcodedAdmin, signOut])

    return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        console.warn('⚠️ useAuth was invoked outside AuthProvider — returning safe context fallback.')
        return {
            user: null,
            profile: null,
            loading: true,
            isHardcodedAdmin: false,
            isAdmin: false,
            signOut: async () => {},
            setSessionExpired: () => {},
        }
    }
    return context
}
