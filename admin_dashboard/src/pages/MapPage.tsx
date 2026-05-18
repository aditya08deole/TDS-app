import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { useTheme } from '../context/ThemeContext'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useDevices, useDeviceSubscription } from '../hooks/useDeviceQueries'
import { useAllDevicesThingSpeakData, useDeviceThingSpeakChartData } from '../hooks/useThingSpeakQueries'
import { getTDSStatus, getDeviceDisplayName, getConnectivityStatus } from '../lib/constants'
import { getPpmStatus, createWhiteTransparentMarker } from '../components/MapMarkers'
import { GlassCard } from '../components/GlassCard'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import { MapSidebarContent } from '../components/MapSidebarContent'
import { useViewport } from '../hooks/useViewport'
import { useIsMobile } from '@/components/ui/use-mobile'
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Maximize2, Minimize2, Layers, X, Droplets, Thermometer, MapPin,
    Wifi, WifiOff, Activity, RefreshCw, List,
    TrendingUp, TrendingDown, AlertCircle
} from 'lucide-react'
import type { ParsedSensorData } from '../lib/thingspeak'
import { type EnrichedDevice, type MapTheme, type MapStyle, type FilterType, type DeviceLocation } from '../types'
import { Capacitor } from '@capacitor/core'

// Fix #20: Ensure icons work on native platforms by providing base64 fallbacks if needed
// or just ensuring the prototype is set correctly after import.
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});

// Fix #20: Ensure icons work on native platforms by providing base64 fallbacks if needed
// or just ensuring the prototype is set correctly after import.
if (typeof L !== 'undefined' && L.Marker && L.Marker.prototype) {
    L.Marker.prototype.options.icon = DefaultIcon;
}

// Fix #21: Log platform for debugging maps on native
const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform();
console.log(`[MAP-INIT] Platform: ${platform}, isNative: ${isNative}`);



const DeviceMarkers = ({ 
    devices, 
    theme, 
    setSelectedDevice 
}: { 
    devices: DeviceLocation[], 
    theme: MapTheme, 
    setSelectedDevice: (d: DeviceLocation) => void 
}) => {
    const map = useMap()
    const [zoom, setZoom] = useState(map.getZoom())

    useEffect(() => {
        const handleZoom = () => setZoom(map.getZoom())
        map.on('zoomend', handleZoom)
        return () => { map.off('zoomend', handleZoom) }
    }, [map])

    return (
        <>
            {devices.map(device => (
                device.latitude && device.longitude && (
                    <Marker
                        key={device.id}
                        position={[device.latitude, device.longitude]}
                        icon={createWhiteTransparentMarker(device, theme, zoom)}
                        bubblingMouseEvents={true}
                        eventHandlers={{ 
                            click: (e) => {
                                L.DomEvent.stopPropagation(e)
                                setSelectedDevice(device)
                            } 
                        }}
                    />
                )
            ))}
        </>
    )
}


function MapController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
    const map = useMap()
    
    // Fix #20: Force map size recalculation on mount to prevent "stopped" rendering on APK
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
            console.log('🗺️ [MAP-INIT] Invalidate size called');
        }, 300);
        return () => clearTimeout(timer);
    }, [map]);

    useEffect(() => {
        if (center) {
            map.flyTo(center, zoom || 17, {
                duration: 1.2,
                easeLinearity: 0.25
            })
        }
    }, [center, zoom, map])
    return null
}


interface ChartTooltipProps {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
    type: 'tds' | 'temp'
    theme: MapTheme
}

const CustomChartTooltip = ({ active, payload, label, type, theme }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
        const colors = type === 'tds' ? theme.chart.tds : theme.chart.temp
        return (
            <div className="px-3 py-2 rounded-lg backdrop-blur-xl border shadow-xl"
                style={{ background: theme.bg.glass, borderColor: colors.stroke + '30' }}>
                <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                <p className="text-sm font-bold font-mono" style={{ color: colors.stroke }}>
                    {payload[0].value} {type === 'tds' ? 'ppm' : '°C'}
                </p>
            </div>
        )
    }
    return null
}

