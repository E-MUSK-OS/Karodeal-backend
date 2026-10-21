import express from 'express';
import { getAdminStats, getProductClicks } from '../controllers/adminController.js';
import { getAnalyticsVisitors, getAnalyticsVisitorDetail } from '../controllers/analyticsController.js';
import { requireAuth, requireAdmin, requireMainAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get real-time stats for admin dashboard
router.get('/stats', requireAuth, requireAdmin, getAdminStats);
router.get('/clicks', requireAuth, requireAdmin, getProductClicks);

// Visitor Analytics - Main Admin Only
router.get('/analytics/visitors', requireAuth, requireMainAdmin, getAnalyticsVisitors);
router.get('/analytics/visitors/:visitorId', requireAuth, requireMainAdmin, getAnalyticsVisitorDetail);

export default router;

