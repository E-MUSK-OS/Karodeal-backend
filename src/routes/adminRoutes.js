import express from 'express';
import { getAdminStats, getProductClicks } from '../controllers/adminController.js';
import { getAnalyticsVisitors, getAnalyticsVisitorDetail } from '../controllers/analyticsController.js';
import { requireAuth, requireAdmin, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

// Get real-time stats for admin dashboard
router.get('/stats', requireAuth, requireAdmin, getAdminStats);
router.get('/clicks', requireModuleAccess('clicks'), getProductClicks);

// Visitor Analytics
router.get('/analytics/visitors', requireModuleAccess('visitor-analytics'), getAnalyticsVisitors);
router.get('/analytics/visitors/:visitorId', requireModuleAccess('visitor-analytics'), getAnalyticsVisitorDetail);

export default router;

