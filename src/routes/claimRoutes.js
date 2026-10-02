import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { submitClaim, getUserClaims, getAllClaims, updateClaimStatus, updateAwardedCashback } from '../controllers/claimController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

const router = express.Router();

router.use(requireAuth);

router.post('/', upload.fields([{ name: 'invoice', maxCount: 1 }, { name: 'review', maxCount: 1 }, { name: 'noReturn', maxCount: 1 }]), submitClaim);
router.get('/', getUserClaims);

// Admin routes
router.get('/admin', requireAdmin, getAllClaims);
router.put('/admin/:id', requireAdmin, updateClaimStatus);
router.put('/admin/:id/cashback', requireAdmin, updateAwardedCashback);

export default router;
