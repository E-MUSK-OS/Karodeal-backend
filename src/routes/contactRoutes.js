import express from 'express';
import { submitContactForm, getContactMessages, deleteContactMessage } from '../controllers/contactController.js';
import { requireModuleAccess } from '../middleware/auth.js';

const router = express.Router();

// Public route to submit a contact message
router.post('/', submitContactForm);

// Admin routes (Main Admin or Sub-Admin with messages permission)
router.get('/messages', requireModuleAccess('messages'), getContactMessages);
router.delete('/messages/:id', requireModuleAccess('messages', 'delete'), deleteContactMessage);

export default router;
