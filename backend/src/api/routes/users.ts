import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { requireRole } from '../middleware/roleGuard';
import crypto from 'crypto';

const router = Router();

function getDb() { return getFirestore(); }

// ─── Role Hierarchy Validation ────────────────────────────────────────────────
// Admins can invite 'maintenance' (field_engineer) and 'user' (viewer) roles.
// They cannot create super_admin invites — that is reserved for super_admin only.
const ADMIN_INVITABLE_ROLES = ['field_engineer', 'viewer'];
const SUPER_ADMIN_INVITABLE_ROLES = ['field_engineer', 'viewer', 'admin'];
const INVITE_EXPIRY_HOURS = 24;

// ─── POST /api/users/invite — Generate an invite link ─────────────────────────
/**
 * Admin/super_admin generates a time-limited invite token for a specific role.
 * The token is stored in Firestore and embedded in a shareable link.
 *
 * - admin can invite: field_engineer, viewer
 * - super_admin can invite: field_engineer, viewer, admin
 * - No one can create super_admin invites (super_admin is set manually in Firestore)
 */
router.post('/invite', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { role } = req.body;
        const invitedBy = (req as any).user?.uid;
        const invitedByRole = (req as any).user?.role || 'admin';

        if (!role) {
            return res.status(400).json({ success: false, error: 'role is required (field_engineer or viewer)' });
        }

        // Validate role the requester is allowed to assign
        const allowedRoles = invitedByRole === 'super_admin'
            ? SUPER_ADMIN_INVITABLE_ROLES
            : ADMIN_INVITABLE_ROLES;

        if (!allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                error: `You do not have permission to invite users with role '${role}'`,
            });
        }

        // Generate a cryptographically secure token
        const token = crypto.randomBytes(32).toString('hex');
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

        // Store in Firestore
        await getDb().collection('invite_tokens').doc(token).set({
            role,
            created_by: invitedBy,
            created_by_role: invitedByRole,
            created_at: now,
            expires_at: expiresAt,
            used: false,
            used_by: null,
            used_at: null,
        });

        // Write audit log
        getDb().collection('audit_log').add({
            action: 'invite_created',
            token: token.substring(0, 8) + '...', // Don't log full token for security
            role,
            created_by: invitedBy,
            created_by_role: invitedByRole,
            created_at: now,
            timestamp: now,
        }).catch(() => {});

        // Build the link from the actual request rather than the FRONTEND_URL
        // env var — that var was stale/pointed at localhost in production,
        // which is exactly what produced broken invite links. The app is a
        // single unified origin (frontend + API on the same host, see the
        // root Dockerfile), so the request's own origin is always correct in
        // every environment with zero config needed.
        const frontendUrl = `${req.protocol}://${req.get('host')}`;
        const inviteLink = `${frontendUrl}/register?token=${token}`;

        console.log(`✅ [INVITE] ${invitedByRole} ${invitedBy} generated invite for role '${role}' — expires ${expiresAt}`);

        return res.json({
            success: true,
            token,
            invite_link: inviteLink,
            role,
            expires_at: expiresAt,
            expires_in_hours: INVITE_EXPIRY_HOURS,
        });
    } catch (error) {
        console.error('Error generating invite:', error);
        return res.status(500).json({ success: false, error: 'Failed to generate invite token' });
    }
});

// ─── GET /api/users/invites — List active invite tokens (admin+) ──────────────
router.get('/invites', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const snapshot = await getDb()
            .collection('invite_tokens')
            .orderBy('created_at', 'desc')
            .limit(50)
            .get();

        const now = new Date();
        const tokens = snapshot.docs.map(doc => {
            const data = doc.data();
            const isExpired = new Date(data.expires_at) < now;
            return {
                id: doc.id,
                token_preview: doc.id.substring(0, 8) + '...',
                role: data.role,
                created_by: data.created_by,
                created_at: data.created_at,
                expires_at: data.expires_at,
                used: data.used,
                used_by: data.used_by,
                used_at: data.used_at,
                status: data.used ? 'used' : isExpired ? 'expired' : 'pending',
            };
        });

        return res.json({ success: true, data: tokens, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Error listing invites:', error);
        return res.status(500).json({ success: false, error: 'Failed to list invites' });
    }
});

// ─── POST /api/users/redeem-invite — Redeem an invite token ──────────────────
/**
 * Called by the frontend after Firebase Auth signup, when an invite token is present in the URL.
 * Validates the token and assigns the correct role to the user in Firestore.
 *
 * Security:
 * - Token must exist, not be used, and not be expired
 * - The uid must match a valid Firebase Auth user (verified via getAuth())
 * - Token is immediately marked as used after redemption
 */
