import { useState, useEffect } from 'react'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Device } from '../types'
import { getDeviceDisplayName } from '../lib/constants'
import { toast } from 'sonner'
import {
    X,
    MapPin,
    Activity,
    Settings,
    History,
    CheckCircle,
    Wrench,
    RefreshCw,
    Minimize2
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import HealthTimeline from './HealthTimeline'
import ConfidenceRing from './ConfidenceRing'
import { useUI } from '../context/UIContext'

// Extended Device type for Inspector specific needs
type InspectorDevice = Device & {
    device_id?: string
    battery_level?: number
    signal_strength?: number
    last_seen?: string | null
    first_seen_at?: string
    metadata?: {
        firmware_version?: string
        last_maintenance?: string
        [key: string]: any
    }
    // Allow any other props
    [key: string]: any
}

interface SensorReading {
    id: string
    tds: number
    temperature?: number
    recorded_at: string
}



type TabType = 'overview' | 'history' | 'maintenance' | 'config'

import { useRole } from '../context/RoleContext'

export default function DeviceInspector() {
    const { inspectorDeviceId, closeInspector, isMobile } = useUI()
    const { hasPermission, isAtLeast } = useRole()
    const [device, setDevice] = useState<InspectorDevice | null>(null)
    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [sensorHistory, setSensorHistory] = useState<SensorReading[]>([])
    const [renderNow] = useState(() => Date.now())

    const [loading, setLoading] = useState(false)
    const [updating, setUpdating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({ name: '', location_name: '', firmware_version: '' })

    useEffect(() => {
        if (device) {
            setEditForm({
                name: device.name,
                location_name: device.location_name || '',
                firmware_version: device.metadata?.firmware_version || ''
            })
        }
    }, [device])

    const handleSaveConfig = async () => {
        if (!device) return
        setUpdating(true)
        try {
            const updatedMetadata = { ...device.metadata, firmware_version: editForm.firmware_version }
            const docRef = doc(db, 'devices', device.id)
            await updateDoc(docRef, {
                name: editForm.name,
                location_name: editForm.location_name,
                metadata: updatedMetadata
            })

            setDevice(prev => prev ? { ...prev, ...editForm, metadata: updatedMetadata } : null)
            setIsEditing(false)
            toast.success('Configuration saved successfully')
        } catch (err) {
            console.error('Failed to save config', err)
            toast.error('Failed to save configuration')
        }
        setUpdating(false)
    }

    const handleRegenerateQR = async () => {
        if (!device) return

        // Use toast for confirmation
        const confirmed = window.confirm('Are you sure you want to regenerate the QR code? The old QR code will stop working immediately.')
        if (!confirmed) return

        setUpdating(true)
        const toastId = toast.loading('Regenerating QR code...')

        try {
            // Note: rotation logic should be moved to a Cloud Function
            // For now, we update a trigger field in Firestore
            const docRef = doc(db, 'devices', device.id)
            await updateDoc(docRef, {
                qr_rotation_pending: true,
                updated_at: new Date().toISOString()
            })
            
            toast.success('QR Code rotation requested!', { id: toastId })
        } catch (err) {
            console.error('Failed to rotate QR', err)
            toast.error('Failed to rotate QR code', {
                id: toastId,
                description: err instanceof Error ? err.message : 'Unknown error'
            })
        }
        setUpdating(false)
    }

    useEffect(() => {
        if (inspectorDeviceId) {
            fetchDeviceDetails(inspectorDeviceId)
        } else {
            setDevice(null)
        }
    }, [inspectorDeviceId])

    useEffect(() => {
        if (device) {
            fetchSensorHistory()
        }
    }, [device])

    const fetchDeviceDetails = async (id: string) => {
        setLoading(true)
        try {
            const docRef = doc(db, 'devices', id)
            const docSnap = await getDoc(docRef)
            if (docSnap.exists()) {
                setDevice({ id: docSnap.id, ...docSnap.data() } as InspectorDevice)
            }
        } catch (err) {
            console.error('Failed to fetch device details', err)
        }
        setLoading(false)
    }

    const fetchSensorHistory = async () => {
        if (!device) return
        try {
            // Try to fetch real ThingSpeak data via the device's channel_id and read key
            const channelId = (device as any).thingspeak_channel_id
            const readKey = (device as any).thingspeak_read_key
            const tdsField = (device as any).tds_field_number || 1
            const tempField = (device as any).temperature_field_number || 2

            if (channelId && readKey) {
                // Correct URL: /channels/{CHANNEL_ID}/feeds.json?api_key={READ_KEY}
                const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=100`
                console.log('DeviceInspector fetching:', url)

                const response = await fetch(url)
                const json = await response.json()

                if (json.feeds && json.feeds.length > 0) {
                    const readings = json.feeds.map((entry: any, i: number) => ({
                        id: i.toString(),
                        tds: parseFloat(entry[`field${tdsField}`]) || 0,
                        temperature: parseFloat(entry[`field${tempField}`]) || 0,
                        recorded_at: entry.created_at
                    })).filter((r: any) => r.tds > 20) // Remove TDS <= 20 (invalid/noise)

                    console.log(`DeviceInspector: Got ${readings.length} readings`)
                    setSensorHistory(readings)
                    return
                }
            }

            // Fallback: No longer using legacy readings table
            setSensorHistory([])
        } catch (err) {
            console.error(err)
            setSensorHistory([])
        }
    }



    const toggleMaintenanceMode = async () => {
        if (!device) return
        setUpdating(true)
        try {
            const newStatus = device.status === 'maintenance' ? 'online' : 'maintenance'
            const docRef = doc(db, 'devices', device.id)
            await updateDoc(docRef, { status: newStatus })
            setDevice(prev => prev ? { ...prev, status: newStatus } : null)
            toast.success(`Device ${newStatus === 'maintenance' ? 'entered maintenance mode' : 'is now online'}`)
        } catch (err) {
            console.error(err)
            toast.error('Failed to update maintenance mode')
        }
        setUpdating(false)
    }

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'online': return 'bg-emerald-500'
            case 'offline': return 'bg-red-500'
            case 'degraded': return 'bg-orange-500'
            case 'maintenance': return 'bg-blue-500'
            default: return 'bg-slate-500'
        }
    }

    if (!inspectorDeviceId) return null

    return (
        <div className={`fixed top-0 right-0 h-full bg-background/95 backdrop-blur-2xl border-l border-border shadow-2xl z-40 transition-transform duration-300 ease-in-out flex flex-col ${isMobile ? 'w-full' : 'w-[400px]'} ${inspectorDeviceId ? 'translate-x-0' : 'translate-x-full'}`}>

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-accent/5">
                <div className="flex items-center gap-3">
                    {device && <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)} shadow-[0_0_8px_currentColor]`} />}
                    <div>
                        <h2 className="text-sm font-black text-foreground tracking-wide uppercase">{device ? getDeviceDisplayName(device) : 'Loading...'}</h2>
                        <p className="text-[10px] text-muted-foreground font-mono">{device?.id?.slice(0, 8)}...</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={closeInspector} className="p-2 hover:bg-accent/10 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        <Minimize2 className="h-4 w-4" />
                    </button>
                    <button onClick={closeInspector} className="p-2 hover:bg-red-500/20 rounded-lg text-muted-foreground hover:text-red-400 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {loading && !device ? (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
            ) : device ? (
                <>
                    {/* Tabs */}
                    <div className="flex border-b border-border">
                        {[
                            { id: 'overview', icon: Activity },
                            { id: 'history', icon: History },
                            { id: 'config', icon: Settings },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex-1 py-3 flex justify-center transition-colors ${activeTab === tab.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                <tab.icon className="h-4 w-4" />
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
                        {/* Overview */}
                        {activeTab === 'overview' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-accent/5 rounded-xl p-3 border border-border">
                                        <p className="text-xs text-muted-foreground mb-1 font-bold">Confidence</p>
                                        <div className="flex justify-center py-2">
                                            <ConfidenceRing score={device.confidence_score ?? 100} size={60} status={device.status} />
                                        </div>
                                    </div>
                                    <div className="bg-accent/5 rounded-xl p-3 border border-border space-y-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-bold">Last Reading</p>
                                            {device.last_reading_at ? (
                                                <p className={`text-sm font-mono ${new Date(device.last_reading_at).getTime() < renderNow - 15 * 60 * 1000 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                    {new Date(device.last_reading_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            ) : (
                                                <p className="text-sm font-mono text-muted-foreground">No Data</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground font-bold">Heatbeat</p>
                                            <p className="text-sm font-mono text-emerald-400">
                                                {device.last_seen_at ? new Date(device.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <HealthTimeline deviceId={device.id} />

                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <MapPin className="h-4 w-4 text-blue-400" />
                                        <span className="text-sm font-medium text-white">Location</span>
                                    </div>
                                    <p className="text-sm text-slate-300">{device.location_name || 'Unknown Location'}</p>
                                    <p className="text-xs text-slate-500 mt-1 font-mono">{device.latitude?.toFixed(4)}, {device.longitude?.toFixed(4)}</p>
                                </div>

                                {hasPermission('maintenance_mode') && (
                                    <button
                                        onClick={toggleMaintenanceMode}
                                        disabled={updating}
                                        className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${device.status === 'maintenance'
                                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                            : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'}`}
                                    >
                                        <Wrench className="h-4 w-4" />
                                        {device.status === 'maintenance' ? 'Exit Maintenance' : 'Enter Maintenance Mode'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* History */}
                        {activeTab === 'history' && (
                            <div className="space-y-4">
                                <div className="h-64 w-full bg-white/5 rounded-xl p-2 border border-white/5">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={sensorHistory}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                            <XAxis dataKey="recorded_at" hide />
                                            <YAxis stroke="#666" fontSize={10} />
                                            <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                                            <Line type="monotone" dataKey="tds" stroke="#3b82f6" dot={false} strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="space-y-2">
                                    {sensorHistory.map((reading, i) => (
                                        <div key={i} className="flex justify-between text-xs py-2 border-b border-white/5">
                                            <span className="text-slate-400">{new Date(reading.recorded_at).toLocaleTimeString()}</span>
                                            <span className="text-white font-mono">{reading.tds.toFixed(1)} PPM</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Config */}
                        {activeTab === 'config' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-white/5 rounded-xl border border-white/5 relative">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase">Device Metadata</h3>
                                        {isAtLeast('admin') && (
                                            <button
                                                onClick={() => {
                                                    if (isEditing) handleSaveConfig()
                                                    else setIsEditing(true)
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                                            >
                                                {isEditing ? <CheckCircle className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-4 text-sm">
                                        <div className="space-y-1">
                                            <span className="text-slate-400 text-xs">Device Name</span>
                                            {isEditing ? (
                                                <input
                                                    className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                    value={editForm.name}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-white font-medium">{device.name}</div>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Location Name</span>
                                            {isEditing ? (
                                                <input
                                                    className="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary"
                                                    value={editForm.location_name}
                                                    onChange={e => setEditForm({ ...editForm, location_name: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-foreground font-medium">{device.location_name || '-'}</div>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Firmware Version</span>
                                            {isEditing ? (
                                                <input
                                                    className="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary"
                                                    value={editForm.firmware_version}
                                                    onChange={e => setEditForm({ ...editForm, firmware_version: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-foreground font-mono">{device.metadata?.firmware_version || 'v1.0.0'}</div>
                                            )}
                                        </div>

                                        <div className="bg-accent/5 rounded-xl p-4 border border-border">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Live Metrics</h3>
                                                <div className="animate-pulse flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                                                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                                    Live
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Current TDS</span>
                                                    <div className="text-2xl font-black font-mono text-foreground">{device.latest_tds || '--'}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Water Temp</span>
                                                    <div className="text-2xl font-black font-mono text-foreground">{device.latest_temperature ? `${device.latest_temperature.toFixed(1)}°` : '--'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <span className="text-muted-foreground text-xs block mb-1 font-bold uppercase">Installed</span>
                                                <div className="text-foreground font-medium">{new Date(device.deployment_date || device.created_at || renderNow).toLocaleDateString()}</div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-xs block mb-1 font-bold uppercase">Maintenance</span>
                                                <div className="text-foreground font-medium">{device.metadata?.last_maintenance ? new Date(device.metadata.last_maintenance).toLocaleDateString() : '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isAtLeast('admin') && (
                                    <div className="mt-4 pt-4 border-t border-border">
                                        <h4 className="text-xs font-bold text-red-500 uppercase mb-2">Security Zone</h4>
                                        <button
                                            onClick={handleRegenerateQR}
                                            disabled={updating}
                                            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition-colors border border-red-500/20 shadow-sm"
                                        >
                                            {updating ? 'Rotating...' : 'Regenerate QR Code'}
                                        </button>
                                        <p className="text-[10px] text-muted-foreground mt-2 text-center font-medium">
                                            Warning: This will immediately invalidate the physical QR code.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    )
}
