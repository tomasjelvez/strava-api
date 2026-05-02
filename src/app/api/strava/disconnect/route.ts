import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No Strava connection found" },
      { status: 404 }
    );
  }

  try {
    await fetch("https://www.strava.com/oauth/deauthorize", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: connection.accessToken,
      }),
    });
  } catch {
    // Best-effort deauthorization; continue even if it fails
  }

  await prisma.stravaConnection.delete({ where: { userId } });

  return NextResponse.json({ success: true });
}
