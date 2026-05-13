import { useEffect, useState, useMemo } from 'react'
import { db } from '../lib/firebase'
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { type Alert } from '../types'
import { AlertTriangle, CheckCircle, WifiOff, Camera, FileText, Bell, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { useRole } from '../context/RoleContext'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useViewport } from '../hooks/useViewport'

export default function Alerts() {
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [loading, setLoading] = useState(true) // true initially since we load on mount
    const { user } = useAuth()
    const { isOffline } = useUI()
    const { isLandscape, isDesktop } = useViewport()
    const { hasPermission } = useRole()
    const [filter, setFilter] = useState<'all' | 'critical'>('all')

    // Real-time listener for alerts (replaces one-time fetch)
    useEffect(() => {
        let mounted = true

        const q = query(
            collection(db, 'alerts'),
            orderBy('created_at', 'desc'),
            limit(50)
        )

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!mounted) return
            const alertData = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Alert[]
            setAlerts(alertData)
            setLoading(false)
        }, (error) => {
            if (!mounted) return
            console.error('Error fetching alerts in real-time:', error)
            setLoading(false)
        })

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [])

    const acknowledgeAlert = async (id: string) => {
        if (!user) return
        try {
            const docRef = doc(db, 'alerts', id)
            await updateDoc(docRef, {
                status: 'acknowledged',
                acknowledged_at: new Date().toISOString()
            })
        } catch (error) {
            console.error('Error acknowledging alert:', error)
        }
    }

    const resolveAlert = async (id: string) => {
        if (!user) return
        const timestamp = new Date().toISOString()
        try {
            const docRef = doc(db, 'alerts', id)
            await updateDoc(docRef, {
                status: 'resolved',
                resolved_at: timestamp,
                resolved_by: user.uid
            })
        } catch (error) {
            console.error('Error resolving alert:', error)
        }
    }

    const stats = useMemo(() => {
        return {
            total: alerts.length,
            open: alerts.filter(a => a.status === 'open').length,
            critical: alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length
        }
    }, [alerts])

    const filteredAlerts = alerts.filter(a => {
        // ═══ EXPIRY FILTER ═══
        if (a.expiresAt) {
            const expiryDate = a.expiresAt instanceof Date 
                ? a.expiresAt 
                : (a.expiresAt.seconds ? new Date(a.expiresAt.seconds * 1000) : new Date(a.expiresAt));
            
            if (expiryDate < new Date()) return false; // Filter out if expired
        }

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
                    <p className="text-muted-foreground mt-1 text-sm">Critical system notifications and logs</p>
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
                    <div className="w-10 h-10 md:w-12 md:h-12 glass-system-micro flex items-center justify-center text-red-400 border-white/10 shadow-lg shrink-0">
                        <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xl md:text-2xl font-bold text-foreground leading-none">{stats.critical}</p>
                        <p className="text-[9px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1 truncate">Critical</p>
                    </div>
                </GlassCard>
                <GlassCard className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 glass-system-micro flex items-center justify-center text-blue-400 border-white/10 shadow-lg shrink-0">
                        <Bell className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xl md:text-2xl font-bold text-foreground leading-none">{stats.total}</p>
                        <p className="text-[9px] md:text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1 truncate">Total</p>
                    </div>
                </GlassCard>
                <GlassCard className="p-4 md:p-5 flex items-center gap-3 md:gap-4 col-span-2 md:col-span-1">
                    <div className="w-10 h-10 md:w-12 md:h-12 glass-system-micro flex items-center justify-center text-amber-400 border-white/10 shadow-lg shrink-0">
                        <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
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
                ) : filteredAlerts.length === 0 ? (
                    <GlassCard className="text-center py-16 border-dashed border-accent flex flex-col items-center">
                        <CheckCircle className="h-10 w-10 text-green-500/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">All systems normal. No active alerts.</p>
                    </GlassCard>
                ) : (
                    filteredAlerts.map(alert => (
                        <GlassCard
                            key={alert.id}
                            className={cn(
                                "relative transition-all duration-300 border-white/20",
                                // Perfect Fit: Compact row for landscape
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
                                    alert.severity === 'critical' ? 'text-red-400' :
                                    'text-blue-400'
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
                                                {alert.device_name || 'Unknown Device'}
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
                                        <div className="flex items-center gap-2 md:gap-4">
                                            <div className="flex gap-1 md:gap-2">
                                                {!isLandscape && (
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 md:h-7 md:w-auto md:px-3 text-xs text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg">
                                                        <Camera className="h-4 w-4 md:mr-1.5 shrink-0" /> <span className="hidden md:inline">Attach Photo</span>
                                                    </Button>
                                                )}
                                                {!isLandscape && (
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 md:h-7 md:w-auto md:px-3 text-xs text-muted-foreground hover:text-foreground bg-accent hover:bg-accent/80 rounded-lg">
                                                        <FileText className="h-4 w-4 md:mr-1.5 shrink-0" /> <span className="hidden md:inline">Add Note</span>
                                                    </Button>
                                                )}
                                            </div>
                                            {alert.acknowledged_at && <span className="text-emerald-500 text-[10px] font-bold md:text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> <span className="hidden md:inline">Acknowledged</span></span>}
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
                                            {hasPermission('maintenance_mode') && alert.status === 'acknowledged' && (
                                                <Button
                                                    onClick={() => resolveAlert(alert.id)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 h-8 px-4 rounded-xl active:scale-95 transition-all"
                                                >
                                                    FIX
                                                </Button>
                                            )}
                                            {alert.status === 'resolved' && (
                                                <span className="text-emerald-500 text-[10px] md:text-xs font-black px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-1 uppercase tracking-widest">
                                                    <CheckCircle className="w-3.5 h-3.5" /> OK
                                                </span>
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
