import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Alert } from '../lib/supabase'
import { AlertTriangle, CheckCircle, WifiOff, Camera, FileText, Bell, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { offlineStore } from '../lib/offlineStore'
import { useUI } from '../context/UIContext'

import { useRole } from '../context/RoleContext'

export default function Alerts() {
    const [alerts, setAlerts] = useState<Alert[]>([])
    const { user } = useAuth()
    const { isOffline } = useUI()
    const { hasPermission } = useRole()
    const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all')

    useEffect(() => {
        const loadAlerts = async () => {
            // Mock Data Injection if empty (for UI testing)
            // We can check if alerts is empty after load
            if (!navigator.onLine) {
                // Offline: Load from IDB
                const cached = await offlineStore.getAlerts()
                setAlerts(cached.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
            } else {
                // Online: Fetch & Cache
                const { data } = await supabase
                    .from('alerts')
                    .select('*, devices(name)')
                    .order('created_at', { ascending: false })
                    .limit(50)

                if (data) {
                    const typedData = data as unknown as Alert[]
                    setAlerts(typedData)
                    offlineStore.cacheAlerts(typedData)
                }
            }
        }

        loadAlerts()

        // Sync Queue if Online
        const syncQueue = async () => {
            if (navigator.onLine) {
                const queue = await offlineStore.getPendingActions()
                for (const action of queue) {
                    try {
                        if (action.type === 'ACKNOWLEDGE_ALERT') {
                            await supabase.from('alerts').update({ status: 'acknowledged' }).eq('id', action.payload.id)
                        } else if (action.type === 'RESOLVE_ALERT') {
                            await supabase.from('alerts').update({
                                status: 'resolved',
                                resolved_at: action.payload.resolved_at,
                                resolved_by: action.payload.resolved_by
                            }).eq('id', action.payload.id)
                        }
                        await offlineStore.removeAction(action.id)
                    } catch (e) {
                        console.error('Sync failed for action', action.id, e)
                    }
                }
            }
        }

        // Listen for online event to sync
        window.addEventListener('online', syncQueue)

        // Realtime Subscription (Only when online)
        let subscription: any
        if (navigator.onLine) {
            syncQueue()
            subscription = supabase
                .channel('alerts')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setAlerts(prev => [payload.new as Alert, ...prev])
                    } else if (payload.eventType === 'UPDATE') {
                        setAlerts(prev => prev.map(a => a.id === payload.new.id ? { ...a, ...payload.new } : a) as Alert[])
                    }
                })
                .subscribe()
        }

        return () => {
            if (subscription) subscription.unsubscribe()
            window.removeEventListener('online', syncQueue)
        }
    }, [isOffline])

    const acknowledgeAlert = async (id: string) => {
        if (!user) return
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : a))
        if (navigator.onLine) {
            await supabase.rpc('acknowledge_alert', { p_alert_id: id, p_actor_id: user.id })
        } else {
            await offlineStore.queueAction('ACKNOWLEDGE_ALERT', { id })
        }
    }

    const resolveAlert = async (id: string) => {
        if (!user) return
        const timestamp = new Date().toISOString()
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved', resolved_at: timestamp, resolved_by: user.id } : a))

        if (navigator.onLine) {
            await supabase.rpc('resolve_alert', { p_alert_id: id, p_actor_id: user.id, p_notes: null })
        } else {
            await offlineStore.queueAction('RESOLVE_ALERT', { id, resolved_at: timestamp, resolved_by: user.id })
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
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        System Alerts
                        {isOffline && <WifiOff className="h-6 w-6 text-slate-500 animate-pulse" />}
                    </h1>
                    <p className="text-[#86868b] mt-1">Critical system notifications and logs</p>
                </div>
                <div className="flex bg-[#1c1c1e] p-1 rounded-lg border border-white/10">
                    {['all', 'critical', 'warning'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-md text-xs font-medium capitalize transition-all ${filter === f ? 'bg-[#3a3a3c] text-white shadow-sm' : 'text-[#86868b] hover:text-white'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-5 rounded-xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats.critical}</p>
                        <p className="text-xs text-[#86868b] font-medium uppercase tracking-wider">Critical Active</p>
                    </div>
                </div>
                <div className="glass-panel p-5 rounded-xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats.warning}</p>
                        <p className="text-xs text-[#86868b] font-medium uppercase tracking-wider">Warnings Active</p>
                    </div>
                </div>
                <div className="glass-panel p-5 rounded-xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white">{stats.total}</p>
                        <p className="text-xs text-[#86868b] font-medium uppercase tracking-wider">Total logged</p>
                    </div>
                </div>
            </div>

            {/* Alert List */}
            <div className="space-y-4">
                {filteredAlerts.length === 0 ? (
                    <div className="text-center py-20 glass-card rounded-2xl border-dashed border-white/10">
                        <CheckCircle className="h-12 w-12 text-green-500/50 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg">All systems normal. No active alerts.</p>
                    </div>
                ) : (
                    filteredAlerts.map(alert => (
                        <div
                            key={alert.id}
                            className={`
                                group relative p-5 rounded-xl border transition-all duration-300
                                ${alert.severity === 'critical' && alert.status === 'open' ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10' :
                                    alert.severity === 'warning' && alert.status === 'open' ? 'bg-orange-500/5 border-orange-500/20 hover:bg-orange-500/10' :
                                        'glass-card hover:bg-white/5'}
                            `}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`mt-1 p-2 rounded-lg shrink-0 ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                                    alert.severity === 'warning' ? 'bg-orange-500/10 text-orange-500' :
                                        'bg-blue-500/10 text-blue-500'
                                    }`}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-white flex items-center gap-2">
                                                {alert.devices?.name || 'Unknown Device'}
                                                {(alert.escalation_level || 0) > 0 && (
                                                    <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded border border-red-500/30 font-bold tracking-wider animate-pulse">
                                                        ESCALATED
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-slate-300 text-sm mt-1 leading-relaxed">{alert.message}</p>
                                        </div>
                                        <span className="text-xs font-mono text-[#86868b] bg-white/5 px-2 py-1 rounded">
                                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex gap-2">
                                                <button className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors bg-cyan-500/10 px-2.5 py-1.5 rounded-md hover:bg-cyan-500/20">
                                                    <Camera className="h-3.5 w-3.5" /> Attach Photo
                                                </button>
                                                <button className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors bg-white/5 px-2.5 py-1.5 rounded-md hover:bg-white/10">
                                                    <FileText className="h-3.5 w-3.5" /> Add Note
                                                </button>
                                            </div>
                                            {alert.acknowledged_at && <span className="text-emerald-500 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Acknowledged</span>}
                                        </div>

                                        <div className="flex gap-2">
                                            {hasPermission('maintenance_mode') && alert.status === 'open' && (
                                                <button
                                                    onClick={() => acknowledgeAlert(alert.id)}
                                                    className="px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                                                >
                                                    Acknowledge
                                                </button>
                                            )}
                                            {hasPermission('maintenance_mode') && alert.status === 'acknowledged' && (
                                                <button
                                                    onClick={() => resolveAlert(alert.id)}
                                                    className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                                                >
                                                    Resolve
                                                </button>
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
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
