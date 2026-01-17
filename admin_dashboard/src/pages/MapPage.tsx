// MapPage.tsx - Refactored for Phase 6 (Map Layers) & Phase 5 (Global Inspector)
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { supabase } from '../lib/supabase'
import type { Device } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Maximize2, Minimize2, Map as MapIcon, Layers, Activity, Wifi } from 'lucide-react'
import { useUI } from '../context/UIContext'

// Using DivIcon exclusively
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

type DeviceLocation = Device & { latest_tds?: number }

type MapLayer = 'status' | 'confidence'

const createMarkerIcon = (device: DeviceLocation, layer: MapLayer) => {
    let colorClass, shadowColor, pulseAnimation;

    if (layer === 'status') {
        const status = device.status || 'offline';
        if (status === 'online') {
            colorClass = 'bg-[#30d158]'; // Green
            shadowColor = 'rgba(48, 209, 88, 0.5)';
            pulseAnimation = 'animate-pulse';
        } else if (status === 'critical') {
            colorClass = 'bg-[#ff453a]'; // Red
            shadowColor = 'rgba(255, 69, 58, 0.5)';
            pulseAnimation = 'animate-ping';
        } else if (status === 'warning') {
            colorClass = 'bg-[#ff9f0a]'; // Orange
            shadowColor = 'rgba(255, 159, 10, 0.5)';
            pulseAnimation = '';
        } else {
            colorClass = 'bg-[#8e8e93]'; // Gray
            shadowColor = 'rgba(142, 142, 147, 0.5)';
            pulseAnimation = '';
        }
    } else {
        // Confidence Layer
        const score = device.confidence_score ?? 100;
        if (score >= 80) {
            colorClass = 'bg-[#30d158]'; // High Confidence
            shadowColor = 'rgba(48, 209, 88, 0.5)';
        } else if (score >= 50) {
            colorClass = 'bg-[#ff9f0a]'; // Medium
            shadowColor = 'rgba(255, 159, 10, 0.5)';
        } else {
            colorClass = 'bg-[#ff453a]'; // Low
            shadowColor = 'rgba(255, 69, 58, 0.5)';
            pulseAnimation = 'animate-ping';
        }
    }

    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div class="relative flex h-6 w-6 group hover:scale-125 transition-transform duration-300">
                <span class="${pulseAnimation || ''} absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-60"></span>
                <span class="relative inline-flex rounded-full h-6 w-6 ${colorClass} border-[3px] border-[#1c1c1e] shadow-lg" style="box-shadow: 0 0 15px ${shadowColor};"></span>
                ${layer === 'confidence' ? `<span class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-black/50 px-1 rounded">${device.confidence_score ?? 100}%</span>` : ''}
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    })
}

// Map Controller for programmatically moving view
function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap()
    useEffect(() => {
        if (center) map.flyTo(center, 15, {
            duration: 2,
            easeLinearity: 0.25
        })
    }, [center, map])
    return null
}

