import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { EnrichedDevice } from '@/lib/supabase'
import { getDeviceDisplayName } from '@/lib/constants'

interface DashboardCardProps {
    title: string
    count: number
    icon: LucideIcon
    color: string
    devices: EnrichedDevice[]
    showDeviceList?: boolean
}

/**
 * Dashboard Card Component with Hover Interactions
 * 
 * Features:
 * - Large number display
 * - Icon with color accent
 * - Hover to show device names
 * - Glassmorphism styling
 * - Smooth transitions
 */
export function DashboardCard({
    title,
    count,
    icon: Icon,
    color,
    devices,
    showDeviceList = true
}: DashboardCardProps) {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            className="relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Main Card */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 transition-all duration-300 hover:border-white/20 hover:bg-black/50">
                {/* Icon */}
                <div
                    className="absolute top-4 left-4 p-2 rounded-xl transition-all duration-300"
                    style={{
                        backgroundColor: `${color}20`,
                        color: color
                    }}
                >
                    <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="mt-12">
                    {/* Count */}
                    <div
                        className="text-5xl font-bold mb-2 transition-all duration-300"
                        style={{ color: color }}
                    >
                        {count}
                    </div>

                    {/* Title */}
                    <div className="text-white/60 text-sm font-medium">
                        {title}
                    </div>
                </div>

                {/* Hover Indicator */}
                {showDeviceList && devices.length > 0 && (
                    <div className="absolute bottom-3 right-3 text-white/30 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Hover to view
                    </div>
                )}
            </div>

            {/* Device List Popup (on hover) */}
            {showDeviceList && devices.length > 0 && (
                <div
                    className={`absolute top-0 left-0 w-full h-full rounded-2xl border border-white/20 bg-black/95 backdrop-blur-2xl p-6 transition-all duration-300 pointer-events-none ${isHovered
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95'
                        }`}
                    style={{ zIndex: 10 }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4">
                        <Icon className="w-4 h-4" style={{ color: color }} />
                        <span className="text-white/80 text-sm font-medium">
                            {title} ({count})
                        </span>
                    </div>

                    {/* Device List */}
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                        {devices.map((device, index) => (
                            <div
                                key={device.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors duration-200"
                                style={{
                                    animationDelay: `${index * 30}ms`,
                                    animation: isHovered ? 'fadeInUp 0.3s ease-out forwards' : 'none'
                                }}
                            >
                                {/* Device Name */}
                                <span className="text-white/90 text-sm font-medium truncate flex-1">
                                    {getDeviceDisplayName(device)}
                                </span>

                                {/* Status Badges */}
                                <div className="flex items-center gap-2 ml-2">
                                    {/* TDS Badge */}
                                    {device.tds_category && device.tds_category !== 'unknown' && (
                                        <span
                                            className="px-2 py-0.5 rounded text-[10px] font-medium"
                                            style={{
                                                backgroundColor: device.tds_category === 'safe' ? '#30d15820' : '#ff453a20',
                                                color: device.tds_category === 'safe' ? '#30d158' : '#ff453a'
                                            }}
                                        >
                                            {device.tds_category === 'safe' ? 'Safe' : 'Critical'}
                                        </span>
                                    )}

                                    {/* Connectivity Badge */}
                                    {device.connectivity_status && (
                                        <span
                                            className="px-2 py-0.5 rounded text-[10px] font-medium"
                                            style={{
                                                backgroundColor: device.connectivity_status === 'online' ? '#30d15820' : '#8e8e9320',
                                                color: device.connectivity_status === 'online' ? '#30d158' : '#8e8e93'
                                            }}
                                        >
                                            {device.connectivity_status === 'online' ? '●' : '○'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer hint */}
                    <div className="mt-4 text-white/30 text-xs text-center">
                        Move mouse away to close
                    </div>
                </div>
            )}
        </div>
    )
}
