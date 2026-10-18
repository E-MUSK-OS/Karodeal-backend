-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CashbackClaim" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "productId" TEXT,
    "orderId" TEXT NOT NULL,
    "orderAmount" DOUBLE PRECISION NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "invoiceScreenshot" TEXT NOT NULL,
    "reviewScreenshot" TEXT,
    "noReturnScreenshot" TEXT NOT NULL,
    "claimType" TEXT NOT NULL DEFAULT 'WITH_REVIEW',
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "awardedCashback" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashbackClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashbackClaim_ticketId_key" ON "CashbackClaim"("ticketId");

-- CreateIndex
CREATE INDEX "CashbackClaim_userId_idx" ON "CashbackClaim"("userId");

-- CreateIndex
CREATE INDEX "CashbackClaim_productId_idx" ON "CashbackClaim"("productId");

-- CreateIndex
CREATE INDEX "CashbackClaim_status_idx" ON "CashbackClaim"("status");

-- AddForeignKey
ALTER TABLE "CashbackClaim" ADD CONSTRAINT "CashbackClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashbackClaim" ADD CONSTRAINT "CashbackClaim_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
