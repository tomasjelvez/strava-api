import { stravaApiGetForUser } from "@/lib/strava-connection";

/** Strava usually sends numbers but tolerate numeric strings / loose JSON. */
export function coerceStravaNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function plausibleHrSamples(samples: number[]): { avg?: number; max?: number } {
  const vals = samples.filter((x) => x > 25 && x < 251);
  if (vals.length === 0) return {};
  let sum = 0;
  let max = vals[0]!;
  for (const x of vals) {
    sum += x;
    if (x > max) max = x;
  }
  return {
    avg: Math.round(sum / vals.length),
    max: Math.round(max),
  };
}

async function fetchHeartrateStreamSamples(
  userId: string,
  activityId: number
): Promise<number[] | null> {
  const qs = new URLSearchParams();
  qs.append("keys", "heartrate");
  const res = await stravaApiGetForUser(
    userId,
    `/activities/${activityId}/streams?${qs.toString()}`
  );
  if (!res.ok) return null;

  try {
    const arr = await res.json();
    if (!Array.isArray(arr)) return null;

    for (const item of arr) {
      if (
        item &&
        typeof item === "object" &&
        (item as { type?: unknown }).type === "heartrate" &&
        Array.isArray((item as { data?: unknown }).data)
      ) {
        return (item as { data: unknown[] }).data.filter(
          (x): x is number =>
            typeof x === "number" && Number.isFinite(x) && x > 0
        );
      }
    }
    return [];
  } catch {
    return null;
  }
}

/**
 * Prefer API aggregate fields when present; otherwise derive from heartrate stream
 * (Strava omits aggregates in some payloads even when HR exists — see SummaryActivity vs streams).
 */
export async function enrichStravaRecordWithHeartRate(
  userId: string,
  activityId: number,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const avg = coerceStravaNumber(payload.average_heartrate);
  const max = coerceStravaNumber(payload.max_heartrate);

  let nextAvg = avg;
  let nextMax = max;

  if (payload.has_heartrate === false) {
    const out = { ...payload };
    if (nextAvg !== undefined) out.average_heartrate = nextAvg;
    if (nextMax !== undefined) out.max_heartrate = nextMax;
    return out;
  }

  const hasBothAggregates =
    nextAvg !== undefined &&
    Number.isFinite(nextAvg) &&
    nextMax !== undefined &&
    Number.isFinite(nextMax);

  if (!hasBothAggregates) {
    const samples = await fetchHeartrateStreamSamples(userId, activityId);
    if (samples && samples.length > 0) {
      const fromStream = plausibleHrSamples(samples);
      if (nextAvg === undefined && fromStream.avg !== undefined) {
        nextAvg = fromStream.avg;
      }
      if (nextMax === undefined && fromStream.max !== undefined) {
        nextMax = fromStream.max;
      }
    }
  }

  const out = { ...payload };
  if (nextAvg !== undefined) out.average_heartrate = nextAvg;
  if (nextMax !== undefined) out.max_heartrate = nextMax;

  return out;
}
