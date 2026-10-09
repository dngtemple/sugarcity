import { Router, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createOrder,
  createWalkinOrder,
  listOrders,
  getOrderSummary,
  getSalesReport,
  getOrderById,
  getOrderBoard,
  updateOrderStatus,
  updateOrderPayment,
  trackOrder,
} from '../controllers/order.controller';
import { staffOnly } from '../middleware/auth.middleware';

const router = Router();
const IS_PROD = process.env.NODE_ENV === 'production';
const noop: RequestHandler = (_req, _res, next) => next();

// Checkout is public, so cap it per visitor. Generous on purpose: a real
// customer never gets near it, but a script can't flood the orders list.
const orderLimiter: RequestHandler = IS_PROD
  ? rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
      message: { message: 'Too many orders from this device. Please try again in a few minutes.' },
    })
  : noop;

// Tracking is public too. Enough for a customer refreshing now and then;
// too few to guess phone numbers against an order number.
const trackLimiter: RequestHandler = IS_PROD
  ? rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
      message: { message: 'Too many lookups from this device. Please try again in a few minutes.' },
    })
  : noop;

router.post('/', orderLimiter, createOrder);
router.get('/track', trackLimiter, trackOrder);
router.post('/walkin', ...staffOnly, createWalkinOrder);
router.get('/summary', ...staffOnly, getOrderSummary);
router.get('/board', ...staffOnly, getOrderBoard);
router.get('/sales', ...staffOnly, getSalesReport);
router.get('/', ...staffOnly, listOrders);
router.get('/:id', ...staffOnly, getOrderById);
router.put('/:id/status', ...staffOnly, updateOrderStatus);
router.put('/:id/payment', ...staffOnly, updateOrderPayment);

export default router;
