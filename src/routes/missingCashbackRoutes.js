import express from 'express';
import multer from 'multer';
import { submitTicket, getUserTickets, getAllTickets, updateTicketStatus, updateUserTicket, addMessage, markUserRead, markAdminRead } from '../controllers/missingCashbackController.js';
import { requireAuth, requireModuleAccess } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
});

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

router.post('/', upload.array('orderScreenshots', 3), submitTicket);
router.get('/', getUserTickets);
router.put('/:id', updateUserTicket);
router.post('/:id/messages', upload.single('attachment'), addMessage);
router.put('/:id/read', markUserRead);

// Admin routes (Main Admin or Sub-Admin with missing-cashback permission)
router.get('/admin', requireModuleAccess('missing-cashback'), getAllTickets);
router.put('/admin/:id', requireModuleAccess('missing-cashback', 'update'), updateTicketStatus);
router.post('/admin/:id/messages', requireModuleAccess('missing-cashback', 'update'), upload.single('attachment'), addMessage);
router.put('/admin/:id/read', requireModuleAccess('missing-cashback', 'update'), markAdminRead);

export default router;
