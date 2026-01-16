import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { SensorData } from '../lib/supabase'
import { Activity, Battery, Server, Wifi, AlertTriangle } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useUI } from '../context/UIContext'
import StatusCard from '../components/StatusCard'
import { Link } from 'react-router-dom'

export default function Dashboard() {
    const { isMobile } = useUI()
    const [data, setData] = useState<SensorData[]>([])
    const [deviceStats, setDeviceStats] = useState({
        total: 0,
        online: 0,
        warning: 0,
        critical: 0,
        offline: 0
    })

    // Fetch Device Stats (Using Heartbeat Table)
    const fetchDeviceStats = async () => {
        const { data: devices } = await supabase.from('devices').select('id, status')
        const { data: heartbeats } = await supabase.from('device_heartbeat').select('device_id, status')

        if (devices) {
            const stats = {
                total: devices.length,
                online: 0,
                warning: 0,
                critical: 0,
                offline: 0
            }

            devices.forEach(d => {
                const hb = heartbeats?.find(h => h.device_id === d.id)
                // Use heartbeat status if available, fallback to device status (legacy), default offline
                const effStatus = (hb?.status || d.status || 'offline').toUpperCase()

                if (effStatus === 'ONLINE') stats.online++
                else if (effStatus === 'DEGRADED') stats.warning++ // Degraded -> Warning count
                else if (effStatus === 'MAINTENANCE') stats.warning++ // Maintenance -> Warning/Other
                else if (effStatus === 'OFFLINE') stats.offline++
                else if (effStatus === 'CRITICAL') stats.critical++ // If critical exists in legacy status
                else stats.offline++
            })
            setDeviceStats(stats)
        }
    }

    const handleNewReading = (reading: SensorData) => {
        setData(prev => {
            const newData = [...prev, reading].slice(isMobile ? -10 : -30)
            return newData
        })
        fetchDeviceStats()
    }

    useEffect(() => {
        const fetchInitialData = async () => {
            // Fetch Sensor Data
            const { data: sensorData } = await supabase
                .from('sensor_data')
                .select('*')
                .order('recorded_at', { ascending: false })
                .limit(isMobile ? 10 : 30)

            if (sensorData) {
                setData([...sensorData].reverse())
            }

            // Initial Stats Fetch
            await fetchDeviceStats()
        }

        fetchInitialData()

        // Subscribe to Sensor Data
        const sensorSub = supabase
            .channel('dashboard_sensor')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, (payload) => {
                handleNewReading(payload.new as SensorData)
            })
            .subscribe()

        // Subscribe to Heartbeat Changes (Effective Status)
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Command Center</h1>
                <p className="text-slate-400 mt-1 text-sm lg:text-base">Real-time infrastructure monitoring.</p>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
                <StatusCard
                    title="Total Nodes"
                    value={deviceStats.total}
                    icon={Server}
                    color="slate"
                />
                <StatusCard
                    title="Healthy"
                    value={deviceStats.online}
                    icon={Wifi}
                    color="emerald"
                />
                <StatusCard
                    title="Degraded"
                    value={deviceStats.warning}
                    icon={Battery}
                    color="orange"
                />
                <StatusCard
                    title="Offline"
                    value={deviceStats.offline}
                    icon={AlertTriangle}
                    color="red"
                />
            </div>

            {/* Main Chart Section */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 lg:p-6 backdrop-blur-sm shadow-xl">
                <h3 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-slate-400" />
                    Live TDS Trend ({isMobile ? '10' : '30'} pts)
                </h3>
                <div className="h-[300px] lg:h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorTds" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey="recorded_at"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                minTickGap={30}
                            />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 'auto']} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                itemStyle={{ color: '#22d3ee' }}
                                labelFormatter={(label) => new Date(label).toLocaleString()}
                            />
                            <Area
                                type="monotone"
                                dataKey="tds"
                                stroke="#06b6d4"
                                strokeWidth={isMobile ? 2 : 3}
                                fillOpacity={1}
                                fill="url(#colorTds)"
                                animationDuration={500}
                                isAnimationActive={!isMobile} // Disable anim on mobile for perf
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Mobile Scan FAB */}
            {isMobile && (
                <Link to="/scan" className="fixed bottom-20 right-4 p-4 bg-cyan-500 rounded-full shadow-lg shadow-cyan-500/40 text-white z-40 animate-bounce-in">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /></svg>
                </Link>
            )}
        </div>
    )
}
