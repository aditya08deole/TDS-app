import { useState, useEffect, useMemo } from 'react'

export type Orientation = 'portrait' | 'landscape' | 'square'
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export function useViewport() {
    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight : 800,
    })

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }

        window.addEventListener('resize', handleResize)
        // Check for orientation change too (mobile specialized)
        window.addEventListener('orientationchange', handleResize)
        
        return () => {
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('orientationchange', handleResize)
        }
    }, [])

    const { width, height } = windowSize
    const aspectRatio = width / height

    // Determine Orientation
    const orientation: Orientation = useMemo(() => {
        if (aspectRatio > 1.2) return 'landscape'
        if (aspectRatio < 0.8) return 'portrait'
        return 'square'
    }, [aspectRatio])

    // Determine Device Type with Aspect-Ratio Awareness
    // This is more robust than just checking width
    const deviceType: DeviceType = useMemo(() => {
        if (width < 768) return 'mobile'
        if (width < 1024) return 'tablet'
        // Extra check: wide aspect ratio but small width (landscape mobile)
        if (height < 500 && aspectRatio > 1.5) return 'mobile'
        return 'desktop'
    }, [width, height, aspectRatio])

    return {
        width,
        height,
        aspectRatio,
        orientation,
        deviceType,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
        isSquare: orientation === 'square'
    }
}
