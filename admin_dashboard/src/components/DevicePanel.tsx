import { X, Battery, Droplets } from 'lucide-react'
import type { Device } from '../lib/supabase'

interface DevicePanelProps {
    device: Device | null
    onClose: () => void
    isMobile: boolean
}

export default function DevicePanel({ device, onClose, isMobile }: DevicePanelProps) {
    if (!device) return null

    // Determine Status Color
    const statusColor =
        device.status === 'online' ? 'bg-emerald-500' :
            device.status === 'critical' ? 'bg-red-500' :
                device.status === 'warning' ? 'bg-orange-500' :
                    'bg-slate-500';

    const panelClasses = isMobile
        ? "fixed bottom-[64px] left-0 right-0 bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl z-40 p-6 animate-slide-up pb-safe"
        : "absolute top-4 right-4 bottom-4 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl z-[1000] p-6 animate-slide-in-right";

    return (
        <>
            {/* Backdrop for mobile */}
            {isMobile && <div className="fixed inset-0 bg-black/50 z-30" onClick={onClose} />}

            <div className={panelClasses}>
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`h-3 w-3 rounded-full ${statusColor} animate-pulse`} />
                            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                                {device.status || 'OFFLINE'}
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-white">{device.name}</h2>
                        {/* Extend Device Type locally if needed or cast as any for loose schema */}
                        <p className="text-sm text-slate-500">{(device as any).location_name || 'Unknown Location'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <Droplets className="h-4 w-4 text-cyan-500" />
                            <span className="text-xs">TDS</span>
                        </div>
                        <div className="text-2xl font-bold text-cyan-400">---</div>
                        {/* We would fetch live data here logically, simpler for now to show placeholder or pass in */}
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2 text-slate-400 mb-2">
                            <Battery className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs">Voltage</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-400">---</div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-400">Sensor ID</span>
                        <span className="font-mono text-sm text-slate-200">{device.id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-400">Last Seen</span>
                        <span className="text-sm text-slate-200">
                            {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
                        </span>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-cyan-500/20">
                        Full Details
                    </button>
                    <button className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm border border-slate-700">
                        History
                    </button>
                </div>
            </div>
        </>
    )
}
