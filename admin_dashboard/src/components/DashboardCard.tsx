import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { EnrichedDevice } from '@/types'
import { getDeviceDisplayName } from '@/lib/constants'
import { useTheme } from '../context/ThemeContext'

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
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div
            className="relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Main Card */}
            <div className="relative overflow-hidden glass-dynamic dashboard-card p-6 transition-all duration-300 hover:scale-[1.02] glass-ripple group h-full">
                {/* Icon */}
                <div
                    className="absolute top-4 left-4 p-2 rounded-xl transition-all duration-300"
                    style={{
                        backgroundColor: `${color}15`,
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
                    <div className="text-muted-foreground text-sm font-bold">
                        {title}
                    </div>
                </div>

                {/* Hover Indicator */}
                {showDeviceList && devices.length > 0 && (
                    <div className="absolute bottom-3 right-3 text-muted-foreground/80 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Hover to view
                    </div>
                )}
            </div>

            {/* Device List Popup (on hover) */}
            {showDeviceList && devices.length > 0 && (
                <div
                    className={cn(
                        "absolute top-0 left-0 w-full h-full rounded-2xl glass-card p-6 transition-all duration-500 pointer-events-none",
                        isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    )}
                    style={{ zIndex: 10 }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-4">
                        <Icon className="w-4 h-4" style={{ color: color }} />
                        <span className="text-foreground text-sm font-bold">
                            {title} ({count})
                        </span>
                    </div>

                    {/* Device List */}
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                        {devices.map((device, index) => (
                            <div
                                key={device.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/40 hover:bg-background/60 transition-colors duration-200 border border-black/5"
                                style={{
                                    animationDelay: `${index * 30}ms`,
                                    animation: isHovered ? 'fadeInUp 0.3s ease-out forwards' : 'none'
                                }}
                            >
                                {/* Device Name */}
                                <span className="text-foreground text-sm font-bold truncate flex-1">
                                    {getDeviceDisplayName(device)}
                                </span>

                                {/* Status Badges */}
                                <div className="flex items-center gap-2 ml-2">
                                    {/* TDS Badge */}
                                    {device.tds_category && device.tds_category !== 'unknown' && (
                                        <span
                                            className="px-2 py-0.5 rounded text-[10px] font-medium"
                                            style={{
                                                backgroundColor: device.tds_category === 'safe' ? '#00df8120' : '#ff005520',
                                                color: device.tds_category === 'safe' ? '#00df81' : '#ff0055'
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
                                                backgroundColor: device.connectivity_status === 'online' ? 'rgba(129, 140, 248, 0.2)' : (isDark ? '#47556920' : '#94a3b820'),
                                                color: device.connectivity_status === 'online' ? '#818cf8' : (isDark ? '#475569' : '#94a3b8')
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
                    <div className="mt-4 text-muted-foreground/80 text-[10px] text-center">
                        Move mouse away to close
                    </div>
                </div>
            )}
        </div>
    )
}
