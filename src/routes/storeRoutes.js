import express from 'express';
import { getStores, createStore, deleteStore, updateStore } from '../controllers/storeController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getStores);
router.post('/', requireAuth, requireAdmin, createStore);
router.put('/:id', requireAuth, requireAdmin, updateStore);
router.delete('/:id', requireAuth, requireAdmin, deleteStore);

export default router;
