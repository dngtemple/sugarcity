import { Response } from 'express';
import User from '../models/User.model';
import { AuthRequest, invalidateAuthCache } from '../middleware/auth.middleware';
import { STAFF_ROLES } from '../config/roles';
import { logAudit } from '../lib/audit';
import { sendStaffWelcomeEmail } from '../lib/mailer';

const staffJson = (u: any) => ({
  id: u.id ?? u._id?.toString(),
  name: u.name,
  email: u.email,
  phone: u.phone,
  active: u.active !== false,
  createdAt: u.createdAt,
  lastLoginAt: u.lastLoginAt,
});

export const listStaff = async (_req: AuthRequest, res: Response, next: any) => {
  try {
    const users = await User.find({ role: { $in: STAFF_ROLES } }).select('-password').sort({ name: 1 }).lean();
    res.json({ users: users.map(staffJson) });
  } catch (err) { next(err); }
};

// Every staff account has the same access, so new accounts are simply 'staff'.
export const createStaff = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!name || !email || !password) {
      res.status(400).json({ message: 'Name, email and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }
    const exists = await User.findOne({ email }).select('_id').lean();
    if (exists) {
      res.status(400).json({ message: 'An account with this email already exists' });
      return;
    }

    const user = await User.create({ name, email, password, phone, role: 'staff' });
    logAudit({ actorId: req.user?.id, action: 'user.created', entity: 'user', entityId: user.id, meta: { email } });
    res.status(201).json({ user: staffJson(user) });

    // The password isn't emailed; whoever added them passes it on.
    sendStaffWelcomeEmail({ name: user.name, email: user.email })
      .catch((err) => console.error('[Mailer] Failed to send staff welcome email:', err));
  } catch (err) { next(err); }
};

export const updateStaff = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const { name, phone, active, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || !STAFF_ROLES.includes(user.role)) {
      res.status(404).json({ message: 'Staff account not found' });
      return;
    }

    const changes: Record<string, any> = {};
    if (typeof name === 'string' && name.trim() && name.trim() !== user.name) {
      changes.name = { from: user.name, to: name.trim() };
      user.name = name.trim();
    }
    if (typeof phone === 'string' && phone.trim() !== user.phone) {
      changes.phone = { from: user.phone, to: phone.trim() };
      user.phone = phone.trim();
    }
    if (typeof active === 'boolean' && active !== user.active) {
      if (req.user?.id === user.id && !active) {
        res.status(400).json({ message: 'You cannot turn off your own account' });
        return;
      }
      changes.active = { from: user.active, to: active };
      user.active = active;
    }
    if (typeof password === 'string' && password.length > 0) {
      if (password.length < 6) {
        res.status(400).json({ message: 'Password must be at least 6 characters' });
        return;
      }
      changes.password = 'updated';
      user.password = password;
    }

    await user.save();
    if (Object.keys(changes).length > 0) {
      logAudit({ actorId: req.user?.id, action: 'user.updated', entity: 'user', entityId: user.id, meta: changes });
      // Apply an on/off change on the user's very next request instead of
      // after the auth cache TTL elapses.
      invalidateAuthCache(user.id);
    }
    res.json({ user: staffJson(user) });
  } catch (err) { next(err); }
};
