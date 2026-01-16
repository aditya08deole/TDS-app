import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { supabase } from '../lib/supabase'
import type { Device } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useUI } from '../context/UIContext'
import DevicePanel from '../components/DevicePanel'

// Fix for default marker icon (redundant with custom icons but safer)
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
    const color =
        status === 'online' ? 'bg-emerald-500' :
            status === 'critical' ? 'bg-red-500' :
                status === 'warning' ? 'bg-orange-500' :
                    'bg-slate-500';

    const pulse = status === 'critical' ? 'animate-ping' : status === 'online' ? 'animate-pulse' : '';

    return L.divIcon({
        className: 'custom-marker',
        html: `<div class="relative flex h-6 w-6">
                 <span class="${pulse} absolute inline-flex h-full w-full rounded-full ${color} opacity-75"></span>
                 <span class="relative inline-flex rounded-full h-6 w-6 ${color} border-2 border-white shadow-lg"></span>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    })
}

// Map Controller for programmatically moving view
function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap()
    useEffect(() => {
        if (center) map.flyTo(center, 14)
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
            const { data: devices } = await supabase.from('devices').select('*')
            const { data: heartbeats } = await supabase.from('device_heartbeat').select('device_id, status')

            if (devices) {
                // Merge heartbeat status
                const devicesWithData = await Promise.all(devices.map(async (d) => {
                    const { data: sensor } = await supabase
                        .from('sensor_data')
                        .select('tds')
                        .eq('device_id', d.id)
                        .order('recorded_at', { ascending: false })
                        .limit(1)
                        .single()

                    const hb = heartbeats?.find(h => h.device_id === d.id)
                    // Overwrite status with heartbeat status if present
                    const trueStatus = hb?.status || d.status || 'offline'

                    return { ...d, status: trueStatus.toLowerCase(), latest_tds: sensor?.tds || 0 } as DeviceLocation
                }))
                setDevices(devicesWithData)
            }
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
        <div className={`space-y-6 flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 bg-black p-0' : 'h-[calc(100vh-140px)]'}`}>

            {/* Header Controls (Hidden in Fullscreen if desired, or overlayed) */}
            <div className={`flex justify-between items-center ${isFullscreen ? 'absolute top-4 left-4 z-[1000] w-[calc(100%-32px)]' : ''}`}>
                {!isFullscreen && (
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">GIS Map</h1>
                        <p className="text-slate-400 mt-1 text-sm">Geospatial node distribution.</p>
                    </div>
                )}

                <div className={`flex items-center gap-2 ${isFullscreen ? 'ml-auto bg-slate-900/80 p-2 rounded-xl backdrop-blur-md' : ''}`}>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="bg-slate-800 border-none text-white text-sm rounded-lg focus:ring-1 focus:ring-cyan-500 py-2 pl-3 pr-8"
                    >
                        <option value="all">All Devices</option>
                        <option value="critical">Critical Only</option>
                        <option value="offline">Offline Only</option>
                    </select>

                    <button
                        onClick={toggleFullscreen}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            <div className={`flex-1 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative z-0 ${isFullscreen ? 'rounded-none border-none' : ''}`}>
                <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom={true} className="h-full w-full">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapController center={selectedDevice && selectedDevice.latitude && selectedDevice.longitude ? [selectedDevice.latitude, selectedDevice.longitude] : null} />

                    <MarkerClusterGroup chunkedLoading>
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
