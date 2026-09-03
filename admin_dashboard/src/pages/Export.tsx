import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Loader2, CalendarRange, FileSpreadsheet, FileJson, DatabaseZap, MapPin } from 'lucide-react'
import { useDevices } from '../hooks/useDeviceQueries'
import { exportDeviceDataApi } from '../lib/api'
import { toast } from 'sonner'

type Preset = '24h' | '7d' | '30d' | 'custom'

function toDatetimeLocalValue(date: Date): string {
    // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time,
    // not UTC — toISOString() would silently shift the displayed time.
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function Export() {
    const { data: devices = [], isLoading: devicesLoading } = useDevices()
    const [deviceId, setDeviceId] = useState<string>('')
    const [preset, setPreset] = useState<Preset>('24h')
    const [format, setFormat] = useState<'csv' | 'json'>('csv')
    const [customStart, setCustomStart] = useState(() => toDatetimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)))
    const [customEnd, setCustomEnd] = useState(() => toDatetimeLocalValue(new Date()))
    const [exporting, setExporting] = useState(false)

    const presets: { value: Preset; label: string }[] = [
        { value: '24h', label: 'Last 24 Hours' },
        { value: '7d', label: 'Last 7 Days' },
        { value: '30d', label: 'Last 30 Days' },
        { value: 'custom', label: 'Custom Range' },
    ]

    const { start, end } = useMemo(() => {
        const now = new Date()
        if (preset === 'custom') {
            return { start: new Date(customStart), end: new Date(customEnd) }
        }
        const hoursBack = preset === '24h' ? 24 : preset === '7d' ? 24 * 7 : 24 * 30
        return { start: new Date(now.getTime() - hoursBack * 60 * 60 * 1000), end: now }
    }, [preset, customStart, customEnd])

    const rangeValid = start < end
    const selectedDevice = devices.find(d => d.id === deviceId)

    const handleExport = async () => {
        if (!deviceId) {
            toast.error('Select a device first')
            return
        }
        if (!rangeValid) {
            toast.error('Start date must be before end date')
            return
        }

        setExporting(true)
        try {
            const { blob, filename } = await exportDeviceDataApi(deviceId, start.toISOString(), end.toISOString(), format)

            if (blob.size === 0) {
                toast.info('No readings found in that date range')
                return
            }

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)

            toast.success('Export ready', { description: filename })
        } catch (err: any) {
            toast.error(err.message || 'Export failed')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 px-4 pt-2 md:pt-0 animate-fade-in text-left">
            <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <DatabaseZap className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold text-foreground tracking-tight">Export Data</h1>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold uppercase tracking-wider">
                            Admin &amp; Super Admin
                        </span>
                    </div>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Download a device's historical TDS, temperature, and voltage readings for a chosen date range.
                    </p>
                </div>
            </div>

            <GlassCard className="p-6 space-y-5">
                {/* Device */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Device</label>
                    <Select value={deviceId} onValueChange={setDeviceId} disabled={devicesLoading}>
                        <SelectTrigger className="w-full h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-foreground">
                            <SelectValue placeholder={devicesLoading ? 'Loading devices...' : 'Select a device'} />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
                            {devices.map(d => (
                                <SelectItem key={d.id} value={d.id}>
                                    {d.location_name || d.name} {d.location_name && d.name ? `— ${d.name}` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedDevice && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{selectedDevice.location_name || 'No location set'} · Channel {selectedDevice.thingspeak_channel_id || '—'}</span>
                        </div>
                    )}
                </div>

                {/* Date Range Preset */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Range</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {presets.map(p => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => setPreset(p.value)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    preset === p.value
                                        ? 'bg-cyan-500 text-black border-cyan-500 shadow-md shadow-cyan-500/20'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom range inputs */}
                {preset === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground block">From</label>
                            <input
                                type="datetime-local"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground block">To</label>
                            <input
                                type="datetime-local"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500"
                            />
                        </div>
                        {!rangeValid && (
                            <p className="text-xs text-red-400 sm:col-span-2">Start date must be before end date.</p>
                        )}
                    </div>
                )}

                {/* Format */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Format</label>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { value: 'csv' as const, label: 'CSV', hint: 'Excel, Sheets', icon: FileSpreadsheet },
                            { value: 'json' as const, label: 'JSON', hint: 'Developers, scripts', icon: FileJson },
                        ]).map(f => (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setFormat(f.value)}
                                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-left transition-all border ${
                                    format === f.value
                                        ? 'bg-cyan-500/10 border-cyan-500 text-foreground'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <f.icon className={`w-4 h-4 shrink-0 ${format === f.value ? 'text-cyan-400' : ''}`} />
                                <span>
                                    <span className="block text-xs font-bold">{f.label}</span>
                                    <span className="block text-[10px] opacity-70">{f.hint}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Range summary */}
                <div className="flex items-center gap-2.5 text-xs bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3">
                    <CalendarRange className="w-4 h-4 shrink-0 text-cyan-400" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected Range</span>
                        <span className="text-foreground font-medium truncate">
                            {start.toLocaleString()} &rarr; {end.toLocaleString()}
                        </span>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    onClick={handleExport}
                    disabled={exporting || !deviceId || !rangeValid}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                    {exporting ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Preparing export...</>
                    ) : (
                        <><Download className="w-4 h-4 mr-2" /> Export {format.toUpperCase()}</>
                    )}
                </Button>
            </GlassCard>
        </div>
    )
}
