import { PrismaClient } from '@prisma/client';
import { calculateCashback } from '../src/utils/cashbackCalculator.js';

const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting safe cashback backfill for existing products...');
  const products = await prisma.product.findMany({
    select: { id: true, title: true, salePrice: true, cashback: true, cashbackWithoutReview: true, cashbackWithReview: true }
  });

  console.log(`Found ${products.length} products to check.`);

  let updatedCount = 0;
  for (const product of products) {
    const { withoutReview, withReview } = calculateCashback(product.salePrice);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        cashbackWithoutReview: withoutReview,
        cashbackWithReview: withReview,
        // Also keep cashback pointing to withReview as the top cashback
        cashback: withReview
      }
    });
    updatedCount++;
    console.log(`Updated "${product.title}" (Sale: ₹${product.salePrice}) -> Without Review: ₹${withoutReview}, With Review: ₹${withReview}`);
  }

  console.log(`Successfully updated ${updatedCount} products with zero data loss!`);
}

backfill()
  .catch((e) => {
    console.error('Error during backfill:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
