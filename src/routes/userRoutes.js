import express from 'express';
import { sendOtp, sendResetOtp, verifyResetOtp, signup, login, getProfile, updateProfile, resetPassword, changePassword, verifyAdmin, getAllUsers, deleteUserAccount } from '../controllers/userController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post('/send-otp', loginLimiter, sendOtp);
router.post('/send-reset-otp', loginLimiter, sendResetOtp);
router.post('/signup', signup);
router.post('/login', loginLimiter, login);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);
router.put('/change-password', requireAuth, changePassword);

// Admin Routes
router.get('/verify-admin', requireAdmin, verifyAdmin);
router.get('/', requireAdmin, getAllUsers);
router.delete('/:id', requireAdmin, deleteUserAccount);

export default router;
