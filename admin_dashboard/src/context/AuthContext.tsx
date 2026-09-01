import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { initTokenRefresh, clearSession } from '../lib/tokenRefresh'
import { redeemInviteApi, setDefaultRoleApi } from '../lib/api'
import { getPendingInviteToken, clearPendingInviteToken } from '../lib/pendingInvite'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'

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
            // Captured on mount by Login.tsx/Register.tsx (see lib/pendingInvite.ts) —
            // reading from sessionStorage here instead of the URL avoids losing the
            // token to a navigate() call that already fired by this point.
            const pendingToken = getPendingInviteToken()

            if (docSnap.exists()) {
                let currentProfile = docSnap.data() as Profile

                // An ALREADY-existing account can still redeem an invite link —
                // this is what lets a super_admin "assign" a role to someone who
                // already has an account: they just open the link and log in,
                // whether that's their first time using it or their hundredth.
                // The backend won't downgrade an existing higher-privilege user
                // (see POST /api/users/redeem-invite).
                if (pendingToken) {
                    try {
                        const result = await redeemInviteApi(pendingToken, userId)
                        if (result.success && result.role && result.role !== currentProfile.role) {
                            currentProfile = { ...currentProfile, role: result.role as Profile['role'] }
                            console.log(`🎫 [INVITE REDEEMED] existing uid=${userId} role -> ${result.role}`)
                        }
                    } catch (inviteErr) {
                        console.warn('⚠️ [INVITE] Failed to redeem invite token for existing user:', inviteErr)
                    } finally {
                        clearPendingInviteToken()
                    }
                }

                setProfile(currentProfile)
            } else if (email) {
                // Determine role: hardcoded admin emails always get super_admin
                const isHardcoded = adminEmails.includes(email.toLowerCase())
                let assignedRole: Profile['role'] = isHardcoded ? 'super_admin' : 'viewer'

                if (!isHardcoded) {
                    if (pendingToken) {
                        // Attempt to redeem the invite token to get the correct role
                        try {
                            const result = await redeemInviteApi(pendingToken, userId)
                            if (result.success && result.role) {
                                assignedRole = result.role as Profile['role']
                                console.log(`🎫 [INVITE REDEEMED] uid=${userId} role=${result.role}`)
                            }
                        } catch (inviteErr) {
                            console.warn('⚠️ [INVITE] Failed to redeem invite token (defaulting to viewer):', inviteErr)
                            // Fall through to setDefaultRole
                            try { await setDefaultRoleApi(userId) } catch (_) {}
                        } finally {
                            clearPendingInviteToken()
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
                // Safety net: browser fetch()/Firestore calls have no built-in
                // timeout. If any awaited call below genuinely stalls (network
                // hiccup, cold backend, etc.) instead of resolving OR rejecting,
                // loading would never flip to false and AuthGuard's spinner
                // would spin forever with no way for the user to recover short
                // of a hard refresh. Whichever finishes first — the real auth
                // flow or this timeout — wins; the timeout is a no-op if the
                // real flow already completed.
                let settled = false
                const safetyTimer = window.setTimeout(() => {
                    if (!settled) {
                        console.warn('[AUTH] Profile fetch did not complete within 12s — unblocking UI so the app is usable while it keeps retrying in the background.')
                        setLoading(false)
                    }
                }, 12000)

                try {
                    // Initialize token refresh on login
                    await initTokenRefresh(firebaseUser);

                    // Fix #18: Sequential fetch — load admin config FIRST so fetchProfile
                    // reads the correct adminEmails list when determining the new user's role.
                    // Previously ran in parallel (Promise.all) — fetchProfile could finish
                    // before fetchAdminConfig set the emails, giving new admins 'viewer' role.
                    await fetchAdminConfig();
                    await fetchProfile(firebaseUser.uid, firebaseUser.email);
                } catch (err) {
                    console.error('Auth post-processing failed:', err);
                    setLoading(false);
                } finally {
                    settled = true
                    window.clearTimeout(safetyTimer)
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

        // On native (Capacitor) builds, native Google sign-in creates a
        // session on the ANDROID layer that is entirely separate from the
        // Firebase JS SDK's session — signing out of only one leaves the
        // other alive. Per @capacitor-firebase/authentication's own docs,
        // both layers need an explicit sign-out. Skipping the native one
        // (as this previously did) leaves a stale native Google session on
        // the device, which can make the NEXT native sign-in attempt behave
        // inconsistently — exactly the kind of "picker shows, but never
        // actually completes" symptom this was causing.
        if (Capacitor.isNativePlatform()) {
            try {
                await FirebaseAuthentication.signOut();
            } catch (err) {
                console.warn('[AUTH] Native sign-out failed (continuing with web sign-out):', err);
            }
        }

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
