import express from 'express';
import multer from 'multer';
import { submitClaim, getUserClaims, getAllClaims, updateClaimStatus, updateAwardedCashback } from '../controllers/claimController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
});

const router = express.Router();

router.use(requireAuth);

router.post('/', upload.fields([{ name: 'invoice', maxCount: 1 }, { name: 'review', maxCount: 1 }, { name: 'noReturn', maxCount: 1 }]), submitClaim);
router.get('/', getUserClaims);

// Admin routes (Both Admin & Sub-Admin, with product author isolation for sub-admins)
router.get('/admin', requireAdmin, getAllClaims);
router.put('/admin/:id', requireAdmin, updateClaimStatus);
router.put('/admin/:id/cashback', requireAdmin, updateAwardedCashback);

export default router;
