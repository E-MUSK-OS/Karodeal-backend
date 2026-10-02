import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getCategories, createCategory, deleteCategory, updateCategory } from '../controllers/categoryController.js';
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

router.get('/', getCategories);
router.post('/', requireAuth, requireAdmin, upload.single('image'), createCategory);
router.put('/:id', requireAuth, requireAdmin, upload.single('image'), updateCategory);
router.delete('/:id', requireAuth, requireAdmin, deleteCategory);

export default router;