export const getMapTheme = (isDark: boolean): MapTheme => ({
    bg: {
        primary: isDark ? '#000000' : '#f8fafc',
        secondary: isDark ? '#0a0a0a' : '#ffffff',
        tertiary: isDark ? '#141414' : '#f1f5f9',
        card: isDark ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.85)',
        glass: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)',
    },
    border: {
        subtle: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        light: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        accent: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    },
    text: {
        primary: isDark ? '#ffffff' : '#000000',
        secondary: isDark ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.92)',
        muted: isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)',
        accent: isDark ? 'rgba(255, 255, 255, 1.0)' : 'rgba(0, 0, 0, 1.0)',
    },
    status: {
        online: { color: '#00df81', glow: 'rgba(0, 223, 129, 0.4)', bg: 'rgba(0, 223, 129, 0.1)' },
        critical: { color: '#ff0055', glow: 'rgba(255, 0, 85, 0.4)', bg: 'rgba(255, 0, 85, 0.1)' },
        offline: isDark ?
            { color: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)', bg: 'rgba(107, 114, 128, 0.1)' } :
            { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)', bg: 'rgba(148, 163, 184, 0.1)' },
    },
    chart: {
        tds: { stroke: '#818cf8', fill: 'rgba(129, 140, 248, 0.15)', glow: 'rgba(129, 140, 248, 0.3)' },
        temp: { stroke: '#fb923c', fill: 'rgba(251, 146, 60, 0.15)', glow: 'rgba(251, 146, 60, 0.3)' },
    }
})


