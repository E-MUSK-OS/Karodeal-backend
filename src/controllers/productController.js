import { PrismaClient } from '@prisma/client';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
const prisma = new PrismaClient();

// Get all products
export const getProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
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
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
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
    
    // Process one by one to handle potential data formatting issues and Cloudinary uploads if any
    for (const productData of productsArray) {
      let imageUrl = productData.image || '';
      if (imageUrl && imageUrl.startsWith('data:image')) {
        imageUrl = await uploadToCloudinary(imageUrl, 'products');
      }

      const slug = (productData.title || `custom-deal-${Date.now()}-${Math.floor(Math.random() * 1000)}`)
                    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      const product = await prisma.product.create({
        data: {
          slug: slug,
          title: productData.title || `Custom Deal ${Date.now()}`,
          storeId: productData.store || null,
          categoryId: productData.category || null,
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

    res.status(201).json({ success: true, count: createdProducts.length });
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
