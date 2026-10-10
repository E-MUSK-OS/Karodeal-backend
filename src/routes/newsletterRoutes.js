import express from 'express';
import { subscribe, getSubscribers, deleteSubscriber } from '../controllers/newsletterController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public route for users to subscribe
router.post('/subscribe', subscribe);

// Admin routes
router.get('/subscribers', requireAdmin, getSubscribers);
router.delete('/subscribers/:id', requireAdmin, deleteSubscriber);

export default router;
