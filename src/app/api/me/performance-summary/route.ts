import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { computeAthletePerformanceSummary } from "@/lib/athlete-rollups";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const summary = await computeAthletePerformanceSummary(prisma, userId);
  return NextResponse.json({ summary });
}
