import { useState, useRef, useCallback, useEffect } from 'react'

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>
    threshold?: number // Distance in pixels to trigger refresh
    disabled?: boolean
}

interface UsePullToRefreshReturn {
    pullDistance: number
    isRefreshing: boolean
    isPulling: boolean
    handlers: {
        onTouchStart: (e: React.TouchEvent) => void
        onTouchMove: (e: React.TouchEvent) => void
        onTouchEnd: () => void
    }
    PullIndicator: React.FC
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    disabled = false
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
    const [pullDistance, setPullDistance] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isPulling, setIsPulling] = useState(false)
    const startY = useRef(0)
    const currentY = useRef(0)

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled || isRefreshing) return

        // Only enable if scrolled to top
        const scrollTop = window.scrollY || document.documentElement.scrollTop
        if (scrollTop > 5) return

        startY.current = e.touches[0].clientY
        setIsPulling(true)
    }, [disabled, isRefreshing])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling || disabled || isRefreshing) return

        currentY.current = e.touches[0].clientY
        const diff = currentY.current - startY.current

        // Only allow pulling down, not up
        if (diff > 0) {
            // Apply some resistance
            const resistance = 0.5
            const cappedDiff = Math.min(diff * resistance, threshold * 1.5)
            setPullDistance(cappedDiff)
        }
    }, [isPulling, disabled, isRefreshing, threshold])

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling || disabled) return

        setIsPulling(false)

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true)
            setPullDistance(threshold) // Keep indicator visible

            try {
                await onRefresh()
            } catch (error) {
                console.error('Refresh failed:', error)
            }

            setIsRefreshing(false)
        }

        setPullDistance(0)
    }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh, disabled])

    // Reset on unmount
    useEffect(() => {
        return () => {
            setPullDistance(0)
            setIsRefreshing(false)
            setIsPulling(false)
        }
    }, [])

    // Pull Indicator Component
    const PullIndicator: React.FC = () => {
        if (pullDistance === 0 && !isRefreshing) return null

        const progress = Math.min(pullDistance / threshold, 1)
        const rotation = progress * 360

        return (
            <div
                className="fixed top-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
                style={{ transform: `translateY(${Math.min(pullDistance, threshold)}px)` }}
            >
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg transition-transform duration-200">
                    <svg
                        className={`w-5 h-5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`}
                        style={isRefreshing ? undefined : { transform: `rotate(${rotation}deg)` }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                </div>
            </div>
        )
    }

    return {
        pullDistance,
        isRefreshing,
        isPulling,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd
        },
        PullIndicator
    }
}
