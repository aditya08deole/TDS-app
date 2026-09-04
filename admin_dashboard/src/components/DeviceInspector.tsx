import { useState, useMemo, useEffect } from 'react'
import { getDeviceDisplayName } from '../lib/constants'
import { toast } from 'sonner'
import {
    X, MapPin, Activity, Settings, History, CheckCircle, Wrench, RefreshCw, Minimize2
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import HealthTimeline from './HealthTimeline'
import ConfidenceRing from './ConfidenceRing'
import { useUI } from '../context/UIContext'
import { useDevice, useUpdateDevice } from '../hooks/useDeviceQueries'
import { useDeviceThingSpeakChartData } from '../hooks/useThingSpeakQueries'
import { useRole } from '../context/RoleContext'
import type { Device } from '../types'
import { cn } from '@/lib/utils'

type TabType = 'overview' | 'history' | 'maintenance' | 'config'

export default function DeviceInspector() {
    const { inspectorDeviceId, closeInspector, isMobile } = useUI()
    const { hasPermission, isAtLeast } = useRole()
    
    // Hooks for data fetching
    const { data: device, isLoading: deviceLoading } = useDevice(inspectorDeviceId || undefined)
    const { data: sensorData = [], isLoading: sensorLoading } = useDeviceThingSpeakChartData(device || undefined, 100)
    const updateMutation = useUpdateDevice()

    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [renderNow] = useState(() => Date.now())
    const [updating, setUpdating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({ name: '', location_name: '', firmware_version: '' })

    useEffect(() => {
        if (device) {
            setTimeout(() => {
                setEditForm({
                    name: device.name,
                    location_name: device.location_name || '',
                    firmware_version: (device.metadata as any)?.firmware_version?.toString() || ''
                })
            }, 0)
        }
    }, [device?.id])

    // Map sensor data to SensorReading format
    const sensorHistory = useMemo(() => {
        return sensorData.map((d, i) => ({
            id: i.toString(),
            tds: d.tds,
            temperature: d.temperature,
            recorded_at: d.timestamp
        }))
    }, [sensorData])

    const latestReading = useMemo(() => {
        return sensorHistory.length > 0 ? sensorHistory[sensorHistory.length - 1] : null
    }, [sensorHistory])

    // Removed sync useEffect to avoid cascading renders lint error

    const handleSaveConfig = async () => {
        if (!device) return
        setUpdating(true)
        const toastId = toast.loading('Saving configuration...')
        try {
            const updatedMetadata = { 
                ...device.metadata, 
                firmware_version: editForm.firmware_version 
            }
            
            await updateMutation.mutateAsync({
                id: device.id,
                updates: {
                    name: editForm.name,
                    location_name: editForm.location_name,
                    metadata: updatedMetadata
                }
            })

            setIsEditing(false)
            toast.success('Configuration saved successfully', { id: toastId })
        } catch (err) {
            console.error('Failed to save config', err)
            toast.error('Failed to save configuration', { id: toastId })
        }
        setUpdating(false)
    }

    const handleRegenerateQR = async () => {
        if (!device) return
        const confirmed = window.confirm('Are you sure you want to regenerate the QR code? The old QR code will stop working immediately.')
        if (!confirmed) return

        setUpdating(true)
        const toastId = toast.loading('Regenerating QR code...')

        try {
            await updateMutation.mutateAsync({
                id: device.id,
                updates: {
                    qr_rotation_pending: true,
                    updated_at: new Date().toISOString()
                }
            })
            
            toast.success('QR Code rotation requested!', { id: toastId })
        } catch (err) {
            console.error('Failed to rotate QR', err)
            toast.error('Failed to rotate QR code', { id: toastId })
        }
        setUpdating(false)
    }

    const toggleMaintenanceMode = async () => {
        if (!device) return
        setUpdating(true)
        const toastId = toast.loading('Updating status...')
        try {
            const newStatus = device.status === 'maintenance' ? 'online' : 'maintenance'
            await updateMutation.mutateAsync({
                id: device.id,
                updates: { status: newStatus as Device['status'] }
            })
            toast.success(`Device ${newStatus === 'maintenance' ? 'entered maintenance mode' : 'is now online'}`, { id: toastId })
        } catch (err) {
            console.error(err)
            toast.error('Failed to update status', { id: toastId })
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

    return (
        <div className={cn(
            "fixed top-0 right-0 h-full bg-background/95 backdrop-blur-2xl border-l border-border shadow-2xl z-50 transition-all duration-500 ease-in-out flex flex-col",
            isMobile ? "w-full" : "w-[400px]",
            inspectorDeviceId ? "translate-x-0" : "translate-x-full"
        )}>
            {/* Mobile Backdrop */}
            {inspectorDeviceId && isMobile && (
                <div 
                    className="fixed inset-0 bg-black/40 -z-10 md:hidden animate-in fade-in duration-300" 
                    onClick={closeInspector} 
                />
            )}

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

            {deviceLoading && !device ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
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

                                <div className="bg-accent/5 rounded-xl p-4 border border-border">
                                    <div className="flex items-center gap-2 mb-3">
                                        <MapPin className="h-4 w-4 text-blue-400" />
                                        <span className="text-sm font-medium text-foreground">Location</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{device.location_name || 'Unknown Location'}</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1 font-mono">{device.latitude?.toFixed(4)}, {device.longitude?.toFixed(4)}</p>
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
                                <div className="h-64 w-full bg-accent/5 rounded-xl p-2 border border-border">
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
                                        <div key={i} className="flex justify-between text-xs py-2 border-b border-border">
                                            <span className="text-muted-foreground">{new Date(reading.recorded_at).toLocaleTimeString()}</span>
                                            <span className="text-foreground font-mono">{reading.tds.toFixed(1)} PPM</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Config */}
                        {activeTab === 'config' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-accent/5 rounded-xl border border-border relative">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase">Device Metadata</h3>
                                        {isAtLeast('admin') && (
                                            <button
                                                onClick={() => {
                                                    if (isEditing) handleSaveConfig()
                                                    else setIsEditing(true)
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-accent/10 text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {isEditing ? <CheckCircle className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-4 text-sm">
                                        <div className="space-y-1">
                                            <span className="text-muted-foreground text-xs">Device Name</span>
                                            {isEditing ? (
                                                <input
                                                    className="w-full bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary"
                                                    value={editForm.name}
                                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                />
                                            ) : (
                                                <div className="text-foreground font-medium">{device.name}</div>
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
                                                <div className="text-foreground font-mono">{(device.metadata as any)?.firmware_version || 'v1.0.0'}</div>
                                            )}
                                        </div>

                                        <div className="bg-accent/5 rounded-xl p-4 border border-border">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Live Metrics</h3>
                                                <div className={`animate-pulse flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${sensorLoading ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                                    <span className={`w-1 h-1 rounded-full ${sensorLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
                                                    {sensorLoading ? 'Syncing...' : 'Live'}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Current TDS</span>
                                                    <div className="text-2xl font-black font-mono text-foreground">{latestReading?.tds || '--'}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Water Temp</span>
                                                    <div className="text-2xl font-black font-mono text-foreground">{latestReading?.temperature ? `${latestReading.temperature.toFixed(1)}°` : '--'}</div>
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
                                                <div className="text-foreground font-medium">{(device.metadata as any)?.last_maintenance ? new Date((device.metadata as any).last_maintenance).toLocaleDateString() : '-'}</div>
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
