import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { exchangeCode } from "@/lib/strava";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const scope = searchParams.get("scope") ?? "";
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/dashboard?strava=denied", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?strava=error&reason=no_code", request.url)
    );
  }

  if (state !== userId) {
    return NextResponse.redirect(
      new URL("/dashboard?strava=error&reason=state_mismatch", request.url)
    );
  }

  try {
    const tokenData = await exchangeCode(code);

    await prisma.stravaConnection.upsert({
      where: { userId },
      update: {
        athleteId: tokenData.athlete.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_at,
        scope,
      },
      create: {
        userId,
        athleteId: tokenData.athlete.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_at,
        scope,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard?strava=connected", request.url)
    );
  } catch (err) {
    console.error("Strava OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?strava=error&reason=token_exchange", request.url)
    );
  }
}
