import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RoutesView } from "./routes-view";

export default async function RoutesPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });

  return <RoutesView isStravaConnected={!!connection} />;
}
