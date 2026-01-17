import { useState, useEffect, useMemo } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import {
    Activity, Clock, LayoutGrid, Thermometer, Droplets
} from 'lucide-react'
import type { Device, SensorData } from '../lib/supabase'

import { GlassCard } from '@/components/GlassCard'
import { StatusIndicator } from '@/components/StatusIndicator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AreaChart as AreaChartIcon } from 'lucide-react'

const STATUS_COLORS = {
    online: '#30d158',
    warning: '#ff9f0a',
    critical: '#ff453a',
    offline: '#8e8e93'
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-2.5 rounded-lg border border-white/10 shadow-xl backdrop-blur-xl bg-black/90">
                <p className="text-white/60 text-[10px] mb-1">{label}</p>
                {payload.map((p: any, index: number) => (
                    <div key={index} className="flex items-center gap-1.5 text-xs font-medium">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-white font-mono">
                            {p.value} {p.name === 'temp' ? '°C' : 'ppm'}
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
        const fetchDevicesAndData = async () => {
            const baseDevice = {
                latitude: 17.4455, longitude: 78.3489,
                thingspeak_channel_id: 12345, thingspeak_read_key: 'abc',
                created_at: new Date().toISOString(),
                metadata: { polling_interval: 30 }
            }

            const mockDevices: Device[] = [
                { ...baseDevice, id: '1', name: 'Himalaya Mess', location_name: 'Main Dining Hall', status: 'online', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '2', name: 'Vindhya Mess', location_name: 'North Campus', status: 'online', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '3', name: 'Kadamba Canteen', location_name: 'Academic Block', status: 'warning', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '4', name: 'Library', location_name: 'Central Library', status: 'online', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '5', name: 'OBH', location_name: 'Boys Hostel', status: 'warning', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '6', name: 'NBH', location_name: 'New Hostel', status: 'critical', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '7', name: 'Girls Hostel', location_name: 'GH Building', status: 'online', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '8', name: 'KRB', location_name: 'Research Complex', status: 'online', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '9', name: 'Sports Complex', location_name: 'Athletic Facility', status: 'offline', last_seen_at: new Date().toISOString() },
                { ...baseDevice, id: '10', name: 'T-Hub', location_name: 'Innovation Center', status: 'online', last_seen_at: new Date().toISOString() },
            ]

            if (isMounted) setDevices(mockDevices)

            const newSensorData: { [key: string]: SensorData[] } = {}
            mockDevices.forEach(d => {
                newSensorData[d.id] = Array.from({ length: 24 }, (_, i) => ({
                    id: i, device_id: d.id,
                    tds: Math.floor(Math.random() * (400 - 100) + 100),
                    temperature: parseFloat((Math.random() * (30 - 20) + 20).toFixed(1)),
                    voltage: 3.3,
                    recorded_at: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
                    timestamp: new Date(Date.now() - (24 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }))
            })

            if (isMounted) { setSensorData(newSensorData); setLoading(false) }
        }

        fetchDevicesAndData()
        const interval = setInterval(fetchDevicesAndData, 30000)
        return () => { isMounted = false; clearInterval(interval) }
    }, [])

    const stats = useMemo(() => devices.reduce((acc, dev) => {
        const status = dev.status as keyof typeof acc
        if (acc[status] !== undefined) acc[status]++
        return acc
    }, { online: 0, warning: 0, critical: 0, offline: 0 }), [devices])

    const selectedDevice = useMemo(() => selectedLocation === 'all' ? null : devices.find(d => d.id === selectedLocation), [selectedLocation, devices])

    const trendData = useMemo(() => {
        const targetId = selectedLocation === 'all' ? devices[0]?.id : selectedLocation
        if (!targetId || !sensorData[targetId]) return []
        return sensorData[targetId].map(d => ({ time: (d as any).timestamp, tds: d.tds, temp: d.temperature }))
    }, [selectedLocation, devices, sensorData])

    const latestTDS = trendData.length > 0 ? trendData[trendData.length - 1].tds : 0
    const avgTemp = trendData.length > 0 ? (trendData.reduce((sum, d) => sum + d.temp, 0) / trendData.length).toFixed(1) : '--'

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <Tabs defaultValue="default" className="w-full max-w-[1600px] mx-auto">
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Overview</h1>
                    <p className="text-xs text-muted-foreground">Real-time water quality monitoring</p>
                </div>
                <TabsList className="bg-white/5 border border-white/10 h-9">
                    <TabsTrigger value="default" className="text-xs gap-1.5 h-7 px-3"><LayoutGrid className="w-3.5 h-3.5" /> Default</TabsTrigger>
                    <TabsTrigger value="all" className="text-xs gap-1.5 h-7 px-3"><AreaChartIcon className="w-3.5 h-3.5" /> All Devices</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="default" className="space-y-4 mt-0">
                {/* Row 1: Status + Pie + Activity */}
                <div className="grid grid-cols-12 gap-4">
                    {/* Status Cards */}
                    <div className="col-span-12 lg:col-span-3 space-y-2">
                        {[
                            { label: 'Online', value: stats.online, color: '#30d158', bg: 'bg-green-500/10' },
                            { label: 'Warning', value: stats.warning, color: '#ff9f0a', bg: 'bg-orange-500/10' },
                            { label: 'Critical', value: stats.critical, color: '#ff453a', bg: 'bg-red-500/10' },
                            { label: 'Offline', value: stats.offline, color: '#8e8e93', bg: 'bg-slate-500/10' },
                        ].map((stat) => (
                            <div key={stat.label} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/8 transition-colors">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stat.color }} />
                                    </div>
                                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                                </div>
                                <span className="text-xl font-bold font-mono">{stat.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Device Status Pie */}
                    <div className="col-span-12 lg:col-span-5">
                        <GlassCard className="p-4 h-full">
                            <h3 className="text-sm font-medium mb-2">Device Status</h3>
                            <div className="h-[180px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Online', value: stats.online },
                                                { name: 'Warning', value: stats.warning },
                                                { name: 'Critical', value: stats.critical },
                                                { name: 'Offline', value: stats.offline },
                                            ]}
                                            cx="50%" cy="50%"
                                            innerRadius={50} outerRadius={70}
                                            paddingAngle={3} dataKey="value" strokeWidth={0}
                                        >
                                            <Cell fill={STATUS_COLORS.online} />
                                            <Cell fill={STATUS_COLORS.warning} />
                                            <Cell fill={STATUS_COLORS.critical} />
                                            <Cell fill={STATUS_COLORS.offline} />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-2xl font-bold">{devices.length}</span>
                                    <span className="text-[10px] text-muted-foreground">Total Devices</span>
                                </div>
                            </div>
                            <div className="flex justify-center gap-4 text-[10px] text-muted-foreground mt-1">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#30d158]" />Online ({stats.online})</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ff9f0a]" />Warning ({stats.warning})</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ff453a]" />Critical ({stats.critical})</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#8e8e93]" />Offline ({stats.offline})</span>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Recent Activity */}
                    <div className="col-span-12 lg:col-span-4">
                        <GlassCard className="p-4 h-full">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium">Recent Activity</h3>
                                <span className="text-[10px] text-muted-foreground">{devices.length} devices</span>
                            </div>
                            <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1 custom-scrollbar">
                                {devices.map((dev) => {
                                    const latest = sensorData[dev.id]?.[sensorData[dev.id]?.length - 1]
                                    return (
                                        <div key={dev.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/8 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <StatusIndicator status={dev.status} size="sm" />
                                                <div>
                                                    <div className="text-xs font-medium">{dev.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{dev.location_name}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-mono font-bold">{latest?.tds || '--'} <span className="text-muted-foreground font-normal">ppm</span></div>
                                                <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                                                    <Clock className="w-2.5 h-2.5" /> {Math.floor(Math.random() * 10) + 1}m
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </GlassCard>
                    </div>
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                            <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10 text-xs">
                                <SelectValue placeholder="All Locations" />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 border-white/10">
                                <SelectItem value="all" className="text-xs">All Locations</SelectItem>
                                {devices.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button size="sm" className="h-9 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs">
                            <Activity className="w-3.5 h-3.5 mr-1.5" /> Live
                        </Button>
                    </div>
                    <div className="flex gap-0.5 bg-white/5 rounded-lg p-0.5 border border-white/10">
                        {['24h', '7d', '30d'].map((r) => (
                            <button key={r} onClick={() => setTimeRange(r as any)}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${timeRange === r ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-white/10'}`}>
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-12 gap-4">
                    {/* TDS Chart */}
                    <div className="col-span-12 lg:col-span-6">
                        <GlassCard className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <Droplets className="w-4 h-4 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium">TDS Trend</h3>
                                        <p className="text-[10px] text-muted-foreground">{selectedDevice?.name || 'All Locations'}</p>
                                    </div>
                                </div>
                                <span className="text-lg font-bold font-mono text-green-500">{latestTDS} <span className="text-xs font-normal text-muted-foreground">ppm</span></span>
                            </div>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="tdsG" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#30d158" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis dataKey="time" stroke="#666" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#666" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="tds" stroke="#30d158" strokeWidth={2} fill="url(#tdsG)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Temperature Chart */}
                    <div className="col-span-12 lg:col-span-6">
                        <GlassCard className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                        <Thermometer className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium">Temperature Trend</h3>
                                        <p className="text-[10px] text-muted-foreground">{selectedDevice?.name || 'All Locations'}</p>
                                    </div>
                                </div>
                                <span className="text-lg font-bold font-mono text-orange-500">{avgTemp}<span className="text-xs font-normal text-muted-foreground">°C</span></span>
                            </div>
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis dataKey="time" stroke="#666" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#666" fontSize={9} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line type="monotone" dataKey="temp" stroke="#ff9f0a" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {devices.map((device) => {
                        const data = sensorData[device.id] || []
                        const latest = data[data.length - 1]
                        return (
                            <GlassCard key={device.id} className="p-3 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-xs font-medium truncate max-w-[100px]">{device.name}</h4>
                                        <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{device.location_name}</p>
                                    </div>
                                    <StatusIndicator status={device.status} size="sm" />
                                </div>
                                <div className="mt-2">
                                    <div className="text-lg font-bold font-mono">{latest?.tds || '--'} <span className="text-[10px] text-muted-foreground font-normal">ppm</span></div>
                                    <div className="text-[10px] text-muted-foreground">{latest?.temperature || '--'}°C</div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 h-10 opacity-30">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data}>
                                            <Area type="monotone" dataKey="tds" stroke={STATUS_COLORS[device.status as keyof typeof STATUS_COLORS]} fill="none" strokeWidth={1.5} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </GlassCard>
                        )
                    })}
                </div>
            </TabsContent>
        </Tabs>
    )
}
