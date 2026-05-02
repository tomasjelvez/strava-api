import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  SqliteDatabaseNotWritableError,
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
  stravaApiGetForUser,
} from "@/lib/strava-connection";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await stravaApiGetForUser(userId, "/athlete");

    if (!res.ok) {
      const text = await res.text();
      console.error("Strava API error:", res.status, text);
      return NextResponse.json(
        { error: "Strava API error", status: res.status },
        { status: res.status }
      );
    }

    const athlete = await res.json();
    return NextResponse.json(athlete);
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
    console.error("Strava API request failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch athlete data" },
      { status: 502 }
    );
  }
}
