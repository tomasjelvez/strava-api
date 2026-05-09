import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ActivityList } from "./activity-list";
import { StravaProfile } from "./strava-profile";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });

  const isConnected = !!connection;

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 xl:max-w-4xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
              Entrenamiento
            </p>
            <h1 className="text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Panel
            </h1>
            <p className="text-muted-foreground max-w-lg text-pretty text-sm">
              Resumen conectado a Strava y actividades recientes.
            </p>
          </div>
          <div
            className={cn(
              "flex shrink-0 self-start rounded-full border bg-card p-1 shadow-sm ring-1 ring-foreground/5",
              "sm:self-center"
            )}
          >
            <UserButton />
          </div>
        </header>

        {isConnected ? (
          <div className="flex flex-col gap-10">
            <section aria-label="Perfil de Strava">
              <StravaProfile />
            </section>
            <section aria-label="Actividades recientes">
              <ActivityList />
            </section>
          </div>
        ) : (
          <section className="max-w-md">
            <Card>
              <CardHeader>
                <CardTitle>Conectar Strava</CardTitle>
                <CardDescription>
                  Vinculá tu cuenta para ver tu perfil y traer actividades en vivo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link
                  href="/api/strava/connect"
                  className={buttonVariants({
                    variant: "strava",
                    className: "w-full",
                  })}
                >
                  Conectar con Strava
                </Link>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
