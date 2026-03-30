import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { useTheme } from '../context/ThemeContext'
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { type EnrichedDevice, type SensorData } from '../types'
import { useDevices, useDeviceSubscription } from '../hooks/useDeviceQueries'
import { useAllDevicesThingSpeakData } from '../hooks/useThingSpeakQueries'
import { getTDSStatus, getDeviceDisplayName, getConnectivityStatus } from '../lib/constants'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
    Maximize2, Minimize2, Layers, X, Droplets, Thermometer, Clock, MapPin,
    Wifi, WifiOff, Activity, Search, ChevronLeft, ChevronRight, RefreshCw,
    TrendingUp, TrendingDown
} from 'lucide-react'

// Default icon fix
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] })
L.Marker.prototype.options.icon = DefaultIcon

type DeviceLocation = EnrichedDevice
type MapStyle = 'street' | 'satellite'
type FilterType = 'all' | 'online' | 'warning' | 'critical' | 'offline'

// ============================================
// THEME COLORS - ADAPTIVE
// ============================================
const getMapTheme = (isDark: boolean) => ({
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
        primary: isDark ? '#ffffff' : '#0f172a',
        secondary: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(15, 23, 42, 0.7)',
        muted: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(15, 23, 42, 0.4)',
        accent: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(15, 23, 42, 0.9)',
    },
    status: {
        online: { color: '#00df81', glow: 'rgba(0, 223, 129, 0.4)', bg: 'rgba(0, 223, 129, 0.1)' },
        warning: { color: '#fb923c', glow: 'rgba(251, 146, 60, 0.4)', bg: 'rgba(251, 146, 60, 0.1)' },
        critical: { color: '#ff0055', glow: 'rgba(255, 0, 85, 0.4)', bg: 'rgba(255, 0, 85, 0.1)' },
        offline: isDark ?
            { color: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)', bg: 'rgba(107, 114, 128, 0.1)' } :
            { color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)', bg: 'rgba(148, 163, 184, 0.1)' },
    },
    chart: {
        tds: { stroke: '#00f2ff', fill: 'rgba(0, 242, 255, 0.15)', glow: 'rgba(0, 242, 255, 0.3)' },
        temp: { stroke: '#fb923c', fill: 'rgba(251, 146, 60, 0.15)', glow: 'rgba(251, 146, 60, 0.3)' },
    }
})

// ============================================
// PPM STATUS HELPER
// ============================================
const getPpmStatus = (ppm: number | undefined, status: string, theme: any, customMin?: number, customMax?: number) => {
    if (status === 'offline' || ppm === undefined) return {
        status: 'offline',
        label: 'Offline',
        ...theme.status.offline
    }
    
    // Use the global helper for consistent categorization
    const tdsStatus = getTDSStatus(ppm, customMin, customMax)
    
    if (tdsStatus === 'online') return {
        status: 'online',
        label: 'Good',
        ...theme.status.online
    }
    if (tdsStatus === 'warning') return {
        status: 'warning',
        label: 'Warning',
        ...theme.status.warning
    }
    return {
        status: 'critical',
        label: 'Critical',
        ...theme.status.critical
    }
}

