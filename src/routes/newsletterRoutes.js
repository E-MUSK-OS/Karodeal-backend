import express from 'express';
import { subscribe, getSubscribers, deleteSubscriber } from '../controllers/newsletterController.js';
import { requireMainAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public route for users to subscribe
router.post('/subscribe', subscribe);

// Admin routes (Main Admin only)
router.get('/subscribers', requireMainAdmin, getSubscribers);
router.delete('/subscribers/:id', requireMainAdmin, deleteSubscriber);

export default router;
