import { useEffect, useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { useTheme } from '../context/ThemeContext'
import { useDevices, useDeviceSubscription } from '../hooks/useDeviceQueries'
import { useAllDevicesThingSpeakData, useDeviceThingSpeakChartData } from '../hooks/useThingSpeakQueries'
import { getTDSStatus, getDeviceDisplayName, getConnectivityStatus } from '../lib/constants'
import { getPpmStatus, createWhiteTransparentMarker } from '../components/MapMarkers'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import {
    Maximize2, Minimize2, Layers, X, Droplets, Thermometer, MapPin,
    WifiOff, RefreshCw, TrendingUp, TrendingDown, AlertCircle
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import type { ParsedSensorData } from '../lib/thingspeak'
import { type EnrichedDevice, type MapTheme, type MapStyle, type DeviceLocation } from '../types'

// Ensure default icons work properly
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});

if (typeof L !== 'undefined' && L.Marker && L.Marker.prototype) {
    L.Marker.prototype.options.icon = DefaultIcon;
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

/**
 * Liquid Glass Floating Device Telemetry Inspector Window
 */
function DeviceTelemetryWindow({
    device,
    theme,
    onClose
}: {
    device: EnrichedDevice;
    theme: MapTheme;
    onClose: () => void;
}) {
    const { data: sensorData = [], isLoading } = useDeviceThingSpeakChartData(device, 30)
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')

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

    const customMin = device.safe_tds_min != null ? Number(device.safe_tds_min) : undefined
    const customMax = device.safe_tds_max != null ? Number(device.safe_tds_max) : undefined
    const ppmStatus = useMemo(() => getPpmStatus(device.latest_tds, device.status || 'offline', theme, customMin, customMax), [device.latest_tds, device.status, theme, customMin, customMax])

    const isSafe = ppmStatus.status === 'online'
    const isCritical = ppmStatus.status === 'critical'
    const statusColor = isSafe ? '#00df81' : isCritical ? '#ff0055' : '#818cf8'
    const statusBg = isSafe ? 'rgba(0, 223, 129, 0.12)' : isCritical ? 'rgba(255, 0, 85, 0.12)' : 'rgba(129, 140, 248, 0.12)'

    return (
        <div className="relative w-full rounded-[2.2rem] liquid-glass-stack backdrop-blur-3xl bg-slate-950/95 dark:bg-[#070b14]/98 border border-white/25 dark:border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_30px_rgba(6,182,212,0.2)] text-foreground p-5 flex flex-col gap-4 select-none animate-in fade-in slide-in-from-bottom-8 duration-300">
            {/* Top Specular Light Rim Streak */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent pointer-events-none z-10" />

            {/* Header Section */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                    <div
                        className="relative w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                        style={{ background: statusBg, border: `1.5px solid ${statusColor}50` }}
                    >
                        {device.status === 'offline' ? (
                            <WifiOff className="w-5 h-5" style={{ color: statusColor }} />
                        ) : (
                            <Droplets className="w-5 h-5" style={{ color: statusColor }} />
                        )}
                        {device.status !== 'offline' && (
                            <div className="absolute inset-0 rounded-2xl animate-ping opacity-25" style={{ background: statusColor }} />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="text-base font-black text-foreground tracking-tight leading-tight truncate">
                            {getDeviceDisplayName(device)}
                        </h3>
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate">{device.location_name || 'Location not specified'}</span>
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-white/10 hover:bg-rose-500 text-muted-foreground hover:text-white transition-all shadow-sm active:scale-90 border border-white/10 shrink-0"
                    title="Close details"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Tab Selector */}
            <div className="flex p-1 gap-1.5 rounded-xl bg-white/5 border border-white/10">
                {(['overview', 'history'] as const).map((tab) => {
                    const isActive = activeTab === tab
                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "flex-1 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5",
                                isActive
                                    ? isSafe
                                        ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 font-black"
                                        : isCritical
                                            ? "bg-rose-500 text-white shadow-md shadow-rose-500/25 font-black"
                                            : "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-black"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab === 'overview' ? 'Historic Trend' : 'History'}
                        </button>
                    )
                })}
            </div>

            {activeTab === 'overview' ? (
                <div className="space-y-3.5">
                    {/* Primary KPI Grid (TDS & Temperature) */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* TDS Metric Card */}
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 shadow-sm flex flex-col justify-between hover:border-cyan-500/30 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className="p-1 rounded-md bg-cyan-500/15 text-cyan-400">
                                        <Droplets className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[10.5px] font-black uppercase tracking-wider text-muted-foreground">TDS Level</span>
                                </div>
                                {tdsTrend !== 0 && (
                                    <div className={cn(
                                        "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black",
                                        tdsTrend > 0 ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
                                    )}>
                                        {tdsTrend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                        {Math.abs(tdsTrend)}
                                    </div>
                                )}
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-3xl font-black font-mono tracking-tighter" style={{ color: statusColor }}>
                                    {device.latest_tds != null ? Math.round(Number(device.latest_tds)) : '--'}
                                </span>
                                <span className="text-xs font-black text-muted-foreground uppercase">ppm</span>
                            </div>
                        </div>

                        {/* Temperature Metric Card */}
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 shadow-sm flex flex-col justify-between hover:border-amber-500/30 transition-all">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className="p-1 rounded-md bg-amber-500/15 text-amber-400">
                                        <Thermometer className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[10.5px] font-black uppercase tracking-wider text-muted-foreground">Temperature</span>
                                </div>
                                {tempTrend !== 0 && (
                                    <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/15 text-amber-400">
                                        {tempTrend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                        {Math.abs(tempTrend)}°
                                    </div>
                                )}
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-3xl font-black font-mono tracking-tighter text-amber-400">
                                    {device.latest_temperature != null ? Number(device.latest_temperature).toFixed(1) : '--'}
                                </span>
                                <span className="text-xs font-black text-muted-foreground uppercase">°C</span>
                            </div>
                        </div>
                    </div>

                    {/* Historic Trend Graph */}
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                        <div className="h-[95px] w-full">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id={`windowFill-${device.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={statusColor} stopOpacity={0.45} />
                                                <stop offset="95%" stopColor={statusColor} stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload
                                                    return (
                                                        <div className="p-2 rounded-xl bg-slate-900/95 border border-white/20 shadow-xl text-xs font-mono">
                                                            <div className="text-muted-foreground text-[9.5px]">{data.time}</div>
                                                            <div className="font-bold text-cyan-400">{data.tds} ppm</div>
                                                            <div className="font-bold text-amber-400">{data.temp} °C</div>
                                                        </div>
                                                    )
                                                }
                                                return null
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="tds"
                                            stroke={statusColor}
                                            strokeWidth={2.5}
                                            fill={`url(#windowFill-${device.id})`}
                                            isAnimationActive={false}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                                    {isLoading ? 'Fetching telemetry stream...' : 'No historical data available'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* History Logs Tab */
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {chartData.length > 0 ? (
                        chartData.slice().reverse().map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs hover:border-cyan-500/30 transition-all">
                                <span className="font-mono text-muted-foreground text-[11px]">{d.time}</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        <Droplets className="w-3 h-3 text-cyan-400" />
                                        <span className="font-mono font-bold" style={{ color: statusColor }}>{d.tds} ppm</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Thermometer className="w-3 h-3 text-amber-400" />
                                        <span className="font-mono text-amber-400 font-bold">{d.temp}°C</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-xs text-muted-foreground">No recent telemetry logs</div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-[10px]">
                <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Sync: {device.last_reading_at ? new Date(device.last_reading_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live Connected'}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                    EvaraTDS Node
                </span>
            </div>
        </div>
    )
}

/**
 * Markers layer that attaches click handlers to each device node on the map
 */
const DeviceMarkers = ({
    devices,
    theme,
    setSelectedDevice
}: {
    devices: DeviceLocation[];
    theme: MapTheme;
    setSelectedDevice: (d: DeviceLocation) => void;
}) => {
    const map = useMap()
    const [zoom, setZoom] = useState(map.getZoom())

    useEffect(() => {
        const handleZoom = () => setZoom(map.getZoom())
        map.on('zoomend', handleZoom)
        return () => { map.off('zoomend', handleZoom) }
    }, [map])

    // Global listener for HTML onclick events inside custom divIcon markers
    useEffect(() => {
        (window as any).__selectMapDevice = (deviceId: string) => {
            const found = devices.find(d => String(d.id) === String(deviceId))
            if (found) {
                setSelectedDevice(found)
            }
        }
        return () => {
            delete (window as any).__selectMapDevice
        }
    }, [devices, setSelectedDevice])

    return (
        <>
            {devices.map(device => {
                const lat = Number(device.latitude)
                const lng = Number(device.longitude)
                if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null
                return (
                    <Marker
                        key={device.id}
                        position={[lat, lng]}
                        icon={createWhiteTransparentMarker(device, theme, zoom)}
                        bubblingMouseEvents={true}
                        eventHandlers={{
                            click: () => {
                                setSelectedDevice(device)
                            }
                        }}
                    />
                )
            })}
        </>
    )
}

function MapController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
    const map = useMap()

    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
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

export default function MapPage() {
    const [mapError, setMapError] = useState<string | null>(null)

    // Fetch devices using React Query (with caching)
    const { data: devicesList = [], refetch: refetchDevices } = useDevices()

    // Subscribe to real-time device changes
    useDeviceSubscription()

    // Fetch ThingSpeak data for all devices (ENRICHED with latest only)
    const { devices: devicesWithData } = useAllDevicesThingSpeakData(devicesList)

    const { resolvedTheme } = useTheme()
    const theme = useMemo(() => getMapTheme(resolvedTheme === 'dark'), [resolvedTheme])

    const [isFullscreen, setIsFullscreen] = useState(false)
    const [mapStyle, setMapStyle] = useState<MapStyle>('street')
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [selectedDevice, setSelectedDevice] = useState<DeviceLocation | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // Enrich devices with status based on TDS and offline detection
    const devices: DeviceLocation[] = useMemo(() => {
        return devicesWithData.map(device => {
            const customMin = device.safe_tds_min != null ? Number(device.safe_tds_min) : undefined
            const customMax = device.safe_tds_max != null ? Number(device.safe_tds_max) : undefined

            const connectivity = getConnectivityStatus(device.last_reading_at || device.last_seen_at)
            let status: 'online' | 'critical' | 'offline' = connectivity

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

    // Refresh handler
    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true)
        try {
            await refetchDevices()
        } catch {
            setMapError('Refresh failed. Check your connection.')
        } finally {
            setTimeout(() => setIsRefreshing(false), 600)
        }
    }, [refetchDevices])

    // Map tiles
    const tileUrls = {
        street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }
    const labelTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'

    // Prevent background page scrolling on MapPage
    useEffect(() => {
        const prevBodyOverflow = document.body.style.overflow
        const prevHtmlOverflow = document.documentElement.style.overflow
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prevBodyOverflow
            document.documentElement.style.overflow = prevHtmlOverflow
        }
    }, [])

    return (
        <div className="fixed inset-0 h-screen w-screen overflow-hidden flex flex-col touch-none select-none" style={{ background: 'transparent' }} data-testid="map-container">
            {/* Map Status Indicator */}
            {(mapError || import.meta.env.DEV) && (
                <div className="absolute top-2 left-2 z-[10] text-xs font-mono opacity-60 pointer-events-none">
                    {mapError ? (
                        <div className="flex items-center gap-1 text-red-400">
                            <AlertCircle className="w-3 h-3 text-red-500" />
                            Error: {mapError}
                        </div>
                    ) : import.meta.env.DEV ? (
                        <div className="flex items-center gap-1 text-emerald-400">
                            ✓ Map initialized | Devices: {devices.length}
                        </div>
                    ) : null}
                </div>
            )}

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
                        devices={devices}
                        theme={theme}
                        setSelectedDevice={setSelectedDevice}
                    />
                </MapContainer>

                {/* Top Right Controls */}
                <div className="absolute top-4 right-4 md:top-28 md:right-8 z-[500] flex items-center gap-2">
                    {/* Device Quick Selector Dropdown */}
                    {devices.length > 0 && (
                        <div className="relative">
                            <select
                                value={selectedDevice?.id || ''}
                                onChange={(e) => {
                                    const d = devices.find(dev => String(dev.id) === String(e.target.value))
                                    if (d) setSelectedDevice(d)
                                }}
                                className="bg-card/90 backdrop-blur-xl border border-white/20 text-foreground text-xs font-semibold rounded-xl px-3 py-2.5 outline-none shadow-xl cursor-pointer max-w-[180px] sm:max-w-[240px] truncate"
                            >
                                <option value="">📍 Select Device ({devices.length})</option>
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {getDeviceDisplayName(d)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        className="p-3 rounded-xl glass-system-micro border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300 active:scale-90"
                    >
                        <RefreshCw
                            className={`w-5 h-5 transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`}
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

                    {/* Fullscreen Toggle */}
                    <button
                        onClick={async () => {
                            try {
                                if (!document.fullscreenElement) {
                                    await document.documentElement.requestFullscreen()
                                    setIsFullscreen(true)
                                } else {
                                    await document.exitFullscreen()
                                    setIsFullscreen(false)
                                }
                            } catch {
                                // Fullscreen not supported or denied
                            }
                        }}
                        className="p-3 rounded-xl backdrop-blur-xl transition-all duration-300 liquid-ios-glass"
                        style={{ border: '1px solid var(--specular-highlight)' }}
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" style={{ color: theme.text.primary }} /> : <Maximize2 className="w-5 h-5" style={{ color: theme.text.primary }} />}
                    </button>
                </div>

                {/* Dedicated Floating Device Telemetry Inspector Window */}
                {selectedDevice && (
                    <div className="fixed bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[420px] md:w-[460px] z-[9999] max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <DeviceTelemetryWindow
                            device={selectedDevice}
                            theme={theme}
                            onClose={() => setSelectedDevice(null)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
