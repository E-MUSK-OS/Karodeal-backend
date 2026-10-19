import { PrismaClient } from '@prisma/client';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

const prisma = new PrismaClient();

export const getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Category image is compulsory' });
    }

    const categorySlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const imageUrl = await uploadToCloudinary(req.file.buffer, 'categories');

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug: categorySlug,
        image: imageUrl
      }
    });
    res.status(201).json({ ...category, _count: { products: 0 } });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const existingCategory = await prisma.category.findUnique({ where: { id: id } });
    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updateData = {};
    if (name) {
      updateData.name = name;
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    
    if (req.file) {
      updateData.image = await uploadToCloudinary(req.file.buffer, 'categories');
      if (existingCategory.image && existingCategory.image.includes('cloudinary.com')) {
        await deleteFromCloudinary(existingCategory.image);
      }
    }

    const category = await prisma.category.update({
      where: { id: id },
      data: updateData,
      include: {
        _count: {
          select: { products: true }
        }
      }
    });
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = id;

    const existingCategory = await prisma.category.findUnique({ where: { id: categoryId } });
    if (existingCategory && existingCategory.image && existingCategory.image.includes('cloudinary.com')) {
      await deleteFromCloudinary(existingCategory.image);
    }

    // Delete associated products' images
    const productsToDelete = await prisma.product.findMany({ where: { categoryId: categoryId } });
    for (const product of productsToDelete) {
      if (product.image && product.image.includes('cloudinary.com')) {
        await deleteFromCloudinary(product.image);
      }
    }

    // Delete associated products first to avoid foreign key constraint errors
    await prisma.product.deleteMany({
      where: { categoryId: categoryId }
    });

    // Now delete the category
    await prisma.category.delete({
      where: { id: categoryId }
    });
    
    res.json({ message: 'Category and its products deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};
