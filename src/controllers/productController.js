import { PrismaClient } from '@prisma/client';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
const prisma = new PrismaClient();

// Get all products
export const getProducts = async (req, res) => {
  try {
    const now = new Date();
    await prisma.product.updateMany({
      where: { isActive: true, expiresAt: { not: null, lte: now } },
      data: { isActive: false }
    }).catch(() => {});

    const products = await prisma.product.findMany({
      where: { 
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: { 
        storeRel: { select: { id: true, name: true, logoUrl: true, slug: true } }, 
        categoryRel: { select: { id: true, name: true, slug: true } } 
      }
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// Get all products (Admin only - includes inactive)
export const getAdminProducts = async (req, res) => {
  try {
    const now = new Date();
    await prisma.product.updateMany({
      where: { isActive: true, expiresAt: { not: null, lte: now } },
      data: { isActive: false }
    }).catch(() => {});

    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        storeRel: { select: { id: true, name: true, logoUrl: true, slug: true } }, 
        categoryRel: { select: { id: true, name: true, slug: true } } 
      }
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching admin products:', error);
    res.status(500).json({ error: 'Failed to fetch admin products' });
  }
};

// Get single product by slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await prisma.product.findUnique({
      where: { slug },
      include: { 
        storeRel: { select: { id: true, name: true, logoUrl: true, slug: true } }, 
        categoryRel: { select: { id: true, name: true, slug: true } } 
      }
    });
    if (!product || !product.isActive || (product.expiresAt && product.expiresAt <= new Date())) {
      return res.status(404).json({ error: 'Product not found or inactive' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// Create a new product (Admin only)
export const createProduct = async (req, res) => {
  try {
    const productData = req.body;
    let imageUrl = productData.image;
    if (imageUrl && imageUrl.startsWith('data:image')) {
      imageUrl = await uploadToCloudinary(imageUrl, 'products');
    }
    const product = await prisma.product.create({
      data: {
        slug: productData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        title: productData.title,
        storeId: productData.store,
        categoryId: productData.category,
        image: imageUrl,
        originalPrice: parseFloat(productData.originalPrice),
        salePrice: parseFloat(productData.salePrice),
        discount: parseFloat(productData.discount),
        cashback: productData.cashback ? parseFloat(productData.cashback) : null,
        affiliateUrl: productData.affiliateUrl,
        isTrending: productData.isTrending || false,
        isActive: productData.isActive !== undefined ? productData.isActive : true,
        expiresAt: productData.expiresAt ? new Date(productData.expiresAt) : null,
      }
    });
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// Create products in bulk (Admin only)
export const createProductsBulk = async (req, res) => {
  try {
    const productsArray = req.body.products;
    if (!Array.isArray(productsArray) || productsArray.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    const createdProducts = [];
    let skippedCount = 0;
    
    // Process one by one to handle potential data formatting issues and Cloudinary uploads if any
    for (const productData of productsArray) {
      let imageUrl = productData.image || '';
      if (imageUrl && imageUrl.startsWith('data:image')) {
        imageUrl = await uploadToCloudinary(imageUrl, 'products');
      }

      const baseSlug = (productData.title || `custom-deal`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;

      // If store or category is completely missing, fetch first available as fallback to avoid null constraint errors
      let finalStoreId = productData.store;
      let finalCategoryId = productData.category;

      if (!finalStoreId) {
        const firstStore = await prisma.store.findFirst();
        finalStoreId = firstStore ? firstStore.id : null;
      }
      if (!finalCategoryId) {
        const firstCat = await prisma.category.findFirst();
        finalCategoryId = firstCat ? firstCat.id : null;
      }

      if (!finalStoreId || !finalCategoryId) {
         return res.status(400).json({ error: 'You must have at least one Store and Category created in the system before importing products.' });
      }

      const productTitle = productData.title || `Custom Deal ${Date.now()}`;

      // Check for duplicate product (same title and store)
      const existingProduct = await prisma.product.findFirst({
        where: {
          title: productTitle,
          storeId: finalStoreId
        }
      });

      if (existingProduct) {
        skippedCount++;
        continue;
      }

      const product = await prisma.product.create({
        data: {
          slug: slug,
          title: productTitle,
          storeId: finalStoreId,
          categoryId: finalCategoryId,
          image: imageUrl,
          originalPrice: parseFloat(productData.originalPrice) || 0,
          salePrice: parseFloat(productData.salePrice) || 0,
          discount: parseFloat(productData.discount) || 0,
          cashback: productData.cashback !== undefined && productData.cashback !== '' ? parseFloat(productData.cashback) : null,
          affiliateUrl: productData.affiliateUrl || '',
          isTrending: productData.isTrending || false,
          isActive: productData.isActive !== undefined ? productData.isActive : true,
        }
      });
      createdProducts.push(product);
    }

    res.status(201).json({ success: true, count: createdProducts.length, skippedCount });
  } catch (error) {
    console.error('Error in bulk creating products:', error);
    res.status(500).json({ error: 'Failed to bulk create products' });
  }
};

// Update an existing product (Admin only)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const productData = req.body;
    
    const updateData = { ...productData };
    if (updateData.title) {
      updateData.slug = updateData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    delete updateData.slug_manual; // Clean up if any
    
    if (updateData.originalPrice !== undefined) updateData.originalPrice = parseFloat(updateData.originalPrice);
    if (updateData.salePrice !== undefined) updateData.salePrice = parseFloat(updateData.salePrice);
    if (updateData.discount !== undefined) updateData.discount = parseFloat(updateData.discount);
    if (updateData.cashback !== undefined) updateData.cashback = updateData.cashback !== null && updateData.cashback !== '' ? parseFloat(updateData.cashback) : null;
    if (updateData.isActive !== undefined) updateData.isActive = Boolean(updateData.isActive);
    if (updateData.expiresAt !== undefined) {
      updateData.expiresAt = updateData.expiresAt ? new Date(updateData.expiresAt) : null;
    }

    // Support reposting action: reactivates, refreshes timestamp to appear at top of listings, and clears past expiration
    if (updateData.repost) {
      updateData.isActive = true;
      updateData.createdAt = new Date();
      if (!updateData.expiresAt || new Date(updateData.expiresAt) <= new Date()) {
        updateData.expiresAt = null;
      }
      delete updateData.repost;
    }
    
    // Map relation fields to current schema
    if (updateData.store) {
      updateData.storeId = updateData.store;
      delete updateData.store;
    }
    if (updateData.category) {
      updateData.categoryId = updateData.category;
      delete updateData.category;
    }

    const existingProduct = await prisma.product.findUnique({ where: { id: id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // If activating an expired product without providing a new expiry, clear past expiration
    if (updateData.isActive === true && updateData.expiresAt === undefined) {
      if (existingProduct.expiresAt && existingProduct.expiresAt <= new Date()) {
        updateData.expiresAt = null;
      }
    }

    if (updateData.image && updateData.image !== existingProduct.image) {
      if (updateData.image.startsWith('data:image')) {
        updateData.image = await uploadToCloudinary(updateData.image, 'products');
      }
      if (existingProduct.image && existingProduct.image.includes('cloudinary.com')) {
        await deleteFromCloudinary(existingProduct.image);
      }
    }

    // Remove deprecated fields so Prisma doesn't throw errors
    delete updateData.reviews;
    delete updateData.rating;
    delete updateData.features;

    const product = await prisma.product.update({
      where: { id: id },
      data: updateData
    });
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// Delete a product (Admin only)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingProduct = await prisma.product.findUnique({ where: { id: id } });
    if (existingProduct && existingProduct.image && existingProduct.image.includes('cloudinary.com')) {
      await deleteFromCloudinary(existingProduct.image);
    }
    
    await prisma.product.delete({
      where: { id: id }
    });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// Track a click on a product deal
export const trackProductClick = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || null;
    // Use x-forwarded-for or connection remote address for IP
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    // Ensure product exists
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await prisma.productClick.create({
      data: {
        productId: id,
        userId: userId,
        ipAddress: ipAddress
      }
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking product click:', error);
    res.status(500).json({ error: 'Failed to track product click' });
  }
};
