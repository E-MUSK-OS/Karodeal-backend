import { PrismaClient } from '@prisma/client';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { calculateCashback } from '../utils/cashbackCalculator.js';
import { emitProductsChange } from '../utils/socket.js';
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
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ],
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

    const whereClause = {};
    if (req.userRole === 'SUB_ADMIN') {
      whereClause.createdById = req.userId;
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      include: { 
        storeRel: { select: { id: true, name: true, logoUrl: true, slug: true } }, 
        categoryRel: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } }
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

    const normalizedTitle = productData.title ? productData.title.trim() : '';
    if (!normalizedTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Check if product with the same title already exists (case-insensitive)
    const existingProduct = await prisma.product.findFirst({
      where: {
        title: {
          equals: normalizedTitle,
          mode: 'insensitive'
        }
      }
    });

    if (existingProduct) {
      return res.status(400).json({ 
        error: 'A product card with this title already exists. Please choose a different title.' 
      });
    }

    const slug = normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const existingSlug = await prisma.product.findUnique({
      where: { slug }
    });
    if (existingSlug) {
      return res.status(400).json({ 
        error: 'A product card with this title already exists. Please choose a different title.' 
      });
    }

    const salePriceNum = Math.max(0, parseFloat(productData.salePrice) || 0);
    const { withoutReview, withReview } = calculateCashback(salePriceNum);

    // Shift existing products down so new product gets rank 1
    await prisma.product.updateMany({
      data: { sortOrder: { increment: 1 } }
    });

    const product = await prisma.product.create({
      data: {
        slug,
        title: normalizedTitle,
        storeId: productData.store,
        categoryId: productData.category,
        image: imageUrl,
        originalPrice: Math.max(0, parseFloat(productData.originalPrice) || 0),
        salePrice: salePriceNum,
        discount: Math.max(0, parseFloat(productData.discount) || 0),
        cashback: withReview,
        cashbackWithoutReview: withoutReview,
        cashbackWithReview: withReview,
        affiliateUrl: productData.affiliateUrl,
        isTrending: productData.isTrending || false,
        isActive: productData.isActive !== undefined ? productData.isActive : true,
        expiresAt: productData.expiresAt ? new Date(productData.expiresAt) : null,
        createdById: req.userId || null,
        sortOrder: 1,
      }
    });
    res.status(201).json(product);
    emitProductsChange('create', product);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'A product card with this title already exists. Please choose a different title.' 
      });
    }
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

      const salePriceNum = Math.max(0, parseFloat(productData.salePrice) || 0);
      const { withoutReview, withReview } = calculateCashback(salePriceNum);

      const product = await prisma.product.create({
        data: {
          slug: slug,
          title: productTitle,
          storeId: finalStoreId,
          categoryId: finalCategoryId,
          image: imageUrl,
          originalPrice: Math.max(0, parseFloat(productData.originalPrice) || 0),
          salePrice: salePriceNum,
          discount: Math.max(0, parseFloat(productData.discount) || 0),
          cashback: withReview,
          cashbackWithoutReview: withoutReview,
          cashbackWithReview: withReview,
          affiliateUrl: productData.affiliateUrl || '',
          isTrending: productData.isTrending || false,
          isActive: productData.isActive !== undefined ? productData.isActive : true,
          createdById: req.userId || null,
        }
      });
      createdProducts.push(product);
    }

    res.status(201).json({ success: true, count: createdProducts.length, skippedCount });
    emitProductsChange('bulk_create', { count: createdProducts.length });
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
      const normalizedTitle = updateData.title.trim();
      const duplicateProduct = await prisma.product.findFirst({
        where: {
          id: { not: id },
          title: {
            equals: normalizedTitle,
            mode: 'insensitive'
          }
        }
      });
      if (duplicateProduct) {
        return res.status(400).json({ 
          error: 'Another product card with this title already exists. Please choose a different title.' 
        });
      }
      updateData.title = normalizedTitle;
      updateData.slug = normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    delete updateData.slug_manual; // Clean up if any
    
    if (updateData.originalPrice !== undefined) updateData.originalPrice = parseFloat(updateData.originalPrice);
    if (updateData.salePrice !== undefined) updateData.salePrice = parseFloat(updateData.salePrice);
    if (updateData.discount !== undefined) updateData.discount = parseFloat(updateData.discount);
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

      // Bring reposted product to top (Rank 1)
      await prisma.product.updateMany({
        where: { id: { not: id } },
        data: { sortOrder: { increment: 1 } }
      });
      updateData.sortOrder = 1;
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

    // Sub-admins can only edit products they created
    if (req.userRole === 'SUB_ADMIN' && existingProduct.createdById !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit product cards that you created.' });
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

    // Auto-calculate or respect provided cashback
    const effectiveSalePrice = Math.max(0, updateData.salePrice !== undefined 
      ? (parseFloat(updateData.salePrice) || 0)
      : existingProduct.salePrice);
    
    if (updateData.salePrice !== undefined) {
      updateData.salePrice = effectiveSalePrice;
    }
    if (updateData.originalPrice !== undefined) {
      updateData.originalPrice = Math.max(0, parseFloat(updateData.originalPrice) || 0);
    }
    if (updateData.discount !== undefined) {
      updateData.discount = Math.max(0, parseFloat(updateData.discount) || 0);
    }
    const { withoutReview, withReview } = calculateCashback(effectiveSalePrice);
    updateData.cashback = withReview;
    updateData.cashbackWithoutReview = withoutReview;
    updateData.cashbackWithReview = withReview;

    // Remove deprecated fields so Prisma doesn't throw errors
    delete updateData.reviews;
    delete updateData.rating;
    delete updateData.features;

    const product = await prisma.product.update({
      where: { id: id },
      data: updateData
    });
    res.json(product);
    emitProductsChange('update', product);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'Another product card with this title already exists. Please choose a different title.' 
      });
    }
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// Delete a product (Admin only)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingProduct = await prisma.product.findUnique({ where: { id: id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Sub-admins can only delete products they created
    if (req.userRole === 'SUB_ADMIN' && existingProduct.createdById !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: You can only delete product cards that you created.' });
    }

    if (existingProduct.image && existingProduct.image.includes('cloudinary.com')) {
      await deleteFromCloudinary(existingProduct.image);
    }
    
    await prisma.product.delete({
      where: { id: id }
    });
    res.json({ message: 'Product deleted successfully' });
    emitProductsChange('delete', { id });
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

