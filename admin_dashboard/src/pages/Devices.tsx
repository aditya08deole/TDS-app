import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Device } from '../types'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { QRCodeGenerator } from '../components/QRCodeGenerator'
import { QRCodeScanner } from '../components/QRCodeScanner'
import {
    useDevices,
    useAddDevice,
    useDeleteDevice,
    useUpdateDevice,
    useDeviceSubscription
} from '../hooks/useDeviceQueries'
import { GlassCard } from '../components/GlassCard'
import { useAllDevicesThingSpeakData } from '../hooks/useThingSpeakQueries'
import { triggerSync } from '../lib/api'
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"
import {
    Plus,
    Trash2,
    Smartphone,
    Search,
    Filter,
    CheckSquare,
    Square,
    Download,
    Thermometer,
    Zap,
    Droplets,
    Clock,
    Activity,
    MapPin,
    RefreshCw,
    X,
    QrCode,
    ScanLine
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getConnectivityStatus } from '../lib/constants'
import { useViewport } from '../hooks/useViewport'
import { cn } from '@/lib/utils'

// Typed interfaces for ThingSpeak feed data in Devices
interface ThingSpeakFeedEntry {
    created_at: string
    [key: string]: string | undefined
}
interface HistoryReading {
    time: string
    tds: number
}

type StatusFilter = 'all' | 'online' | 'offline' | 'maintenance'

