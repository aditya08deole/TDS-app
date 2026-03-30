import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
    User, Bell, Shield, LogOut, Moon, Mail, ChevronRight, Save, Loader2, CheckCircle,
    Globe, Lock, Layout, BellRing, UserCircle
} from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface UserSettings {
    notifications_enabled: boolean
    email_alerts: boolean
    dark_mode: boolean
}

type SettingsTab = 'general' | 'notifications' | 'data' | 'account'

export default function Settings() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<SettingsTab>('general')
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
                const docRef = doc(db, 'user_settings', user.uid)
                const docSnap = await getDoc(docRef)

                if (docSnap.exists()) {
                    const data = docSnap.data()
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
            const docRef = doc(db, 'user_settings', user.uid)
            await setDoc(docRef, {
                ...settings,
                user_id: user.uid,
                updated_at: new Date().toISOString()
            }, { merge: true })

            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error('Failed to save settings:', err)
        }
        setSaving(false)
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    const toggleSetting = (key: keyof UserSettings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const menuItems = [
        { id: 'general', label: 'General', icon: Layout },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'account', label: 'Account & Security', icon: UserCircle },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-140px)]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">
            {/* Sidebar (Left Panel) */}
            <div className="w-full lg:w-64 shrink-0 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
                    <p className="text-muted-foreground text-sm mt-1">System Preferences</p>
                </div>

                <GlassCard className="p-2 flex flex-col gap-1">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as SettingsTab)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === item.id
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                }`}
                        >
                            <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                            {item.label}
                        </button>
                    ))}
                </GlassCard>

                <GlassCard className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-primary-foreground font-bold">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                            <p className="text-xs text-muted-foreground">Administrator</p>
                        </div>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={handleLogout}
                        className="w-full h-9 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                    >
                        <LogOut className="h-3.5 w-3.5 mr-2" />
                        Sign Out
                    </Button>
                </GlassCard>
            </div>

            {/* Content (Right Panel) */}
            <GlassCard className="flex-1 p-6 lg:p-8 overflow-y-auto">
                <div className="max-w-2xl mx-auto space-y-8">

                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">General Settings</h2>
                                <p className="text-muted-foreground text-sm">Customize viewing experience</p>
                            </div>

                            <div className="bg-secondary/50 rounded-xl overflow-hidden border border-accent divide-y divide-accent">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Moon className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Dark Mode</p>
                                            <p className="text-xs text-muted-foreground">Force application wide dark theme</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.dark_mode}
                                        onCheckedChange={() => toggleSetting('dark_mode')}
                                    />
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><Globe className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Language</p>
                                            <p className="text-xs text-muted-foreground">English (US)</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Notifications</h2>
                                <p className="text-muted-foreground text-sm">Manage alert delivery</p>
                            </div>

                            <div className="bg-secondary/50 rounded-xl overflow-hidden border border-accent divide-y divide-accent">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><BellRing className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Push Notifications</p>
                                            <p className="text-xs text-muted-foreground">Receive critical alerts on device</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.notifications_enabled}
                                        onCheckedChange={() => toggleSetting('notifications_enabled')}
                                    />
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Mail className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Email Alerts</p>
                                            <p className="text-xs text-muted-foreground">Weekly digest and critical errors</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={settings.email_alerts}
                                        onCheckedChange={() => toggleSetting('email_alerts')}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Account & Security</h2>
                                <p className="text-muted-foreground text-sm">Update profile and security keys</p>
                            </div>

                            <div className="bg-secondary/50 rounded-xl overflow-hidden border border-accent divide-y divide-accent">
                                <div className="p-4 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-slate-500/10 text-slate-400"><User className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Edit Profile</p>
                                            <p className="text-xs text-muted-foreground">Name, Avatar</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="p-4 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Lock className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Change Password</p>
                                            <p className="text-xs text-muted-foreground">Last changed 3 months ago</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="p-4 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Shield className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">2FA Authentication</p>
                                            <p className="text-xs text-muted-foreground">Enabled</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded">Active</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-accent">
                        <Button
                            onClick={saveSettings}
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/25 min-w-[140px]"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <CheckCircle className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {saved ? 'Saved' : 'Save Changes'}
                        </Button>
                    </div>

                </div>
            </GlassCard>
        </div>
    )
}
