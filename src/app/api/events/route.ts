import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  CommunityJoinKind,
  CommunitySignupStatus,
  type CommunityEvent,
  type CommunityEventSignup,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canStartSignup } from "@/lib/community-events/join-eligibility";
import { parseStravaBodyPreservingSnowflakes } from "@/lib/strava-json-large-id";
import { parseStravaRouteIdParam } from "@/lib/strava-route-id";
import {
  parseSkillBand,
  snapshotsFromStravaRouteJson,
} from "@/lib/community-events/route-snapshot";
import {
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
  stravaApiGetForUser,
} from "@/lib/strava-connection";

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

type EventListRow = CommunityEvent & {
  signups: CommunityEventSignup[];
};

function parseJoinKindParam(v: string | null): CommunityJoinKind | null {
  if (v === "OPEN" || v === "APPROVAL") return v;
  return null;
}

async function joinedCountMap(eventIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (eventIds.length === 0) return m;
  const rows = await prisma.communityEventSignup.groupBy({
    by: ["communityEventId"],
    where: {
      communityEventId: { in: eventIds },
      status: CommunitySignupStatus.JOINED,
    },
    _count: { _all: true },
  });
  for (const r of rows) {
    m.set(r.communityEventId, r._count._all);
  }
  return m;
}

function serializeListItem(
  ev: EventListRow,
  joinedCount: number,
  viewerId: string
) {
  const mySignup = ev.signups[0] ?? null;
  return {
    id: ev.id,
    hostUserId: ev.hostUserId,
    title: ev.title,
    notes: ev.notes,
    startsAt: ev.startsAt.toISOString(),
    joinKind: ev.joinKind,
    sportTypeSnapshot: ev.sportTypeSnapshot,
    routeNameSnapshot: ev.routeNameSnapshot,
    stravaRouteId: ev.stravaRouteId,
    distanceMetersSnapshot: ev.distanceMetersSnapshot,
    elevationGainSnapshot: ev.elevationGainSnapshot,
    minSkillBand: ev.minSkillBand,
    paceNote: ev.paceNote,
    womenOnly: ev.womenOnly,
    requisitesJson: ev.requisitesJson,
    maxParticipants: ev.maxParticipants,
    joinedCount,
    mine: mySignup
      ? { status: mySignup.status, id: mySignup.id }
      : null,
    canSignup: canStartSignup(ev, viewerId, joinedCount),
  };
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const per = Math.min(
    MAX_PER_PAGE,
    Math.max(1, Number(url.searchParams.get("per_page")) || DEFAULT_PER_PAGE)
  );
  const joinableOnly = url.searchParams.get("joinable") === "1";
  const joinKind = parseJoinKindParam(url.searchParams.get("join_kind"));
  const sportQ = url.searchParams.get("sport")?.trim() ?? "";

  const now = new Date();

  const events = await prisma.communityEvent.findMany({
    where: {
      startsAt: { gte: now },
      ...(joinKind ? { joinKind } : {}),
      ...(sportQ
        ? {
            sportTypeSnapshot: {
              contains: sportQ,
              mode: "insensitive",
            },
          }
        : {}),
    },
    include: {
      signups: { where: { userId } },
    },
    orderBy: { startsAt: "asc" },
    skip: (page - 1) * per,
    take: per,
  });

  const counts = await joinedCountMap(events.map((e) => e.id));

  let out = events;
  if (joinableOnly) {
    out = events.filter((ev) =>
      canStartSignup(ev, userId, counts.get(ev.id) ?? 0)
    );
  }

  const body = out.map((ev) =>
    serializeListItem(ev, counts.get(ev.id) ?? 0, userId)
  );

  return NextResponse.json({
    items: body,
    page,
    perPage: per,
    joinableOnly,
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const routeIdRaw = body.stravaRouteId;
  const routeParam =
    typeof routeIdRaw === "string"
      ? parseStravaRouteIdParam(routeIdRaw)
      : null;
  if (!routeParam) {
    return NextResponse.json({ error: "stravaRouteId inválido" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 280) : "";
  if (title.length < 2) {
    return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  }

  const startsRaw = body.startsAt;
  let startsAt: Date | null = null;
  if (typeof startsRaw === "string") {
    const d = new Date(startsRaw);
    if (!Number.isNaN(d.getTime())) startsAt = d;
  }
  if (!startsAt || startsAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json(
      { error: "La fecha de inicio debe ser futura" },
      { status: 400 }
    );
  }

  const joinKind =
    body.joinKind === CommunityJoinKind.APPROVAL
      ? CommunityJoinKind.APPROVAL
      : CommunityJoinKind.OPEN;

  const notesRaw =
    typeof body.notes === "string" ? body.notes.trim().slice(0, 5000) : "";
  const notes = notesRaw.length ? notesRaw : null;

  let maxParticipants: number | null = null;
  if (body.maxParticipants != null) {
    const n =
      typeof body.maxParticipants === "number"
        ? body.maxParticipants
        : typeof body.maxParticipants === "string"
          ? Number(body.maxParticipants)
          : NaN;
    if (Number.isFinite(n) && n > 0 && n <= 999) maxParticipants = Math.trunc(n);
  }

  const minSkillBand = parseSkillBand(body.minSkillBand);
  const paceNote =
    typeof body.paceNote === "string"
      ? body.paceNote.trim().slice(0, 400)
      : null;
  const womenOnly =
    typeof body.womenOnly === "boolean" ? body.womenOnly : false;

  let requisitesJson: object | undefined;
  if (body.requisitesJson != null && typeof body.requisitesJson === "object" && !Array.isArray(body.requisitesJson)) {
    requisitesJson = body.requisitesJson as object;
  }

  let routeJson: Record<string, unknown>;
  try {
    const res = await stravaApiGetForUser(userId, `/routes/${routeParam}`);
    const txt = await res.text();
    if (!res.ok) {
      console.error("Strava route fetch for event create:", res.status, txt);
      return NextResponse.json(
        {
          error: "No se pudo cargar la ruta desde Strava",
          status: res.status,
        },
        { status: res.status === 404 ? 404 : 502 }
      );
    }
    const parsed = parseStravaBodyPreservingSnowflakes<unknown>(txt);
    routeJson =
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
  } catch (err) {
    if (err instanceof StravaConnectionNotFoundError) {
      return NextResponse.json(
        {
          error: "Conectá Strava para crear un evento",
          code: "strava_connection_required",
        },
        { status: 400 }
      );
    }
    if (err instanceof StravaReconnectRequiredError) {
      return NextResponse.json(
        {
          error: "Volvé a conectar Strava para crear un evento",
          code: "strava_reconnect_required",
        },
        { status: 401 }
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: "No se pudo validar la ruta con Strava" },
      { status: 502 }
    );
  }

  const snaps = snapshotsFromStravaRouteJson(routeJson);
  if (!snaps.stravaRouteId || snaps.stravaRouteId !== routeParam) {
    return NextResponse.json(
      { error: "Respuesta inesperada de Strava para la ruta" },
      { status: 502 }
    );
  }

  const ev = await prisma.communityEvent.create({
    data: {
      hostUserId: userId,
      stravaRouteId: routeParam,
      title,
      notes,
      startsAt,
      joinKind,
      sportTypeSnapshot: snaps.sportTypeSnapshot ?? undefined,
      routeNameSnapshot: snaps.routeNameSnapshot ?? undefined,
      distanceMetersSnapshot: snaps.distanceMetersSnapshot ?? undefined,
      elevationGainSnapshot: snaps.elevationGainSnapshot ?? undefined,
      minSkillBand: minSkillBand ?? undefined,
      paceNote: paceNote ?? undefined,
      womenOnly,
      maxParticipants: maxParticipants ?? undefined,
      requisitesJson: requisitesJson ?? undefined,
    },
  });

  return NextResponse.json({ event: serializeListItem({ ...ev, signups: [] }, 0, userId) });
}
