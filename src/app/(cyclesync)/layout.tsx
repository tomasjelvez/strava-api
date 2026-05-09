import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { BottomNav } from "@/components/cyclesync/bottom-nav";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-5 py-3">
          <Link
            href="/today"
            className="font-heading text-sm font-semibold tracking-tight"
          >
            Strava
            <span className="ml-1 text-muted-foreground font-normal">
              Entrenamiento
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${userId}`}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Perfil
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pb-32 pt-5">{children}</main>

      <BottomNav />
    </div>
  );
}
