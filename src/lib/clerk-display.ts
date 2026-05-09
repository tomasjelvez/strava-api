import { clerkClient } from "@clerk/nextjs/server";

/** Best-effort first name / username / email local-part for small batches (e.g. host review). */
export async function mapUserDisplayNames(
  userIds: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  const out: Record<string, string> = {};
  const client = await clerkClient();
  await Promise.all(
    unique.map(async (uid) => {
      try {
        const u = await client.users.getUser(uid);
        out[uid] =
          u.firstName ??
          u.username ??
          u.primaryEmailAddress?.emailAddress?.split("@")[0] ??
          u.emailAddresses[0]?.emailAddress?.split("@")[0] ??
          "Miembro";
      } catch {
        out[uid] = "Miembro";
      }
    })
  );
  return out;
}
