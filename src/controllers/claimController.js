import { PrismaClient } from '@prisma/client';
import { uploadToCloudinary } from '../utils/cloudinary.js';

const prisma = new PrismaClient();

export const submitClaim = async (req, res) => {
  try {
    const { storeName, productId, orderId, orderAmount, orderDate } = req.body;
    
    // Check if files exist
    if (!req.files || !req.files.invoice || !req.files.review || !req.files.noReturn) {
      return res.status(400).json({ error: 'Invoice, Review, and No-Return screenshots are required.' });
    }

    const invoiceScreenshot = await uploadToCloudinary(req.files.invoice[0].buffer, 'claims');
    const reviewScreenshot = await uploadToCloudinary(req.files.review[0].buffer, 'claims');
    const noReturnScreenshot = await uploadToCloudinary(req.files.noReturn[0].buffer, 'claims');

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
        invoiceScreenshot,
        reviewScreenshot,
        noReturnScreenshot
      }
    });

    res.status(201).json({ success: true, claim });
  } catch (error) {
    console.error('Error submitting claim:', error);
    res.status(500).json({ error: 'Failed to submit claim' });
  }
};

export const getUserClaims = async (req, res) => {
  try {
    const claims = await prisma.cashbackClaim.findMany({
      where: { userId: req.userId },
      include: { product: { select: { id: true, title: true, image: true, slug: true } } },
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
    const claims = await prisma.cashbackClaim.findMany({
      include: {
        user: { select: { name: true, email: true, mobile: true } },
        product: { select: { id: true, title: true, image: true, slug: true } }
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

    if (existingClaim.status !== 'PENDING' && !(existingClaim.status === 'REJECTED' && status === 'PENDING')) {
      return res.status(400).json({ error: 'Claim is already processed' });
    }

    const updateData = { status, adminNote: adminNote !== undefined ? adminNote : existingClaim.adminNote };

    if (status === 'APPROVED' && awardedCashback) {
      const cashbackAmt = parseFloat(awardedCashback);
      if (isNaN(cashbackAmt) || cashbackAmt <= 0) {
        return res.status(400).json({ error: 'Invalid cashback amount' });
      }
      updateData.awardedCashback = cashbackAmt;

      // Update wallet in transaction
      await prisma.$transaction(async (tx) => {
        // Update claim
        await tx.cashbackClaim.update({
          where: { id },
          data: updateData
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

      return res.json({ success: true, message: 'Claim approved and wallet updated' });
    } else {
      // Just update status (e.g., REJECTED)
      const claim = await prisma.cashbackClaim.update({
        where: { id },
        data: updateData
      });
      return res.json({ success: true, claim });
    }
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({ error: 'Failed to update claim' });
  }
};

export const updateAwardedCashback = async (req, res) => {
  try {
    const { id } = req.params;
    const { newAwardedCashback, adminNote } = req.body;

    const cashbackAmt = parseFloat(newAwardedCashback);
    if (isNaN(cashbackAmt) || cashbackAmt <= 0) {
      return res.status(400).json({ error: 'Invalid cashback amount' });
    }

    const existingClaim = await prisma.cashbackClaim.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!existingClaim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (existingClaim.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Only approved claims can have their cashback amount edited.' });
    }

    const oldCashbackAmt = existingClaim.awardedCashback || 0;
    const difference = cashbackAmt - oldCashbackAmt;

    if (difference === 0) {
      return res.json({ success: true, message: 'No change in amount' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update the claim
      await tx.cashbackClaim.update({
        where: { id },
        data: { 
          awardedCashback: cashbackAmt,
          adminNote: adminNote !== undefined ? adminNote : existingClaim.adminNote
        }
      });

      // 2. Adjust the wallet by the difference
      await tx.wallet.update({
        where: { userId: existingClaim.userId },
        data: {
          confirmedBalance: { increment: difference },
          availableBalance: { increment: difference }
        }
      });

      // 3. Create a correction transaction
      await tx.transaction.create({
        data: {
          userId: existingClaim.userId,
          amount: difference,
          type: 'BONUS',
          status: 'CONFIRMED',
          description: `Cashback Correction for Order #${existingClaim.orderId} (Admin Edit)`,
          storeName: existingClaim.storeName,
          orderId: existingClaim.orderId
        }
      });
    });

    return res.json({ success: true, message: 'Cashback amount updated successfully.' });

  } catch (error) {
    console.error('Error updating awarded cashback:', error);
    res.status(500).json({ error: 'Failed to update awarded cashback' });
  }
};
