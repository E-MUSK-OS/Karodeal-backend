import { prisma } from '../utils/db.js';
import { emitProductsChange, emitReviewRequestChange } from '../utils/socket.js';

/**
 * Create a new review request (Sub-Admin or Admin)
 */
export const createReviewRequest = async (req, res) => {
  try {
    const { productId, note, suggestedRank, requestType, orderQty, reviewQty } = req.body;
    const userId = req.userId;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Please provide notes/reason for the review request' });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, isPinned: true, sortOrder: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.isPinned) {
      return res.status(400).json({ error: 'This product is already marked as a Star product' });
    }

    // Check for an existing PENDING request for this product
    const existingPending = await prisma.reviewRequest.findFirst({
      where: {
        productId,
        status: 'PENDING'
      }
    });

    if (existingPending) {
      return res.status(400).json({ error: 'A review request for this product is already pending review by Main Admin' });
    }

    const newRequest = await prisma.reviewRequest.create({
      data: {
        productId,
        requestedById: userId,
        requestType: requestType ? String(requestType).trim() : null,
        orderQty: (orderQty !== undefined && orderQty !== null && orderQty !== '') ? parseInt(orderQty) : null,
        reviewQty: (reviewQty !== undefined && reviewQty !== null && reviewQty !== '') ? parseInt(reviewQty) : null,
        note: note.trim(),
        suggestedRank: suggestedRank ? parseInt(suggestedRank) : null,
        status: 'PENDING'
      },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            image: true,
            sortOrder: true,
            isPinned: true,
            originalPrice: true,
            salePrice: true,
            storeRel: { select: { id: true, name: true, logoUrl: true } }
          }
        },
        requestedBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    // Notify Main Admin via Socket
    emitReviewRequestChange('created', newRequest);

    return res.status(201).json({
      success: true,
      message: 'Review request submitted successfully to Main Admin',
      request: newRequest
    });
  } catch (error) {
    console.error('Error creating review request:', error);
    return res.status(500).json({ error: 'Failed to submit review request' });
  }
};

/**
 * Get all review requests (Main Admin sees all, Sub-Admin sees their own)
 */
export const getReviewRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const isSubAdmin = req.userRole === 'SUB_ADMIN';
    const userId = req.userId;

    const whereClause = {};

    // Sub-Admin only sees their own requests
    if (isSubAdmin) {
      whereClause.requestedById = userId;
    }

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const [requests, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.reviewRequest.findMany({
        where: whereClause,
        include: {
          product: {
            select: {
              id: true,
              title: true,
              image: true,
              sortOrder: true,
              isPinned: true,
              originalPrice: true,
              salePrice: true,
              storeRel: { select: { id: true, name: true, logoUrl: true } }
            }
          },
          requestedBy: {
            select: { id: true, name: true, email: true, role: true }
          },
          reviewedBy: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: [
          { createdAt: 'desc' }
        ]
      }),
      prisma.reviewRequest.count({
        where: isSubAdmin ? { requestedById: userId } : {}
      }),
      prisma.reviewRequest.count({
        where: isSubAdmin ? { requestedById: userId, status: 'PENDING' } : { status: 'PENDING' }
      }),
      prisma.reviewRequest.count({
        where: isSubAdmin ? { requestedById: userId, status: 'APPROVED' } : { status: 'APPROVED' }
      }),
      prisma.reviewRequest.count({
        where: isSubAdmin ? { requestedById: userId, status: 'REJECTED' } : { status: 'REJECTED' }
      })
    ]);

    // Sort so PENDING requests appear at the top
    const sortedRequests = [...requests].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Calculate current Star (Pinned) products stats starting sequentially from Rank 1
    const pinnedProducts = await prisma.product.findMany({
      where: { isPinned: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        sortOrder: true,
        image: true,
        storeRel: { select: { id: true, name: true, logoUrl: true } }
      }
    });

    const pinnedSet = new Set(pinnedProducts.map(p => p.sortOrder));
    let contiguousStarRank = 0;
    while (pinnedSet.has(contiguousStarRank + 1)) {
      contiguousStarRank++;
    }
    const nextStarRank = contiguousStarRank + 1;

    return res.json({
      success: true,
      requests: sortedRequests,
      counts: {
        total,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      },
      starStats: {
        pinnedCount: pinnedProducts.length,
        contiguousStarRank,
        maxStarRank: contiguousStarRank,
        nextStarRank,
        pinnedRanks: Array.from(pinnedSet),
        pinnedProducts
      }
    });
  } catch (error) {
    console.error('Error fetching review requests:', error);
    return res.status(500).json({ error: 'Failed to fetch review requests' });
  }
};

/**
 * Get current Star Products stats and position information starting sequentially from Rank 1
 */
