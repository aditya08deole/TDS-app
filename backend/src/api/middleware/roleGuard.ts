import { NextFunction, Request, Response } from 'express';

type UserRole = 'viewer' | 'field_engineer' | 'admin' | 'super_admin';

const roleRank: Record<UserRole, number> = {
  viewer: 0,
  field_engineer: 1,
  admin: 2,
  super_admin: 3,
};

function normalizeRole(roleHeader: unknown): UserRole {
  const role = String(roleHeader || '').toLowerCase();
  if (role === 'field_engineer' || role === 'admin' || role === 'super_admin') {
    return role;
  }
  return 'viewer';
}

export function requireRole(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = normalizeRole(req.headers['x-user-role']);
    if (roleRank[role] < roleRank[minRole]) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: ${minRole} role required`,
        timestamp: new Date().toISOString(),
      });
    }
    next();
  };
}
