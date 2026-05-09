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
  request: Request,
  ctx: { params: Promise<{ eventId: string; signupId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { eventId, signupId } = await ctx.params;
  if (!isValidCuid(eventId) || !isValidCuid(signupId)) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const body =
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const decision = body.decision === "reject" ? "reject" : "accept";

  const event = await prisma.communityEvent.findUnique({
    where: { id: eventId },
  });
  if (!event || event.hostUserId !== userId) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  if (event.joinKind !== CommunityJoinKind.APPROVAL) {
    return NextResponse.json(
      { error: "Este evento no requiere aprobación" },
      { status: 400 }
    );
  }

  const signup = await prisma.communityEventSignup.findFirst({
    where: {
      id: signupId,
      communityEventId: event.id,
      status: CommunitySignupStatus.PENDING,
    },
  });

  if (!signup) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (decision === "reject") {
    const updated = await prisma.communityEventSignup.update({
      where: { id: signup.id },
      data: { status: CommunitySignupStatus.REJECTED },
    });
    return NextResponse.json({ signup: { id: updated.id, status: updated.status } });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const joined = await tx.communityEventSignup.count({
        where: {
          communityEventId: event.id,
          status: CommunitySignupStatus.JOINED,
        },
      });
      const max = event.maxParticipants;
      if (max != null && max > 0 && joined >= max) {
        throw new Error("FULL");
      }
      return tx.communityEventSignup.update({
        where: { id: signup.id },
        data: { status: CommunitySignupStatus.JOINED },
      });
    });
    return NextResponse.json({ signup: { id: updated.id, status: updated.status } });
  } catch (e) {
    if (e instanceof Error && e.message === "FULL") {
      return NextResponse.json(
        { error: "El evento ya alcanzó el cupo máximo" },
        { status: 409 }
      );
    }
    throw e;
  }
}
