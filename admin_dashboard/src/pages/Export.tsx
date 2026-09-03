import { useState, useMemo } from 'react'
import { GlassCard } from '@/components/GlassCard'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Loader2, CalendarRange, FileText, FileSpreadsheet, FileJson, DatabaseZap, MapPin, Check, Radio, ShieldCheck } from 'lucide-react'
import { useDevices } from '../hooks/useDeviceQueries'
import { exportDeviceDataApi } from '../lib/api'
import { saveOrShareBlob } from '../lib/downloadFile'
import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Preset = '24h' | '7d' | '30d' | 'custom'
type Format = 'csv' | 'excel' | 'json'

function toDatetimeLocalValue(date: Date): string {
    // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time,
    // not UTC — toISOString() would silently shift the displayed time.
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const PRESETS: { value: Preset; label: string; hours?: number }[] = [
    { value: '24h', label: '24 Hours', hours: 24 },
    { value: '7d', label: '7 Days', hours: 24 * 7 },
    { value: '30d', label: '30 Days', hours: 24 * 30 },
    { value: 'custom', label: 'Custom' },
]

const FORMATS: { value: Format; label: string; hint: string; icon: typeof FileText; extension: string; accent: string }[] = [
    { value: 'csv', label: 'CSV', hint: 'Plain text, opens anywhere', icon: FileText, extension: '.csv', accent: 'text-emerald-500' },
    { value: 'excel', label: 'Excel', hint: 'Formatted workbook (.xlsx)', icon: FileSpreadsheet, extension: '.xlsx', accent: 'text-emerald-600' },
    { value: 'json', label: 'JSON', hint: 'For developers & scripts', icon: FileJson, extension: '.json', accent: 'text-amber-500' },
]

function SectionLabel({ step, title, description }: { step: number; title: string; description?: string }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 shadow-sm shadow-cyan-500/30">
                {step}
            </span>
            <div className="min-w-0">
                <h2 className="text-[13px] font-bold text-foreground tracking-tight leading-none">{title}</h2>
                {description && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{description}</p>
                )}
            </div>
        </div>
    )
}

