import { stravaApiGetForUser } from "@/lib/strava-connection";

export type StravaActivitySummary = {
  id: number;
  distance?: number;
  moving_time: number;
  elapsed_time: number;
  average_heartrate?: number;
  max_heartrate?: number;
  start_date: string;
};

export async function fetchActivitySummary(
  userId: string,
  activityId: number
): Promise<{ ok: true; data: StravaActivitySummary } | { ok: false; status: number }> {
  const res = await stravaApiGetForUser(userId, `/activities/${activityId}`);
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  const data = (await res.json()) as StravaActivitySummary;
  return { ok: true, data };
}

/**
 * Strava returns a JSON array of stream objects; we wrap for stable `raw_streams` shape.
 */
export async function fetchActivityStreams(
  userId: string,
  activityId: number
): Promise<unknown> {
  const qs = new URLSearchParams();
  for (const k of ["time", "heartrate", "velocity_smooth"]) {
    qs.append("keys", k);
  }
  const path = `/activities/${activityId}/streams?${qs}`;
  const res = await stravaApiGetForUser(userId, path);
  if (!res.ok) {
    console.warn("Strava streams fetch failed", {
      activityId,
      status: res.status,
    });
    return { streams: [] as unknown[] };
  }
  const arr = (await res.json()) as unknown[];
  return { streams: Array.isArray(arr) ? arr : [] };
}
