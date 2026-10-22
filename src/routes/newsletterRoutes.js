import express from 'express';
import { subscribe, getSubscribers, deleteSubscriber } from '../controllers/newsletterController.js';
import { requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

// Public route for users to subscribe
router.post('/subscribe', subscribe);

// Admin routes (Main Admin or Sub-Admin with subscribers permission)
router.get('/subscribers', requireModuleAccess('subscribers'), getSubscribers);
router.delete('/subscribers/:id', requireModuleAccess('subscribers', 'delete'), deleteSubscriber);

export default router;