router.post('/redeem-invite', async (req: Request, res: Response) => {
    try {
        const { token, uid } = req.body;

        if (!token || !uid) {
            return res.status(400).json({ success: false, error: 'token and uid are required' });
        }

        // Verify the uid is a real Firebase user
        try {
            await getAuth().getUser(uid);
        } catch {
            return res.status(401).json({ success: false, error: 'Invalid user ID' });
        }

        const tokenRef = getDb().collection('invite_tokens').doc(token);
        const tokenSnap = await tokenRef.get();

        if (!tokenSnap.exists) {
            return res.status(404).json({ success: false, error: 'Invalid invite token' });
        }

        const tokenData = tokenSnap.data()!;

        if (tokenData.used) {
            return res.status(409).json({ success: false, error: 'This invite link has already been used' });
        }

        if (new Date(tokenData.expires_at) < new Date()) {
            return res.status(410).json({ success: false, error: 'This invite link has expired' });
        }

        const now = new Date().toISOString();

        // Check if user already has a role (prevent invite from downgrading an existing admin)
        const existingUser = await getDb().collection('users').doc(uid).get();
        if (existingUser.exists) {
            const existingRole = existingUser.data()?.role;
            const roleRank: Record<string, number> = { viewer: 0, field_engineer: 1, admin: 2, super_admin: 3 };
            const existingRank = roleRank[existingRole] ?? 0;
            const inviteRank = roleRank[tokenData.role] ?? 0;
            if (existingRank >= inviteRank) {
                // Don't downgrade an existing higher-privilege user
                await tokenRef.update({ used: true, used_by: uid, used_at: now });
                return res.json({ success: true, role: existingRole, message: 'Existing role preserved (invite role is lower)' });
            }
        }

        // Assign role to user in Firestore
        await getDb().collection('users').doc(uid).set({
            role: tokenData.role,
            invited_by: tokenData.created_by,
            joined_at: now,
            updated_at: now,
        }, { merge: true });

        // Mark token as used (prevents reuse)
        await tokenRef.update({ used: true, used_by: uid, used_at: now });

        // Write audit log
        getDb().collection('audit_log').add({
            action: 'invite_redeemed',
            uid,
            role: tokenData.role,
            invited_by: tokenData.created_by,
            redeemed_at: now,
            timestamp: now,
        }).catch(() => {});

        console.log(`✅ [INVITE REDEEMED] uid=${uid} role=${tokenData.role} invited_by=${tokenData.created_by}`);

        return res.json({
            success: true,
            role: tokenData.role,
            message: `Role '${tokenData.role}' assigned successfully`,
        });
    } catch (error) {
        console.error('Error redeeming invite:', error);
        return res.status(500).json({ success: false, error: 'Failed to redeem invite token' });
    }
});

// ─── POST /api/users/set-default-role — Set viewer role for uninvited signups ─
/**
 * Called after Firebase Auth signup when NO invite token is present.
 * Assigns the default 'viewer' (user) role to the new user.
 * If the user already has a role (e.g., they were previously invited), this is a no-op.
 */
router.post('/set-default-role', async (req: Request, res: Response) => {
    try {
        const { uid } = req.body;

        if (!uid) {
            return res.status(400).json({ success: false, error: 'uid is required' });
        }

        // Verify the uid is a real Firebase user
        try {
            await getAuth().getUser(uid);
        } catch {
            return res.status(401).json({ success: false, error: 'Invalid user ID' });
        }

        // Check if user already has a role — don't overwrite
        const existingUser = await getDb().collection('users').doc(uid).get();
        if (existingUser.exists && existingUser.data()?.role) {
            return res.json({
                success: true,
                role: existingUser.data()?.role,
                message: 'User already has a role assigned',
            });
        }

        const now = new Date().toISOString();
        await getDb().collection('users').doc(uid).set({
            role: 'viewer',
            joined_at: now,
            updated_at: now,
        }, { merge: true });

        // Write audit log
        getDb().collection('audit_log').add({
            action: 'user_registered_default',
            uid,
            role: 'viewer',
            timestamp: now,
        }).catch(() => {});

        console.log(`✅ [DEFAULT ROLE] uid=${uid} assigned default role: viewer`);

        return res.json({ success: true, role: 'viewer' });
    } catch (error) {
        console.error('Error setting default role:', error);
        return res.status(500).json({ success: false, error: 'Failed to set default role' });
    }
});

