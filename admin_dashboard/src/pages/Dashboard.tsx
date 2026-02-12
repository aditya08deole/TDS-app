import { useState, useMemo, useRef } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts'
import { Activity, Droplets, Thermometer, LayoutGrid, TrendingUp, TrendingDown, Zap, Wifi, WifiOff } from 'lucide-react'
import type { EnrichedDevice, SensorData } from '../lib/supabase'
import { useDevices, useDeviceSubscription } from '../hooks/useDeviceQueries'
import { useAllDevicesThingSpeakData, useDeviceLatestReading, useDeviceThingSpeakChartData } from '../hooks/useThingSpeakQueries'
import { getTDSStatus, getTDSCategory, getConnectivityStatus, getDeviceDisplayName } from '../lib/constants'

import { GlassCard } from '@/components/GlassCard'
import { StatusIndicator } from '@/components/StatusIndicator'
import { DashboardCard } from '@/components/DashboardCard'
import { EChartsNestedPieChart } from '@/components/EChartsPieChart'
import { ActivityPanel } from '@/components/ActivityPanel'
import { CriticalTDSBanner } from '@/components/CriticalTDSBanner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AreaChart as AreaChartIcon } from 'lucide-react'

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
    const [selectedLocation, setSelectedLocation] = useState<string>('') // Empty until devices load
    const [dataPointLimit, setDataPointLimit] = useState<number>(100) // Data point count instead of time range
    const criticalSectionRef = useRef<HTMLDivElement>(null)

    // Fetch devices using React Query (with caching)
    const { data: supabaseDevices = [], isLoading: devicesLoading } = useDevices()

    // Subscribe to real-time device changes
    useDeviceSubscription()

    // NEW HYBRID STRATEGY (Phase 1A):
    // 1. Get selected device
    const selectedDevice = useMemo(() =>
        supabaseDevices.find(d => d.id === selectedLocation),
        [supabaseDevices, selectedLocation])

    // 2. Real-time status from ThingSpeak /last.json (3s polling)
    const { data: realTimeStatus } = useDeviceLatestReading(selectedDevice)

    // 3. Real-time chart data from ThingSpeak (replaces Supabase for fresh data)
    const { data: chartData = [] } = useDeviceThingSpeakChartData(selectedDevice, dataPointLimit)

    // 4. Batch fetch ThingSpeak data for ALL devices (for the list/map/stats)
    // This is still needed for the overview stats and device list
    const { devices: devicesWithData, deviceData, isLoading: dataLoading } = useAllDevicesThingSpeakData(supabaseDevices)

    const loading = devicesLoading || dataLoading

    // Auto-select first device
    useMemo(() => {
        if (supabaseDevices.length > 0 && !selectedLocation) {
            setSelectedLocation(supabaseDevices[0].id)
        }
    }, [supabaseDevices, selectedLocation])

    // Enrich devices with dual categorization
    const devices: EnrichedDevice[] = useMemo(() => {
        return devicesWithData.map(device => {
            let status: 'online' | 'warning' | 'critical' | 'offline' = 'offline'

            if (device.is_offline) {
                status = 'offline'
            } else if (device.latest_tds !== undefined) {
                status = getTDSStatus(device.latest_tds)
            }

            const tds_category = getTDSCategory(device.latest_tds)
            // Handle timestamp from either source
            const lastSeen = device.last_reading_at || new Date().toISOString()
            const connectivity_status = getConnectivityStatus(lastSeen)

            return {
                ...device,
                status,
                tds_category,
                connectivity_status,
                last_reading_at: lastSeen
            }
        })
    }, [devicesWithData])

    // Convert ThingSpeak data to SensorData format (Required for 'All Devices' tab sparklines)
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

    // Get current device values (prefer Real-Time Status if available)
    const currentDevice = useMemo(() => {
        // Find enriched device info
        const baseDevice = devices.find(d => d.id === selectedLocation)
        if (!baseDevice) return null

        // Use real-time status if available, otherwise fallback to bulk data
        const latestTDS = realTimeStatus?.tds ?? baseDevice.latest_tds
        const latestTemp = realTimeStatus?.temperature ?? baseDevice.latest_temperature
        const lastSeen = realTimeStatus?.timestamp ?? baseDevice.last_reading_at

        return {
            ...baseDevice,
            latest_tds: latestTDS,
            latest_temperature: latestTemp,
            last_reading_at: lastSeen,
            tds_category: getTDSCategory(latestTDS),
            connectivity_status: getConnectivityStatus(lastSeen)
        }
    }, [selectedLocation, devices, realTimeStatus])

    // Transform ThingSpeak data into chart-friendly format
    const formattedChartData = useMemo(() => {
        return chartData.map(reading => ({
            name: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tds: reading.tds,
            temp: reading.temperature,
            fullDate: new Date(reading.timestamp).toLocaleString()
        }))
    }, [chartData])

    // New categorized stats (Phase 2: UI/UX Upgrade)
    const categorizedStats = useMemo(() => {
        const safeTDSDevices = devices.filter(d => d.tds_category === 'safe')
        const criticalTDSDevices = devices.filter(d => d.tds_category === 'critical')
        const onlineDevices = devices.filter(d => d.connectivity_status === 'online')
        const offlineDevices = devices.filter(d => d.connectivity_status === 'offline')

        return {
            safeTDS: { count: safeTDSDevices.length, devices: safeTDSDevices },
            criticalTDS: { count: criticalTDSDevices.length, devices: criticalTDSDevices },
            online: { count: onlineDevices.length, devices: onlineDevices },
            offline: { count: offlineDevices.length, devices: offlineDevices }
        }
    }, [devices])

    // Use currentDevice for display label
    const locationLabel = currentDevice ? getDeviceDisplayName(currentDevice) : 'No Device Selected'

    // Use formattedChartData for trends (last 2 points)
    const latestTDS = currentDevice?.latest_tds ?? 0
    const prevTDS = formattedChartData.length > 1 ? formattedChartData[formattedChartData.length - 2].tds : latestTDS
    const tdsChange = typeof latestTDS === 'number' && typeof prevTDS === 'number' ? latestTDS - prevTDS : 0

    const avgTemp = formattedChartData.length > 0
        ? (formattedChartData.reduce((s, d) => s + d.temp, 0) / formattedChartData.length).toFixed(1)
        : '--'

    // Calculate system health score based on TDS status
    const systemHealth = useMemo(() => {
        const total = devices.length
        if (total === 0) return 0
        return Math.round(((categorizedStats.safeTDS.count * 100) + (categorizedStats.online.count * 20)) / (total * 1.2))
    }, [categorizedStats, devices.length])

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
                {/* Critical TDS Alert Banner */}
                <CriticalTDSBanner
                    criticalDevices={categorizedStats.criticalTDS.devices}
                    onScrollToSection={() => {
                        criticalSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                />

                {/* Row 1: New TDS-Centric Cards (2x2 Grid) + Pie Chart + Activity */}
                <div className="grid grid-cols-12 gap-4">
                    {/* New Dashboard Cards - 4 cols (2x2 grid) */}
                    <div className="col-span-12 lg:col-span-4 grid grid-cols-2 gap-3">
                        {/* Row 1: Safe TDS, Critical TDS */}
                        <DashboardCard
                            title="Safe TDS"
                            count={categorizedStats.safeTDS.count}
                            icon={Droplets}
                            color="#30d158"
                            devices={categorizedStats.safeTDS.devices}
                        />
                        <DashboardCard
                            title="Critical TDS"
                            count={categorizedStats.criticalTDS.count}
                            icon={Droplets}
                            color="#ff453a"
                            devices={categorizedStats.criticalTDS.devices}
                        />

                        {/* Row 2: Online, Offline */}
                        <DashboardCard
                            title="Online"
                            count={categorizedStats.online.count}
                            icon={Wifi}
                            color="#30d158"
                            devices={categorizedStats.online.devices}
                        />
                        <DashboardCard
                            title="Offline"
                            count={categorizedStats.offline.count}
                            icon={WifiOff}
                            color="#8e8e93"
                            devices={categorizedStats.offline.devices}
                        />
                    </div>

                    {/* Advanced ECharts Pie Chart - Dual View */}
                    <div className="col-span-12 lg:col-span-4">
                        <GlassCard className="p-4 pb-2 h-full transition-all duration-500 hover:shadow-xl">
                            <h3 className="text-sm font-medium mb-2">Device Overview</h3>
                            <div className="h-[300px] relative">
                                <EChartsNestedPieChart
                                    connectivityData={[
                                        { name: 'Online', value: categorizedStats.online.count, color: '#30d158' },
                                        { name: 'Offline', value: categorizedStats.offline.count, color: '#8e8e93' }
                                    ]}
                                    tdsData={[
                                        { name: 'Safe TDS', value: categorizedStats.safeTDS.count, color: '#30d158' },
                                        { name: 'Critical TDS', value: categorizedStats.criticalTDS.count, color: '#ff453a' }
                                    ]}
                                />
                            </div>
                        </GlassCard>
                    </div>

                    {/* Activity Panel - Enhanced with Scrollable Sections */}
                    <div className="col-span-12 lg:col-span-4" ref={criticalSectionRef}>
                        <GlassCard className="p-4 h-full transition-all duration-500 hover:shadow-xl">
                            <ActivityPanel
                                safeTDSDevices={categorizedStats.safeTDS.devices}
                                criticalTDSDevices={categorizedStats.criticalTDS.devices}
                                onDeviceClick={(deviceId) => setSelectedLocation(deviceId)}
                            />
                        </GlassCard>
                    </div>
                </div>

                {/* Categorized Device List - Removed per Phase 3 requirements */}


                {/* Controls Row */}
                <div className="flex items-center justify-between py-0 -mt-[60px]">
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
                                        <SelectItem key={d.id} value={d.id} className="text-xs">{getDeviceDisplayName(d)}</SelectItem>
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
                <div className="grid grid-cols-12 gap-4 -mt-4">
                    {/* TDS Chart */}
                    <div className="col-span-12 lg:col-span-6">
                        {/* Critical TDS Warning Banner */}
                        {currentDevice && currentDevice.tds_category === 'critical' && (
                            <div className="mb-3 rounded-lg border border-[#ff453a]/30 bg-[#ff453a]/10 p-3 flex items-center gap-2 animate-pulse">
                                <Activity className="w-4 h-4 text-[#ff453a]" />
                                <span className="text-xs font-medium text-[#ff453a]">⚠️ Critical TDS Level Detected</span>
                            </div>
                        )}

                        <GlassCard className="p-5 transition-all duration-500 hover:shadow-xl">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${currentDevice?.tds_category === 'critical'
                                            ? 'bg-red-500/10'
                                            : 'bg-green-500/10'
                                            }`}
                                    >
                                        <Droplets
                                            className={`w-5 h-5 ${currentDevice?.tds_category === 'critical'
                                                ? 'text-red-500'
                                                : 'text-green-500'
                                                }`}
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium">TDS Trend</h3>
                                        <p className="text-[11px] text-white/40">{locationLabel}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span
                                        className={`text-xl font-bold font-mono ${currentDevice?.tds_category === 'critical'
                                            ? 'text-red-500'
                                            : 'text-green-500'
                                            }`}
                                    >
                                        {latestTDS}
                                    </span>
                                    <span className="text-xs text-white/40 ml-1">ppm</span>
                                </div>
                            </div>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={formattedChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="tdsGradientSafe" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#30d158" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="tdsGradientCritical" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff453a" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#ff453a" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis dataKey="name" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                        <Area
                                            type="monotone"
                                            dataKey="tds"
                                            stroke={currentDevice?.tds_category === 'critical' ? '#ff453a' : '#30d158'}
                                            fill={currentDevice?.tds_category === 'critical' ? 'url(#tdsGradientCritical)' : 'url(#tdsGradientSafe)'}
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{
                                                r: 5,
                                                fill: currentDevice?.tds_category === 'critical' ? '#ff453a' : '#30d158',
                                                strokeWidth: 2,
                                                stroke: '#000'
                                            }}
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
                        <GlassCard className="p-5 transition-all duration-500 hover:shadow-xl temp-graph-glow">
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
                                    <LineChart data={formattedChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis dataKey="name" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
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
                        const displayName = getDeviceDisplayName(device)

                        return (
                            <GlassCard
                                key={device.id}
                                className="p-4 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl cursor-pointer"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-sm font-medium truncate max-w-[100px]">{displayName}</h4>
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
                                                stroke={device.status === 'online' ? '#30d158' : device.status === 'warning' ? '#ff9f0a' : device.status === 'critical' ? '#ff453a' : '#8e8e93'}
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
