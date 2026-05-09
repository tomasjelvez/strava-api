import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewEventWizard } from "./new-event-wizard";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ routeId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });

  const sp = await searchParams;
  const rid = typeof sp.routeId === "string" ? sp.routeId.trim() : "";

  return (
    <NewEventWizard
      isStravaConnected={!!connection}
      initialRouteId={rid || null}
    />
  );
}
