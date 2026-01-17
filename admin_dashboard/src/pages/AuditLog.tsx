import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, User, Clock, ShieldAlert } from 'lucide-react'
import { useRole } from '../context/RoleContext'

interface AuditLogEntry {
    id: string
    created_at: string
    actor_id: string
    action: string
    target_resource: string
    details: any
}

export default function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [loading, setLoading] = useState(false)
    const { hasPermission } = useRole()

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) console.error(error)
            if (data) setLogs(data)
            setLoading(false)
        }

        if (hasPermission('view_audit')) {
            fetchLogs()
        }
    }, [hasPermission])

    if (!hasPermission('view_audit')) {
        return (
            <div className="flex items-center justify-center h-[50vh] text-slate-500">
                <ShieldAlert className="w-6 h-6 mr-2" />
                <span>Access Denied. insufficient permissions.</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-20 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    Audit Trail
                </h1>
                <p className="text-[#86868b] mt-1">Immutable forensic logs of all system actions</p>
            </div>

            {/* Log List */}
            <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="bg-transparent border-none focus:ring-0 text-sm text-white w-full placeholder:text-slate-500"
                    />
                </div>

                <div className="divide-y divide-white/5">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 animate-pulse">Loading forensics...</div>
                    ) : logs.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No audit records found.</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="p-4 hover:bg-white/5 transition-colors group">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${log.action.includes('delete') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            log.action.includes('resolve') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                log.action.includes('update') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                            }`}>
                                            {log.action.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-600 font-mono">
                                        <User className="w-3 h-3" />
                                        {log.actor_id.slice(0, 8)}...
                                    </div>
                                </div>
                                <div className="ml-1">
                                    <p className="text-sm text-slate-300 font-medium mb-1">
                                        Target: <span className="text-white font-mono">{log.target_resource}</span>
                                    </p>
                                    <pre className="text-[10px] text-slate-500 bg-black/30 p-2 rounded-lg overflow-x-auto font-mono border border-white/5">
                                        {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
