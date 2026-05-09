import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
  stravaApiFetchForUser,
} from "@/lib/strava-connection";
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
    const res = await stravaApiFetchForUser(
      userId,
      `/routes/${id}/export_gpx`
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Strava route GPX export error:", res.status, text);
      if (res.status === 404) {
        return NextResponse.json(
          {
            error:
              "Strava returned 404 for GPX export. Private routes need read_all—reconnect Strava in Settings—or the route id may be wrong.",
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

    const body = await res.arrayBuffer();
    const contentType =
      res.headers.get("content-type") ?? "application/gpx+xml";

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="strava-route-${encodeURIComponent(id)}.gpx"`,
      },
    });
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
    console.error("Strava route GPX export failed:", err);
    return NextResponse.json(
      { error: "Failed to export route" },
      { status: 502 }
    );
  }
}
