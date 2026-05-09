import type { CommunityEvent, CommunityEventSignup } from "@/generated/prisma/client";
import { CommunityJoinKind, CommunitySignupStatus } from "@/generated/prisma/client";

type EventWithSignup = CommunityEvent & {
  signups: CommunityEventSignup[];
};

/**
 * True if the viewer could start a new signup (join or request) — not host, upcoming implied by caller.
 */
export function canStartSignup(
  ev: EventWithSignup,
  viewerUserId: string,
  joinedCount: number
): boolean {
  if (ev.hostUserId === viewerUserId) return false;

  const max = ev.maxParticipants;
  const my = ev.signups[0];

  if (ev.joinKind === CommunityJoinKind.OPEN) {
    if (
      my?.status === CommunitySignupStatus.JOINED ||
      my?.status === CommunitySignupStatus.PENDING
    ) {
      return false;
    }
    if (max != null && max > 0 && joinedCount >= max) {
      return false;
    }
    return (
      !my ||
      my.status === CommunitySignupStatus.CANCELLED ||
      my.status === CommunitySignupStatus.REJECTED
    );
  }

  // APPROVAL
  if (my?.status === CommunitySignupStatus.JOINED || my?.status === CommunitySignupStatus.PENDING) {
    return false;
  }
  if (max != null && max > 0 && joinedCount >= max) {
    return false;
  }
  return (
    !my ||
    my.status === CommunitySignupStatus.CANCELLED ||
    my.status === CommunitySignupStatus.REJECTED
  );
}
