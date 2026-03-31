import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db } from '../lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
    User, Bell, Shield, LogOut, Moon, Mail, ChevronRight, Save, Loader2, CheckCircle,
    Globe, Lock, Layout, BellRing, UserCircle, Volume2, VolumeX
} from 'lucide-react'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNotification } from '../context/NotificationContext'
import { toast } from 'sonner'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import { useTheme } from '../context/ThemeContext'

interface UserSettings {
    notifications_enabled: boolean
    email_alerts: boolean
    dark_mode: boolean
}

type SettingsTab = 'general' | 'notifications' | 'data' | 'account'

export default function Settings() {
    const { user, signOut } = useAuth()
    const { theme, setTheme } = useTheme()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<SettingsTab>('general')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const { 
        soundEnabled, 
        toggleSound, 
        subscribe, 
        isSubscribed, 
        permission, 
        loading: notificationLoading 
    } = useNotification()

    const [settings, setSettings] = useState<UserSettings>({
        notifications_enabled: true,
        email_alerts: false,
        dark_mode: theme === 'dark'
    })

    // Sync local settings state when global theme changes (e.g. from header toggle)
    useEffect(() => {
        setSettings(prev => ({ ...prev, dark_mode: theme === 'dark' }))
    }, [theme])

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
                    const isDark = data.dark_mode ?? (theme === 'dark')
                    setSettings({
                        notifications_enabled: data.notifications_enabled ?? true,
                        email_alerts: data.email_alerts ?? false,
                        dark_mode: isDark
                    })
                    // Sync global theme with Firestore preference on load
                    setTheme(isDark ? 'dark' : 'light')
                }
            } catch (err) {
                console.log('No settings found, using defaults')
            }
            setLoading(false)
        }
        loadSettings()
    }, [user])

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
            toast.success('Settings saved successfully', {
                description: 'System preferences have been updated.'
            })
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            console.error('Failed to save settings:', err)
            toast.error('Failed to save settings')
        }
        setSaving(false)
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    const toggleSetting = (key: keyof UserSettings) => {
        const newValue = !settings[key]
        setSettings(prev => ({ ...prev, [key]: newValue }))
        
        // Immediate theme application if dark_mode toggled
        if (key === 'dark_mode') {
            setTheme(newValue ? 'dark' : 'light')
        }
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
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in text-left">
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
                        className="w-full h-9 text-xs font-semibold"
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
                                    <div className="flex items-center gap-4 text-left">
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
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><Globe className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Language</p>
                                            <p className="text-xs text-muted-foreground">Regional preference</p>
                                        </div>
                                    </div>
                                    <Select defaultValue="en">
                                        <SelectTrigger className="w-[140px] h-9 bg-transparent border-accent">
                                            <SelectValue placeholder="Language" />
                                        </SelectTrigger>
                                        <SelectContent className="glass-card border-accent">
                                            <SelectItem value="en">English (US)</SelectItem>
                                            <SelectItem value="hi">Hindi (IN)</SelectItem>
                                            <SelectItem value="es">Español</SelectItem>
                                            <SelectItem value="fr">Français</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Notifications & Sound</h2>
                                <p className="text-muted-foreground text-sm">Manage alert delivery and audio</p>
                            </div>

                            <div className="bg-secondary/50 rounded-xl overflow-hidden border border-accent divide-y divide-accent">
                                {/* Desktop Notifications */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${isSubscribed ? 'bg-cyan-500/10 text-cyan-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                            <BellRing className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-foreground font-medium">Desktop Notifications</p>
                                            <p className="text-xs text-muted-foreground">
                                                {permission === 'denied' ? 'Blocked by browser' : isSubscribed ? 'Subscribed' : 'Receive real-time alerts'}
                                            </p>
                                        </div>
                                    </div>
                                    {permission !== 'denied' && !isSubscribed ? (
                                        <Button 
                                            size="sm" 
                                            onClick={subscribe} 
                                            disabled={notificationLoading}
                                            className="bg-cyan-600 hover:bg-cyan-500 text-white h-8 text-xs"
                                        >
                                            {notificationLoading ? 'Enabling...' : 'Enable'}
                                        </Button>
                                    ) : (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isSubscribed ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                            {isSubscribed ? 'ACTIVE' : 'BLOCKED'}
                                        </span>
                                    )}
                                </div>

                                {/* Sound Alerts */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${soundEnabled ? 'bg-cyan-500/10 text-cyan-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="text-foreground font-medium">Sound Alerts</p>
                                            <p className="text-xs text-muted-foreground text-slate-400">Play audio when alerts arrive</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={soundEnabled}
                                        onCheckedChange={toggleSound}
                                    />
                                </div>

                                {/* Email Alerts */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><Mail className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Email Weekly Digest</p>
                                            <p className="text-xs text-muted-foreground text-slate-400">Summary reports each Monday</p>
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
                                <div 
                                    onClick={() => toast.info('Profile editing available in next update')}
                                    className="p-4 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="p-2 rounded-lg bg-slate-500/10 text-slate-400"><User className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Edit Profile</p>
                                            <p className="text-xs text-muted-foreground">Name, Avatar</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div 
                                    onClick={() => toast.info('Password management handled via Firebase Auth')}
                                    className="p-4 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Lock className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Change Password</p>
                                            <p className="text-xs text-muted-foreground">Last changed 3 months ago</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="p-4 flex items-center justify-between hover:bg-accent/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-4 text-left">
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
                            className="font-medium min-w-[140px]"
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
