import { Droplets, AlertTriangle } from 'lucide-react'
import type { EnrichedDevice } from '../lib/supabase'
import { getDeviceDisplayName } from '../lib/constants'
import { cn } from '../lib/utils'

interface ActivityPanelProps {
    safeTDSDevices: EnrichedDevice[]
    criticalTDSDevices: EnrichedDevice[]
    onDeviceClick?: (deviceId: string) => void
}

export function ActivityPanel({
    safeTDSDevices,
    criticalTDSDevices,
    onDeviceClick
}: ActivityPanelProps) {
    const renderDeviceList = (devices: EnrichedDevice[], emptyMessage: string) => {
        if (devices.length === 0) {
            return (
                <div className="text-sm text-slate-500 text-center py-4">
                    {emptyMessage}
                </div>
            )
        }

        return (
            <div className="space-y-1">
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
                            device.connectivity_status === 'online' && "bg-emerald-500/20 text-emerald-400",
                            device.connectivity_status === 'offline' && "bg-slate-500/20 text-slate-400"
                        )}>
                            {device.connectivity_status === 'online' ? 'Online' : 'Offline'}
                        </div>
                    </button>
                ))}
            </div>
        )
    }

    const ScrollableSection = ({
        title,
        count,
        icon: Icon,
        color,
        children
    }: {
        title: string
        count: number
        icon: any
        color: string
        children: React.ReactNode
    }) => (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800/50">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", color)}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">{title}</h3>
                        <p className="text-xs text-slate-400">{count} device{count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </div>
            <div className="px-4 pb-4 pt-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-600">
                {children}
            </div>
        </div>
    )

    return (
        <div className="space-y-3">
            <h2 className="text-lg font-bold text-white mb-4">Activity Panel</h2>

            {/* Safe TDS Section - Always Visible, Scrollable */}
            <ScrollableSection
                title="Safe TDS"
                count={safeTDSDevices.length}
                icon={Droplets}
                color="bg-emerald-500/20 text-emerald-400"
            >
                {renderDeviceList(safeTDSDevices, "No devices with safe TDS levels")}
            </ScrollableSection>

            {/* Critical TDS Section - Always Visible, Scrollable */}
            <ScrollableSection
                title="Critical TDS"
                count={criticalTDSDevices.length}
                icon={AlertTriangle}
                color="bg-red-500/20 text-red-400"
            >
                {renderDeviceList(criticalTDSDevices, "No devices with critical TDS levels")}
            </ScrollableSection>
        </div>
    )
}