// Reorder products (Main Admin only)
export const reorderProducts = async (req, res) => {
  try {
    if (req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Only Main Admin can reorder product cards' });
    }

    const { productId, targetRank, orderedIds, items } = req.body;

    // Mode 1: Moving a single product to a target rank (e.g. move #50 to #2 or #3)
    if (productId && targetRank !== undefined) {
      const target = Math.max(1, parseInt(targetRank, 10));
      const productToMove = await prisma.product.findUnique({
        where: { id: productId }
      });

      if (!productToMove) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const currentRank = productToMove.sortOrder;

      if (currentRank !== target) {
        await prisma.$transaction(async (tx) => {
          if (target < currentRank) {
            // Moving forward (e.g. 50 -> 2): Shift items between target and currentRank - 1 up by +1
            await tx.product.updateMany({
              where: {
                sortOrder: {
                  gte: target,
                  lt: currentRank
                }
              },
              data: {
                sortOrder: { increment: 1 }
              }
            });
          } else {
            // Moving backward (e.g. 2 -> 50): Shift items between currentRank + 1 and target down by -1
            await tx.product.updateMany({
              where: {
                sortOrder: {
                  gt: currentRank,
                  lte: target
                }
              },
              data: {
                sortOrder: { decrement: 1 }
              }
            });
          }

          // Finally set the moved product to target rank
          await tx.product.update({
            where: { id: productId },
            data: { sortOrder: target }
          });
        });
      }

      emitProductsChange('reorder', { productId, targetRank: target });
      return res.json({ success: true, message: `Product moved to rank ${target}` });
    }

    // Mode 2: Reordering by array of IDs: [id1, id2, id3, ...]
    if (Array.isArray(orderedIds) && orderedIds.length > 0) {
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.product.update({
            where: { id },
            data: { sortOrder: index + 1 }
          })
        )
      );
      emitProductsChange('reorder', { orderedIds });
      return res.json({ success: true, message: 'Products reordered successfully' });
    }

    // Mode 3: Reordering by array of items: [{ id, sortOrder }, ...]
    if (Array.isArray(items) && items.length > 0) {
      await prisma.$transaction(
        items.map((item) =>
          prisma.product.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder }
          })
        )
      );
      emitProductsChange('reorder', { items });
      return res.json({ success: true, message: 'Products reordered successfully' });
    }

    return res.status(400).json({ error: 'Invalid reorder parameters. Provide productId & targetRank, or orderedIds, or items.' });
  } catch (error) {
    console.error('Error reordering products:', error);
    res.status(500).json({ error: 'Failed to reorder products' });
  }
};

