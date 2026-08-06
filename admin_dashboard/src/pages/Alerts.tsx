import { useEffect, useState, useMemo } from 'react'
import { type Alert } from '../types'
import { AlertTriangle, CheckCircle, WifiOff, Camera, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { useRole } from '../context/RoleContext'
import { queueAction } from '../lib/syncQueue'
import { fetchAlerts, acknowledgeAlertApi, resolveAlertApi } from '../lib/api'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useViewport } from '../hooks/useViewport'

export default function Alerts() {
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const { user } = useAuth()
    const { isOffline } = useUI()
    const { isLandscape, isDesktop } = useViewport()
    const { hasPermission, role } = useRole()
    const [filter, setFilter] = useState<'all' | 'critical'>('all')
    const [resolving, setResolving] = useState<string | null>(null)

    // Real-time Firestore stream (<100ms latency) + API fallback
    useEffect(() => {
        let mounted = true

        // 1. Primary: Real-time Firestore onSnapshot listener
        let unsubscribe: (() => void) | null = null
        try {
            const alertsRef = collection(db, 'alerts')
            const q = query(alertsRef, where('status', 'in', ['open', 'acknowledged']))
            unsubscribe = onSnapshot(q, (snapshot) => {
                if (!mounted) return
                const liveAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert))
                // Sort newest first
                liveAlerts.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                setAlerts(liveAlerts)
                setFetchError(null)
                setLoading(false)
            }, (err) => {
                console.warn('⚡ [REAL-TIME] Firestore listener fallback:', err)
            })
        } catch (e) {
            console.warn('⚡ [REAL-TIME] Firestore setup failed:', e)
        }

        // 2. Fallback: API polling
        const load = async () => {
            try {
                const data = await fetchAlerts(50)
                if (!mounted) return
                const activeAlerts = (data as Alert[]).filter(a => a.status !== 'resolved')
                setAlerts(activeAlerts)
                setFetchError(null)
            } catch (error) {
                if (!mounted) return
                console.error('Error fetching alerts:', error)
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        const timer = setInterval(load, 15000)

        return () => {
            mounted = false
            if (unsubscribe) unsubscribe()
            clearInterval(timer)
        }
    }, [])

    const acknowledgeAlert = async (id: string) => {
        if (!user) return
        try {
            if (isOffline) {
                queueAction('ACKNOWLEDGE_ALERT', { alertId: id, userId: user.uid, role })
                return
            }
            await acknowledgeAlertApi(id, user.uid, role)
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const } : a))
        } catch (error) {
            console.error('Error acknowledging alert:', error)
        }
    }

    const resolveAlert = async (id: string, note?: string) => {
        if (!user) return
        if (resolving) return // Prevent double-click
        setResolving(id)
        try {
            if (isOffline) {
                queueAction('RESOLVE_ALERT', { alertId: id, userId: user.uid, role })
                // Remove immediately from UI on offline action
                setAlerts(prev => prev.filter(a => a.id !== id))
                return
            }
            await resolveAlertApi(id, user.uid, role, note)
            // Remove immediately from active UI as soon as resolved
            setAlerts(prev => prev.filter(a => a.id !== id))
        } catch (error) {
            console.error('Error resolving alert:', error)
        } finally {
            setResolving(null)
        }
    }

    const stats = useMemo(() => {
        const active = alerts.filter(a => a.status !== 'resolved')
        return {
            total: active.length,
            open: active.filter(a => a.status === 'open').length,
            critical: active.filter(a => a.severity === 'critical').length
        }
    }, [alerts])

    const filteredAlerts = alerts.filter(a => {
        // Exclude any resolved alerts
        if (a.status === 'resolved') return false

        if (filter === 'all') return true
        if (filter === 'critical') return a.severity === 'critical'
        return true
    })

    return (
        <div className="space-y-3 md:space-y-6 max-w-[1200px] mx-auto pb-20 pt-2 md:pt-0 px-4 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        System Alerts
                        {isOffline && <WifiOff className="h-5 w-5 text-muted-foreground animate-pulse" />}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">Active real-time alerts requiring attention</p>
                </div>
                <div className="flex glass-system-inset p-1 rounded-xl border-0">
                    {(['all', 'critical'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-4 py-2 rounded-md text-xs font-bold capitalize transition-all",
                                filter === f ? "glass-system-child text-foreground shadow-sm border-white/10" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <GlassCard className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                    <AlertCircle className="w-7 h-7 md:w-8 md:h-8 text-red-400 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xl md:text-2xl font-bold text-foreground leading-none">{stats.critical}</p>
                        <p className="text-[9px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1 truncate">Critical</p>
                    </div>
                </GlassCard>
                <GlassCard className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                    <AlertTriangle className="w-7 h-7 md:w-8 md:h-8 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xl md:text-2xl font-bold text-foreground leading-none">{stats.total}</p>
                        <p className="text-[9px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1 truncate">Active Alerts</p>
                    </div>
                </GlassCard>
                <GlassCard className="p-4 md:p-5 flex items-center gap-3 md:gap-4 col-span-2 md:col-span-1">
                    <AlertTriangle className="w-7 h-7 md:w-8 md:h-8 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xl md:text-2xl font-bold text-foreground leading-none">{stats.open}</p>
                        <p className="text-[9px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1 truncate">Open</p>
                    </div>
                </GlassCard>
            </div>

            {/* Alert List */}
            <div className="space-y-4">
                {loading ? (
                    // Loading Skeleton
                    Array.from({ length: 3 }).map((_, i) => (
                        <GlassCard key={i} className="p-4 md:p-5 animate-pulse">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-white/5 rounded w-1/3" />
                                    <div className="h-3 bg-white/5 rounded w-2/3" />
                                </div>
                            </div>
                        </GlassCard>
                    ))
                ) : filteredAlerts.length === 0 || fetchError ? (
                    <GlassCard className="text-center py-16 border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
                        <CheckCircle className="h-12 w-12 text-emerald-400/80 mx-auto mb-1" />
                        <h3 className="text-base font-bold text-foreground">All Systems Operational</h3>
                        <p className="text-xs text-muted-foreground">No issues found. All devices operating within safe parameters.</p>
                    </GlassCard>
                ) : (
                    filteredAlerts.map(alert => (
                        <GlassCard
                            key={alert.id}
                            className={cn(
                                "relative transition-all duration-300 border-white/20",
                                isLandscape && !isDesktop ? "p-3 px-4" : "p-4 md:p-5",
                                alert.severity === 'critical' && alert.status === 'open' ? 'shadow-[0_0_15px_rgba(239,68,68,0.1)] border-red-500/30' :
                                'hover:shadow-xl'
                            )}
                        >
                            <div className={cn(
                                "flex items-start gap-3 md:gap-4",
                                isLandscape && !isDesktop && "items-center"
                            )}>
                                <div className={cn(
                                    "p-2 rounded-xl shrink-0 glass-system-micro border-white/10",
                                    isLandscape && !isDesktop ? "mt-0" : "mt-1",
                                    alert.severity === 'critical' ? 'text-red-400' : 'text-blue-400'
                                )}>
                                    <AlertTriangle className={cn(isLandscape && !isDesktop ? "h-3.5 w-3.5" : "h-4 w-4 md:h-5 md:w-5")} />
                                </div>

                                <div className={cn(
                                    "flex-1 min-w-0",
                                    isLandscape && !isDesktop && "flex items-center justify-between gap-6"
                                )}>
                                    <div className={cn(
                                        "flex justify-between items-start",
                                        isLandscape && !isDesktop ? "mb-0 flex-1" : "mb-2"
                                    )}>
                                        <div className="min-w-0 flex-1 pr-2">
                                            <h2 className="font-bold text-foreground text-sm md:text-base flex items-center flex-wrap gap-2 truncate leading-tight">
                                                {alert.device_name || alert.device_id || 'Unknown Device'}
                                                {(alert.escalation_level || 0) > 0 && (
                                                    <span className="bg-red-500/20 text-red-500 dark:text-red-400 text-[8px] md:text-[10px] px-1.5 md:px-2 py-0.5 rounded border border-red-500/30 font-black tracking-wider animate-pulse">
                                                        ESC
                                                    </span>
                                                )}
                                            </h2>
                                            {!isLandscape && <p className="text-foreground/80 text-xs md:text-sm mt-1 leading-relaxed line-clamp-2 md:line-clamp-none">{alert.message}</p>}
                                        </div>
                                        <span className="text-[10px] font-black font-mono text-muted-foreground bg-white/5 md:bg-accent px-2 py-1 rounded-lg shrink-0">
                                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className={cn(
                                        "flex items-center justify-between",
                                        isLandscape && !isDesktop ? "mt-0" : "mt-4"
                                    )}>
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 md:gap-4">
                                                <div className={cn(
                                                    "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5",
                                                    alert.status === 'open' && "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]",
                                                    alert.status === 'acknowledged' && "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                )}>
                                                    {alert.status === 'open' && <AlertTriangle className="w-2.5 h-2.5" />}
                                                    {alert.status === 'acknowledged' && <CheckCircle className="w-2.5 h-2.5" />}
                                                    {alert.status}
                                                </div>

                                                <div className="flex gap-1 md:gap-2">
                                                    {!isLandscape && (
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 md:h-7 md:w-auto md:px-3 text-xs text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg">
                                                            <Camera className="h-4 w-4 md:mr-1.5 shrink-0" /> <span className="hidden md:inline">Photo</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            {hasPermission('maintenance_mode') && alert.status === 'open' && (
                                                <Button
                                                    onClick={() => acknowledgeAlert(alert.id)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 h-8 px-4 rounded-xl active:scale-95 transition-all"
                                                >
                                                    ACK
                                                </Button>
                                            )}
                                            {hasPermission('resolve_alert') && (alert.status === 'open' || alert.status === 'acknowledged') && (
                                                <Button
                                                    onClick={() => resolveAlert(alert.id)}
                                                    disabled={resolving === alert.id}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 h-8 px-4 rounded-xl active:scale-95 transition-all disabled:opacity-60"
                                                >
                                                    {resolving === alert.id ? '...' : 'RESOLVE'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    ))
                )}
            </div>
        </div>
    )
}
