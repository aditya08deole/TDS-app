import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { Activity, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'

interface DeviceEvent {
    id: string
    previous_state: string
    new_state: string
    reason: string
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
}

export default function HealthTimeline({ deviceId }: { deviceId: string }) {
    const [events, setEvents] = useState<DeviceEvent[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchEvents()
    }, [deviceId])

    const fetchEvents = async () => {
        setLoading(true)
        try {
            const q = query(
                collection(db, 'device_state_events'),
                where('device_id', '==', deviceId),
                orderBy('started_at', 'desc'),
                limit(20)
            )
            const querySnapshot = await getDocs(q)
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as DeviceEvent[]
            setEvents(data)
        } catch (error) {
            console.error('Error fetching health events:', error)
        } finally {
            setLoading(false)
        }
    }

    const getColor = (state: string) => {
        switch (state) {
            case 'online': return 'bg-emerald-500'
            case 'offline': return 'bg-red-500'
            case 'warning': return 'bg-orange-500'
            case 'critical': return 'bg-red-600'
            default: return 'bg-slate-500'
        }
    }

    const getIcon = (state: string) => {
        switch (state) {
            case 'online': return <CheckCircle className="w-3 h-3 text-emerald-400" />
            case 'offline': return <WifiOff className="w-3 h-3 text-red-400" />
            case 'warning': return <AlertTriangle className="w-3 h-3 text-orange-400" />
            default: return <Activity className="w-3 h-3 text-slate-400" />
        }
    }

    const formatDuration = (seconds: number | null, start: string) => {
        if (seconds) {
            if (seconds < 60) return `${Math.round(seconds)}s`
            if (seconds < 3600) return `${Math.round(seconds / 60)}m`
            if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
            return `${Math.round(seconds / 86400)}d`
        }
        // If still open, calculate from start to now
        const diff = (new Date().getTime() - new Date(start).getTime()) / 1000
        if (diff < 60) return `${Math.round(diff)}s (Active)`
        if (diff < 3600) return `${Math.round(diff / 60)}m (Active)`
        return `${Math.round(diff / 3600)}h (Active)`
    }

    if (loading) return <div className="animate-pulse h-12 bg-slate-800/50 rounded-xl w-full"></div>
    if (events.length === 0) return null

    // Calculate total duration for relative widths (simple normalization for now)
    // Actually, a simple flex list is better for 'event history' view style
    // For a true 'timeline' with proportional widths, we'd need more math.
    // Let's stick to a visual list first, labeled "Health Timeline"

    return (
        <div className="glass-card p-4 border-black/5 bg-white/5">
            <h3 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-2">
                <Activity className="w-3 h-3" />
                Health Timeline (Last 20 Events)
            </h3>

            {/* Visual Tape Container */}
            <div className="flex h-2 w-full bg-slate-700/50 rounded-full overflow-hidden mb-4">
                {events.slice().reverse().map((e) => (
                    <div
                        key={e.id}
                        className={`h-full ${getColor(e.new_state)} opacity-80 hover:opacity-100 transition-opacity cursor-help`}
                        style={{ flex: 1 }} // Equal width segments for now, TODO: Proportional
                        title={`${e.new_state.toUpperCase()}: ${new Date(e.started_at).toLocaleString()}`}
                    />
                ))}
            </div>

            {/* List View */}
            <div className="space-y-3 max-h-[150px] overflow-y-auto pr-1">
                {events.map((e, index) => (
                    <div key={e.id} className="relative pl-4 border-l border-slate-700/50">
                        <div className={`absolute left-[-4px] top-1.5 w-2 h-2 rounded-full ${getColor(e.new_state)}`}></div>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs text-white font-medium flex items-center gap-1.5">
                                    {getIcon(e.new_state)}
                                    <span className="capitalize">{e.new_state}</span>
                                    {index === 0 && <span className="bg-cyan-500/20 text-cyan-400 text-[9px] px-1.5 rounded uppercase tracking-wider">Current</span>}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-0.5">{e.reason || 'State Change'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-mono">
                                    {formatDuration(e.duration_seconds, e.started_at)}
                                </p>
                                <p className="text-[9px] text-slate-600">
                                    {new Date(e.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
