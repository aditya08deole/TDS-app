import { NextFunction, Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getRedisClient } from '../../db/redis';

// ─── Role Hierarchy ────────────────────────────────────────────────────────
// Canonical roles — MUST match AuthContext.tsx and RoleContext.tsx (Fix #4)
type UserRole = 'viewer' | 'field_engineer' | 'admin' | 'super_admin';

const roleRank: Record<UserRole, number> = {
  viewer: 0,
  field_engineer: 1,
  admin: 2,
  super_admin: 3,
};

function normalizeRole(role: unknown): UserRole {
  const r = String(role || '').toLowerCase();
  if (r === 'field_engineer' || r === 'admin' || r === 'super_admin') {
    return r as UserRole;
  }
  return 'viewer';
}

// ─── Role Cache ──────────────────────────────────────────────────────────
// Without this, requireRole() hit Firestore on every single authenticated
// request. A 60s TTL trades a little staleness (a just-changed role can take
// up to 60s to take effect on requests that don't go through the invalidation
// path below) for removing a network round-trip from the hot path of every
// API call.
const ROLE_CACHE_KEY = (uid: string) => `cache:role:${uid}`;
const ROLE_CACHE_TTL = 60; // seconds

/** Invalidates the cached role for a uid — call after any role write. */
export async function invalidateRoleCache(uid: string): Promise<void> {
  try {
    await getRedisClient().del(ROLE_CACHE_KEY(uid));
  } catch (err) {
    console.warn(`[roleGuard] Could not invalidate role cache for uid ${uid}:`, err);
  }
}

/**
 * Looks up the user's role from Firestore users/{uid} document, via a
 * short-lived Redis cache. Returns 'viewer' if the document doesn't exist,
 * role is unset, or Redis is unavailable (cache is best-effort — Firestore
 * remains the source of truth).
 */
async function getUserRoleFromFirestore(uid: string): Promise<UserRole> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(ROLE_CACHE_KEY(uid));
    if (cached) return normalizeRole(cached);
  } catch {
    // Redis unavailable — fall through to Firestore directly.
  }

  let role: UserRole = 'viewer';
  try {
    const snap = await getFirestore().collection('users').doc(uid).get();
    if (snap.exists) {
      role = normalizeRole(snap.data()?.role);
    }
  } catch (err) {
    console.warn(`[roleGuard] Could not read role for uid ${uid}:`, err);
    return role;
  }

  try {
    await getRedisClient().set(ROLE_CACHE_KEY(uid), role, { EX: ROLE_CACHE_TTL });
  } catch {
    // Best-effort — a failed cache write shouldn't fail the request.
  }

  return role;
}

/**
 * requireRole — Firebase-verified role middleware (Fix #5)
 *
 * BEFORE: Trusted the x-user-role header — any client could spoof admin access.
 * AFTER:  Validates Firebase ID token from Authorization header, then reads the
 *         user's actual role from Firestore. Completely spoofing-resistant.
 *
 * Usage:  router.post('/admin-action', requireRole('admin'), handler)
 *
 * Frontend must send: Authorization: Bearer <firebase_id_token>
 */
export function requireRole(minRole: UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ── 1. Extract Bearer token ──────────────────────────────────────────
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized — missing Authorization: Bearer <token> header',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      // ── 2. Verify token with Firebase ──────────────────────────────────
      const decoded = await getAuth().verifyIdToken(token);

      // ── 3. Read actual role from Firestore ────────────────────────────
      const role = await getUserRoleFromFirestore(decoded.uid);

      // ── 4. Check rank ─────────────────────────────────────────────────
      if (roleRank[role] < roleRank[minRole]) {
        return res.status(403).json({
          success: false,
          error: `Forbidden — ${minRole} role required, current role: ${role}`,
          timestamp: new Date().toISOString(),
        });
      }

      // ── 5. Attach verified identity to request ─────────────────────────
      req.user = { uid: decoded.uid, role, email: decoded.email };
      next();
    } catch (err: any) {
      // Firebase throws for expired/malformed/revoked tokens, but ALSO for a
      // token issued by a different Firebase project than this Admin SDK is
      // initialized for (wrong service account) — that case looks identical
      // to a normal 401 here, so flag it explicitly to save the next person
      // a debugging session: check the "connected to project" log line this
      // process printed on startup (see initializeFirebase in server.ts)
      // against the frontend's VITE_FIREBASE_PROJECT_ID.
      const code = err.code || '';
      const looksLikeProjectMismatch = code === 'auth/argument-error' ||
        /audience|project|aud claim/i.test(String(err.message || ''));
      console.warn(
        `[roleGuard] Token verification failed: ${code || err.message}` +
        (looksLikeProjectMismatch
          ? ' — this error shape usually means the token was issued by a DIFFERENT Firebase project than this backend is initialized for. Check the "Firebase Admin initialized... connected to project" log line at startup against the frontend project ID.'
          : '')
      );
      return res.status(401).json({
        success: false,
        error: 'Unauthorized — invalid or expired token',
        timestamp: new Date().toISOString(),
      });
    }
  };
}
