import { useState, useEffect } from 'react'
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInWithCredential } from 'firebase/auth'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, UserPlus, ShieldCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'

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
 * 2. They create a Firebase account — email/password OR Google (both stay on
 *    this page so the ?token= stays in the URL for step 3)
 * 3. onAuthStateChanged fires in AuthContext → fetches profile
 * 4. fetchProfile detects the token in the URL and calls redeemInviteApi
 * 5. User gets their role and is redirected to the dashboard
 *
 * If no token is present, user still registers but gets the default 'viewer' role.
 *
 * IMPORTANT: Google Sign-In must happen from THIS page (not /login) for invited
 * users — /login's Google button has no invite token in its URL, so a user who
 * skips this page and signs in with Google from /login silently gets 'viewer'
 * instead of their invited role.
 */
export default function Register() {
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Detect invite token in URL
    const params = new URLSearchParams(window.location.search)
    const inviteToken = params.get('token') || params.get('invite') || null

    // Pre-fill email from URL if provided
    useEffect(() => {
        const emailParam = params.get('email')
        if (emailParam) setEmail(emailParam)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            // AuthContext.fetchProfile picks up the invite token from the URL and
            // calls redeemInviteApi automatically. Redirect to dashboard.
            navigate('/', { replace: true })
        } catch (err: any) {
            const code = err?.code || ''
            if (code === 'auth/email-already-in-use') {
                setError('An account with this email already exists. Please login instead.')
            } else if (code === 'auth/weak-password') {
                setError('Password is too weak. Use at least 8 characters with numbers.')
            } else if (code === 'auth/invalid-email') {
                setError('Invalid email address.')
            } else {
                setError(err.message || 'Registration failed. Please try again.')
            }
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
                    // Stay on /register?token=... — AuthContext.fetchProfile reads
                    // the token straight from window.location.search.
                    navigate('/', { replace: true })
                } else {
                    throw new Error('Google Sign-In failed or was cancelled')
                }
            } else {
                const provider = new GoogleAuthProvider()
                const result = await signInWithPopup(auth, provider)
                if (result.user) {
                    navigate('/', { replace: true })
                }
            }
        } catch (err: any) {
            if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
                setError(null)
            } else {
                setError(err.message || 'Google sign-up failed. Please try again.')
            }
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
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30">
                        <ShieldCheck className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Join EvaraTDS</h1>
                    <p className="text-sm text-muted-foreground">
                        {inviteToken
                            ? 'You\'ve been invited — create your account to accept'
                            : 'Create your account to access the dashboard'
                        }
                    </p>
                </div>

                {/* Invite Badge */}
                {inviteToken && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-sm">
                        <UserPlus className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-400 font-medium">Invite link detected — your role will be assigned automatically</span>
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

                        {/* Submit */}
                        <Button
                            type="submit"
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
                            variant="outline"
                            onClick={handleGoogleRegister}
                            disabled={loading}
                            className="w-full h-11 rounded-xl flex items-center justify-center gap-2.5 font-medium text-sm border-white/15 bg-white/5 hover:bg-white/10 text-foreground/80"
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
