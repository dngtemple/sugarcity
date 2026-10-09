import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.model';
import { isStaffRole } from '../config/roles';

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

// Short-lived cache of the per-user fields protect() needs (active flag +
// role). Without it, every authenticated request makes an extra round-trip
// to the (remote) database purely to authorise. Entries expire quickly, so a
// disabled account is still picked up within AUTH_CACHE_TTL — and
// updateStaff() calls invalidateAuthCache() to apply changes immediately.
interface CachedAuthUser {
  active: boolean;
  role: string;
  expiresAt: number;
}

const authCache = new Map<string, CachedAuthUser>();
const AUTH_CACHE_TTL = 60_000; // 60s

export const invalidateAuthCache = (userId: string) => {
  authCache.delete(userId);
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };

    let entry = authCache.get(decoded.id);
    if (!entry || entry.expiresAt <= Date.now()) {
      const user = await User.findById(decoded.id).select('active role').lean();
      if (!user) {
        authCache.delete(decoded.id);
        res.status(401).json({ message: 'Account no longer exists' });
        return;
      }
      // Only an explicit `false` disables an account.
      entry = {
        active: user.active !== false,
        role: user.role,
        expiresAt: Date.now() + AUTH_CACHE_TTL,
      };
      authCache.set(decoded.id, entry);
    }

    if (!entry.active) {
      res.status(403).json({ message: 'Account is disabled' });
      return;
    }
    req.user = { id: decoded.id, role: entry.role };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireStaff = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!isStaffRole(req.user?.role)) {
    res.status(403).json({ message: 'Staff access required' });
    return;
  }
  next();
};

/** Signed-in, active staff account — the only gate the admin API needs. */
export const staffOnly = [protect, requireStaff];
