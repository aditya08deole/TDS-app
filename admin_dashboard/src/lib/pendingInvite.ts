/**
 * Pending Invite Token — sessionStorage-backed capture
 *
 * An invite link carries its role-assignment token as a ?token= URL param.
 * Reading that param directly from window.location.search at redemption time
 * is fragile: by the time AuthContext's async profile-fetch chain runs, a
 * navigate() call (e.g. Login.tsx redirecting after sign-in, or bouncing from
 * /register to /login for an existing account) may have already changed the
 * URL, silently dropping the token before it's ever redeemed.
 *
 * Fix: capture the token into sessionStorage the moment Login/Register mount,
 * before any navigation happens. Redemption then reads from sessionStorage,
 * which survives client-side route changes within the same tab.
 */
const STORAGE_KEY = 'pending_invite_token'

/** Call once on mount of any page that can be reached via an invite link
 * (Login, Register). Captures ?token= or ?invite= into sessionStorage and
 * strips it from the visible URL. Safe to call repeatedly / on pages with no
 * token present — it's a no-op if neither param exists. */
export function capturePendingInviteToken(): void {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token') || params.get('invite')
    if (!token) return

    sessionStorage.setItem(STORAGE_KEY, token)

    const url = new URL(window.location.href)
    url.searchParams.delete('token')
    url.searchParams.delete('invite')
    window.history.replaceState({}, '', url.toString())
}

export function getPendingInviteToken(): string | null {
    return sessionStorage.getItem(STORAGE_KEY)
}

export function clearPendingInviteToken(): void {
    sessionStorage.removeItem(STORAGE_KEY)
}