function DevicePanel({
    device,
    onClose
}: {
    device: EnrichedDevice;
    onClose: () => void
}) {
    const { resolvedTheme } = useTheme()
    const theme = useMemo(() => getMapTheme(resolvedTheme === 'dark'), [resolvedTheme])
    
    const { data: sensorData = [] } = useDeviceThingSpeakChartData(device, 30)
    const panelRef = useRef<HTMLDivElement>(null)
    const { width, height, isPortrait } = useViewport()

    // Calculate safe initial position: shifted down and right
    const [position, setPosition] = useState(() => {
        const leftPanelWidth = isPortrait ? 0 : 320 
        const availableWidth = Math.max(width - leftPanelWidth, 300)
        
        return {
            x: leftPanelWidth + (availableWidth * 0.7) - 160,
            y: height * 0.15 
        }
    })
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')

    const isMobile = useIsMobile()

    // Chart data - limit to last 30 points for cleaner trend visualization
    const chartData = useMemo(() => {
        const last30 = sensorData.slice(-30)
        return last30.map((d: ParsedSensorData) => ({
            time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tds: Math.round(d.tds || 0),
            temp: Math.round(d.temperature || 0)
        }))
    }, [sensorData])

    const tdsTrend = useMemo(() => {
        if (chartData.length < 2) return 0
        return chartData[chartData.length - 1].tds - chartData[chartData.length - 2].tds
    }, [chartData])

    const tempTrend = useMemo(() => {
        if (chartData.length < 2) return 0
        return chartData[chartData.length - 1].temp - chartData[chartData.length - 2].temp
    }, [chartData])

    const ppmStatus = useMemo(() => getPpmStatus(device.latest_tds, device.status || 'offline', theme), [device.latest_tds, device.status, theme])

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isMobile) return
        setIsDragging(true)
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        })
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && !isMobile) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                })
            }
        }
        const handleMouseUp = () => setIsDragging(false)

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, dragOffset, isMobile])

    const panelContent = (
        <GlassCard size="md" className={cn("p-0 border-0 h-full w-full", isMobile ? "rounded-t-[32px] rounded-b-none" : "rounded-[24px]")}>
            {/* Header */}
            <div className="relative p-4" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                {isMobile && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/10" />
                )}
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${ppmStatus.color}, transparent)` }} />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                            style={{ background: ppmStatus.bg, border: `1px solid ${ppmStatus.color}30` }}>
                            {device.status === 'offline' ? (
                                <WifiOff className="w-5 h-5" style={{ color: ppmStatus.color }} />
                            ) : (
                                <Wifi className="w-5 h-5" style={{ color: ppmStatus.color }} />
                            )}
                            {device.status !== 'offline' && (
                                <div className="absolute inset-0 rounded-xl animate-ping opacity-20"
                                    style={{ background: ppmStatus.color }} />
                            )}
                        </div>

                        <div>
                            <h3 className="text-base font-black text-foreground tracking-tight">{getDeviceDisplayName(device)}</h3>
                            <p className="text-[11px] flex items-center gap-1 font-medium" style={{ color: theme.text.muted }}>
                                <MapPin className="w-3 h-3" /> {device.location_name || 'Infrastructure Node'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1 rounded-full bg-red-500 text-white shadow-lg active:scale-90 transition-all border-2 border-white/20"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-2 gap-1 mx-4 mt-3 rounded-xl shadow-inner overflow-hidden" style={{ background: theme.bg.tertiary }}>
                {['overview', 'history'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as 'overview' | 'history')}
                        className="flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-300"
                        style={{
                            background: activeTab === tab ? theme.bg.secondary : 'transparent',
                            color: activeTab === tab ? theme.text.primary : theme.text.muted,
                            boxShadow: activeTab === tab ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                        }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="p-4 space-y-4">
                {activeTab === 'overview' && (
                    <>
                        {/* Compact Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* TDS Card */}
                            <div className="p-3 rounded-2xl nested-glass border border-white/5 shadow-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 px-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                                            <Droplets className="w-3.5 h-3.5" style={{ color: theme.chart.tds.stroke }} />
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: theme.text.muted }}>TDS</span>
                                    </div>
                                    {tdsTrend !== 0 && (
                                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black" 
                                            style={{ background: tdsTrend > 0 ? theme.status.critical.bg : theme.status.online.bg, color: tdsTrend > 0 ? theme.status.critical.color : theme.status.online.color }}>
                                            {tdsTrend > 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                                            {Math.abs(tdsTrend)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-2xl font-black font-mono tracking-tighter" style={{ color: ppmStatus.color }}>{device.latest_tds || '--'}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">ppm</span>
                                </div>
                            </div>

                            {/* Temp Card */}
                            <div className="p-3 rounded-2xl nested-glass border border-white/5 shadow-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 px-1.5 rounded-md bg-orange-500/10 border border-orange-500/20">
                                            <Thermometer className="w-3.5 h-3.5" style={{ color: theme.chart.temp.stroke }} />
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: theme.text.muted }}>Temp</span>
                                    </div>
                                    {tempTrend !== 0 && (
                                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black" 
                                            style={{ background: 'rgba(251, 146, 60, 0.1)', color: theme.chart.temp.stroke }}>
                                            {tempTrend > 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                                            {Math.abs(tempTrend)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-2xl font-black font-mono tracking-tighter" style={{ color: theme.chart.temp.stroke }}>{device.latest_temperature || '--'}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">°C</span>
                                </div>
                            </div>
                        </div>

                        {/* Analysis Indicators */}
                        <div className="p-4 rounded-2xl nested-glass border border-white/5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">Spectral Analysis</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Live Channel</span>
                                </div>
                            </div>
                            
                            <div className={cn(
                                "w-full",
                                isPortrait ? "h-[120px]" : "h-[160px]"
                            )}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="tdsGradMap" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme.chart.tds.stroke} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={theme.chart.tds.stroke} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme.border.subtle} vertical={false} />
                                        <XAxis dataKey="time" hide />
                                        <YAxis tick={{ fontSize: 9, fill: theme.text.muted, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomChartTooltip type="tds" theme={theme} />} />
                                        <Area
                                            type="monotone"
                                            dataKey="tds"
                                            stroke={theme.chart.tds.stroke}
                                            strokeWidth={2.5}
                                            fill="url(#tdsGradMap)"
                                            animationDuration={1000}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto px-1 custom-scrollbar">
                        {chartData.slice().reverse().map((data, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl nested-glass border border-white/5 backdrop-blur-3xl transition-transform active:scale-[0.98]">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">{data.time}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground/60">Node telemetry sync</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <Droplets className="w-3 h-3" style={{ color: theme.chart.tds.stroke }} />
                                        <span className="text-sm font-black font-mono text-foreground">{data.tds}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Thermometer className="w-3 h-3" style={{ color: theme.chart.temp.stroke }} />
                                        <span className="text-sm font-black font-mono text-foreground">{data.temp}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-8 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                        Refreshed {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border shadow-sm"
                    style={{ background: ppmStatus.bg, color: ppmStatus.color, borderColor: `${ppmStatus.color}40` }}>
                    {ppmStatus.label}
                </div>
            </div>
        </GlassCard>
    )

    if (isMobile) {
        return (
            <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
                <SheetContent side="bottom" className="p-0 pb-8 h-[85vh] rounded-t-[40px] border-t-white/20 glass-system-parent backdrop-blur-3xl overflow-hidden focus-visible:ring-0">
                    <div className="h-full overflow-y-auto custom-scrollbar scrollbar-hide">
                        {panelContent}
                    </div>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-[1000] w-[324px] rounded-[24px]"
            style={{
                left: position.x,
                top: position.y,
                cursor: isDragging ? 'grabbing' : 'grab',
                boxShadow: `0 0 60px rgba(0, 0, 0, 0.4), 0 0 30px ${ppmStatus.color}20`,
            }}
            onMouseDown={handleMouseDown}
        >
            {panelContent}
        </motion.div>
    )
}



export default function MapPage() {
    const [mapError] = useState<string | null>(null)
    
    // Fetch devices using React Query (with caching)
    const { data: devicesList = [] } = useDevices()

    // Subscribe to real-time device changes
    useDeviceSubscription()

    // Fetch ThingSpeak data for all devices (ENRICHED with latest only)
    const { devices: devicesWithData } = useAllDevicesThingSpeakData(devicesList)

    const { resolvedTheme } = useTheme()
    const theme = useMemo(() => getMapTheme(resolvedTheme === 'dark'), [resolvedTheme])
    
    // Debug logging for native platform
    useEffect(() => {
        console.log(`[MAP-RENDER] Devices loaded: ${devicesList.length}`);
        console.log(`[MAP-RENDER] Native platform: ${isNative}, Platform: ${platform}`);
    }, [devicesList])

    const [isFullscreen, setIsFullscreen] = useState(false)
    const [mapStyle, setMapStyle] = useState<MapStyle>('street')
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [selectedDevice, setSelectedDevice] = useState<DeviceLocation | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<FilterType>('all')
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Enrich devices with status based on TDS and offline detection
    const devices: DeviceLocation[] = useMemo(() => {
        return devicesWithData.map(device => {
            const customMin = device.safe_tds_min != null ? Number(device.safe_tds_min) : undefined
            const customMax = device.safe_tds_max != null ? Number(device.safe_tds_max) : undefined
            
            // Use the unified connectivity status (1 hour threshold)
            const connectivity = getConnectivityStatus(device.last_reading_at || device.last_seen_at)
            
            // Default to connectivity status
            let status: 'online' | 'critical' | 'offline' = connectivity

            // If online, further refine based on TDS value
            if (connectivity === 'online' && device.latest_tds !== undefined) {
                status = getTDSStatus(device.latest_tds, customMin, customMax)
            }

            return {
                ...device,
                status,
                latest_tds: device.latest_tds,
                latest_temperature: device.latest_temperature
            }
        })
    }, [devicesWithData])

    // Stats calculation
    const stats = useMemo(() => devices.reduce((acc, d) => {
        const s = (d.status || 'offline') as keyof typeof acc
        if (acc[s] !== undefined) acc[s]++
        
        // Connectivity Stat: Count all non-offline devices towards requested 'Online' count
        if (s !== 'offline') acc.online_connected++
        
        return acc
    }, { online: 0, critical: 0, offline: 0, online_connected: 0 }), [devices])

    // Update 'online' to match connectivity as requested by user
    const finalStats = useMemo(() => ({
        ...stats,
        online: stats.online_connected
    }), [stats])

    // Filtered devices
    const filteredDevices = useMemo(() => {
        let result = devices

        if (statusFilter !== 'all') {
            result = result.filter(d => (d.status || 'offline') === statusFilter)
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(d =>
                d.name.toLowerCase().includes(query) ||
                d.location_name?.toLowerCase().includes(query)
            )
        }

        return result
    }, [devices, statusFilter, searchQuery])

    // Refresh handler - smooth rotation only once
    const handleRefresh = useCallback(() => {
        setIsRefreshing(true)
        setTimeout(() => {
            setIsRefreshing(false)
        }, 600)
    }, [])

    // Map tiles
    const tileUrls = {
        street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }
    const labelTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'

    return (
        <div className="relative h-[100dvh] overflow-hidden" style={{ minHeight: '600px', background: 'transparent' }} data-testid="map-container">
            {/* Map Status Indicator - Debug */}
            <div className="absolute top-2 left-2 z-[10] text-xs text-emerald-400 font-mono opacity-60 pointer-events-none">
                {mapError ? (
                    <div className="flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        Error: {mapError}
                    </div>
                ) : (
                    <div className="flex items-center gap-1">
                        ✓ Map initialized | Devices: {devices.length}
                    </div>
                )}
            </div>

            {/* Desktop Sidebar (Left) */}
            <div className="absolute top-28 left-6 z-[500] w-[320px] max-h-[calc(100%-140px)] hidden lg:flex flex-col pointer-events-none">
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex flex-col h-full rounded-[24px] pointer-events-auto"
                >
                    <GlassCard size="md" className="flex flex-col h-full p-0 border-0">
                        <MapSidebarContent 
                            theme={theme}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            finalStats={finalStats}
                            filteredDevices={filteredDevices}
                            selectedDevice={selectedDevice}
                            setSelectedDevice={setSelectedDevice}
                        />
                    </GlassCard>
                </motion.div>
            </div>

            {/* Mobile Nodes Drawer Trigger (Bottom Left) */}
            <div className="lg:hidden absolute bottom-44 left-6 z-[500]">
                <Sheet>
                    <SheetTrigger asChild>
                        <button className="flex items-center gap-2 px-5 py-3 rounded-2xl glass-system-parent border-white/20 shadow-2xl backdrop-blur-3xl active:scale-95 transition-all">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-xs font-black uppercase tracking-widest text-foreground">Nodes</span>
                            <List className="w-4 h-4 text-muted-foreground ml-1" />
                        </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-[85%] max-w-[400px] border-r-white/10 glass-system-parent backdrop-blur-3xl">
                        <MapSidebarContent 
                            theme={theme}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            finalStats={finalStats}
                            filteredDevices={filteredDevices}
                            selectedDevice={selectedDevice}
                            setSelectedDevice={setSelectedDevice}
                        />
                    </SheetContent>
                </Sheet>
            </div>


            <div className="absolute inset-0">

                {/* Map */}
                <MapContainer
                    center={[17.4455, 78.3489]}
                    zoom={15}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%', borderRadius: '0' }}
                    zoomControl={false}
                >
                    <TileLayer attribution='&copy; OpenStreetMap / ESRI' url={tileUrls[mapStyle]} maxZoom={19} />
                    {mapStyle === 'satellite' && <TileLayer url={labelTileUrl} maxZoom={19} />}

                    <MapController center={selectedDevice ? [selectedDevice.latitude!, selectedDevice.longitude!] : null} />

                    <DeviceMarkers 
                        devices={filteredDevices} 
                        theme={theme} 
                        setSelectedDevice={setSelectedDevice} 
                    />
                </MapContainer>

                {/* Top Right Controls */}
                <div className="absolute top-4 right-4 z-[500] flex items-center gap-2">
                    {/* Refresh Button - Single rotation */}
                    <button
                        onClick={handleRefresh}
                        className="p-3 rounded-xl glass-system-micro border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-90"
                    >
                        <RefreshCw
                            className={`w-5 h-5 transition-transform duration-600 ${isRefreshing ? 'rotate-360' : ''}`}
                            style={{ color: theme.text.primary }}
                        />
                    </button>

                    {/* Layer Toggle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowLayerMenu(!showLayerMenu)}
                            className="p-3 rounded-xl glass-system-micro border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-90"
                        >
                            <Layers className="w-5 h-5" style={{ color: theme.text.primary }} />
                        </button>
                        {showLayerMenu && (
                            <div
                                className="absolute top-full right-0 mt-2 p-2 min-w-[140px] rounded-2xl glass-system-parent border-white/20 shadow-2xl animate-scale-in"
                            >
                                <p className="text-[9px] uppercase px-3 py-1 font-medium" style={{ color: theme.text.muted }}>Map Style</p>
                                {[{ id: 'street', label: 'Street Map', icon: '🗺️' }, { id: 'satellite', label: 'Satellite', icon: '🛰️' }].map(style => (
                                    <button
                                        key={style.id}
                                        onClick={() => { setMapStyle(style.id as MapStyle); setShowLayerMenu(false) }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                                        style={{
                                            background: mapStyle === style.id ? theme.status.online.bg : 'transparent',
                                            color: mapStyle === style.id ? theme.status.online.color : theme.text.secondary
                                        }}
                                    >
                                        <span>{style.icon}</span>{style.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Fullscreen */}
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-3 rounded-xl backdrop-blur-xl transition-all duration-300 liquid-ios-glass"
                        style={{ border: '1px solid var(--specular-highlight)' }}
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" style={{ color: theme.text.primary }} /> : <Maximize2 className="w-5 h-5" style={{ color: theme.text.primary }} />}
                    </button>
                </div>
            </div>


            <AnimatePresence>
                {selectedDevice && (
                    <DevicePanel
                        key="device-panel"
                        device={selectedDevice}
                        onClose={() => setSelectedDevice(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
