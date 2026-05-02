-- Redundant with unique; drop non-unique index before adding uniqueness
DROP INDEX IF EXISTS "StravaEvent_userId_activityId_idx";

-- Create unique index for webhook idempotency
CREATE UNIQUE INDEX "StravaEvent_userId_activityId_key" ON "StravaEvent"("userId", "activityId");

-- Activity: persisted load + features for cheap context queries
ALTER TABLE "Activity" ADD COLUMN "load_score" REAL;
ALTER TABLE "Activity" ADD COLUMN "features_json" JSONB;

CREATE INDEX "Activity_userId_startedAt_idx" ON "Activity"("userId", "startedAt");
