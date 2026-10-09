import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, getMe, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const noop: RequestHandler = (_req, _res, next) => next();

const loginLimiter: RequestHandler = IS_PROD
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
      message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    })
  : noop;

const sensitiveLimiter: RequestHandler = IS_PROD
  ? rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
      message: { message: 'Too many attempts. Please try again later.' },
    })
  : noop;

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.post('/forgot-password', sensitiveLimiter, forgotPassword);
router.post('/reset-password', sensitiveLimiter, resetPassword);

export default router;
