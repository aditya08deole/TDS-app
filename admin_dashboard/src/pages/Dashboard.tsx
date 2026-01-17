import { useState, useEffect, useMemo } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ReferenceLine
} from 'recharts'
import {
    Activity, Droplets, Clock, CheckCircle, AlertTriangle, XCircle, WifiOff
} from 'lucide-react'
import type { Device, SensorData } from '../lib/supabase'
import DeviceTable from '../components/DeviceTable'

// Theme Colors matching new index.css
const STATUS_COLORS = {
    online: '#30d158',   // Apple Green
    warning: '#ff9f0a',  // Apple Orange
    critical: '#ff453a', // Apple Red
    offline: '#8e8e93'   // Apple Gray
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-panel p-3 rounded-lg border border-white/10 shadow-xl backdrop-blur-xl">
                <p className="text-slate-400 text-xs mb-1">{label}</p>
                {payload.map((p: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-medium">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-white">
                            {p.value} {p.name === 'temp' ? '°C' : (p.name === 'tds' || p.name === 'tds_value') ? 'ppm' : ''}
                        </span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

export default function Dashboard() {
    const [devices, setDevices] = useState<Device[]>([])
    const [sensorData, setSensorData] = useState<{ [key: string]: SensorData[] }>({})
    const [loading, setLoading] = useState(true)
    const [selectedLocation, setSelectedLocation] = useState<string>('all')
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')

    useEffect(() => {
        let isMounted = true
        const POLL_INTERVAL = 30000 // 30 seconds

        const fetchDevicesAndData = async () => {
            // 1. Fetch Devices (Mock or Real)
            // Ideally this comes from Supabase, but for now we keep the mock list structure for UI testing
            // If you have real devices in Supabase, replace this block with supabase.from('devices').select('*')

            const baseDevice = {
                latitude: 17.4455,
                longitude: 78.3489,
                thingspeak_channel_id: 12345,
                thingspeak_read_key: 'abc',
                created_at: new Date().toISOString(),
                metadata: { polling_interval: 30 }
            }

            const mockDevices: Device[] = [
                { ...baseDevice, id: '1', name: 'Himalaya Mess', location_name: 'Main Dining Hall', status: 'online', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1001 },
                { ...baseDevice, id: '2', name: 'Vindhya Mess', location_name: 'North Campus Canteen', status: 'online', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1002 },
                { ...baseDevice, id: '3', name: 'Kadamba Canteen', location_name: 'Academic Block Area', status: 'warning', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1003 },
                { ...baseDevice, id: '4', name: 'Library Building', location_name: 'Central Library', status: 'online', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1004 },
                { ...baseDevice, id: '5', name: 'OBH (Old Boys Hostel)', location_name: 'Boys Hostel Block', status: 'warning', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1005 },
                { ...baseDevice, id: '6', name: 'NBH (New Boys Hostel)', location_name: 'New Hostel Complex', status: 'critical', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1006 },
                { ...baseDevice, id: '7', name: 'Girls Hostel', location_name: 'GH Building', status: 'online', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1007 },
                { ...baseDevice, id: '8', name: 'KRB (Kohli Research Building)', location_name: 'Research Complex', status: 'online', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1008 },
                { ...baseDevice, id: '9', name: 'Sports Complex', location_name: 'Athletic Facility', status: 'offline', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1009 },
                { ...baseDevice, id: '10', name: 'T-Hub Food Court', location_name: 'Innovation Center', status: 'online', last_seen_at: new Date().toISOString(), thingspeak_channel_id: 1010 },
            ]

            if (isMounted) setDevices(mockDevices)

            // 2. Fetch Sensor Data (Real-Time Pipeline)
            const newSensorData: { [key: string]: SensorData[] } = {}

            await Promise.all(mockDevices.map(async (d) => {
                let feeds: any[] = []

                // Optimized: Try to fetch real data
                if (d.thingspeak_channel_id) {
                    try {
                        // Import dynammically or at top? Using import at top is better. 
                        // Assuming fetchFeeds is imported.
                        const tsData = await import('../lib/thingspeak').then(m => m.fetchFeeds(d.thingspeak_channel_id, d.thingspeak_read_key))
                        if (tsData && tsData.feeds.length > 0) {
                            feeds = tsData.feeds.map((f: any) => ({
                                id: f.entry_id,
                                device_id: d.id,
                                tds: parseFloat(f.field1 || '0'),
                                temperature: parseFloat(f.field2 || '0'),
                                voltage: parseFloat(f.field3 || '0'),
                                recorded_at: f.created_at,
                                timestamp: new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }))
                        }
                    } catch (e) { console.warn('Fetch failed', e) }
                }

                // Fallback: If no real data (e.g. mock channel ID), generate simulation
                if (feeds.length === 0) {
                    feeds = Array.from({ length: 20 }, (_, i) => ({
                        id: i,
                        device_id: d.id,
                        tds: Math.floor(Math.random() * (500 - 100) + 100),
                        temperature: parseFloat((Math.random() * (30 - 20) + 20).toFixed(1)),
                        voltage: 3.3,
                        recorded_at: new Date(Date.now() - (20 - i) * 3600000).toISOString(),
                        timestamp: new Date(Date.now() - (20 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }))
                }

                newSensorData[d.id] = feeds
            }))

            if (isMounted) {
                setSensorData(newSensorData)
                setLoading(false)
            }
        }

        fetchDevicesAndData()
        const interval = setInterval(fetchDevicesAndData, POLL_INTERVAL)

        return () => {
            isMounted = false
            clearInterval(interval)
        }
    }, [])

    const stats = useMemo(() => {
        return devices.reduce((acc, dev) => {
            const status = dev.status as keyof typeof acc
            if (acc[status] !== undefined) {
                acc[status]++
            }
            return acc
        }, { online: 0, warning: 0, critical: 0, offline: 0 })
    }, [devices])

    const trendData = useMemo(() => {
        const targetId = selectedLocation === 'all' ? devices[0]?.id : selectedLocation
        if (!targetId || !sensorData[targetId]) return []

        return sensorData[targetId].map(d => ({
            time: (d as any).timestamp,
            tds: d.tds,
            temp: d.temperature
        }))
    }, [selectedLocation, devices, sensorData])

    if (loading) return <div className="p-8 text-center text-slate-400">Loading Dashboard...</div>

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                    <p className="text-[#86868b] mt-1">Real-time water quality monitoring system</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2 bg-white text-black hover:bg-slate-200 rounded-lg font-medium shadow-lg shadow-white/10 transition-all flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Live View
                    </button>
                </div>
            </div>

            {/* 1. Status Cards Row - Compact Horizontal Style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between shadow-sm hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 group-hover:bg-green-500/20 transition-colors">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-400">Online</span>
                    </div>
                    <span className="text-2xl font-semibold text-white font-mono">{stats.online}</span>
                </div>
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between shadow-sm hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-500/20 transition-colors">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-400">Warning</span>
                    </div>
                    <span className="text-2xl font-semibold text-white font-mono">{stats.warning}</span>
                </div>
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between shadow-sm hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500/20 transition-colors">
                            <XCircle className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-400">Critical</span>
                    </div>
                    <span className="text-2xl font-semibold text-white font-mono">{stats.critical}</span>
                </div>
                <div className="glass-panel p-4 rounded-xl flex items-center justify-between shadow-sm hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-400 group-hover:bg-slate-500/20 transition-colors">
                            <WifiOff className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-slate-400">Offline</span>
                    </div>
                    <span className="text-2xl font-semibold text-white font-mono">{stats.offline}</span>
                </div>
            </div>

            {/* 2. Current Readings Section - iOS Widget Style */}
            <div>
                <h2 className="text-lg font-semibold text-white mb-4 tracking-tight">Current Readings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {devices.map(device => {
                        const data = sensorData[device.id] || []
                        const latest = data[data.length - 1] as any

                        return (
                            <div key={device.id} className="glass-card p-5 hover:border-blue-500/30 transition-all group overflow-hidden relative">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${device.status === 'online' ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
                                            <Droplets className="h-4 w-4" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-200 truncate max-w-[100px]">{device.name}</span>
                                    </div>
                                    <span className="text-xs font-mono text-[#86868b] bg-white/5 px-2 py-1 rounded-md">{latest?.temperature || '--'}°C</span>
                                </div>

                                {/* Main Value */}
                                <div className="mb-2 relative z-10">
                                    <span className="text-3xl font-bold text-white tracking-tight">{latest?.tds || '--'}</span>
                                    <span className="text-xs text-[#86868b] ml-1 font-medium">ppm</span>
                                </div>

                                {/* Sparkline */}
                                <div className="h-12 -mx-5 -mb-5 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data}>
                                            <defs>
                                                <linearGradient id={`gradient-${device.id}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#0a84ff" stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor="#0a84ff" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="tds"
                                                stroke="#0a84ff"
                                                strokeWidth={2}
                                                fill={`url(#gradient-${device.id})`}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* 3. Trends & Distribution Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* TDS Trend (Left 2/3) */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white tracking-tight">TDS Trend</h3>
                            <p className="text-xs text-[#86868b]">Readings for {selectedLocation === 'all' ? 'All Devices' : devices.find(d => d.id === selectedLocation)?.name}</p>
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg text-xs text-white px-3 py-1.5 focus:outline-none focus:border-blue-500 hover:bg-white/5 transition-colors"
                            >
                                <option value="all">Select Device</option>
                                {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                                {['24h', '7d', '30d'].map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setTimeRange(r as any)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeRange === r ? 'bg-[#1c1c1e] text-white shadow-sm border border-white/10' : 'text-[#86868b] hover:text-white'}`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="mainChartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#30d158" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                <XAxis dataKey="time" stroke="#6e6e73" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#6e6e73" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffffff', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.2 }} />
                                <Area type="monotone" dataKey="tds" stroke="#30d158" strokeWidth={2} fill="url(#mainChartGradient)" />
                                <ReferenceLine y={300} stroke="#ff9f0a" strokeDasharray="3 3" strokeOpacity={0.5} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution (Right 1/3) */}
                <div className="glass-card p-6 flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-white tracking-tight">System Status</h3>
                        <p className="text-xs text-[#86868b]">Real-time device distribution</p>
                    </div>
                    <div className="flex-1 flex items-center justify-center relative min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Online', value: stats.online, color: STATUS_COLORS.online },
                                        { name: 'Warning', value: stats.warning, color: STATUS_COLORS.warning },
                                        { name: 'Critical', value: stats.critical, color: STATUS_COLORS.critical },
                                        { name: 'Offline', value: stats.offline, color: STATUS_COLORS.offline },
                                    ]}
                                    innerRadius={65}
                                    outerRadius={85}
                                    paddingAngle={4}
                                    dataKey="value"
                                    cornerRadius={6}
                                    stroke="none"
                                >
                                    {[0, 1, 2, 3].map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={[STATUS_COLORS.online, STATUS_COLORS.warning, STATUS_COLORS.critical, STATUS_COLORS.offline][index]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-4xl font-bold text-white tracking-tighter">{devices.length}</span>
                            <span className="text-xs text-[#86868b] uppercase font-medium tracking-widest mt-1">Total</span>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-[#86868b]">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#30d158] shadow-[0_0_8px_rgba(48,209,88,0.5)]" /> Online: {stats.online}</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff9f0a]" /> Warning: {stats.warning}</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff453a]" /> Critical: {stats.critical}</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#8e8e93]" /> Offline: {stats.offline}</div>
                    </div>
                </div>
            </div>

            {/* 4. Temperature & Activity Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Temp Trend */}
                <div className="lg:col-span-2 glass-card p-6">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-white tracking-tight">Temperature</h3>
                        <p className="text-xs text-[#86868b]">Thermal monitoring</p>
                    </div>
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff9f0a" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#ff9f0a" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                <XAxis dataKey="time" stroke="#6e6e73" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#6e6e73" fontSize={10} tickLine={false} axisLine={false} domain={[15, 35]} dx={-10} />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffffff', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.2 }} />
                                <Area type="monotone" dataKey="temp" stroke="#ff9f0a" strokeWidth={2} fill="url(#tempGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="glass-card p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-white tracking-tight">Activity Log</h3>
                            <p className="text-xs text-[#86868b]">Recent events</p>
                        </div>
                        <Clock className="w-4 h-4 text-[#86868b]" />
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-h-[200px]">
                        {devices.slice(0, 5).map(device => {
                            const latestTds = 180 + Math.floor(Math.random() * 20);
                            return (
                                <div key={device.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 group px-1">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-slate-500'}`} />
                                        <div>
                                            <div className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{device.name}</div>
                                            <div className="text-[10px] text-[#86868b] font-mono">{latestTds} ppm · 24°C</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-[#6e6e73] font-mono">
                                        2m ago
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* 5. All Devices Table - Clean List Style */}
            <DeviceTable devices={devices} loading={loading} />
        </div>
    )
}
