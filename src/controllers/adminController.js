import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminStats = async (req, res) => {
  try {
    const isSubAdmin = req.userRole === 'SUB_ADMIN';

    if (isSubAdmin) {
      // 1. My Products
      const myProducts = await prisma.product.findMany({
        where: { createdById: req.userId },
        select: { id: true, storeId: true }
      });
      const myProductIds = myProducts.map(p => p.id);
      const myDealsCount = myProductIds.length;
      const myUniqueStoreIds = [...new Set(myProducts.map(p => p.storeId).filter(Boolean))];

      // 2. My Product Clicks
      const myClicksCount = myProductIds.length > 0 ? await prisma.productClick.count({
        where: { productId: { in: myProductIds } }
      }) : 0;

      // 3. Recent Clicks on Sub-Admin's products
      const recentClicks = myProductIds.length > 0 ? await prisma.productClick.findMany({
        where: { productId: { in: myProductIds } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          product: { select: { title: true, image: true } },
          user: { select: { name: true, email: true } }
        }
      }) : [];

      // 4. Latest Deals added by Sub-Admin
      const latestDeals = await prisma.product.findMany({
        where: { createdById: req.userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          salePrice: true,
          cashback: true,
          createdAt: true,
          storeRel: { select: { name: true } },
          categoryRel: { select: { name: true } }
        }
      });

      return res.json({
        role: 'SUB_ADMIN',
        stats: {
          myDealsCount,
          myClicksCount,
          myStoresCount: myUniqueStoreIds.length
        },
        latestDeals,
        recentClicks
      });
    }

    // MAIN ADMIN Stats (Global site-wide)
    const [
      dealsCount,
      storesCount,
      usersCount,
      pendingPayouts,
      pendingClaims,
      pendingTickets,
      totalClicksCount,
      recentUsers,
      recentPayouts
    ] = await Promise.all([
      prisma.product.count(),
      prisma.store.count(),
      prisma.user.count(),
      prisma.payoutRequest.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: { id: true }
      }),
      prisma.cashbackClaim.findMany({
        where: { status: 'PENDING' },
        select: { product: { select: { cashback: true } } }
      }),
      prisma.missingCashbackTicket.findMany({
        where: { status: 'PENDING' },
        select: {
          id: true,
          orderId: true,
          product: { select: { cashback: true } }
        }
      }),
      prisma.productClick.count(),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true, role: true }
      }),
      prisma.payoutRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { user: { select: { name: true, email: true } } }
      })
    ]);

    // Calculate missing cashback in Rs
    const ticketOrderIdsWithoutCb = pendingTickets.filter(t => !t.product?.cashback).map(t => t.orderId).filter(Boolean);
    const matchedClaims = ticketOrderIdsWithoutCb.length > 0 ? await prisma.cashbackClaim.findMany({
      where: { orderId: { in: ticketOrderIdsWithoutCb } },
      select: { orderId: true, product: { select: { cashback: true } }, awardedCashback: true }
    }) : [];
    const claimCbByOrderId = {};
    matchedClaims.forEach(c => {
      claimCbByOrderId[c.orderId] = c.product?.cashback || c.awardedCashback || 0;
    });

    const totalMissingCashbackAmount = pendingTickets.reduce((sum, t) => {
      const cb = t.product?.cashback ?? claimCbByOrderId[t.orderId] ?? 0;
      return sum + Number(cb);
    }, 0);

    const pendingCashbackSum = pendingClaims.reduce((sum, c) => sum + Number(c.product?.cashback || 0), 0);

    return res.json({
      role: 'ADMIN',
      stats: {
        usersCount,
        storesCount,
        dealsCount,
        pendingWithdrawal: pendingPayouts._sum.amount || 0,
        pendingWithdrawalsCount: pendingPayouts._count.id || 0,
        pendingCashback: pendingCashbackSum,
        pendingClaimsCount: pendingClaims.length,
        missingCashbackAmount: totalMissingCashbackAmount,
        pendingTicketsCount: pendingTickets.length,
        totalClicksCount
      },
      recentUsers,
      recentPayouts
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
};

// Get product clicks (Filtered for sub-admin to only show clicks on their own products)
export const getProductClicks = async (req, res) => {
  try {
    const isSubAdmin = req.userRole === 'SUB_ADMIN';
    const whereClause = isSubAdmin ? { product: { createdById: req.userId } } : {};

    const clicks = await prisma.productClick.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { title: true, storeRel: { select: { name: true } }, createdById: true } }
      }
    });
    res.json(clicks);
  } catch (error) {
    console.error('Error fetching product clicks:', error);
    res.status(500).json({ error: 'Failed to fetch product clicks' });
  }
};
