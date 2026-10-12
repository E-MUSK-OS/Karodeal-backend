import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getCategories, createCategory, deleteCategory, updateCategory } from '../controllers/categoryController.js';
import { requireAuth, requireMainAdmin } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.get('/', getCategories);
router.post('/', requireAuth, requireMainAdmin, upload.single('image'), createCategory);
router.put('/:id', requireAuth, requireMainAdmin, upload.single('image'), updateCategory);
router.delete('/:id', requireAuth, requireMainAdmin, deleteCategory);

export default router;
