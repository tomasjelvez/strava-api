-- AlterTable
ALTER TABLE "CommunityEvent" ALTER COLUMN "stravaRouteId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CommunityEvent" ADD COLUMN "locationName" TEXT;

-- CreateTable
CREATE TABLE "CommunityEventComment" (
    "id" TEXT NOT NULL,
    "communityEventId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEventComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityEventImage" (
    "id" TEXT NOT NULL,
    "communityEventId" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "contentType" TEXT,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityEventImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityEventComment_communityEventId_createdAt_idx" ON "CommunityEventComment"("communityEventId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityEventComment_authorUserId_idx" ON "CommunityEventComment"("authorUserId");

-- CreateIndex
CREATE INDEX "CommunityEventImage_communityEventId_createdAt_idx" ON "CommunityEventImage"("communityEventId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityEventImage_uploaderUserId_idx" ON "CommunityEventImage"("uploaderUserId");

-- AddForeignKey
ALTER TABLE "CommunityEventComment" ADD CONSTRAINT "CommunityEventComment_communityEventId_fkey" FOREIGN KEY ("communityEventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityEventImage" ADD CONSTRAINT "CommunityEventImage_communityEventId_fkey" FOREIGN KEY ("communityEventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
