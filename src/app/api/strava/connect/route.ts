import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buildAuthUrl } from "@/lib/strava";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const authUrl = buildAuthUrl(userId);
  redirect(authUrl);
}
