import { Request, Response, NextFunction } from 'express';
import { sb } from '../lib/supabase.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
      patientAuth?: { accountId: string; patientId: string; email: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = header.slice(7);
  try {
    const { data: { user }, error } = await sb().auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ error: 'Auth verification failed' });
  }
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
