import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  CommunityJoinKind,
  CommunitySignupStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isValidCuid(id: unknown): id is string {
  return typeof id === "string" && id.length > 8 && /^[a-z0-9]+$/i.test(id);
}

export async function POST(
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

  const event = await prisma.communityEvent.findUnique({
    where: { id: eventId },
  });
  if (!event) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (event.hostUserId === userId) {
    return NextResponse.json(
      { error: "Los anfitriones no se inscriben por esta acción" },
      { status: 400 }
    );
  }

  if (event.startsAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "El evento ya comenzó" }, { status: 400 });
  }

  if (event.womenOnly) {
    const profile = await prisma.appProfile.findUnique({
      where: { userId },
    });
    if (!profile?.identifiesAsWoman) {
      return NextResponse.json(
        {
          error:
            "Este evento es solo mujeres; activá la identificación en Ajustes para solicitar cupo.",
          code: "women_only_profile_required",
        },
        { status: 403 }
      );
    }
  }

  try {
    const signup = await prisma.$transaction(async (tx) => {
      const joined = await tx.communityEventSignup.count({
        where: {
          communityEventId: event.id,
          status: CommunitySignupStatus.JOINED,
        },
      });

      const existing = await tx.communityEventSignup.findUnique({
        where: {
          communityEventId_userId: {
            communityEventId: event.id,
            userId,
          },
        },
      });

      if (existing?.status === CommunitySignupStatus.JOINED) {
        return existing;
      }
      if (existing?.status === CommunitySignupStatus.PENDING) {
        return existing;
      }

      const target =
        event.joinKind === CommunityJoinKind.OPEN
          ? CommunitySignupStatus.JOINED
          : CommunitySignupStatus.PENDING;

      const max = event.maxParticipants;
      if (
        target === CommunitySignupStatus.JOINED &&
        max != null &&
        max > 0 &&
        joined >= max
      ) {
        throw new Error("FULL");
      }

      if (!existing) {
        return tx.communityEventSignup.create({
          data: {
            communityEventId: event.id,
            userId,
            status: target,
          },
        });
      }

      if (
        existing.status === CommunitySignupStatus.REJECTED ||
        existing.status === CommunitySignupStatus.CANCELLED
      ) {
        if (
          target === CommunitySignupStatus.JOINED &&
          max != null &&
          max > 0 &&
          joined >= max
        ) {
          throw new Error("FULL");
        }
        return tx.communityEventSignup.update({
          where: { id: existing.id },
          data: { status: target },
        });
      }

      return existing;
    });

    return NextResponse.json({
      signup: {
        id: signup.id,
        status: signup.status,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FULL") {
      return NextResponse.json({ error: "El evento está lleno" }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
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

  const row = await prisma.communityEventSignup.findUnique({
    where: {
      communityEventId_userId: { communityEventId: eventId, userId },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (
    row.status !== CommunitySignupStatus.JOINED &&
    row.status !== CommunitySignupStatus.PENDING
  ) {
    return NextResponse.json(
      { error: "No hay inscripción para cancelar" },
      { status: 400 }
    );
  }

  await prisma.communityEventSignup.update({
    where: { id: row.id },
    data: { status: CommunitySignupStatus.CANCELLED },
  });

  return NextResponse.json({ ok: true });
}
