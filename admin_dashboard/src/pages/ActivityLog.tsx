import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/GlassCard'
import { fetchAuditLog, type AuditLogEntry } from '../lib/api'
import {
    History, Download, UserPlus, UserCheck, User, ShieldCheck,
    CheckCircle2, ShieldAlert, Loader2, Inbox
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ActionFilter = 'all' | 'device_data_exported' | 'invite_created' | 'invite_redeemed' | 'role_changed' | 'alert_resolved' | 'user_registered_default'

const FILTERS: { value: ActionFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'device_data_exported', label: 'Exports' },
    { value: 'invite_created', label: 'Invites' },
    { value: 'role_changed', label: 'Role Changes' },
    { value: 'alert_resolved', label: 'Alerts' },
]

const ACTION_META: Record<string, { label: string; icon: typeof History; color: string }> = {
    device_data_exported: { label: 'Data Exported', icon: Download, color: 'text-cyan-500 bg-cyan-500/10' },
    invite_created: { label: 'Invite Created', icon: UserPlus, color: 'text-violet-500 bg-violet-500/10' },
    invite_redeemed: { label: 'Invite Redeemed', icon: UserCheck, color: 'text-emerald-500 bg-emerald-500/10' },
    user_registered_default: { label: 'New User Registered', icon: User, color: 'text-slate-500 bg-slate-500/10' },
    role_changed: { label: 'Role Changed', icon: ShieldAlert, color: 'text-amber-500 bg-amber-500/10' },
    alert_resolved: { label: 'Alert Resolved', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
}

function formatWhen(iso: string | undefined): string {
    if (!iso) return '—'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
}

function EntryDetail({ entry }: { entry: AuditLogEntry }) {
    switch (entry.action) {
        case 'device_data_exported':
            return (
                <>
                    <span className="font-semibold text-foreground">{String(entry.device_name || entry.device_id || 'Unknown device')}</span>
                    {' '}exported as <span className="font-medium uppercase">{String(entry.format || '')}</span>
                    {entry.row_count !== undefined && <> &middot; {String(entry.row_count)} rows</>}
                    {entry.range_start && entry.range_end && (
                        <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                            {formatWhen(String(entry.range_start))} &rarr; {formatWhen(String(entry.range_end))}
                        </div>
                    )}
                </>
            )
        case 'invite_created':
            return <>Invite generated for role <span className="font-semibold text-foreground">{String(entry.role || '')}</span></>
        case 'invite_redeemed':
            return <>Invite redeemed &mdash; assigned role <span className="font-semibold text-foreground">{String(entry.role || '')}</span></>
        case 'user_registered_default':
            return <>New account registered with default role <span className="font-semibold text-foreground">viewer</span></>
        case 'role_changed':
            return (
                <>Role changed from <span className="font-semibold text-foreground">{String(entry.previous_role || '?')}</span>
                    {' '}to <span className="font-semibold text-foreground">{String(entry.new_role || '?')}</span></>
            )
        case 'alert_resolved':
            return (
                <>
                    Alert resolved for <span className="font-semibold text-foreground">{String(entry.device_id || 'Unknown device')}</span>
                    {entry.resolution_note ? <div className="text-[11px] text-muted-foreground mt-1">"{String(entry.resolution_note)}"</div> : null}
                </>
            )
        default:
            return <span className="text-muted-foreground">No further details</span>
    }
}

function actorOf(entry: AuditLogEntry): string {
    return String(
        entry.exported_by_role || entry.created_by_role || entry.resolved_by_role ||
        entry.exported_by || entry.created_by || entry.resolved_by || entry.changed_by ||
        entry.uid || 'System'
    )
}

export default function ActivityLog() {
    const [filter, setFilter] = useState<ActionFilter>('all')

    const { data: entries = [], isLoading, isError } = useQuery({
        queryKey: ['audit-log'],
        queryFn: () => fetchAuditLog(150),
        staleTime: 30_000,
    })

    const filtered = useMemo(() => {
        if (filter === 'all') return entries
        return entries.filter(e => e.action === filter)
    }, [entries, filter])

    return (
        <div className="max-w-2xl mx-auto space-y-5 px-4 pt-2 md:pt-0 pb-8 animate-fade-in text-left">
            {/* Header */}
            <div className="flex items-start gap-4 pb-1">
                <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/25 ring-1 ring-white/20">
                    <History className="w-6 h-6 text-white" strokeWidth={2.25} />
                </div>
                <div className="min-w-0">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-violet-500/90">Audit Trail</span>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Activity Log</h1>
                        <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-500 border border-violet-500/25 font-bold uppercase tracking-wider">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Admin
                        </span>
                    </div>
                    <p className="text-muted-foreground text-[13px] mt-1 leading-snug">
                        Who exported what, invited whom, and changed which roles — newest first.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {FILTERS.map(f => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => setFilter(f.value)}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border',
                            filter === f.value
                                ? 'bg-violet-500/10 border-violet-500 text-violet-500 shadow-sm'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* List */}
            <GlassCard className="p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-14">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading activity…
                    </div>
                ) : isError ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-sm text-red-400 py-14">
                        Failed to load the activity log.
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground py-14">
                        <Inbox className="w-6 h-6 opacity-50" />
                        Nothing here yet.
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-200/70 dark:divide-slate-700/50">
                        {filtered.map(entry => {
                            const meta = ACTION_META[entry.action] || { label: entry.action, icon: History, color: 'text-muted-foreground bg-slate-500/10' }
                            return (
                                <li key={entry.id} className="flex items-start gap-3 px-3 py-3.5">
                                    <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', meta.color)}>
                                        <meta.icon className="w-4 h-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-bold text-foreground">{meta.label}</span>
                                            <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{formatWhen(entry.timestamp)}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                                            <EntryDetail entry={entry} />
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-1 font-medium uppercase tracking-wide">
                                            by {actorOf(entry)}
                                        </p>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </GlassCard>
        </div>
    )
}
