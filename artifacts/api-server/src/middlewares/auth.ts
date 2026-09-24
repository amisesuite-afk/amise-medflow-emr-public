import { Request, Response, NextFunction } from 'express';
import { sb, verifyStaffToken, type StaffIdentity } from '../lib/supabase.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
      staffUser?: StaffIdentity;
      patientAuth?: { accountId: string; patientId: string; email: string };
    }
  }
}

/**
 * Staff-only gate (Express middleware form of requireStaffAuth, without the
 * x-staff-token machine path). Validates the Supabase JWT and requires a
 * `user_profiles` row with a staff role — a valid token from a patient-portal
 * user (same Supabase project, no staff profile) is rejected with 403.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const result = await verifyStaffToken(header.slice(7).trim());
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  req.staffUser = result.staff;
  req.userId = result.staff.userId;
  req.userRole = result.staff.role;
  next();
}

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    try {
      const { data, error } = await sb()
        .from('user_profiles')
        .select('role')
        .eq('id', req.userId)
        .single();
      if (error || !data || !roles.includes(data.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      req.userRole = data.role as string;
      next();
    } catch {
      res.status(403).json({ error: 'Role check failed' });
    }
  };
}