// ============================================
// WHITE TRANSPARENT MARKER WITH ARROW POINTER
// ============================================
const createWhiteTransparentMarker = (device: DeviceLocation, theme: any, zoom: number) => {
    const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline', theme)
    const ppmValue = device.latest_tds || '--'
    const displayName = getDeviceDisplayName(device)
    
    // Calculate scale factor biased by zoom (base zoom 15)
    const scale = Math.max(0.4, Math.min(1.1, zoom / 15))
    const isDark = theme.bg.primary === '#000000' || theme.bg.primary === '#0a0a0a'

    return L.divIcon({
        className: 'neon-glass-marker',
        html: `
            <div class="relative group flex flex-col items-center" style="transform: scale(${scale}); pointer-events: none;">
                <!-- Neon Glass Marker Body (Compact & Theme Adaptive) -->
                <div class="relative flex items-center gap-3 px-3.5 py-2 rounded-xl transition-all duration-500 group-hover:shadow-[0_0_50px_${ppmStatus.glow}] pointer-events-auto"
                     style="background: ${isDark ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.85)'}; 
                            backdrop-filter: blur(16px);
                            -webkit-backdrop-filter: blur(16px);
                            border: 2px solid ${ppmStatus.color};
                            box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 15px ${ppmStatus.color}40;
                            min-width: 150px;">
                    
                    <!-- Left: Status Shield Icon -->
                    <div class="flex items-center justify-center w-10 h-10 rounded-lg shadow-inner shrink-0"
                         style="background: ${ppmStatus.color}20; border: 1px solid ${ppmStatus.color}40;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${ppmStatus.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    </div>

                    <!-- Right: Info Details -->
                    <div class="flex flex-col flex-1 overflow-hidden">
                        <span class="text-[9px] font-black uppercase tracking-widest mb-0.5 truncate" 
                              style="color: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}">
                            ${displayName}
                        </span>
                        <div class="flex items-baseline gap-1">
                            <span class="text-xl font-black font-mono tracking-tighter" 
                                  style="color: ${isDark ? 'white' : 'black'}; text-shadow: 0 0 10px ${ppmStatus.glow}40;">
                                ${ppmValue}
                            </span>
                            <span class="text-[9px] font-bold uppercase tracking-widest"
                                  style="color: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'}">PPM</span>
                        </div>
                    </div>

                    <!-- Sharp Tail Pin -->
                    <div class="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
                         style="background: ${isDark ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.85)'}; 
                                border-right: 2px solid ${ppmStatus.color}; 
                                border-bottom: 2px solid ${ppmStatus.color};
                                z-index: -1;"></div>
                </div>

                <!-- Ground Collision Glow -->
                <div class="absolute -bottom-[12px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" 
                     style="background: ${ppmStatus.color}; box-shadow: 0 0 20px 4px ${ppmStatus.color};"></div>
            </div>
        `,
        iconSize: [180, 80],
        iconAnchor: [90, 80],
        popupAnchor: [0, -80]
    })
}

// ============================================
// ZOOM-AWARE DEVICE MARKERS COMPONENT
// ============================================
const DeviceMarkers = ({ 
    devices, 
    theme, 
    setSelectedDevice 
}: { 
    devices: DeviceLocation[], 
    theme: any, 
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
                        eventHandlers={{ click: () => setSelectedDevice(device) }}
                    />
                )
            ))}
        </>
    )
}

// ============================================
// MAP CONTROLLER
// ============================================
function MapController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
    const map = useMap()
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

