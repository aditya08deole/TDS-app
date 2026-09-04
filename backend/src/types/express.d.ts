// Augments Express's Request type with the identity requireRole() attaches
// after verifying a Firebase ID token, so route handlers can read req.user
// directly instead of casting through `(req as any).user` everywhere.
export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        role: 'viewer' | 'field_engineer' | 'admin' | 'super_admin';
        email?: string;
      };
    }
  }
}
