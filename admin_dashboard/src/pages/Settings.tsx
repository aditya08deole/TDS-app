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
    whatsapp_alerts: boolean
    ntfy_alerts: boolean
    ifttt_alerts: boolean
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
        testSound,
        testNotification,
        soundProfile,
        setSoundProfile,
        permission, 
        loading: notificationLoading 
    } = useNotification()

    // Initial state setup (only once or when user loads)
    const [settings, setSettings] = useState<UserSettings>({
        notifications_enabled: true,
        email_alerts: false,
        whatsapp_alerts: true,
        ntfy_alerts: true,
        ifttt_alerts: false,
        dark_mode: theme === 'dark'
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
                        whatsapp_alerts: data.whatsapp_alerts ?? true,
                        ntfy_alerts: data.ntfy_alerts ?? true,
                        ifttt_alerts: data.ifttt_alerts ?? false,
                        dark_mode: theme === 'dark'
                    })
                }
            } catch (err) {
                console.log('No settings found, using defaults', err)
            }
            setLoading(false)
        }
        loadSettings()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])



    const saveSettings = async () => {
        if (!user) return
        setSaving(true)
        try {
            const docRef = doc(db, 'user_settings', user.uid)
            const finalSettings = {
                ...settings,
                dark_mode: theme === 'dark' // Ensure we save the current active theme
            }
            await setDoc(docRef, {
                ...finalSettings,
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
        if (key === 'dark_mode') {
            setTheme(theme === 'dark' ? 'light' : 'dark')
            return
        }
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
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in text-left px-4 pt-2 md:pt-0">
            {/* Sidebar (Left Panel) */}
            <div className="w-full lg:w-64 shrink-0 space-y-4 md:space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
                    <p className="text-muted-foreground text-[10px] mt-0.5 font-medium uppercase tracking-wider">System Preferences</p>
                </div>

                <GlassCard className="p-2 flex flex-col gap-1">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as SettingsTab)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === item.id
                                ? 'glass-system-child text-foreground shadow-lg border-white/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                }`}
                        >
                            <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                            {item.label}
                        </button>
                    ))}
                </GlassCard>

                <GlassCard className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 glass-system-micro flex items-center justify-center text-primary-foreground font-black border-white/20 shadow-lg">
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

                            <div className="glass-system-parent rounded-2xl overflow-hidden border-white/10 divide-y divide-white/5 shadow-xl">
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Moon className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Dark Mode</p>
                                            <p className="text-xs text-muted-foreground">Force application wide dark theme</p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={theme === 'dark'}
                                        onCheckedChange={() => toggleSetting('dark_mode')}
                                    />
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-left">
                                        <div className="p-2.5 glass-system-micro border-white/10 text-purple-400"><Globe className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">Language</p>
                                            <p className="text-xs text-muted-foreground">Regional preference</p>
                                        </div>
                                    </div>
                                    <Select defaultValue="en">
                                        <SelectTrigger className="w-[140px] h-9 glass-system-inset border-white/10 shadow-inner">
                                            <SelectValue placeholder="Language" />
                                        </SelectTrigger>
                                        <SelectContent className="glass-system-parent border-white/20 shadow-2xl backdrop-blur-3xl">
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

                            <div className="glass-system-child overflow-hidden border-0 divide-y divide-white/5">
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

                                {/* Alert Sound Tone Selection */}
                                <div className={`p-4 flex items-center justify-between transition-all ${!soundEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                            <Volume2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-foreground font-medium">Alert Tone</p>
                                            <p className="text-xs text-muted-foreground text-slate-400">Select notification sound profile</p>
                                        </div>
                                    </div>
                                    <Select 
                                        value={soundProfile} 
                                        onValueChange={setSoundProfile}
                                        disabled={!soundEnabled}
                                    >
                                        <SelectTrigger className="w-[160px] h-9 bg-transparent border-accent">
                                            <SelectValue placeholder="Select tone" />
                                        </SelectTrigger>
                                        <SelectContent className="glass-card border-accent">
                                            <SelectItem value="classic">Evara Classic (Default)</SelectItem>
                                            <SelectItem value="modern">Modern Chime</SelectItem>
                                            <SelectItem value="digital">Digital Pulse</SelectItem>
                                            <SelectItem value="sonar">Sonar Scan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Test Utilities */}
                                <div className="p-4 flex flex-wrap gap-3">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={testNotification}
                                        className="h-8 text-xs border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-500"
                                    >
                                        <BellRing className="w-3.5 h-3.5 mr-2" />
                                        Test Notification
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={testSound}
                                        className="h-8 text-xs border-purple-500/30 hover:bg-purple-500/10 text-purple-500"
                                    >
                                        <Volume2 className="w-3.5 h-3.5 mr-2" />
                                        Test Audio Alert
                                    </Button>
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
