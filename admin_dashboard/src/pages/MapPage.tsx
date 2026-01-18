// MapPage.tsx - Advanced Map with Dual Layers, PPM Markers, Floating Panel
import { useEffect, useState, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { AreaChart, Area, LineChart, Line, ResponsiveContainer } from 'recharts'
import type { Device, SensorData } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Maximize2, Minimize2, Layers, X, Droplets, Thermometer, Clock, MapPin, Wifi, WifiOff, Activity } from 'lucide-react'

// Default icon fix for Leaflet
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] })
L.Marker.prototype.options.icon = DefaultIcon

type DeviceLocation = Device & { latest_tds?: number; latest_temp?: number }
type MapStyle = 'street' | 'satellite'

// PPM-based color logic
const getPpmColor = (ppm: number | undefined, status: string) => {
    if (status === 'offline' || !ppm) return { color: '#8e8e93', bg: 'bg-slate-500', shadow: 'rgba(142,142,147,0.5)', label: 'Offline' }
    if (ppm < 150) return { color: '#30d158', bg: 'bg-green-500', shadow: 'rgba(48,209,88,0.6)', label: 'Good' }
    if (ppm <= 200) return { color: '#ff9f0a', bg: 'bg-orange-500', shadow: 'rgba(255,159,10,0.6)', label: 'Warning' }
    return { color: '#ff453a', bg: 'bg-red-500', shadow: 'rgba(255,69,58,0.6)', label: 'Critical' }
}

// Create custom marker icon based on PPM
const createPpmMarkerIcon = (device: DeviceLocation) => {
    const ppmInfo = getPpmColor(device.latest_tds, device.status || 'offline')
    const isOffline = device.status === 'offline'
    const ppmValue = device.latest_tds || '--'

    return L.divIcon({
        className: 'custom-ppm-marker',
        html: `
            <div class="relative group cursor-pointer" style="transform: translateZ(0);">
                <!-- Pulse ring -->
                <span class="${isOffline ? '' : 'animate-ping'} absolute inline-flex h-10 w-10 rounded-full opacity-40" style="background-color: ${ppmInfo.color}; top: -5px; left: -5px;"></span>
                
                <!-- Main marker body -->
                <div class="relative flex flex-col items-center">
                    <!-- Pin head with PPM value -->
                    <div class="relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-[3px] border-black/80 shadow-2xl transition-all duration-300 group-hover:scale-110" 
                         style="background-color: ${ppmInfo.color}; box-shadow: 0 0 20px ${ppmInfo.shadow}, 0 4px 12px rgba(0,0,0,0.5);">
                        <span class="text-[9px] font-bold text-white drop-shadow-lg">${ppmValue}</span>
                    </div>
                    
                    <!-- Pin point -->
                    <div class="w-0 h-0 -mt-1 relative z-0" style="border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 10px solid ${ppmInfo.color};">
                    </div>
                </div>
                
                <!-- Device name tooltip -->
                <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    <span class="px-2 py-1 bg-black/90 text-white text-[10px] rounded-md font-medium shadow-lg">${device.name}</span>
                </div>
            </div>
        `,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
        popupAnchor: [0, -50]
    })
}

