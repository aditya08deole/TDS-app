// MapPage.tsx - Premium iOS Dark Theme Map with Neon Rectangular Markers
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { Device, SensorData } from '../lib/supabase'
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

type DeviceLocation = Device & { latest_tds?: number; latest_temp?: number }
type MapStyle = 'street' | 'satellite'
type FilterType = 'all' | 'online' | 'warning' | 'critical' | 'offline'

// ============================================
// THEME COLORS - Pure Black iOS Theme
// ============================================
const THEME = {
    bg: {
        primary: '#000000',
        secondary: '#0a0a0a',
        tertiary: '#141414',
        card: 'rgba(10, 10, 10, 0.85)',
        glass: 'rgba(0, 0, 0, 0.75)',
    },
    border: {
        subtle: 'rgba(255, 255, 255, 0.05)',
        light: 'rgba(255, 255, 255, 0.08)',
        accent: 'rgba(255, 255, 255, 0.12)',
    },
    text: {
        primary: '#ffffff',
        secondary: 'rgba(255, 255, 255, 0.7)',
        muted: 'rgba(255, 255, 255, 0.4)',
        accent: 'rgba(255, 255, 255, 0.9)',
    },
    status: {
        online: { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)', bg: 'rgba(34, 197, 94, 0.1)' },
        warning: { color: '#eab308', glow: 'rgba(234, 179, 8, 0.4)', bg: 'rgba(234, 179, 8, 0.1)' },
        critical: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)', bg: 'rgba(239, 68, 68, 0.1)' },
        offline: { color: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)', bg: 'rgba(107, 114, 128, 0.1)' },
    },
    chart: {
        tds: { stroke: '#22d3ee', fill: 'rgba(34, 211, 238, 0.15)', glow: 'rgba(34, 211, 238, 0.3)' },
        temp: { stroke: '#fb923c', fill: 'rgba(251, 146, 60, 0.15)', glow: 'rgba(251, 146, 60, 0.3)' },
    }
}

// ============================================
// PPM STATUS HELPER
// ============================================
const getPpmStatus = (ppm: number | undefined, status: string) => {
    if (status === 'offline' || !ppm) return {
        status: 'offline',
        label: 'Offline',
        ...THEME.status.offline
    }
    if (ppm < 150) return {
        status: 'online',
        label: 'Good',
        ...THEME.status.online
    }
    if (ppm <= 200) return {
        status: 'warning',
        label: 'Warning',
        ...THEME.status.warning
    }
    return {
        status: 'critical',
        label: 'Critical',
        ...THEME.status.critical
    }
}

