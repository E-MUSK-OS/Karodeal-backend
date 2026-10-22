import express from 'express';
import { getStores, createStore, deleteStore, updateStore } from '../controllers/storeController.js';
import { requireAuth, requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getStores);
router.post('/', requireAuth, requireModuleAccess('stores', 'add'), createStore);
router.put('/:id', requireAuth, requireModuleAccess('stores', 'update'), updateStore);
router.delete('/:id', requireAuth, requireModuleAccess('stores', 'delete'), deleteStore);

export default router;
