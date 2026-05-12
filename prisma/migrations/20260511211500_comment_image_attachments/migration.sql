-- AlterTable
ALTER TABLE "CommunityEventImage" ADD COLUMN "commentId" TEXT;

-- CreateIndex
CREATE INDEX "CommunityEventImage_commentId_idx" ON "CommunityEventImage"("commentId");

-- AddForeignKey
ALTER TABLE "CommunityEventImage" ADD CONSTRAINT "CommunityEventImage_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityEventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
