import { GlassCard } from '@/components/GlassCard'
import { ShieldCheck, Users as UsersIcon, UserPlus, Link2, Copy, Check, Clock, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRole, ROLE_DISPLAY_NAMES } from '../context/RoleContext'
import { generateInviteApi, listInvitesApi, revokeInviteApi, getUserStatsApi, listUsersApi, setUserRoleApi, type InviteToken, type UserRoleStats, type DirectoryUser, type UserRole } from '../lib/api'
import { cn } from '@/lib/utils'

type InviteRole = 'field_engineer' | 'viewer' | 'admin'

const ROLE_OPTIONS: { value: InviteRole; label: string; desc: string; color: string }[] = [
    { value: 'field_engineer', label: 'Maintenance', desc: 'Can resolve alerts & edit devices', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
    { value: 'viewer', label: 'User', desc: 'Read-only dashboard access', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
    { value: 'admin', label: 'Admin', desc: 'Full control + can invite others', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
]

const DIRECTORY_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
    { value: 'viewer', label: 'User' },
    { value: 'field_engineer', label: 'Maintenance' },
    { value: 'admin', label: 'Admin' },
    { value: 'super_admin', label: 'Super Admin' },
]

// Covers all 4 roles — unlike ROLE_OPTIONS below, which only lists the 3
// roles that can be granted via invite (super_admin can't be invited).
const DIRECTORY_ROLE_COLORS: Record<UserRole, string> = {
    viewer: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    field_engineer: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    admin: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    super_admin: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
}

export default function Users() {
    const { hasPermission, isSuperAdmin, role } = useRole()
    const { user } = useAuth()
    const canInvite = hasPermission('invite_users')

    const [inviteRole, setInviteRole] = useState<InviteRole>('field_engineer')
    const [generatedLink, setGeneratedLink] = useState<string | null>(null)
    const [expiresAt, setExpiresAt] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [generating, setGenerating] = useState(false)

    const [invites, setInvites] = useState<InviteToken[]>([])
    const [loadingInvites, setLoadingInvites] = useState(false)
    const [revoking, setRevoking] = useState<string | null>(null)
    const [userStats, setUserStats] = useState<UserRoleStats | null>(null)

    const [directory, setDirectory] = useState<DirectoryUser[]>([])
    const [loadingDirectory, setLoadingDirectory] = useState(false)
    const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null)

    const loadInvites = useCallback(async () => {
        if (!canInvite) return
        setLoadingInvites(true)
        try {
            const data = await listInvitesApi()
            setInvites(data)
        } catch (err) {
            console.error('Failed to load invites:', err)
        } finally {
            setLoadingInvites(false)
        }
    }, [canInvite])

    const loadUserStats = useCallback(async () => {
        // Visible to every signed-in role (viewer+), not just admins who can
        // invite — the backend endpoint is open to any authenticated role.
        try {
            const stats = await getUserStatsApi()
            setUserStats(stats)
        } catch (err) {
            console.error('Failed to load user stats:', err)
        }
    }, [])

    const loadDirectory = useCallback(async () => {
        if (!isSuperAdmin) return
        setLoadingDirectory(true)
        try {
            const data = await listUsersApi()
            setDirectory(data)
        } catch (err) {
            console.error('Failed to load user directory:', err)
        } finally {
            setLoadingDirectory(false)
        }
    }, [isSuperAdmin])

    useEffect(() => {
        loadInvites()
        loadUserStats()
        loadDirectory()
    }, [loadInvites, loadUserStats, loadDirectory])

    const handleRoleChange = async (uid: string, newRole: UserRole) => {
        setChangingRoleFor(uid)
        try {
            await setUserRoleApi(uid, newRole)
            setDirectory(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u))
            toast.success('Role updated', { description: `Now: ${ROLE_DISPLAY_NAMES[newRole]}` })
            loadUserStats() // counts changed
        } catch (err: any) {
            toast.error('Failed to change role', { description: err.message })
        } finally {
            setChangingRoleFor(null)
        }
    }

    const handleGenerate = async () => {
        setGenerating(true)
        setGeneratedLink(null)
        try {
            const result = await generateInviteApi(inviteRole)
            setGeneratedLink(result.invite_link)
            setExpiresAt(result.expires_at)
            toast.success('Invite link generated!', { description: `Role: ${ROLE_DISPLAY_NAMES[inviteRole as keyof typeof ROLE_DISPLAY_NAMES] || inviteRole} — valid for 24 hours` })
            loadInvites() // Refresh the table
        } catch (err: any) {
            toast.error('Failed to generate invite', { description: err.message })
        } finally {
            setGenerating(false)
        }
    }

    const handleCopy = async () => {
        if (!generatedLink) return
        try {
            await navigator.clipboard.writeText(generatedLink)
            setCopied(true)
            toast.success('Link copied to clipboard!')
            setTimeout(() => setCopied(false), 3000)
        } catch {
            toast.error('Failed to copy — please copy manually')
        }
    }

    const handleRevoke = async (tokenId: string) => {
        setRevoking(tokenId)
        try {
            await revokeInviteApi(tokenId)
            toast.success('Invite revoked successfully')
            setInvites(prev => prev.filter(t => t.id !== tokenId))
        } catch (err: any) {
            toast.error('Failed to revoke', { description: err.message })
        } finally {
            setRevoking(null)
        }
    }

    const getStatusBadge = (status: InviteToken['status']) => {
        switch (status) {
            case 'pending': return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
            case 'used': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
            case 'expired': return 'text-slate-400 border-slate-500/30 bg-slate-500/10'
        }
    }

    const getRoleBadge = (r: string) => {
        const opt = ROLE_OPTIONS.find(o => o.value === r)
        return opt?.color || 'text-muted-foreground border-white/10 bg-white/5'
    }

    const formatDate = (iso: string) => {
        try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
        catch { return iso }
    }

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Manage access hierarchy — invite maintenance staff and users via secure links
                    </p>
                </div>
                <div className="px-3 py-1.5 rounded-lg glass-system-inset text-xs font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/30">
                    Your role: {ROLE_DISPLAY_NAMES[role] || role}
                </div>
            </div>

            {/* Stats Row — real counts from GET /api/users/stats (falls back to '—' while loading / for non-admins) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Super Admin', icon: ShieldCheck, color: 'text-cyan-400', bg: 'bg-cyan-500/20', count: userStats ? userStats.super_admin.toString() : '—' },
                    { label: 'Admins', icon: ShieldCheck, color: 'text-purple-400', bg: 'bg-purple-500/20', count: userStats ? userStats.admin.toString() : '—' },
                    { label: 'Maintenance', icon: UsersIcon, color: 'text-amber-400', bg: 'bg-amber-500/20', count: userStats ? userStats.field_engineer.toString() : '—' },
                    { label: 'Users', icon: UsersIcon, color: 'text-blue-400', bg: 'bg-blue-500/20', count: userStats ? userStats.viewer.toString() : '—' },
                ].map(s => (
                    <GlassCard key={s.label} className="p-5 flex items-center gap-4">
                        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', s.bg)}>
                            <s.icon className={cn('w-5 h-5', s.color)} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                            <h3 className="text-2xl font-bold text-foreground">{s.count}</h3>
                        </div>
                    </GlassCard>
                ))}
            </div>

            {/* Invite Generator — admin/super_admin only */}
            {canInvite ? (
                <GlassCard className="p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-foreground">Generate Invite Link</h2>
                            <p className="text-xs text-muted-foreground">Links expire in 24 hours and can only be used once</p>
                        </div>
                    </div>

                    {/* Role Selector */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {ROLE_OPTIONS.filter(o => isSuperAdmin || o.value !== 'admin').map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setInviteRole(opt.value)}
                                className={cn(
                                    'p-4 rounded-xl border text-left transition-all duration-200',
                                    inviteRole === opt.value
                                        ? `${opt.color} border-current shadow-lg scale-[1.02]`
                                        : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
                                )}
                            >
                                <p className="font-bold text-sm">{opt.label}</p>
                                <p className="text-xs opacity-80 mt-0.5">{opt.desc}</p>
                            </button>
                        ))}
                    </div>

                    {/* Generate Button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="w-full md:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold shadow-lg shadow-cyan-500/25 gap-2 h-10 px-6 rounded-xl"
                    >
                        {generating
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                            : <><Link2 className="w-4 h-4" /> Generate Invite Link</>
                        }
                    </Button>

                    {/* Generated Link Display */}
                    {generatedLink && (
                        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-400">
                                <Check className="w-4 h-4" />
                                <span className="text-sm font-bold">Invite Link Ready</span>
                                {expiresAt && (
                                    <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Expires {formatDate(expiresAt)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs font-mono bg-black/30 px-3 py-2 rounded-lg border border-white/10 text-foreground/80 overflow-x-auto whitespace-nowrap block">
                                    {generatedLink}
                                </code>
                                <Button
                                    onClick={handleCopy}
                                    size="sm"
                                    className={cn(
                                        'shrink-0 h-9 px-4 rounded-lg font-bold text-xs gap-1.5 transition-all',
                                        copied
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                                    )}
                                >
                                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Share this link with the person you want to invite. They will be assigned the <strong>{ROLE_DISPLAY_NAMES[inviteRole as keyof typeof ROLE_DISPLAY_NAMES] || inviteRole}</strong> role on signup.
                            </p>
                        </div>
                    )}
                </GlassCard>
            ) : (
                <GlassCard className="p-6 flex items-center gap-4 border-white/10">
                    <ShieldCheck className="w-8 h-8 text-muted-foreground/40" />
                    <div>
                        <p className="text-sm font-bold text-foreground">Invite Access Required</p>
                        <p className="text-xs text-muted-foreground">Only admins and super admins can generate invite links.</p>
                    </div>
                </GlassCard>
            )}

            {/* Invite Token Table */}
            {canInvite && (
                <GlassCard className="overflow-hidden p-0">
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-foreground text-sm">Active Invite Tokens</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{invites.length} invite(s) issued</p>
                        </div>
                        <button
                            onClick={loadInvites}
                            disabled={loadingInvites}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', loadingInvites && 'animate-spin')} />
                            Refresh
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/10 text-left text-muted-foreground">
                                    <th className="px-5 py-3 font-medium">Token</th>
                                    <th className="px-5 py-3 font-medium">Role</th>
                                    <th className="px-5 py-3 font-medium">Created</th>
                                    <th className="px-5 py-3 font-medium">Expires</th>
                                    <th className="px-5 py-3 font-medium">Status</th>
                                    <th className="px-5 py-3 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingInvites ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <tr key={i} className="border-b border-white/5 animate-pulse">
                                            {Array.from({ length: 6 }).map((__, j) => (
                                                <td key={j} className="px-5 py-4">
                                                    <div className="h-3 bg-white/5 rounded w-24" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : invites.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                                            No invites issued yet. Generate one above.
                                        </td>
                                    </tr>
                                ) : (
                                    invites.map(invite => (
                                        <tr key={invite.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                            <td className="px-5 py-3.5">
                                                <code className="font-mono text-foreground/70">{invite.token_preview}</code>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider', getRoleBadge(invite.role))}>
                                                    {ROLE_DISPLAY_NAMES[invite.role as keyof typeof ROLE_DISPLAY_NAMES] || invite.role}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-muted-foreground">{formatDate(invite.created_at)}</td>
                                            <td className="px-5 py-3.5 text-muted-foreground">{formatDate(invite.expires_at)}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider', getStatusBadge(invite.status))}>
                                                    {invite.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                {invite.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleRevoke(invite.id)}
                                                        disabled={revoking === invite.id}
                                                        className="text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40"
                                                        title="Revoke invite"
                                                    >
                                                        {revoking === invite.id
                                                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                            : <Trash2 className="w-3.5 h-3.5" />
                                                        }
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}

            {/* All Users Directory — super_admin only: see every real account and reassign roles */}
            {isSuperAdmin && (
                <GlassCard className="overflow-hidden p-0">
                    <div className="p-5 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-foreground text-sm">All Users</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {directory.length} real account{directory.length === 1 ? '' : 's'} — change anyone's role directly
                            </p>
                        </div>
                        <button
                            onClick={loadDirectory}
                            disabled={loadingDirectory}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', loadingDirectory && 'animate-spin')} />
                            Refresh
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-white/10 text-left text-muted-foreground">
                                    <th className="px-5 py-3 font-medium">Email</th>
                                    <th className="px-5 py-3 font-medium">Joined</th>
                                    <th className="px-5 py-3 font-medium text-right">Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingDirectory ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <tr key={i} className="border-b border-white/5 animate-pulse">
                                            {Array.from({ length: 3 }).map((__, j) => (
                                                <td key={j} className="px-5 py-4">
                                                    <div className="h-3 bg-white/5 rounded w-24" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : directory.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    directory.map(u => {
                                        const isSelf = u.uid === user?.uid
                                        return (
                                            <tr key={u.uid} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <span className="text-foreground/90">{u.email || u.uid}</span>
                                                    {isSelf && (
                                                        <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold uppercase tracking-wider">You</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-muted-foreground">{u.joined_at ? formatDate(u.joined_at) : '—'}</td>
                                                <td className="px-5 py-3.5 text-right">
                                                    {isSelf ? (
                                                        <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider', DIRECTORY_ROLE_COLORS[u.role])}>
                                                            {ROLE_DISPLAY_NAMES[u.role]}
                                                        </span>
                                                    ) : (
                                                        <select
                                                            value={u.role}
                                                            disabled={changingRoleFor === u.uid}
                                                            onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-foreground disabled:opacity-50 focus:outline-none focus:border-cyan-500/50"
                                                        >
                                                            {DIRECTORY_ROLE_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>
            )}

            {/* Role Hierarchy Reference */}
            <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-bold text-foreground">Role Hierarchy</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {[
                        { role: 'Super Admin', color: 'text-cyan-400', desc: 'Full system access, manages all admins' },
                        { role: 'Admin', color: 'text-purple-400', desc: 'Device management, invite users, resolve alerts' },
                        { role: 'Maintenance', color: 'text-amber-400', desc: 'Resolve alerts, edit device settings on-site' },
                        { role: 'User', color: 'text-blue-400', desc: 'Read-only: view dashboards, alerts, and map' },
                    ].map(r => (
                        <div key={r.role} className="p-3 rounded-xl border border-white/10 bg-white/3 space-y-1">
                            <p className={cn('text-xs font-bold', r.color)}>{r.role}</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{r.desc}</p>
                        </div>
                    ))}
                </div>
            </GlassCard>
        </div>
    )
}
