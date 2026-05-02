import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  SqliteDatabaseNotWritableError,
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
  stravaApiGetForUser,
} from "@/lib/strava-connection";
import {
  coerceStravaNumber,
  enrichStravaRecordWithHeartRate,
} from "@/lib/strava-heart-rate";

const DEFAULT_PER_PAGE = 30;

/** Strava only returns SummaryActivity objects from `/athlete/activities`; those omit HR fields even with `activity:read_all`, and aggregates are sometimes absent without streams. */
const DETAIL_FETCH_CONCURRENCY = 10;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function coerceActivitySummaryId(summary: Record<string, unknown>): number | null {
  const n = coerceStravaNumber(summary.id);
  if (n !== undefined && n > 0) return Math.trunc(n);
  return null;
}

async function enrichSummariesWithHeartRate(
  userId: string,
  summaries: unknown[]
): Promise<unknown[]> {
  if (!Array.isArray(summaries)) return summaries;

  const out = new Array<unknown>(summaries.length);

  for (let start = 0; start < summaries.length; start += DETAIL_FETCH_CONCURRENCY) {
    const end = Math.min(start + DETAIL_FETCH_CONCURRENCY, summaries.length);
    await Promise.all(
      Array.from({ length: end - start }, (_, k) => start + k).map(
        async (idx) => {
          const summary = summaries[idx];
          if (!isPlainObject(summary)) {
            out[idx] = summary;
            return;
          }

          const actId = coerceActivitySummaryId(summary);
          if (actId === null) {
            out[idx] = summary;
            return;
          }

          if (coerceStravaNumber(summary.average_heartrate) !== undefined) {
            out[idx] = summary;
            return;
          }

          try {
            const dRes = await stravaApiGetForUser(userId, `/activities/${actId}`);
            if (!dRes.ok) {
              out[idx] = summary;
              return;
            }
            const parsed = await dRes.json();
            const dObj = isPlainObject(parsed) ? parsed : {};
            const merged = await enrichStravaRecordWithHeartRate(
              userId,
              actId,
              dObj
            );
            const avgHr = coerceStravaNumber(merged.average_heartrate);

            const maxHr = coerceStravaNumber(merged.max_heartrate);

            const patch: Record<string, unknown> = { ...summary };
            if (avgHr !== undefined) patch.average_heartrate = avgHr;
            if (maxHr !== undefined) patch.max_heartrate = maxHr;

            out[idx] =
              avgHr !== undefined || maxHr !== undefined ? patch : summary;
          } catch {
            out[idx] = summary;
          }
        }
      )
    );
  }

  return out;
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perRaw = Number(searchParams.get("per_page")) || DEFAULT_PER_PAGE;
  const perPage = Math.min(50, Math.max(1, perRaw));

  const qs = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  try {
    const res = await stravaApiGetForUser(
      userId,
      `/athlete/activities?${qs.toString()}`
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Strava activities API error:", res.status, text);
      return NextResponse.json(
        { error: "Strava API error", status: res.status },
        { status: res.status }
      );
    }

    const activities = await res.json();
    const enriched = Array.isArray(activities)
      ? await enrichSummariesWithHeartRate(userId, activities)
      : activities;

    return NextResponse.json(enriched);
  } catch (err) {
    if (err instanceof StravaConnectionNotFoundError) {
      return NextResponse.json(
        { error: "No Strava connection found" },
        { status: 404 }
      );
    }
    if (err instanceof StravaReconnectRequiredError) {
      console.error("Strava reconnect required:", err);
      return NextResponse.json(
        {
          error:
            "Strava authorization expired or was revoked. Reconnect Strava from the dashboard.",
          code: "strava_reconnect_required",
        },
        { status: 401 }
      );
    }
    if (err instanceof SqliteDatabaseNotWritableError) {
      return NextResponse.json(
        {
          error: err.message,
          code: "database_not_writable",
        },
        { status: 503 }
      );
    }
    console.error("Strava activities request failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 502 }
    );
  }
}
