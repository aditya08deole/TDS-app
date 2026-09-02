import { useState, useEffect } from 'react'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential } from 'firebase/auth'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { capturePendingInviteToken } from '../lib/pendingInvite'
import { getAuthErrorMessage, isBenignPopupDismissal } from '../lib/authErrors'
import { useAuth } from '../context/AuthContext'

// Custom Google Icon (matches Login.tsx)
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94L5.84 14.1z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
)

/**
 * Register.tsx — Invite-only registration page
 *
 * Flow:
 * 1. User lands here via invite link: /register?token=<invite_token>
 * 2. capturePendingInviteToken() (see lib/pendingInvite.ts) stashes the token
 *    in sessionStorage on mount, before anything can navigate it away
 * 3. They create a Firebase account (email/password or Google), or if they
 *    already have one, click through to /login instead — either way works
 * 4. onAuthStateChanged fires in AuthContext → fetches profile, redeems the
 *    stashed token, and assigns/upgrades their role accordingly
 * 5. User is redirected to the dashboard with the invited role applied
 *
 * If no token is present, user still registers but gets the default 'viewer' role.
 */
export default function Register() {
    const navigate = useNavigate()
    const { user } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Captured once at first render, before capturePendingInviteToken() strips
    // it from the URL below — a plain re-computed const would go stale (and
    // silently drop the "you've been invited" banner) on the next re-render
    // once the URL no longer carries it.
    const [inviteToken] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search)
        return params.get('token') || params.get('invite') || null
    })

    // Pre-fill email from URL if provided, and stash the invite token in
    // sessionStorage immediately so it survives navigation (e.g. clicking
    // through to /login for an existing account) without being lost.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const emailParam = params.get('email')
        if (emailParam) setEmail(emailParam)
        capturePendingInviteToken()
    }, [])

    // See Login.tsx for the full explanation — signInWithRedirect (the
    // fallback used when the Google popup itself is blocked) navigates this
    // entire page away and back, so nothing here ever calls navigate() on
    // return. Without this, a successful redirect sign-up landed the user
    // right back on this registration form, fully authenticated, looking
    // like nothing happened.
    useEffect(() => {
        if (user) {
            navigate('/', { replace: true })
        }
    }, [user, navigate])

    useEffect(() => {
        getRedirectResult(auth).catch((err) => {
            if (isBenignPopupDismissal(err)) return
            console.error('Redirect sign-up failed:', err)
            // See Login.tsx — a failure here happened after a full top-level
            // navigation to Google and back, so it can't be a popup/cookie
            // issue. Point at Firebase config instead of blaming the browser.
            setError(
                'Google sign-up failed after returning from Google — this happens even without a popup, so it is not a browser/cookie issue. ' +
                'It usually means the Google sign-in provider is disabled in Firebase Console, or this domain is not in the authorized domains list. Please use email/password for now.'
            )
        })
    }, [])

    const validateForm = (): string | null => {
        if (!email.trim()) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email address'
        if (password.length < 8) return 'Password must be at least 8 characters'
        if (password !== confirmPassword) return 'Passwords do not match'
        return null
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const validationError = validateForm()
        if (validationError) {
            setError(validationError)
            return
        }

        setLoading(true)
        try {
            await createUserWithEmailAndPassword(auth, email.trim(), password)
            // AuthContext.fetchProfile picks up the invite token and calls
            // redeemInviteApi automatically. No navigate() here on purpose —
            // see the useEffect watching `user` above; navigating immediately
            // would race AuthContext's async state update and could bounce
            // back to this page with no error shown at all.
        } catch (err: any) {
            setError(getAuthErrorMessage(err, 'Registration failed. Please try again.'))
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleRegister = async () => {
        setError(null)
        setLoading(true)
        try {
            if (Capacitor.isNativePlatform()) {
                const result = await FirebaseAuthentication.signInWithGoogle()
                if (result.credential?.idToken) {
                    const credential = GoogleAuthProvider.credential(result.credential.idToken)
                    await signInWithCredential(auth, credential)
                    // No navigate() here — see the useEffect above.
                } else {
                    throw new Error('Google Sign-In failed or was cancelled')
                }
            } else {
                const provider = new GoogleAuthProvider()
                try {
                    // No navigate() on success here either — same reasoning.
                    await signInWithPopup(auth, provider)
                } catch (popupErr: any) {
                    if (isBenignPopupDismissal(popupErr)) {
                        setError(null)
                        return
                    }
                    // See Login.tsx's handleGoogleLogin for why this fallback
                    // exists — popup sign-in depends on third-party storage
                    // access that browsers increasingly block by default, which
                    // surfaces as a generic auth/internal-error. Redirect doesn't
                    // have that dependency. The invite token is already safely in
                    // sessionStorage (capturePendingInviteToken ran on mount), so
                    // it survives the full-page round trip through Google.
                    if (popupErr.code === 'auth/internal-error' || popupErr.code === 'auth/popup-blocked') {
                        console.warn('[AUTH] Popup sign-up blocked — falling back to redirect:', popupErr.code)
                        try {
                            await signInWithRedirect(auth, provider)
                            return
                        } catch (redirectErr: any) {
                            // If the redirect fallback ALSO fails, this isn't a
                            // popup/third-party-cookie issue — it's a Firebase/
                            // Google Cloud config problem (provider disabled,
                            // API key restriction, etc). Say so distinctly.
                            console.error('[AUTH] Redirect fallback ALSO failed (not a popup/cookie issue):', redirectErr)
                            setError(
                                'Google sign-up is failing at the account level, not just in this browser — the popup AND the redirect method both failed the same way. ' +
                                'This points to a Firebase/Google Cloud configuration problem rather than anything on your end. Please use email/password for now.'
                            )
                            return
                        }
                    }
                    throw popupErr
                }
            }
        } catch (err: any) {
            setError(getAuthErrorMessage(err, 'Google sign-up failed. Please try again.'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            {/* Background gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-600/5 pointer-events-none" />

            <div className="w-full max-w-md space-y-6 relative z-10">

                {/* Logo / Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Create Your Account</h1>
                    <p className="text-sm text-muted-foreground">
                        {inviteToken
                            ? 'You have been invited to EvaraTDS — set a password to accept'
                            : 'Sign up to access the EvaraTDS dashboard'
                        }
                    </p>
                </div>

                {/* Invite Badge */}
                {inviteToken && (
                    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-sm text-emerald-400 font-medium text-center">
                        Invitation confirmed — your role will be assigned automatically after sign-up
                    </div>
                )}

                {/* Register Form */}
                <GlassCard className="p-6 space-y-4">
                    <form onSubmit={handleRegister} className="space-y-4">

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                required
                                className={cn(
                                    'w-full px-4 py-2.5 rounded-xl border bg-white/5 text-foreground placeholder:text-muted-foreground/60',
                                    'text-sm outline-none transition-all',
                                    'focus:border-cyan-500/60 focus:bg-white/10 focus:ring-1 focus:ring-cyan-500/30',
                                    'border-white/15'
                                )}
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Min. 8 characters"
                                    autoComplete="new-password"
                                    required
                                    className={cn(
                                        'w-full px-4 py-2.5 pr-10 rounded-xl border bg-white/5 text-foreground placeholder:text-muted-foreground/60',
                                        'text-sm outline-none transition-all',
                                        'focus:border-cyan-500/60 focus:bg-white/10 focus:ring-1 focus:ring-cyan-500/30',
                                        'border-white/15'
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Confirm Password
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repeat your password"
                                autoComplete="new-password"
                                required
                                className={cn(
                                    'w-full px-4 py-2.5 rounded-xl border bg-white/5 text-foreground placeholder:text-muted-foreground/60',
                                    'text-sm outline-none transition-all',
                                    'focus:border-cyan-500/60 focus:bg-white/10 focus:ring-1 focus:ring-cyan-500/30',
                                    confirmPassword && password !== confirmPassword
                                        ? 'border-red-500/50 bg-red-500/5'
                                        : 'border-white/15'
                                )}
                            />
                            {confirmPassword && password !== confirmPassword && (
                                <p className="text-xs text-red-400 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Passwords do not match
                                </p>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-2 text-sm text-red-400">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Submit — variant="ghost" so this custom gradient background
                            actually renders. The default/outline Button variants apply
                            glass-system-child, whose background is set with !important;
                            that unconditionally wins over any bg-* class passed in via
                            className, which is exactly what made this button (and the
                            Google button below) render as a plain, textless white box. */}
                        <Button
                            type="submit"
                            variant="ghost"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98]"
                        >
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </Button>

                        {/* Divider */}
                        <div className="flex items-center gap-3 py-1">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">or</span>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>

                        {/* Google Sign-Up — stays on this page so the invite token in the URL is preserved */}
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleGoogleRegister}
                            disabled={loading}
                            className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 font-medium text-sm border border-white/15 bg-white/5 hover:bg-white/10 text-foreground/80"
                        >
                            <GoogleIcon />
                            <span>Continue with Google</span>
                        </Button>
                    </form>

                    {/* Login Link */}
                    <p className="text-center text-sm text-muted-foreground pt-2 border-t border-white/10">
                        Already have an account?{' '}
                        <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                            Sign in
                        </Link>
                    </p>
                </GlassCard>

                {/* Security Note */}
                <p className="text-center text-xs text-muted-foreground/60">
                    Your account access is controlled by the system administrator.
                    {!inviteToken && ' Without an invite link, you will receive read-only access.'}
                </p>
            </div>
        </div>
    )
}
