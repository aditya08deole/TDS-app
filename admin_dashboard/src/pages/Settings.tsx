import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
    User,
    Bell,
    Shield,
    LogOut,
    Moon,
    Smartphone,
    Mail,
    ChevronRight,
    Save,
    Loader2,
    CheckCircle
} from 'lucide-react'

interface UserSettings {
    notifications_enabled: boolean
    email_alerts: boolean
    dark_mode: boolean
}

export default function Settings() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [settings, setSettings] = useState<UserSettings>({
        notifications_enabled: true,
        email_alerts: false,
        dark_mode: true
    })

    // Load user settings
    useEffect(() => {
        const loadSettings = async () => {
            if (!user) return
            setLoading(true)
            try {
                const { data } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (data) {
                    setSettings({
                        notifications_enabled: data.notifications_enabled ?? true,
                        email_alerts: data.email_alerts ?? false,
                        dark_mode: data.dark_mode ?? true
                    })
                }
            } catch (err) {
                console.log('No settings found, using defaults')
            }
            setLoading(false)
        }
        loadSettings()
    }, [user])

    // Save settings
    const saveSettings = async () => {
        if (!user) return
        setSaving(true)
        try {
            await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    ...settings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' })

            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error('Failed to save settings:', err)
        }
        setSaving(false)
    }

    // Handle logout
    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    // Toggle setting
    const toggleSetting = (key: keyof UserSettings) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Settings</h1>
                <p className="text-slate-400 mt-1 text-sm lg:text-base">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 lg:p-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <User className="h-8 w-8 lg:h-10 lg:w-10 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg lg:text-xl font-semibold text-white truncate">
                            {user?.email?.split('@')[0] || 'User'}
                        </h2>
                        <p className="text-slate-400 text-sm truncate">{user?.email}</p>
                        <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            Admin
                        </span>
                    </div>
                </div>
            </div>

            {/* Notifications Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <Bell className="h-4 w-4 text-slate-400" />
                        Notifications
                    </h3>
                </div>

                {/* Push Notifications */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/50">
                    <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="text-sm font-medium text-slate-200">Push Notifications</p>
                            <p className="text-xs text-slate-500">Receive alerts on this device</p>
                        </div>
                    </div>
                    <button
                        onClick={() => toggleSetting('notifications_enabled')}
                        className={`w-12 h-7 rounded-full transition-colors relative ${settings.notifications_enabled ? 'bg-cyan-500' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* Email Alerts */}
                <div className="flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="text-sm font-medium text-slate-200">Email Alerts</p>
                            <p className="text-xs text-slate-500">Critical alerts via email</p>
                        </div>
                    </div>
                    <button
                        onClick={() => toggleSetting('email_alerts')}
                        className={`w-12 h-7 rounded-full transition-colors relative ${settings.email_alerts ? 'bg-cyan-500' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.email_alerts ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
            </div>

            {/* Appearance Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <Moon className="h-4 w-4 text-slate-400" />
                        Appearance
                    </h3>
                </div>

                <div className="flex items-center justify-between px-4 py-4">
                    <div className="flex items-center gap-3">
                        <Moon className="h-5 w-5 text-slate-400" />
                        <div>
                            <p className="text-sm font-medium text-slate-200">Dark Mode</p>
                            <p className="text-xs text-slate-500">Use dark theme</p>
                        </div>
                    </div>
                    <button
                        onClick={() => toggleSetting('dark_mode')}
                        className={`w-12 h-7 rounded-full transition-colors relative ${settings.dark_mode ? 'bg-cyan-500' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.dark_mode ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>
            </div>

            {/* Security Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-slate-400" />
                        Security
                    </h3>
                </div>

                <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-slate-400" />
                        <div className="text-left">
                            <p className="text-sm font-medium text-slate-200">Change Password</p>
                            <p className="text-xs text-slate-500">Update your password</p>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-500" />
                </button>
            </div>

            {/* Save Button */}
            <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
                {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : saved ? (
                    <>
                        <CheckCircle className="h-5 w-5" />
                        Saved!
                    </>
                ) : (
                    <>
                        <Save className="h-5 w-5" />
                        Save Changes
                    </>
                )}
            </button>

            {/* Logout Button */}
            <button
                onClick={handleLogout}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl border border-red-500/30 transition-colors flex items-center justify-center gap-2"
            >
                <LogOut className="h-5 w-5" />
                Sign Out
            </button>

            {/* App Info */}
            <div className="text-center text-slate-500 text-xs pt-4">
                <p>EvaraTDS Dashboard v1.0.0</p>
                <p className="mt-1">© 2024 EvaraTDS. All rights reserved.</p>
            </div>
        </div>
    )
}
