import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.model';
import { isStaffRole } from '../config/roles';
import { adminUrl, sendPasswordResetEmail } from '../lib/mailer';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const signToken = (id: string, role: string) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN as any });

const hashToken = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

// Only staff sign in now — customers order without an account.
export const login = async (req: Request, res: Response, next: any) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const role = user.role;
    if (!isStaffRole(role)) {
      res.status(403).json({ message: 'This account does not have access to the admin panel' });
      return;
    }
    if (!user.active) {
      res.status(403).json({ message: 'This account has been deactivated' });
      return;
    }

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const token = signToken(user.id, role);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role },
    });
  } catch (err) { next(err); }
};

export const logout = (_req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
};

export const forgotPassword = async (req: Request, res: Response, next: any) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      res.status(400).json({ message: 'Email is required' });
      return;
    }

    // Always respond the same way so attackers can't enumerate accounts.
    const genericResponse = { message: 'If an account exists for that email, a reset link has been sent.' };

    const user = await User.findOne({ email });
    if (!user || !user.active || !isStaffRole(user.role)) {
      res.json(genericResponse);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await user.save();

    const baseUrl = adminUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    res.json(genericResponse);

    console.log(`[Auth] Triggering password-reset email for ${user.email} -> ${baseUrl}`);
    sendPasswordResetEmail({
      name: user.name,
      email: user.email,
      resetUrl,
      expiresInMinutes: Math.round(RESET_TOKEN_TTL_MS / 60000),
    }).catch((err) =>
      console.error(`[Mailer] Failed to send password-reset email to ${user.email}:`, err)
    );
  } catch (err) { next(err); }
};

export const resetPassword = async (req: Request, res: Response, next: any) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ message: 'Reset token and new password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpires');

    if (!user) {
      res.status(400).json({ message: 'This reset link is invalid or has expired' });
      return;
    }

    user.password = password;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) { next(err); }
};

export const getMe = async (req: Request & { user?: { id: string } }, res: Response, next: any) => {
  try {
    const user = await User.findById(req.user?.id).select('-password');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        active: user.active,
      },
    });
  } catch (err) { next(err); }
};
