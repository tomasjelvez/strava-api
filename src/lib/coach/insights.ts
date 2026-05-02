import type { CoachContext } from "@/lib/coach/context";
import type { CoachFeatures } from "@/lib/coach/features";

export type InsightBundle = {
  positives: string[];
  warnings: string[];
  recommendation: string;
};

function highLoadVsRecentAverage(
  features: CoachFeatures,
  context: CoachContext
): boolean {
  if (context.total_load_prior_7d <= 0 && context.avg_load_7d <= 0) {
    return false;
  }
  return context.avg_load_7d > 0 && features.load_score > context.avg_load_7d * 1.3;
}

export function generateInsights(
  features: CoachFeatures,
  context: CoachContext
): InsightBundle {
  const positives: string[] = [];
  const warnings: string[] = [];

  const highLoad = highLoadVsRecentAverage(features, context);
  if (highLoad) {
    warnings.push("high load vs your recent average");
  }

  if (context.training_days_7d >= 3) {
    positives.push("good consistency (3+ training days recently)");
  }

  if (highLoad && context.had_high_load_previous_utc_day) {
    warnings.push("accumulated fatigue (back-to-back high-load days)");
  }

  const progressive =
    context.activities_last_14d_count >= 2 &&
    context.current_7d_total_load > context.prior_7d_total_load;

  if (progressive) {
    positives.push("progressive overload versus last week");
  }

  let recommendation =
    "Keep a steady rhythm that matches how you feel during the next few days.";
  if (warnings.some((w) => w.includes("accumulated fatigue"))) {
    recommendation =
      "Prioritize easy movement or rest until you feel fresh; keep upcoming days lighter.";
  } else if (warnings.some((w) => w.includes("high load"))) {
    recommendation =
      "Emphasize recovery after this bigger session before stacking more hard work.";
  } else if (positives.some((p) => p.includes("progressive overload"))) {
    recommendation =
      "Good weekly progression—continue only if day-to-day energy still feels solid.";
  }

  return { positives, warnings, recommendation };
}
