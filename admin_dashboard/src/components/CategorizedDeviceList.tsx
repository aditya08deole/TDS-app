import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { EnrichedDevice } from '@/types'
import { getDeviceDisplayName } from '@/lib/constants'

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
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 dark:bg-green-500/[0.02] overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setSafeTDSExpanded(!safeTDSExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-500/10 dark:hover:bg-green-500/[0.04] transition-colors duration-200"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium text-foreground">Safe TDS Range</span>
                        <span className="text-xs text-muted-foreground">({safeTDSDevices.length} devices)</span>
                    </div>
                    {safeTDSExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>

                {/* Device List */}
                <div
                    className={`transition-all duration-300 ease-in-out ${safeTDSExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                        } overflow-hidden`}
                >
                    <div className="px-2 pb-2 space-y-1">
                        {safeTDSDevices.length === 0 ? (
                            <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                                No devices in safe range
                            </div>
                        ) : (
                            safeTDSDevices.map((device) => (
                                <button
                                    key={device.id}
                                    onClick={() => onDeviceClick?.(device.id)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-green-500/5 dark:bg-green-500/[0.03] hover:bg-green-500/10 dark:hover:bg-green-500/[0.06] border border-green-500/20 dark:border-green-500/[0.05] hover:border-green-500/30 transition-all duration-200 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span className="text-sm text-foreground group-hover:text-foreground transition-colors">
                                            {getDeviceDisplayName(device)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* TDS Value */}
                                        {device.latest_tds !== undefined && (
                                            <span className="text-xs text-green-600 dark:text-green-500 font-medium">
                                                {Math.round(Number(device.latest_tds))} ppm
                                            </span>
                                        )}
                                        {/* Connectivity Badge */}
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${device.connectivity_status === 'online'
                                                ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                                                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
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
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 dark:bg-red-500/[0.03] overflow-hidden">
                {/* Header */}
                <button
                    onClick={() => setCriticalTDSExpanded(!criticalTDSExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-500/10 dark:hover:bg-red-500/[0.06] transition-colors duration-200"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-foreground">Critical TDS Range</span>
                        <span className="text-xs text-muted-foreground">({criticalTDSDevices.length} devices)</span>
                    </div>
                    {criticalTDSExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>

                {/* Device List */}
                <div
                    className={`transition-all duration-300 ease-in-out ${criticalTDSExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                        } overflow-hidden`}
                >
                    <div className="px-2 pb-2 space-y-1">
                        {criticalTDSDevices.length === 0 ? (
                            <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                                No devices in critical range
                            </div>
                        ) : (
                            criticalTDSDevices.map((device) => (
                                <button
                                    key={device.id}
                                    onClick={() => onDeviceClick?.(device.id)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-red-500/5 dark:bg-red-500/[0.05] hover:bg-red-500/10 dark:hover:bg-red-500/[0.10] border border-red-500/20 dark:border-red-500/[0.15] hover:border-red-500/40 transition-all duration-200 flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-sm text-foreground group-hover:text-foreground transition-colors">
                                            {getDeviceDisplayName(device)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* TDS Value */}
                                        {device.latest_tds !== undefined && (
                                            <span className="text-xs text-red-500 font-medium">
                                                {Math.round(Number(device.latest_tds))} ppm
                                            </span>
                                        )}
                                        {/* Connectivity Badge */}
                                        <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${device.connectivity_status === 'online'
                                                ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                                                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'
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
