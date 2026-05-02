/** Feature vector for coaching rules (cheap metrics only). */

export type ActivityFeaturesInput = {
  moving_time: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  raw_streams: unknown;
};

export type CoachFeatures = {
  duration_minutes: number;
  avg_hr: number | null;
  max_hr: number | null;
  intensity_score: number | null;
  load_score: number;
  hr_drift: number | null;
  pace_variability: number | null;
};

type StreamBucket = Record<string, number[] | undefined>;

function parseStreams(payload: unknown): StreamBucket {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as { streams?: unknown };
  let list: unknown = obj.streams;
  if (!Array.isArray(list)) list = payload;
  if (!Array.isArray(list)) return {};

  const out: StreamBucket = {};
  for (const item of list) {
    if (
      item &&
      typeof item === "object" &&
      "type" in item &&
      "data" in item &&
      typeof (item as { type: unknown }).type === "string" &&
      Array.isArray((item as { data: unknown }).data)
    ) {
      const type = (item as { type: string }).type;
      const data = (item as { data: unknown[] }).data.filter(
        (x): x is number => typeof x === "number" && Number.isFinite(x)
      );
      out[type] = data;
    }
  }
  return out;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  const v =
    values.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (values.length - 1);
  return Math.sqrt(v);
}

function hrSeriesFromBuckets(buckets: StreamBucket): number[] {
  return buckets.heartrate?.filter((n) => n > 0) ?? [];
}

export function extractFeatures(input: ActivityFeaturesInput): CoachFeatures {
  const duration_minutes = input.moving_time / 60;
  let avg_hr = input.average_heartrate;
  let max_hr = input.max_heartrate;

  const buckets = parseStreams(input.raw_streams);
  const hrVals = hrSeriesFromBuckets(buckets);
  if (avg_hr == null && hrVals.length > 0) {
    avg_hr = mean(hrVals);
  }
  if (max_hr == null && hrVals.length > 0) {
    max_hr = Math.max(...hrVals);
  }

  let intensity_score: number | null = null;
  if (
    avg_hr != null &&
    max_hr != null &&
    max_hr > 0 &&
    avg_hr > 0 &&
    avg_hr <= max_hr
  ) {
    intensity_score = avg_hr / max_hr;
  }

  const load_score =
    intensity_score !== null ? duration_minutes * intensity_score : duration_minutes;

  let hr_drift: number | null = null;
  if (hrVals.length >= 12) {
    const mid = Math.floor(hrVals.length / 2);
    const first = hrVals.slice(0, mid);
    const second = hrVals.slice(mid);
    const m1 = mean(first);
    const m2 = mean(second);
    if (m1 !== null && m2 !== null && m1 !== 0) {
      hr_drift = (m2 - m1) / m1;
    }
  }

  let pace_variability: number | null = null;
  const vel = buckets.velocity_smooth?.filter((v) => v > 0) ?? [];
  if (vel.length >= 3) {
    pace_variability = sampleStdev(vel);
  }

  return {
    duration_minutes,
    avg_hr,
    max_hr,
    intensity_score,
    load_score,
    hr_drift,
    pace_variability,
  };
}