// Map fly controller
function MapController({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
    const map = useMap()
    useEffect(() => {
        if (center) map.flyTo(center, zoom || 17, { duration: 1.5, easeLinearity: 0.25 })
    }, [center, zoom, map])
    return null
}

// Draggable floating panel component
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
    const [position, setPosition] = useState({ x: 20, y: 80 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

    const ppmInfo = getPpmColor(device.latest_tds, device.status || 'offline')

    const chartData = useMemo(() => {
        return sensorData.map(d => ({
            time: new Date(d.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tds: d.tds,
            temp: d.temperature
        }))
    }, [sensorData])

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return
        setIsDragging(true)
        const rect = panelRef.current?.getBoundingClientRect()
        if (rect) {
            setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
        }
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
        }
    }

    const handleMouseUp = () => setIsDragging(false)

    useEffect(() => {
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
            className="fixed z-[1000] w-[320px] bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in select-none"
            style={{ left: position.x, top: position.y, cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10" style={{ backgroundColor: `${ppmInfo.color}15` }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ppmInfo.color}20` }}>
                        {device.status === 'offline' ? <WifiOff className="w-5 h-5" style={{ color: ppmInfo.color }} /> : <Wifi className="w-5 h-5" style={{ color: ppmInfo.color }} />}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">{device.name}</h3>
                        <p className="text-[10px] text-white/50 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {device.location_name}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-white/60" />
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-2 p-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                        <Droplets className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-[10px] text-white/50">TDS Level</span>
                    </div>
                    <div className="text-xl font-bold font-mono" style={{ color: ppmInfo.color }}>{device.latest_tds || '--'} <span className="text-xs text-white/40 font-normal">ppm</span></div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                        <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-[10px] text-white/50">Temperature</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-orange-500">{device.latest_temp || '--'}<span className="text-xs text-white/40 font-normal">°C</span></div>
                </div>
            </div>

            {/* Mini Charts */}
            <div className="px-4 pb-4 space-y-3">
                {/* TDS Chart */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-white/50">TDS History (24h)</span>
                        <Activity className="w-3 h-3 text-green-500" />
                    </div>
                    <div className="h-[60px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="panelTdsGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#30d158" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#30d158" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="tds" stroke="#30d158" strokeWidth={1.5} fill="url(#panelTdsGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Temp Chart */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-white/50">Temp History (24h)</span>
                        <Activity className="w-3 h-3 text-orange-500" />
                    </div>
                    <div className="h-[60px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <Line type="monotone" dataKey="temp" stroke="#ff9f0a" strokeWidth={1.5} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between text-[10px] text-white/40">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Updated: {new Date().toLocaleTimeString()}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: `${ppmInfo.color}20`, color: ppmInfo.color }}>{ppmInfo.label}</span>
            </div>
        </div>
    )
}

export default function MapPage() {
    const [devices, setDevices] = useState<DeviceLocation[]>([])
    const [sensorData, setSensorData] = useState<{ [key: string]: SensorData[] }>({})
    const [isFullscreen, setIsFullscreen] = useState(true) // Default fullscreen
    const [mapStyle, setMapStyle] = useState<MapStyle>('satellite')
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [selectedDevice, setSelectedDevice] = useState<DeviceLocation | null>(null)

    useEffect(() => {
        // Mock devices with varied PPM levels
        const mockDevices: DeviceLocation[] = [
            { id: '1', name: 'Himalaya Mess', location_name: 'Main Dining Hall', status: 'online', latitude: 17.4455, longitude: 78.3489, latest_tds: 186, latest_temp: 25.2 },
            { id: '2', name: 'Vindhya Mess', location_name: 'North Campus', status: 'online', latitude: 17.4470, longitude: 78.3510, latest_tds: 225, latest_temp: 24.8 },
            { id: '3', name: 'Kadamba Canteen', location_name: 'Academic Block', status: 'warning', latitude: 17.4440, longitude: 78.3470, latest_tds: 425, latest_temp: 26.1 },
            { id: '4', name: 'Library', location_name: 'Central Library', status: 'online', latitude: 17.4485, longitude: 78.3505, latest_tds: 195, latest_temp: 23.5 },
            { id: '5', name: 'OBH', location_name: 'Boys Hostel', status: 'online', latitude: 17.4420, longitude: 78.3520, latest_tds: 310, latest_temp: 25.8 },
            { id: '6', name: 'NBH', location_name: 'New Hostel', status: 'critical', latitude: 17.4435, longitude: 78.3440, latest_tds: 725, latest_temp: 27.2 },
            { id: '7', name: 'Girls Hostel', location_name: 'GH Building', status: 'online', latitude: 17.4460, longitude: 78.3530, latest_tds: 165, latest_temp: 24.3 },
            { id: '8', name: 'KRB', location_name: 'Research Complex', status: 'online', latitude: 17.4500, longitude: 78.3480, latest_tds: 210, latest_temp: 25.0 },
            { id: '9', name: 'Sports Complex', location_name: 'Athletic Facility', status: 'offline', latitude: 17.4510, longitude: 78.3460, latest_tds: undefined, latest_temp: undefined },
        ] as any

        setDevices(mockDevices)

        // Mock sensor data for charts
        const mockSensorData: { [key: string]: SensorData[] } = {}
        mockDevices.forEach(d => {
            mockSensorData[d.id] = Array.from({ length: 24 }, (_, i) => ({
                id: i, device_id: d.id,
                tds: Math.floor(Math.random() * (400 - 100) + 100),
                temperature: parseFloat((Math.random() * (30 - 20) + 20).toFixed(1)),
                voltage: 3.3,
                recorded_at: new Date(Date.now() - (24 - i) * 3600000).toISOString()
            }))
        })
        setSensorData(mockSensorData)
    }, [])

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    const handleMarkerClick = (device: DeviceLocation) => {
        setSelectedDevice(device)
    }

    // Map tile URLs
    const tileUrls = {
        street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }

    // Labels overlay for satellite
    const labelTileUrl = 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'

    return (
        <div
            className={`relative transition-all duration-500 ease-out ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
            style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 80px)', minHeight: '500px' }}
        >
            {/* Full Map */}
            <MapContainer
                center={[17.4455, 78.3489]}
                zoom={16}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                {/* Base Tile Layer */}
                <TileLayer
                    attribution='&copy; OpenStreetMap / ESRI'
                    url={tileUrls[mapStyle]}
                    maxZoom={19}
                />

                {/* Labels overlay for satellite */}
                {mapStyle === 'satellite' && (
                    <TileLayer
                        url={labelTileUrl}
                        maxZoom={19}
                        pane="markerPane"
                    />
                )}

                <MapController center={selectedDevice ? [selectedDevice.latitude!, selectedDevice.longitude!] : null} />

                <MarkerClusterGroup
                    chunkedLoading
                    spiderfyOnMaxZoom={true}
                    showCoverageOnHover={false}
                    maxClusterRadius={50}
                    polygonOptions={{ fillColor: '#0a84ff', color: '#0a84ff', weight: 2, opacity: 0.6, fillOpacity: 0.2 }}
                    iconCreateFunction={(cluster: any) => {
                        const count = cluster.getChildCount()
                        return L.divIcon({
                            html: `<div class="flex items-center justify-center w-10 h-10 rounded-full bg-primary/80 backdrop-blur-md border-2 border-white/30 text-white text-sm font-bold shadow-2xl">${count}</div>`,
                            className: 'custom-cluster-icon',
                            iconSize: L.point(40, 40)
                        })
                    }}
                >
                    {devices.map(device => (
                        device.latitude && device.longitude && (
                            <Marker
                                key={device.id}
                                position={[device.latitude, device.longitude]}
                                icon={createPpmMarkerIcon(device)}
                                eventHandlers={{ click: () => handleMarkerClick(device) }}
                            />
                        )
                    ))}
                </MarkerClusterGroup>
            </MapContainer>

            {/* Top Left - Title (only non-fullscreen) */}
            {!isFullscreen && (
                <div className="absolute top-4 left-4 z-[500]">
                    <h1 className="text-xl font-bold text-white drop-shadow-lg">Map View</h1>
                </div>
            )}

            {/* Top Right Controls */}
            <div className="absolute top-4 right-4 z-[500] flex items-center gap-2">
                {/* Layer Toggle */}
                <div className="relative">
                    <button
                        onClick={() => setShowLayerMenu(!showLayerMenu)}
                        className="p-3 bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 text-white hover:bg-black/80 transition-all duration-300 shadow-lg"
                    >
                        <Layers className="w-5 h-5" />
                    </button>
                    {showLayerMenu && (
                        <div className="absolute top-full right-0 mt-2 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 p-2 min-w-[140px] shadow-2xl animate-scale-in">
                            <p className="text-[9px] uppercase text-white/40 px-3 py-1 font-medium">Map Style</p>
                            {[
                                { id: 'street', label: 'Street Map', icon: '🗺️' },
                                { id: 'satellite', label: 'Satellite', icon: '🛰️' }
                            ].map(style => (
                                <button
                                    key={style.id}
                                    onClick={() => { setMapStyle(style.id as MapStyle); setShowLayerMenu(false) }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-300 ${mapStyle === style.id ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10'}`}
                                >
                                    <span>{style.icon}</span>
                                    {style.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Fullscreen Toggle */}
                <button
                    onClick={toggleFullscreen}
                    className="p-3 bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 text-white hover:bg-black/80 transition-all duration-300 shadow-lg"
                >
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
            </div>

            {/* Bottom Left - Legend */}
            <div className="absolute bottom-4 left-4 z-[500] bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-3 shadow-lg">
                <p className="text-[9px] uppercase text-white/40 mb-2 font-medium">PPM Levels</p>
                <div className="space-y-1.5">
                    {[
                        { color: '#30d158', label: '< 150 ppm (Good)' },
                        { color: '#ff9f0a', label: '150-200 ppm (Warning)' },
                        { color: '#ff453a', label: '> 200 ppm (Critical)' },
                        { color: '#8e8e93', label: 'Offline' }
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-[10px] text-white/70">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Floating Device Panel */}
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
