import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  SqliteDatabaseNotWritableError,
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
} from "@/lib/strava-connection";
import { fetchStravaActivityDetail } from "@/lib/strava-fetch-activity";
import { enrichStravaRecordWithHeartRate } from "@/lib/strava-heart-rate";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ activityId: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activityId } = await ctx.params;
  const id = Number(activityId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid activity id" }, { status: 400 });
  }

  try {
    const res = await fetchStravaActivityDetail(userId, id);

    if (res.status === 404) {
      return NextResponse.json(
        { error: "Activity not found or inaccessible" },
        { status: 404 }
      );
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("Strava activity detail error:", res.status, text);
      return NextResponse.json(
        { error: "Strava API error", status: res.status },
        { status: res.status }
      );
    }

    const detail = await res.json();
    const obj =
      detail !== null && typeof detail === "object" && !Array.isArray(detail)
        ? (detail as Record<string, unknown>)
        : {};

    const merged = await enrichStravaRecordWithHeartRate(userId, id, obj);
    return NextResponse.json(merged);
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
    console.error("Strava activity fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 502 }
    );
  }
}