export const getStarStats = async (req, res) => {
  try {
    const pinnedProducts = await prisma.product.findMany({
      where: { isPinned: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        sortOrder: true,
        image: true,
        storeRel: { select: { id: true, name: true, logoUrl: true } }
      }
    });

    const pinnedSet = new Set(pinnedProducts.map(p => p.sortOrder));
    let contiguousStarRank = 0;
    while (pinnedSet.has(contiguousStarRank + 1)) {
      contiguousStarRank++;
    }
    const nextStarRank = contiguousStarRank + 1;

    return res.json({
      success: true,
      starStats: {
        pinnedCount: pinnedProducts.length,
        contiguousStarRank,
        maxStarRank: contiguousStarRank,
        nextStarRank,
        pinnedRanks: Array.from(pinnedSet),
        pinnedProducts
      }
    });
  } catch (error) {
    console.error('Error fetching star stats:', error);
    return res.status(500).json({ error: 'Failed to fetch star stats' });
  }
};

/**
 * Approve a review request (Main Admin only)
 * Moves product to fixed Star rank and shifts subsequent products in line if custom rank is chosen
 */
export const approveReviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetRank, reviewNote } = req.body;
    const reviewerId = req.userId;

    const request = await prisma.reviewRequest.findUnique({
      where: { id },
      include: { product: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Review request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${request.status.toLowerCase()}` });
    }

    // Determine current Star stats starting sequentially from Rank 1
    const pinnedProducts = await prisma.product.findMany({
      where: { isPinned: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, sortOrder: true }
    });
    const pinnedSet = new Set(pinnedProducts.map(p => p.sortOrder));
    let contiguousStarRank = 0;
    while (pinnedSet.has(contiguousStarRank + 1)) {
      contiguousStarRank++;
    }
    const nextAvailableRank = contiguousStarRank + 1;

    const parsedTarget = targetRank ? parseInt(targetRank, 10) : null;
    const finalRank = (parsedTarget && !isNaN(parsedTarget) && parsedTarget > 0)
      ? parsedTarget
      : nextAvailableRank;

    const currentRank = request.product.sortOrder;
    const currentProductId = request.productId;

    await prisma.$transaction(async (tx) => {
      // Shifting sequence:
      // If moving product to a higher rank (e.g., from catalog position 66 to rank 2 or 3):
      if (finalRank < currentRank) {
        // Shift all products in [finalRank, currentRank - 1] down by +1
        // Existing Star products and unpinned products at/after finalRank shift sequentially
        await tx.product.updateMany({
          where: {
            sortOrder: {
              gte: finalRank,
              lt: currentRank
            },
            id: { not: currentProductId }
          },
          data: {
            sortOrder: { increment: 1 },
            updatedAt: new Date()
          }
        });
      } else if (finalRank > currentRank) {
        // Shift all products in [currentRank + 1, finalRank] up by -1
        await tx.product.updateMany({
          where: {
            sortOrder: {
              gt: currentRank,
              lte: finalRank
            },
            id: { not: currentProductId }
          },
          data: {
            sortOrder: { decrement: 1 },
            updatedAt: new Date()
          }
        });
      }

      // Lock product as Star (Pinned) at designated finalRank
      await tx.product.update({
        where: { id: currentProductId },
        data: {
          isPinned: true,
          sortOrder: finalRank,
          updatedAt: new Date()
        }
      });

      // Update the review request status to APPROVED
      await tx.reviewRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedRank: finalRank,
          reviewNote: reviewNote?.trim() || 'Approved by Main Administrator',
          reviewedById: reviewerId,
          updatedAt: new Date()
        }
      });
    });

    // Notify all clients via socket
    emitProductsChange('pin_toggle', {
      productId: currentProductId,
      isPinned: true,
      sortOrder: finalRank
    });

    emitReviewRequestChange('approved', {
      requestId: id,
      productId: currentProductId,
      approvedRank: finalRank
    });

    return res.json({
      success: true,
      message: `Review request approved! Product locked to Star Rank #${finalRank}.`,
      approvedRank: finalRank
    });
  } catch (error) {
    console.error('Error approving review request:', error);
    return res.status(500).json({ error: 'Failed to approve review request' });
  }
};

/**
 * Decline a review request (Main Admin only)
 */
export const declineReviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;
    const reviewerId = req.userId;

    const request = await prisma.reviewRequest.findUnique({
      where: { id }
    });

    if (!request) {
      return res.status(404).json({ error: 'Review request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: `Request is already ${request.status.toLowerCase()}` });
    }

    const updated = await prisma.reviewRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNote: reviewNote?.trim() || 'Declined by Main Administrator',
        reviewedById: reviewerId,
        updatedAt: new Date()
      }
    });

    emitReviewRequestChange('rejected', {
      requestId: id,
      productId: request.productId
    });

    return res.json({
      success: true,
      message: 'Review request declined successfully',
      request: updated
    });
  } catch (error) {
    console.error('Error declining review request:', error);
    return res.status(500).json({ error: 'Failed to decline review request' });
  }
};

// Backwards-compatible aliases
export const createStarRequest = createReviewRequest;
export const getStarRequests = getReviewRequests;
export const getStarRequestsStats = getStarStats;
export const approveStarRequest = approveReviewRequest;
export const declineStarRequest = declineReviewRequest;
