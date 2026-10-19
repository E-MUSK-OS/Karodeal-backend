import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAdminStats = async (req, res) => {
  try {
    const isSubAdmin = req.userRole === 'SUB_ADMIN';

    if (isSubAdmin) {
      // 1. My Products
      const myProducts = await prisma.product.findMany({
        where: { createdById: req.userId },
        select: { id: true, storeId: true, salePrice: true }
      });
      const myProductIds = myProducts.map(p => p.id);
      const myDealsCount = myProductIds.length;
      const myUniqueStoreIds = [...new Set(myProducts.map(p => p.storeId).filter(Boolean))];

      // 2. My Product Clicks
      const myClicksCount = myProductIds.length > 0 ? await prisma.productClick.count({
        where: { productId: { in: myProductIds } }
      }) : 0;

      // 3. Total Billing for Sub-Admin
      const approvedClaims = myProductIds.length > 0 ? await prisma.cashbackClaim.findMany({
        where: {
          productId: { in: myProductIds },
          status: 'APPROVED'
        },
        select: {
          claimType: true,
          product: { select: { salePrice: true } }
        }
      }) : [];

      let subAdminTotalBilling = 0;
      approvedClaims.forEach((c) => {
        const salePrice = Number(c.product?.salePrice) || 0;
        if (c.claimType === 'WITHOUT_REVIEW') {
          subAdminTotalBilling += salePrice + 20;
        } else {
          subAdminTotalBilling += salePrice + 50;
        }
      });

      // 4. Recent Clicks on Sub-Admin's products
      const recentClicks = myProductIds.length > 0 ? await prisma.productClick.findMany({
        where: { productId: { in: myProductIds } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          product: { select: { title: true, image: true } },
          user: { select: { name: true, email: true } }
        }
      }) : [];

      // 5. Latest Deals added by Sub-Admin
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
          myStoresCount: myUniqueStoreIds.length,
          totalBilling: Math.round(subAdminTotalBilling * 100) / 100,
          approvedClaimsCount: approvedClaims.length
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
        select: {
          claimType: true,
          awardedCashback: true,
          product: {
            select: {
              cashback: true,
              cashbackWithoutReview: true,
              cashbackWithReview: true,
              salePrice: true
            }
          }
        }
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

    const pendingCashbackSum = pendingClaims.reduce((sum, c) => {
      let expCashback = 0;
      if (c.awardedCashback) {
        expCashback = Number(c.awardedCashback);
      } else if (c.product) {
        const isWithoutReview = c.claimType === 'WITHOUT_REVIEW';
        if (isWithoutReview && c.product.cashbackWithoutReview) {
          expCashback = Number(c.product.cashbackWithoutReview);
        } else if (!isWithoutReview && c.product.cashbackWithReview) {
          expCashback = Number(c.product.cashbackWithReview);
        } else if (c.product.cashback) {
          expCashback = isWithoutReview ? (Number(c.product.cashback) / 2) : Number(c.product.cashback);
        } else if (c.product.salePrice) {
          const price = Math.round(Number(c.product.salePrice) || 0);
          if (price <= 399) {
            expCashback = isWithoutReview ? 100 : 200;
          } else if (price <= 599) {
            expCashback = isWithoutReview ? 150 : 300;
          } else if (price <= 799) {
            expCashback = isWithoutReview ? 200 : 400;
          } else if (price <= 999) {
            expCashback = isWithoutReview ? 250 : 500;
          } else {
            expCashback = isWithoutReview ? 300 : 700;
          }
        }
      }
      return sum + Number(expCashback || 0);
    }, 0);

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
        product: {
          select: {
            title: true,
            storeRel: { select: { name: true } },
            createdById: true,
            createdBy: { select: { id: true, name: true, email: true, role: true } }
          }
        }
      }
    });
    res.json(clicks);
  } catch (error) {
    console.error('Error fetching product clicks:', error);
    res.status(500).json({ error: 'Failed to fetch product clicks' });
  }
};
