import { X, Thermometer, Droplets, ExternalLink, Activity } from 'lucide-react'
import { getDeviceDisplayName } from '../lib/constants'
import type { Device } from '../types'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface DevicePanelProps {
    device: (Device & { latest_tds?: number; latest_temperature?: number; status?: string }) | null
    onClose: () => void
    isMobile: boolean
    chartData?: { time: number; value: number }[]
}

export default function DevicePanel({ device, onClose, isMobile, chartData = [] }: DevicePanelProps) {
    if (!device) return null

    // Determine Status Color
    const statusColor =
        device.status === 'online' ? 'bg-emerald-500' :
            device.status === 'critical' ? 'bg-red-500' :
                    'bg-slate-500';

    const panelClasses = isMobile
        ? "fixed bottom-[64px] left-0 right-0 glass-surface-unified border-t border-border shadow-[0_-20px_50px_rgba(0,0,0,0.2)] z-40 p-6 animate-slide-up pb-safe rounded-t-[2.5rem]"
        : "absolute top-4 right-4 bottom-4 w-[400px] glass-surface-unified border border-border/50 rounded-3xl shadow-[-20px_0_60px_rgba(0,0,0,0.2)] z-[1000] p-6 animate-slide-in-right flex flex-col";

    const tdsValue = device.latest_tds || 0
    const tempValue = device.latest_temperature || 0

    return (
        <>
            {/* Backdrop for mobile */}
            {isMobile && <div className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm" onClick={onClose} />}

            <div className={panelClasses}>
                {/* Header */}
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`block h-2.5 w-2.5 rounded-full ${statusColor} shadow-[0_0_10px_currentColor] animate-pulse`} />
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest border border-border px-2 py-0.5 rounded-md bg-accent/20">
                                {device.status || 'OFFLINE'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-foreground tracking-tight leading-tight">{getDeviceDisplayName(device)}</h2>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            {device.location_name || device.name || 'Unknown Location'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-accent/20 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/40 border border-border/50 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* TDS Card */}
                    <div className="p-4 glass-card border-border relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 text-cyan-400 mb-2">
                            <Droplets className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">TDS Level</span>
                        </div>
                        <div className="text-foreground tracking-tight flex items-baseline gap-1">
                            {tdsValue}
                            <span className="text-sm font-medium text-muted-foreground uppercase">ppm</span>
                        </div>
                    </div>

                    {/* Temp Card */}
                    <div className="p-4 glass-card border-border relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                            <Thermometer className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Temp</span>
                        </div>
                        <div className="text-3xl font-bold text-foreground tracking-tight flex items-baseline gap-1">
                            {tempValue || '--'}
                            <span className="text-sm font-medium text-muted-foreground">°C</span>
                        </div>
                    </div>
                </div>

                {/* Mini Chart */}
                <div className="mb-8 p-5 glass-card border-border flex-1 min-h-[180px] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            Live TDS Trend
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-accent/20 px-2 py-1 rounded border border-border">Last 1h</span>
                    </div>
                    <div className="flex-1 w-full min-h-[0]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="panelChartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="text-foreground"
                                    strokeWidth={2}
                                    fill="url(#panelChartGrad)"
                                />
                                <YAxis hide domain={['auto', 'auto']} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="space-y-3 mt-auto">
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-xs text-muted-foreground">Device ID</span>
                        <span className="text-xs font-mono text-foreground/70">{device.id.split('-')[0]}...</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-xs text-muted-foreground">Last Update</span>
                        <span className="text-xs text-muted-foreground">Just Now</span>
                    </div>
                </div>

                <div className="mt-6">
                    <button className="w-full py-3.5 bg-primary text-primary-foreground hover:opacity-90 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2">
                        View Full Details
                        <ExternalLink className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </>
    )
}