// ============================================
// NEON RECTANGULAR MARKER - Small, Translucent with Name
// ============================================
const createNeonMarkerIcon = (device: DeviceLocation) => {
    const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline')
    const ppmValue = device.latest_tds || '--'
    const isOffline = device.status === 'offline'
    const shortName = device.name.length > 12 ? device.name.substring(0, 12) + '...' : device.name

    return L.divIcon({
        className: 'neon-marker',
        html: `
            <div class="relative group" style="transform: translate(-50%, -100%);">
                <!-- Glow effect -->
                <div class="absolute inset-0 rounded-lg blur-md opacity-60" 
                     style="background: ${ppmStatus.glow}; transform: scale(1.1);"></div>
                
                <!-- Main marker body - Rectangular translucent -->
                <div class="relative flex flex-col items-center px-2.5 py-1.5 rounded-lg backdrop-blur-xl transition-all duration-300 group-hover:scale-105"
                     style="background: ${THEME.bg.glass}; border: 1px solid ${ppmStatus.color}40; box-shadow: 0 0 20px ${ppmStatus.glow}, inset 0 0 20px ${ppmStatus.glow};">
                    
                    <!-- Status dot and name row -->
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <div class="w-1.5 h-1.5 rounded-full ${!isOffline ? 'animate-pulse' : ''}" 
                             style="background: ${ppmStatus.color}; box-shadow: 0 0 8px ${ppmStatus.glow};"></div>
                        <span class="text-[9px] font-medium text-white/80 whitespace-nowrap">${shortName}</span>
                    </div>
                    
                    <!-- PPM Value -->
                    <div class="flex items-baseline gap-0.5">
                        <span class="text-sm font-bold font-mono" style="color: ${ppmStatus.color}; text-shadow: 0 0 10px ${ppmStatus.glow};">${ppmValue}</span>
                        <span class="text-[8px] text-white/40">ppm</span>
                    </div>
                </div>
                
                <!-- Pointer/Arrow -->
                <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0" 
                     style="border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${ppmStatus.color}40;"></div>
            </div>
        `,
        iconSize: [80, 50],
        iconAnchor: [40, 50],
        popupAnchor: [0, -50]
    })
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
const CustomChartTooltip = ({ active, payload, label, type }: any) => {
    if (active && payload && payload.length) {
        const colors = type === 'tds' ? THEME.chart.tds : THEME.chart.temp
        return (
            <div className="px-3 py-2 rounded-lg backdrop-blur-xl border shadow-xl"
                style={{ background: THEME.bg.glass, borderColor: colors.stroke + '30' }}>
                <p className="text-[10px] text-white/50 mb-1">{label}</p>
                <p className="text-sm font-bold font-mono" style={{ color: colors.stroke }}>
                    {payload[0].value} {type === 'tds' ? 'ppm' : '°C'}
                </p>
            </div>
        )
    }
    return null
}

// ============================================
// FLOATING DEVICE PANEL - Black Translucent iOS Style
// ============================================
function DevicePanel({
    device,
    sensorData,
    onClose
}: {
    device: DeviceLocation;
    sensorData: SensorData[];
    onClose: () => void
}) {
    const panelRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ x: window.innerWidth - 380, y: 80 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')

    const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline')

    // Chart data
    const chartData = useMemo(() => sensorData.map((d, i) => ({
        time: new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tds: d.tds,
        temp: d.temperature,
        index: i
    })), [sensorData])

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
                setPosition({
                    x: Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragOffset.x)),
                    y: Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffset.y))
                })
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

    return (
        <div
            ref={panelRef}
            className="fixed z-[1000] w-[360px] rounded-2xl overflow-hidden transition-shadow duration-300"
            style={{
                left: position.x,
                top: position.y,
                cursor: isDragging ? 'grabbing' : 'grab',
                background: THEME.bg.glass,
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: `1px solid ${THEME.border.light}`,
                boxShadow: `0 0 60px rgba(0, 0, 0, 0.8), 0 0 30px ${ppmStatus.glow}`,
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Header with accent line */}
            <div className="relative p-4" style={{ borderBottom: `1px solid ${THEME.border.subtle}` }}>
                {/* Top accent glow */}
                <div className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: `linear-gradient(90deg, transparent, ${ppmStatus.color}, transparent)` }} />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Status icon */}
                        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
                            style={{ background: ppmStatus.bg, border: `1px solid ${ppmStatus.color}30` }}>
                            {device.status === 'offline' ? (
                                <WifiOff className="w-5 h-5" style={{ color: ppmStatus.color }} />
                            ) : (
                                <Wifi className="w-5 h-5" style={{ color: ppmStatus.color }} />
                            )}
                            {/* Pulse ring */}
                            {device.status !== 'offline' && (
                                <div className="absolute inset-0 rounded-xl animate-ping opacity-20"
                                    style={{ background: ppmStatus.color }} />
                            )}
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-white">{device.name}</h3>
                            <p className="text-[11px] flex items-center gap-1" style={{ color: THEME.text.muted }}>
                                <MapPin className="w-3 h-3" /> {device.location_name}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
                        style={{ background: THEME.bg.tertiary }}
                    >
                        <X className="w-4 h-4" style={{ color: THEME.text.muted }} />
                    </button>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex p-2 gap-1 mx-4 mt-3 rounded-lg" style={{ background: THEME.bg.tertiary }}>
                {['overview', 'history'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className="flex-1 py-2 rounded-md text-xs font-medium transition-all duration-200"
                        style={{
                            background: activeTab === tab ? THEME.bg.secondary : 'transparent',
                            color: activeTab === tab ? THEME.text.primary : THEME.text.muted,
                            border: activeTab === tab ? `1px solid ${THEME.border.accent}` : '1px solid transparent'
                        }}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
                {activeTab === 'overview' && (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* TDS Card */}
                            <div className="p-4 rounded-xl" style={{ background: THEME.bg.tertiary, border: `1px solid ${THEME.border.subtle}` }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Droplets className="w-4 h-4" style={{ color: THEME.chart.tds.stroke }} />
                                        <span className="text-[10px] uppercase tracking-wider" style={{ color: THEME.text.muted }}>TDS Level</span>
                                    </div>
                                    {tdsTrend !== 0 && (
                                        <div className="flex items-center gap-0.5" style={{ color: tdsTrend > 0 ? THEME.status.critical.color : THEME.status.online.color }}>
                                            {tdsTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            <span className="text-[9px]">{Math.abs(tdsTrend)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold font-mono" style={{ color: ppmStatus.color }}>{device.latest_tds || '--'}</span>
                                    <span className="text-xs" style={{ color: THEME.text.muted }}>ppm</span>
                                </div>
                            </div>

                            {/* Temp Card */}
                            <div className="p-4 rounded-xl" style={{ background: THEME.bg.tertiary, border: `1px solid ${THEME.border.subtle}` }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Thermometer className="w-4 h-4" style={{ color: THEME.chart.temp.stroke }} />
                                        <span className="text-[10px] uppercase tracking-wider" style={{ color: THEME.text.muted }}>Temp</span>
                                    </div>
                                    {tempTrend !== 0 && (
                                        <div className="flex items-center gap-0.5" style={{ color: tempTrend > 0 ? THEME.chart.temp.stroke : THEME.chart.tds.stroke }}>
                                            {tempTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                            <span className="text-[9px]">{Math.abs(tempTrend)}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold font-mono" style={{ color: THEME.chart.temp.stroke }}>{device.latest_temp || '--'}</span>
                                    <span className="text-xs" style={{ color: THEME.text.muted }}>°C</span>
                                </div>
                            </div>
                        </div>

                        {/* Mini TDS Chart */}
                        <div className="p-4 rounded-xl" style={{ background: THEME.bg.tertiary, border: `1px solid ${THEME.border.subtle}` }}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: THEME.chart.tds.stroke }}>
                                    TDS History (24H)
                                </span>
                                <Activity className="w-3.5 h-3.5" style={{ color: THEME.chart.tds.stroke }} />
                            </div>
                            <div className="h-[80px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="tdsGradPanel" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={THEME.chart.tds.stroke} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={THEME.chart.tds.stroke} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={THEME.border.subtle} vertical={false} />
                                        <XAxis dataKey="time" tick={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 8, fill: THEME.text.muted }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomChartTooltip type="tds" />} />
                                        <Area
                                            type="monotone"
                                            dataKey="tds"
                                            stroke={THEME.chart.tds.stroke}
                                            strokeWidth={2}
                                            fill="url(#tdsGradPanel)"
                                            animationDuration={600}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Mini Temp Chart */}
                        <div className="p-4 rounded-xl" style={{ background: THEME.bg.tertiary, border: `1px solid ${THEME.border.subtle}` }}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: THEME.chart.temp.stroke }}>
                                    Temp History (24H)
                                </span>
                                <Activity className="w-3.5 h-3.5" style={{ color: THEME.chart.temp.stroke }} />
                            </div>
                            <div className="h-[80px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={THEME.border.subtle} vertical={false} />
                                        <XAxis dataKey="time" tick={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 8, fill: THEME.text.muted }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                                        <Tooltip content={<CustomChartTooltip type="temp" />} />
                                        <Line
                                            type="monotone"
                                            dataKey="temp"
                                            stroke={THEME.chart.temp.stroke}
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
                                style={{ background: THEME.bg.tertiary, border: `1px solid ${THEME.border.subtle}` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-[11px]" style={{ color: THEME.text.muted }}>{data.time}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        <Droplets className="w-3 h-3" style={{ color: THEME.chart.tds.stroke }} />
                                        <span className="text-sm font-mono" style={{ color: THEME.text.secondary }}>{data.tds} ppm</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Thermometer className="w-3 h-3" style={{ color: THEME.chart.temp.stroke }} />
                                        <span className="text-sm font-mono" style={{ color: THEME.text.secondary }}>{data.temp}°C</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: THEME.text.muted }}>
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
    const [devices, setDevices] = useState<DeviceLocation[]>([])
    const [sensorData, setSensorData] = useState<{ [key: string]: SensorData[] }>({})
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [mapStyle, setMapStyle] = useState<MapStyle>('street')
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [selectedDevice, setSelectedDevice] = useState<DeviceLocation | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [panelCollapsed, setPanelCollapsed] = useState(false)
    const [statusFilter, setStatusFilter] = useState<FilterType>('all')
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Mock data initialization
    useEffect(() => {
        const mockDevices: DeviceLocation[] = [
            { id: '1', name: 'Himalaya Mess', location_name: 'Main Dining Hall', status: 'online', latitude: 17.4455, longitude: 78.3489, latest_tds: 186, latest_temp: 25.2 },
            { id: '2', name: 'Vindhya Mess', location_name: 'North Campus', status: 'online', latitude: 17.4470, longitude: 78.3510, latest_tds: 225, latest_temp: 24.8 },
            { id: '3', name: 'Kadamba Canteen', location_name: 'Academic Block', status: 'warning', latitude: 17.4440, longitude: 78.3470, latest_tds: 425, latest_temp: 26.1 },
            { id: '4', name: 'Library', location_name: 'Central Library', status: 'online', latitude: 17.4485, longitude: 78.3505, latest_tds: 195, latest_temp: 23.5 },
            { id: '5', name: 'OBH', location_name: 'Boys Hostel', status: 'online', latitude: 17.4420, longitude: 78.3520, latest_tds: 310, latest_temp: 25.8 },
            { id: '6', name: 'NBH', location_name: 'New Hostel', status: 'critical', latitude: 17.4435, longitude: 78.3440, latest_tds: 725, latest_temp: 27.2 },
            { id: '7', name: 'Girls Hostel', location_name: 'GH Building', status: 'online', latitude: 17.4460, longitude: 78.3530, latest_tds: 165, latest_temp: 24.3 },
            { id: '8', name: 'KRB', location_name: 'Research Complex', status: 'online', latitude: 17.4500, longitude: 78.3480, latest_tds: 210, latest_temp: 25.0 },
            { id: '9', name: 'Sports Complex', location_name: 'Athletic Facility', status: 'offline', latitude: 17.4510, longitude: 78.3460 },
        ] as any
        setDevices(mockDevices)

        const mockSensorData: { [key: string]: SensorData[] } = {}
        mockDevices.forEach(d => {
            mockSensorData[d.id] = Array.from({ length: 24 }, (_, i) => ({
                id: i, device_id: d.id,
                tds: Math.floor(Math.random() * (400 - 100) + 100),
                temperature: parseFloat((Math.random() * (30 - 20) + 20).toFixed(1)),
                voltage: 3.3, recorded_at: new Date(Date.now() - (24 - i) * 3600000).toISOString()
            }))
        })
        setSensorData(mockSensorData)
    }, [])

    // Stats calculation
    const stats = useMemo(() => devices.reduce((acc, d) => {
        const s = (d.status || 'offline') as keyof typeof acc
        if (acc[s] !== undefined) acc[s]++
        return acc
    }, { online: 0, warning: 0, critical: 0, offline: 0 }), [devices])

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

    // Refresh handler
    const handleRefresh = useCallback(() => {
        setIsRefreshing(true)
        setTimeout(() => {
            setIsRefreshing(false)
        }, 1000)
    }, [])

    // Map tiles
    const tileUrls = {
        street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }
    const labelTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'

    return (
        <div className="flex h-[calc(100vh-60px)]" style={{ minHeight: '600px', background: THEME.bg.primary }}>

            {/* ========== LEFT PANEL ========== */}
            <div
                className={`flex flex-col transition-all duration-300 ease-out ${panelCollapsed ? 'w-0 overflow-hidden' : 'w-[300px]'}`}
                style={{ background: THEME.bg.secondary, borderRight: `1px solid ${THEME.border.subtle}` }}
            >
                {/* Header */}
                <div className="p-4" style={{ borderBottom: `1px solid ${THEME.border.subtle}` }}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${THEME.status.online.color}, ${THEME.chart.tds.stroke})` }}>
                            <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold" style={{ color: THEME.text.primary }}>Map View</h1>
                            <p className="text-[10px]" style={{ color: THEME.text.muted }}>GIS Infrastructure Monitor</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: THEME.text.muted }} />
                        <input
                            type="text"
                            placeholder="Search devices..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-1"
                            style={{
                                background: THEME.bg.tertiary,
                                border: `1px solid ${THEME.border.light}`,
                                color: THEME.text.primary,
                            }}
                        />
                    </div>
                </div>

                {/* Status Summary */}
                <div className="grid grid-cols-4 gap-2 p-4" style={{ borderBottom: `1px solid ${THEME.border.subtle}` }}>
                    {[
                        { key: 'online', label: 'Online', value: stats.online, ...THEME.status.online },
                        { key: 'warning', label: 'Warning', value: stats.warning, ...THEME.status.warning },
                        { key: 'critical', label: 'Critical', value: stats.critical, ...THEME.status.critical },
                        { key: 'offline', label: 'Offline', value: stats.offline, ...THEME.status.offline },
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
                            <div className="text-base font-bold" style={{ color: THEME.text.primary }}>{s.value}</div>
                            <div className="text-[8px] uppercase" style={{ color: THEME.text.muted }}>{s.label}</div>
                        </button>
                    ))}
                </div>

                {/* Device List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredDevices.map(device => {
                        const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline')
                        const isSelected = selectedDevice?.id === device.id

                        return (
                            <button
                                key={device.id}
                                onClick={() => setSelectedDevice(device)}
                                className="w-full flex items-center justify-between p-4 transition-all duration-200 text-left"
                                style={{
                                    borderBottom: `1px solid ${THEME.border.subtle}`,
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
                                        <div className="text-sm font-medium" style={{ color: THEME.text.primary }}>{device.name}</div>
                                        <div className="text-[10px]" style={{ color: THEME.text.muted }}>{device.location_name}</div>
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
                    style={{ borderTop: `1px solid ${THEME.border.subtle}`, color: THEME.text.muted }}
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
                        style={{ background: THEME.bg.glass, border: `1px solid ${THEME.border.light}` }}
                    >
                        <ChevronRight className="w-5 h-5" style={{ color: THEME.text.primary }} />
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

                    {filteredDevices.map(device => (
                        device.latitude && device.longitude && (
                            <Marker
                                key={device.id}
                                position={[device.latitude, device.longitude]}
                                icon={createNeonMarkerIcon(device)}
                                eventHandlers={{ click: () => setSelectedDevice(device) }}
                            />
                        )
                    ))}
                </MapContainer>

                {/* Top Right Controls */}
                <div className="absolute top-4 right-4 z-[500] flex items-center gap-2">
                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        className={`p-3 rounded-xl backdrop-blur-xl transition-all duration-300 ${isRefreshing ? 'animate-spin' : ''}`}
                        style={{ background: THEME.bg.glass, border: `1px solid ${THEME.border.light}` }}
                    >
                        <RefreshCw className="w-5 h-5" style={{ color: THEME.text.primary }} />
                    </button>

                    {/* Layer Toggle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowLayerMenu(!showLayerMenu)}
                            className="p-3 rounded-xl backdrop-blur-xl transition-all duration-300"
                            style={{ background: THEME.bg.glass, border: `1px solid ${THEME.border.light}` }}
                        >
                            <Layers className="w-5 h-5" style={{ color: THEME.text.primary }} />
                        </button>
                        {showLayerMenu && (
                            <div
                                className="absolute top-full right-0 mt-2 p-2 min-w-[140px] rounded-xl backdrop-blur-xl"
                                style={{ background: THEME.bg.glass, border: `1px solid ${THEME.border.light}` }}
                            >
                                <p className="text-[9px] uppercase px-3 py-1 font-medium" style={{ color: THEME.text.muted }}>Map Style</p>
                                {[{ id: 'street', label: 'Street Map', icon: '🗺️' }, { id: 'satellite', label: 'Satellite', icon: '🛰️' }].map(style => (
                                    <button
                                        key={style.id}
                                        onClick={() => { setMapStyle(style.id as MapStyle); setShowLayerMenu(false) }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
                                        style={{
                                            background: mapStyle === style.id ? THEME.status.online.bg : 'transparent',
                                            color: mapStyle === style.id ? THEME.status.online.color : THEME.text.secondary
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
                        style={{ background: THEME.bg.glass, border: `1px solid ${THEME.border.light}` }}
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" style={{ color: THEME.text.primary }} /> : <Maximize2 className="w-5 h-5" style={{ color: THEME.text.primary }} />}
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
