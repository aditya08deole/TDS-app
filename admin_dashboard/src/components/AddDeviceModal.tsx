import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Check, RefreshCw, Radio, MapPin, Key,
    Sliders, Navigation, ArrowRight, ArrowLeft, ShieldCheck, Cpu
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Device } from '../types'
import { toast } from 'sonner'

interface AddDeviceModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (deviceData: any) => Promise<void>
    initialData?: Device | null
    isEditing?: boolean
}

export function AddDeviceModal({
    isOpen,
    onClose,
    onSubmit,
    initialData,
    isEditing = false
}: AddDeviceModalProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [submitting, setSubmitting] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        location_name: '',
        node_number: '',
        sim_number: '',
        latitude: '',
        longitude: '',
        thingspeak_channel_id: '',
        thingspeak_read_key: '',
        thingspeak_write_key: '',
        tds_field_number: 1,
        temperature_field_number: 2,
        voltage_field_number: 3,
        safe_tds_min: '35',
        safe_tds_max: '175',
    })

    // Load initial data for editing
    useEffect(() => {
        if (initialData && isEditing) {
            setFormData({
                name: initialData.name || '',
                location_name: initialData.location_name || '',
                node_number: initialData.node_number || '',
                sim_number: initialData.sim_number || '',
                latitude: initialData.latitude?.toString() || '',
                longitude: initialData.longitude?.toString() || '',
                thingspeak_channel_id: initialData.thingspeak_channel_id || '',
                thingspeak_read_key: initialData.thingspeak_read_key || '',
                thingspeak_write_key: initialData.thingspeak_write_key || '',
                tds_field_number: initialData.tds_field_number || 1,
                temperature_field_number: initialData.temperature_field_number || 2,
                voltage_field_number: initialData.voltage_field_number || 3,
                safe_tds_min: initialData.safe_tds_min?.toString() || '35',
                safe_tds_max: initialData.safe_tds_max?.toString() || '175',
            })
            setStep(1)
        } else if (!isOpen) {
            resetForm()
        }
    }, [initialData, isEditing, isOpen])

    const resetForm = () => {
        setFormData({
            name: '',
            location_name: '',
            node_number: '',
            sim_number: '',
            latitude: '',
            longitude: '',
            thingspeak_channel_id: '',
            thingspeak_read_key: '',
            thingspeak_write_key: '',
            tds_field_number: 1,
            temperature_field_number: 2,
            voltage_field_number: 3,
            safe_tds_min: '35',
            safe_tds_max: '175',
        })
        setStep(1)
    }

    // Auto-fill browser GPS location
    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser')
            return
        }
        toast.info('Fetching current GPS coordinates...')
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude.toFixed(6),
                    longitude: pos.coords.longitude.toFixed(6)
                }))
                toast.success('GPS coordinates acquired!')
            },
            (err) => {
                toast.error(`GPS Error: ${err.message}`)
            },
            { timeout: 10000, enableHighAccuracy: true }
        )
    }

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name.trim()) {
            toast.error('Device name is required')
            return
        }

        setSubmitting(true)
        try {
            const payload = {
                name: formData.name.trim(),
                location_name: formData.location_name.trim() || 'Deployment Site',
                node_number: formData.node_number.trim() || `NODE-${Date.now().toString().slice(-4)}`,
                sim_number: formData.sim_number.trim() || 'N/A',
                latitude: parseFloat(formData.latitude) || 17.4455,
                longitude: parseFloat(formData.longitude) || 78.3489,
                thingspeak_channel_id: formData.thingspeak_channel_id.trim(),
                thingspeak_read_key: formData.thingspeak_read_key.trim(),
                thingspeak_write_key: formData.thingspeak_write_key.trim(),
                tds_field_number: Number(formData.tds_field_number) || 1,
                temperature_field_number: Number(formData.temperature_field_number) || 2,
                voltage_field_number: Number(formData.voltage_field_number) || 3,
                safe_tds_min: Number(formData.safe_tds_min) || 35,
                safe_tds_max: Number(formData.safe_tds_max) || 175,
                status: initialData?.status || 'offline',
            }

            await onSubmit(payload)
            toast.success(isEditing ? 'Device updated successfully!' : 'EvaraTDS device created!')
            onClose()
            resetForm()
        } catch (err: any) {
            toast.error(err.message || 'Failed to save device')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl text-foreground overflow-hidden my-8"
                >
                    {/* Top Specular Streak */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent pointer-events-none z-10" />

                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                                <Cpu className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground tracking-tight">
                                    {isEditing ? 'Edit EvaraTDS Device' : 'Provision EvaraTDS Device'}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Configure hardware identity, ThingSpeak telemetry channels, and location
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-destructive hover:text-white transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Step Navigation Bar */}
                    <div className="flex items-center justify-between px-8 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                        {[
                            { num: 1, label: 'Deployment & Identity', icon: MapPin },
                            { num: 2, label: 'ThingSpeak Keys', icon: Key },
                            { num: 3, label: 'Fields & Bounds', icon: Sliders },
                        ].map((s) => {
                            const isActive = step === s.num
                            const isDone = step > s.num
                            const Icon = s.icon
                            return (
                                <button
                                    key={s.num}
                                    type="button"
                                    onClick={() => setStep(s.num as any)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                                        isActive
                                            ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20'
                                            : isDone
                                                ? 'text-cyan-400 font-medium'
                                                : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                                        isActive ? 'bg-black text-white' : isDone ? 'bg-cyan-500/20 text-cyan-400' : 'bg-secondary text-muted-foreground'
                                    }`}>
                                        {isDone ? <Check className="w-3 h-3" /> : s.num}
                                    </span>
                                    <Icon className="w-3.5 h-3.5 hidden sm:inline" />
                                    <span>{s.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Form Body */}
                    <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
                        {/* STEP 1: Deployment Location & Hardware Identity */}
                        {step === 1 && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            Device Display Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., EvaraTDS Node 01"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            Deployment Location Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.location_name}
                                            onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                                            placeholder="e.g., Tank A - IIITH Reservoir Block 3"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            Node / Serial Number
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.node_number}
                                            onChange={(e) => setFormData({ ...formData, node_number: e.target.value })}
                                            placeholder="e.g., SV-NODE-001"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            SIM / Cellular ID
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.sim_number}
                                            onChange={(e) => setFormData({ ...formData, sim_number: e.target.value })}
                                            placeholder="e.g., +91-9876543210"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-cyan-500"
                                        />
                                    </div>
                                </div>

                                {/* Geo Location Box */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <Navigation className="w-3.5 h-3.5 text-cyan-400" /> Map GPS Coordinates
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleGetLocation}
                                            className="text-xs text-cyan-400 font-bold hover:underline flex items-center gap-1"
                                        >
                                            <Radio className="w-3 h-3 animate-pulse" /> Detect Current GPS
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] text-muted-foreground block mb-1">Latitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.latitude}
                                                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                                placeholder="e.g., 17.4455"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-cyan-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] text-muted-foreground block mb-1">Longitude</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.longitude}
                                                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                                placeholder="e.g., 78.3489"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: ThingSpeak Credentials & Connection Testing */}
                        {step === 2 && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-400 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 shrink-0" />
                                    <span>ThingSpeak handles live sensor feeds. Enter Channel ID and Read API Key below.</span>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                        ThingSpeak Channel ID *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.thingspeak_channel_id}
                                        onChange={(e) => setFormData({ ...formData, thingspeak_channel_id: e.target.value })}
                                        placeholder="e.g., 2713286"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-foreground outline-none focus:border-cyan-500"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            Read API Key (Telemetry)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.thingspeak_read_key}
                                            onChange={(e) => setFormData({ ...formData, thingspeak_read_key: e.target.value })}
                                            placeholder="e.g., XXXXXXXXXXXXXX"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-foreground outline-none focus:border-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            Write API Key (Commands)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.thingspeak_write_key}
                                            onChange={(e) => setFormData({ ...formData, thingspeak_write_key: e.target.value })}
                                            placeholder="e.g., YYYYYYYYYYYYYY"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-foreground outline-none focus:border-cyan-500"
                                        />
                                    </div>
                                </div>

                            </motion.div>
                        )}

                        {/* STEP 3: Sensor Field Mapping & Threshold Bounds */}
                        {step === 3 && (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Sliders className="w-3.5 h-3.5 text-cyan-400" /> ThingSpeak Field Numbers
                                    </h4>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-[11px] text-muted-foreground block mb-1">TDS Sensor</label>
                                            <Select
                                                value={String(formData.tds_field_number)}
                                                onValueChange={(v) => setFormData({ ...formData, tds_field_number: Number(v) })}
                                            >
                                                <SelectTrigger className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-foreground">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
                                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>Field {n}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="text-[11px] text-muted-foreground block mb-1">Temperature</label>
                                            <Select
                                                value={String(formData.temperature_field_number)}
                                                onValueChange={(v) => setFormData({ ...formData, temperature_field_number: Number(v) })}
                                            >
                                                <SelectTrigger className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-foreground">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
                                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>Field {n}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="text-[11px] text-muted-foreground block mb-1">Voltage / Battery</label>
                                            <Select
                                                value={String(formData.voltage_field_number)}
                                                onValueChange={(v) => setFormData({ ...formData, voltage_field_number: Number(v) })}
                                            >
                                                <SelectTrigger className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-foreground">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
                                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={String(n)}>Field {n}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Safe TDS Threshold Bounds */}
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        Safe TDS Threshold Range (PPM)
                                    </h4>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] text-muted-foreground block mb-1">Safe Minimum TDS (PPM)</label>
                                            <input
                                                type="number"
                                                value={formData.safe_tds_min}
                                                onChange={(e) => setFormData({ ...formData, safe_tds_min: e.target.value })}
                                                placeholder="35"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-cyan-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] text-muted-foreground block mb-1">Safe Maximum TDS (PPM)</label>
                                            <input
                                                type="number"
                                                value={formData.safe_tds_max}
                                                onChange={(e) => setFormData({ ...formData, safe_tds_max: e.target.value })}
                                                placeholder="175"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        Readings exceeding Safe Max automatically trigger critical alerts and FCM notifications.
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Footer Action Buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                            {step > 1 ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setStep((step - 1) as any)}
                                    className="gap-1.5 text-xs font-bold rounded-xl"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                                </Button>
                            ) : (
                                <div />
                            )}

                            {step < 3 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setStep((step + 1) as any)}
                                    className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold text-xs gap-1.5 px-6 rounded-xl"
                                >
                                    Next Step <ArrowRight className="w-3.5 h-3.5" />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    variant="ghost"
                                    disabled={submitting}
                                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs gap-2 px-8 h-10 rounded-xl shadow-lg shadow-cyan-500/25"
                                >
                                    {submitting ? (
                                        <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                                    ) : (
                                        <><Check className="w-4 h-4" /> {isEditing ? 'Update Device' : 'Deploy Device'}</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
