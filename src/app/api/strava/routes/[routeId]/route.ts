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
    const res = await stravaApiGetForUser(userId, `/routes/${id}`);

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("Strava route detail error:", res.status, bodyText);
      if (res.status === 404) {
        return NextResponse.json(
          {
            error:
              "Strava returned 404 for this route (wrong id vs strava.com, revoked access, or private without read_all). Reload the routes list after this update—the app used to mis-parse very large numeric ids.",
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

    const route = parseStravaBodyPreservingSnowflakes<unknown>(bodyText);
    return NextResponse.json(route);
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
    console.error("Strava route fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch route" },
      { status: 502 }
    );
  }
}
