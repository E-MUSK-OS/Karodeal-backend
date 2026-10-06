import express from 'express';
import { 
  getProducts, 
  getProductBySlug, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  deleteProduct,
  getAdminProducts,
  trackProductClick
} from '../controllers/productController.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Admin-only routes
router.get('/admin', requireAuth, requireAdmin, getAdminProducts);
router.post('/', requireAuth, requireAdmin, createProduct);
router.put('/:id', requireAuth, requireAdmin, updateProduct);
router.delete('/:id', requireAuth, requireAdmin, deleteProduct);

// Public routes (must be at the bottom to avoid matching /admin as a slug)
router.get('/', getProducts);
router.get('/:slug', getProductBySlug);
router.post('/:id/click', optionalAuth, trackProductClick);

export default router;
