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

// Theme Colors
const STATUS_COLORS = {
    online: '#30d158',   // Apple Green
    warning: '#ff9f0a',  // Apple Orange
    critical: '#ff453a', // Apple Red
    offline: '#8e8e93'   // Apple Gray
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl bg-black/90">
                <p className="text-white/60 text-xs mb-2 font-medium">{label}</p>
                {payload.map((p: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-medium">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-white font-mono">
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
        const POLL_INTERVAL = 30000

        const fetchDevicesAndData = async () => {
            const baseDevice = {
                latitude: 17.4455,
                longitude: 78.3489,
                thingspeak_channel_id: 12345,
                thingspeak_read_key: 'abc',
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
                    id: i,
                    device_id: d.id,
                    tds: Math.floor(Math.random() * (400 - 100) + 100),
                    temperature: parseFloat((Math.random() * (30 - 20) + 20).toFixed(1)),
                    voltage: 3.3,
                    recorded_at: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
                    timestamp: new Date(Date.now() - (24 - i) * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }))
            })

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
            if (acc[status] !== undefined) { acc[status]++ }
            return acc
        }, { online: 0, warning: 0, critical: 0, offline: 0 })
    }, [devices])

    const selectedDevice = useMemo(() => {
        if (selectedLocation === 'all') return null
        return devices.find(d => d.id === selectedLocation)
    }, [selectedLocation, devices])

    const trendData = useMemo(() => {
        const targetId = selectedLocation === 'all' ? devices[0]?.id : selectedLocation
        if (!targetId || !sensorData[targetId]) return []
        return sensorData[targetId].map(d => ({
            time: (d as any).timestamp,
            tds: d.tds,
            temp: d.temperature
        }))
    }, [selectedLocation, devices, sensorData])

    if (loading) return (
        <div className="p-8 text-center text-muted-foreground">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            Loading Dashboard...
        </div>
    )

    return (
        <div className="space-y-5 max-w-[1600px] mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Real-time water quality monitoring</p>
                </div>
                <TabsList className="bg-white/5 backdrop-blur-lg border border-white/10">
                    <TabsTrigger value="default" className="gap-2 data-[state=active]:bg-white/10 transition-all duration-300"><LayoutGrid className="w-4 h-4" /> Default</TabsTrigger>
                    <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-white/10 transition-all duration-300"><AreaChartIcon className="w-4 h-4" /> All Devices</TabsTrigger>
                </TabsList>
            </div>

            <Tabs defaultValue="default" className="w-full">
                <TabsContent value="default" className="space-y-5 mt-0">
                    {/* Row 1: Status Cards (Left) + Pie Chart (Center) + Activity (Right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Status Cards - Vertical Stack */}
                        <div className="lg:col-span-3 flex flex-col gap-2.5">
                            {[
                                { label: 'Online', value: stats.online, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/10' },
                                { label: 'Warning', value: stats.warning, color: 'text-orange-400', border: 'border-orange-500/20', bg: 'bg-orange-500/10' },
                                { label: 'Critical', value: stats.critical, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/10' },
                                { label: 'Offline', value: stats.offline, color: 'text-slate-400', border: 'border-slate-500/20', bg: 'bg-slate-500/10' },
                            ].map((stat, index) => (
                                <GlassCard
                                    key={stat.label}
                                    className={`p-3.5 flex items-center justify-between border ${stat.border} transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-xl cursor-pointer`}
                                    style={{
                                        animationDelay: `${index * 80}ms`,
                                        transform: 'translateZ(0)'
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                                            <Activity className="h-4.5 w-4.5" />
                                        </div>
                                        <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                                    </div>
                                    <span className="text-2xl font-bold font-mono">{stat.value}</span>
                                </GlassCard>
                            ))}
                        </div>

                        {/* Device Status Pie Chart - Center */}
                        <div className="lg:col-span-5">
                            <GlassCard className="p-5 h-full transition-all duration-500 ease-out hover:shadow-xl">
                                <h3 className="text-base font-semibold mb-3">Device Status</h3>
                                <div className="h-[220px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Online', value: stats.online },
                                                    { name: 'Warning', value: stats.warning },
                                                    { name: 'Critical', value: stats.critical },
                                                    { name: 'Offline', value: stats.offline },
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={85}
                                                paddingAngle={4}
                                                dataKey="value"
                                                strokeWidth={0}
                                            >
                                                <Cell fill={STATUS_COLORS.online} />
                                                <Cell fill={STATUS_COLORS.warning} />
                                                <Cell fill={STATUS_COLORS.critical} />
                                                <Cell fill={STATUS_COLORS.offline} />
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#30d158]" /> Online ({stats.online})</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ff9f0a]" /> Warning ({stats.warning})</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ff453a]" /> Critical ({stats.critical})</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#8e8e93]" /> Offline ({stats.offline})</div>
                                </div>
                            </GlassCard>
                        </div>

                        {/* Recent Activity - Right */}
                        <div className="lg:col-span-4">
                            <GlassCard className="p-5 h-full transition-all duration-500 ease-out hover:shadow-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-semibold">Recent Activity</h3>
                                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                                        {devices.length} devices
                                    </span>
                                </div>
                                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                                    {devices.map((dev, index) => {
                                        const latestData = sensorData[dev.id]?.[sensorData[dev.id]?.length - 1]
                                        const timeAgo = Math.floor(Math.random() * 10) + 1

                                        return (
                                            <div
                                                key={dev.id}
                                                className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 transition-all duration-300 ease-out hover:bg-white/10 hover:scale-[1.01] cursor-pointer"
                                                style={{ animationDelay: `${index * 40}ms` }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <StatusIndicator status={dev.status} size="sm" />
                                                    <div>
                                                        <div className="text-sm font-medium leading-tight">{dev.name}</div>
                                                        <div className="text-[10px] text-muted-foreground">{dev.location_name}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-mono font-bold">{latestData?.tds || '--'} <span className="text-muted-foreground font-normal text-[10px]">ppm</span></div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                                                        <Clock className="w-2.5 h-2.5" /> {timeAgo}m ago
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </GlassCard>
                        </div>
                    </div>

                    {/* Location Selector - Between status row and charts */}
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                                <SelectTrigger className="w-[220px] bg-white/5 backdrop-blur-lg border-white/10 transition-all duration-300 hover:bg-white/10 focus:ring-1 focus:ring-primary/50">
                                    <SelectValue placeholder="All Locations" />
                                </SelectTrigger>
                                <SelectContent className="bg-black/95 backdrop-blur-xl border-white/10">
                                    <SelectItem value="all">All Locations</SelectItem>
                                    {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all duration-300 hover:scale-[1.02]">
                                <Activity className="h-4 w-4 mr-2" /> Live
                            </Button>
                        </div>
                        <div className="flex gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
                            {['24h', '7d', '30d'].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setTimeRange(r as any)}
                                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${timeRange === r ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:bg-white/10'}`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Row 2: TDS and Temperature Charts - BIGGER */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* TDS Trend Chart */}
                        <GlassCard className="p-5 transition-all duration-500 ease-out hover:shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                    <Droplets className="h-5 w-5 text-green-500" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold">TDS Trend</h3>
                                    <p className="text-xs text-muted-foreground">
                                        {selectedDevice ? selectedDevice.name : 'All Locations'}
                                    </p>
                                </div>
                            </div>
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="tdsGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#30d158" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} dx={-5} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                        <Area type="monotone" dataKey="tds" stroke="#30d158" strokeWidth={2.5} fill="url(#tdsGradient)" animationDuration={800} animationEasing="ease-out" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>

                        {/* Temperature Trend Chart */}
                        <GlassCard className="p-5 transition-all duration-500 ease-out hover:shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                                        <Thermometer className="h-5 w-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold">Temperature Trend</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedDevice ? selectedDevice.name : 'All Locations'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm bg-orange-500/10 px-3 py-1.5 rounded-lg">
                                    <span className="text-muted-foreground text-xs">Avg:</span>
                                    <span className="font-mono font-bold text-orange-500">
                                        {trendData.length > 0 ? (trendData.reduce((sum, d) => sum + d.temp, 0) / trendData.length).toFixed(1) : '--'}°C
                                    </span>
                                </div>
                            </div>
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="time" stroke="#666" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} dx={-5} domain={['dataMin - 2', 'dataMax + 2']} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                        <Line type="monotone" dataKey="temp" stroke="#ff9f0a" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#ff9f0a', strokeWidth: 2, stroke: '#000' }} animationDuration={800} animationEasing="ease-out" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    </div>
                </TabsContent>

                <TabsContent value="all" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {devices.map((device, index) => {
                            const data = sensorData[device.id] || []
                            const latest = data[data.length - 1]

                            return (
                                <GlassCard
                                    key={device.id}
                                    hover
                                    className="p-4 flex flex-col justify-between h-[150px] relative overflow-hidden group transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-2xl cursor-pointer"
                                    style={{ animationDelay: `${index * 60}ms` }}
                                >
                                    <div className="flex justify-between items-start z-10">
                                        <div>
                                            <h4 className="font-semibold text-sm truncate max-w-[120px]" title={device.name}>{device.name}</h4>
                                            <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{device.location_name}</p>
                                        </div>
                                        <StatusIndicator status={device.status} pulse />
                                    </div>

                                    <div className="z-10 mt-2">
                                        <div className="text-xl font-bold font-mono tracking-tight">{latest?.tds || '--'} <span className="text-[11px] font-sans text-muted-foreground font-normal">ppm</span></div>
                                        <div className="text-[11px] text-muted-foreground">{latest?.temperature || '--'}°C</div>
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 h-14 opacity-30 group-hover:opacity-50 transition-all duration-500">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={data}>
                                                <Area type="monotone" dataKey="tds" stroke={STATUS_COLORS[device.status as keyof typeof STATUS_COLORS] || '#30d158'} fill="none" strokeWidth={1.5} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </GlassCard>
                            )
                        })}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
