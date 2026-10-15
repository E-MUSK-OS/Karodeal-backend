import express from 'express';
import {
  createReviewRequest,
  getReviewRequests,
  getStarStats,
  approveReviewRequest,
  declineReviewRequest
} from '../controllers/reviewRequestController.js';
import { requireAuth, requireAdmin, requireMainAdmin } from '../middleware/auth.js';

const router = express.Router();

// List all review requests (Admin sees all, Sub-Admin sees their own)
router.get('/', requireAuth, requireAdmin, getReviewRequests);

// Get current Star Products stats and available ranks
router.get('/star-stats', requireAuth, requireAdmin, getStarStats);

// Submit a review request (Sub-Admin or Admin)
router.post('/', requireAuth, requireAdmin, createReviewRequest);

// Approve a review request (Main Admin only)
router.put('/:id/approve', requireAuth, requireMainAdmin, approveReviewRequest);

// Decline a review request (Main Admin only)
router.put('/:id/decline', requireAuth, requireMainAdmin, declineReviewRequest);

export default router;
