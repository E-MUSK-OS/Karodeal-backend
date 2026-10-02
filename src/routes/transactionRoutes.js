import express from 'express';
import { getUserTransactions } from '../controllers/transactionController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);
router.get('/', getUserTransactions);

export default router;
