import { PrismaClient } from '@prisma/client';

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
    const { name, slug, logoUrl } = req.body;
    const storeSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    const store = await prisma.store.create({
      data: {
        name,
        slug: storeSlug,
        logoUrl: logoUrl || null
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
    const { name, slug, logoUrl } = req.body;

    const updateData = {
      name,
      logoUrl: logoUrl || null
    };

    if (slug) {
      updateData.slug = slug;
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
