import { prisma } from '../utils/db.js';

export const getBillingData = async (req, res) => {
  try {
    const isMainAdmin = req.userRole === 'ADMIN';
    const subAdminIdQuery = req.query.subAdminId;
    const period = req.query.period || 'all'; // 'all', 'this_month', 'last_month', 'custom'
    const customStart = req.query.startDate;
    const customEnd = req.query.endDate;
    const claimStatus = req.query.claimStatus || 'APPROVED'; // 'APPROVED', 'ALL', 'PENDING'

    // Sub-admin is strictly restricted to their own products
    let targetSubAdminId = null;
    if (!isMainAdmin) {
      targetSubAdminId = req.userId;
    } else if (subAdminIdQuery && subAdminIdQuery !== 'ALL') {
      targetSubAdminId = subAdminIdQuery;
    }

    // Build Date Filter for CashbackClaims
    let dateFilter = undefined;
    const now = new Date();

    if (period === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (period === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      dateFilter = { gte: startOfLastMonth, lte: endOfLastMonth };
    } else if (period === 'custom' && (customStart || customEnd)) {
      dateFilter = {};
      if (customStart) dateFilter.gte = new Date(customStart);
      if (customEnd) {
        const endDateObj = new Date(customEnd);
        endDateObj.setHours(23, 59, 59, 999);
        dateFilter.lte = endDateObj;
      }
    }

    // Build Claim Where Condition
    const claimWhere = {};
    if (claimStatus === 'ALL') {
      claimWhere.status = { in: ['APPROVED', 'PENDING'] };
    } else if (claimStatus === 'PENDING') {
      claimWhere.status = 'PENDING';
    } else {
      claimWhere.status = 'APPROVED';
    }

    if (dateFilter) {
      claimWhere.createdAt = dateFilter;
    }

    // Product Filter:
    // Only return products that have actual cashback claim tickets (do not clutter with 0-claim products)
    const productWhere = {
      cashbackClaims: {
        some: claimWhere
      }
    };
    if (targetSubAdminId) {
      productWhere.createdById = targetSubAdminId;
    }

    // Fetch only Products that have claim tickets
    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        storeRel: { select: { id: true, name: true, slug: true, logoUrl: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        cashbackClaims: {
          where: claimWhere,
          select: {
            id: true,
            ticketId: true,
            claimType: true,
            status: true,
            awardedCashback: true,
            orderAmount: true,
            createdAt: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Aggregations per product and overall
    let overallTotalBilling = 0;
    let overallTotalClaims = 0;
    let overallWithReviewBilling = 0;
    let overallWithReviewCount = 0;
    let overallWithoutReviewBilling = 0;
    let overallWithoutReviewCount = 0;
    let overallOrderAmount = 0;

    const productBreakdown = products
      .map((prod) => {
        const claims = prod.cashbackClaims || [];

        let withReviewCount = 0;
        let withReviewBilling = 0;
        let withoutReviewCount = 0;
        let withoutReviewBilling = 0;
        let totalOrderAmount = 0;

        // Compute official cashback rates configured on this product deal
        const officialWithReviewRate = Number(prod.cashbackWithReview) || Number(prod.cashback) || 0;
        const officialWithoutReviewRate = Number(prod.cashbackWithoutReview) || (prod.cashback ? Number(prod.cashback) / 2 : 0);

        const productSalePrice = Number(prod.salePrice) || 0;

        claims.forEach((c) => {
          const isWithoutReview = c.claimType === 'WITHOUT_REVIEW';
          // Use product salePrice for each approved claim order
          totalOrderAmount += productSalePrice;

          // Billing formula:
          // If with review: salePrice + 40 Rs
          // If without review: salePrice
          if (isWithoutReview) {
            const claimBilling = productSalePrice;
            withoutReviewCount += 1;
            withoutReviewBilling += claimBilling;
          } else {
            const claimBilling = productSalePrice + 40;
            withReviewCount += 1;
            withReviewBilling += claimBilling;
          }
        });

        const totalBilling = withReviewBilling + withoutReviewBilling;
        const totalClaimsCount = claims.length;

        overallTotalBilling += totalBilling;
        overallTotalClaims += totalClaimsCount;
        overallWithReviewBilling += withReviewBilling;
        overallWithReviewCount += withReviewCount;
        overallWithoutReviewBilling += withoutReviewBilling;
        overallWithoutReviewCount += withoutReviewCount;
        overallOrderAmount += totalOrderAmount;

        return {
          id: prod.id,
          title: prod.title,
          image: prod.image,
          salePrice: prod.salePrice,
          originalPrice: prod.originalPrice,
          withReviewBillingRate: productSalePrice + 40,
          withoutReviewBillingRate: productSalePrice,
          cashbackWithReviewRate: officialWithReviewRate,
          cashbackWithoutReviewRate: officialWithoutReviewRate,
          storeName: prod.storeRel?.name || 'N/A',
          storeLogo: prod.storeRel?.logoUrl || '',
          createdById: prod.createdById,
          createdByName: prod.createdBy?.name || prod.createdBy?.email || 'N/A',
          createdByRole: prod.createdBy?.role || 'SUB_ADMIN',
          totalBilling,
          totalClaimsCount,
          withReviewCount,
          withReviewBilling,
          withoutReviewCount,
          withoutReviewBilling,
          totalOrderAmount
        };
      })
      .filter((p) => p.totalClaimsCount > 0); // Strictly only products with claims

    // Sort product breakdown by highest billing first
    productBreakdown.sort((a, b) => b.totalBilling - a.totalBilling || b.totalClaimsCount - a.totalClaimsCount);

    // If Main Admin, fetch sub-admin list for the switcher dropdown
    let subAdminsList = [];
    if (isMainAdmin) {
      subAdminsList = await prisma.user.findMany({
        where: { role: 'SUB_ADMIN' },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' }
      });
    }

    res.json({
      success: true,
      currentRole: req.userRole,
      summary: {
        totalBilling: Math.round(overallTotalBilling * 100) / 100,
        totalApprovedClaims: overallTotalClaims,
        withReviewBilling: Math.round(overallWithReviewBilling * 100) / 100,
        withReviewCount: overallWithReviewCount,
        withoutReviewBilling: Math.round(overallWithoutReviewBilling * 100) / 100,
        withoutReviewCount: overallWithoutReviewCount,
        totalOrderAmount: Math.round(overallOrderAmount * 100) / 100
      },
      products: productBreakdown,
      subAdmins: subAdminsList
    });
  } catch (error) {
    console.error('Error fetching billing data:', error);
    res.status(500).json({ error: 'Failed to fetch billing data' });
  }
};

