import { useState, useEffect } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, UserPlus, ShieldCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Register.tsx — Invite-only registration page
 *
 * Flow:
 * 1. User lands here via invite link: /register?token=<invite_token>
 * 2. They create a Firebase email/password account
 * 3. onAuthStateChanged fires in AuthContext → fetches profile
 * 4. fetchProfile detects the token in the URL and calls redeemInviteApi
 * 5. User gets their role and is redirected to the dashboard
 *
 * If no token is present, user still registers but gets the default 'viewer' role.
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
