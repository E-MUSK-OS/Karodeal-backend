import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getCategories, createCategory, deleteCategory, updateCategory } from '../controllers/categoryController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.get('/', getCategories);
router.post('/', requireAuth, requireAdmin, upload.single('image'), createCategory);
router.put('/:id', requireAuth, requireAdmin, upload.single('image'), updateCategory);
router.delete('/:id', requireAuth, requireAdmin, deleteCategory);

export default router;
