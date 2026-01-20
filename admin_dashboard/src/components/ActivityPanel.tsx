import { useState } from 'react'
import { ChevronDown, ChevronUp, Droplets, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import type { EnrichedDevice } from '../lib/supabase'
import { getDeviceDisplayName } from '../lib/constants'
import { cn } from '../lib/utils'

interface ActivityPanelProps {
    safeTDSDevices: EnrichedDevice[]
    criticalTDSDevices: EnrichedDevice[]
    onlineDevices: EnrichedDevice[]
    offlineDevices: EnrichedDevice[]
    onDeviceClick?: (deviceId: string) => void
}

export function ActivityPanel({
    safeTDSDevices,
    criticalTDSDevices,
    onlineDevices,
    offlineDevices,
    onDeviceClick
}: ActivityPanelProps) {
    const [safeTDSExpanded, setSafeTDSExpanded] = useState(true)
    const [criticalTDSExpanded, setCriticalTDSExpanded] = useState(true)
    const [onlineExpanded, setOnlineExpanded] = useState(false)
    const [offlineExpanded, setOfflineExpanded] = useState(false)

    const renderDeviceList = (devices: EnrichedDevice[], emptyMessage: string) => {
        if (devices.length === 0) {
            return (
                <div className="text-sm text-slate-500 text-center py-4">
                    {emptyMessage}
                </div>
            )
        }

        return (
            <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {devices.map((device) => (
                    <button
                        key={device.id}
                        onClick={() => onDeviceClick?.(device.id)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-left group"
                    >
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {getDeviceDisplayName(device)}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {device.latest_tds ? `${device.latest_tds.toFixed(0)} PPM` : 'No data'}
                                {device.latest_temperature && ` • ${device.latest_temperature.toFixed(1)}°C`}
                            </p>
                        </div>
                        <div className={cn(
                            "ml-2 px-2 py-1 rounded text-xs font-medium",
                            device.tds_category === 'safe' && "bg-emerald-500/20 text-emerald-400",
                            device.tds_category === 'critical' && "bg-red-500/20 text-red-400",
                            device.connectivity_status === 'online' && !device.tds_category && "bg-blue-500/20 text-blue-400",
                            device.connectivity_status === 'offline' && "bg-slate-500/20 text-slate-400"
                        )}>
                            {device.connectivity_status === 'online' ? 'Online' : 'Offline'}
                        </div>
                    </button>
                ))}
            </div>
        )
    }

    const CollapsibleSection = ({
        title,
        count,
        icon: Icon,
        color,
        expanded,
        onToggle,
        children
    }: {
        title: string
        count: number
        icon: any
        color: string
        expanded: boolean
        onToggle: () => void
        children: React.ReactNode
    }) => (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", color)}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">{title}</h3>
                        <p className="text-xs text-slate-400">{count} device{count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
            </button>
            {expanded && (
                <div className="px-4 pb-4 border-t border-slate-800/50">
                    {children}
                </div>
            )}
        </div>
    )

    return (
        <div className="space-y-3">
            <h2 className="text-lg font-bold text-white mb-4">Activity Panel</h2>

            {/* Safe TDS Section */}
            <CollapsibleSection
                title="Safe TDS"
                count={safeTDSDevices.length}
                icon={Droplets}
                color="bg-emerald-500/20 text-emerald-400"
                expanded={safeTDSExpanded}
                onToggle={() => setSafeTDSExpanded(!safeTDSExpanded)}
            >
                {renderDeviceList(safeTDSDevices, "No devices with safe TDS levels")}
            </CollapsibleSection>

            {/* Critical TDS Section */}
            <CollapsibleSection
                title="Critical TDS"
                count={criticalTDSDevices.length}
                icon={AlertTriangle}
                color="bg-red-500/20 text-red-400"
                expanded={criticalTDSExpanded}
                onToggle={() => setCriticalTDSExpanded(!criticalTDSExpanded)}
            >
                {renderDeviceList(criticalTDSDevices, "No devices with critical TDS levels")}
            </CollapsibleSection>

            {/* Online Devices Section */}
            <CollapsibleSection
                title="Online Devices"
                count={onlineDevices.length}
                icon={Wifi}
                color="bg-blue-500/20 text-blue-400"
                expanded={onlineExpanded}
                onToggle={() => setOnlineExpanded(!onlineExpanded)}
            >
                {renderDeviceList(onlineDevices, "No devices online")}
            </CollapsibleSection>

            {/* Offline Devices Section */}
            <CollapsibleSection
                title="Offline Devices"
                count={offlineDevices.length}
                icon={WifiOff}
                color="bg-slate-500/20 text-slate-400"
                expanded={offlineExpanded}
                onToggle={() => setOfflineExpanded(!offlineExpanded)}
            >
                {renderDeviceList(offlineDevices, "All devices are online")}
            </CollapsibleSection>
        </div>
    )
}
