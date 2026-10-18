-- CreateTable
CREATE TABLE "ProductClick" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductClick_productId_idx" ON "ProductClick"("productId");

-- CreateIndex
CREATE INDEX "ProductClick_userId_idx" ON "ProductClick"("userId");

-- AddForeignKey
ALTER TABLE "ProductClick" ADD CONSTRAINT "ProductClick_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductClick" ADD CONSTRAINT "ProductClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