// ============================================
// CUSTOM CHART TOOLTIP
// ============================================
const CustomChartTooltip = ({ active, payload, label, type, theme }: any) => {
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

// ============================================
// FLOATING DEVICE PANEL - FIXED POSITIONING
// ============================================
function DevicePanel({
    device,
    sensorData,
    onClose
}: {
    device: EnrichedDevice;
    sensorData: SensorData[];
    onClose: () => void
}) {
    const { resolvedTheme } = useTheme()
    const theme = useMemo(() => getMapTheme(resolvedTheme === 'dark'), [resolvedTheme])
    const panelRef = useRef<HTMLDivElement>(null)
    // Calculate safe initial position: centered in map area
    const [position, setPosition] = useState(() => {
        const leftPanelWidth = 300
        const availableWidth = window.innerWidth - leftPanelWidth
        // Position panel 50% from the left of available space (centered)
        return {
            x: leftPanelWidth + (availableWidth * 0.5),
            y: 100
        }
    })
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')
    const [isClosing, setIsClosing] = useState(false)

    const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline', theme)

    // Chart data - limit to last 30 points for cleaner trend visualization
    const chartData = useMemo(() => {
        const last30 = sensorData.slice(-30)
        return last30.map((d, i) => ({
            time: new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tds: d.payload.tds,
            temp: d.payload.temperature,
            index: i
        }))
    }, [sensorData])

    // Calculate trends
    const tdsTrend = useMemo(() => {
        if (chartData.length < 2) return 0
        const last = chartData[chartData.length - 1].tds
        const prev = chartData[chartData.length - 2].tds
        return last - prev
    }, [chartData])

    const tempTrend = useMemo(() => {
        if (chartData.length < 2) return 0
        const last = chartData[chartData.length - 1].temp
        const prev = chartData[chartData.length - 2].temp
        return Number((last - prev).toFixed(1))
    }, [chartData])

    // Ensure panel stays within viewport - account for left panel
    useEffect(() => {
        const ensureInViewport = () => {
            const leftPanelWidth = 320 // Left panel + margin
            const panelWidth = 360
            const panelHeight = 600

            const maxX = window.innerWidth - panelWidth - 20
            const maxY = window.innerHeight - panelHeight - 20
            const minX = leftPanelWidth

            setPosition(prev => ({
                x: Math.max(minX, Math.min(maxX, prev.x)),
                y: Math.max(20, Math.min(maxY, prev.y))
            }))
        }
        ensureInViewport()
        window.addEventListener('resize', ensureInViewport)
        return () => window.removeEventListener('resize', ensureInViewport)
    }, [])

    // Drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return
        setIsDragging(true)
        const rect = panelRef.current?.getBoundingClientRect()
        if (rect) setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }, [])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                const leftPanelWidth = 320
                const panelWidth = 360
                const panelHeight = 600

                const newX = Math.max(leftPanelWidth, Math.min(window.innerWidth - panelWidth - 20, e.clientX - dragOffset.x))
                const newY = Math.max(20, Math.min(window.innerHeight - panelHeight - 20, e.clientY - dragOffset.y))
                setPosition({ x: newX, y: newY })
            }
        }
        const handleMouseUp = () => setIsDragging(false)

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, dragOffset])

    // Close with animation
    const handleClose = () => {
        setIsClosing(true)
        setTimeout(() => onClose(), 300)
    }

    return (
        <div
            ref={panelRef}
            className={`fixed z-[1000] w-[360px] rounded-2xl overflow-hidden transition-all duration-300 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
            style={{
                left: position.x,
                top: position.y,
                cursor: isDragging ? 'grabbing' : 'grab',
                background: theme.bg.glass,
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: `1px solid ${theme.border.light}`,
                boxShadow: `0 0 60px rgba(0, 0, 0, 0.4), 0 0 30px ${ppmStatus.glow}`,
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className="relative p-4" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${ppmStatus.color}, transparent)` }} />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
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
                            <h3 className="text-base font-semibold text-foreground">{device.location_name || device.name}</h3>
                            <p className="text-[11px] flex items-center gap-1" style={{ color: theme.text.muted }}>
                                <MapPin className="w-3 h-3" /> {device.location_name}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg transition-all duration-200 hover:scale-110 hover:bg-white/5"
                        style={{ background: theme.bg.tertiary }}
                    >
                        <X className="w-4 h-4" style={{ color: theme.text.muted }} />
                    </button>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-2 gap-1 mx-4 mt-3 rounded-lg" style={{ background: theme.bg.tertiary }}>
                {['overview', 'history'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className="flex-1 py-2 rounded-md text-xs font-medium transition-all duration-200"
                        style={{
                            background: activeTab === tab ? theme.bg.secondary : 'transparent',
                            color: activeTab === tab ? theme.text.primary : theme.text.muted,
                            border: activeTab === tab ? `1px solid ${theme.border.accent}` : '1px solid transparent'
                        }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {activeTab === 'overview' && (
                    <>
                        {/* Compact Stats Grid */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* TDS Card - Smaller */}
                            <div className="p-3 rounded-xl" style={{ background: theme.bg.tertiary, border: `1px solid ${theme.border.subtle}` }}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Droplets className="w-3.5 h-3.5" style={{ color: theme.chart.tds.stroke }} />
                                        <span className="text-[9px] uppercase tracking-wider" style={{ color: theme.text.muted }}>TDS</span>
                                    </div>
                                    {tdsTrend !== 0 && (
                                        <div className="flex items-center gap-0.5" style={{ color: tdsTrend > 0 ? theme.status.critical.color : theme.status.online.color }}>
                                            {tdsTrend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                            <span className="text-[8px]">{Math.abs(tdsTrend)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold font-mono" style={{ color: ppmStatus.color }}>{device.latest_tds || '--'}</span>
                                    <span className="text-[10px]" style={{ color: theme.text.muted }}>ppm</span>
                                </div>
                            </div>

                            {/* Temp Card - Smaller */}
                            <div className="p-3 rounded-xl" style={{ background: theme.bg.tertiary, border: `1px solid ${theme.border.subtle}` }}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <Thermometer className="w-3.5 h-3.5" style={{ color: theme.chart.temp.stroke }} />
                                        <span className="text-[9px] uppercase tracking-wider" style={{ color: theme.text.muted }}>Temp</span>
                                    </div>
                                    {tempTrend !== 0 && (
                                        <div className="flex items-center gap-0.5" style={{ color: tempTrend > 0 ? theme.chart.temp.stroke : theme.chart.tds.stroke }}>
                                            {tempTrend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                            <span className="text-[8px]">{Math.abs(tempTrend)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold font-mono" style={{ color: theme.chart.temp.stroke }}>{device.latest_temperature || '--'}</span>
                                    <span className="text-[10px]" style={{ color: theme.text.muted }}>°C</span>
                                </div>
                            </div>
                        </div>

                        {/* TDS Chart */}
                        <div className="p-3 rounded-xl" style={{ background: theme.bg.tertiary, border: `1px solid ${theme.border.subtle}` }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: theme.chart.tds.stroke }}>
                                    TDS History (24H)
                                </span>
                                <Activity className="w-3 h-3" style={{ color: theme.chart.tds.stroke }} />
                            </div>
                            <div className="h-[70px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="tdsGradPanel" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme.chart.tds.stroke} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={theme.chart.tds.stroke} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme.border.subtle} vertical={false} />
                                        <XAxis dataKey="time" tick={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 8, fill: theme.text.muted }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomChartTooltip type="tds" theme={theme} />} />
                                        <Area
                                            type="monotone"
                                            dataKey="tds"
                                            stroke={theme.chart.tds.stroke}
                                            strokeWidth={2}
                                            fill="url(#tdsGradPanel)"
                                            animationDuration={600}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Temp Chart */}
                        <div className="p-3 rounded-xl" style={{ background: theme.bg.tertiary, border: `1px solid ${theme.border.subtle}` }}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: theme.chart.temp.stroke }}>
                                    Temp History (24H)
                                </span>
                                <Activity className="w-3 h-3" style={{ color: theme.chart.temp.stroke }} />
                            </div>
                            <div className="h-[70px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme.border.subtle} vertical={false} />
                                        <XAxis dataKey="time" tick={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 8, fill: theme.text.muted }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                                        <Tooltip content={<CustomChartTooltip type="temp" theme={theme} />} />
                                        <Line
                                            type="monotone"
                                            dataKey="temp"
                                            stroke={theme.chart.temp.stroke}
                                            strokeWidth={2}
                                            dot={false}
                                            animationDuration={600}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                        {chartData.slice().reverse().map((data, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:scale-[1.01]"
                                    style={{ background: theme.bg.tertiary, border: `1px solid ${theme.border.subtle}` }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-[11px]" style={{ color: theme.text.muted }}>{data.time}</div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Droplets className="w-3 h-3" style={{ color: theme.chart.tds.stroke }} />
                                            <span className="text-sm font-mono" style={{ color: theme.text.secondary }}>{data.tds} ppm</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Thermometer className="w-3 h-3" style={{ color: theme.chart.temp.stroke }} />
                                            <span className="text-sm font-mono" style={{ color: theme.text.secondary }}>{data.temp}°C</span>
                                        </div>
                                    </div>
                                </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.text.muted }}>
                    <Clock className="w-3 h-3" />
                    Updated: {new Date().toLocaleTimeString()}
                </div>
                <div
                    className="px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: ppmStatus.bg, color: ppmStatus.color, border: `1px solid ${ppmStatus.color}30` }}
                >
                    {ppmStatus.label}
                </div>
            </div>
        </div>
    )
}

// ============================================
// MAIN MAP PAGE COMPONENT
// ============================================
export default function MapPage() {
    // Fetch devices using React Query (with caching)
    const { data: devicesList = [] } = useDevices()

    // Subscribe to real-time device changes
    useDeviceSubscription()

    // Fetch ThingSpeak data for all devices (with caching and batching)
    const { devices: devicesWithData, deviceData } = useAllDevicesThingSpeakData(devicesList)

    const { resolvedTheme } = useTheme()
    const theme = useMemo(() => getMapTheme(resolvedTheme === 'dark'), [resolvedTheme])

    const [isFullscreen, setIsFullscreen] = useState(false)
    const [mapStyle, setMapStyle] = useState<MapStyle>('street')
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [selectedDevice, setSelectedDevice] = useState<DeviceLocation | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [panelCollapsed, setPanelCollapsed] = useState(false)
    const [statusFilter, setStatusFilter] = useState<FilterType>('all')
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Convert ThingSpeak data to SensorData format for charts
    const sensorData = useMemo(() => {
        const result: { [key: string]: SensorData[] } = {}
        deviceData.forEach((data, deviceId) => {
            result[deviceId] = data.map((reading, index) => ({
                id: `${deviceId}-${index}`,
                device_id: deviceId,
                payload: {
                    tds: reading.tds,
                    temperature: reading.temperature,
                    voltage: reading.voltage,
                },
                recorded_at: reading.timestamp
            }))
        })
        return result
    }, [deviceData])

    // Enrich devices with status based on TDS and offline detection
    const devices: DeviceLocation[] = useMemo(() => {
        return devicesWithData.map(device => {
            const customMin = device.safe_tds_min ? Number(device.safe_tds_min) : undefined
            const customMax = device.safe_tds_max ? Number(device.safe_tds_max) : undefined
            
            // Use the unified connectivity status (1 hour threshold)
            const connectivity = getConnectivityStatus(device.last_reading_at || device.last_seen_at)
            
            // Default to connectivity status
            let status: 'online' | 'warning' | 'critical' | 'offline' = connectivity

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
    }, { online: 0, warning: 0, critical: 0, offline: 0, online_connected: 0 }), [devices])

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
        <div className="flex h-[calc(100vh-60px)]" style={{ minHeight: '600px', background: theme.bg.primary }}>

            {/* ========== LEFT PANEL ========== */}
            <div
                className={`flex flex-col transition-all duration-300 ease-out ${panelCollapsed ? 'w-0 overflow-hidden' : 'w-[300px]'}`}
                style={{ background: theme.bg.secondary, borderRight: `1px solid ${theme.border.subtle}` }}
            >
                {/* Header */}
                <div className="p-4" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${theme.status.online.color}, ${theme.chart.tds.stroke})` }}>
                            <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold" style={{ color: theme.text.primary }}>Map View</h1>
                            <p className="text-[10px]" style={{ color: theme.text.muted }}>GIS Infrastructure Monitor</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.text.muted }} />
                        <input
                            type="text"
                            placeholder="Search devices..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-1"
                            style={{
                                background: theme.bg.tertiary,
                                border: `1px solid ${theme.border.light}`,
                                color: theme.text.primary,
                            }}
                        />
                    </div>
                </div>

                {/* Status Summary */}
                <div className="grid grid-cols-4 gap-2 p-4" style={{ borderBottom: `1px solid ${theme.border.subtle}` }}>
                    {[
                        { key: 'online', label: 'Online', value: finalStats.online, ...theme.status.online },
                        { key: 'warning', label: 'Warning', value: finalStats.warning, ...theme.status.warning },
                        { key: 'critical', label: 'Critical', value: finalStats.critical, ...theme.status.critical },
                        { key: 'offline', label: 'Offline', value: finalStats.offline, ...theme.status.offline },
                    ].map(s => (
                        <button
                            key={s.key}
                            onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key as FilterType)}
                            className="text-center p-2 rounded-lg transition-all duration-200"
                            style={{
                                background: statusFilter === s.key ? s.bg : 'transparent',
                                border: statusFilter === s.key ? `1px solid ${s.color}30` : `1px solid transparent`
                            }}
                        >
                            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: s.color, boxShadow: `0 0 8px ${s.glow}` }} />
                            <div className="text-base font-bold" style={{ color: theme.text.primary }}>{s.value}</div>
                            <div className="text-[8px] uppercase" style={{ color: theme.text.muted }}>{s.label}</div>
                        </button>
                    ))}
                </div>

                {/* Device List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredDevices.map(device => {
                        const customMin = device.safe_tds_min ? Number(device.safe_tds_min) : undefined
                        const customMax = device.safe_tds_max ? Number(device.safe_tds_max) : undefined
                        const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline', theme, customMin, customMax)
                        const isSelected = selectedDevice?.id === device.id

                        return (
                            <button
                                key={device.id}
                                onClick={() => setSelectedDevice(device)}
                                className="w-full flex items-center justify-between p-4 transition-all duration-200 text-left"
                                style={{
                                    borderBottom: `1px solid ${theme.border.subtle}`,
                                    background: isSelected ? ppmStatus.bg : 'transparent',
                                    borderLeft: isSelected ? `2px solid ${ppmStatus.color}` : '2px solid transparent'
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ background: ppmStatus.bg, border: `1px solid ${ppmStatus.color}30` }}>
                                        <Droplets className="w-4 h-4" style={{ color: ppmStatus.color }} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium" style={{ color: theme.text.primary }}>{device.location_name || device.name}</div>
                                        <div className="text-[10px]" style={{ color: theme.text.muted }}>{device.location_name}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono font-bold" style={{ color: ppmStatus.color }}>
                                        {device.latest_tds || '--'} ppm
                                    </span>
                                    <div className="w-2 h-2 rounded-full" style={{ background: ppmStatus.color, boxShadow: `0 0 6px ${ppmStatus.glow}` }} />
                                </div>
                            </button>
                        )
                    })}
                </div>

                {/* Collapse Button */}
                <button
                    onClick={() => setPanelCollapsed(true)}
                    className="p-3 flex items-center justify-center gap-2 text-xs transition-all duration-200"
                    style={{ borderTop: `1px solid ${theme.border.subtle}`, color: theme.text.muted }}
                >
                    <ChevronLeft className="w-4 h-4" /> Collapse
                </button>
            </div>

            {/* ========== MAP CONTAINER ========== */}
            <div className="flex-1 relative">
                {/* Expand Panel Button */}
                {panelCollapsed && (
                    <button
                        onClick={() => setPanelCollapsed(false)}
                        className="absolute top-4 left-4 z-[500] p-3 rounded-xl backdrop-blur-xl transition-all duration-300"
                        style={{ background: theme.bg.glass, border: `1px solid ${theme.border.light}` }}
                    >
                        <ChevronRight className="w-5 h-5" style={{ color: theme.text.primary }} />
                    </button>
                )}

                {/* Map */}
                <MapContainer
                    center={[17.4455, 78.3489]}
                    zoom={16}
                    scrollWheelZoom={true}
                    style={{ height: '100%', width: '100%' }}
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
                        className="p-3 rounded-xl backdrop-blur-xl transition-all duration-300"
                        style={{ background: theme.bg.glass, border: `1px solid ${theme.border.light}` }}
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
                            className="p-3 rounded-xl backdrop-blur-xl transition-all duration-300"
                            style={{ background: theme.bg.glass, border: `1px solid ${theme.border.light}` }}
                        >
                            <Layers className="w-5 h-5" style={{ color: theme.text.primary }} />
                        </button>
                        {showLayerMenu && (
                            <div
                                className="absolute top-full right-0 mt-2 p-2 min-w-[140px] rounded-xl backdrop-blur-xl animate-scale-in"
                                style={{ background: theme.bg.glass, border: `1px solid ${theme.border.light}` }}
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
                        className="p-3 rounded-xl backdrop-blur-xl transition-all duration-300"
                        style={{ background: theme.bg.glass, border: `1px solid ${theme.border.light}` }}
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" style={{ color: theme.text.primary }} /> : <Maximize2 className="w-5 h-5" style={{ color: theme.text.primary }} />}
                    </button>
                </div>
            </div>

            {/* ========== FLOATING DEVICE PANEL ========== */}
            {selectedDevice && (
                <DevicePanel
                    device={selectedDevice}
                    sensorData={sensorData[selectedDevice.id] || []}
                    onClose={() => setSelectedDevice(null)}
                />
            )}
        </div>
    )
}
