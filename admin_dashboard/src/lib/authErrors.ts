/**
 * Firebase Auth error -> user-facing message, used consistently across every
 * auth entry point (Login email/password, Login Google, Register
 * email/password, Register Google, forgot-password).
 *
 * Previously each page mapped a couple of codes it happened to think of and
 * fell back to the raw Firebase message for everything else — which is how a
 * user ends up staring at "Firebase: Error (auth/internal-error)." with no
 * idea what it means or what to do about it. This maps every code worth
 * distinguishing to something a non-technical person can act on.
 */
export function isBenignPopupDismissal(err: unknown): boolean {
    const code = (err as { code?: string })?.code || ''
    return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

export function getAuthErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
    const code = (err as { code?: string })?.code || ''

    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
            return 'Incorrect email or password. Please check your credentials and try again.'
        case 'auth/user-not-found':
            return 'No account found with this email address.'
        case 'auth/email-already-in-use':
            return 'An account with this email already exists. Try signing in instead.'
        case 'auth/weak-password':
            return 'Password is too weak — use at least 8 characters, including a number.'
        case 'auth/invalid-email':
            return "That doesn't look like a valid email address."
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a few minutes and try again.'
        case 'auth/user-disabled':
            return 'This account has been disabled. Contact your administrator.'
        case 'auth/network-request-failed':
            return "Network error — check your connection and try again."
        case 'auth/popup-blocked':
            return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
        case 'auth/unauthorized-domain':
            return "This site isn't authorized for Google sign-in yet — this is a configuration issue, not something you can fix. Contact your administrator."
        case 'auth/internal-error':
            return "Google sign-in hit an unexpected error, usually temporary. Try again in a moment, or use email/password instead. If it keeps happening, it's often caused by the browser blocking third-party cookies (common in Incognito/Private mode) — try a normal browser window."
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with this email using a different sign-in method. Try signing in with email/password instead.'
        default:
            return (err as { message?: string })?.message || fallback
    }
}
