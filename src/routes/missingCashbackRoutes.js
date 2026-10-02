import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { submitTicket, getUserTickets, getAllTickets, updateTicketStatus, updateUserTicket, addMessage, markUserRead, markAdminRead } from '../controllers/missingCashbackController.js';
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

// Apply auth middleware to all routes
router.use(requireAuth);

router.post('/', upload.array('orderScreenshots', 3), submitTicket);
router.get('/', getUserTickets);
router.put('/:id', updateUserTicket);
router.post('/:id/messages', upload.single('attachment'), addMessage);
router.put('/:id/read', markUserRead);

// Admin routes
router.get('/admin', requireAdmin, getAllTickets);
router.put('/admin/:id', requireAdmin, updateTicketStatus);
router.post('/admin/:id/messages', requireAdmin, upload.single('attachment'), addMessage);
router.put('/admin/:id/read', requireAdmin, markAdminRead);

export default router;
