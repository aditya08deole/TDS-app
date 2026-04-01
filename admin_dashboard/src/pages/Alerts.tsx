import { useEffect, useState, useMemo } from 'react'
import { db } from '../lib/firebase'
import { collection, query, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore'
import { type Alert } from '../types'
import { AlertTriangle, CheckCircle, WifiOff, Camera, FileText, Bell, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { useRole } from '../context/RoleContext'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Alerts() {
    const [alerts, setAlerts] = useState<Alert[]>([])
    const { user } = useAuth()
    const { isOffline } = useUI()
    const { hasPermission } = useRole()
    const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all')

    useEffect(() => {
        const fetchAlerts = async () => {
            // setLoading(true)
            try {
                const q = query(
                    collection(db, 'alerts'),
                    orderBy('created_at', 'desc'),
                    limit(50)
                )
                const snap = await getDocs(q)
                setAlerts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Alert[])
            } catch (error) {
                console.error('Error fetching alerts:', error)
            } finally {
                // setLoading(false)
            }
        }

        fetchAlerts()
    }, [])

    const acknowledgeAlert = async (id: string) => {
        if (!user) return
        try {
            const docRef = doc(db, 'alerts', id)
            await updateDoc(docRef, {
                status: 'acknowledged',
                acknowledged_at: new Date().toISOString()
            })
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : a))
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
            setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved', resolved_at: timestamp, resolved_by: user.uid } : a))
        } catch (error) {
            console.error('Error resolving alert:', error)
        }
    }

    const stats = useMemo(() => {
        return {
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'critical' && a.status !== 'resolved').length,
            warning: alerts.filter(a => a.severity === 'warning' && a.status !== 'resolved').length
        }
    }, [alerts])

    const filteredAlerts = alerts.filter(a => {
        if (filter === 'all') return true
        if (filter === 'critical') return a.severity === 'critical'
        if (filter === 'warning') return a.severity === 'warning'
        return true
    })

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        System Alerts
                        {isOffline && <WifiOff className="h-6 w-6 text-muted-foreground animate-pulse" />}
                    </h1>
                    <p className="text-muted-foreground mt-1">Critical system notifications and logs</p>
                </div>
                <div className="flex glass-system-inset p-1 rounded-xl border-0">
                    {['all', 'critical', 'warning'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <GlassCard className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 glass-system-micro flex items-center justify-center text-red-400 border-white/10 shadow-lg">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">{stats.critical}</p>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Critical Active</p>
                    </div>
                </GlassCard>
                <GlassCard className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 glass-system-micro flex items-center justify-center text-orange-400 border-white/10 shadow-lg">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">{stats.warning}</p>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Warnings Active</p>
                    </div>
                </GlassCard>
                <GlassCard className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 glass-system-micro flex items-center justify-center text-blue-400 border-white/10 shadow-lg">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total logged</p>
                    </div>
                </GlassCard>
            </div>

            {/* Alert List */}
            <div className="space-y-4">
                {filteredAlerts.length === 0 ? (
                    <GlassCard className="text-center py-20 border-dashed border-accent flex flex-col items-center">
                        <CheckCircle className="h-12 w-12 text-green-500/50 mx-auto mb-4" />
                        <p className="text-muted-foreground text-lg">All systems normal. No active alerts.</p>
                    </GlassCard>
                ) : (
                    filteredAlerts.map(alert => (
                        <GlassCard
                            key={alert.id}
                            className={cn(
                                "relative p-5 transition-all duration-300 border-white/20",
                                alert.severity === 'critical' && alert.status === 'open' ? 'shadow-[0_0_15px_rgba(239,68,68,0.1)] border-red-500/30' :
                                alert.severity === 'warning' && alert.status === 'open' ? 'shadow-[0_0_15px_rgba(249,115,22,0.1)] border-orange-500/30' :
                                'hover:shadow-xl'
                            )}
                        >
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "mt-1 p-2 rounded-xl shrink-0 glass-system-micro border-white/10",
                                    alert.severity === 'critical' ? 'text-red-400' :
                                    alert.severity === 'warning' ? 'text-orange-400' :
                                    'text-blue-400'
                                )}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                                {alert.device_name || 'Unknown Device'}
                                                {(alert.escalation_level || 0) > 0 && (
                                                    <span className="bg-red-500/20 text-red-500 dark:text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30 font-bold tracking-wider animate-pulse">
                                                        ESCALATED
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-foreground/80 text-sm mt-1 leading-relaxed">{alert.message}</p>
                                        </div>
                                        <span className="text-xs font-mono text-muted-foreground bg-accent px-2 py-1 rounded">
                                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20">
                                                    <Camera className="h-3.5 w-3.5 mr-1.5" /> Attach Photo
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground bg-accent hover:bg-accent/80">
                                                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Add Note
                                                </Button>
                                            </div>
                                            {alert.acknowledged_at && <span className="text-emerald-500 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Acknowledged</span>}
                                        </div>

                                        <div className="flex gap-2">
                                            {hasPermission('maintenance_mode') && alert.status === 'open' && (
                                                <Button
                                                    onClick={() => acknowledgeAlert(alert.id)}
                                                    className="bg-blue-500 hover:bg-blue-600 text-xs font-semibold shadow-lg shadow-blue-500/20 h-8"
                                                >
                                                    Acknowledge
                                                </Button>
                                            )}
                                            {hasPermission('maintenance_mode') && alert.status === 'acknowledged' && (
                                                <Button
                                                    onClick={() => resolveAlert(alert.id)}
                                                    className="bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold shadow-lg shadow-emerald-500/20 h-8"
                                                >
                                                    Resolve
                                                </Button>
                                            )}
                                            {alert.status === 'resolved' && (
                                                <span className="text-emerald-500 text-xs font-bold px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                                                    <CheckCircle className="w-3.5 h-3.5" /> Resolved
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
