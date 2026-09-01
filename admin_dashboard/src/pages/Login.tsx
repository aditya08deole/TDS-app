import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { auth } from '../lib/firebase'
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,        // Fix #1: switched from signInWithRedirect — no stuck spinner
    signInWithRedirect,     // Fallback when the popup itself is blocked — see handleGoogleLogin
    getRedirectResult,      // Surfaces errors from a completed/failed redirect round trip
    sendPasswordResetEmail, // Fix #3: forgot password implementation
    sendEmailVerification,  // Fix #23: email verification on sign-up
    signOut as firebaseSignOut,
} from 'firebase/auth'
import { Lock, Mail, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { capturePendingInviteToken } from '../lib/pendingInvite'
import { getAuthErrorMessage, isBenignPopupDismissal } from '../lib/authErrors'
import { useAuth } from '../context/AuthContext'

// Custom Google Icon
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94L5.84 14.1z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
)

import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { signInWithCredential } from 'firebase/auth'

export default function Login() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null) // Fix #3 success toast
    const [showPassword, setShowPassword] = useState(false)

    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from?.pathname || '/'
    const { user } = useAuth()

    // signInWithRedirect (the fallback in handleGoogleLogin below, used when
    // the popup itself is blocked) navigates the ENTIRE page away to Google
    // and back — the navigate() call queued after awaiting it never runs on
    // THIS page load, since execution doesn't resume here. When the user
    // lands back on /login, AuthContext's onAuthStateChanged already picks
    // up the now-authenticated user on its own, but nothing was sending them
    // anywhere — they were stuck looking at the login form while already
    // signed in, which read as "it redirected me back to login again".
    // This effect is what actually completes that trip.
    useEffect(() => {
        if (user) {
            navigate(from, { replace: true })
        }
    }, [user, from, navigate])

    // Surface a real error if the redirect round trip itself failed (e.g. the
    // user closed/cancelled it, or a genuine auth error occurred). A no-op
    // when there was no pending redirect to resolve.
    useEffect(() => {
        getRedirectResult(auth).catch((err) => {
            if (isBenignPopupDismissal(err)) return
            console.error('Redirect sign-in failed:', err)
            setError(getAuthErrorMessage(err, 'Google sign-in failed. Please try again.'))
        })
    }, [])

    // If this page was reached with an invite token (e.g. an existing account
    // clicked through from /register, or was sent a /login?token= link
    // directly), stash it immediately so AuthContext can redeem it once
    // sign-in completes — see lib/pendingInvite.ts.
    useEffect(() => {
        capturePendingInviteToken()
    }, [])

    // Cursor Glow Effect
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const x = e.clientX;
            const y = e.clientY;
            document.documentElement.style.setProperty('--mouse-x', `${x}px`);
            document.documentElement.style.setProperty('--mouse-y', `${y}px`);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccessMessage(null)

        if (isSignUp && password !== confirmPassword) {
            setError("Passwords do not match")
            setLoading(false)
            return
        }

        try {
            if (isSignUp) {
                // Fix #23: Send email verification before allowing access
                const userCred = await createUserWithEmailAndPassword(auth, email, password)
                await sendEmailVerification(userCred.user)
                // Sign them out until they verify
                await firebaseSignOut(auth)
                setSuccessMessage('Account created! Please check your email to verify before signing in.')
                setIsSignUp(false)
                setPassword('')
                setConfirmPassword('')
                return // Don't navigate
            } else {
                await signInWithEmailAndPassword(auth, email, password)
                navigate(from, { replace: true })
            }
        } catch (err: any) {
            console.error('Auth failed:', err)
            setError(getAuthErrorMessage(err, 'Authentication failed. Please try again.'))
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setLoading(true)
        setError(null)
        setSuccessMessage(null)
        try {
            if (Capacitor.isNativePlatform()) {
                // Native Android (Capacitor) path — unchanged
                const result = await FirebaseAuthentication.signInWithGoogle()
                if (result.credential?.idToken) {
                    const credential = GoogleAuthProvider.credential(result.credential.idToken)
                    await signInWithCredential(auth, credential)
                    // Fix #2: setLoading(false) before navigate to prevent race condition
                    setLoading(false)
                    navigate(from, { replace: true })
                } else {
                    throw new Error("Google Sign-In failed or was cancelled")
                }
            } else {
                // Fix #1: Use signInWithPopup instead of signInWithRedirect
                // — popup stays on the same page, result is immediately available,
                //   no redirect loop, and loading state is properly cleaned up.
                const provider = new GoogleAuthProvider()
                try {
                    const result = await signInWithPopup(auth, provider)
                    if (result.user) {
                        navigate(from, { replace: true })
                    }
                } catch (popupErr: any) {
                    if (isBenignPopupDismissal(popupErr)) {
                        setError(null)
                        return
                    }
                    // signInWithPopup depends on a hidden cross-origin iframe (the
                    // Firebase auth handler) being able to read/write storage —
                    // browsers increasingly block that by default, popup-blocked
                    // or not, surfacing as a generic auth/internal-error with no
                    // indication that's what happened. signInWithRedirect doesn't
                    // have this dependency: it's a real top-level navigation
                    // through Google and back, so it isn't affected by third-party
                    // storage restrictions at all. AuthContext's onAuthStateChanged
                    // picks up the result automatically once the user lands back
                    // here — no separate getRedirectResult() handling needed.
                    if (popupErr.code === 'auth/internal-error' || popupErr.code === 'auth/popup-blocked') {
                        console.warn('[AUTH] Popup sign-in blocked — falling back to redirect:', popupErr.code)
                        await signInWithRedirect(auth, provider)
                        return
                    }
                    throw popupErr
                }
            }
        } catch (err: any) {
            console.error('Google login failed:', err)
            setError(getAuthErrorMessage(err, 'Google login failed. Please try again.'))
        } finally {
            setLoading(false)
        }
    }

    // Fix #3: Forgot Password implementation using sendPasswordResetEmail
    const handleForgotPassword = async () => {
        setError(null)
        setSuccessMessage(null)
        if (!email) {
            setError('Please enter your email address first, then click Forgot Password.')
            return
        }
        setLoading(true)
        try {
            await sendPasswordResetEmail(auth, email)
            setSuccessMessage(`Password reset email sent to ${email}. Check your inbox!`)
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
                // Don't reveal if email exists for security
                setSuccessMessage(`If an account exists for ${email}, a reset email has been sent.`)
            } else {
                setError(getAuthErrorMessage(err, 'Failed to send reset email. Please try again.'))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-transparent flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-primary/30">
            {/* EvaraTech Branding Logo (Only on Login) */}
            <div className="fixed top-8 left-8 z-[100] pointer-events-none select-none">
                <img src="/evaratech-logo.png" alt="Evaratech" className="h-10 sm:h-14 w-auto object-contain opacity-80 drop-shadow-xl" />
            </div>

            {/* Interactive Cursor Glow */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    background: `radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(6, 182, 212, 0.08), transparent 80%)`
                }}
            />

            {/* Decorative Overlay */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
            </div>

            {/* Login Card */}
            <div className="w-full max-w-[440px] relative z-10 animate-in fade-in zoom-in-95 duration-700">
                <GlassCard size="lg" className="p-8 md:px-10 md:py-8 ring-1 ring-accent">

                    {/* App Logo & Title */}
                    <div className="flex items-center justify-center gap-5 mb-8">
                        <div className="relative group shrink-0">
                            <div className="absolute inset-0 bg-cyan-500/20 rounded-2xl blur-xl group-hover:bg-cyan-500/40 transition-all duration-500" />
                            <img
                                src="/pwa-192x192.png"
                                alt="EvaraTDS"
                                className="relative h-14 w-14 rounded-2xl shadow-2xl transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                        <div className="text-left">
                            <h1 className="text-2xl font-bold text-foreground tracking-tight leading-none">
                                {isSignUp ? 'Create Account' : 'Welcome'}
                            </h1>
                            <p className="text-muted-foreground/80 mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em]">
                                TDS Monitoring System
                            </p>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-5 bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-center gap-2.5 text-red-400 animate-in slide-in-from-top-1">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs font-medium">{error}</span>
                        </div>
                    )}

                    {/* Fix #3: Success Message (for password reset & email verification) */}
                    {successMessage && (
                        <div className="mb-5 bg-green-500/5 border border-green-500/10 rounded-xl p-3 flex items-center gap-2.5 text-green-400 animate-in slide-in-from-top-1">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                            <span className="text-xs font-medium">{successMessage}</span>
                        </div>
                    )}

                    {/* Auth Form */}
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="grid grid-cols-1 gap-3.5">
                            {/* Email Input */}
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-cyan-400 transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full glass-system-inset bg-background/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-foreground focus:outline-none focus:border-cyan-500/30 focus:ring-4 focus:ring-cyan-500/5 placeholder:text-muted-foreground/60 transition-all text-sm"
                                    placeholder="Enter your email"
                                />
                            </div>

                            {/* Password Input */}
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-cyan-400 transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full glass-system-inset bg-background/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-11 text-foreground focus:outline-none focus:border-cyan-500/30 focus:ring-4 focus:ring-cyan-500/5 placeholder:text-muted-foreground/60 transition-all text-sm"
                                    placeholder="Password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            {/* Confirm Password (only for Sign Up) */}
                            {isSignUp && (
                                <div className="relative group animate-in slide-in-from-top-1">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 group-focus-within:text-cyan-400 transition-colors" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-background/40 border border-accent/40 rounded-xl py-3 pl-11 pr-11 text-foreground focus:outline-none focus:border-cyan-500/30 focus:ring-4 focus:ring-cyan-500/5 placeholder:text-muted-foreground/60 transition-all text-xs"
                                        placeholder="Confirm password"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Buttons Row */}
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full premium-button text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-900/10 active:scale-[0.98] disabled:opacity-50 text-sm tracking-wide"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full premium-button text-foreground/80 font-medium py-3 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-50 text-xs border-dashed"
                            >
                                <GoogleIcon />
                                <span>Google login</span>
                            </button>
                        </div>

                        {/* Action Links */}
                        <div className="flex items-center justify-between pt-5 border-t border-accent">
                            <p className="text-muted-foreground/70 text-xs">
                                {isSignUp ? "Joined?" : "New here?"}
                                <button
                                    type="button"
                                    onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMessage(null); }}
                                    className="ml-1.5 text-cyan-400 hover:text-cyan-600 font-bold transition-colors"
                                >
                                    {isSignUp ? 'Sign In' : 'Create One'}
                                </button>
                            </p>
                            {/* Fix #3: Forgot Password now has a real handler */}
                            {!isSignUp && (
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={loading}
                                    className="text-[10px] text-muted-foreground/50 hover:text-cyan-400 transition-colors font-medium disabled:opacity-50"
                                >
                                    Forgot Password?
                                </button>
                            )}
                        </div>
                    </form>
                </GlassCard>
            </div>
        </div>
    )
}
