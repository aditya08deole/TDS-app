
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Device } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Smartphone, Key } from 'lucide-react'

export default function Devices() {
    const { isAdmin } = useAuth()
    const [devices, setDevices] = useState<Device[]>([])
    const [newDevice, setNewDevice] = useState({ name: '', latitude: '', longitude: '' })
    const [loading, setLoading] = useState(false)

    const refreshDevices = useCallback(async () => {
        const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false })
        if (data) setDevices(data)
    }, [])

    useEffect(() => {
        // eslint-disable-next-line
        refreshDevices()
    }, [refreshDevices])

    const handleAddDevice = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAdmin) return
        setLoading(true)

        // Generate random API Key
        const apiKey = 'ev_' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9)

        const { error } = await supabase.from('devices').insert([{
            name: newDevice.name,
            latitude: parseFloat(newDevice.latitude),
            longitude: parseFloat(newDevice.longitude),
            api_key: apiKey
        }])

        if (!error) {
            setNewDevice({ name: '', latitude: '', longitude: '' })
            refreshDevices()
        } else {
            alert('Error adding device: ' + error.message)
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!isAdmin || !confirm('Are you sure you want to delete this device?')) return
        await supabase.from('devices').delete().eq('id', id)
        refreshDevices()
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Devices</h1>
                <p className="text-slate-400 mt-2">Manage your IoT sensor nodes.</p>
            </div>

            {isAdmin && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <Plus className="h-5 w-5 text-cyan-400" />
                        Add New Device
                    </h3>
                    <form onSubmit={handleAddDevice} className="flex gap-4 items-end flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-sm text-slate-500 mb-1 block">Device Name</label>
                            <input
                                type="text"
                                required
                                value={newDevice.name}
                                onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-cyan-500 outline-none"
                                placeholder="NodeMCU-01"
                            />
                        </div>
                        <div className="w-32">
                            <label className="text-sm text-slate-500 mb-1 block">Latitude</label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={newDevice.latitude}
                                onChange={e => setNewDevice({ ...newDevice, latitude: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-cyan-500 outline-none"
                                placeholder="20.59"
                            />
                        </div>
                        <div className="w-32">
                            <label className="text-sm text-slate-500 mb-1 block">Longitude</label>
                            <input
                                type="number"
                                step="any"
                                required
                                value={newDevice.longitude}
                                onChange={e => setNewDevice({ ...newDevice, longitude: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-cyan-500 outline-none"
                                placeholder="78.96"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-cyan-500/20"
                        >
                            {loading ? 'Adding...' : 'Add Device'}
                        </button>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {devices.map(device => (
                    <div key={device.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="h-12 w-12 bg-slate-800/50 rounded-xl flex items-center justify-center border border-slate-700">
                                <Smartphone className="h-6 w-6 text-cyan-400" />
                            </div>
                            {isAdmin && (
                                <button
                                    onClick={() => handleDelete(device.id)}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-slate-100 mb-1">{device.name}</h3>
                        <p className="text-slate-500 text-sm mb-4">ID: {device.id}</p>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800/50">
                                <Key className="h-4 w-4 text-emerald-500" />
                                <code className="font-mono text-xs">{device.api_key || 'No Key'}</code>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-500">
                                <div className="flex gap-4">
                                    <span>Lat: {device.latitude}</span>
                                    <span>Long: {device.longitude}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase border ${device.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                        device.status === 'critical' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                            device.status === 'warning' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                                'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                    }`}>
                                    {device.status || 'offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
