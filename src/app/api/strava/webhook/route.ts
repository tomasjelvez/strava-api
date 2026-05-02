/**
 * Strava Push Subscriptions API callback.
 *
 * Ops (once per environment): create a subscription pointing at this public HTTPS URL with the same `verify_token` as `STRAVA_VERIFY_TOKEN`:
 * POST https://www.strava.com/api/v3/push_subscriptions — see Strava webhook docs for client_secret + payload.
 */

import { after, NextResponse } from "next/server";

import { processStravaEvent } from "@/lib/coach/process-strava-event";
import { prisma } from "@/lib/prisma";

function verifyMatches(token: string | null): boolean {
  const expected = process.env.STRAVA_VERIFY_TOKEN?.trim();
  if (!expected) {
    console.error("[strava webhook] STRAVA_VERIFY_TOKEN is not configured");
    return false;
  }
  return Boolean(token && token === expected);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");

  if (mode !== "subscribe" || challenge == null) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!verifyMatches(verifyToken)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ "hub.challenge": challenge }, { status: 200 });
}

type PushBody = {
  aspect_type?: string;
  object_type?: string;
  object_id?: number;
  owner_id?: number;
  subscription_id?: number;
  event_time?: number;
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const verifyQuery = url.searchParams.get("hub.verify_token");
  if (verifyQuery != null && !verifyMatches(verifyQuery)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PushBody;
  try {
    body = (await request.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const aspectType = body.aspect_type;
  const objectType = body.object_type;
  const objectId = typeof body.object_id === "number" ? body.object_id : null;
  const ownerIdRaw = typeof body.owner_id === "number" ? body.owner_id : null;

  console.info("[strava webhook] received", {
    aspect_type: aspectType,
    object_type: objectType,
    object_id: objectId,
    owner_id: ownerIdRaw,
  });

  if (objectType !== "activity" || aspectType !== "create") {
    return new NextResponse(null, { status: 200 });
  }

  if (objectId === null || ownerIdRaw === null) {
    console.warn("[strava webhook] missing object_id or owner_id — ignoring");
    return new NextResponse(null, { status: 200 });
  }

  const connection = await prisma.stravaConnection.findUnique({
    where: { athleteId: ownerIdRaw },
  });

  if (!connection) {
    console.warn("[strava webhook] no mapped user for athlete", {
      owner_id: ownerIdRaw,
    });
    return new NextResponse(null, { status: 200 });
  }

  let eventRow;
  try {
    eventRow = await prisma.stravaEvent.upsert({
      where: {
        userId_activityId: {
          userId: connection.userId,
          activityId: objectId,
        },
      },
      create: {
        userId: connection.userId,
        activityId: objectId,
        processed: false,
      },
      update: {},
    });
  } catch (e) {
    console.error("[strava webhook] failed to store event", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  console.info("[strava webhook] event stored", {
    eventId: eventRow.id,
    userId: connection.userId,
    activityId: objectId,
  });

  if (!eventRow.processed) {
    after(async () => {
      try {
        await processStravaEvent(eventRow.id);
      } catch (e) {
        console.error("[strava webhook] processStravaEvent failed", e);
      }
    });
  }

  return new NextResponse(null, { status: 200 });
}
