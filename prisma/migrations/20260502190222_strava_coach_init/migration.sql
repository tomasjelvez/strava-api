-- CreateTable
CREATE TABLE "StravaConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StravaEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stravaActivityId" INTEGER NOT NULL,
    "distance" REAL,
    "moving_time" INTEGER NOT NULL,
    "elapsed_time" INTEGER NOT NULL,
    "average_heartrate" REAL,
    "max_heartrate" REAL,
    "raw_streams" JSONB NOT NULL,
    "startedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "StravaConnection_userId_key" ON "StravaConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StravaConnection_athleteId_key" ON "StravaConnection"("athleteId");

-- CreateIndex
CREATE INDEX "StravaEvent_processed_idx" ON "StravaEvent"("processed");

-- CreateIndex
CREATE INDEX "StravaEvent_userId_activityId_idx" ON "StravaEvent"("userId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_stravaActivityId_key" ON "Activity"("userId", "stravaActivityId");
