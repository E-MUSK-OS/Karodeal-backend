import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  recordSession,
  recordPageEnter,
  recordHeartbeat,
  recordPageExit
} from '../controllers/analyticsController.js';

const router = express.Router();

// Rate limiter for public analytics tracking endpoints
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 180, // allows frequent heartbeats + route changes across multiple open tabs
  message: { error: 'Too many analytics events, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/session', analyticsLimiter, recordSession);
router.post('/page-enter', analyticsLimiter, recordPageEnter);
router.post('/heartbeat', analyticsLimiter, recordHeartbeat);
router.post('/page-exit', analyticsLimiter, recordPageExit);

export default router;
