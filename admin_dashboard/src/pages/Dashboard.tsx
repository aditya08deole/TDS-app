import { useState, useEffect, useMemo } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { Activity, Clock, Droplets, Thermometer, LayoutGrid, TrendingUp, TrendingDown, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Device, SensorData } from '../lib/supabase'
import { useThingSpeakData } from '../hooks/useThingSpeakData'
import { getTDSStatus } from '../lib/constants'

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

// Custom tooltip for pie chart - shows devices count
const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0]
        return (
            <div className="px-3 py-2 rounded-lg border border-white/10 shadow-xl backdrop-blur-xl bg-black/90">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.fill }} />
                    <span className="text-white text-sm font-medium">{data.name}</span>
                </div>
                <p className="text-white/80 text-xs mt-1">{data.value} devices</p>
            </div>
        )
    }
    return null
}

// Custom tooltip for chart data
const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl bg-black/90">
                <p className="text-white/60 text-[11px] mb-1.5">{label}</p>
                {payload.map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-medium">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-white font-mono">{p.value} {p.name === 'temp' ? '°C' : 'ppm'}</span>
                    </div>
                ))}
            </div>
        )
    }
    return null
}

export default function Dashboard() {
    const [supabaseDevices, setSupabaseDevices] = useState<Device[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedLocation, setSelectedLocation] = useState<string>('') // Empty until devices load
    const [dataPointLimit, setDataPointLimit] = useState<number>(100) // Data point count instead of time range

    // Fetch real devices from Supabase
    useEffect(() => {
        const fetchDevices = async () => {
            const { data } = await supabase
                .from('devices')
                .select('*')
                .order('created_at', { ascending: false })

            if (data) {
                setSupabaseDevices(data)
                // Auto-select first device if no device selected yet
                if (data.length > 0 && !selectedLocation) {
                    setSelectedLocation(data[0].id)
                }
                setLoading(false)
            }
        }

        fetchDevices()

        // Subscribe to device changes
        const subscription = supabase
            .channel('dashboard_devices_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
                fetchDevices()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // Fetch real-time ThingSpeak data
    const { devices: devicesWithData, deviceData } = useThingSpeakData(supabaseDevices)

    // Enrich devices with status
    const devices = useMemo(() => {
        return devicesWithData.map(device => {
            let status: 'online' | 'warning' | 'critical' | 'offline' = 'offline'

            if (device.is_offline) {
                status = 'offline'
            } else if (device.latest_tds !== undefined) {
                status = getTDSStatus(device.latest_tds)
            }

            return { ...device, status }
        })
    }, [devicesWithData])

    // Convert ThingSpeak data to SensorData format
    const sensorData = useMemo(() => {
        const result: { [key: string]: SensorData[] } = {}
        deviceData.forEach((data, deviceId) => {
            result[deviceId] = data.map((reading, index) => ({
                id: index,
                device_id: deviceId,
                tds: reading.tds,
                temperature: reading.temperature,
                voltage: reading.voltage,
                recorded_at: reading.timestamp
            }))
        })
        return result
    }, [deviceData])

    const stats = useMemo(() => devices.reduce((acc, d) => {
        const s = d.status as keyof typeof acc
        if (acc[s] !== undefined) acc[s]++
        return acc
    }, { online: 0, warning: 0, critical: 0, offline: 0 }), [devices])

    const selectedDevice = useMemo(() =>
        selectedLocation ? devices.find(d => d.id === selectedLocation) : null
        , [selectedLocation, devices])

    const locationLabel = selectedDevice ? (selectedDevice.location_name || selectedDevice.name) : 'No Device Selected'

    const trendData = useMemo(() => {
        // Use selected device, fallback to first device if not selected
        const effectiveLocation = selectedLocation || devices[0]?.id
        if (!effectiveLocation || !sensorData[effectiveLocation]) return []

        // Get data and slice to the selected data point limit
        const allData = sensorData[effectiveLocation]
        const slicedData = allData.slice(-dataPointLimit)

        return slicedData.map(d => ({
            time: new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tds: d.tds,
            temp: d.temperature
        }))
    }, [selectedLocation, devices, sensorData, dataPointLimit])

    const latestTDS = trendData.length > 0 ? trendData[trendData.length - 1].tds : 0
    const prevTDS = trendData.length > 1 ? trendData[trendData.length - 2].tds : latestTDS
    const tdsChange = latestTDS - prevTDS
    const avgTemp = trendData.length > 0
        ? (trendData.reduce((s, d) => s + d.temp, 0) / trendData.length).toFixed(1)
        : '--'

    // Calculate system health score
    const systemHealth = useMemo(() => {
        const total = devices.length
        if (total === 0) return 0
        return Math.round(((stats.online * 100) + (stats.warning * 50) + (stats.critical * 10)) / total)
    }, [stats, devices.length])

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    )

    return (
        <Tabs defaultValue="default" className="w-full max-w-[1600px] mx-auto space-y-4">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Real-time water quality monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* System Health Badge - NEW FEATURE */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                        <Zap className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs font-medium text-green-500">{systemHealth}% Healthy</span>
                    </div>
                    <TabsList className="bg-white/5 border border-white/10 h-9">
                        <TabsTrigger
                            value="default"
                            className="text-xs gap-1.5 h-7 px-3 data-[state=active]:bg-white/10 transition-all duration-300"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Default
                        </TabsTrigger>
                        <TabsTrigger
                            value="all"
                            className="text-xs gap-1.5 h-7 px-3 data-[state=active]:bg-white/10 transition-all duration-300"
                        >
                            <AreaChartIcon className="w-3.5 h-3.5" /> All Devices
                        </TabsTrigger>
                    </TabsList>
                </div>
            </div>

            {/* Default View */}
            <TabsContent value="default" className="space-y-4 mt-0">
                {/* Row 1: Status Cards (WIDER) + Pie Chart (NARROWER) + Activity */}
                <div className="grid grid-cols-12 gap-4">
                    {/* Status Cards - WIDER (4 cols instead of 3) */}
                    <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-2">
                        {[
                            { label: 'Online', value: stats.online, color: '#30d158', bg: 'bg-green-500/10', icon: Activity },
                            { label: 'Warning', value: stats.warning, color: '#ff9f0a', bg: 'bg-orange-500/10', icon: Activity },
                            { label: 'Critical', value: stats.critical, color: '#ff453a', bg: 'bg-red-500/10', icon: Activity },
                            { label: 'Offline', value: stats.offline, color: '#8e8e93', bg: 'bg-slate-500/10', icon: Activity },
                        ].map((s, idx) => (
                            <div
                                key={s.label}
                                className="flex flex-col justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:scale-[1.02] transition-all duration-300 cursor-pointer min-h-[100px]"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center transition-transform duration-300 hover:scale-110`}>
                                        <s.icon className="w-5 h-5" style={{ color: s.color }} />
                                    </div>
                                    <span className="text-3xl font-bold font-mono">{s.value}</span>
                                </div>
                                <span className="text-sm text-white/60 mt-2">{s.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Pie Chart - NARROWER (4 cols instead of 5) */}
                    <div className="col-span-12 lg:col-span-4">
                        <GlassCard className="p-4 h-full transition-all duration-500 hover:shadow-xl">
                            <h3 className="text-sm font-medium mb-1">Device Status</h3>
                            <div className="h-[180px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Online', value: stats.online },
                                                { name: 'Warning', value: stats.warning },
                                                { name: 'Critical', value: stats.critical },
                                                { name: 'Offline', value: stats.offline }
                                            ]}
                                            cx="50%" cy="50%"
                                            innerRadius={45} outerRadius={70}
                                            paddingAngle={3} dataKey="value" strokeWidth={0}
                                        >
                                            <Cell fill={STATUS_COLORS.online} />
                                            <Cell fill={STATUS_COLORS.warning} />
                                            <Cell fill={STATUS_COLORS.critical} />
                                            <Cell fill={STATUS_COLORS.offline} />
                                        </Pie>
                                        <Tooltip content={<PieTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Label - NEW FEATURE */}
                                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                    <span className="text-2xl font-bold">{devices.length}</span>
                                    <span className="text-[10px] text-white/50">Total</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-white/50">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#30d158]" />Online ({stats.online})</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ff9f0a]" />Warning ({stats.warning})</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#ff453a]" />Critical ({stats.critical})</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#8e8e93]" />Offline ({stats.offline})</span>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Recent Activity - Same (4 cols) */}
                    <div className="col-span-12 lg:col-span-4">
                        <GlassCard className="p-4 h-full transition-all duration-500 hover:shadow-xl">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium">Recent Activity</h3>
                                <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{devices.length} devices</span>
                            </div>
                            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                                {devices.map((d, idx) => {
                                    const latest = sensorData[d.id]?.[sensorData[d.id]?.length - 1]
                                    return (
                                        <div
                                            key={d.id}
                                            className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                                            style={{ animationDelay: `${idx * 30}ms` }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <StatusIndicator status={d.status} size="sm" />
                                                <div>
                                                    <div className="text-xs font-medium">{d.location_name || d.name}</div>
                                                    <div className="text-[10px] text-white/40">{d.location_name}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-mono font-semibold">
                                                    {latest?.tds || '--'} <span className="text-white/40 font-normal">ppm</span>
                                                </div>
                                                <div className="text-[10px] text-white/40 flex items-center gap-0.5 justify-end">
                                                    <Clock className="w-2.5 h-2.5" /> {latest?.recorded_at ? new Date(latest.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
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
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold">{locationLabel}</h2>
                        {/* TDS Change Indicator - NEW FEATURE */}
                        {tdsChange !== 0 && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tdsChange > 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                                }`}>
                                {tdsChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {Math.abs(tdsChange)} ppm
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
                            {[60, 100, 500, 1000].map((count) => (
                                <button
                                    key={count}
                                    onClick={() => setDataPointLimit(count)}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-all duration-300 ${dataPointLimit === count
                                        ? 'bg-primary text-white shadow-lg'
                                        : 'text-white/50 hover:bg-white/[0.08]'
                                        }`}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                            <SelectTrigger className="w-[160px] h-8 bg-white/[0.03] border-white/[0.08] text-xs transition-all duration-300 hover:bg-white/[0.06]">
                                <SelectValue placeholder={devices.length === 0 ? "No Devices" : "Select Device"} />
                            </SelectTrigger>
                            <SelectContent className="bg-black/95 backdrop-blur-xl border-white/10">
                                {devices.length === 0 ? (
                                    <SelectItem value="none" disabled className="text-xs text-white/40">No devices added</SelectItem>
                                ) : (
                                    devices.map(d => (
                                        <SelectItem key={d.id} value={d.id} className="text-xs">{d.location_name || d.name}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <Button
                            size="sm"
                            className="h-8 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs gap-1.5 transition-all duration-300 hover:scale-[1.02]"
                        >
                            <Activity className="w-3.5 h-3.5" /> Live
                        </Button>
                    </div>
                </div>

                {/* Charts Row - BIGGER */}
                <div className="grid grid-cols-12 gap-4">
                    {/* TDS Chart */}
                    <div className="col-span-12 lg:col-span-6">
                        <GlassCard className="p-5 transition-all duration-500 hover:shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center transition-transform duration-300 hover:scale-110">
                                        <Droplets className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium">TDS Trend</h3>
                                        <p className="text-[11px] text-white/40">{locationLabel}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-bold font-mono text-green-500">{latestTDS}</span>
                                    <span className="text-xs text-white/40 ml-1">ppm</span>
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="tdsGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#30d158" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis dataKey="time" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                        <Area
                                            type="monotone"
                                            dataKey="tds"
                                            stroke="#30d158"
                                            strokeWidth={2.5}
                                            fill="url(#tdsGradient)"
                                            animationDuration={800}
                                            animationEasing="ease-out"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    </div>

                    {/* Temperature Chart */}
                    <div className="col-span-12 lg:col-span-6">
                        <GlassCard className="p-5 transition-all duration-500 hover:shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center transition-transform duration-300 hover:scale-110">
                                        <Thermometer className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium">Temperature Trend</h3>
                                        <p className="text-[11px] text-white/40">{locationLabel}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-xl font-bold font-mono text-orange-500">{avgTemp}</span>
                                    <span className="text-xs text-white/40 ml-1">°C avg</span>
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis dataKey="time" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#555" fontSize={9} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                        <Line
                                            type="monotone"
                                            dataKey="temp"
                                            stroke="#ff9f0a"
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{ r: 5, fill: '#ff9f0a', strokeWidth: 2, stroke: '#000' }}
                                            animationDuration={800}
                                            animationEasing="ease-out"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </TabsContent>

            {/* All Devices View */}
            <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {devices.map((device, idx) => {
                        const data = sensorData[device.id] || []
                        const latest = data[data.length - 1]

                        return (
                            <GlassCard
                                key={device.id}
                                className="p-4 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl cursor-pointer"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-sm font-medium truncate max-w-[100px]">{device.location_name || device.name}</h4>
                                        <p className="text-[10px] text-white/40 truncate max-w-[100px]">{device.location_name}</p>
                                    </div>
                                    <StatusIndicator status={device.status} size="sm" pulse />
                                </div>
                                <div className="mt-3">
                                    <div className="text-xl font-bold font-mono">
                                        {latest?.tds || '--'} <span className="text-[10px] text-white/40 font-normal">ppm</span>
                                    </div>
                                    <div className="text-[11px] text-white/50">{latest?.temperature || '--'}°C</div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 h-12 opacity-30 group-hover:opacity-50 transition-opacity duration-500">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data}>
                                            <Area
                                                type="monotone"
                                                dataKey="tds"
                                                stroke={STATUS_COLORS[device.status as keyof typeof STATUS_COLORS]}
                                                fill="none"
                                                strokeWidth={1.5}
                                            />
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
