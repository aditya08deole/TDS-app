import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRole } from '../context/RoleContext'
import { db } from '../lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { fetchWhatsAppRecipients, addWhatsAppRecipientApi, removeWhatsAppRecipientApi, type WhatsAppRecipient } from '../lib/api'
import {
    User, Bell, Shield, LogOut, Moon, Mail, ChevronRight, Save, Loader2, CheckCircle,
    Globe, Lock, Layout, BellRing, UserCircle, Volume2, VolumeX,
    MessageSquare, Zap, Smartphone, ExternalLink, Info, Copy, Trash2, Plus
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
    const { role } = useRole()
    const { theme, setTheme } = useTheme()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<SettingsTab>('general')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [whatsAppRecipients, setWhatsAppRecipients] = useState<WhatsAppRecipient[]>([])
    const [newPhone, setNewPhone] = useState('')
    const [recipientLoading, setRecipientLoading] = useState(false)

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

    useEffect(() => {
        const loadRecipients = async () => {
            if (!user || (role !== 'admin' && role !== 'super_admin')) return
            try {
                setRecipientLoading(true)
                const data = await fetchWhatsAppRecipients(role)
                setWhatsAppRecipients(data.filter(r => r.active))
            } catch (error) {
                console.error('Failed to load WhatsApp recipients', error)
            } finally {
                setRecipientLoading(false)
            }
        }
        loadRecipients()
    }, [user, role])

    const addRecipient = async () => {
        if (!user) return
        const phone = newPhone.trim()
        if (!/^\+91\d{10}$/.test(phone)) {
            toast.error('Use +91XXXXXXXXXX format')
            return
        }
        try {
            setRecipientLoading(true)
            await addWhatsAppRecipientApi(phone, user.uid, role)
            const data = await fetchWhatsAppRecipients(role)
            setWhatsAppRecipients(data.filter(r => r.active))
            setNewPhone('')
            toast.success('WhatsApp recipient added')
        } catch (error: any) {
            toast.error(error?.message || 'Failed to add recipient')
        } finally {
            setRecipientLoading(false)
        }
    }

    const removeRecipient = async (phone: string) => {
        if (!user) return
        try {
            setRecipientLoading(true)
            await removeWhatsAppRecipientApi(phone, user.uid, role)
            setWhatsAppRecipients(prev => prev.filter(r => r.phone_e164 !== phone))
            toast.success('Recipient removed')
        } catch (error: any) {
            toast.error(error?.message || 'Failed to remove recipient')
        } finally {
            setRecipientLoading(false)
        }
    }

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

                                {/* WhatsApp Alerts */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-green-500/10 text-green-500"><MessageSquare className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">WhatsApp Alerts</p>
                                            <p className="text-xs text-muted-foreground text-slate-400">Direct critical alerts to your phone</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-green-500/10 text-green-500 border-green-500/20">
                                            ACTIVE
                                        </span>
                                        <Switch
                                            checked={settings.whatsapp_alerts}
                                            onCheckedChange={() => toggleSetting('whatsapp_alerts')}
                                        />
                                    </div>
                                </div>

                                {(role === 'admin' || role === 'super_admin') && (
                                    <div className="p-4 space-y-3 border-t border-white/5">
                                        <div className="text-left">
                                            <p className="text-foreground font-medium">WhatsApp Recipients</p>
                                            <p className="text-xs text-muted-foreground">Add/remove Indian numbers in +91XXXXXXXXXX format</p>
                                        </div>

                                        <div className="flex gap-2">
                                            <input
                                                value={newPhone}
                                                onChange={(e) => setNewPhone(e.target.value)}
                                                placeholder="+919876543210"
                                                className="flex-1 h-9 bg-transparent border border-accent rounded-lg px-3 text-sm"
                                            />
                                            <Button onClick={addRecipient} disabled={recipientLoading} className="h-9 text-xs">
                                                <Plus className="w-3.5 h-3.5 mr-1" /> Add
                                            </Button>
                                        </div>

                                        <div className="space-y-2 max-h-40 overflow-auto pr-1">
                                            {whatsAppRecipients.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No active recipients</p>
                                            ) : (
                                                whatsAppRecipients.map((recipient) => (
                                                    <div key={recipient.id} className="flex items-center justify-between bg-accent/30 rounded-lg px-3 py-2">
                                                        <span className="text-xs font-mono text-foreground">{recipient.phone_e164}</span>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRecipient(recipient.phone_e164)}>
                                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                        </Button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* NTFY Alerts */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><Smartphone className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">NTFY System Alerts</p>
                                            <p className="text-xs text-muted-foreground text-slate-400">High-priority system-level notifications</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-orange-500/10 text-orange-500 border-orange-500/20">
                                            ACTIVE
                                        </span>
                                        <Switch
                                            checked={settings.ntfy_alerts}
                                            onCheckedChange={() => toggleSetting('ntfy_alerts')}
                                        />
                                    </div>
                                </div>

                                {/* IFTTT Integration */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-black/10 text-foreground dark:bg-white/10"><Zap className="w-5 h-5" /></div>
                                        <div>
                                            <p className="text-foreground font-medium">IFTTT Webhooks</p>
                                            <p className="text-xs text-muted-foreground text-slate-400">Trigger smart home automation</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/20">
                                            READY
                                        </span>
                                        <Switch
                                            checked={settings.ifttt_alerts}
                                            onCheckedChange={() => toggleSetting('ifttt_alerts')}
                                        />
                                    </div>
                                </div>

                                {/* Webhook Configuration Info */}
                                <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10 mt-4">
                                    <div className="flex items-start gap-3">
                                        <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="text-sm font-bold text-blue-400">Webhook Integration</h4>
                                                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                                    To receive WhatsApp messages or trigger webhooks from your local system, you must expose your backend to the internet.
                                                </p>
                                            </div>
                                            
                                            <div className="flex flex-col gap-2">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Twilio Webhook URL</p>
                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-black/20 border border-white/5">
                                                    <code className="text-[10px] text-blue-300 font-mono truncate flex-1">
                                                        https://your-tunnel.ngrok-free.app/api/notifications/whatsapp
                                                    </code>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                                            navigator.clipboard.writeText('https://your-tunnel.ngrok-free.app/api/notifications/whatsapp');
                                                            toast.info('Copied to clipboard');
                                                        } else {
                                                            toast.error('Clipboard access denied');
                                                        }
                                                    }}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            <Button variant="link" className="p-0 h-auto text-blue-400 text-xs font-bold hover:text-blue-300" onClick={() => window.open('https://ngrok.com', '_blank')}>
                                                Setup ngrok tunnel <ExternalLink className="w-3 h-3 ml-1" />
                                            </Button>
                                        </div>
                                    </div>
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
