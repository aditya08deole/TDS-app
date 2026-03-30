import { useState, useMemo } from 'react'
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
import { useAllDevicesThingSpeakData } from '../hooks/useThingSpeakQueries'
import {
    Plus,
    Trash2,
    Smartphone,
    Key,
    Search,
    Filter,
    CheckSquare,
    Square,
    Download,
    RefreshCw,
    X,
    QrCode,
    ScanLine
} from 'lucide-react'
import { getConnectivityStatus } from '../lib/constants'

type StatusFilter = 'all' | 'online' | 'offline' | 'maintenance'

export default function Devices() {
    const { isAdmin } = useAuth()
    const { isMobile, openInspector } = useUI()
    
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

    const handleAddDevice = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAdmin) return

        const devicePayload = {
            name: newDevice.name,
            location_name: newDevice.location_name,
            latitude: parseFloat(newDevice.latitude),
            longitude: parseFloat(newDevice.longitude),
            sim_number: newDevice.sim_number,
            node_number: newDevice.node_number,
            thingspeak_channel_id: newDevice.thingspeak_channel_id,
            thingspeak_read_key: newDevice.thingspeak_read_key,
            tds_field_number: newDevice.tds_field,
            temperature_field_number: newDevice.temp_field,
            voltage_field_number: newDevice.voltage_field,
            safe_tds_min: parseFloat(newDevice.safe_tds_min),
            safe_tds_max: parseFloat(newDevice.safe_tds_max),
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
            openInspector(device.id)
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
            className="space-y-6"
            {...handlers}
        >
            <PullIndicator />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Devices</h1>
                    <p className="text-muted-foreground mt-1 text-sm lg:text-base">
                        {filteredDevices.length} of {devices.length} devices
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
                        onClick={exportToCSV}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                        title="Export to CSV"
                    >
                        <Download className="h-5 w-5" />
                    </button>
                    {isAdmin && (
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
            {isAdmin && !selectionMode && (
                <div className="bg-secondary/30 border border-accent rounded-2xl p-4 lg:p-6 backdrop-blur-sm">
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
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground font-mono focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
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
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
                                placeholder="35"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1.5 block">Safe TDS Max (Default: 175)</label>
                            <input
                                type="number"
                                value={newDevice.safe_tds_max}
                                onChange={e => setNewDevice({ ...newDevice, safe_tds_max: e.target.value })}
                                className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
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
                                        className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
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
                                        className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
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
                                        className="w-full bg-background/50 border border-accent rounded-lg px-3 py-2.5 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none text-sm transition-all"
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
                                className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground font-medium rounded-lg transition-all shadow-lg shadow-primary/20 text-sm"
                            >
                                {editingDeviceId 
                                    ? (addingDevice ? 'Updating...' : 'Update Device') 
                                    : (addingDevice ? 'Adding...' : 'Add Device')
                                }
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Device Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {filteredDevices.map(device => (
                    <div
                        key={device.id}
                        onClick={() => handleDeviceClick(device)}
                        className={`bg-secondary/40 border rounded-xl p-4 lg:p-6 transition-all cursor-pointer ${selectionMode && selectedDevices.has(device.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-accent hover:border-border'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="h-10 w-10 lg:h-12 lg:w-12 bg-secondary/80 rounded-xl flex items-center justify-center border border-accent">
                                {selectionMode ? (
                                    selectedDevices.has(device.id) ? (
                                        <CheckSquare className="h-5 w-5 text-primary" />
                                    ) : (
                                        <Square className="h-5 w-5 text-muted-foreground" />
                                    )
                                ) : (
                                    <Smartphone className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
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
                        <p className="text-muted-foreground text-xs mb-3 truncate">CH: {device.thingspeak_channel_id || 'N/A'}</p>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 p-2 rounded-lg border border-accent/50">
                                <Key className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <code className="font-mono text-xs truncate max-w-[150px]">{device.thingspeak_read_key || 'No Key'}</code>
                            </div>
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
                    </div>
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
