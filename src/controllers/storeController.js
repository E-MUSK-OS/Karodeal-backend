import { PrismaClient } from '@prisma/client';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

const prisma = new PrismaClient();

export const getStores = async (req, res) => {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
};

export const createStore = async (req, res) => {
  try {
    const { name, logoUrl } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Store name is required' });
    }
    if (!logoUrl || !logoUrl.trim()) {
      return res.status(400).json({ error: 'Store logo/image is compulsory' });
    }

    const storeSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let finalLogoUrl = logoUrl.trim();
    if (finalLogoUrl.startsWith('data:image')) {
      finalLogoUrl = await uploadToCloudinary(finalLogoUrl, 'stores');
    }

    const store = await prisma.store.create({
      data: {
        name: name.trim(),
        slug: storeSlug,
        logoUrl: finalLogoUrl
      }
    });
    res.status(201).json(store);
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({ error: 'Failed to create store' });
  }
};

export const updateStore = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logoUrl } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Store name cannot be empty' });
    }
    if (logoUrl !== undefined && !logoUrl.trim()) {
      return res.status(400).json({ error: 'Store logo/image is compulsory' });
    }
    
    const existingStore = await prisma.store.findUnique({ where: { id: id } });
    if (!existingStore) {
      return res.status(404).json({ error: 'Store not found' });
    }

    let finalLogoUrl = existingStore.logoUrl;
    if (logoUrl !== undefined && logoUrl !== existingStore.logoUrl) {
      if (logoUrl && logoUrl.startsWith('data:image')) {
        finalLogoUrl = await uploadToCloudinary(logoUrl, 'stores');
      } else {
        finalLogoUrl = logoUrl;
      }
      if (existingStore.logoUrl && existingStore.logoUrl.includes('cloudinary.com')) {
        await deleteFromCloudinary(existingStore.logoUrl);
      }
    }

    const updateData = {};
    if (name) {
      updateData.name = name;
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (logoUrl !== undefined) {
      updateData.logoUrl = finalLogoUrl || null;
    }

    const store = await prisma.store.update({
      where: { id: id },
      data: updateData
    });
    res.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ error: 'Failed to update store' });
  }
};

export const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const storeId = id;

    const existingStore = await prisma.store.findUnique({ where: { id: storeId } });
    if (existingStore && existingStore.logoUrl && existingStore.logoUrl.includes('cloudinary.com')) {
      await deleteFromCloudinary(existingStore.logoUrl);
    }

    // Delete associated products' images
    const productsToDelete = await prisma.product.findMany({ where: { storeId: storeId } });
    for (const product of productsToDelete) {
      if (product.image && product.image.includes('cloudinary.com')) {
        await deleteFromCloudinary(product.image);
      }
    }

    // Delete associated products first to avoid foreign key constraint errors
    await prisma.product.deleteMany({
      where: { storeId: storeId }
    });

    // Now delete the store
    await prisma.store.delete({
      where: { id: storeId }
    });

    res.json({ message: 'Store and its products deleted successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ error: 'Failed to delete store' });
  }
};
