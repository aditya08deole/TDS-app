import { Search, MapPin, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDeviceDisplayName } from '../lib/constants'
import { getPpmStatus } from '../components/MapMarkers'
import { type DeviceLocation, type MapTheme, type FilterType } from '../types'

interface MapSidebarContentProps {
    theme: MapTheme;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    statusFilter: FilterType;
    setStatusFilter: (filter: FilterType) => void;
    finalStats: {
        online: number;
        critical: number;
        offline: number;
    };
    filteredDevices: DeviceLocation[];
    selectedDevice: DeviceLocation | null;
    setSelectedDevice: (device: DeviceLocation) => void;
}

export function MapSidebarContent({
    theme,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    finalStats,
    filteredDevices,
    selectedDevice,
    setSelectedDevice
}: MapSidebarContentProps) {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Panel Header */}
            <div className="p-5 flex flex-col gap-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: `linear-gradient(135deg, ${theme.status.online.color}, ${theme.chart.tds.stroke})`, boxShadow: `0 8px 20px -5px ${theme.status.online.color}60` }}>
                            <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-sm font-black text-foreground tracking-tight leading-none">Map View</h1>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">Infrastructure</p>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Find a device..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl text-xs font-medium outline-none glass-system-inset border-0 focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground/70"
                    />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { key: 'online', label: 'ON', value: finalStats.online, ...theme.status.online },
                        { key: 'critical', label: 'CRIT', value: finalStats.critical, ...theme.status.critical },
                        { key: 'offline', label: 'OFF', value: finalStats.offline, ...theme.status.offline },
                    ].map(s => (
                        <button
                            key={s.key}
                            onClick={() => setStatusFilter((statusFilter === s.key ? 'all' : s.key) as FilterType)}
                            className={cn(
                                "group flex flex-col items-center p-2 rounded-xl transition-all duration-300 relative border border-transparent",
                                statusFilter === s.key ? "glass-system-child border-white/20 shadow-lg scale-105" : "hover:bg-white/5"
                            )}
                            style={{
                                background: statusFilter === s.key ? s.bg : undefined,
                            }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full mb-1.5 transition-transform group-hover:scale-125" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
                            <span className="text-sm font-black text-foreground leading-none">{s.value}</span>
                            <span className="text-[7px] font-bold text-muted-foreground mt-1 group-hover:text-primary transition-colors">{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Device List Section */}
            <div className="flex-1 overflow-hidden flex flex-col glass-system-child border-0 rounded-none border-t border-white/10">
                <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                    <span>Active Nodes</span>
                    <span className="text-primary">{filteredDevices.length} Connected</span>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredDevices.map(device => {
                        const ppmStatus = getPpmStatus(device.latest_tds, device.status || 'offline', theme)
                        const isSelected = selectedDevice?.id === device.id

                        return (
                            <button
                                key={device.id}
                                onClick={() => setSelectedDevice(device)}
                                className="w-full flex items-center justify-between p-3 rounded-xl transition-all duration-300 group hover:bg-white/10 border border-transparent"
                                style={{
                                    background: isSelected ? `${ppmStatus.color}15` : 'transparent',
                                    borderColor: isSelected ? `${ppmStatus.color}30` : 'transparent'
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-12 glass-system-micro border-white/10"
                                        style={{ background: ppmStatus.bg }}>
                                        <Droplets className="w-4.5 h-4.5" style={{ color: ppmStatus.color }} />
                                    </div>
                                    <div className="min-w-0 flex flex-col items-start text-left">
                                        <span className="text-xs font-bold text-foreground truncate max-w-[140px] leading-tight">{getDeviceDisplayName(device)}</span>
                                        <span className="text-[9px] text-muted-foreground font-medium truncate max-w-[140px] mt-0.5">{device.location_name || 'GIS Node'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-black font-mono tracking-tighter" style={{ color: ppmStatus.color }}>
                                        {device.latest_tds || '0'}
                                    </span>
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: ppmStatus.color }} />
                                </div>
                            </button>
                        )
                    })}
                    {filteredDevices.length === 0 && (
                        <div className="py-20 text-center opacity-80">
                            <Search className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-xs font-medium italic">No matches found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
