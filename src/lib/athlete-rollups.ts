/**
 * Lightweight training summaries from synced Activity rows for host signup review.
 */

import type { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_WINDOW_DAYS = 90;

export type AthletePerformanceSummary = {
  windowDays: number;
  windowStartISO: string;
  activityCount: number;
  totalDistanceM: number;
  totalMovingTimeMinutes: number;
  totalLoadScore: number | null;
  avgWeeklyActivities: number;
  avgWeeklyLoadScore: number | null;
  lastActivityAtISO: string | null;
};

export async function computeAthletePerformanceSummary(
  prisma: PrismaClient,
  userId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS
): Promise<AthletePerformanceSummary> {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - windowDays);

  const rows = await prisma.activity.findMany({
    where: {
      userId,
      startedAt: { gte: start },
    },
    select: {
      distance: true,
      moving_time: true,
      load_score: true,
      startedAt: true,
    },
    orderBy: { startedAt: "desc" },
  });

  let totalDistanceM = 0;
  let totalMovingSec = 0;
  const loadScores: number[] = [];
  let lastStarted: Date | null = null;

  for (const r of rows) {
    if (r.distance != null && r.distance > 0) {
      totalDistanceM += r.distance;
    }
    totalMovingSec += r.moving_time;
    if (r.load_score != null && Number.isFinite(r.load_score)) {
      loadScores.push(r.load_score);
    }
    if (!lastStarted || r.startedAt > lastStarted) {
      lastStarted = r.startedAt;
    }
  }

  const weeks = Math.max(1, windowDays / 7);
  const totalLoad = loadScores.reduce((a, b) => a + b, 0);

  return {
    windowDays,
    windowStartISO: start.toISOString(),
    activityCount: rows.length,
    totalDistanceM,
    totalMovingTimeMinutes: Math.round(totalMovingSec / 60),
    totalLoadScore: loadScores.length > 0 ? totalLoad : null,
    avgWeeklyActivities: rows.length / weeks,
    avgWeeklyLoadScore: loadScores.length > 0 ? totalLoad / weeks : null,
    lastActivityAtISO: lastStarted ? lastStarted.toISOString() : null,
  };
}
