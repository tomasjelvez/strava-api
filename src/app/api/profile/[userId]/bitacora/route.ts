import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { CommunitySignupStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;

/** Clerk user IDs are alphanumeric with underscores prefixes sometimes — keep loose. */
function isLikelyUserId(id: unknown): id is string {
  return typeof id === "string" && id.length >= 4 && /^[a-zA-Z0-9_]+$/.test(id);
}

type MergedSort = { sortAtMs: number; payload: Record<string, unknown> };

export async function GET(
  request: Request,
  ctx: { params: Promise<{ userId: string }> }
) {
  const { userId: viewerId } = await auth();
  if (!viewerId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId: profileUserId } = await ctx.params;
  if (!isLikelyUserId(profileUserId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const profile = await prisma.appProfile.findUnique({
    where: { userId: profileUserId },
  });
  const isPublic = profile?.profilePublic ?? true;
  if (!isPublic && profileUserId !== viewerId) {
    return NextResponse.json({ error: "El perfil es privado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_LIMIT)
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const [hosted, rsvps, activities] = await Promise.all([
    prisma.communityEvent.findMany({
      where: { hostUserId: profileUserId },
      orderBy: { startsAt: "desc" },
      take: Math.min(120, offset + limit + 80),
      select: {
        id: true,
        title: true,
        startsAt: true,
        sportTypeSnapshot: true,
        stravaRouteId: true,
        joinKind: true,
      },
    }),
    prisma.communityEventSignup.findMany({
      where: {
        userId: profileUserId,
        status: {
          in: [
            CommunitySignupStatus.JOINED,
            CommunitySignupStatus.PENDING,
          ],
        },
      },
      include: {
        communityEvent: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            sportTypeSnapshot: true,
            stravaRouteId: true,
            hostUserId: true,
            joinKind: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: Math.min(120, offset + limit + 80),
    }),
    prisma.activity.findMany({
      where: { userId: profileUserId },
      orderBy: { startedAt: "desc" },
      take: Math.min(120, offset + limit + 80),
      select: {
        id: true,
        activityName: true,
        sportType: true,
        distance: true,
        moving_time: true,
        startedAt: true,
      },
    }),
  ]);

  const merged: MergedSort[] = [];

  for (const e of hosted) {
    merged.push({
      sortAtMs: e.startsAt.getTime(),
      payload: {
        kind: "event_hosted",
        id: e.id,
        title: e.title,
        startsAt: e.startsAt.toISOString(),
        sportTypeSnapshot: e.sportTypeSnapshot,
        stravaRouteId: e.stravaRouteId,
        joinKind: e.joinKind,
      },
    });
  }

  for (const s of rsvps) {
    if (s.communityEvent.hostUserId === profileUserId) {
      continue;
    }
    merged.push({
      sortAtMs: s.communityEvent.startsAt.getTime(),
      payload: {
        kind: "event_joined",
        signupId: s.id,
        status: s.status,
        eventId: s.communityEvent.id,
        title: s.communityEvent.title,
        startsAt: s.communityEvent.startsAt.toISOString(),
        sportTypeSnapshot: s.communityEvent.sportTypeSnapshot,
        stravaRouteId: s.communityEvent.stravaRouteId,
        joinKind: s.communityEvent.joinKind,
      },
    });
  }

  for (const a of activities) {
    merged.push({
      sortAtMs: a.startedAt.getTime(),
      payload: {
        kind: "activity",
        id: a.id,
        name:
          (a.activityName && a.activityName.trim()) ??
          `${a.sportType ?? "Actividad"}`,
        sportType: a.sportType,
        distanceMeters: a.distance,
        movingTimeSeconds: a.moving_time,
        startedAt: a.startedAt.toISOString(),
      },
    });
  }

  merged.sort((a, b) => b.sortAtMs - a.sortAtMs);
  const sliced = merged.slice(offset, offset + limit);

  return NextResponse.json({
    items: sliced.map((x) => x.payload),
    offset,
    limit,
    hasMore: merged.length > offset + limit,
  });
}
