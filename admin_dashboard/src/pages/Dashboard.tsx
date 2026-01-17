import { useState, useEffect, useMemo } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts'
import {
    Activity, Clock, LayoutGrid
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
            <div className="glass-panel p-3 rounded-lg border border-white/10 shadow-xl backdrop-blur-xl bg-[#1c1c1e]/90">
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
        const POLL_INTERVAL = 30000

        const fetchDevicesAndData = async () => {
            // Mock Data Generation (Same as before, simplified for brevity in replacement)
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
                // Generate mock trend
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

    const trendData = useMemo(() => {
        const targetId = selectedLocation === 'all' ? devices[0]?.id : selectedLocation
        if (!targetId || !sensorData[targetId]) return []
        return sensorData[targetId].map(d => ({
            time: (d as any).timestamp,
            tds: d.tds,
            temp: d.temperature
        }))
    }, [selectedLocation, devices, sensorData])

    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading Dashboard...</div>

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
                    <p className="text-muted-foreground mt-1">Real-time water quality monitoring</p>
                </div>
            </div>

            <Tabs defaultValue="default" className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="default" className="gap-2"><LayoutGrid className="w-4 h-4" /> Default</TabsTrigger>
                        <TabsTrigger value="all" className="gap-2"><AreaChartIcon className="w-4 h-4" /> All Devices</TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2">
                        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select Location" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Main Campus (Agg)</SelectItem>
                                {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button>
                            <Activity className="h-4 w-4 mr-2" /> Live View
                        </Button>
                    </div>
                </div>

                <TabsContent value="default" className="space-y-6 animate-fade-in">
                    {/* Status Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Online', value: stats.online, color: 'text-green-500', bg: 'bg-green-500/10' },
                            { label: 'Warning', value: stats.warning, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                            { label: 'Critical', value: stats.critical, color: 'text-red-500', bg: 'bg-red-500/10' },
                            { label: 'Offline', value: stats.offline, color: 'text-slate-500', bg: 'bg-slate-500/10' },
                        ].map((stat) => (
                            <GlassCard key={stat.label} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stat.bg} ${stat.color}`}>
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                                </div>
                                <span className="text-2xl font-bold font-mono">{stat.value}</span>
                            </GlassCard>
                        ))}
                    </div>

                    {/* Main Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <GlassCard className="lg:col-span-2 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold">TDS Trend</h3>
                                <div className="flex gap-1.5">
                                    {['24h', '7d', '30d'].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => setTimeRange(r as any)}
                                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${timeRange === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="tdsGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#30d158" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="time" stroke="#666" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis stroke="#666" fontSize={11} tickLine={false} axisLine={false} dx={-10} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeDasharray: '4 4' }} />
                                        <Area type="monotone" dataKey="tds" stroke="#30d158" strokeWidth={2} fill="url(#tdsGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>

                        <GlassCard className="p-6 flex flex-col">
                            <h3 className="text-lg font-semibold mb-4">Device Status</h3>
                            <div className="flex-1 min-h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Online', value: stats.online },
                                                { name: 'Warning', value: stats.warning },
                                                { name: 'Critical', value: stats.critical },
                                                { name: 'Offline', value: stats.offline },
                                            ]}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
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
                            <div className="grid grid-cols-2 gap-y-2 text-xs text-muted-foreground mt-4">
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#30d158]" /> Online ({stats.online})</div>
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff9f0a]" /> Warning ({stats.warning})</div>
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ff453a]" /> Critical ({stats.critical})</div>
                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#8e8e93]" /> Offline ({stats.offline})</div>
                            </div>
                        </GlassCard>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <GlassCard className="p-6 lg:col-span-2">
                            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                            <div className="space-y-4">
                                {devices.slice(0, 5).map(dev => (
                                    <div key={dev.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <StatusIndicator status={dev.status} size="sm" />
                                            <div>
                                                <div className="text-sm font-medium">{dev.name}</div>
                                                <div className="text-xs text-muted-foreground">{dev.location_name}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-mono">185 ppm</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                                <Clock className="w-3 h-3" /> 2m ago
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>
                    </div>
                </TabsContent>

                <TabsContent value="all" className="animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {devices.map(device => {
                            const data = sensorData[device.id] || []
                            // Map data for sparkline would go here when/if we use Sparkline component
                            const latest = data[data.length - 1]

                            return (
                                <GlassCard key={device.id} hover className="p-5 flex flex-col justify-between h-[160px] relative overflow-hidden group">
                                    <div className="flex justify-between items-start z-10">
                                        <div>
                                            <h4 className="font-semibold text-sm truncate max-w-[120px]" title={device.name}>{device.name}</h4>
                                            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{device.location_name}</p>
                                        </div>
                                        <StatusIndicator status={device.status} pulse />
                                    </div>

                                    <div className="z-10 mt-2">
                                        <div className="text-2xl font-bold font-mono tracking-tight">{latest?.tds || '--'} <span className="text-xs font-sans text-muted-foreground font-normal">ppm</span></div>
                                        <div className="text-xs text-muted-foreground">{latest?.temperature || '--'}°C</div>
                                    </div>

                                    <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 group-hover:opacity-50 transition-opacity">
                                        {/* Using Recharts Area for Sparkline effect manually if Sparkline component isn't perfect for this */}
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={data}>
                                                <Area type="monotone" dataKey="tds" stroke={STATUS_COLORS[device.status as keyof typeof STATUS_COLORS] || '#30d158'} fill="none" strokeWidth={2} />
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
