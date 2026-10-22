import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getCategories, createCategory, deleteCategory, updateCategory } from '../controllers/categoryController.js';
import { requireAuth, requireModuleAccess } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = express.Router();

router.get('/', getCategories);
router.post('/', requireAuth, requireModuleAccess('categories', 'add'), upload.single('image'), createCategory);
router.put('/:id', requireAuth, requireModuleAccess('categories', 'update'), upload.single('image'), updateCategory);
router.delete('/:id', requireAuth, requireModuleAccess('categories', 'delete'), deleteCategory);

export default router;
