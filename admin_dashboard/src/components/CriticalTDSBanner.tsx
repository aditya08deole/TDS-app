import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import type { EnrichedDevice } from '../lib/supabase'
import { getDeviceDisplayName } from '../lib/constants'

interface CriticalTDSBannerProps {
    criticalDevices: EnrichedDevice[]
    onScrollToSection?: () => void
}

export function CriticalTDSBanner({ criticalDevices, onScrollToSection }: CriticalTDSBannerProps) {
    const [dismissed, setDismissed] = useState(false)

    if (criticalDevices.length === 0 || dismissed) {
        return null
    }

    const deviceNames = criticalDevices
        .slice(0, 3)
        .map(d => getDeviceDisplayName(d))
        .join(', ')

    const moreCount = criticalDevices.length > 3 ? criticalDevices.length - 3 : 0

    return (
        <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-r from-red-900/20 via-red-800/20 to-red-900/20 backdrop-blur-sm animate-pulse-slow">
            {/* Animated background effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/10 to-transparent animate-shimmer" />

            <div className="relative flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                            Critical TDS Alert
                            <span className="px-2 py-0.5 rounded-full bg-red-500/30 text-xs font-bold">
                                {criticalDevices.length}
                            </span>
                        </h3>
                        <p className="text-xs text-red-300/80 mt-0.5">
                            {criticalDevices.length} {criticalDevices.length === 1 ? 'device' : 'devices'} in critical TDS range - Review immediately
                        </p>
                        {onScrollToSection && (
                            <button
                                onClick={onScrollToSection}
                                className="text-xs text-red-400 hover:text-red-300 underline mt-1 transition-colors"
                            >
                                View: {deviceNames}
                                {moreCount > 0 && ` +${moreCount} more`}
                            </button>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setDismissed(true)}
                    className="flex-shrink-0 w-8 h-8 rounded-lg hover:bg-red-500/20 flex items-center justify-center transition-colors"
                    aria-label="Dismiss alert"
                >
                    <X className="w-4 h-4 text-red-400" />
                </button>
            </div>
        </div>
    )
}
