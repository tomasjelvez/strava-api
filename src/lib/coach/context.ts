import type { CoachFeatures } from "@/lib/coach/features";
import { prisma } from "@/lib/prisma";

/** Calendar day in UTC: YYYY-MM-DD */
export function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcDaySubtractOne(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function distinctDayKeys(rows: { startedAt: Date }[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    keys.add(utcDayKey(row.startedAt));
  }
  return keys;
}

function activityLoad(activity: {
  load_score: number | null;
  features_json: unknown;
}): number | null {
  if (activity.load_score != null) return activity.load_score;
  if (
    activity.features_json &&
    typeof activity.features_json === "object" &&
    "load_score" in activity.features_json
  ) {
    const v = (activity.features_json as { load_score?: unknown }).load_score;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export type CoachContext = {
  total_load_prior_7d: number;
  avg_load_7d: number;
  training_days_7d: number;
  previous_activity_load: number | null;
  prior_7d_total_load: number;
  current_7d_total_load: number;
  had_high_load_previous_utc_day: boolean;
  activities_last_14d_count: number;
};

export async function getUserTrainingContext(
  userId: string,
  anchor: Date,
  currentStravaActivityId: number
): Promise<CoachContext> {
  const anchorMs = anchor.getTime();
  const windowStartInclusive = new Date(anchorMs - 7 * 24 * 60 * 60 * 1000);
  const priorWeekStart = new Date(anchorMs - 14 * 24 * 60 * 60 * 1000);
  const priorWeekEndExclusive = new Date(anchorMs - 7 * 24 * 60 * 60 * 1000);

  const inclusiveWindowRows = await prisma.activity.findMany({
    where: {
      userId,
      startedAt: { gte: windowStartInclusive, lte: anchor },
    },
    select: { startedAt: true, load_score: true, features_json: true, stravaActivityId: true },
  });

  const priorOnlyRows = inclusiveWindowRows.filter(
    (r) => r.stravaActivityId !== currentStravaActivityId
  );

  let total_load_prior_7d = 0;
  for (const r of priorOnlyRows) {
    const l = activityLoad(r);
    if (l != null) total_load_prior_7d += l;
  }

  const priorDayKeys = distinctDayKeys(priorOnlyRows);
  const denom = Math.max(1, priorDayKeys.size);
  const avg_load_7d = total_load_prior_7d / denom;

  const training_days_7d = distinctDayKeys(inclusiveWindowRows).size;

  const priorActivity = await prisma.activity.findFirst({
    where: {
      userId,
      startedAt: { lt: anchor },
      NOT: { stravaActivityId: currentStravaActivityId },
    },
    orderBy: { startedAt: "desc" },
    select: { load_score: true, features_json: true },
  });
  const previous_activity_load =
    priorActivity != null ? activityLoad(priorActivity) : null;

  const priorSlice = await prisma.activity.findMany({
    where: {
      userId,
      startedAt: { gte: priorWeekStart, lt: priorWeekEndExclusive },
    },
    select: { load_score: true, features_json: true },
  });
  let prior_7d_total_load = 0;
  for (const r of priorSlice) {
    const l = activityLoad(r);
    if (l != null) prior_7d_total_load += l;
  }

  let current_7d_total_load = 0;
  for (const r of inclusiveWindowRows) {
    const l = activityLoad(r);
    if (l != null) current_7d_total_load += l;
  }

  const todayKey = utcDayKey(anchor);
  const yesterdayKey = utcDaySubtractOne(todayKey);
  const yesterdayRows = inclusiveWindowRows.filter(
    (r) => utcDayKey(r.startedAt) === yesterdayKey
  );
  const threshold = avg_load_7d * 1.3;
  const had_high_load_previous_utc_day = yesterdayRows.some((r) => {
    const l = activityLoad(r);
    return l != null && l > threshold;
  });

  const last14 = await prisma.activity.findMany({
    where: {
      userId,
      startedAt: { gte: priorWeekStart, lte: anchor },
    },
    select: { id: true },
  });
  const activities_last_14d_count = last14.length;

  return {
    total_load_prior_7d,
    avg_load_7d,
    training_days_7d,
    previous_activity_load,
    prior_7d_total_load,
    current_7d_total_load,
    had_high_load_previous_utc_day,
    activities_last_14d_count,
  };
}

/** Used only for logging / optional LLM context (no invention). */
export function featuresToMetricsSummary(f: CoachFeatures): Record<string, number | null> {
  return {
    duration_minutes: f.duration_minutes,
    avg_hr: f.avg_hr,
    max_hr: f.max_hr,
    intensity_score: f.intensity_score,
    load_score: f.load_score,
    hr_drift: f.hr_drift,
    pace_variability: f.pace_variability,
  };
}
