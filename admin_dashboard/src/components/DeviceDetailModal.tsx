import { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { type Device } from '../types'
import { getDeviceDisplayName } from '../lib/constants'
import {
    X,
    Battery,
    Wifi,
    MapPin,
    Clock,
    Activity,
    Settings,
    History,
    AlertTriangle,
    CheckCircle,
    Wrench,
    ChevronRight,
    RefreshCw
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import HealthTimeline from './HealthTimeline'
import ConfidenceRing from './ConfidenceRing'

// Extend Device to include optional runtime properties or mapped fields
type ModalDevice = Device & {
    device_id?: string
    battery_level?: number
    signal_strength?: number
    firmware_version?: string
    installed_at?: string
    [key: string]: any
}

interface SensorReading {
    id: string
    tds: number
    temperature?: number
    recorded_at: string
}

interface MaintenanceLog {
    id: string
    action: string
    performed_by: string
    performed_at: string
    notes?: string
}

interface DeviceDetailModalProps {
    device: ModalDevice | null
    isOpen: boolean
    onClose: () => void
    onRefresh?: () => void
}

type TabType = 'overview' | 'history' | 'maintenance' | 'config'

export default function DeviceDetailModal({ device, isOpen, onClose, onRefresh }: DeviceDetailModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [sensorHistory, setSensorHistory] = useState<SensorReading[]>([])
    const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([])
    const [loading, setLoading] = useState(false)
    const [updating, setUpdating] = useState(false)
    const [editTdsMin, setEditTdsMin] = useState<number>(device?.safe_tds_min ?? 35)
    const [editTdsMax, setEditTdsMax] = useState<number>(device?.safe_tds_max ?? 175)
    const [isEditingTds, setIsEditingTds] = useState(false)

    useEffect(() => {
        if (device && isOpen) {
            fetchSensorHistory()
            fetchMaintenanceLogs()
        }
    }, [device, isOpen])

    const fetchSensorHistory = async () => {
        if (!device) return
        setLoading(true)
        try {
            const q = query(
                collection(db, 'sensor_data'),
                where('device_id', '==', device.id),
                orderBy('recorded_at', 'desc'),
                limit(50)
            )
            const querySnapshot = await getDocs(q)
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SensorReading[]
            setSensorHistory([...data].reverse())
        } catch (err) {
            console.error('Error fetching sensor history:', err)
        }
        setLoading(false)
    }

    const fetchMaintenanceLogs = async () => {
        if (!device) return
        try {
            const q = query(
                collection(db, 'maintenance_logs'),
                where('device_id', '==', device.id),
                orderBy('performed_at', 'desc'),
                limit(20)
            )
            const querySnapshot = await getDocs(q)
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MaintenanceLog[]
            setMaintenanceLogs(data)
        } catch (err) {
            console.error('Error fetching maintenance logs:', err)
        }
    }

    const toggleMaintenanceMode = async () => {
        if (!device) return
        setUpdating(true)
        try {
            const newStatus = device.status === 'maintenance' ? 'online' : 'maintenance'
            const deviceRef = doc(db, 'devices', device.id)
            await updateDoc(deviceRef, { status: newStatus })

            // Log the action
            await addDoc(collection(db, 'maintenance_logs'), {
                device_id: device.id,
                action: newStatus === 'maintenance' ? 'Entered Maintenance Mode' : 'Exited Maintenance Mode',
                performed_by: 'Admin',
                performed_at: serverTimestamp(),
                notes: 'Status changed via dashboard'
            })

            onRefresh?.()
        } catch (err) {
            console.error('Error updating device:', err)
        }
        setUpdating(false)
    }

    const handleSaveTdsLimits = async () => {
        if (!device) return

        // Validation
        if (editTdsMin < 0 || editTdsMax < editTdsMin || editTdsMax > 10000) {
            alert('Invalid TDS range. Min must be >= 0 and Max must be >= Min and <= 10000')
            return
        }

        setUpdating(true)
        try {
            const deviceRef = doc(db, 'devices', device.id)
            await updateDoc(deviceRef, {
                safe_tds_min: editTdsMin,
                safe_tds_max: editTdsMax,
                updated_at: serverTimestamp()
            })

            setIsEditingTds(false)
            onRefresh?.()
        } catch (err) {
            console.error('Error updating TDS thresholds:', err)
            alert('Failed to update thresholds: ' + err.message)
        } finally {
            setUpdating(false)
        }
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

    const getStatusIcon = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'online': return <CheckCircle className="h-4 w-4" />
            case 'offline': return <AlertTriangle className="h-4 w-4" />
            case 'degraded': return <AlertTriangle className="h-4 w-4" />
            case 'maintenance': return <Wrench className="h-4 w-4" />
            default: return <Activity className="h-4 w-4" />
        }
    }

    if (!isOpen || !device) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full sm:max-w-2xl max-h-[90vh] bg-background rounded-t-2xl sm:rounded-2xl border border-border overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`} />
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">{getDeviceDisplayName(device)}</h2>
                            <p className="text-xs text-muted-foreground">{device.device_id}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border overflow-x-auto">
                    {[
                        { id: 'overview', label: 'Overview', icon: Activity },
                        { id: 'history', label: 'History', icon: History },
                        { id: 'maintenance', label: 'Logs', icon: Wrench },
                        { id: 'config', label: 'Config', icon: Settings },
                    ].map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex-1 min-w-[80px] flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            {/* Status Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-accent/10 rounded-xl p-3 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                        <Battery className="h-3 w-3" />
                                        Battery
                                    </div>
                                    <p className="text-xl font-bold text-foreground">{device.battery_level ?? '--'}%</p>
                                </div>
                                <div className="bg-accent/10 rounded-xl p-3 border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                        <Wifi className="h-3 w-3" />
                                        Signal
                                    </div>
                                    <p className="text-xl font-bold text-foreground">{device.signal_strength ?? '--'} dBm</p>
                                </div>
                                <div className="bg-accent/10 rounded-xl p-3 flex flex-col items-center justify-center border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2 w-full">
                                        <Activity className="h-3 w-3" />
                                        Trust Score
                                    </div>
                                    <ConfidenceRing score={device.confidence_score ?? 100} size={50} status={device.status} />
                                </div>
                                <div className="bg-accent/10 rounded-xl p-3 flex flex-col justify-center border border-border">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                        <Activity className="h-3 w-3" />
                                        Health
                                    </div>
                                    <p className="text-sm text-foreground">
                                        {(device.confidence_score ?? 100) > 80 ? 'Excellent' : (device.confidence_score ?? 100) > 50 ? 'Fair' : 'Poor'}
                                    </p>
                                </div>
                            </div>

                            {/* Health Timeline */}
                            <HealthTimeline deviceId={device.id} />

                            {/* Location */}
                            <div className="bg-accent/10 rounded-xl p-3 border border-border">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                    <MapPin className="h-3 w-3" />
                                    Location
                                </div>
                                <p className="text-sm text-foreground">{device.location_name || 'Not set'}</p>
                                {device.latitude && device.longitude && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                                    </p>
                                )}
                            </div>

                            {/* Status & Actions */}
                            <div className="bg-accent/10 rounded-xl p-3 border border-border">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                                            <Clock className="h-3 w-3" />
                                            Status
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(device.status)} text-white`}>
                                                {getStatusIcon(device.status)}
                                                {device.status?.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleMaintenanceMode}
                                        disabled={updating}
                                        className="px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-sm rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Wrench className="h-4 w-4" />
                                        {device.status === 'maintenance' ? 'Exit' : 'Enter'} Maintenance
                                    </button>
                                </div>
                            </div>

                            {/* Last Seen */}
                            {(device.last_seen_at || device.last_seen) && (
                                <div className="text-center text-xs text-muted-foreground">
                                    Last seen: {new Date(device.last_seen_at || device.last_seen!).toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-slate-300">TDS Readings (Last 50)</h3>
                                <button
                                    onClick={fetchSensorHistory}
                                    className="p-2 text-slate-400 hover:text-white rounded-lg"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            {sensorHistory.length > 0 ? (
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={sensorHistory}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis
                                                dataKey="recorded_at"
                                                tick={{ fill: '#64748b', fontSize: 10 }}
                                                tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                                                labelFormatter={(label) => new Date(label).toLocaleString()}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="tds"
                                                stroke="#06b6d4"
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    No sensor data available
                                </div>
                            )}
                        </div>
                    )}

                    {/* Maintenance Logs Tab */}
                    {activeTab === 'maintenance' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-slate-300">Maintenance History</h3>
                            {maintenanceLogs.length > 0 ? (
                                maintenanceLogs.map((log) => (
                                    <div key={log.id} className="bg-slate-800/50 rounded-xl p-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-white">{log.action}</p>
                                                <p className="text-xs text-slate-400 mt-1">By: {log.performed_by}</p>
                                                {log.notes && (
                                                    <p className="text-xs text-slate-500 mt-1">{log.notes}</p>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {new Date(log.performed_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    No maintenance logs
                                </div>
                            )}
                        </div>
                    )}

                    {/* Config Tab */}
                    {activeTab === 'config' && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-slate-300">Device Configuration</h3>

                            <div className="bg-slate-800/50 rounded-xl divide-y divide-slate-700">
                                <div className="flex items-center justify-between p-3">
                                    <span className="text-sm text-slate-400">Device ID</span>
                                    <span className="text-sm text-white font-mono">{device.node_number || device.device_id || device.id.split('-')[0]}</span>
                                </div>
                                <div className="flex items-center justify-between p-3">
                                    <span className="text-sm text-slate-400">Firmware</span>
                                    <span className="text-sm text-white">{device.metadata?.firmware_version || device.firmware_version || 'v1.0.0'}</span>
                                </div>
                                <div className="flex items-center justify-between p-3">
                                    <span className="text-sm text-slate-400">Installed</span>
                                    <span className="text-sm text-white">
                                        {new Date(device.deployment_date || device.installed_at || device.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* TDS Threshold Configuration Section */}
                            <div className="bg-slate-800/50 rounded-xl overflow-hidden">
                                <div className="p-4 space-y-3 border-b border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-medium text-slate-300">Water Quality Thresholds (PPM)</h4>
                                        {!isEditingTds && (
                                            <button
                                                onClick={() => {
                                                    setEditTdsMin(device.safe_tds_min ?? 35)
                                                    setEditTdsMax(device.safe_tds_max ?? 175)
                                                    setIsEditingTds(true)
                                                }}
                                                className="text-xs px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded transition-colors"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>

                                    {isEditingTds ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-2">Safe Minimum</label>
                                                    <input
                                                        type="number"
                                                        value={editTdsMin}
                                                        onChange={(e) => setEditTdsMin(Number(e.target.value))}
                                                        disabled={isUpdating}
                                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                                                        placeholder="e.g., 35"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-xs text-slate-400 block mb-2">Safe Maximum</label>
                                                    <input
                                                        type="number"
                                                        value={editTdsMax}
                                                        onChange={(e) => setEditTdsMax(Number(e.target.value))}
                                                        disabled={isUpdating}
                                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                                                        placeholder="e.g., 175"
                                                    />
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-500">
                                                ℹ️ Readings outside this range will trigger alerts
                                            </p>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSaveTdsLimits}
                                                    disabled={isUpdating}
                                                    className="flex-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    {isUpdating ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={() => setIsEditingTds(false)}
                                                    disabled={isUpdating}
                                                    className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-700/50 rounded p-2">
                                                <p className="text-xs text-slate-500">Minimum</p>
                                                <p className="text-lg font-bold text-white">{device.safe_tds_min ?? 35}</p>
                                            </div>
                                            <div className="bg-slate-700/50 rounded p-2">
                                                <p className="text-xs text-slate-500">Maximum</p>
                                                <p className="text-lg font-bold text-white">{device.safe_tds_max ?? 175}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button className="w-full flex items-center justify-between p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors">
                                <span className="text-sm text-white">Update Firmware</span>
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                            </button>

                            <button className="w-full flex items-center justify-between p-3 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors border border-red-500/20">
                                <span className="text-sm text-red-400">Reset Device</span>
                                <ChevronRight className="h-4 w-4 text-red-400" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
