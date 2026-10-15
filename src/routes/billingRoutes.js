import express from 'express';
import { getBillingData } from '../controllers/billingController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Allow both Main Admin and Sub-Admin
router.get('/', requireAdmin, getBillingData);

export default router;
