import { useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { type Device } from '../types'
import ConfidenceRing from './ConfidenceRing'

interface DeviceTableProps {
    devices: Device[]
    loading?: boolean
    onDeviceClick?: (device: Device) => void
}

type SortKey = keyof Device | 'tds' | 'temperature'
type SortDirection = 'asc' | 'desc'

export default function DeviceTable({ devices, loading, onDeviceClick }: DeviceTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [sortKey, setSortKey] = useState<SortKey>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
    const [renderNow] = useState(() => Date.now())

    // Handle Selection
    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const newSelected = new Set(selectedIds)
        if (newSelected.has(id)) {
            newSelected.delete(id)
        } else {
            newSelected.add(id)
        }
        setSelectedIds(newSelected)
    }

    const toggleAll = () => {
        if (selectedIds.size === devices.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(devices.map(d => d.id)))
        }
    }

    // Handle Sorting
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortKey(key)
            setSortDirection('asc')
        }
    }

    // Sort Logic
    const sortedDevices = [...devices].sort((a, b) => {
        const valA = a[sortKey as keyof Device]
        const valB = b[sortKey as keyof Device]

        // Mock data handling for TDS/Temp since they aren't on Device object strictly in our current mock flow (they are in sensorData)
        // For now we will sort by the fields present on Device

        if (valA === valB) return 0

        const comparison = valA! > valB! ? 1 : -1
        return sortDirection === 'asc' ? comparison : -comparison
    })

    if (loading) return <div className="p-8 text-center text-slate-500">Loading devices...</div>

    return (
        <div className="glass-card rounded-xl overflow-hidden flex flex-col h-full">
            {/* Table Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white tracking-tight">Registered Devices</h3>
                    <p className="text-xs text-[#86868b]">{devices.length} nodes active</p>
                </div>
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 animate-fade-in">
                        <span className="text-xs text-[#86868b] font-medium">{selectedIds.size} selected</span>
                        <button className="text-red-400 text-xs hover:text-red-300 font-medium transition-colors px-2 py-1 rounded-md hover:bg-white/5">
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white/5 backdrop-blur-2xl z-20">
                        <tr className="text-xs text-[#6e6e73] font-medium border-b border-white/5 uppercase tracking-wider">
                            <th className="p-4 pl-6 w-12">
                                <button
                                    onClick={toggleAll}
                                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${selectedIds.size === devices.length && devices.length > 0
                                        ? 'bg-blue-500 border-blue-500 text-white'
                                        : 'border-[#6e6e73] hover:border-white'
                                        }`}
                                >
                                    {selectedIds.size === devices.length && devices.length > 0 && <Check className="w-3 h-3" strokeWidth={3} />}
                                </button>
                            </th>
                            <th onClick={() => handleSort('name')} className="p-4 cursor-pointer hover:text-white transition-colors group">
                                <div className="flex items-center gap-1">
                                    Device Name
                                    {sortKey === 'name' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                </div>
                            </th>
                            <th onClick={() => handleSort('location_name')} className="p-4 cursor-pointer hover:text-white transition-colors">
                                Location Name
                            </th>
                            <th className="p-4 text-right">TDS (ppm)</th>
                            <th className="p-4 text-right">Temp (°C)</th>
                            <th className="p-4 text-center">Confidence</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-right pr-6">Last Seen</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-slate-300">
                        {sortedDevices.map((device) => {
                            const isSelected = selectedIds.has(device.id)
                            return (
                                <tr
                                    key={device.id}
                                    onClick={() => onDeviceClick?.(device)}
                                    className={`
                                        border-b border-white/5 transition-all cursor-pointer group relative
                                        ${isSelected ? 'bg-blue-500/10' : 'hover:bg-white/5'}
                                    `}
                                >
                                    <td className="p-4 pl-6 relative z-10" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={(e) => toggleSelection(device.id, e)}
                                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected
                                                ? 'bg-blue-500 border-blue-500 text-white'
                                                : 'border-[#6e6e73] group-hover:border-slate-400'
                                                }`}
                                        >
                                            {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                                        </button>
                                    </td>
                                    <td className="p-4 font-medium text-white group-hover:text-cyan-400 transition-colors">
                                        {device.location_name || device.name}
                                    </td>
                                    <td className="p-4 text-[#86868b]">{device.location_name}</td>
                                    <td className="p-4 text-right font-mono text-white">
                                        {/* Real TDS from device props */}
                                        {(device as any).latest_tds?.toFixed(0) || '--'}
                                    </td>
                                    <td className="p-4 text-right font-mono text-[#86868b]">
                                        {(device as any).latest_temp?.toFixed(1) || '--'}
                                    </td>
                                    <td className="p-4 flex justify-center">
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <ConfidenceRing score={device.confidence_score ?? 100} size={32} status={device.status} />
                                        </div>
                                    </td>
                                    <td className="p-4 flex justify-center">
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <ConfidenceRing score={device.confidence_score ?? 100} size={32} status={device.status} />
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-white/5 ${device.status === 'online' ? 'bg-green-500/10 text-green-400' :
                                            device.status === 'warning' ? 'bg-orange-500/10 text-orange-400' :
                                                device.status === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'
                                            }`}>
                                            <span className={`w-1 h-1 rounded-full ${device.status === 'online' ? 'bg-green-400' :
                                                device.status === 'warning' ? 'bg-orange-400' :
                                                    device.status === 'critical' ? 'bg-red-400' : 'bg-slate-400'
                                                }`} />
                                            {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right pr-6 text-[#6e6e73] text-xs font-mono">
                                        {new Date(device.last_seen_at || renderNow).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div >
    )
}