export default function MapPage() {
    const { openInspector, inspectorDeviceId } = useUI()
    const [devices, setDevices] = useState<DeviceLocation[]>([])
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [filter, setFilter] = useState<'all' | 'critical' | 'offline'>('all')
    const [activeLayer, setActiveLayer] = useState<MapLayer>('status')
    const [showLayerMenu, setShowLayerMenu] = useState(false)

    useEffect(() => {
        const fetchDevices = async () => {
            // Mock Data Injection for Dev if DB is empty or for specific coordinate testing
            const { data: dbDevices } = await supabase.from('devices').select('*')

            // If no DB data (or for styling test), use mocks with distributed coordinates around Hyderabad
            let finalDevices = dbDevices || []

            if (finalDevices.length === 0) {
                const mockCoords = [
                    { lat: 17.4455, lng: 78.3489 }, // IIIT
                    { lat: 17.4470, lng: 78.3500 },
                    { lat: 17.4440, lng: 78.3470 },
                    { lat: 17.4500, lng: 78.3450 },
                    { lat: 17.4420, lng: 78.3520 },
                ]
                finalDevices = mockCoords.map((c, i) => ({
                    id: `mock-${i}`,
                    name: `Device ${i}`,
                    status: i === 0 ? 'online' : i === 1 ? 'critical' : 'online',
                    latitude: c.lat,
                    longitude: c.lng,
                    confidence_score: i === 1 ? 45 : i === 4 ? 70 : 98, // Mock scores
                    location_name: 'Test Location', // Updated field name
                    created_at: new Date().toISOString(),
                    last_seen: new Date().toISOString()
                })) as any
            }

            setDevices(finalDevices as DeviceLocation[])
        }
        fetchDevices()
    }, [])

    const filteredDevices = devices.filter(d => {
        if (filter === 'all') return true
        if (filter === 'critical') return d.status === 'critical'
        if (filter === 'offline') return !d.status || d.status === 'offline'
        return true
    })

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setIsFullscreen(true)
        } else {
            document.exitFullscreen()
            setIsFullscreen(false)
        }
    }

    return (
        <div className={`flex flex-col transition-all duration-500 ease-in-out ${isFullscreen ? 'fixed inset-0 z-50 bg-black p-0' : 'h-[calc(100vh-120px)] space-y-6 pb-6'}`}>

            {/* Header Controls */}
            {!isFullscreen && (
                <div className="flex justify-between items-center animate-fade-in">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            <MapIcon className="w-6 h-6 text-blue-500" />
                            GIS Monitor
                        </h1>
                        <p className="text-[#86868b] mt-1">Geospatial infrastructure visualization</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Filter Pill */}
                        <div className="bg-[#1c1c1e] p-1 rounded-lg border border-white/10 flex items-center">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === 'all' ? 'bg-[#3b3b3d] text-white shadow-sm' : 'text-[#86868b] hover:text-white'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('critical')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === 'critical' ? 'bg-[#ff453a]/20 text-[#ff453a]' : 'text-[#86868b] hover:text-white'}`}
                            >
                                Critical
                            </button>
                        </div>

                        <button
                            onClick={toggleFullscreen}
                            className="p-2.5 bg-[#1c1c1e] text-white rounded-lg hover:bg-[#2c2c2e] transition-colors border border-white/10 shadow-sm"
                            title="Toggle Fullscreen"
                        >
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            )}

            {/* Map Container - Glass effect container */}
            <div className={`flex-1 overflow-hidden relative z-0 shadow-2xl ${isFullscreen ? 'rounded-none' : 'rounded-2xl border border-white/10'}`}>
                <MapContainer center={[17.4455, 78.3489]} zoom={15} scrollWheelZoom={true} className="h-full w-full bg-[#000000]">
                    {/* Dark Mode Tiles */}
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        maxZoom={20}
                    />

                    {/* Find active device coords for flyTo */}
                    <MapController center={inspectorDeviceId ?
                        (devices.find(d => d.id === inspectorDeviceId) ? [devices.find(d => d.id === inspectorDeviceId)!.latitude!, devices.find(d => d.id === inspectorDeviceId)!.longitude!] : null)
                        : null}
                    />

                    <MarkerClusterGroup
                        chunkedLoading
                        polygonOptions={{
                            fillColor: '#0a84ff',
                            color: '#0a84ff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.3
                        }}
                    >
                        {filteredDevices.map(device => (
                            device.latitude && device.longitude && (
                                <Marker
                                    key={device.id}
                                    position={[device.latitude, device.longitude]}
                                    icon={createMarkerIcon(device, activeLayer)}
                                    eventHandlers={{
                                        click: () => openInspector(device.id)
                                    }}
                                />
                            )
                        ))}
                    </MarkerClusterGroup>
                </MapContainer>

                {/* Layer Control - Floating */}
                <div className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-2">
                    <button
                        onClick={() => setShowLayerMenu(!showLayerMenu)}
                        className={`bg-[#1c1c1e]/90 backdrop-blur-xl p-3 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-all shadow-lg ${showLayerMenu ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : ''}`}
                    >
                        <Layers className="w-5 h-5" />
                    </button>

                    {showLayerMenu && (
                        <div className="bg-[#1c1c1e]/95 backdrop-blur-md rounded-xl border border-white/10 p-2 shadow-xl animate-scale-in origin-top-right min-w-[160px]">
                            <p className="text-[10px] uppercase font-bold text-slate-500 px-3 py-2">Map Layers</p>
                            <button
                                onClick={() => { setActiveLayer('status'); setShowLayerMenu(false) }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeLayer === 'status' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300 hover:bg-white/5'}`}
                            >
                                <Wifi className="w-4 h-4" />
                                Connection Status
                            </button>
                            <button
                                onClick={() => { setActiveLayer('confidence'); setShowLayerMenu(false) }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeLayer === 'confidence' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300 hover:bg-white/5'}`}
                            >
                                <Activity className="w-4 h-4" />
                                Health Confidence
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
