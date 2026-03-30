import { useState, useEffect } from 'react'
import { type AuditLogEntry } from '../types'
import { Search, User, Clock, ShieldAlert } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { GlassCard } from '@/components/GlassCard'
import { db } from '../lib/firebase'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'

export default function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([])
    const [loading, setLoading] = useState(false)
    const { hasPermission } = useRole()

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true)
            try {
                const q = query(
                    collection(db, 'audit_logs'),
                    orderBy('created_at', 'desc'),
                    limit(50)
                )
                const querySnapshot = await getDocs(q)
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as AuditLogEntry[]
                setLogs(data)
            } catch (error) {
                console.error('Error fetching audit logs:', error)
            } finally {
                setLoading(false)
            }
        }

        if (hasPermission('view_audit')) {
            fetchLogs()
        }
    }, [hasPermission])

    if (!hasPermission('view_audit')) {
        return (
            <div className="flex items-center justify-center h-[50vh] text-muted-foreground">
                <ShieldAlert className="w-6 h-6 mr-2" />
                <span>Access Denied. insufficient permissions.</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-20 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                    Audit Trail
                </h1>
                <p className="text-muted-foreground mt-1">Immutable forensic logs of all system actions</p>
            </div>

            {/* Log List */}
            <GlassCard className="overflow-hidden">
                <div className="p-4 border-b border-accent bg-secondary/50 flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="bg-transparent border-none focus:ring-0 text-sm text-foreground w-full placeholder:text-muted-foreground"
                    />
                </div>

                <div className="divide-y divide-accent">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading forensics...</div>
                    ) : logs.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">No audit records found.</div>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="p-4 hover:bg-accent/30 transition-colors group">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${log.action.includes('delete') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            log.action.includes('resolve') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                log.action.includes('update') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    'bg-secondary text-muted-foreground border-accent'
                                            }`}>
                                            {log.action.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(log.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground/60 font-mono">
                                        <User className="w-3 h-3" />
                                        {log.actor_id.slice(0, 8)}...
                                    </div>
                                </div>
                                <div className="ml-1">
                                    <p className="text-sm text-muted-foreground font-medium mb-1">
                                        Target: <span className="text-foreground font-mono">{log.target_resource}</span>
                                    </p>
                                    <pre className="text-[10px] text-muted-foreground/80 bg-secondary/30 p-2 rounded-lg overflow-x-auto font-mono border border-accent">
                                        {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </GlassCard>
        </div>
    )
}
