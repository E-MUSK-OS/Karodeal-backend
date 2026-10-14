import express from 'express';
import { 
  getProducts, 
  getProductBySlug, 
  createProduct,
  createProductsBulk,
  updateProduct, 
  deleteProduct,
  getAdminProducts,
  trackProductClick,
  reorderProducts,
  getProductsSyncState,
  togglePinProduct
} from '../controllers/productController.js';
import { requireAuth, requireAdmin, requireMainAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Admin-only routes
router.get('/admin', requireAuth, requireAdmin, getAdminProducts);
router.put('/reorder', requireAuth, requireMainAdmin, reorderProducts);
router.put('/:id/pin', requireAuth, requireAdmin, togglePinProduct);
router.post('/bulk', requireAuth, requireAdmin, createProductsBulk);
router.post('/', requireAuth, requireAdmin, createProduct);
router.put('/:id', requireAuth, requireAdmin, updateProduct);
router.delete('/:id', requireAuth, requireAdmin, deleteProduct);

// Public routes (must be at the bottom to avoid matching /admin as a slug)
router.get('/', getProducts);
router.get('/sync-state', getProductsSyncState);
router.get('/:slug', getProductBySlug);
router.post('/:id/click', optionalAuth, trackProductClick);

export default router;
