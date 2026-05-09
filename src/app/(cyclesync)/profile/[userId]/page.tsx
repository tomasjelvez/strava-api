import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mapUserDisplayNames } from "@/lib/clerk-display";
import type { AthletePerformanceSummary } from "@/lib/athlete-rollups";
import { computeAthletePerformanceSummary } from "@/lib/athlete-rollups";
import { ProfileBitacoraView } from "./profile-bitacora-view";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const viewer = await auth();
  const viewerId = viewer.userId;
  if (!viewerId) redirect("/sign-in");

  const { userId } = await params;

  const profileRow = await prisma.appProfile.findUnique({
    where: { userId },
  });

  const isOwn = viewerId === userId;
  const profilePublic = profileRow?.profilePublic ?? true;

  if (!isOwn && !profilePublic) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Perfil
        </p>
        <p className="rounded-lg border bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
          Esta persona mantiene su bitácora en privado.
        </p>
        <Link
          href="/today"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  let performance: AthletePerformanceSummary | undefined;
  if (isOwn) {
    performance = await computeAthletePerformanceSummary(prisma, userId);
  }

  const nm = await mapUserDisplayNames([userId]);
  const displayName = nm[userId] ?? "Miembro";

  return (
    <ProfileBitacoraView
      userId={userId}
      displayName={displayName}
      isViewerOwner={isOwn}
      initialPerformance={performance}
    />
  );
}
