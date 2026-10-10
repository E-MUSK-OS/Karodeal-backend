import express from 'express';
import { sendOtp, sendResetOtp, verifyResetOtp, signup, login, googleLogin, verifyGoogleOtp, getProfile, updateProfile, resetPassword, changePassword, verifyAdmin, getAllUsers, deleteUserAccount } from '../controllers/userController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Temporarily increased for testing/development
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

router.post('/send-otp', loginLimiter, sendOtp);
router.post('/send-reset-otp', loginLimiter, sendResetOtp);
router.post('/signup', signup);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleLogin);
router.post('/verify-google-otp', loginLimiter, verifyGoogleOtp);
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
