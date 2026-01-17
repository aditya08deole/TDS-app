import { X, Thermometer, Droplets, ExternalLink, Activity } from 'lucide-react'
import type { Device } from '../lib/supabase'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'

interface DevicePanelProps {
    device: (Device & { latest_tds?: number; status?: string }) | null
    onClose: () => void
    isMobile: boolean
}

// Simulated history data generator
const generateHistory = (baseValue: number) => {
    return Array.from({ length: 20 }, (_, i) => ({
        time: i,
        value: Math.max(0, baseValue + (Math.random() - 0.5) * 50)
    }))
}

export default function DevicePanel({ device, onClose, isMobile }: DevicePanelProps) {
    if (!device) return null

    // Determine Status Color
    const statusColor =
        device.status === 'online' ? 'bg-emerald-500' :
            device.status === 'critical' ? 'bg-red-500' :
                device.status === 'warning' ? 'bg-amber-500' :
                    'bg-slate-500';

    const panelClasses = isMobile
        ? "fixed bottom-[64px] left-0 right-0 bg-[#0f172a] border-t border-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40 p-6 animate-slide-up pb-safe"
        : "absolute top-4 right-4 bottom-4 w-[400px] bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-[-10px_0_40px_rgba(0,0,0,0.5)] z-[1000] p-6 animate-slide-in-right flex flex-col";

    const tdsValue = device.latest_tds || 0
    const chartData = generateHistory(tdsValue || 200)

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
                            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest border border-slate-700 px-2 py-0.5 rounded-md bg-slate-900/50">
                                {device.status || 'OFFLINE'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">{device.name}</h2>
                        <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                            {(device as any).location || 'Unknown Location'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/50 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    {/* TDS Card */}
                    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 text-cyan-400 mb-2">
                            <Droplets className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">TDS Level</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight flex items-baseline gap-1">
                            {tdsValue}
                            <span className="text-sm font-medium text-slate-500">ppm</span>
                        </div>
                    </div>

                    {/* Temp Card */}
                    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 text-amber-400 mb-2">
                            <Thermometer className="h-4 w-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Temp</span>
                        </div>
                        <div className="text-3xl font-bold text-white tracking-tight flex items-baseline gap-1">
                            24.5
                            <span className="text-sm font-medium text-slate-500">°C</span>
                        </div>
                    </div>
                </div>

                {/* Mini Chart */}
                <div className="mb-8 p-5 bg-slate-900/50 rounded-2xl border border-slate-800/50 flex-1 min-h-[180px] flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-3 h-3 text-cyan-400" />
                            Live TDS Trend
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">Last 1h</span>
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
                                    stroke="#06b6d4"
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
                    <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                        <span className="text-xs text-slate-500">Device ID</span>
                        <span className="text-xs font-mono text-slate-300">{device.id.split('-')[0]}...</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-800/50">
                        <span className="text-xs text-slate-500">Last Update</span>
                        <span className="text-xs text-slate-300">Just Now</span>
                    </div>
                </div>

                <div className="mt-6">
                    <button className="w-full py-3.5 bg-white text-black hover:bg-slate-200 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2">
                        View Full Details
                        <ExternalLink className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </>
    )
}
