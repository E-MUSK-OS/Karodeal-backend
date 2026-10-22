import express from 'express';
import { createPayoutRequest, getUserPayouts, getAdminPayouts, processPayout } from '../controllers/payoutController.js';
import { requireAuth, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

// User routes
router.post('/', requireAuth, createPayoutRequest);
router.get('/history', requireAuth, getUserPayouts);

// Admin routes (Main Admin or Sub-Admin with payouts permission)
router.get('/admin', requireModuleAccess('payouts'), getAdminPayouts);
router.put('/admin/:id', requireModuleAccess('payouts', 'update'), processPayout);

export default router;
