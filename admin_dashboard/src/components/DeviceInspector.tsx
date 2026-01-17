import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
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

interface Device {
    id: string
    device_id?: string
    name: string
    status: string
    location?: string
    location_name?: string
    latitude?: number
    longitude?: number
    battery_level?: number
    signal_strength?: number
    last_seen?: string | null
    last_seen_at?: string | null
    firmware_version?: string
    first_seen_at?: string
    last_reading_at?: string
    metadata?: {
        firmware_version?: string
        last_maintenance?: string
        [key: string]: any
    }
    deployment_date?: string
    created_at?: string
    confidence_score?: number
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
    const [device, setDevice] = useState<Device | null>(null)
    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [sensorHistory, setSensorHistory] = useState<SensorReading[]>([])

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
            const { error } = await supabase.from('devices').update({
                name: editForm.name,
                location_name: editForm.location_name,
                metadata: updatedMetadata
            }).eq('id', device.id)

            if (!error) {
                setDevice(prev => prev ? { ...prev, ...editForm, metadata: updatedMetadata } : null)
                setIsEditing(false)
            }
        } catch (err) {
            console.error('Failed to save config', err)
        }
        setUpdating(false)
    }

    const handleRegenerateQR = async () => {
        if (!device) return
        if (!confirm('Are you sure you want to regenerate the QR code? The old QR code will stop working immediately.')) return

        setUpdating(true)
        try {
            const { error } = await supabase.rpc('rotate_qr_code', { p_device_id: device.id })
            if (error) throw error
            // Optionally refresh device details to get new version if we tracked it in UI
            alert('QR Code rotated successfully.')
        } catch (err) {
            console.error('Failed to rotate QR', err)
            alert('Failed to rotate QR code.')
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
        const { data } = await supabase.from('devices').select('*').eq('id', id).single()
        if (data) setDevice(data)
        setLoading(false)
    }

    const fetchSensorHistory = async () => {
        if (!device) return
        try {
            // Using mock 'sensor_data' if table doesn't exist, falling back to random for demo
            // In a real scenario, this fetches from the actual table
            const { data } = await supabase
                .from('readings') // Assuming a readings table or fallback
                .select('*')
                .eq('device_id', device.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (data && data.length > 0) {
                setSensorHistory([...data].reverse())
            } else {
                // Mock data for demo if no real data
                const mock = Array.from({ length: 20 }).map((_, i) => ({
                    id: i.toString(),
                    tds: 150 + Math.random() * 50,
                    recorded_at: new Date(Date.now() - i * 3600000).toISOString()
                })).reverse()
                setSensorHistory(mock)
            }
        } catch (err) {
            console.error(err)
        }
    }



    const toggleMaintenanceMode = async () => {
        if (!device) return
        setUpdating(true)
        try {
            const newStatus = device.status === 'maintenance' ? 'online' : 'maintenance'
            await supabase.from('devices').update({ status: newStatus }).eq('id', device.id)
            setDevice(prev => prev ? { ...prev, status: newStatus } : null)
        } catch (err) {
            console.error(err)
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
        <div className={`fixed top-0 right-0 h-full bg-[#1c1c1e]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-40 transition-transform duration-300 ease-in-out flex flex-col ${isMobile ? 'w-full' : 'w-[400px]'} ${inspectorDeviceId ? 'translate-x-0' : 'translate-x-full'}`}>

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                    {device && <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)} shadow-[0_0_8px_currentColor]`} />}
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-wide uppercase">{device?.name || 'Loading...'}</h2>
                        <p className="text-[10px] text-slate-400 font-mono">{device?.id?.slice(0, 8)}...</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={closeInspector} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <Minimize2 className="h-4 w-4" />
                    </button>
                    <button onClick={closeInspector} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
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
                    <div className="flex border-b border-white/5">
                        {[
                            { id: 'overview', icon: Activity },
                            { id: 'history', icon: History },
                            { id: 'config', icon: Settings },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex-1 py-3 flex justify-center transition-colors ${activeTab === tab.id ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'}`}
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
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                        <p className="text-xs text-slate-400 mb-1">Confidence</p>
                                        <div className="flex justify-center py-2">
                                            <ConfidenceRing score={device.confidence_score ?? 100} size={60} status={device.status} />
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-400">Last Reading</p>
                                            {device.last_reading_at ? (
                                                <p className={`text-sm font-mono ${new Date(device.last_reading_at).getTime() < Date.now() - 15 * 60 * 1000 ? 'text-orange-400' : 'text-emerald-400'}`}>
                                                    {new Date(device.last_reading_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            ) : (
                                                <p className="text-sm font-mono text-slate-500">No Data</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400">Heatbeat</p>
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
                                            <span className="text-slate-400 text-xs">Location Name</span>
                                            {isEditing ? (
                                                <input
                                                    className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                    value={editForm.location_name}
                                                    onChange={e => setEditForm({ ...editForm, location_name: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-white">{device.location_name || '-'}</div>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-slate-400 text-xs">Firmware Version</span>
                                            {isEditing ? (
                                                <input
                                                    className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                                                    value={editForm.firmware_version}
                                                    onChange={e => setEditForm({ ...editForm, firmware_version: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-white font-mono">{device.metadata?.firmware_version || 'v1.0.0'}</div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <span className="text-slate-400 text-xs block mb-1">Installed</span>
                                                <div className="text-white">{new Date(device.deployment_date || device.created_at || Date.now()).toLocaleDateString()}</div>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 text-xs block mb-1">Last Maintenance</span>
                                                <div className="text-white">{device.metadata?.last_maintenance ? new Date(device.metadata.last_maintenance).toLocaleDateString() : '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isAtLeast('admin') && (
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <h4 className="text-xs font-bold text-red-400 uppercase mb-2">Security Zone</h4>
                                        <button
                                            onClick={handleRegenerateQR}
                                            disabled={updating}
                                            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-medium transition-colors border border-red-500/20"
                                        >
                                            {updating ? 'Rotated...' : 'Regenerate QR Code'}
                                        </button>
                                        <p className="text-[10px] text-slate-500 mt-2 text-center">
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
