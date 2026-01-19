import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { EnrichedDevice } from '@/lib/supabase'

interface CategorizedDeviceListProps {
    safeTDSDevices: EnrichedDevice[]
    criticalTDSDevices: EnrichedDevice[]
    onDeviceClick?: (deviceId: string) => void
}

/**
 * Categorized Device List Component
 * 
 * Features:
 * - Two collapsible sections (Safe TDS, Critical TDS)
 * - Online/offline badges for each device
 * - Device count in section headers
 * - Smooth expand/collapse animations
 * - Color-coded sections (green for safe, red for critical)
 */
export function CategorizedDeviceList({
    safeTDSDevices,
    criticalTDSDevices,
    onDeviceClick
}: CategorizedDeviceListProps) {
    const [safeTDSExpanded, setSafeTDSExpanded] = useState(true)
    const [criticalTDSExpanded, setCriticalTDSExpanded] = useState(true)

    return (
        <div className="space-y-3">
            {/* Safe TDS Section */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setSafeTDSExpanded(!safeTDSExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-colors duration-200"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#30d158]" />
                        <span className="text-sm font-medium text-white">Safe TDS Range</span>
                        <span className="text-xs text-white/50">({safeTDSDevices.length} devices)</span>
                    </div>
                    {safeTDSExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                    )}
                </button>

                {/* Device List */}
                <div
                    className={`transition-all duration-300 ease-in-out ${safeTDSExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                        } overflow-hidden`}
                >
                    <div className="px-2 pb-2 space-y-1">
                        {safeTDSDevices.length === 0 ? (
                            <div className="px-4 py-3 text-center text-sm text-white/40">
                                No devices in safe range
                            </div>
                        ) : (
                            safeTDSDevices.map((device) => (
                                <button
                                    key={device.id}
                                    onClick={() => onDeviceClick?.(device.id)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-[#30d158]/30 transition-all duration-200 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
                                        <span className="text-sm text-white/90 group-hover:text-white transition-colors">
                                            {device.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* TDS Value */}
                                        {device.latest_tds !== undefined && (
                                            <span className="text-xs text-[#30d158] font-medium">
                                                {device.latest_tds} ppm
                                            </span>
                                        )}
                                        {/* Connectivity Badge */}
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${device.connectivity_status === 'online'
                                                    ? 'bg-[#30d158]/20 text-[#30d158]'
                                                    : 'bg-[#8e8e93]/20 text-[#8e8e93]'
                                                }`}
                                        >
                                            {device.connectivity_status === 'online' ? '● Online' : '○ Offline'}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Critical TDS Section */}
            <div className="rounded-xl border border-[#ff453a]/20 bg-[#ff453a]/[0.03] overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setCriticalTDSExpanded(!criticalTDSExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#ff453a]/[0.06] transition-colors duration-200"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#ff453a]" />
                        <span className="text-sm font-medium text-white">Critical TDS Range</span>
                        <span className="text-xs text-white/50">({criticalTDSDevices.length} devices)</span>
                    </div>
                    {criticalTDSExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/50" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-white/50" />
                    )}
                </button>

                {/* Device List */}
                <div
                    className={`transition-all duration-300 ease-in-out ${criticalTDSExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                        } overflow-hidden`}
                >
                    <div className="px-2 pb-2 space-y-1">
                        {criticalTDSDevices.length === 0 ? (
                            <div className="px-4 py-3 text-center text-sm text-white/40">
                                No devices in critical range
                            </div>
                        ) : (
                            criticalTDSDevices.map((device) => (
                                <button
                                    key={device.id}
                                    onClick={() => onDeviceClick?.(device.id)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-[#ff453a]/[0.05] hover:bg-[#ff453a]/[0.10] border border-[#ff453a]/[0.15] hover:border-[#ff453a]/40 transition-all duration-200 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff453a] animate-pulse" />
                                        <span className="text-sm text-white/90 group-hover:text-white transition-colors">
                                            {device.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* TDS Value */}
                                        {device.latest_tds !== undefined && (
                                            <span className="text-xs text-[#ff453a] font-medium">
                                                {device.latest_tds} ppm
                                            </span>
                                        )}
                                        {/* Connectivity Badge */}
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${device.connectivity_status === 'online'
                                                    ? 'bg-[#30d158]/20 text-[#30d158]'
                                                    : 'bg-[#8e8e93]/20 text-[#8e8e93]'
                                                }`}
                                        >
                                            {device.connectivity_status === 'online' ? '● Online' : '○ Offline'}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