export default function Export() {
    const { data: devices = [], isLoading: devicesLoading } = useDevices()
    const [deviceId, setDeviceId] = useState<string>('')
    const [preset, setPreset] = useState<Preset>('24h')
    const [format, setFormat] = useState<Format>('csv')
    const [customStart, setCustomStart] = useState(() => toDatetimeLocalValue(new Date(Date.now() - 24 * 60 * 60 * 1000)))
    const [customEnd, setCustomEnd] = useState(() => toDatetimeLocalValue(new Date()))
    const [exporting, setExporting] = useState(false)

    const { start, end } = useMemo(() => {
        const now = new Date()
        if (preset === 'custom') {
            return { start: new Date(customStart), end: new Date(customEnd) }
        }
        const activePreset = PRESETS.find(p => p.value === preset)
        const hoursBack = activePreset?.hours ?? 24
        return { start: new Date(now.getTime() - hoursBack * 60 * 60 * 1000), end: now }
    }, [preset, customStart, customEnd])

    const rangeValid = start < end
    const selectedDevice = devices.find(d => d.id === deviceId)
    const selectedFormat = FORMATS.find(f => f.value === format)!
    const readyToExport = Boolean(deviceId) && rangeValid

    const rangeLabel = useMemo(() => {
        const ms = end.getTime() - start.getTime()
        const days = ms / (1000 * 60 * 60 * 24)
        if (days >= 1) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`
        const hours = ms / (1000 * 60 * 60)
        return `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`
    }, [start, end])

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

            await saveOrShareBlob(blob, filename)

            toast.success(
                Capacitor.isNativePlatform() ? 'Export ready — choose where to save it' : 'Export ready',
                { description: filename }
            )
        } catch (err: any) {
            toast.error(err.message || 'Export failed')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5 px-4 pt-2 md:pt-0 pb-8 animate-fade-in text-left">
            {/* Header */}
            <div className="flex items-start gap-4 pb-1">
                <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
                    <DatabaseZap className="w-6 h-6 text-white" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-cyan-500/90">Data Export</span>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Export Device Data</h1>
                        <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-500 border border-cyan-500/25 font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Admin
                        </span>
                    </div>
                    <p className="text-muted-foreground text-[13px] mt-1 leading-snug">
                        Download historical TDS, temperature, and voltage readings for any device.
                    </p>
                </div>
            </div>

            {/* Step 1 — Device */}
            <GlassCard className="p-5">
                <SectionLabel step={1} title="Choose Device" description="Pick the sensor node you want to pull readings from." />
                <Select value={deviceId} onValueChange={setDeviceId} disabled={devicesLoading}>
                    <SelectTrigger className="w-full h-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-foreground font-medium">
                        <SelectValue placeholder={devicesLoading ? 'Loading devices…' : 'Select a device'} />
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
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <span className="truncate font-medium text-foreground/90">{selectedDevice.location_name || 'No location set'}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                        <Radio className="w-3.5 h-3.5 shrink-0 text-cyan-500" />
                        <span className="truncate tabular-nums">Channel {selectedDevice.thingspeak_channel_id || '—'}</span>
                    </div>
                )}
            </GlassCard>

            {/* Step 2 — Date Range */}
            <GlassCard className="p-5">
                <SectionLabel step={2} title="Date Range" description="Choose a preset window or set a custom range." />

                <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                    {PRESETS.map(p => (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() => setPreset(p.value)}
                            className={cn(
                                'px-2 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all',
                                preset === p.value
                                    ? 'bg-white dark:bg-slate-900 text-cyan-500 shadow-sm ring-1 ring-cyan-500/15'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {preset === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground block font-semibold uppercase tracking-wide">From</label>
                            <input
                                type="datetime-local"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 transition-shadow"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground block font-semibold uppercase tracking-wide">To</label>
                            <input
                                type="datetime-local"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 transition-shadow"
                            />
                        </div>
                        {!rangeValid && (
                            <p className="text-xs text-red-400 sm:col-span-2 font-medium">Start date must be before end date.</p>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-3 text-xs mt-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3">
                    <CalendarRange className="w-4 h-4 shrink-0 text-cyan-500" />
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {rangeLabel} selected
                        </span>
                        <span className="text-foreground font-semibold truncate tabular-nums">
                            {start.toLocaleString()} &rarr; {end.toLocaleString()}
                        </span>
                    </div>
                </div>
            </GlassCard>

            {/* Step 3 — Format */}
            <GlassCard className="p-5">
                <SectionLabel step={3} title="File Format" description="Pick the output that fits how you'll use the data." />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {FORMATS.map(f => {
                        const isSelected = format === f.value
                        return (
                            <button
                                key={f.value}
                                type="button"
                                onClick={() => setFormat(f.value)}
                                className={cn(
                                    'relative flex flex-col items-start gap-2.5 p-4 rounded-2xl text-left transition-all border',
                                    isSelected
                                        ? 'bg-cyan-500/10 border-cyan-500 shadow-sm ring-1 ring-cyan-500/20'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                                )}
                            >
                                {isSelected && (
                                    <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center shadow-sm">
                                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                    </span>
                                )}
                                <span className={cn(
                                    'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                                    isSelected ? 'bg-cyan-500/15' : 'bg-slate-100 dark:bg-slate-700/60'
                                )}>
                                    <f.icon className={cn('w-[18px] h-[18px]', isSelected ? 'text-cyan-500' : 'text-muted-foreground')} />
                                </span>
                                <span>
                                    <span className="block text-sm font-bold text-foreground tracking-tight">{f.label}</span>
                                    <span className="block text-[10.5px] text-muted-foreground mt-0.5 leading-tight">{f.hint}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            </GlassCard>

            {/* Summary + Action */}
            <div className="space-y-2.5">
                {readyToExport && (
                    <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground font-medium px-1">
                        <span className="truncate">{selectedDevice?.location_name || selectedDevice?.name}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                        <span>{rangeLabel}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                        <span>{selectedFormat.label}{selectedFormat.extension}</span>
                    </div>
                )}
                <Button
                    variant="ghost"
                    onClick={handleExport}
                    disabled={exporting || !readyToExport}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold h-12 rounded-2xl shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50 tracking-tight"
                >
                    {exporting ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Preparing export…</>
                    ) : (
                        <><Download className="w-4 h-4 mr-2" /> Export as {selectedFormat.label}{selectedFormat.extension}</>
                    )}
                </Button>
            </div>
        </div>
    )
}
