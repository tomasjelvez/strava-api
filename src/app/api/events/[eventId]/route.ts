import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  CommunityJoinKind,
  CommunitySignupStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canStartSignup } from "@/lib/community-events/join-eligibility";
import { mapUserDisplayNames } from "@/lib/clerk-display";
import { computeAthletePerformanceSummary } from "@/lib/athlete-rollups";
import type { AthletePerformanceSummary } from "@/lib/athlete-rollups";

function isValidCuid(id: unknown): id is string {
  return typeof id === "string" && id.length > 8 && /^[a-z0-9]+$/i.test(id);
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ eventId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { eventId } = await ctx.params;
  if (!isValidCuid(eventId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const ev = await prisma.communityEvent.findUnique({
    where: { id: eventId },
    include: {
      signups: { where: { userId } },
      comments: {
        include: {
          images: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
      images: {
        orderBy: { createdAt: "desc" },
        take: 24,
      },
    },
  });

  if (!ev) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const mySignup = ev.signups[0] ?? null;
  const canViewDetails =
    ev.hostUserId === userId || mySignup?.status === CommunitySignupStatus.JOINED;

  const joinedCount = await prisma.communityEventSignup.count({
    where: {
      communityEventId: ev.id,
      status: CommunitySignupStatus.JOINED,
    },
  });

  const joinedParticipants = await prisma.communityEventSignup.findMany({
    where: {
      communityEventId: ev.id,
      status: CommunitySignupStatus.JOINED,
    },
    select: { id: true, userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 48,
  });

  const nameIds = [
    ev.hostUserId,
    ...(canViewDetails ? joinedParticipants.map((p) => p.userId) : []),
    ...(canViewDetails ? ev.comments.map((c) => c.authorUserId) : []),
    ...(canViewDetails ? ev.images.map((img) => img.uploaderUserId) : []),
    ...(canViewDetails
      ? ev.comments.flatMap((c) => c.images.map((img) => img.uploaderUserId))
      : []),
  ];
  const displayNames = await mapUserDisplayNames(nameIds);

  let pendingReviews: Array<{
    signupId: string;
    userId: string;
    displayName: string;
    createdAt: string;
    performance: AthletePerformanceSummary;
    appProfile: { declaresAsWoman: boolean; declaredSkillBand: string | null };
  }> = [];

  if (ev.hostUserId === userId && ev.joinKind === CommunityJoinKind.APPROVAL) {
    const pending = await prisma.communityEventSignup.findMany({
      where: {
        communityEventId: ev.id,
        status: CommunitySignupStatus.PENDING,
      },
      orderBy: { createdAt: "asc" },
    });

    const pUserIds = pending.map((p) => p.userId);
    const pNames = await mapUserDisplayNames(pUserIds);
    const profiles = await prisma.appProfile.findMany({
      where: { userId: { in: pUserIds } },
    });
    const profMap = new Map(profiles.map((p) => [p.userId, p]));

    pendingReviews = await Promise.all(
      pending.map(async (p) => {
        const perf = await computeAthletePerformanceSummary(prisma, p.userId);
        const ap = profMap.get(p.userId);
        return {
          signupId: p.id,
          userId: p.userId,
          displayName: pNames[p.userId] ?? "Miembro",
          createdAt: p.createdAt.toISOString(),
          performance: perf,
          appProfile: {
            declaresAsWoman: ap?.identifiesAsWoman ?? false,
            declaredSkillBand: ap?.declaredSkillBand ?? null,
          },
        };
      })
    );
  }

  if (!canViewDetails) {
    return NextResponse.json({
      event: {
        id: ev.id,
        hostUserId: ev.hostUserId,
        hostDisplayName: displayNames[ev.hostUserId] ?? "Anfitrión",
        title: ev.title,
        locationName: ev.locationName,
        startsAt: ev.startsAt.toISOString(),
        joinKind: ev.joinKind,
        sportTypeSnapshot: ev.sportTypeSnapshot,
        minSkillBand: ev.minSkillBand,
        paceNote: ev.paceNote,
        womenOnly: ev.womenOnly,
        maxParticipants: ev.maxParticipants,
        joinedCount,
        canViewDetails,
        mine: mySignup
          ? {
              status: mySignup.status,
              id: mySignup.id,
            }
          : null,
        canSignup: canStartSignup(ev, userId, joinedCount),
      },
    });
  }

  return NextResponse.json({
    event: {
      id: ev.id,
      hostUserId: ev.hostUserId,
      hostDisplayName: displayNames[ev.hostUserId] ?? "Anfitrión",
      title: ev.title,
      notes: ev.notes,
      locationName: ev.locationName,
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
      participants: joinedParticipants.map((p) => ({
        id: p.id,
        userId: p.userId,
        displayName: displayNames[p.userId] ?? "Miembro",
        joinedAt: p.createdAt.toISOString(),
      })),
      comments: ev.comments.map((c) => ({
        id: c.id,
        authorUserId: c.authorUserId,
        authorDisplayName: displayNames[c.authorUserId] ?? "Miembro",
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        images: c.images.map((img) => ({
          id: img.id,
          uploaderUserId: img.uploaderUserId,
          uploaderDisplayName: displayNames[img.uploaderUserId] ?? "Miembro",
          url: `/api/events/${encodeURIComponent(ev.id)}/images/${encodeURIComponent(img.id)}`,
          altText: img.altText,
          createdAt: img.createdAt.toISOString(),
        })),
      })),
      images: ev.images.map((img) => ({
        id: img.id,
        uploaderUserId: img.uploaderUserId,
        uploaderDisplayName: displayNames[img.uploaderUserId] ?? "Miembro",
        url: `/api/events/${encodeURIComponent(ev.id)}/images/${encodeURIComponent(img.id)}`,
        altText: img.altText,
        createdAt: img.createdAt.toISOString(),
      })),
      canViewDetails,
      mine: mySignup
        ? {
            status: mySignup.status,
            id: mySignup.id,
          }
        : null,
      canSignup: canStartSignup(ev, userId, joinedCount),
      pendingReviews:
        ev.hostUserId === userId ? pendingReviews : undefined,
    },
  });
}
