import express from 'express';
import { createPayoutRequest, getUserPayouts, getAdminPayouts, processPayout } from '../controllers/payoutController.js';
import { requireAuth, requireMainAdmin } from '../middleware/auth.js';

const router = express.Router();

// User routes
router.post('/', requireAuth, createPayoutRequest);
router.get('/history', requireAuth, getUserPayouts);

// Admin routes (Main Admin only)
router.get('/admin', requireAuth, requireMainAdmin, getAdminPayouts);
router.put('/admin/:id', requireAuth, requireMainAdmin, processPayout);

export default router;
