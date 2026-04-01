import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

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
    const [adminEmails, setAdminEmails] = useState<string[]>([
        'adityadeole08@gmail.com',
        'ritik@evaratech.com',
        'yasha@evaratech.com',
        'aditya@evaratech.com'
    ])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser)
            
            if (firebaseUser) {
                await Promise.all([
                    fetchProfile(firebaseUser.uid, firebaseUser.email),
                    fetchAdminConfig()
                ])
            } else {
                setProfile(null)
                setLoading(false)
            }
        })

        return () => unsubscribe()
    }, [])

    async function fetchAdminConfig() {
        try {
            const configRef = doc(db, 'app_config', 'admin_emails')
            const configSnap = await getDoc(configRef)
            if (configSnap.exists()) {
                const data = configSnap.data()
                if (data.emails && Array.isArray(data.emails)) {
                    console.log('🛡️ Admin config loaded from Firestore')
                    setAdminEmails(data.emails.map((e: string) => e.toLowerCase()))
                }
            }
        } catch (err) {
            console.warn('⚠️ Failed to fetch admin config, using code fallbacks', err)
        }
    }

    async function fetchProfile(userId: string, email?: string | null) {
        try {
            const docRef = doc(db, 'users', userId)
            const docSnap = await getDoc(docRef)

            if (docSnap.exists()) {
                setProfile(docSnap.data() as Profile)
            } else if (email) {
                // Determine role: Use local admin list as source of truth for auto-profile
                const isHardcoded = adminEmails.includes(email.toLowerCase())
                const role = isHardcoded ? 'super_admin' : 'viewer'
                
                console.log(`🆕 Creating auto-profile for ${email} as ${role}`)
                
                const newProfile: Profile = {
                    id: userId,
                    email: email,
                    name: email.split('@')[0],
                    role: role as any,
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
    }

    const signOut = React.useCallback(async () => {
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
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
