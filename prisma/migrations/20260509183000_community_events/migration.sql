-- CreateEnum
CREATE TYPE "CommunityJoinKind" AS ENUM ('OPEN', 'APPROVAL');

-- CreateEnum
CREATE TYPE "CommunitySignupStatus" AS ENUM ('JOINED', 'PENDING', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SkillBand" AS ENUM ('CASUAL', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "activityName" TEXT;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "sportType" TEXT;

-- CreateTable
CREATE TABLE "AppProfile" (
    "userId" TEXT NOT NULL,
    "identifiesAsWoman" BOOLEAN NOT NULL DEFAULT false,
    "declaredSkillBand" "SkillBand",
    "profilePublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CommunityEvent" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "stravaRouteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "joinKind" "CommunityJoinKind" NOT NULL,
    "sportTypeSnapshot" TEXT,
    "routeNameSnapshot" TEXT,
    "distanceMetersSnapshot" DOUBLE PRECISION,
    "elevationGainSnapshot" DOUBLE PRECISION,
    "minSkillBand" "SkillBand",
    "paceNote" TEXT,
    "womenOnly" BOOLEAN NOT NULL DEFAULT false,
    "requisitesJson" JSONB,
    "maxParticipants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityEventSignup" (
    "id" TEXT NOT NULL,
    "communityEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CommunitySignupStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityEventSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityEvent_startsAt_idx" ON "CommunityEvent"("startsAt");

-- CreateIndex
CREATE INDEX "CommunityEvent_hostUserId_idx" ON "CommunityEvent"("hostUserId");

-- CreateIndex
CREATE INDEX "CommunityEventSignup_userId_idx" ON "CommunityEventSignup"("userId");

-- CreateIndex
CREATE INDEX "CommunityEventSignup_communityEventId_status_idx" ON "CommunityEventSignup"("communityEventId", "status");

-- AddForeignKey
ALTER TABLE "CommunityEventSignup" ADD CONSTRAINT "CommunityEventSignup_communityEventId_fkey" FOREIGN KEY ("communityEventId") REFERENCES "CommunityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CommunityEventSignup_communityEventId_userId_key" ON "CommunityEventSignup"("communityEventId", "userId");
