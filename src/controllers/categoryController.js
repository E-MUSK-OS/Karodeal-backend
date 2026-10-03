import { PrismaClient } from '@prisma/client';
import { uploadToCloudinary } from '../utils/cloudinary.js';

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
    const { name, slug } = req.body;
    const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    
    let imageUrl = null;
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer, 'categories');
    }

    const category = await prisma.category.create({
      data: {
        name,
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
    const { name, slug } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;
    
    if (req.file) {
      updateData.image = await uploadToCloudinary(req.file.buffer, 'categories');
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
