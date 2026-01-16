import { useCallback } from 'react'

interface UseHapticOptions {
    enabled?: boolean
}

/**
 * Hook for haptic feedback on mobile devices
 * Uses the Vibration API when available
 */
export function useHaptic(options: UseHapticOptions = {}) {
    const { enabled = true } = options

    // Check if vibration is supported
    const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

    /**
     * Light tap feedback (for buttons, toggles)
     */
    const lightTap = useCallback(() => {
        if (!enabled || !isSupported) return
        navigator.vibrate(10)
    }, [enabled, isSupported])

    /**
     * Medium tap feedback (for selections, confirmations)
     */
    const mediumTap = useCallback(() => {
        if (!enabled || !isSupported) return
        navigator.vibrate(20)
    }, [enabled, isSupported])

    /**
     * Heavy tap feedback (for errors, warnings)
     */
    const heavyTap = useCallback(() => {
        if (!enabled || !isSupported) return
        navigator.vibrate(30)
    }, [enabled, isSupported])

    /**
     * Success pattern (double tap)
     */
    const success = useCallback(() => {
        if (!enabled || !isSupported) return
        navigator.vibrate([10, 50, 10])
    }, [enabled, isSupported])

    /**
     * Warning pattern (triple pulse)
     */
    const warning = useCallback(() => {
        if (!enabled || !isSupported) return
        navigator.vibrate([20, 50, 20, 50, 20])
    }, [enabled, isSupported])

    /**
     * Error pattern (long vibration)
     */
    const error = useCallback(() => {
        if (!enabled || !isSupported) return
        navigator.vibrate([50, 50, 100])
    }, [enabled, isSupported])

    /**
     * Selection changed feedback
     */
    const selectionChanged = useCallback(() => {
        if (!enabled || !isSupported) return
        navigator.vibrate(5)
    }, [enabled, isSupported])

    /**
     * Custom vibration pattern
     * @param pattern - Array of vibration/pause durations in ms
     */
    const custom = useCallback((pattern: number | number[]) => {
        if (!enabled || !isSupported) return
        navigator.vibrate(pattern)
    }, [enabled, isSupported])

    /**
     * Stop any ongoing vibration
     */
    const stop = useCallback(() => {
        if (!isSupported) return
        navigator.vibrate(0)
    }, [isSupported])

    return {
        isSupported,
        lightTap,
        mediumTap,
        heavyTap,
        success,
        warning,
        error,
        selectionChanged,
        custom,
        stop
    }
}

/**
 * Haptic-enabled button wrapper
 * Adds haptic feedback to onClick events
 */
export function withHaptic<P extends { onClick?: (e: React.MouseEvent) => void }>(
    WrappedComponent: React.ComponentType<P>,
    hapticType: 'light' | 'medium' | 'heavy' = 'light'
) {
    return function WithHapticComponent(props: P) {
        const haptic = useHaptic()

        const handleClick = (e: React.MouseEvent) => {
            // Trigger haptic
            if (hapticType === 'light') haptic.lightTap()
            else if (hapticType === 'medium') haptic.mediumTap()
            else haptic.heavyTap()

            // Call original onClick
            props.onClick?.(e)
        }

        return <WrappedComponent {...props} onClick={handleClick} />
    }
}
