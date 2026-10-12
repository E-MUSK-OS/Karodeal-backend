import express from 'express';
import { getStores, createStore, deleteStore, updateStore } from '../controllers/storeController.js';
import { requireAuth, requireMainAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getStores);
router.post('/', requireAuth, requireMainAdmin, createStore);
router.put('/:id', requireAuth, requireMainAdmin, updateStore);
router.delete('/:id', requireAuth, requireMainAdmin, deleteStore);

export default router;
