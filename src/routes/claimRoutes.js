import express from 'express';
import multer from 'multer';
import { submitClaim, getUserClaims, getAllClaims, updateClaimStatus, updateAwardedCashback } from '../controllers/claimController.js';
import { requireAuth, requireModuleAccess } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
});

const router = express.Router();

router.use(requireAuth);

router.post('/', upload.fields([{ name: 'invoice', maxCount: 1 }, { name: 'review', maxCount: 1 }, { name: 'noReturn', maxCount: 1 }]), submitClaim);
router.get('/', getUserClaims);

// Admin routes (Main Admin or Sub-Admin with claims permission)
router.get('/admin', requireModuleAccess('claims'), getAllClaims);
router.put('/admin/:id', requireModuleAccess('claims', 'update'), updateClaimStatus);
router.put('/admin/:id/cashback', requireModuleAccess('claims', 'update'), updateAwardedCashback);

export default router;
