import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { SensorData, Alert } from '../lib/supabase'
import { Activity, Droplets, Server, Wifi, AlertTriangle, Clock } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useUI } from '../context/UIContext'
import { Link } from 'react-router-dom'

export default function Dashboard() {
    const { isMobile } = useUI()
    const [data, setData] = useState<SensorData[]>([])
    const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
    const [deviceStats, setDeviceStats] = useState({
        total: 0,
        online: 0,
        warning: 0,
        critical: 0,
        offline: 0
    })
    const [avgTds, setAvgTds] = useState(0)

    const fetchDeviceStats = async () => {
        const { data: devices } = await supabase.from('devices').select('id, status')
        const { data: heartbeats } = await supabase.from('device_heartbeat').select('device_id, status')

        if (devices) {
            const stats = { total: devices.length, online: 0, warning: 0, critical: 0, offline: 0 }

            devices.forEach(d => {
                const hb = heartbeats?.find(h => h.device_id === d.id)
                const effStatus = (hb?.status || d.status || 'offline').toUpperCase()

                if (effStatus === 'ONLINE') stats.online++
                else if (effStatus === 'DEGRADED' || effStatus === 'MAINTENANCE') stats.warning++
                else if (effStatus === 'CRITICAL') stats.critical++
                else stats.offline++
            })
            setDeviceStats(stats)
        }
    }

    const fetchRecentAlerts = async () => {
        const { data } = await supabase
            .from('alerts')
            .select('*, devices(name)')
            .order('created_at', { ascending: false })
            .limit(3)

        if (data) setRecentAlerts(data)
    }

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: sensorData } = await supabase
                .from('sensor_data')
                .select('*')
                .order('recorded_at', { ascending: false })
                .limit(isMobile ? 10 : 30)

            if (sensorData) {
                setData([...sensorData].reverse())
                const avg = sensorData.reduce((sum, d) => sum + (d.tds || 0), 0) / sensorData.length
                setAvgTds(Math.round(avg))
            }

            await fetchDeviceStats()
            await fetchRecentAlerts()
        }

        fetchInitialData()

        const sensorSub = supabase
            .channel('dashboard_sensor')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, (payload) => {
                setData(prev => [...prev, payload.new as SensorData].slice(isMobile ? -10 : -30))
                fetchDeviceStats()
            })
            .subscribe()

        const hbSub = supabase
            .channel('dashboard_heartbeat')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'device_heartbeat' }, () => {
                fetchDeviceStats()
            })
            .subscribe()

        return () => {
            sensorSub.unsubscribe()
            hbSub.unsubscribe()
        }
    }, [isMobile])

    const StatCard = ({ title, value, icon: Icon, color, subtitle }: {
        title: string
        value: number | string
        icon: React.ElementType
        color: 'cyan' | 'emerald' | 'orange' | 'red' | 'slate'
        subtitle?: string
    }) => {
        const colorClasses = {
            cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
            emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
            orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30',
            red: 'from-red-500/20 to-red-600/5 border-red-500/30',
            slate: 'from-slate-500/20 to-slate-600/5 border-slate-500/30',
        }

        const iconColors = {
            cyan: 'text-cyan-400',
            emerald: 'text-emerald-400',
            orange: 'text-orange-400',
            red: 'text-red-400',
            slate: 'text-slate-400',
        }

        return (
            <div className={`stat-card bg-gradient-to-br ${colorClasses[color]} pressable cursor-pointer`}>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{title}</span>
                    <Icon className={`h-4 w-4 ${iconColors[color]}`} />
                </div>
                <p className="text-3xl font-bold text-white">{value}</p>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
        )
    }

    const getAlertColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-500/20 border-red-500/30 text-red-400'
            case 'warning': return 'bg-orange-500/20 border-orange-500/30 text-orange-400'
            default: return 'bg-blue-500/20 border-blue-500/30 text-blue-400'
        }
    }

    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins}m ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }

    return (
        <div className="space-y-6">
            {/* Stats Grid - 2x2 on mobile */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
                <StatCard
                    title="Total Devices"
                    value={deviceStats.total}
                    icon={Server}
                    color="slate"
                />
                <StatCard
                    title="Online"
                    value={deviceStats.online}
                    icon={Wifi}
                    color="emerald"
                    subtitle="Active now"
                />
                <StatCard
                    title="Critical Alerts"
                    value={deviceStats.critical + deviceStats.offline}
                    icon={AlertTriangle}
                    color="red"
                    subtitle="Action required"
                />
                <StatCard
                    title="Avg TDS"
                    value={`${avgTds} ppm`}
                    icon={Droplets}
                    color="cyan"
                    subtitle="Good quality"
                />
            </div>

            {/* Recent Alerts Section */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-300">Recent Alerts</h2>
                    <Link to="/alerts" className="text-xs text-cyan-400 hover:text-cyan-300">View All</Link>
                </div>
                <div className="space-y-2">
                    {recentAlerts.length > 0 ? recentAlerts.map(alert => (
                        <div
                            key={alert.id}
                            className={`glass-card p-3 border ${getAlertColor(alert.severity)} pressable`}
                        >
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">
                                        {alert.devices?.name || 'Device'} - {alert.message}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                        <Clock className="h-3 w-3" />
                                        <span>{getTimeAgo(alert.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="glass-card p-4 text-center text-sm text-slate-500">
                            No recent alerts
                        </div>
                    )}
                </div>
            </div>

            {/* Live Chart */}
            <div className="glass-card p-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Live TDS Trend
                </h3>
                <div className="h-[200px] lg:h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorTds" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" vertical={false} />
                            <XAxis
                                dataKey="recorded_at"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                minTickGap={30}
                            />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 'auto']} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--bg-elevated)', color: '#f8fafc', borderRadius: '12px' }}
                                itemStyle={{ color: '#22d3ee' }}
                                labelFormatter={(label) => new Date(label).toLocaleString()}
                            />
                            <Area
                                type="monotone"
                                dataKey="tds"
                                stroke="#22d3ee"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorTds)"
                                animationDuration={500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Mobile Scan FAB */}
            {isMobile && (
                <Link
                    to="/scan"
                    className="fixed bottom-20 right-4 p-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-lg shadow-cyan-500/30 text-white z-40 pressable"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    </svg>
                </Link>
            )}
        </div>
    )
}
