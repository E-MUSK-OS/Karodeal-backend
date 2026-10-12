import express from 'express';
import { submitContactForm, getContactMessages, deleteContactMessage } from '../controllers/contactController.js';
import { requireMainAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public route to submit a contact message
router.post('/', submitContactForm);

// Admin routes (Main Admin only)
router.get('/messages', requireMainAdmin, getContactMessages);
router.delete('/messages/:id', requireMainAdmin, deleteContactMessage);

export default router;
