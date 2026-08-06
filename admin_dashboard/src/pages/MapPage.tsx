import { useEffect, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
    Wifi, WifiOff, RefreshCw,
    TrendingUp, TrendingDown, AlertCircle
} from 'lucide-react'
import type { ParsedSensorData } from '../lib/thingspeak'
import { type EnrichedDevice, type MapTheme, type MapStyle, type DeviceLocation } from '../types'
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
                            click: () => {
                                console.log('[MAP] Selected device:', device.id)
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

    const ppmStatus = useMemo(() => getPpmStatus(device.latest_tds, device.status || 'offline', theme), [device.latest_tds, device.status, theme])

    return (
        <motion.div
            initial={{ opacity: 0, y: 90, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 90, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="fixed bottom-80 left-2 right-4 md:left-auto md:right-10 md:w-[480px] md:bottom-52 z-[99999] max-w-xl mx-auto rounded-[2.2rem] liquid-glass-stack backdrop-blur-2xl border border-white/40 dark:border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] text-foreground p-5 flex flex-col gap-4 overflow-hidden"
        >
            {/* Specular Top Light Rim Streak */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/70 to-transparent pointer-events-none z-10" />

            {/* Header Row */}
            <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                    <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
                        style={{ background: ppmStatus.bg, border: `1.5px solid ${ppmStatus.color}50` }}>
                        {device.status === 'offline' ? (
                            <WifiOff className="w-5 h-5" style={{ color: ppmStatus.color }} />
                        ) : (
                            <Wifi className="w-5 h-5" style={{ color: ppmStatus.color }} />
                        )}
                        {device.status !== 'offline' && (
                            <div className="absolute inset-0 rounded-2xl animate-ping opacity-25"
                                style={{ background: ppmStatus.color }} />
                        )}
                    </div>

                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-foreground tracking-tight leading-none">{getDeviceDisplayName(device)}</h3>
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-xs"
                                style={{ background: ppmStatus.bg, color: ppmStatus.color, borderColor: `${ppmStatus.color}40` }}>
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ppmStatus.color }} />
                                {ppmStatus.label}
                            </span>
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="w-3.5 h-3.5" style={{ color: ppmStatus.color }} /> {device.location_name || 'Infrastructure Water Plant'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="p-2 rounded-full bg-secondary/80 hover:bg-destructive text-foreground hover:text-destructive-foreground transition-all shadow-md active:scale-90 border border-border/40 shrink-0"
                    aria-label="Close"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Dynamic State Active Tab Selector (Green when Safe, Red when Critical) */}
            <div className="relative z-10 flex p-1.5 gap-1.5 rounded-2xl bg-secondary/60 border border-border/30">
                {['overview', 'history'].map((tab) => {
                    const isActive = activeTab === tab
                    const isSafe = ppmStatus.status === 'online'
                    const isCritical = ppmStatus.status === 'critical'

                    return (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as 'overview' | 'history')}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2",
                                isActive
                                    ? isSafe
                                        ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-[1.02]"
                                        : isCritical
                                            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-[1.02]"
                                            : "bg-slate-500 text-white shadow-lg shadow-slate-500/30 scale-[1.02]"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab}
                        </button>
                    )
                })}
            </div>

            {/* Main Metrics Content */}
            {activeTab === 'overview' && (
                <div className="relative z-10 grid grid-cols-2 gap-3.5 items-stretch">
                    {/* TDS Metric Card */}
                    <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 shadow-sm backdrop-blur-xl flex flex-col justify-between hover:border-cyan-500/40 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30">
                                    <Droplets className="w-4 h-4 text-cyan-500" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">TDS Level</span>
                            </div>
                            {tdsTrend !== 0 && (
                                <div className={cn(
                                    "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black",
                                    tdsTrend > 0 ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"
                                )}>
                                    {tdsTrend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                    {Math.abs(tdsTrend)}
                                </div>
                            )}
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-3xl font-black font-mono tracking-tighter" style={{ color: ppmStatus.color }}>{device.latest_tds || '--'}</span>
                            <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">ppm</span>
                        </div>
                    </div>

                    {/* Temp Metric Card */}
                    <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 shadow-sm backdrop-blur-xl flex flex-col justify-between hover:border-amber-500/40 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30">
                                    <Thermometer className="w-4 h-4 text-amber-500" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Temp</span>
                            </div>
                            {tempTrend !== 0 && (
                                <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/15 text-amber-500">
                                    {tempTrend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                    {Math.abs(tempTrend)}
                                </div>
                            )}
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-3xl font-black font-mono tracking-tighter text-amber-500">{device.latest_temperature || '--'}</span>
                            <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">°C</span>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="relative z-10 space-y-2 max-h-[190px] overflow-y-auto px-1 custom-scrollbar">
                    {chartData.slice().reverse().map((data, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-secondary/40 border border-border/20 hover:border-cyan-500/30 transition-all">
                            <span className="text-[11px] font-black text-muted-foreground uppercase">{data.time}</span>
                            <div className="flex items-center gap-5">
                                <div className="flex items-center gap-1.5">
                                    <Droplets className="w-3.5 h-3.5 text-cyan-500" />
                                    <span className="text-xs font-black font-mono text-cyan-500">{data.tds} ppm</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-xs font-black font-mono text-amber-500">{data.temp} °C</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Liquid Glass Footer */}
            <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-border/30">
                <span className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-pulse shadow-xs" style={{ background: ppmStatus.color }} />
                    Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[9.5px] font-black uppercase tracking-widest border shadow-sm"
                    style={{ background: ppmStatus.bg, color: ppmStatus.color, borderColor: `${ppmStatus.color}40` }}>
                    {ppmStatus.label}
                </div>
            </div>
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

    // Filtered devices
    const filteredDevices = devices

    // Global window handler for marker clicks to guarantee popup opens on mobile & desktop
    useEffect(() => {
        (window as any).__selectMapDevice = (deviceId: string) => {
            const found = devices.find(d => String(d.id) === String(deviceId))
            if (found) {
                console.log('📍 [MAP-MARKER-CLICK] Device selected:', found.name || found.id)
                setSelectedDevice(found)
            }
        }
        return () => {
            delete (window as any).__selectMapDevice
        }
    }, [devices])

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

    // Strictly prevent page scroll on MapPage under any condition
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


            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {selectedDevice && (
                        <DevicePanel
                            key={selectedDevice.id || 'device-panel'}
                            device={selectedDevice}
                            onClose={() => setSelectedDevice(null)}
                        />
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    )
}
