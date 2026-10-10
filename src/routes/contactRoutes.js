import express from 'express';
import { submitContactForm, getContactMessages, deleteContactMessage } from '../controllers/contactController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public route to submit a contact message
router.post('/', submitContactForm);

// Admin routes
router.get('/messages', requireAdmin, getContactMessages);
router.delete('/messages/:id', requireAdmin, deleteContactMessage);

export default router;
