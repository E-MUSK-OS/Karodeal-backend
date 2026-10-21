-- CreateTable
CREATE TABLE "AnalyticsVisitor" (
    "id" TEXT NOT NULL,
    "firstVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalVisits" INTEGER NOT NULL DEFAULT 1,
    "totalActiveSeconds" INTEGER NOT NULL DEFAULT 0,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsPageVisit" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "pageTitle" TEXT,
    "referrer" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsPageVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsVisitor_lastVisitAt_idx" ON "AnalyticsVisitor"("lastVisitAt");

-- CreateIndex
CREATE INDEX "AnalyticsVisitor_createdAt_idx" ON "AnalyticsVisitor"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsSession_visitorId_idx" ON "AnalyticsSession"("visitorId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_startedAt_idx" ON "AnalyticsSession"("startedAt");

-- CreateIndex
CREATE INDEX "AnalyticsSession_lastActivityAt_idx" ON "AnalyticsSession"("lastActivityAt");

-- CreateIndex
CREATE INDEX "AnalyticsSession_isLive_idx" ON "AnalyticsSession"("isLive");

-- CreateIndex
CREATE INDEX "AnalyticsPageVisit_visitorId_idx" ON "AnalyticsPageVisit"("visitorId");

-- CreateIndex
CREATE INDEX "AnalyticsPageVisit_sessionId_idx" ON "AnalyticsPageVisit"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsPageVisit_status_idx" ON "AnalyticsPageVisit"("status");

-- CreateIndex
CREATE INDEX "AnalyticsPageVisit_pagePath_idx" ON "AnalyticsPageVisit"("pagePath");

-- CreateIndex
CREATE INDEX "AnalyticsPageVisit_enteredAt_idx" ON "AnalyticsPageVisit"("enteredAt");

-- CreateIndex
CREATE INDEX "AnalyticsPageVisit_lastActivityAt_idx" ON "AnalyticsPageVisit"("lastActivityAt");

-- AddForeignKey
ALTER TABLE "AnalyticsSession" ADD CONSTRAINT "AnalyticsSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsPageVisit" ADD CONSTRAINT "AnalyticsPageVisit_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "AnalyticsVisitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsPageVisit" ADD CONSTRAINT "AnalyticsPageVisit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AnalyticsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
