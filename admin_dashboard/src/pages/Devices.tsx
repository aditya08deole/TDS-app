import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Device } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { QRCodeGenerator } from '../components/QRCodeGenerator'
import { QRCodeScanner } from '../components/QRCodeScanner'
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

type StatusFilter = 'all' | 'online' | 'offline' | 'maintenance'

export default function Devices() {
    const { isAdmin } = useAuth()
    const { isMobile, openInspector } = useUI()
    const [devices, setDevices] = useState<Device[]>([])
    const [newDevice, setNewDevice] = useState({
        name: '',
        location_name: '',
        latitude: '',
        longitude: '',
        sim_number: '',
        node_number: '',
        thingspeak_read_key: ''
    })
    const [loading, setLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [showQRGenerator, setShowQRGenerator] = useState(false)
    const [showQRScanner, setShowQRScanner] = useState(false)

    // Search and Filter State
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

    // Selection State (for bulk operations)
    const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
    const [selectionMode, setSelectionMode] = useState(false)

    // Modal State - REMOVED for Phase 5 Global Inspector
    // const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
    // const [isModalOpen, setIsModalOpen] = useState(false)

    const refreshDevices = useCallback(async () => {
        setRefreshing(true)
        const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false })
        if (data) setDevices(data)
        setRefreshing(false)
    }, [])

    // Pull to Refresh hook
    const { handlers, PullIndicator } = usePullToRefresh({
        onRefresh: refreshDevices,
        disabled: !isMobile
    })

    useEffect(() => {
        refreshDevices()

        // Subscribe to device changes
        const subscription = supabase
            .channel('devices_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
                refreshDevices()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [refreshDevices])

    // Filtered devices
    const filteredDevices = useMemo(() => {
        return devices.filter(device => {
            // Search filter
            const matchesSearch = searchQuery === '' ||
                device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                device.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (device.thingspeak_channel_id?.toString() || '').includes(searchQuery)

            // Status filter
            const deviceStatus = device.status?.toLowerCase() || 'offline'
            const matchesStatus = statusFilter === 'all' || deviceStatus === statusFilter

            return matchesSearch && matchesStatus
        })
    }, [devices, searchQuery, statusFilter])

    const handleAddDevice = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAdmin) return
        setLoading(true)

        const channelId = Math.floor(Math.random() * 1000000) // This will be replaced with real ThingSpeak ID

        const { error } = await supabase.from('devices').insert([{
            name: newDevice.name,
            location_name: newDevice.location_name,
            latitude: parseFloat(newDevice.latitude),
            longitude: parseFloat(newDevice.longitude),
            sim_number: newDevice.sim_number,
            node_number: newDevice.node_number,
            thingspeak_read_key: newDevice.thingspeak_read_key,
            thingspeak_channel_id: channelId,
            status: 'offline'
        }])

        if (!error) {
            setNewDevice({
                name: '',
                location_name: '',
                latitude: '',
                longitude: '',
                sim_number: '',
                node_number: '',
                thingspeak_read_key: ''
            })
            refreshDevices()
        } else {
            alert('Error adding device: ' + error.message)
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!isAdmin || !confirm('Are you sure you want to delete this device?')) return
        await supabase.from('devices').delete().eq('id', id)
        refreshDevices()
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

    const handleBulkDelete = async () => {
        if (!isAdmin || selectedDevices.size === 0) return
        if (!confirm(`Delete ${selectedDevices.size} devices?`)) return

        for (const id of selectedDevices) {
            await supabase.from('devices').delete().eq('id', id)
        }

        setSelectedDevices(new Set())
        setSelectionMode(false)
        refreshDevices()
    }

    const handleBulkMaintenanceMode = async () => {
        if (!isAdmin || selectedDevices.size === 0) return

        for (const id of selectedDevices) {
            await supabase.from('devices').update({ status: 'maintenance' }).eq('id', id)
        }

        refreshDevices()
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
                    <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">Devices</h1>
                    <p className="text-slate-400 mt-1 text-sm lg:text-base">
                        {filteredDevices.length} of {devices.length} devices
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={refreshDevices}
                        disabled={refreshing}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
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
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search devices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-500 focus:border-cyan-500 outline-none"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <Filter className="h-4 w-4 text-slate-500 flex-shrink-0" />
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === filter.value
                                ? `${filter.color} text-white`
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 lg:p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <Plus className="h-5 w-5 text-blue-400" />
                            Add New Device
                        </h3>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowQRScanner(true)}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-medium rounded-lg transition-all text-sm"
                            >
                                <ScanLine className="h-4 w-4" />
                                Scan QR
                            </button>
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
                            <label className="text-sm text-slate-400 mb-1.5 block">Device Name *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.name}
                                onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-sm transition-all"
                                placeholder="e.g., NodeMCU-01"
                            />
                        </div>

                        {/* Location Name */}
                        <div>
                            <label className="text-sm text-slate-400 mb-1.5 block">Location Name *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.location_name}
                                onChange={e => setNewDevice({ ...newDevice, location_name: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-sm transition-all"
                                placeholder="e.g., Tank A - Block 3"
                            />
                        </div>

                        {/* Node Number */}
                        <div>
                            <label className="text-sm text-slate-400 mb-1.5 block">Node Number *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.node_number}
                                onChange={e => setNewDevice({ ...newDevice, node_number: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-sm transition-all"
                                placeholder="e.g., NODE-001"
                            />
                        </div>

                        {/* Latitude */}
                        <div>
                            <label className="text-sm text-slate-400 mb-1.5 block">Latitude *</label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={newDevice.latitude}
                                onChange={e => setNewDevice({ ...newDevice, latitude: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-sm transition-all"
                                placeholder="e.g., 20.5937"
                            />
                        </div>

                        {/* Longitude */}
                        <div>
                            <label className="text-sm text-slate-400 mb-1.5 block">Longitude *</label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={newDevice.longitude}
                                onChange={e => setNewDevice({ ...newDevice, longitude: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-sm transition-all"
                                placeholder="e.g., 78.9629"
                            />
                        </div>

                        {/* SIM Number */}
                        <div>
                            <label className="text-sm text-slate-400 mb-1.5 block">SIM Number *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.sim_number}
                                onChange={e => setNewDevice({ ...newDevice, sim_number: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-sm transition-all"
                                placeholder="e.g., +91-9876543210"
                            />
                        </div>

                        {/* ThingSpeak Read API Key */}
                        <div className="md:col-span-2">
                            <label className="text-sm text-slate-400 mb-1.5 block">ThingSpeak Read API Key *</label>
                            <input
                                type="text"
                                required
                                value={newDevice.thingspeak_read_key}
                                onChange={e => setNewDevice({ ...newDevice, thingspeak_read_key: e.target.value })}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-slate-200 font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none text-sm transition-all"
                                placeholder="e.g., XXXXXXXXXXXXXX"
                            />
                        </div>

                        {/* Submit Button */}
                        <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-500/20 text-sm"
                            >
                                {loading ? 'Adding Device...' : 'Add Device'}
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
                        className={`bg-slate-900 border rounded-xl p-4 lg:p-6 transition-all cursor-pointer ${selectionMode && selectedDevices.has(device.id)
                            ? 'border-cyan-500 bg-cyan-500/5'
                            : 'border-slate-800 hover:border-slate-700'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="h-10 w-10 lg:h-12 lg:w-12 bg-slate-800/50 rounded-xl flex items-center justify-center border border-slate-700">
                                {selectionMode ? (
                                    selectedDevices.has(device.id) ? (
                                        <CheckSquare className="h-5 w-5 text-cyan-400" />
                                    ) : (
                                        <Square className="h-5 w-5 text-slate-500" />
                                    )
                                ) : (
                                    <Smartphone className="h-5 w-5 lg:h-6 lg:w-6 text-cyan-400" />
                                )}
                            </div>
                            {isAdmin && !selectionMode && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDelete(device.id)
                                    }}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <h3 className="text-lg lg:text-xl font-bold text-slate-100 mb-1 truncate">{device.name}</h3>
                        <p className="text-slate-500 text-xs mb-3 truncate">CH: {device.thingspeak_channel_id || 'N/A'}</p>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                                <Key className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                <code className="font-mono text-xs truncate max-w-[150px]">{device.thingspeak_read_key || 'No Key'}</code>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <div className="flex gap-2 lg:gap-4 truncate">
                                    <span>Lat: {device.latitude?.toFixed(2)}</span>
                                    <span>Lng: {device.longitude?.toFixed(2)}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase border flex-shrink-0 ${device.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    device.status === 'maintenance' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                    }`}>
                                    {device.status || 'offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredDevices.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500">
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
                        latitude: data.latitude,
                        longitude: data.longitude,
                        sim_number: data.sim_number,
                        node_number: data.node_number,
                        thingspeak_read_key: data.thingspeak_read_key
                    })
                }}
            />
        </div>
    )
}
