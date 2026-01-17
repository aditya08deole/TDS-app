import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)

    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from?.pathname || '/'

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error
            navigate(from, { replace: true })
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('Failed to login')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background Gradient */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-600/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-500/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Partner Logos - Top Corners */}
            <div className="absolute top-6 left-6 z-10">
                <img
                    src="/evaratech-logo.png"
                    alt="EvaraTech"
                    className="h-10 md:h-12 object-contain opacity-90 hover:opacity-100 transition-opacity"
                />
            </div>
            <div className="absolute top-6 right-6 z-10">
                <img
                    src="/iiith-logo.png"
                    alt="IIIT Hyderabad"
                    className="h-10 md:h-12 object-contain opacity-90 hover:opacity-100 transition-opacity invert"
                />
            </div>

            {/* Login Card */}
            <div className="w-full max-w-md relative z-10">
                {/* Glass Card */}
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 md:p-10">
                    {/* App Logo & Title */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-xl animate-pulse" />
                            <img
                                src="/pwa-512x512.png"
                                alt="EvaraTDS"
                                className="relative h-20 w-20 rounded-2xl shadow-lg shadow-blue-500/20"
                            />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Sign in to your account</h1>
                        <p className="text-white/50 mt-2 text-sm">Water Quality Monitoring System</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400">
                            <AlertCircle className="h-5 w-5 flex-shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email Input */}
                        <div className="space-y-2">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 placeholder:text-white/30 transition-all text-sm"
                                    placeholder="Your Email"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 pl-12 pr-12 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 placeholder:text-white/30 transition-all text-sm"
                                    placeholder="Password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold py-3.5 rounded-full shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide"
                        >
                            {loading ? 'Authenticating...' : 'Login'}
                        </button>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-white/50 cursor-pointer hover:text-white/70 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/20"
                                />
                                Remember me
                            </label>
                            <a href="#" className="text-white/50 hover:text-white transition-colors">
                                Forgot Password
                            </a>
                        </div>

                        {/* Sign Up Link */}
                        <div className="text-center pt-4 border-t border-white/5">
                            <p className="text-white/40 text-sm">
                                If you do not have an account, <a href="#" className="text-white/70 hover:text-white underline transition-colors">Sign up</a>
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer Text */}
                <p className="text-center text-white/30 text-xs mt-6">
                    A collaboration between EvaraTech & IIIT Hyderabad
                </p>
            </div>
        </div>
    )
}
