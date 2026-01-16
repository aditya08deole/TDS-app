import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Alert } from '../lib/supabase'
import { AlertTriangle, CheckCircle, WifiOff, Camera, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { offlineStore } from '../lib/offlineStore'
import { useUI } from '../context/UIContext'

// Extended Alert type for Phase 6
// interface ExtendedAlert extends Alert {
//     photo_url?: string
//     notes?: string
// }


export default function Alerts() {
    const [alerts, setAlerts] = useState<Alert[]>([])
    const { user } = useAuth()
    const { isOffline } = useUI()

    useEffect(() => {
        const loadAlerts = async () => {
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
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
                    setAlerts(prev => [payload.new as Alert, ...prev])
                })
                .subscribe()
        }

        return () => {
            if (subscription) subscription.unsubscribe()
            window.removeEventListener('online', syncQueue)
        }
    }, [isOffline])

    const acknowledgeAlert = async (id: number) => {
        // Optimistic Update
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a))

        if (navigator.onLine) {
            await supabase.from('alerts').update({ status: 'acknowledged' }).eq('id', id)
        } else {
            await offlineStore.queueAction('ACKNOWLEDGE_ALERT', { id })
        }
    }

    const resolveAlert = async (id: number) => {
        if (!user) return
        const timestamp = new Date().toISOString()

        // Optimistic Update
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a))

        if (navigator.onLine) {
            await supabase.from('alerts').update({
                status: 'resolved',
                resolved_at: timestamp,
                resolved_by: user.id
            }).eq('id', id)
        } else {
            await offlineStore.queueAction('RESOLVE_ALERT', { id, resolved_at: timestamp, resolved_by: user.id })
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    System Alerts
                    {isOffline && <WifiOff className="h-6 w-6 text-slate-500" />}
                </h1>
                <p className="text-slate-400 mt-2">Critical warnings and system notifications.</p>
            </div>

            <div className="space-y-4">
                {alerts.map(alert => (
                    <div
                        key={alert.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border ${alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' : 'bg-orange-500/10 border-orange-500/20'
                            } transition-all`}
                    >
                        <div className={`p-2 rounded-lg ${alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                            <AlertTriangle className="h-6 w-6" />
                        </div>

                        <div className="flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white flex items-center gap-2">
                                        {alert.devices?.name || 'Unknown Device'}
                                        {alert.escalation_level > 0 && (
                                            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded border border-red-500/30 animate-pulse">
                                                ESCALATED
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-slate-400 text-sm mt-1">{alert.message}</p>
                                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                        <span>{new Date(alert.created_at).toLocaleString()}</span>
                                        {alert.acknowledged_at && <span className="text-emerald-500/80">Acknowledged</span>}
                                    </div>
                                    {/* Phase 6: Field Notes/Photo Mock */}
                                    <div className="flex gap-2 mt-2">
                                        <button className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                                            <Camera className="h-3 w-3" /> Attach Photo
                                        </button>
                                        <button className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                                            <FileText className="h-3 w-3" /> Add Note
                                        </button>
                                    </div>
                                </div>
                                {alert.status === 'open' && (
                                    <button
                                        onClick={() => acknowledgeAlert(alert.id)}
                                        className="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 text-sm font-medium transition-colors border border-blue-500/30"
                                    >
                                        Acknowledge
                                    </button>
                                )}
                                {alert.status === 'acknowledged' && (
                                    <button
                                        onClick={() => resolveAlert(alert.id)}
                                        className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 text-sm font-medium transition-colors border border-emerald-500/30"
                                    >
                                        Resolve
                                    </button>
                                )}
                                {alert.status === 'resolved' && (
                                    <span className="text-emerald-500 text-sm font-medium px-3 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                        Resolved
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {alerts.length === 0 && (
                    <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                        <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4 opacity-50" />
                        <p className="text-slate-400 text-lg">All systems normal. No active alerts.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
