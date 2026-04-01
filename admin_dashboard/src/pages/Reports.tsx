import { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/firebase'
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore'
import {
    Activity,
    TrendingUp,
    AlertTriangle,
    Download,
    FileText,
    BarChart3,
    Server,
    Database
} from 'lucide-react'
import { useUI } from '../context/UIContext'
import { GlassCard } from '../components/GlassCard'

interface UptimeStat {
    device_id: string
    device_name: string
    uptime_percent: number
    total_online_seconds: number
    total_tracked_seconds: number
    outage_count: number
}

interface HealthLog {
    id: string
    component: string
    status: string
    latency_ms: number
    error_details?: string
    checked_at: string
}

export default function Reports() {
    const { isOffline } = useUI()
    const [activeTab, setActiveTab] = useState<'analytics' | 'health'>('analytics')
    const [stats, setStats] = useState<UptimeStat[]>([])
    const [healthLogs, setHealthLogs] = useState<HealthLog[]>([])
    const [days, setDays] = useState(30)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchStats = async () => {
            if (isOffline) return
            setLoading(true)

            try {
                if (activeTab === 'analytics') {
                    // NOTE: This was a Supabase RPC. For Firestore, we'd typically use a Cloud Function.
                    // For now, we'll fetch devices and mock uptime until the migration is fully mature.
                    const q = collection(db, 'devices')
                    const snap = await getDocs(q)
                    const mockStats = snap.docs.map(doc => {
                        const d = doc.data()
                        return {
                            device_id: doc.id,
                            device_name: d.name || 'Unknown',
                            uptime_percent: 100, // Mocked
                            total_online_seconds: 0,
                            total_tracked_seconds: 0,
                            outage_count: 0
                        }
                    })
                    setStats(mockStats)
                } else {
                    const q = query(
                        collection(db, 'system_health_logs'),
                        orderBy('checked_at', 'desc'),
                        limit(50)
                    )
                    const snap = await getDocs(q)
                    setHealthLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as HealthLog[])
                }
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchStats()
    }, [days, isOffline, activeTab])

    // Aggregate Stats
    const systemHealth = useMemo(() => {
        if (!stats.length) return { avgUptime: 0, totalOutages: 0 }
        const avgUptime = stats.reduce((acc, curr) => acc + curr.uptime_percent, 0) / stats.length
        const totalOutages = stats.reduce((acc, curr) => acc + curr.outage_count, 0)
        return { avgUptime, totalOutages }
    }, [stats])

    const handleDownloadCSV = () => {
        const headers = ["Device Name", "Uptime %", "Outages", "Total Tracked (hrs)", "Online (hrs)"]
        const rows = stats.map(s => [
            s.device_name,
            s.uptime_percent.toFixed(2),
            s.outage_count,
            (s.total_tracked_seconds / 3600).toFixed(1),
            (s.total_online_seconds / 3600).toFixed(1)
        ])

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `evara_uptime_report_${days}d_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        Reports & Analytics
                    </h1>
                    <p className="text-muted-foreground mt-1">System performance and availability metrics</p>
                </div>

                <div className="flex bg-secondary p-1 rounded-lg border border-accent">
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <BarChart3 className="w-4 h-4" /> Analytics
                    </button>
                    <button
                        onClick={() => setActiveTab('health')}
                        className={`px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === 'health' ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Activity className="w-4 h-4" /> System Health
                    </button>
                </div>
            </div>

            {activeTab === 'analytics' && (
                <>
                    <div className="flex justify-end gap-2">
                        <div className="flex bg-secondary p-1 rounded-lg border border-accent">
                            {[7, 30, 90].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${days === d ? 'glass-system-child text-foreground shadow-md border-white/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                >
                                    {d} Days
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleDownloadCSV}
                            className="flex items-center gap-2 px-4 py-2 glass-system-child text-primary-foreground rounded-lg text-xs font-bold transition-all border-white/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                            disabled={loading || stats.length === 0}
                        >
                            <Download className="h-4 w-4" /> Export CSV
                        </button>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <GlassCard size="md" className="p-5 flex items-center gap-4">
                            <div className="w-12 h-12 glass-system-micro flex items-center justify-center text-emerald-400 border-white/10 shadow-lg">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{systemHealth.avgUptime.toFixed(1)}%</p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg Fleet Availability</p>
                            </div>
                        </GlassCard>
                        <GlassCard size="md" className="p-5 flex items-center gap-4">
                            <div className="w-12 h-12 glass-system-micro flex items-center justify-center text-red-400 border-white/10 shadow-lg">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{systemHealth.totalOutages}</p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Outage Events</p>
                            </div>
                        </GlassCard>
                        <GlassCard size="md" className="p-5 flex items-center gap-4">
                            <div className="w-12 h-12 glass-system-micro flex items-center justify-center text-blue-400 border-white/10 shadow-lg">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">{stats.length}</p>
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Devices Monitored</p>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Data Table */}
                    <GlassCard size="lg" className="overflow-hidden border border-accent">
                        <div className="p-4 border-b border-accent flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" /> Availability Report
                            </h3>
                            <span className="text-xs text-muted-foreground">Generated {new Date().toLocaleDateString()}</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="glass-system-child text-muted-foreground font-black uppercase tracking-widest text-[10px] border-b border-white/5">
                                    <tr>
                                        <th className="p-4">Device</th>
                                        <th className="p-4">Uptime</th>
                                        <th className="p-4">Outages</th>
                                        <th className="p-4">Tracked Time</th>
                                        <th className="p-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-accent">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">Loading report data...</td>
                                        </tr>
                                    ) : stats.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">No data available for this period.</td>
                                        </tr>
                                    ) : (
                                        stats.map(device => (
                                            <tr key={device.device_id} className="hover:glass-system-child transition-colors group border-b border-white/5 last:border-0">
                                                <td className="p-4 font-medium text-foreground">{device.device_name}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 glass-system-inset rounded-full overflow-hidden border-0">
                                                            <div
                                                                className={`h-full rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)] ${device.uptime_percent > 99 ? 'bg-emerald-500' : device.uptime_percent > 95 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                style={{ width: `${device.uptime_percent}%` }}
                                                            />
                                                        </div>
                                                        <span className={`font-mono ${device.uptime_percent > 99 ? 'text-emerald-500' : device.uptime_percent > 95 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'}`}>
                                                            {device.uptime_percent}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-foreground/70">{device.outage_count}</td>
                                                <td className="p-4 text-muted-foreground font-mono">{(device.total_tracked_seconds / 3600).toFixed(1)}h</td>
                                                <td className="p-4">
                                                    {device.uptime_percent > 99 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500">Excellent</span>
                                                    ) : device.uptime_percent > 90 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-600 dark:text-yellow-500">Fair</span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">Poor</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>
                </>
            )}

            {activeTab === 'health' && (
                <GlassCard size="lg" className="overflow-hidden border border-accent">
                    <div className="p-4 border-b border-accent flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Server className="h-4 w-4 text-muted-foreground" /> Infrastructure Status
                        </h3>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                                <Database className="w-3 h-3" /> Firebase: Operational
                            </span>
                            <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                                <Activity className="w-3 h-3" /> ThingSpeak: Operational
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-secondary text-muted-foreground font-medium">
                                <tr>
                                    <th className="p-4">Component</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Latency</th>
                                    <th className="p-4">Measured At</th>
                                    <th className="p-4">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-accent">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">Checking system health...</td>
                                    </tr>
                                ) : healthLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                            No recent health logs. (Scheduled checks might be pending)
                                        </td>
                                    </tr>
                                ) : (
                                    healthLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-accent/30 transition-colors font-mono text-xs">
                                            <td className="p-4 font-semibold text-foreground">{log.component}</td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded font-medium ${log.status === 'operational' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-red-500/10 text-red-500'
                                                    }`}>
                                                    {log.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-foreground/70">{log.latency_ms}ms</td>
                                            <td className="p-4 text-muted-foreground">{new Date(log.checked_at).toLocaleString()}</td>
                                            <td className="p-4 text-muted-foreground max-w-xs truncate" title={log.error_details}>
                                                {log.error_details || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}
        </div>
    )
}
