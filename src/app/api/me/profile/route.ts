import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { SkillBand } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseSkillBand } from "@/lib/community-events/route-snapshot";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const row =
    (await prisma.appProfile.findUnique({ where: { userId } })) ?? null;
  return NextResponse.json({
    profile: row
      ? {
          identifiesAsWoman: row.identifiesAsWoman,
          declaredSkillBand: row.declaredSkillBand,
          profilePublic: row.profilePublic,
        }
      : {
          identifiesAsWoman: false,
          declaredSkillBand: null as string | null,
          profilePublic: true,
        },
  });
}

export async function PATCH(request: Request) {
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
  const body =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const identifiesAsWoman =
    typeof body.identifiesAsWoman === "boolean"
      ? body.identifiesAsWoman
      : undefined;
  const profilePublic =
    typeof body.profilePublic === "boolean"
      ? body.profilePublic
      : undefined;

  let declaredSkillBand: SkillBand | null | undefined;
  if (body.declaredSkillBand === undefined) {
    declaredSkillBand = undefined;
  } else if (body.declaredSkillBand === null) {
    declaredSkillBand = null;
  } else {
    const p = parseSkillBand(body.declaredSkillBand);
    if (p === null) {
      return NextResponse.json(
        { error: "declaredSkillBand debe ser CASUAL, INTERMEDIATE o ADVANCED" },
        { status: 400 }
      );
    }
    declaredSkillBand = p;
  }

  if (
    identifiesAsWoman === undefined &&
    profilePublic === undefined &&
    declaredSkillBand === undefined
  ) {
    return NextResponse.json(
      { error: "No hay cambios para guardar" },
      { status: 400 }
    );
  }

  const saved = await prisma.appProfile.upsert({
    where: { userId },
    create: {
      userId,
      identifiesAsWoman: identifiesAsWoman ?? false,
      profilePublic: profilePublic ?? true,
      declaredSkillBand:
        declaredSkillBand === undefined ? undefined : declaredSkillBand,
    },
    update: {
      ...(identifiesAsWoman !== undefined ? { identifiesAsWoman } : {}),
      ...(profilePublic !== undefined ? { profilePublic } : {}),
      ...(declaredSkillBand !== undefined
        ? { declaredSkillBand: declaredSkillBand ?? null }
        : {}),
    },
  });

  return NextResponse.json({
    profile: {
      identifiesAsWoman: saved.identifiesAsWoman,
      declaredSkillBand: saved.declaredSkillBand,
      profilePublic: saved.profilePublic,
    },
  });
}
