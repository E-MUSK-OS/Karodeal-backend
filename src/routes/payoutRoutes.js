import express from 'express';
import { createPayoutRequest, getUserPayouts, getAdminPayouts, processPayout } from '../controllers/payoutController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// User routes
router.post('/', requireAuth, createPayoutRequest);
router.get('/history', requireAuth, getUserPayouts);

// Admin routes
router.get('/admin', requireAuth, requireAdmin, getAdminPayouts);
router.put('/admin/:id', requireAuth, requireAdmin, processPayout);

export default router;
