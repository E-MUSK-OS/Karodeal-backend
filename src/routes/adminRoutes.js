import express from 'express';
import { getAdminStats, getProductClicks } from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get real-time stats for admin dashboard
router.get('/stats', requireAuth, requireAdmin, getAdminStats);
router.get('/clicks', requireAuth, requireAdmin, getProductClicks);

export default router;
