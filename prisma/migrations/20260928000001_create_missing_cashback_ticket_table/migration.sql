-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MissingCashbackTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderAmount" DOUBLE PRECISION NOT NULL,
    "userNote" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "orderScreenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminUnread" BOOLEAN NOT NULL DEFAULT true,
    "userUnread" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissingCashbackTicket_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MissingCashbackTicket" ADD CONSTRAINT "MissingCashbackTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