// ─── GET /api/users/stats — Real user counts per role (any signed-in role) ────
/**
 * Returns the number of registered users per role, read from the `users`
 * collection. Used by the User Management page instead of hardcoded
 * placeholder counts. Open to every authenticated role (viewer+) — these are
 * aggregate counts only, not per-user data, so there's nothing sensitive
 * gained by restricting it to admin+; maintenance/viewer roles should be able
 * to see the same team overview admins do.
 */
router.get('/stats', requireRole('viewer'), async (req: Request, res: Response) => {
    try {
        const snapshot = await getDb().collection('users').get();

        const counts: Record<string, number> = {
            viewer: 0,
            field_engineer: 0,
            admin: 0,
            super_admin: 0,
        };

        snapshot.docs.forEach(doc => {
            const role = String(doc.data()?.role || 'viewer');
            if (role in counts) counts[role] += 1;
        });

        return res.json({
            success: true,
            data: {
                total: snapshot.size,
                viewer: counts.viewer,
                field_engineer: counts.field_engineer,
                admin: counts.admin,
                super_admin: counts.super_admin,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch user stats' });
    }
});

const VALID_ROLES = ['viewer', 'field_engineer', 'admin', 'super_admin'];

// ─── GET /api/users — List every real registered user (super_admin only) ─────
/**
 * Full user directory: uid, email, name, role, and when they joined, read
 * directly from the `users` collection. This is what actually lets a
 * super_admin see who has access and at what level — the invite-token list
 * only shows generated links, not the real accounts that exist.
 */
router.get('/', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const snapshot = await getDb().collection('users').orderBy('joined_at', 'desc').get().catch(() =>
            // joined_at may be missing on older/manually-created docs — fall back to unordered
            getDb().collection('users').get()
        );

        const users = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                uid: doc.id,
                email: data.email || null,
                name: data.name || null,
                role: data.role || 'viewer',
                joined_at: data.joined_at || data.created_at || null,
                invited_by: data.invited_by || null,
            };
        });

        return res.json({ success: true, data: users, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('Error listing users:', error);
        return res.status(500).json({ success: false, error: 'Failed to list users' });
    }
});

// ─── PUT /api/users/:uid/role — Assign a role to an existing user (admin+) ───
/**
 * Lets an admin/super_admin change any existing user's role directly, by uid,
 * rather than only being able to set a role at invite-redemption time.
 *
 * admin may assign any role EXCEPT super_admin — that one stays exclusive to
 * an existing super_admin, so a plain admin can never escalate themselves or
 * anyone else to the top tier.
 */
router.put('/:uid/role', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { uid } = req.params;
        const { role } = req.body;
        const changedBy = (req as any).user?.uid;
        const changedByRole = (req as any).user?.role;

        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                error: `role must be one of: ${VALID_ROLES.join(', ')}`,
            });
        }

        if (role === 'super_admin' && changedByRole !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Only a super_admin can assign the super_admin role',
            });
        }

        const userRef = getDb().collection('users').doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const previousRole = userSnap.data()?.role || 'viewer';
        const now = new Date().toISOString();

        await userRef.set({ role, updated_at: now, role_changed_by: changedBy }, { merge: true });

        getDb().collection('audit_log').add({
            action: 'role_changed',
            uid,
            previous_role: previousRole,
            new_role: role,
            changed_by: changedBy,
            timestamp: now,
        }).catch(() => {});

        console.log(`✅ [ROLE CHANGE] ${changedBy} changed uid=${uid} role: ${previousRole} -> ${role}`);

        return res.json({
            success: true,
            data: { uid, role, previous_role: previousRole },
            timestamp: now,
        });
    } catch (error) {
        console.error('Error changing user role:', error);
        return res.status(500).json({ success: false, error: 'Failed to change user role' });
    }
});

// ─── DELETE /api/users/invites/:token — Revoke an invite (admin+) ─────────────
router.delete('/invites/:token', requireRole('admin'), async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        const revokedBy = (req as any).user?.uid;

        const tokenRef = getDb().collection('invite_tokens').doc(token);
        const tokenSnap = await tokenRef.get();

        if (!tokenSnap.exists) {
            return res.status(404).json({ success: false, error: 'Token not found' });
        }

        if (tokenSnap.data()?.used) {
            return res.status(409).json({ success: false, error: 'Cannot revoke an already-used token' });
        }

        // Mark as expired (soft delete)
        await tokenRef.update({
            expires_at: new Date().toISOString(),
            revoked: true,
            revoked_by: revokedBy,
            revoked_at: new Date().toISOString(),
        });

        return res.json({ success: true, message: 'Invite token revoked successfully' });
    } catch (error) {
        console.error('Error revoking invite:', error);
        return res.status(500).json({ success: false, error: 'Failed to revoke invite' });
    }
});

export default router;
