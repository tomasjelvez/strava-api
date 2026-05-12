import { CommunitySignupStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function getEventViewerAccess(eventId: string, userId: string) {
  const event = await prisma.communityEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      hostUserId: true,
      signups: {
        where: { userId },
        select: { id: true, status: true },
        take: 1,
      },
    },
  });

  if (!event) {
    return null;
  }

  const mySignup = event.signups[0] ?? null;
  const canViewDetails =
    event.hostUserId === userId || mySignup?.status === CommunitySignupStatus.JOINED;

  return {
    event,
    mySignup,
    canViewDetails,
  };
}
