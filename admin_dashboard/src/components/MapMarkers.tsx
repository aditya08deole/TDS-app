import L from 'leaflet'
import { getTDSStatus, getDeviceDisplayName } from '../lib/constants'
import { type EnrichedDevice, type MapTheme } from '../types'

export type DeviceLocation = EnrichedDevice

/**
 * PPM Status Helper for consistent styling
 */
export const getPpmStatus = (ppm: number | undefined, status: string, theme: MapTheme, customMin?: number, customMax?: number) => {
    if (status === 'offline' || ppm === undefined) return {
        status: 'offline' as const,
        label: 'Offline',
        ...theme.status.offline
    }
    
    // Use the global helper for consistent categorization
    const tdsStatus = getTDSStatus(ppm, customMin, customMax)
    
    if (tdsStatus === 'online') return {
        status: 'online' as const,
        label: 'Safe to Drink',
        ...theme.status.online
    }
    return {
        status: 'critical' as const,
        label: 'Critical',
        ...theme.status.critical
    }
}

/**
 * Creates a premium "Neon Glass" Leaflet marker
 */
export const createWhiteTransparentMarker = (device: DeviceLocation, theme: MapTheme, zoom: number) => {
    const customMin = device.safe_tds_min != null ? Number(device.safe_tds_min) : undefined
    const customMax = device.safe_tds_max != null ? Number(device.safe_tds_max) : undefined
    const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline', theme, customMin, customMax)
    const ppmValue = device.latest_tds || '--'
    const displayName = getDeviceDisplayName(device)
    
    const scale = Math.max(0.4, Math.min(1.1, zoom / 15))
    const isDark = theme.bg.primary === '#000000' || theme.bg.primary === '#0a0a0a'

    return L.divIcon({
        className: 'neon-glass-marker',
        html: `
            <div class="relative group flex flex-col items-center" style="pointer-events: none; width: 180px; --marker-glow: ${ppmStatus.glow};">
                <div class="relative flex items-center gap-3 px-4 py-2.5 rounded-2xl marker-glass pointer-events-auto marker-float-animation"
                     style="background: ${isDark ? 'rgba(12, 12, 14, 0.45)' : 'rgba(255, 255, 255, 0.45)'}; 
                            backdrop-filter: blur(var(--ultra-blur)) saturate(var(--ultra-saturate));
                            -webkit-backdrop-filter: blur(var(--ultra-blur)) saturate(var(--ultra-saturate));
                            border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)'};
                            box-shadow: 0 12px 40px rgba(0,0,0,0.3), 0 0 20px ${ppmStatus.color}30;
                            min-width: 160px;
                            transform: scale(${scale});
                            transform-origin: center bottom;">
                    
                    <!-- Icon Orb -->
                    <div class="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 premium-icon-orb"
                         style="background-color: ${ppmStatus.color}25; border: 1.5px solid ${ppmStatus.color}50; box-shadow: 0 0 15px ${ppmStatus.color}20;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${ppmStatus.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                             style="filter: drop-shadow(0 0 5px ${ppmStatus.color}60);">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    </div>

                    <div class="flex flex-col flex-1 overflow-hidden">
                        <span class="text-[10px] font-black uppercase tracking-[0.15em] mb-0.5 truncate" 
                               style="color: ${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}">
                            ${displayName}
                        </span>
                        <div class="flex items-baseline gap-1.5">
                            <span class="text-2xl font-black font-mono tracking-tighter" 
                                  style="color: ${isDark ? 'white' : 'black'}; text-shadow: 0 0 15px ${ppmStatus.glow}50;">
                                ${ppmValue}
                            </span>
                            <span class="text-[10px] font-black uppercase tracking-widest"
                                  style="color: ${ppmStatus.color}; filter: brightness(${isDark ? '1.2' : '0.8'});">PPM</span>
                        </div>
                    </div>

                    <!-- Tail / Pointer -->
                    <div class="absolute -bottom-[10px] left-1/2 w-5 h-5"
                         style="background: ${isDark ? 'rgba(12, 12, 14, 0.9)' : 'rgba(255, 255, 255, 0.9)'}; 
                                border-right: 2px solid ${ppmStatus.color}; 
                                border-bottom: 2px solid ${ppmStatus.color};
                                transform: translateX(-50%) rotate(45deg);
                                z-index: -1;"></div>
                </div>

                <!-- Pulsing Anchor Dot -->
                <div class="absolute -bottom-[15px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full opacity-50 marker-anchor-pulse" 
                     style="border: 2px solid ${ppmStatus.color}; background: ${ppmStatus.color}20;"></div>
                <div class="absolute -bottom-[15px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full" 
                     style="background: ${ppmStatus.color}; box-shadow: 0 0 25px 6px ${ppmStatus.color}; border: 1px solid white;"></div>
            </div>
        `,
        iconSize: [180, 80],
        iconAnchor: [90, 80],
        popupAnchor: [0, -80]
    })
}
