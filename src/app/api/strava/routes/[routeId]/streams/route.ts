import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
  stravaApiGetForUser,
} from "@/lib/strava-connection";
import { parseStravaBodyPreservingSnowflakes } from "@/lib/strava-json-large-id";
import { parseStravaRouteIdParam } from "@/lib/strava-route-id";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ routeId: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { routeId } = await ctx.params;
  const id = parseStravaRouteIdParam(routeId);
  if (!id) {
    return NextResponse.json({ error: "Invalid route id" }, { status: 400 });
  }

  try {
    const res = await stravaApiGetForUser(userId, `/routes/${id}/streams`);

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("Strava route streams error:", res.status, bodyText);
      if (res.status === 404) {
        return NextResponse.json(
          {
            error:
              "Strava returned 404 for this route’s streams (private routes need read_all; reconnect Strava in Settings).",
            code: "strava_route_not_found",
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Strava API error", status: res.status },
        { status: res.status }
      );
    }

    const streams = parseStravaBodyPreservingSnowflakes<unknown>(bodyText);
    return NextResponse.json(streams);
  } catch (err) {
    if (err instanceof StravaConnectionNotFoundError) {
      return NextResponse.json(
        {
          error: "No Strava connection found",
          code: "strava_connection_required",
        },
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
    console.error("Strava route streams fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch route streams" },
      { status: 502 }
    );
  }
}
