import { useState, useMemo, useRef, useEffect } from 'react'
import {
    ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer
} from 'recharts'
import {
    Droplets, Thermometer, LayoutGrid, TrendingUp, TrendingDown,
    Zap, Wifi, WifiOff, Info, type LucideIcon
} from 'lucide-react'
import { type EnrichedDevice } from '../types'
import { useDevices, useDeviceSubscription } from '../hooks/useDeviceQueries'
import { 
    useAllDevicesThingSpeakData, 
    useDeviceLatestReading, 
    useDeviceThingSpeakChartData 
} from '../hooks/useThingSpeakQueries'
import { getTDSStatus, getTDSCategory, getConnectivityStatus, getDeviceDisplayName } from '../lib/constants'
import { useAlerts } from '../context/AlertContext'

import { GlassCard } from '@/components/GlassCard'
import { EChartsNestedPieChart } from '@/components/EChartsPieChart'
import { ActivityPanel } from '@/components/ActivityPanel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AreaChart as AreaChartIcon } from 'lucide-react'
import { cn } from '../lib/utils'

// ------ Compact Stat Card ------
interface StatCardProps {
    title: string
    count: number
    icon: LucideIcon
    color: string
    devices: EnrichedDevice[]
}

function StatCard({ title, count, icon: Icon, color, devices }: StatCardProps) {
    const [showInfo, setShowInfo] = useState(false)
    return (
        <div className="relative flex-1 min-w-0 h-full">
            <GlassCard className="premium-glass transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group relative overflow-hidden h-full">
                <div className="flex items-center gap-4 px-5 py-4 h-full w-full">
                    {/* Category Icon - Left side */}
                    <div className="p-2.5 rounded-xl transition-all duration-500 group-hover:rotate-6 flex-shrink-0" style={{ backgroundColor: `${color}15`, color }}>
                        <Icon className="w-4.5 h-4.5 drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                    </div>

                    {/* Data - Primary Focus center-left */}
                    <div className="flex-1 min-w-0">
                        <div className="text-2xl font-black font-mono tracking-tighter leading-none mb-1" style={{ color, textShadow: `0 0 15px ${color}40` }}>{count}</div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.1em] group-hover:opacity-100 transition-opacity">{title}</div>
                    </div>

                    {/* Info button - Positioned Absolute Top Right of the card */}
                    <button
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center hover:bg-accent/30 transition-colors z-30"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowInfo(s => !s);
                        }}
                        title={`${title} device list`}
                    >
                        <Info className="w-4 h-4 text-muted-foreground hover:opacity-100 transition-opacity" />
                    </button>
                </div>
            </GlassCard>

            {/* Info popover */}
            {showInfo && (
                <div className="absolute top-full mt-2 left-0 right-0 z-50 premium-glass p-3 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                        <span className="text-xs font-semibold text-foreground">{title} ({count})</span>
                        <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setShowInfo(false)}>✕</button>
                    </div>
                    {devices.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No devices</p>
                    ) : (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            {devices.map((d: EnrichedDevice) => (
                                <div key={d.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg nested-glass text-xs">
                                    <span className="text-foreground truncate flex-1">{getDeviceDisplayName(d)}</span>
                                    {d.latest_tds && <span className="text-muted-foreground ml-2">{d.latest_tds.toFixed(0)} ppm</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ------ Combined Chart Tooltip ------
const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-3 premium-glass backdrop-blur-2xl transition-all duration-300">
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-2 border-b border-border/50 pb-1.5">{label}</p>
                <div className="space-y-1.5">
                    {payload.map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-4 text-xs font-medium">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="text-muted-foreground">{p.name === 'temp' ? 'Temperature' : 'TDS Level'}</span>
                            </div>
                            <span className="text-foreground font-mono font-bold">
                                {p.value} {p.name === 'temp' ? '°C' : 'ppm'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    return null
}

export default function Dashboard() {
    const [selectedLocation, setSelectedLocation] = useState<string>('')
    const [dataPointLimit, setDataPointLimit] = useState<number>(100)
    const [showTDS, setShowTDS] = useState(true)
    const [showTemp, setShowTemp] = useState(true)
    const criticalSectionRef = useRef<HTMLDivElement>(null)

    const { setCriticalDevices } = useAlerts()

    // Fetch devices
    const { data: devicesList = [], isLoading: devicesLoading } = useDevices()
    useDeviceSubscription()

    const selectedDevice = useMemo(() =>
        devicesList.find(d => d.id === selectedLocation),
        [devicesList, selectedLocation])

    const { data: realTimeStatus } = useDeviceLatestReading(selectedDevice)
    const { data: chartData = [] } = useDeviceThingSpeakChartData(selectedDevice, dataPointLimit)
    const { devices: devicesWithData, isLoading: dataLoading } = useAllDevicesThingSpeakData(devicesList)

    const loading = devicesLoading || dataLoading

    useEffect(() => {
        if (devicesList.length > 0 && !selectedLocation) {
            setSelectedLocation(devicesList[0].id)
        }
    }, [devicesList, selectedLocation])

    const devices: EnrichedDevice[] = useMemo(() => {
        return devicesWithData.map(device => {
            let status: 'online' | 'warning' | 'critical' | 'offline' = 'offline'
            if (device.is_offline) {
                status = 'offline'
            } else if (device.latest_tds !== undefined) {
                status = getTDSStatus(device.latest_tds, device.safe_tds_min, device.safe_tds_max)
            }
            const tds_category = getTDSCategory(device.latest_tds, device.safe_tds_min, device.safe_tds_max)
            const lastSeen = device.last_reading_at || device.last_seen_at
            const connectivity_status = getConnectivityStatus(lastSeen)
            return { ...device, status, tds_category, connectivity_status, last_reading_at: lastSeen }
        })
    }, [devicesWithData])

    // Sync critical devices to bell alert context with stability check
    const criticalTDSDeviceList = useMemo(() => devices.filter(d => d.tds_category === 'critical'), [devices])
    const criticalIds = useMemo(() => criticalTDSDeviceList.map(d => d.id).join(','), [criticalTDSDeviceList])
    
    useEffect(() => {
        setCriticalDevices(criticalTDSDeviceList)
    }, [criticalIds, setCriticalDevices]) // Use joined IDs string as dependency to ensure stability


    const currentDevice = useMemo(() => {
        const baseDevice = devices.find(d => d.id === selectedLocation)
        if (!baseDevice) return null
        const latestTDS = realTimeStatus?.tds ?? baseDevice.latest_tds
        const latestTemp = realTimeStatus?.temperature ?? baseDevice.latest_temperature
        const lastSeen = realTimeStatus?.timestamp ?? baseDevice.last_reading_at
        return {
            ...baseDevice,
            latest_tds: latestTDS,
            latest_temperature: latestTemp,
            last_reading_at: lastSeen,
            tds_category: getTDSCategory(latestTDS, baseDevice.safe_tds_min, baseDevice.safe_tds_max),
            connectivity_status: getConnectivityStatus(lastSeen)
        }
    }, [selectedLocation, devices, realTimeStatus])

    const formattedChartData = useMemo(() => {
        return chartData.map(reading => {
            const date = new Date(reading.timestamp)
            const dateStr = date.toLocaleDateString([], { day: '2-digit', month: 'short' })
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            return {
                name: `${dateStr}, ${timeStr}`,
                time: timeStr,
                tds: reading.tds,
                temp: reading.temperature,
                fullDate: date.toLocaleString()
            }
        })
    }, [chartData])

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

    const locationLabel = currentDevice ? getDeviceDisplayName(currentDevice) : 'No Device Selected'
    const latestTDS = currentDevice?.latest_tds ?? 0
    const prevTDS = formattedChartData.length > 1 ? formattedChartData[formattedChartData.length - 2].tds : latestTDS
    const tdsChange = typeof latestTDS === 'number' && typeof prevTDS === 'number' ? latestTDS - prevTDS : 0
    const latestTemp = currentDevice?.latest_temperature ?? (formattedChartData.length > 0 ? formattedChartData[formattedChartData.length - 1].temp : 0)

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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Real-time water quality monitoring</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass-card border-border/50 shadow-sm">
                        <Zap className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-xs font-medium text-green-500">{systemHealth}% Healthy</span>
                    </div>
                    <TabsList className="glass-card border-border/50 h-9 p-1">
                        <TabsTrigger value="default" className="text-xs gap-1.5 h-7 px-3 data-[state=active]:glass-active-glow data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all duration-500">
                            <LayoutGrid className="w-3.5 h-3.5" /> Default
                        </TabsTrigger>
                        <TabsTrigger value="all" className="text-xs gap-1.5 h-7 px-3 data-[state=active]:glass-active-glow data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all duration-500">
                            <AreaChartIcon className="w-3.5 h-3.5" /> All Devices
                        </TabsTrigger>
                    </TabsList>
                </div>
            </div>

            {/* Default View */}
            <TabsContent value="default" className="space-y-4 mt-0">

                {/* ── Row 1: 4 compact stat cards in a single line ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard title="Safe TDS" count={categorizedStats.safeTDS.count} icon={Droplets} color="#00df81" devices={categorizedStats.safeTDS.devices} />
                    <StatCard title="Critical TDS" count={categorizedStats.criticalTDS.count} icon={Droplets} color="#ff0055" devices={categorizedStats.criticalTDS.devices} />
                    <StatCard title="Online" count={categorizedStats.online.count} icon={Wifi} color="#818cf8" devices={categorizedStats.online.devices} />
                    <StatCard title="Offline" count={categorizedStats.offline.count} icon={WifiOff} color="#64748b" devices={categorizedStats.offline.devices} />
                </div>

                {/* ── Row 2: Pie Chart (left) + Combined TDS+Temp Chart (right) ── */}
                <div className="grid grid-cols-12 gap-4">
                    {/* Pie Chart */}
                    <div className="col-span-12 lg:col-span-4">
                        <GlassCard className="p-4 pb-2 h-full transition-all duration-500 hover:shadow-xl">
                            <h3 className="text-sm font-medium mb-2">Device Overview</h3>
                            <div className="h-[320px] relative">
                                <EChartsNestedPieChart
                                    connectivityData={[
                                        { name: 'Online', value: categorizedStats.online.count, color: '#818cf8' },
                                        { name: 'Offline', value: categorizedStats.offline.count, color: '#1e293b' }
                                    ]}
                                    tdsData={[
                                        { name: 'Safe TDS', value: categorizedStats.safeTDS.count, color: '#00df81' },
                                        { name: 'Critical TDS', value: categorizedStats.criticalTDS.count, color: '#ff0055' }
                                    ]}
                                />
                            </div>
                        </GlassCard>
                    </div>

                    {/* Combined TDS + Temperature Chart */}
                    <div className="col-span-12 lg:col-span-8 h-full">
                        <GlassCard variant="liquid" className="p-4 h-full flex flex-col transition-all duration-500 hover:shadow-xl relative overflow-hidden">
                            {/* Inner Header with Controls */}
                            <div className="flex flex-col gap-4 mb-4">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <h2 className="text-base font-bold tracking-tight text-foreground">{locationLabel}</h2>
                                            {currentDevice?.tds_category === 'critical' && showTDS && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                    </span>
                                                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Critical Status</span>
                                                </div>
                                            )}
                                        </div>
                                        {tdsChange !== 0 && (
                                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tdsChange > 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
                                                {tdsChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                {Math.abs(tdsChange)} ppm
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap ml-auto">
                                        {/* Data point range buttons */}
                                        <div className="flex gap-0.5 bg-secondary/30 rounded-lg p-0.5 border border-border/50">
                                            {[60, 100, 500, 1000].map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={() => setDataPointLimit(count)}
                                                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-300 ${dataPointLimit === count ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:bg-secondary/50'}`}
                                                >
                                                    {count}
                                                </button>
                                            ))}
                                        </div>

                                        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                                            <SelectTrigger className="w-[140px] h-8 bg-secondary/30 border-border/50 text-[11px] font-medium rounded-lg">
                                                <SelectValue placeholder="Device" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background/95 backdrop-blur-xl border-border">
                                                {devices.length === 0 ? (
                                                    <SelectItem value="none" disabled className="text-xs">No devices</SelectItem>
                                                ) : (
                                                    devices.map(d => (
                                                        <SelectItem key={d.id} value={d.id} className="text-xs">{getDeviceDisplayName(d)}</SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Custom Toggle Controls & Real-time Info Row */}
                                <div className="flex items-center justify-between pt-1">
                                    <div className="flex items-center gap-8">
                                                                                 <button 
                                            onClick={() => setShowTDS(!showTDS)}
                                            className={cn(
                                                "flex items-center gap-3 transition-all duration-300 group",
                                                showTDS ? "opacity-100" : "opacity-50 grayscale"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-300 shadow-sm",
                                                showTDS 
                                                  ? (currentDevice?.tds_category === 'critical' ? "bg-red-500 border-red-400 shadow-red-500/20" : "bg-emerald-500 border-emerald-400 shadow-emerald-500/20") 
                                                  : "border-muted-foreground/30"
                                            )}>
                                                {showTDS && <Zap className="w-2.5 h-2.5 text-white fill-current" />}
                                            </div>
                                            <div className="flex flex-col items-start translate-y-[1px]">
                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] leading-none mb-1.5">TDS</span>
                                                <div className="flex items-end gap-1">
                                                    <span className={cn(
                                                        "text-base font-black font-mono leading-none transition-all duration-500",
                                                        currentDevice?.tds_category === 'critical' 
                                                            ? "text-red-400 [text-shadow:0_0_8px_rgba(239,68,68,0.4)]" 
                                                            : "text-emerald-400 [text-shadow:0_0_8px_rgba(52,211,153,0.4)]"
                                                    )}>
                                                        {latestTDS}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground font-bold uppercase pb-[1px]">ppm</span>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Temp Toggle */}
                                        <button 
                                            onClick={() => setShowTemp(!showTemp)}
                                            className={cn(
                                                "flex items-center gap-3 transition-all duration-300 group",
                                                showTemp ? "opacity-100" : "opacity-50 grayscale"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-300 shadow-sm",
                                                showTemp ? "bg-orange-500 border-orange-400 shadow-orange-500/20" : "border-muted-foreground/30"
                                            )}>
                                                {showTemp && <Thermometer className="w-2.5 h-2.5 text-white fill-current" />}
                                            </div>
                                            <div className="flex flex-col items-start translate-y-[1px]">
                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em] leading-none mb-1.5">Temp</span>
                                                <div className="flex items-end gap-1">
                                                    <span className="text-base font-black font-mono text-orange-400 leading-none [text-shadow:0_0_8px_rgba(251,146,60,0.4)]">
                                                        {typeof latestTemp === 'number' ? latestTemp.toFixed(1) : latestTemp}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground font-bold uppercase pb-[1px]">°C</span>
                                                </div>
                                            </div>
                                        </button>
                                    </div>

                                    {showTDS && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Last Sync</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                                <span className="text-[11px] font-bold font-mono text-foreground">
                                                    {currentDevice?.last_reading_at ? new Date(currentDevice.last_reading_at).toLocaleTimeString() : 'Never'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 mt-auto">
                                <ResponsiveContainer width="100%" height={290}>
                                    <ComposedChart data={formattedChartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="tdsFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={currentDevice?.tds_category === 'critical' ? '#ff453a' : '#30d158'} stopOpacity={0.25} />
                                                <stop offset="95%" stopColor={currentDevice?.tds_category === 'critical' ? '#ff453a' : '#30d158'} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                        <XAxis 
                                            dataKey="name" 
                                            stroke="#555" 
                                            fontSize={9} 
                                            tickLine={false} 
                                            axisLine={false}
                                            interval="preserveStartEnd"
                                            tickFormatter={(value) => value.split(', ')[1]} // Only show time on labels
                                        />
                                        <YAxis yAxisId="tds" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis yAxisId="temp" orientation="right" stroke="#555" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                                        {showTDS && (
                                            <Area
                                                yAxisId="tds"
                                                type="monotone"
                                                dataKey="tds"
                                                stroke={currentDevice?.tds_category === 'critical' ? '#ff453a' : '#30d158'}
                                                fill="url(#tdsFill)"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, strokeWidth: 2, stroke: '#000' }}
                                                animationDuration={600}
                                            />
                                        )}
                                        {showTemp && (
                                            <Line
                                                yAxisId="temp"
                                                type="monotone"
                                                dataKey="temp"
                                                stroke="#ff9f0a"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{ r: 4, fill: '#ff9f0a', strokeWidth: 2, stroke: '#000' }}
                                                animationDuration={600}
                                            />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </GlassCard>
                    </div>
                </div>

                {/* ── Row 3: Activity Panel (full width below) ── */}
                <div ref={criticalSectionRef}>
                    <GlassCard className="p-4 transition-all duration-500 hover:shadow-xl">
                        <ActivityPanel
                            safeTDSDevices={categorizedStats.safeTDS.devices}
                            criticalTDSDevices={categorizedStats.criticalTDS.devices}
                            onDeviceClick={(deviceId) => setSelectedLocation(deviceId)}
                        />
                    </GlassCard>
                </div>
            </TabsContent>

            {/* All Devices View */}
            <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {devices.map((device, idx) => {
                        const displayName = getDeviceDisplayName(device)
                        return (
                            <GlassCard
                                key={device.id}
                                className="premium-glass p-4 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl cursor-pointer"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-sm font-medium truncate max-w-[100px] text-foreground">{displayName}</h4>
                                        <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{device.location_name}</p>
                                    </div>
                                    <span className={`w-2 h-2 rounded-full mt-1 ${device.connectivity_status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                                </div>
                                <div className="mt-3">
                                    <div className="text-xl font-bold font-mono text-foreground">
                                        {device.latest_tds || '--'} <span className="text-[10px] text-muted-foreground font-normal">ppm</span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">{device.latest_temperature || '--'}°C</div>
                                </div>
                            </GlassCard>
                        )
                    })}
                </div>
            </TabsContent>
        </Tabs>
    )
}
