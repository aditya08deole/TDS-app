import { GlassCard } from '@/components/GlassCard'
import { ShieldCheck, Users as UsersIcon, UserPlus, Link2, Copy, Check, Clock, Trash2, RefreshCw, Wrench, User, MessageCircle, Mail, Search, ListChecks, KeyRound, Inbox, ArrowRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRole, ROLE_DISPLAY_NAMES } from '../context/RoleContext'
import { generateInviteApi, listInvitesApi, revokeInviteApi, getUserStatsApi, listUsersApi, setUserRoleApi, type InviteToken, type UserRoleStats, type DirectoryUser, type UserRole } from '../lib/api'
import { cn } from '@/lib/utils'

type InviteRole = 'field_engineer' | 'viewer' | 'admin'

const ROLE_OPTIONS: { value: InviteRole; label: string; desc: string; color: string; icon: typeof Wrench }[] = [
    { value: 'field_engineer', label: 'Maintenance', desc: 'Can resolve alerts & edit devices', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10', icon: Wrench },
    { value: 'viewer', label: 'User', desc: 'Read-only dashboard access', color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', icon: User },
    { value: 'admin', label: 'Admin', desc: 'Full control + can invite others', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10', icon: ShieldCheck },
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
    const [directorySearch, setDirectorySearch] = useState('')
    const [pendingRoleChange, setPendingRoleChange] = useState<{ uid: string; email: string; from: UserRole; to: UserRole } | null>(null)

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

    // Selecting a new role in the table opens a confirmation dialog rather
    // than applying instantly — a stray click on the dropdown shouldn't be
    // able to silently regrade someone's access.
    const requestRoleChange = (u: DirectoryUser, newRole: UserRole) => {
        if (newRole === u.role) return
        setPendingRoleChange({ uid: u.uid, email: u.email || u.uid, from: u.role, to: newRole })
    }

    const copyEmail = async (email: string) => {
        try {
            await navigator.clipboard.writeText(email)
            toast.success('Email copied', { description: email })
        } catch {
            toast.error('Could not copy email')
        }
    }

    const confirmRoleChange = async () => {
        if (!pendingRoleChange) return
        const { uid, to } = pendingRoleChange
        setChangingRoleFor(uid)
        try {
            await setUserRoleApi(uid, to)
            setDirectory(prev => prev.map(u => u.uid === uid ? { ...u, role: to } : u))
            toast.success('Role updated', { description: `Now: ${ROLE_DISPLAY_NAMES[to]}` })
            loadUserStats() // counts changed
        } catch (err: any) {
            toast.error('Failed to change role', { description: err.message })
        } finally {
            setChangingRoleFor(null)
            setPendingRoleChange(null)
        }
    }

    const filteredDirectory = useMemo(() => {
        const q = directorySearch.trim().toLowerCase()
        if (!q) return directory
        return directory.filter(u =>
            (u.email || '').toLowerCase().includes(q) ||
            (u.name || '').toLowerCase().includes(q)
        )
    }, [directory, directorySearch])

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

    const shareText = generatedLink
        ? `You've been invited to EvaraTDS as ${ROLE_DISPLAY_NAMES[inviteRole]}. Open this link and log in to accept — your access is set automatically: ${generatedLink}`
        : ''

    const handleShareWhatsApp = () => {
        if (!generatedLink) return
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer')
    }

    const handleShareEmail = () => {
        if (!generatedLink) return
        const subject = encodeURIComponent("You're invited to EvaraTDS")
        window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(shareText)}`
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                        <UsersIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Management</h1>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                            Invite people, see who has access, and control exactly what they can do
                        </p>
                    </div>
                </div>
                <div className="px-3.5 py-2 rounded-xl glass-system-inset text-xs font-bold uppercase tracking-wider text-cyan-400 border border-cyan-500/30 flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    You: {ROLE_DISPLAY_NAMES[role] || role}
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
                                    'p-4 rounded-xl border text-left transition-all duration-200 flex items-start gap-3',
                                    inviteRole === opt.value
                                        ? `${opt.color} border-current shadow-lg scale-[1.02]`
                                        : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20'
                                )}
                            >
                                <div className={cn(
                                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                    inviteRole === opt.value ? 'bg-current/15' : 'bg-white/5'
                                )}>
                                    <opt.icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm">{opt.label}</p>
                                    <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{opt.desc}</p>
                                </div>
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
                        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
                            <div className="flex items-center flex-wrap gap-2 text-emerald-400">
                                <Check className="w-4 h-4 shrink-0" />
                                <span className="text-sm font-bold">Invite Link Ready</span>
                                {expiresAt && (
                                    <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                        <Clock className="w-3 h-3" />
                                        Expires {formatDate(expiresAt)}
                                    </span>
                                )}
                            </div>

                            <code className="text-xs font-mono bg-black/30 px-3 py-2 rounded-lg border border-white/10 text-foreground/80 overflow-x-auto whitespace-nowrap block">
                                {generatedLink}
                            </code>

                            {/* Share actions */}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={handleCopy}
                                    size="sm"
                                    className={cn(
                                        'h-9 px-4 rounded-lg font-bold text-xs gap-1.5 transition-all',
                                        copied
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                                    )}
                                >
                                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                                </Button>
                                <Button
                                    onClick={handleShareWhatsApp}
                                    size="sm"
                                    className="h-9 px-4 rounded-lg font-bold text-xs gap-1.5 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/25"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                                </Button>
                                <Button
                                    onClick={handleShareEmail}
                                    size="sm"
                                    className="h-9 px-4 rounded-lg font-bold text-xs gap-1.5 bg-white/5 text-foreground/80 border border-white/10 hover:bg-white/10"
                                >
                                    <Mail className="w-3.5 h-3.5" /> Email
                                </Button>
                            </div>

                            {/* What happens next */}
                            <div className="pt-3 border-t border-white/10 space-y-1.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <ListChecks className="w-3 h-3" /> What happens when they open it
                                </p>
                                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                                    <li>They open the link and are asked to log in — either create an account, or sign in if they already have one.</li>
                                    <li>The moment they log in, their account is set to <strong className="text-foreground/90">{ROLE_DISPLAY_NAMES[inviteRole]}</strong> automatically — no extra step for them.</li>
                                    <li>The link works once. After that, only a super admin can change their role — from the All Users list below.</li>
                                </ol>
                            </div>
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
                    <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                <KeyRound className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-foreground text-sm">Active Invite Tokens</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">{invites.length} invite(s) issued</p>
                            </div>
                        </div>
                        <button
                            onClick={loadInvites}
                            disabled={loadingInvites}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', loadingInvites && 'animate-spin')} />
                            Refresh
                        </button>
                    </div>

                    {loadingInvites ? (
                        <div className="p-5 space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : invites.length === 0 ? (
                        <div className="px-8 py-12 text-center">
                            <Inbox className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-muted-foreground text-sm">No invites issued yet. Generate one above.</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: stacked cards */}
                            <div className="md:hidden divide-y divide-white/5">
                                {invites.map(invite => (
                                    <div key={invite.id} className="p-4 space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <code className="font-mono text-xs text-foreground/70">{invite.token_preview}</code>
                                            {invite.status === 'pending' && (
                                                <button
                                                    onClick={() => handleRevoke(invite.id)}
                                                    disabled={revoking === invite.id}
                                                    className="text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
                                                    title="Revoke invite"
                                                >
                                                    {revoking === invite.id
                                                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                        : <Trash2 className="w-4 h-4" />
                                                    }
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider', getRoleBadge(invite.role))}>
                                                {ROLE_DISPLAY_NAMES[invite.role as keyof typeof ROLE_DISPLAY_NAMES] || invite.role}
                                            </span>
                                            <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider', getStatusBadge(invite.status))}>
                                                {invite.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Created {formatDate(invite.created_at)} · Expires {formatDate(invite.expires_at)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop: full table */}
                            <div className="overflow-x-auto hidden md:block">
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
                                        {invites.map(invite => (
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
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </GlassCard>
            )}

            {/* All Users Directory — super_admin only: see every real account and reassign roles */}
            {isSuperAdmin && (
                <GlassCard className="overflow-hidden p-0">
                    <div className="p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                <UsersIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-foreground text-sm">All Users</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {directory.length} real account{directory.length === 1 ? '' : 's'} — change anyone's role directly
                                </p>
                            </div>
                        </div>
                        {/* w-full/w-56 lives on this wrapper (not the input) so the
                            percentage width has a definite box to resolve against —
                            putting it on the input alone inside an unconstrained flex
                            item is what made this row render cramped on narrow screens. */}
                        <div className="flex items-center gap-3">
                            <div className="relative w-full md:w-56">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <input
                                    type="text"
                                    value={directorySearch}
                                    onChange={(e) => setDirectorySearch(e.target.value)}
                                    placeholder="Search by email..."
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan-500/50"
                                />
                            </div>
                            <button
                                onClick={loadDirectory}
                                disabled={loadingDirectory}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 shrink-0"
                            >
                                <RefreshCw className={cn('w-3.5 h-3.5', loadingDirectory && 'animate-spin')} />
                                Refresh
                            </button>
                        </div>
                    </div>

                    {loadingDirectory ? (
                        <div className="p-5 space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : filteredDirectory.length === 0 ? (
                        <div className="px-8 py-12 text-center">
                            <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-muted-foreground text-sm">
                                {directorySearch ? `No users match "${directorySearch}".` : 'No users found.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: stacked cards — a table here would force horizontal
                                scrolling, which reads as unfinished on a phone/PWA. */}
                            <div className="md:hidden divide-y divide-white/5">
                                {filteredDirectory.map(u => {
                                    const isSelf = u.uid === user?.uid
                                    const initial = (u.email || u.uid).charAt(0).toUpperCase()
                                    return (
                                        <div key={u.uid} className="p-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                                    DIRECTORY_ROLE_COLORS[u.role]
                                                )}>
                                                    {initial}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm text-foreground/90 truncate font-mono">{u.email || u.uid}</span>
                                                        {isSelf && (
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold uppercase tracking-wider shrink-0">You</span>
                                                        )}
                                                        <button
                                                            onClick={() => copyEmail(u.email || u.uid)}
                                                            className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
                                                            title="Copy email"
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Joined {u.joined_at ? formatDate(u.joined_at) : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                            {isSelf ? (
                                                <span className={cn('inline-block px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wider', DIRECTORY_ROLE_COLORS[u.role])}>
                                                    {ROLE_DISPLAY_NAMES[u.role]}
                                                </span>
                                            ) : (
                                                <Select
                                                    value={u.role}
                                                    disabled={changingRoleFor === u.uid}
                                                    onValueChange={(value) => requestRoleChange(u, value as UserRole)}
                                                >
                                                    <SelectTrigger className="w-full h-9 bg-white/5 border-white/10 text-xs font-bold text-foreground disabled:opacity-50">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="glass-system-parent border-white/20 shadow-2xl backdrop-blur-3xl">
                                                        {DIRECTORY_ROLE_OPTIONS.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Desktop: full table */}
                            <div className="overflow-x-auto hidden md:block">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 text-left text-muted-foreground">
                                            <th className="px-5 py-3 font-medium">Email</th>
                                            <th className="px-5 py-3 font-medium">Joined</th>
                                            <th className="px-5 py-3 font-medium text-right">Role</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredDirectory.map(u => {
                                            const isSelf = u.uid === user?.uid
                                            const initial = (u.email || u.uid).charAt(0).toUpperCase()
                                            return (
                                                <tr key={u.uid} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={cn(
                                                                'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                                                                DIRECTORY_ROLE_COLORS[u.role]
                                                            )}>
                                                                {initial}
                                                            </div>
                                                            <span className="text-foreground/90 font-mono">{u.email || u.uid}</span>
                                                            {isSelf && (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold uppercase tracking-wider">You</span>
                                                            )}
                                                            <button
                                                                onClick={() => copyEmail(u.email || u.uid)}
                                                                className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
                                                                title="Copy email"
                                                            >
                                                                <Copy className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-muted-foreground">{u.joined_at ? formatDate(u.joined_at) : '—'}</td>
                                                    <td className="px-5 py-3.5 text-right">
                                                        {isSelf ? (
                                                            <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider', DIRECTORY_ROLE_COLORS[u.role])}>
                                                                {ROLE_DISPLAY_NAMES[u.role]}
                                                            </span>
                                                        ) : (
                                                            <Select
                                                                value={u.role}
                                                                disabled={changingRoleFor === u.uid}
                                                                onValueChange={(value) => requestRoleChange(u, value as UserRole)}
                                                            >
                                                                <SelectTrigger className="w-auto h-8 ml-auto bg-white/5 border-white/10 text-[11px] font-bold text-foreground disabled:opacity-50">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="glass-system-parent border-white/20 shadow-2xl backdrop-blur-3xl">
                                                                    {DIRECTORY_ROLE_OPTIONS.map(opt => (
                                                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </GlassCard>
            )}

            {/* Role Hierarchy Reference */}
            <GlassCard className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-bold text-foreground">Role Hierarchy</h3>
                </div>
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

            {/* Role Change Confirmation */}
            <Dialog open={!!pendingRoleChange} onOpenChange={(open) => { if (!open) setPendingRoleChange(null) }}>
                {/* bg-card/border-border/text-foreground is the established pattern used by
                    every other Dialog in this app (QRCodeGenerator, QRCodeScanner) — it's a
                    theme-matched pair that adapts to light/dark mode together. The previous
                    bg-slate-950 was a static color that doesn't change with theme, while
                    text-foreground does (it becomes black in light mode) — black text on a
                    hardcoded near-black background, which is exactly the "card was black,
                    nothing visible" bug reported. */}
                <DialogContent className="max-w-md bg-card border-border text-foreground">
                    <DialogHeader>
                        <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center mb-2">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                        </div>
                        <DialogTitle>Change this person's role?</DialogTitle>
                        <DialogDescription>
                            {pendingRoleChange?.email} — this takes effect immediately and changes what they can see and do.
                        </DialogDescription>
                    </DialogHeader>

                    {pendingRoleChange && (
                        <div className="flex items-center justify-center gap-3 py-2">
                            <span className={cn('px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider', DIRECTORY_ROLE_COLORS[pendingRoleChange.from])}>
                                {ROLE_DISPLAY_NAMES[pendingRoleChange.from]}
                            </span>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className={cn('px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider', DIRECTORY_ROLE_COLORS[pendingRoleChange.to])}>
                                {ROLE_DISPLAY_NAMES[pendingRoleChange.to]}
                            </span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPendingRoleChange(null)}
                            className="border-white/10"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmRoleChange}
                            disabled={!!changingRoleFor}
                            className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 font-bold gap-1.5"
                        >
                            {changingRoleFor ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Applying...</> : 'Confirm Change'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
