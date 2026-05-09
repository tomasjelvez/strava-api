import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseStravaRouteIdParam } from "@/lib/strava-route-id";
import { RouteDetailView } from "./route-detail-view";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { routeId } = await params;
  const routeIdNormalized = parseStravaRouteIdParam(routeId ?? "");
  if (!routeIdNormalized) {
    redirect("/routes");
  }

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });

  return (
    <RouteDetailView
      routeId={routeIdNormalized}
      isStravaConnected={!!connection}
    />
  );
}
