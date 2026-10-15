import { prisma } from '../utils/db.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { emitClaimsChange } from '../utils/socket.js';

export const submitClaim = async (req, res) => {
  try {
    const { storeName, productId, orderId, orderAmount, orderDate, claimType } = req.body;
    const isWithReview = claimType !== 'WITHOUT_REVIEW';

    // Check if required files exist
    if (!req.files || !req.files.invoice || !req.files.noReturn) {
      return res.status(400).json({ error: 'Invoice and No-Return screenshots are required.' });
    }

    if (isWithReview && (!req.files.review || !req.files.review[0])) {
      return res.status(400).json({ error: 'Review screenshot is required for Review-based claim.' });
    }

    const invoiceScreenshot = await uploadToCloudinary(req.files.invoice[0].buffer, 'claims');
    const reviewScreenshot = req.files.review && req.files.review[0]
      ? await uploadToCloudinary(req.files.review[0].buffer, 'claims')
      : null;
    const noReturnScreenshot = await uploadToCloudinary(req.files.noReturn[0].buffer, 'claims');

    // Check if a claim for this Order ID already exists
    const existingClaim = await prisma.cashbackClaim.findFirst({
      where: { orderId }
    });

    if (existingClaim) {
      return res.status(400).json({ error: 'A claim for this Order ID has already been submitted.' });
    }

    // Generate 6-character random alphanumeric ticketId
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let ticketId = '';
    for (let i = 0; i < 6; i++) {
      ticketId += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const claim = await prisma.cashbackClaim.create({
      data: {
        ticketId,
        userId: req.userId,
        storeName,
        productId: productId || null,
        orderId,
        orderAmount: parseFloat(orderAmount),
        orderDate: new Date(orderDate),
        claimType: isWithReview ? 'WITH_REVIEW' : 'WITHOUT_REVIEW',
        invoiceScreenshot,
        reviewScreenshot,
        noReturnScreenshot
      }
    });

    res.status(201).json({ success: true, claim });
    try {
      emitClaimsChange('created', { claimId: claim.id, productId: claim.productId });
    } catch (e) {
      // ignore
    }
  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
};

export const getUserClaims = async (req, res) => {
  try {
    const claims = await prisma.cashbackClaim.findMany({
      where: { userId: req.userId },
      include: { 
        product: { 
          select: { 
            id: true, 
            title: true, 
            image: true, 
            slug: true, 
            originalPrice: true, 
            salePrice: true, 
            cashback: true,
            cashbackWithoutReview: true,
            cashbackWithReview: true
          } 
        } 
      },
      orderBy: { createdAt: 'desc' }
    });

    const tickets = await prisma.missingCashbackTicket.findMany({
      where: { userId: req.userId },
      select: { orderId: true }
    });

    const ticketOrderIds = new Set(tickets.map(t => t.orderId));

    const claimsWithTicketStatus = claims.map(claim => ({
      ...claim,
      hasMissingTicket: ticketOrderIds.has(claim.orderId)
    }));

    res.json({ claims: claimsWithTicketStatus });
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
};

export const getAllClaims = async (req, res) => {
  try {
    const where = {};
    if (req.userRole === 'SUB_ADMIN') {
      where.product = {
        createdById: req.userId
      };
    }

    const claims = await prisma.cashbackClaim.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, mobile: true } },
        product: { 
          select: { 
            id: true, 
            title: true, 
            image: true, 
            slug: true, 
            originalPrice: true, 
            salePrice: true, 
            cashback: true, 
            cashbackWithoutReview: true,
            cashbackWithReview: true,
            createdById: true,
            createdBy: {
              select: { id: true, name: true, email: true, role: true }
            } 
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ claims });
  } catch (error) {
    console.error('Error fetching all claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
};

export const updateClaimStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote, awardedCashback } = req.body;

    const existingClaim = await prisma.cashbackClaim.findUnique({
      where: { id },
      include: { user: true, product: true }
    });

    if (!existingClaim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (req.userRole === 'SUB_ADMIN') {
      if (!existingClaim.product || existingClaim.product.createdById !== req.userId) {
        return res.status(403).json({ error: 'Forbidden: You can only manage claims for products you created.' });
      }
    }

    if (existingClaim.status !== 'PENDING') {
      return res.status(400).json({ error: 'Claim has already been processed. Once approved or rejected, it cannot be modified.' });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid claim status' });
    }

    if (status === 'REJECTED' && (!adminNote || !adminNote.trim())) {
      return res.status(400).json({ error: 'Admin note / reason is compulsory when rejecting a claim.' });
    }

    const trimmedAdminNote = adminNote && adminNote.trim() ? adminNote.trim() : null;

    if (status === 'APPROVED') {
      const cashbackAmt = parseFloat(awardedCashback);
      if (isNaN(cashbackAmt) || cashbackAmt <= 0) {
        return res.status(400).json({ error: 'Valid cashback amount is required for approval.' });
      }

      // Update wallet in transaction
      await prisma.$transaction(async (tx) => {
        // Update claim
        await tx.cashbackClaim.update({
          where: { id },
          data: {
            status: 'APPROVED',
            adminNote: trimmedAdminNote,
            awardedCashback: cashbackAmt
          }
        });

        // Update Wallet
        await tx.wallet.upsert({
          where: { userId: existingClaim.userId },
          create: {
            userId: existingClaim.userId,
            confirmedBalance: cashbackAmt,
            availableBalance: cashbackAmt,
          },
          update: {
            confirmedBalance: { increment: cashbackAmt },
            availableBalance: { increment: cashbackAmt }
          }
        });

        // Create transaction
        await tx.transaction.create({
          data: {
            userId: existingClaim.userId,
            amount: cashbackAmt,
            type: 'EARNING',
            status: 'CONFIRMED',
            description: `Cashback Claim Approved`,
            storeName: existingClaim.storeName,
            orderId: existingClaim.orderId
          }
        });
      });

      try {
        emitClaimsChange('updated', { claimId: id, status: 'APPROVED', productId: existingClaim.productId });
      } catch (e) {
        // ignore
      }
      return res.json({ success: true, message: 'Claim approved and wallet updated' });
    } else {
      // Just update status to REJECTED
      const claim = await prisma.cashbackClaim.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNote: trimmedAdminNote
        }
      });
      try {
        emitClaimsChange('updated', { claimId: id, status: 'REJECTED', productId: existingClaim.productId });
      } catch (e) {
        // ignore
      }
      return res.json({ success: true, claim });
    }
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  }
};

export const updateAwardedCashback = async (req, res) => {
  return res.status(400).json({ error: 'Modifying cashback amount after approval is disabled. Claims cannot be modified once processed.' });
};
