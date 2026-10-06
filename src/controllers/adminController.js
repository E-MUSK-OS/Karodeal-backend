import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminStats = async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    const storesCount = await prisma.store.count();
    const dealsCount = await prisma.product.count();
    
    // Sum of all pending withdrawals or pending claims?
    // Let's sum pending payouts
    const pendingPayouts = await prisma.payoutRequest.aggregate({
      where: { status: 'PENDING' },
      _sum: { amount: true }
    });
    
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true, role: true }
    });

    res.json({
      stats: {
        usersCount,
        storesCount,
        dealsCount,
        pendingCashback: pendingPayouts._sum.amount || 0,
      },
      recentUsers
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
};

// Get all product clicks
export const getProductClicks = async (req, res) => {
  try {
    const clicks = await prisma.productClick.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { title: true, storeRel: { select: { name: true } } } }
      }
    });
    res.json(clicks);
  } catch (error) {
    console.error('Error fetching product clicks:', error);
    res.status(500).json({ error: 'Failed to fetch product clicks' });
  }
};
