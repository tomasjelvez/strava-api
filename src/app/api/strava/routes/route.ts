import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
  stravaApiGetForUser,
} from "@/lib/strava-connection";
import { parseStravaBodyPreservingSnowflakes } from "@/lib/strava-json-large-id";

const DEFAULT_PER_PAGE = 30;

function parseAthleteId(body: unknown): number | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const id = (body as { id?: unknown }).id;
  if (typeof id === "number" && Number.isFinite(id) && id > 0) {
    return Math.trunc(id);
  }
  if (
    typeof id === "string" &&
    /^\d+$/.test(id.trim()) &&
    id.trim() !== "0"
  ) {
    const n = Number(id.trim());
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }
  return null;
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perRaw = Number(searchParams.get("per_page")) || DEFAULT_PER_PAGE;
  const perPage = Math.min(100, Math.max(1, perRaw));

  try {
    const athleteRes = await stravaApiGetForUser(userId, "/athlete");
    if (!athleteRes.ok) {
      const text = await athleteRes.text();
      console.error("Strava athlete API error:", athleteRes.status, text);
      return NextResponse.json(
        { error: "Strava API error", status: athleteRes.status },
        { status: athleteRes.status }
      );
    }

    const athleteJson: unknown = await athleteRes.json();
    const athleteId = parseAthleteId(athleteJson);
    if (athleteId === null) {
      return NextResponse.json(
        { error: "Invalid athlete response from Strava" },
        { status: 502 }
      );
    }

    const qs = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });

    const res = await stravaApiGetForUser(
      userId,
      `/athletes/${athleteId}/routes?${qs.toString()}`
    );

    const bodyText = await res.text();
    if (!res.ok) {
      console.error("Strava routes API error:", res.status, bodyText);
      return NextResponse.json(
        { error: "Strava API error", status: res.status },
        { status: res.status }
      );
    }

    const routes = parseStravaBodyPreservingSnowflakes<unknown>(bodyText);
    return NextResponse.json(routes);
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
    console.error("Strava routes request failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch routes" },
      { status: 502 }
    );
  }
}
