import { prisma } from '../utils/db.js';

export const createPayoutRequest = async (req, res) => {
  const userId = req.userId;
  const { amount, method, paymentDetails } = req.body;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!amount || !method || !paymentDetails) return res.status(400).json({ error: 'Missing required fields' });

  // Add a minimum threshold, e.g., 1000 rs
  if (amount < 1000) {
    return res.status(400).json({ error: 'Minimum payout amount is ₹1000' });
  }

  try {
    // Start a transaction: deduct availableBalance and create PayoutRequest + Transaction log
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      
      if (!wallet || wallet.availableBalance < amount) {
        throw new Error('Insufficient available balance');
      }

      // Deduct balance
      await tx.wallet.update({
        where: { userId },
        data: {
          availableBalance: {
            decrement: amount
          }
        }
      });

      // Create Payout Request
      const payout = await tx.payoutRequest.create({
        data: {
          userId,
          amount,
          method,
          paymentDetails,
          status: 'PENDING'
        }
      });

      // Create Transaction Log
      await tx.transaction.create({
        data: {
          userId,
          amount: -amount, // Negative for withdrawal
          type: 'WITHDRAWAL',
          status: 'PENDING',
          description: `Payout Request (${method}) - ID: ${payout.id}`
        }
      });

      return payout;
    });

    res.json({ success: true, payout: result });
  } catch (error) {
    console.error('Error creating payout request:', error);
    res.status(400).json({ error: error.message || 'Failed to create payout request' });
  }
};

export const getUserPayouts = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payouts = await prisma.payoutRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, payouts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
};

export const getAdminPayouts = async (req, res) => {
  try {
    const payouts = await prisma.payoutRequest.findMany({
      include: {
        user: { select: { name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, payouts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
};

export const processPayout = async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body; // 'APPROVED' or 'REJECTED'

  if (status !== 'APPROVED' && status !== 'REJECTED') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const payout = await prisma.payoutRequest.findUnique({ where: { id } });
    if (!payout) return res.status(404).json({ error: 'Payout request not found' });
    if (payout.status !== 'PENDING') return res.status(400).json({ error: 'Payout already processed' });

    await prisma.$transaction(async (tx) => {
      // 1. Update PayoutRequest status
      await tx.payoutRequest.update({
        where: { id },
        data: { status, adminNote }
      });

      // 2. Find associated Transaction log
      const transaction = await tx.transaction.findFirst({
        where: {
          userId: payout.userId,
          type: 'WITHDRAWAL',
          description: { contains: payout.id }
        }
      });

      if (transaction) {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: status === 'APPROVED' ? 'CONFIRMED' : 'REJECTED' }
        });
      }

      // 3. If REJECTED, refund the money back to availableBalance
      if (status === 'REJECTED') {
        await tx.wallet.update({
          where: { userId: payout.userId },
          data: { availableBalance: { increment: payout.amount } }
        });
      }
    });

    res.json({ success: true, message: `Payout ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
};