export default function Devices() {
    const { isAdmin } = useAuth()
    const { isMobile } = useUI()
    const { isLandscape, isDesktop } = useViewport()
    
    // Use Firestore hooks
    const { data: devices = [], isLoading, refetch } = useDevices()
    const { mutate: addDevice, isPending: addingDevice } = useAddDevice()
    const { mutate: deleteDevice } = useDeleteDevice()
    const { mutate: updateDevice } = useUpdateDevice()
    
    // Realtime subscription
    useDeviceSubscription()

    // Enrich with ThingSpeak data for real-time status
    const { devices: enrichedDevices } = useAllDevicesThingSpeakData(devices)

    const [newDevice, setNewDevice] = useState({
        name: '',
        location_name: '',
        latitude: '',
        longitude: '',
        sim_number: '',
        node_number: '',
        thingspeak_channel_id: '',
        thingspeak_read_key: '',
        tds_field: 1,
        temp_field: 2,
        voltage_field: 3,
        safe_tds_min: '35',
        safe_tds_max: '175'
    })

    const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
    
    const [showQRGenerator, setShowQRGenerator] = useState(false)
    const [showQRScanner, setShowQRScanner] = useState(false)

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

    // Selection State (for bulk operations)
    const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
    const [selectionMode, setSelectionMode] = useState(false)
    
    // Toggle for Add/Edit Form
    const [isFormOpen, setIsFormOpen] = useState(false)

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false)

    // Device Quick View State
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
    const [sensorHistory, setSensorHistory] = useState<HistoryReading[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')

    // Pull to Refresh hook
    const { handlers, PullIndicator } = usePullToRefresh({
        onRefresh: async () => { await refetch() },
        disabled: !isMobile
    })

    // Filtered devices
    const filteredDevices = useMemo(() => {
        return enrichedDevices.filter(device => {
            // Search filter
            const matchesSearch = searchQuery === '' ||
                device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                device.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (device.thingspeak_channel_id?.toString() || '').includes(searchQuery)

            // Status filter
            const deviceStatus = device.status === 'maintenance' 
                ? 'maintenance' 
                : getConnectivityStatus(device.last_reading_at || device.last_seen_at)
            
            const matchesStatus = statusFilter === 'all' || deviceStatus === statusFilter

            return matchesSearch && matchesStatus
        })
    }, [enrichedDevices, searchQuery, statusFilter])

    // Cache channel configs to prevent infinite fetch loops
    const activeChannelConfig = useMemo(() => {
        const d = enrichedDevices.find(d => d.id === selectedDeviceId)
        return d ? { 
            channelId: d.thingspeak_channel_id, 
            readKey: d.thingspeak_read_key, 
            tdsField: d.tds_field_number || 1 
        } : null
    }, [selectedDeviceId, enrichedDevices])

    // Fetch history for Quick View
    useEffect(() => {
        let isMounted = true

        const fetchHistory = async () => {
            if (!selectedDeviceId || !activeChannelConfig?.channelId || !activeChannelConfig?.readKey) {
                if (isMounted) setSensorHistory([])
                return
            }

            setHistoryLoading(true)
            try {
                const { channelId, readKey, tdsField } = activeChannelConfig
                const response = await fetch(`https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${readKey}&results=30`)
                const json = await response.json()
                
                if (json.feeds && isMounted) {
                    const readings: HistoryReading[] = (json.feeds as ThingSpeakFeedEntry[]).map((f) => ({
                        time: new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        tds: parseFloat(f[`field${tdsField}`] || '0') || 0
                    })).filter((r) => r.tds > 10)
                    setSensorHistory(readings)
                }
            } catch (err) {
                console.error('Failed to fetch history', err)
            } finally {
                if (isMounted) setHistoryLoading(false)
            }
        }

        fetchHistory()
        return () => { isMounted = false }
    }, [selectedDeviceId, activeChannelConfig])

    const handleSync = async () => {
        setIsSyncing(true)
        try {
            const result = await triggerSync()
            console.log('✅ Sync complete:', result)
            await refetch()
        } catch (error) {
            console.error('❌ Sync failed:', error)
            alert('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
        } finally {
            setIsSyncing(false)
        }
    }

    const handleAddDevice = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAdmin) return

        // ═══ INPUT VALIDATION ═══
        // Validate GPS coordinates
        const lat = parseFloat(newDevice.latitude)
        const lon = parseFloat(newDevice.longitude)
        if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            alert('Invalid GPS coordinates. Latitude must be -90 to 90, Longitude must be -180 to 180')
            return
        }

        // Validate TDS thresholds
        const tdsMin = parseFloat(newDevice.safe_tds_min)
        const tdsMax = parseFloat(newDevice.safe_tds_max)
        if (isNaN(tdsMin) || isNaN(tdsMax) || tdsMin < 0 || tdsMax < tdsMin || tdsMax > 10000) {
            alert('Invalid TDS thresholds. Min must be >= 0 and Max must be >= Min and <= 10000')
            return
        }

        // Validate ThingSpeak Channel ID (numeric)
        if (!newDevice.thingspeak_channel_id || !/^\d+$/.test(newDevice.thingspeak_channel_id)) {
            alert('Invalid ThingSpeak Channel ID. Must be numeric')
            return
        }

        // Validate ThingSpeak Read Key
        if (!newDevice.thingspeak_read_key || newDevice.thingspeak_read_key.length < 10) {
            alert('Invalid ThingSpeak Read Key. Must be at least 10 characters')
            return
        }

        // Validate field numbers (1-8 for ThingSpeak)
        const tdsField = parseInt(newDevice.tds_field)
        const tempField = parseInt(newDevice.temp_field)
        const voltageField = parseInt(newDevice.voltage_field)
        if ([tdsField, tempField, voltageField].some(f => isNaN(f) || f < 1 || f > 8)) {
            alert('Invalid field numbers. ThingSpeak fields must be 1-8')
            return
        }

        // Validate required fields
        if (!newDevice.name.trim()) {
            alert('Device name is required')
            return
        }

        const devicePayload = {
            name: newDevice.name.trim(),
            location_name: newDevice.location_name.trim(),
            latitude: lat,
            longitude: lon,
            sim_number: newDevice.sim_number.trim(),
            node_number: newDevice.node_number.trim(),
            thingspeak_channel_id: newDevice.thingspeak_channel_id.trim(),
            thingspeak_read_key: newDevice.thingspeak_read_key.trim(),
            tds_field_number: tdsField,
            temperature_field_number: tempField,
            voltage_field_number: voltageField,
            safe_tds_min: tdsMin,
            safe_tds_max: tdsMax,
            status: 'offline' as const
        }

        if (editingDeviceId) {
            updateDevice({ id: editingDeviceId, updates: devicePayload }, {
                onSuccess: () => {
                    setEditingDeviceId(null)
                    resetForm()
                },
                onError: (error) => {
                    alert('Error updating device: ' + error.message)
                }
            })
        } else {
            addDevice(devicePayload, {
                onSuccess: () => {
                    resetForm()
                },
                onError: (error) => {
                    alert('Error adding device: ' + error.message)
                }
            })
        }
    }

    const resetForm = () => {
        setNewDevice({
            name: '',
            location_name: '',
            latitude: '',
            longitude: '',
            sim_number: '',
            node_number: '',
            thingspeak_channel_id: '',
            thingspeak_read_key: '',
            tds_field: 1,
            temp_field: 2,
            voltage_field: 3,
            safe_tds_min: '35',
            safe_tds_max: '175'
        })
    }

    const handleDelete = (id: string) => {
        if (!isAdmin || !confirm('Are you sure you want to delete this device?')) return
        deleteDevice(id)
    }

    const handleDeviceClick = (device: Device) => {
        if (selectionMode) {
            toggleDeviceSelection(device.id)
        } else {
            setSelectedDeviceId(device.id === selectedDeviceId ? null : device.id)
        }
    }

    const toggleDeviceSelection = (deviceId: string) => {
        setSelectedDevices(prev => {
            const newSet = new Set(prev)
            if (newSet.has(deviceId)) {
                newSet.delete(deviceId)
            } else {
                newSet.add(deviceId)
            }
            return newSet
        })
    }

    const selectAllDevices = () => {
        if (selectedDevices.size === filteredDevices.length) {
            setSelectedDevices(new Set())
        } else {
            setSelectedDevices(new Set(filteredDevices.map(d => d.id)))
        }
    }

    const handleBulkDelete = () => {
        if (!isAdmin || selectedDevices.size === 0) return
        if (!confirm(`Delete ${selectedDevices.size} devices?`)) return

        selectedDevices.forEach(id => deleteDevice(id))

        setSelectedDevices(new Set())
        setSelectionMode(false)
    }

    const handleBulkMaintenanceMode = () => {
        if (!isAdmin || selectedDevices.size === 0) return

        selectedDevices.forEach(id => {
            updateDevice({ id, updates: { status: 'maintenance' } })
        })
        
        setSelectedDevices(new Set())
        setSelectionMode(false)
    }

    const exportToCSV = () => {
        const headers = ['ID', 'Name', 'Status', 'Latitude', 'Longitude', 'TS Channel', 'TS Read Key', 'Created At']
        const rows = filteredDevices.map(d => [
            d.id,
            d.name,
            d.status,
            d.latitude,
            d.longitude,
            d.thingspeak_channel_id,
            d.thingspeak_read_key,
            d.created_at
        ])

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `devices_${new Date().toISOString().split('T')[0]}.csv`
        a.click()
    }

    const statusFilters: { value: StatusFilter; label: string; color: string }[] = [
        { value: 'all', label: 'All', color: 'bg-slate-500' },
        { value: 'online', label: 'Online', color: 'bg-emerald-500' },
        { value: 'offline', label: 'Offline', color: 'bg-red-500' },
        // { value: 'degraded', label: 'Degraded', color: 'bg-orange-500' }, // Removed
        { value: 'maintenance', label: 'Maintenance', color: 'bg-blue-500' },
    ]

    return (
        <div
            className="space-y-3 md:space-y-6 px-4 pt-2 md:pt-0"
            {...handlers}
        >
            <PullIndicator />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-4 pb-1">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Devices</h1>
                    <p className="text-muted-foreground mt-0.5 text-[10px] lg:text-base font-medium">
                        {filteredDevices.length} of {devices.length} nodes active
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                    >
                        <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-500/30"
                        title="Sync devices from Firebase to local database"
                    >
                        <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Fetch Latest'}
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                        title="Export to CSV"
                    >
                        <Download className="h-5 w-5" />
                    </button>
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => setIsFormOpen(!isFormOpen)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-bold border-white/20 shadow-[0_0_20px_rgba(234,179,8,0.3)] ${isFormOpen 
                                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 ring-1 ring-yellow-400/50' 
                                    : 'bg-yellow-500/10 text-yellow-400 glass-system-child hover:scale-[1.05] active:scale-95 border-yellow-500/30'
                                }`}
                            >
                                {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                {isFormOpen ? 'Close Form' : 'Add Device'}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectionMode(!selectionMode)
                                    setSelectedDevices(new Set())
                                }}
                                className={`p-2 rounded-lg transition-colors ${selectionMode
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                    }`}
                            >
                                <CheckSquare className="h-5 w-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search devices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-secondary border border-accent rounded-xl pl-10 pr-4 py-2.5 text-foreground placeholder-muted-foreground focus:border-primary outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === filter.value
                                ? `${filter.color} text-white`
                                : 'bg-secondary text-muted-foreground hover:bg-accent'
                                }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${filter.color}`} />
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectionMode && selectedDevices.size > 0 && (
                <div className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={selectAllDevices}
                            className="text-cyan-400 text-sm hover:underline"
                        >
                            {selectedDevices.size === filteredDevices.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-cyan-400 text-sm">{selectedDevices.size} selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBulkMaintenanceMode}
                            className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-sm rounded-lg hover:bg-blue-500/30"
                        >
                            Maintenance Mode
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 text-sm rounded-lg hover:bg-red-500/30"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}

            {/* Add Device Form (Admin Only) */}
            {isAdmin && !selectionMode && (isFormOpen || editingDeviceId) && (
                <GlassCard size="lg" className="p-4 lg:p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Plus className="h-5 w-5 text-blue-400" />
                            {editingDeviceId ? 'Edit Device Settings' : 'Add New Device'}
                        </h3>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowQRScanner(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-medium rounded-lg transition-all text-sm"
                            >
                                <ScanLine className="h-4 w-4" />
                                {editingDeviceId ? 'Update Metadata' : 'Scan QR'}
                            </button>
                            {editingDeviceId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingDeviceId(null)
                                        resetForm()
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 bg-secondary hover:bg-accent text-foreground font-medium rounded-lg transition-all text-sm"
                                >
                                    Cancel Edit
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowQRGenerator(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 font-medium rounded-lg transition-all text-sm"
                            >
                                <QrCode className="h-4 w-4" />
                                Generate QR
                            </button>
                        </div>
                    </div>
                    <form onSubmit={handleAddDevice} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Device Name */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Device Name *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.name}
                                onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="e.g., NodeMCU-01"
                            />
                        </div>

                        {/* Location Name */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Location Name *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.location_name}
                                onChange={e => setNewDevice({ ...newDevice, location_name: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="e.g., Tank A - Block 3"
                            />
                        </div>

                        {/* Node Number */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Node Number *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.node_number}
                                onChange={e => setNewDevice({ ...newDevice, node_number: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="e.g., NODE-001"
                            />
                        </div>

                        {/* Latitude */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Latitude *</label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={newDevice.latitude}
                                onChange={e => setNewDevice({ ...newDevice, latitude: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="e.g., 20.5937"
                            />
                        </div>

                        {/* Longitude */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Longitude *</label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={newDevice.longitude}
                                onChange={e => setNewDevice({ ...newDevice, longitude: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="e.g., 78.9629"
                            />
                        </div>

                        {/* SIM Number */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">SIM Number *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.sim_number}
                                onChange={e => setNewDevice({ ...newDevice, sim_number: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="e.g., +91-9876543210"
                            />
                        </div>

                        {/* ThingSpeak Channel ID */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">ThingSpeak Channel ID *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.thingspeak_channel_id}
                                onChange={e => setNewDevice({ ...newDevice, thingspeak_channel_id: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="e.g., 2713286"
                            />
                        </div>

                        {/* ThingSpeak Read API Key */}
                        <div className="md:col-span-1 lg:col-span-1">
                            <label className="text-sm text-muted-foreground mb-1.5 block">ThingSpeak Read API Key *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.thingspeak_read_key}
                                onChange={e => setNewDevice({ ...newDevice, thingspeak_read_key: e.target.value })}
                                className="w-full glass-system-inset px-3 py-2.5 text-foreground font-mono outline-none text-sm"
                                placeholder="e.g., XXXXXXXXXXXXXX"
                            />
                        </div>

                        {/* Safe TDS Range */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Safe TDS Min (Default: 35)</label>
                            <input
                                type="number"
                                value={newDevice.safe_tds_min}
                                onChange={e => setNewDevice({ ...newDevice, safe_tds_min: e.target.value })}
                                className="w-full glass-system-inset px-3 py-2.5 text-foreground outline-none text-sm"
                                placeholder="35"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Safe TDS Max (Default: 175)</label>
                            <input
                                type="number"
                                value={newDevice.safe_tds_max}
                                onChange={e => setNewDevice({ ...newDevice, safe_tds_max: e.target.value })}
                                className="w-full glass-system-inset px-3 py-2.5 text-foreground outline-none text-sm"
                                placeholder="175"
                            />
                        </div>

                        {/* Field Mapping Section */}
                        <div className="md:col-span-2 lg:col-span-3">
                            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                ThingSpeak Field Mapping
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* TDS Field */}
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1.5 block">TDS Field Number</label>
                                    <select
                                        value={newDevice.tds_field}
                                        onChange={e => setNewDevice({ ...newDevice, tds_field: parseInt(e.target.value) })}
                                        className="w-full glass-system-inset px-3 py-2.5 text-foreground outline-none text-sm"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                            <option key={num} value={num}>Field {num}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Temperature Field */}
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1.5 block">Temperature Field Number</label>
                                    <select
                                        value={newDevice.temp_field}
                                        onChange={e => setNewDevice({ ...newDevice, temp_field: parseInt(e.target.value) })}
                                        className="w-full glass-system-inset px-3 py-2.5 text-foreground outline-none text-sm"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                            <option key={num} value={num}>Field {num}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Voltage Field */}
                                <div>
                                    <label className="text-sm text-muted-foreground mb-1.5 block">Voltage Field Number</label>
                                    <select
                                        value={newDevice.voltage_field}
                                        onChange={e => setNewDevice({ ...newDevice, voltage_field: parseInt(e.target.value) })}
                                        className="w-full glass-system-inset px-3 py-2.5 text-foreground outline-none text-sm"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                                            <option key={num} value={num}>Field {num}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                            <button
                                type="submit"
                                disabled={addingDevice}
                                className="px-6 py-2.5 glass-system-child text-primary-foreground font-bold rounded-xl transition-all shadow-xl border-white/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                            >
                                {editingDeviceId 
                                    ? (addingDevice ? 'Updating...' : 'Update Device') 
                                    : (addingDevice ? 'Adding...' : 'Add Device')
                                }
                            </button>
                        </div>
                    </form>
                </GlassCard>
            )}

            {/* Device Quick View Floating Panel / Drawer */}
            <AnimatePresence>
                {selectedDeviceId && (
                    isMobile ? (
                        <Sheet open={!!selectedDeviceId} onOpenChange={(open) => !open && setSelectedDeviceId(null)}>
                            <SheetContent side="bottom" className="p-0 h-[85vh] rounded-t-[32px] border-t-white/20 glass-system-parent backdrop-blur-3xl overflow-hidden flex flex-col">
                                {(() => {
                                    const device = enrichedDevices.find(d => d.id === selectedDeviceId);
                                    if (!device) return null;
                                    
                                    const tds = device.latest_tds || 0;
                                    const temp = device.latest_temperature || 0;
                                    const min = device.safe_tds_min || 35;
                                    const max = device.safe_tds_max || 175;
                                    const isSafe = tds >= min && tds <= max;
                                    const statusColor = isSafe ? '#00df81' : '#ff0055';
                                    const statusBg = isSafe ? 'rgba(0, 223, 129, 0.1)' : 'rgba(255, 0, 85, 0.1)';

                                    return (
                                        <div className="flex flex-col h-full">
                                            {/* Header */}
                                            <div className="relative p-6 border-b border-white/10">
                                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full mt-3" />
                                                <div className="flex items-center gap-4 mt-4">
                                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 glass-system-micro border-white/10"
                                                        style={{ background: statusBg }}>
                                                        <Droplets className="w-7 h-7" style={{ color: statusColor }} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-black text-foreground tracking-tight">{device.name}</h3>
                                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                                                            <MapPin className="w-4 h-4 text-primary" /> {device.location_name || 'GIS Node'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tabs & Content */}
                                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                                <div className="flex p-1.5 gap-1.5 rounded-2xl bg-secondary/50 border border-white/5">
                                                    {['overview', 'history'].map((tab) => (
                                                        <button
                                                            key={tab}
                                                            onClick={() => setActiveTab(tab as 'overview' | 'history')}
                                                            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                                                activeTab === tab 
                                                                    ? 'bg-secondary text-foreground shadow-xl border border-white/10' 
                                                                    : 'text-muted-foreground'
                                                            }`}
                                                        >
                                                            {tab}
                                                        </button>
                                                    ))}
                                                </div>

                                                {activeTab === 'overview' ? (
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="p-5 rounded-3xl glass-system-inset border-white/5">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <Activity className="w-4 h-4 text-primary" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">TDS PPM</span>
                                                                </div>
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="text-3xl font-black font-mono tracking-tighter" style={{ color: statusColor }}>{tds}</span>
                                                                    <span className="text-sm font-bold text-muted-foreground/40">ppm</span>
                                                                </div>
                                                            </div>
                                                            <div className="p-5 rounded-3xl glass-system-inset border-white/5">
                                                                <div className="flex items-center gap-2 mb-3">
                                                                    <Thermometer className="w-4 h-4 text-emerald-400" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Temp</span>
                                                                </div>
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className="text-3xl font-black font-mono tracking-tighter text-emerald-400">{temp.toFixed(1)}</span>
                                                                    <span className="text-sm font-bold text-muted-foreground/40">°C</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Sparkline */}
                                                        <div className="p-6 rounded-3xl glass-system-inset border-white/5">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">24H Trend Analysis</span>
                                                                <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : 'opacity-30'}`} />
                                                            </div>
                                                            <div className="h-[180px] w-full">
                                                                <ResponsiveContainer width="100%" height="100%">
                                                                    <AreaChart data={sensorHistory}>
                                                                        <defs>
                                                                            <linearGradient id="tdsChartFillMobile" x1="0" y1="0" x2="0" y2="1">
                                                                                <stop offset="5%" stopColor={statusColor} stopOpacity={0.3} />
                                                                                <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
                                                                            </linearGradient>
                                                                        </defs>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                                                                        <XAxis dataKey="time" hide />
                                                                        <YAxis hide />
                                                                        <Area 
                                                                            type="monotone" 
                                                                            dataKey="tds" 
                                                                            stroke={statusColor} 
                                                                            strokeWidth={3}
                                                                            fill="url(#tdsChartFillMobile)"
                                                                        />
                                                                    </AreaChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 pb-12">
                                                        {sensorHistory.length > 0 ? (
                                                            sensorHistory.slice().reverse().map((read, idx) => (
                                                                <div key={idx} className="flex items-center justify-between p-4 rounded-2xl glass-system-micro border-white/5">
                                                                    <span className="text-xs text-muted-foreground font-bold">{read.time}</span>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className="text-lg font-black font-mono tracking-tighter">{read.tds} <small className="text-[10px] opacity-40 uppercase">PPM</small></span>
                                                                        <div className="w-1.5 h-6 rounded-full" style={{ background: statusColor }} />
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-20 text-center opacity-30 italic text-sm font-bold tracking-widest">NO TELEMETRY LOGS</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })()}
                            </SheetContent>
                        </Sheet>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, x: 20, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="fixed top-[37vh] right-6 z-[9999] w-[340px] shadow-2xl"
                        >
                            {(() => {
                                const device = enrichedDevices.find(d => d.id === selectedDeviceId);
                                if (!device) return null;
                                
                                const tds = device.latest_tds || 0;
                                const temp = device.latest_temperature || 0;
                                const min = device.safe_tds_min || 35;
                                const max = device.safe_tds_max || 175;
                                const isSafe = tds >= min && tds <= max;
                                
                                // Map View inspired status logic
                                const statusColor = isSafe ? '#00df81' : '#ff0055';
                                const statusBg = isSafe ? 'rgba(0, 223, 129, 0.1)' : 'rgba(255, 0, 85, 0.1)';

                                return (
                                    <div 
                                        className="glass-system-solid rounded-[24px] overflow-hidden flex flex-col h-[580px]"
                                    >
                                        {/* Header */}
                                        <div className="relative p-4 border-b border-white/10">
                                            <div className="absolute top-0 left-0 right-0 h-[2px]"
                                                style={{ background: `linear-gradient(90deg, transparent, ${statusColor}, transparent)` }} />
                                            
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 glass-system-micro border-white/10"
                                                        style={{ background: statusBg }}>
                                                        <Droplets className="w-5 h-5" style={{ color: statusColor }} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-foreground leading-tight">{device.name}</h3>
                                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                                                            <MapPin className="w-3 h-3" /> {device.location_name || 'GIS Node'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => setSelectedDeviceId(null)}
                                                    className="p-2 hover:bg-secondary rounded-lg transition-all active:scale-95"
                                                >
                                                    <X className="h-4 w-4 text-muted-foreground" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Tabs */}
                                        <div className="flex p-2 gap-1 mx-4 mt-3 rounded-lg bg-secondary/50 border border-white/5">
                                            {['overview', 'history'].map((tab) => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setActiveTab(tab as 'overview' | 'history')}
                                                    className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                                        activeTab === tab 
                                                            ? 'bg-secondary text-foreground shadow-sm' 
                                                            : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                                >
                                                    {tab}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Content Area */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                                            {activeTab === 'overview' ? (
                                                <>
                                                    {/* Stats Grid */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 rounded-xl glass-system-inset border-white/5">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Activity className="w-3 h-3 text-primary" />
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">TDS PPM</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-xl font-black font-mono tracking-tighter" style={{ color: statusColor }}>{tds}</span>
                                                                <span className="text-[9px] font-bold text-muted-foreground/50">ppm</span>
                                                            </div>
                                                        </div>
                                                        <div className="p-3 rounded-xl glass-system-inset border-white/5">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Thermometer className="w-3 h-3 text-emerald-400" />
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Temp</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-1">
                                                                <span className="text-xl font-black font-mono tracking-tighter text-emerald-400">{temp.toFixed(1)}</span>
                                                                <span className="text-[9px] font-bold text-muted-foreground/50">°C</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Safety Banner */}
                                                    <div className={`p-3 rounded-xl flex items-center gap-3 border transition-all ${
                                                        isSafe 
                                                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                                                            : 'bg-red-500/5 border-red-500/20 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                                                    }`}>
                                                        <Zap className={`h-4 w-4 shrink-0 ${isSafe ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`} />
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">
                                                                {isSafe ? 'Water Quality Safe' : 'Unsafe Levels Detected'}
                                                            </span>
                                                            <span className="text-[8px] opacity-60 font-medium">Auto-analysis via AI Safety Guard</span>
                                                        </div>
                                                    </div>

                                                    {/* Sparkline History */}
                                                    <div className="p-4 rounded-xl glass-system-inset border-white/5 space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">24H TDS Trend</span>
                                                            {historyLoading && <RefreshCw className="w-2.5 h-2.5 animate-spin opacity-50" />}
                                                        </div>
                                                        <div className="h-[120px] w-full">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <AreaChart data={sensorHistory} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                                                                    <defs>
                                                                        <linearGradient id="tdsChartFill" x1="0" y1="0" x2="0" y2="1">
                                                                            <stop offset="5%" stopColor={statusColor} stopOpacity={0.3} />
                                                                            <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                                    <XAxis dataKey="time" hide />
                                                                    <YAxis tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                                                                    <Tooltip 
                                                                        contentStyle={{ 
                                                                            backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                                            borderRadius: '8px',
                                                                            fontSize: '10px'
                                                                        }} 
                                                                    />
                                                                    <Area 
                                                                        type="monotone" 
                                                                        dataKey="tds" 
                                                                        stroke={statusColor} 
                                                                        strokeWidth={2}
                                                                        fill="url(#tdsChartFill)"
                                                                        animationDuration={1000}
                                                                    />
                                                                </AreaChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="space-y-2">
                                                    {sensorHistory.length > 0 ? (
                                                        sensorHistory.slice().reverse().map((read, idx) => (
                                                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg glass-system-micro border-white/5 transition-all hover:bg-white/5">
                                                                <span className="text-[10px] text-muted-foreground font-medium">{read.time}</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-black font-mono tracking-tighter text-foreground">{read.tds} <small className="text-[8px] opacity-40 font-bold">PPM</small></span>
                                                                    <div className="w-1 h-3 rounded-full" style={{ background: statusColor }} />
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="py-20 text-center opacity-30 italic text-xs">No history available</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer */}
                                        <div className="p-4 border-t border-white/10 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 opacity-50">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[9px] font-bold">LIVE SYNC ACTIVE</span>
                                            </div>
                                            <div className="px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter"
                                                style={{ backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusColor}40`, boxShadow: `0 0 10px ${statusColor}10` }}>
                                                {isSafe ? 'Analysis: Safe' : 'Analysis: Warn'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    )
                )}
            </AnimatePresence>

            {/* Device Grid */}
            <div className={cn(
                "grid gap-4 transition-all duration-500",
                // Perfect Fit: High-density landscape grid
                isLandscape && !isDesktop ? "grid-cols-2 lg:grid-cols-3 gap-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            )}>
                {filteredDevices.map(device => (
                    <GlassCard
                        size="md"
                        key={device.id}
                        onClick={() => handleDeviceClick(device)}
                        className={`transition-all cursor-pointer ${selectionMode && selectedDevices.has(device.id)
                            ? 'ring-2 ring-primary bg-primary/5'
                            : 'hover:border-primary/50'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="h-10 w-10 lg:h-12 lg:w-12 glass-system-micro flex items-center justify-center border-white/10 shadow-lg">
                                {selectionMode ? (
                                    selectedDevices.has(device.id) ? (
                                        <CheckSquare className="h-5 w-5 text-primary" />
                                    ) : (
                                        <Square className="h-5 w-5 text-muted-foreground" />
                                    )
                                ) : (
                                    <Smartphone className="h-5 w-5 lg:h-6 lg:w-6 text-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                                )}
                            </div>
                            {isAdmin && !selectionMode && (
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingDeviceId(device.id)
                                            setNewDevice({
                                                name: device.name,
                                                location_name: device.location_name || '',
                                                latitude: String(device.latitude),
                                                longitude: String(device.longitude),
                                                sim_number: device.sim_number || '',
                                                node_number: device.node_number || '',
                                                thingspeak_channel_id: device.thingspeak_channel_id || '',
                                                thingspeak_read_key: device.thingspeak_read_key || '',
                                                tds_field: device.tds_field_number || 1,
                                                temp_field: device.temperature_field_number || 2,
                                                voltage_field: device.voltage_field_number || 3,
                                                safe_tds_min: String(device.safe_tds_min || 35),
                                                safe_tds_max: String(device.safe_tds_max || 175)
                                            })
                                            window.scrollTo({ top: 0, behavior: 'smooth' })
                                        }}
                                        className="p-2 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                                        title="Edit Device"
                                    >
                                        <Plus className="h-4 w-4 rotate-45" /> {/* Using Plus rotated for edit or just another icon */}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDelete(device.id)
                                        }}
                                        className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
                                        title="Delete Device"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <h3 className="text-lg lg:text-xl font-bold text-foreground mb-1 truncate">{device.location_name || device.name}</h3>
                        <div className="space-y-3 mt-auto">
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                <div className="flex gap-2 lg:gap-4 truncate">
                                    <span>Lat: {device.latitude?.toFixed(2)}</span>
                                    <span>Lng: {device.longitude?.toFixed(2)}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase border flex-shrink-0 ${
                                    (device.status === 'maintenance' ? 'maintenance' : getConnectivityStatus(device.last_reading_at || device.last_seen_at)) === 'online' 
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    (device.status === 'maintenance' ? 'maintenance' : getConnectivityStatus(device.last_reading_at || device.last_seen_at)) === 'maintenance' 
                                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                    'bg-muted text-muted-foreground border-muted-foreground/20'
                                }`}>
                                    {device.status === 'maintenance' ? 'maintenance' : getConnectivityStatus(device.last_reading_at || device.last_seen_at)}
                                </span>
                            </div>
                        </div>
                    </GlassCard>
                ))}

                {filteredDevices.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        {searchQuery || statusFilter !== 'all'
                            ? 'No devices match your filters'
                            : 'No devices found. Add your first device above.'}
                    </div>
                )}
            </div>

            {/* Device Detail Modal REMOVED - using Global Inspector */}

            {/* QR Code Generator Modal */}
            <QRCodeGenerator
                deviceData={newDevice}
                isOpen={showQRGenerator}
                onClose={() => setShowQRGenerator(false)}
            />

            {/* QR Code Scanner Modal */}
            <QRCodeScanner
                isOpen={showQRScanner}
                onClose={() => setShowQRScanner(false)}
                onScan={(data) => {
                    setNewDevice({
                        name: data.name,
                        location_name: data.location_name,
                        latitude: String(data.latitude),
                        longitude: String(data.longitude),
                        sim_number: data.sim_number,
                        node_number: data.node_number,
                        thingspeak_channel_id: data.thingspeak_channel_id || '',
                        thingspeak_read_key: data.thingspeak_read_key,
                        tds_field: data.tds_field || 1,
                        temp_field: data.temp_field || 2,
                        voltage_field: data.voltage_field || 3,
                        safe_tds_min: String(data.safe_tds_min || 35),
                        safe_tds_max: String(data.safe_tds_max || 175)
                    })
                }}
            />
        </div>
    )
}
