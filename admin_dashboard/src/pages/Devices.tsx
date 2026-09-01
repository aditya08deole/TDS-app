import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type Device } from '../types'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { AddDeviceModal } from '../components/AddDeviceModal'
import { QRCodeGenerator } from '../components/QRCodeGenerator'
import { QRCodeScanner } from '../components/QRCodeScanner'
import { GlassCard } from '../components/GlassCard'
import {
    useDevices,
    useAddDevice,
    useDeleteDevice,
    useUpdateDevice,
    useDeviceSubscription
} from '../hooks/useDeviceQueries'
import { useAllDevicesThingSpeakData } from '../hooks/useThingSpeakQueries'
import { triggerSync } from '../lib/api'
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
    Plus,
    Pencil,
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
    LayoutGrid,
    List,
    ChevronLeft,
    ChevronRight,
    Building2
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
    const { mutateAsync: addDevice } = useAddDevice()
    const { mutate: deleteDevice } = useDeleteDevice()
    const { mutateAsync: updateDevice } = useUpdateDevice()
    
    // Realtime subscription
    useDeviceSubscription()

    // Enrich with ThingSpeak data for real-time status
    const { devices: enrichedDevices } = useAllDevicesThingSpeakData(devices)

    // Add/Edit Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingDevice, setEditingDevice] = useState<Device | null>(null)

    const [showQRGenerator, setShowQRGenerator] = useState(false)
    const [showQRScanner, setShowQRScanner] = useState(false)

    // Search, Filter, ViewMode & Pagination State
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [locationFilter, setLocationFilter] = useState<string>('all')
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
    const [currentPage, setCurrentPage] = useState(1)
    const pageSize = 12

    // Selection State (for bulk operations)
    const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
    const [selectionMode, setSelectionMode] = useState(false)

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

    // Unique deployment locations for filter dropdown
    const uniqueLocations = useMemo(() => {
        const locs = enrichedDevices
            .map(d => d.location_name?.trim())
            .filter((loc): loc is string => Boolean(loc && loc.length > 0))
        return Array.from(new Set(locs))
    }, [enrichedDevices])

    // Filtered devices (Search + Status + Location)
    const filteredDevices = useMemo(() => {
        return enrichedDevices.filter(device => {
            const matchesSearch = searchQuery === '' ||
                device.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                device.location_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                device.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (device.thingspeak_channel_id?.toString() || '').includes(searchQuery)

            const deviceStatus = device.status === 'maintenance' 
                ? 'maintenance' 
                : getConnectivityStatus(device.last_reading_at || device.last_seen_at)
            
            const matchesStatus = statusFilter === 'all' || deviceStatus === statusFilter
            const matchesLocation = locationFilter === 'all' || device.location_name === locationFilter

            return matchesSearch && matchesStatus && matchesLocation
        })
    }, [enrichedDevices, searchQuery, statusFilter, locationFilter])

    // Reset to page 1 on filter/search change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, statusFilter, locationFilter])

    // Paginated Devices for 50-device scale
    const totalPages = Math.ceil(filteredDevices.length / pageSize) || 1
    const paginatedDevices = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filteredDevices.slice(start, start + pageSize)
    }, [filteredDevices, currentPage, pageSize])

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



    const handleDelete = (id: string) => {
        if (!isAdmin) return;
        if (!confirm('Are you sure you want to delete this device?')) return
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
        if (!isAdmin) return;
        if (selectedDevices.size === 0) return
        if (!confirm(`Delete ${selectedDevices.size} devices?`)) return

        selectedDevices.forEach(id => deleteDevice(id))

        setSelectedDevices(new Set())
        setSelectionMode(false)
    }

    const handleBulkMaintenanceMode = () => {
        if (!isAdmin) return;
        if (selectedDevices.size === 0) return

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
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">EvaraTDS Devices</h1>
                    <p className="text-muted-foreground mt-0.5 text-[10px] lg:text-sm font-medium">
                        Showing {paginatedDevices.length} of {filteredDevices.length} deployed nodes (Total: {devices.length})
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center p-1 rounded-xl bg-secondary/50 border border-border/40">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-cyan-500 text-black shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Grid Card View"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-cyan-500 text-black shadow-sm font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Compact Table View"
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>

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
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 border border-blue-500/30"
                        title="Sync devices from Firebase"
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
                                onClick={() => {
                                    setEditingDevice(null)
                                    setIsAddModalOpen(true)
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-xs font-bold bg-cyan-500 hover:bg-cyan-600 text-black shadow-lg shadow-cyan-500/20 active:scale-95"
                            >
                                <Plus className="h-4 w-4" />
                                Provision Device
                            </button>
                            <button
                                onClick={() => {
                                    setSelectionMode(!selectionMode)
                                    setSelectedDevices(new Set())
                                }}
                                className={`p-2 rounded-xl transition-colors ${selectionMode
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

            {/* Search, Status & Location Filter Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search Box */}
                <div className="relative md:col-span-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by device name, location, node #, channel ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-secondary/60 border border-border/40 rounded-xl pl-10 pr-8 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-cyan-500 outline-none"
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

                {/* Location Filter Dropdown */}
                {uniqueLocations.length > 0 && (
                    <div className="relative md:col-span-3">
                        <select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="w-full bg-secondary/60 border border-border/40 rounded-xl px-3 py-2 text-xs font-semibold text-foreground outline-none cursor-pointer"
                        >
                            <option value="all">📍 All Locations ({uniqueLocations.length} Sites)</option>
                            {uniqueLocations.map(loc => (
                                <option key={loc} value={loc}>📍 {loc}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Status Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:col-span-3 justify-end">
                    <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {statusFilters.map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${statusFilter === filter.value
                                ? `${filter.color} text-white`
                                : 'bg-secondary/60 text-muted-foreground hover:bg-accent'
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${filter.color}`} />
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {isAdmin && selectionMode && selectedDevices.size > 0 && (
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

            {/* Device Rendering: Grid View vs Compact Table View */}
            {viewMode === 'grid' ? (
                <div className={cn(
                    "grid gap-4 transition-all duration-500",
                    isLandscape && !isDesktop ? "grid-cols-2 lg:grid-cols-3 gap-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                )}>
                    {paginatedDevices.map(device => (
                        <GlassCard
                            size="md"
                            key={device.id}
                            onClick={() => handleDeviceClick(device)}
                            className={`transition-all cursor-pointer ${selectionMode && selectedDevices.has(device.id)
                                ? 'ring-2 ring-cyan-500 bg-cyan-500/5'
                                : 'hover:border-cyan-500/50'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="h-10 w-10 lg:h-12 lg:w-12 glass-system-micro flex items-center justify-center border-white/10 shadow-lg rounded-2xl">
                                    {selectionMode ? (
                                        selectedDevices.has(device.id) ? (
                                            <CheckSquare className="h-5 w-5 text-cyan-400" />
                                        ) : (
                                            <Square className="h-5 w-5 text-muted-foreground" />
                                        )
                                    ) : (
                                        <Smartphone className="h-5 w-5 lg:h-6 lg:w-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]" />
                                    )}
                                </div>
                                {!selectionMode && isAdmin && (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingDevice(device)
                                                setIsAddModalOpen(true)
                                            }}
                                            className="p-2 hover:bg-cyan-500/10 rounded-xl text-muted-foreground hover:text-cyan-400 transition-colors"
                                            title="Edit Device"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDelete(device.id)
                                            }}
                                            className="p-2 hover:bg-red-500/10 rounded-xl text-muted-foreground hover:text-red-400 transition-colors"
                                            title="Delete Device"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-base lg:text-lg font-bold text-foreground mb-0.5 truncate">{device.name}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3 truncate">
                                <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span>{device.location_name || 'Deployment Location'}</span>
                            </p>

                            <div className="space-y-3 mt-auto pt-2 border-t border-border/30">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-medium">Node: {device.node_number || 'N/A'}</span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                        (device.status === 'maintenance' ? 'maintenance' : getConnectivityStatus(device.last_reading_at || device.last_seen_at)) === 'online' 
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                                        (device.status === 'maintenance' ? 'maintenance' : getConnectivityStatus(device.last_reading_at || device.last_seen_at)) === 'maintenance' 
                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                        'bg-secondary text-muted-foreground border-border/40'
                                    }`}>
                                        {device.status === 'maintenance' ? 'maintenance' : getConnectivityStatus(device.last_reading_at || device.last_seen_at)}
                                    </span>
                                </div>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            ) : (
                /* Compact Table View */
                <div className="overflow-x-auto rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/40 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <th className="p-3 pl-4">Device Name</th>
                                <th className="p-3">Location</th>
                                <th className="p-3">Node #</th>
                                <th className="p-3">Channel ID</th>
                                <th className="p-3">Latest TDS</th>
                                <th className="p-3">Status</th>
                                {isAdmin && <th className="p-3 text-right pr-4">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 text-xs">
                            {paginatedDevices.map(device => {
                                const conn = getConnectivityStatus(device.last_reading_at || device.last_seen_at)
                                return (
                                    <tr
                                        key={device.id}
                                        onClick={() => handleDeviceClick(device)}
                                        className="hover:bg-secondary/40 transition-colors cursor-pointer"
                                    >
                                        <td className="p-3 pl-4 font-bold text-foreground">{device.name}</td>
                                        <td className="p-3 text-muted-foreground">{device.location_name || '—'}</td>
                                        <td className="p-3 font-mono text-muted-foreground">{device.node_number || '—'}</td>
                                        <td className="p-3 font-mono text-muted-foreground">{device.thingspeak_channel_id || '—'}</td>
                                        <td className="p-3 font-mono font-bold text-cyan-400">
                                            {device.latest_tds != null ? `${device.latest_tds} PPM` : '—'}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                                conn === 'online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-secondary text-muted-foreground border-border/40'
                                            }`}>
                                                {conn}
                                            </span>
                                        </td>
                                        {isAdmin && (
                                            <td className="p-3 text-right pr-4">
                                                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={() => { setEditingDevice(device); setIsAddModalOpen(true) }}
                                                        className="p-1.5 hover:bg-cyan-500/10 rounded-lg text-muted-foreground hover:text-cyan-400"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(device.id)}
                                                        className="p-1.5 hover:bg-rose-500/10 rounded-lg text-muted-foreground hover:text-rose-400"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {filteredDevices.length === 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground bg-card/20 rounded-3xl border border-border/30">
                    <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30 text-cyan-400" />
                    <p className="text-sm font-bold text-foreground">No EvaraTDS devices found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {searchQuery || statusFilter !== 'all' || locationFilter !== 'all'
                            ? 'Try clearing your search or status/location filters'
                            : 'Click "Provision Device" to add your first EvaraTDS device.'}
                    </p>
                </div>
            )}

            {/* Pagination Controls for 50-Device Scale */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/30 text-xs font-semibold">
                    <span className="text-muted-foreground">
                        Page {currentPage} of {totalPages} ({filteredDevices.length} Total Devices)
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            className="p-2 rounded-xl bg-secondary hover:bg-accent disabled:opacity-40 transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 rounded-xl font-bold transition-all ${
                                    currentPage === page
                                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                                        : 'bg-secondary/60 text-muted-foreground hover:bg-accent'
                                }`}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            className="p-2 rounded-xl bg-secondary hover:bg-accent disabled:opacity-40 transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* 3-Step Device Provisioning & Edit Wizard Modal */}
            <AddDeviceModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false)
                    setEditingDevice(null)
                }}
                onSubmit={async (deviceData) => {
                    if (editingDevice) {
                        await updateDevice({ id: editingDevice.id, updates: deviceData })
                    } else {
                        await addDevice(deviceData)
                    }
                }}
                initialData={editingDevice}
                isEditing={!!editingDevice}
            />

            {/* QR Code Generator Modal */}
            <QRCodeGenerator
                deviceData={{
                    name: editingDevice?.name || 'EvaraTDS Device',
                    location_name: editingDevice?.location_name || '',
                    latitude: String(editingDevice?.latitude || 17.4455),
                    longitude: String(editingDevice?.longitude || 78.3489),
                    sim_number: editingDevice?.sim_number || '',
                    node_number: editingDevice?.node_number || '',
                    thingspeak_channel_id: editingDevice?.thingspeak_channel_id || '',
                    thingspeak_read_key: editingDevice?.thingspeak_read_key || '',
                    tds_field: editingDevice?.tds_field_number || 1,
                    temp_field: editingDevice?.temperature_field_number || 2,
                    voltage_field: editingDevice?.voltage_field_number || 3,
                    safe_tds_min: String(editingDevice?.safe_tds_min || 35),
                    safe_tds_max: String(editingDevice?.safe_tds_max || 175),
                }}
                isOpen={showQRGenerator}
                onClose={() => setShowQRGenerator(false)}
            />

            {/* QR Code Scanner Modal */}
            <QRCodeScanner
                isOpen={showQRScanner}
                onClose={() => setShowQRScanner(false)}
                onScan={() => {
                    setIsAddModalOpen(true)
                }}
            />
        </div>
    )
}
