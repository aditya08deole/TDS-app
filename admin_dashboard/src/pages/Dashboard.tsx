import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Device, SensorData, Alert } from '../lib/supabase'
import {
    Activity, Thermometer,
    CheckCircle, AlertTriangle, XCircle, Clock,
    Plus, Trash2, X
} from 'lucide-react'
import {
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts'


// Status colors
const STATUS_COLORS = {
    online: '#30D158',
    warning: '#FF9F0A',
    critical: '#FF453A',
    offline: '#8E8E93'
}

export default function Dashboard() {
    const [devices, setDevices] = useState<Device[]>([])
    const [sensorData, setSensorData] = useState<Record<string, SensorData[]>>({})
    const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
    const [selectedLocation, setSelectedLocation] = useState<string>('')
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
    const [showAddModal, setShowAddModal] = useState(false)
    const [_loading, setLoading] = useState(true)

    // Device stats
    const stats = useMemo(() => {
        const result = { online: 0, warning: 0, critical: 0, offline: 0 }
        devices.forEach(d => {
            const status = d.status?.toLowerCase() || 'offline'
            if (status === 'online') result.online++
            else if (status === 'warning' || status === 'degraded') result.warning++
            else if (status === 'critical') result.critical++
            else result.offline++
        })
        return result
    }, [devices])

    // Pie chart data
    const pieData = [
        { name: 'Online', value: stats.online, color: STATUS_COLORS.online },
        { name: 'Warning', value: stats.warning, color: STATUS_COLORS.warning },
        { name: 'Critical', value: stats.critical, color: STATUS_COLORS.critical },
        { name: 'Offline', value: stats.offline, color: STATUS_COLORS.offline },
    ].filter(d => d.value > 0)

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)

            // Fetch devices
            const { data: devicesData } = await supabase
                .from('devices')
                .select('*')
                .order('name')

            if (devicesData) {
                setDevices(devicesData)
                if (devicesData.length > 0 && !selectedLocation) {
                    setSelectedLocation(devicesData[0].id)
                }

                // Fetch sensor data for each device
                const sensorPromises = devicesData.map(async (device) => {
                    const { data } = await supabase
                        .from('sensor_data')
                        .select('*')
                        .eq('device_id', device.id)
                        .order('recorded_at', { ascending: false })
                        .limit(50)
                    return { deviceId: device.id, data: data?.reverse() || [] }
                })

                const sensorResults = await Promise.all(sensorPromises)
                const sensorMap: Record<string, SensorData[]> = {}
                sensorResults.forEach(r => {
                    sensorMap[r.deviceId] = r.data
                })
                setSensorData(sensorMap)
            }

            // Fetch recent alerts
            const { data: alertsData } = await supabase
                .from('alerts')
                .select('*, devices(name)')
                .order('created_at', { ascending: false })
                .limit(5)

            if (alertsData) setRecentAlerts(alertsData)

            setLoading(false)
        }

        fetchData()

        // Real-time subscriptions
        const deviceSub = supabase
            .channel('dashboard_devices')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
                fetchData()
            })
            .subscribe()

        const sensorSub = supabase
            .channel('dashboard_sensor')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            deviceSub.unsubscribe()
            sensorSub.unsubscribe()
        }
    }, [])

    // Get latest reading for a device
    const getLatestReading = (deviceId: string) => {
        const readings = sensorData[deviceId]
        return readings?.[readings.length - 1]
    }

    // Add device
    const handleAddDevice = async (name: string, location: string) => {
        const { error } = await supabase.from('devices').insert({
            name,
            location,
            status: 'offline',
            latitude: 0,
            longitude: 0,
            api_key: crypto.randomUUID()
        })
        if (!error) setShowAddModal(false)
    }

    // Delete device
    const handleDeleteDevice = async (deviceId: string) => {
        if (!confirm('Delete this device? This will also delete all its sensor data.')) return
        await supabase.from('sensor_data').delete().eq('device_id', deviceId)
        await supabase.from('devices').delete().eq('id', deviceId)
    }

    // Time ago helper
    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) return `${mins}m ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h ago`
        return `${Math.floor(hours / 24)}d ago`
    }

    // Selected device chart data
    const selectedChartData = sensorData[selectedLocation] || []

    return (
        <div className="space-y-4">
            {/* Page Title */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-full text-sm font-medium"
                >
                    <Plus className="h-4 w-4" />
                    Add Device
                </button>
            </div>

            {/* Status Row */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {[
                    { label: 'Online', value: stats.online, color: 'bg-[#30D158]', icon: CheckCircle },
                    { label: 'Warning', value: stats.warning, color: 'bg-[#FF9F0A]', icon: AlertTriangle },
                    { label: 'Critical', value: stats.critical, color: 'bg-[#FF453A]', icon: XCircle },
                    { label: 'Offline', value: stats.offline, color: 'bg-[#8E8E93]', icon: Clock },
                ].map(item => (
                    <div
                        key={item.label}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${item.color}/20 whitespace-nowrap`}
                    >
                        <item.icon className={`h-3.5 w-3.5 ${item.color.replace('bg-', 'text-')}`} />
                        <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                        <span className={`text-sm font-bold ${item.color.replace('bg-', 'text-')}`}>{item.value}</span>
                    </div>
                ))}
            </div>

            {/* Current Readings */}
            <div>
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Current Readings</h2>
                <div className="bento-grid">
                    {devices.slice(0, 4).map(device => {
                        const reading = getLatestReading(device.id)
                        const data = sensorData[device.id] || []
                        const statusColor = device.status === 'online' ? '#30D158' :
                            device.status === 'warning' ? '#FF9F0A' : '#FF453A'

                        return (
                            <div key={device.id} className="ios-card relative group">
                                {/* Delete button */}
                                <button
                                    onClick={() => handleDeleteDevice(device.id)}
                                    className="absolute top-2 right-2 p-1.5 rounded-full bg-[var(--danger)]/20 text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>

                                <div className="flex items-center gap-2 mb-2">
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: statusColor }}
                                    />
                                    <span className="text-xs text-[var(--text-secondary)] truncate">
                                        {device.name || device.location}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="stat-value-md text-cyan-400">
                                        {reading?.tds ?? '--'}
                                    </span>
                                    <span className="text-sm text-[var(--text-secondary)]">ppm</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1 text-xs text-[var(--text-tertiary)]">
                                    <Thermometer className="h-3 w-3" />
                                    {reading?.temperature ?? '--'}°C
                                </div>
                                {/* Mini sparkline */}
                                {data.length > 0 && (
                                    <div className="h-8 mt-2 -mx-2">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={data.slice(-10)}>
                                                <defs>
                                                    <linearGradient id={`spark-${device.id}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                                                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <Area
                                                    type="monotone"
                                                    dataKey="tds"
                                                    stroke="#22d3ee"
                                                    strokeWidth={1.5}
                                                    fill={`url(#spark-${device.id})`}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* TDS Trend Chart */}
            <div className="ios-card">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-cyan-400" />
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">TDS Trend</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Location selector */}
                        <select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            className="bg-[var(--card)] text-[var(--text-primary)] text-xs rounded-lg px-2 py-1 border-none outline-none"
                        >
                            {devices.map(d => (
                                <option key={d.id} value={d.id}>{d.name || d.location}</option>
                            ))}
                        </select>
                        {/* Time range */}
                        <div className="flex bg-[var(--bg-secondary)] rounded-lg p-0.5">
                            {(['24h', '7d', '30d'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${timeRange === range
                                        ? 'bg-[var(--accent)] text-white'
                                        : 'text-[var(--text-secondary)]'
                                        }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="h-[200px] lg:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedChartData}>
                            <defs>
                                <linearGradient id="colorTds" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
                                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
                            <XAxis
                                dataKey="recorded_at"
                                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                                tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--card)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: 'var(--card-shadow)'
                                }}
                                labelFormatter={(label) => new Date(label).toLocaleString()}
                            />
                            <Area
                                type="monotone"
                                dataKey="tds"
                                stroke="#22d3ee"
                                strokeWidth={2}
                                fill="url(#colorTds)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Status Distribution & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Status Distribution */}
                <div className="ios-card">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Status Distribution</h3>
                    <div className="flex items-center gap-4">
                        <div className="w-32 h-32">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={50}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={index} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2">
                            {pieData.map(item => (
                                <div key={item.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs text-[var(--text-secondary)]">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="ios-card">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                        {recentAlerts.length > 0 ? recentAlerts.slice(0, 4).map(alert => (
                            <div key={alert.id} className="flex items-start gap-3">
                                <span
                                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                                    style={{
                                        backgroundColor: alert.severity === 'critical' ? '#FF453A' :
                                            alert.severity === 'warning' ? '#FF9F0A' : '#0A84FF'
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-[var(--text-primary)] truncate">
                                        {alert.devices?.name}
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)]">
                                        {alert.message?.slice(0, 40)}...
                                    </p>
                                </div>
                                <span className="text-xs text-[var(--text-tertiary)]">
                                    {getTimeAgo(alert.created_at)}
                                </span>
                            </div>
                        )) : (
                            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                                No recent activity
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Device Modal */}
            {showAddModal && (
                <AddDeviceModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddDevice}
                />
            )}
        </div>
    )
}

// Add Device Modal Component
function AddDeviceModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, location: string) => void }) {
    const [name, setName] = useState('')
    const [location, setLocation] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name && location) {
            onAdd(name, location)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md ios-card animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Add New Device</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--card-hover)]">
                        <X className="h-5 w-5 text-[var(--text-secondary)]" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">Device Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., NodeMCU-01"
                            className="w-full px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-secondary)] mb-2">Location</label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., Himalaya Mess"
                            className="w-full px-4 py-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-[var(--accent)] text-white font-semibold rounded-xl"
                    >
                        Add Device
                    </button>
                </form>
            </div>
        </div>
    )
}
