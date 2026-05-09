import { prisma } from "@/lib/prisma";
import { featuresToMetricsSummary, getUserTrainingContext } from "@/lib/coach/context";
import { extractFeatures } from "@/lib/coach/features";
import { formatInsightWithAI } from "@/lib/coach/format-insight-ai";
import { generateInsights, type InsightBundle } from "@/lib/coach/insights";
import { fetchActivityStreams, fetchActivitySummary } from "@/lib/coach/strava-activity";
import { sendInsightEmail } from "@/lib/coach/send-insight-email";
import type { CoachFeatures } from "@/lib/coach/features";

export async function processStravaEvent(eventId: string): Promise<void> {
  const event = await prisma.stravaEvent.findUnique({ where: { id: eventId } });
  if (!event) {
    console.warn("[coach] unknown StravaEvent id — skip", { eventId });
    return;
  }
  if (event.processed) {
    return;
  }

  const userId = event.userId;
  const activityId = event.activityId;

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });
  if (!connection) {
    console.warn("[coach] activity processed skip: no Strava connection", {
      userId,
      activityId,
    });
    await prisma.stravaEvent.update({
      where: { id: eventId },
      data: { processed: true },
    });
    return;
  }

  const summaryRes = await fetchActivitySummary(userId, activityId);
  if (!summaryRes.ok) {
    if (summaryRes.status === 404) {
      console.warn("[coach] activity fetch 404; marking event processed", {
        activityId,
        userId,
      });
    } else {
      console.error("[coach] activity fetch failed", {
        activityId,
        userId,
        status: summaryRes.status,
      });
    }
    await prisma.stravaEvent.update({
      where: { id: eventId },
      data: { processed: true },
    });
    return;
  }

  const s = summaryRes.data;
  const streams = await fetchActivityStreams(userId, activityId);
  const average_heartrate =
    typeof s.average_heartrate === "number" ? s.average_heartrate : null;
  const max_heartrate = typeof s.max_heartrate === "number" ? s.max_heartrate : null;

  const features = extractFeatures({
    moving_time: s.moving_time,
    average_heartrate,
    max_heartrate,
    raw_streams: streams,
  });

  const startedAt = new Date(s.start_date);

  const activityName =
    typeof s.name === "string" && s.name.trim() ? s.name.trim().slice(0, 280) : null;
  const sportType =
    typeof s.sport_type === "string" && s.sport_type.trim()
      ? s.sport_type.trim()
      : typeof s.type === "string" && s.type.trim()
        ? s.type.trim()
        : null;

  await prisma.activity.upsert({
    where: {
      userId_stravaActivityId: { userId, stravaActivityId: activityId },
    },
    create: {
      userId,
      stravaActivityId: activityId,
      distance: typeof s.distance === "number" ? s.distance : null,
      moving_time: s.moving_time,
      elapsed_time: s.elapsed_time,
      average_heartrate,
      max_heartrate,
      raw_streams: streams as object,
      startedAt,
      load_score: features.load_score,
      features_json: features as object,
      activityName,
      sportType,
    },
    update: {
      distance: typeof s.distance === "number" ? s.distance : null,
      moving_time: s.moving_time,
      elapsed_time: s.elapsed_time,
      average_heartrate,
      max_heartrate,
      raw_streams: streams as object,
      startedAt,
      load_score: features.load_score,
      features_json: features as object,
      activityName,
      sportType,
    },
  });

  await prisma.stravaEvent.update({
    where: { id: eventId },
    data: { processed: true },
  });

  console.info("[coach] activity processed", { userId, activityId, eventId });

  let context;
  let insights;
  try {
    context = await getUserTrainingContext(userId, startedAt, activityId);
    insights = generateInsights(features, context);
  } catch (e) {
    console.error("[coach] insight generation failed (post-store)", e);
    return;
  }

  console.info("[coach] insight generated", {
    userId,
    activityId,
    positives: insights.positives.length,
    warnings: insights.warnings.length,
  });

  const metrics = featuresToMetricsSummary(features);
  let formatted: string;
  try {
    formatted = await formatInsightWithAI(insights, metrics);
  } catch (e) {
    console.error("[coach] AI formatting failed; sending rule-based text", e);
    formatted = buildFallbackEmailBody(features, insights);
  }

  try {
    await sendInsightEmail(userId, formatted);
  } catch (e) {
    console.error("[coach] email delivery failed", e);
  }
}

function buildFallbackEmailBody(
  features: CoachFeatures,
  insights: InsightBundle
): string {
  const lines = [
    `Load score (internal): ${features.load_score.toFixed(2)}`,
    "",
    "What went well:",
    ...insights.positives.map((p) => `- ${p}`),
    ...(insights.positives.length === 0 ? ["- None noted"] : []),
    "",
    "Watch out:",
    ...insights.warnings.map((w) => `- ${w}`),
    ...(insights.warnings.length === 0 ? ["- None noted"] : []),
    "",
    "Tomorrow:",
    `- ${insights.recommendation}`,
  ];
  return lines.join("\n");
}
