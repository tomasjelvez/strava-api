import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TodayView } from "./today-view";

export default async function TodayPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const [connection, user] = await Promise.all([
    prisma.stravaConnection.findUnique({ where: { userId } }),
    currentUser(),
  ]);

  const firstName =
    user?.firstName ??
    user?.username ??
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
    null;

  return (
    <TodayView
      isStravaConnected={!!connection}
      firstName={firstName}
    />
  );
}
