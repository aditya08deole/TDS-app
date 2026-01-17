import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { supabase } from '../lib/supabase'
import type { Device } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Maximize2, Minimize2, Map as MapIcon, Layers } from 'lucide-react'
import { useUI } from '../context/UIContext'
import DevicePanel from '../components/DevicePanel'

// Using DivIcon exclusively, so standard marker fix is less critical but kept for safety
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

type DeviceLocation = Device & { latest_tds?: number }

const createStatusIcon = (status: string) => {
    // Apple-style status colors
    const colorClass =
        status === 'online' ? 'bg-[#30d158]' : // Apple Green
            status === 'critical' ? 'bg-[#ff453a]' : // Apple Red
                status === 'warning' ? 'bg-[#ff9f0a]' : // Apple Orange
                    'bg-[#8e8e93]'; // Apple Gray

    const shadowColor =
        status === 'online' ? 'rgba(48, 209, 88, 0.5)' :
            status === 'critical' ? 'rgba(255, 69, 58, 0.5)' :
                status === 'warning' ? 'rgba(255, 159, 10, 0.5)' :
                    'rgba(142, 142, 147, 0.5)';

    const pulseAnimation = status === 'critical' ? 'animate-ping' : status === 'online' ? 'animate-pulse' : '';

    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div class="relative flex h-6 w-6 group hover:scale-125 transition-transform duration-300">
                <span class="${pulseAnimation} absolute inline-flex h-full w-full rounded-full ${colorClass} opacity-60"></span>
                <span class="relative inline-flex rounded-full h-6 w-6 ${colorClass} border-[3px] border-[#1c1c1e] shadow-lg" style="box-shadow: 0 0 15px ${shadowColor};"></span>
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
    const { isMobile } = useUI()
    const [devices, setDevices] = useState<DeviceLocation[]>([])
    const [selectedDevice, setSelectedDevice] = useState<DeviceLocation | null>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [filter, setFilter] = useState<'all' | 'critical' | 'offline'>('all')

    useEffect(() => {
        const fetchDevices = async () => {
            // Mock Data Injection for Dev if DB is empty or for specific coordinate testing
            // We can mix real DB data with mocks if needed, but here we'll simulate the DB fetch structure
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
                    location: 'Test Location',
                    api_key: 'abc',
                    created_at: new Date().toISOString(),
                    organization_id: 'org1',
                    last_seen: new Date().toISOString()
                })) as any // relaxed type for mock
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

                    <MapController center={selectedDevice && selectedDevice.latitude && selectedDevice.longitude ? [selectedDevice.latitude, selectedDevice.longitude] : null} />

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
                                    icon={createStatusIcon(device.status || 'offline')}
                                    eventHandlers={{
                                        click: () => setSelectedDevice(device)
                                    }}
                                />
                            )
                        ))}
                    </MarkerClusterGroup>
                </MapContainer>

                {/* Floating Overlay Controls (if needed) */}
                <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                    <button className="bg-[#1c1c1e]/90 backdrop-blur-xl p-2 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors shadow-lg">
                        <Layers className="w-5 h-5" />
                    </button>
                </div>

                {/* Device Panel Overlay */}
                <DevicePanel
                    device={selectedDevice}
                    onClose={() => setSelectedDevice(null)}
                    isMobile={isMobile}
                />
            </div>
        </div>
    )
}
