import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './lib/db';
import { verifyMailer } from './lib/mailer';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import orderRoutes from './routes/order.routes';
import settingsRoutes from './routes/settings.routes';
import userRoutes from './routes/user.routes';
import inventoryRoutes from './routes/inventory.routes';

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL', 'ADMIN_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 5050;
const IS_PROD = process.env.NODE_ENV === 'production';

// In production the app sits behind Render's proxies. Without this, req.ip is
// the proxy's address and every visitor shares one rate-limit bucket — a busy
// hour of real orders would lock everyone out. Trusting the whole chain means
// a determined client could spoof its IP to dodge the limit, which is the
// better failure for a shop that must never turn real customers away.
if (IS_PROD) app.set('trust proxy', true);

// Each may be a comma-separated list (e.g. the Vercel domain plus a custom
// domain). Trailing slashes are dropped — browsers never send them in Origin.
const allowedOrigins = [process.env.CLIENT_URL!, process.env.ADMIN_URL!]
  .flatMap((v) => v.split(','))
  .map((v) => v.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // In dev, accept any localhost / 127.0.0.1 origin so vite port-bumping
    // and tools like curl don't break local testing.
    if (!IS_PROD && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory', inventoryRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // A malformed id in the URL (e.g. a cut-off link from an email) means the
  // record doesn't exist — answer 404 instead of a server error.
  if (err.name === 'CastError' && err.path === '_id') {
    res.status(404).json({ message: 'Not found' });
    return;
  }
  console.error(err);
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  const message = IS_PROD && status >= 500
    ? 'Internal server error'
    : (err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 5 MB)' : err.message || 'Internal server error');
  res.status(status).json({ message });
});

connectDB().then(() => {
  verifyMailer();
  app
    .listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
    .on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `[startup] Port ${PORT} is already in use — another copy of the server is probably still running. ` +
            'Stop it (or set PORT to a different number) and start again.'
        );
        process.exit(1);
      }
      throw err;
    });
});
