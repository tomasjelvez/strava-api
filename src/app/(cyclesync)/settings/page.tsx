import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StravaDisconnectButton } from "@/components/cyclesync/strava-disconnect-button";
import { CommunityProfileCard } from "@/components/cyclesync/community-profile-card";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });
  const isConnected = !!connection;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Ajustes
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Perfil e integraciones
        </h1>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold">Strava</CardTitle>
              <CardDescription>
                Sirve para cargar rutas, actividades y vistas previas en eventos.
              </CardDescription>
            </div>
            <span
              className={
                isConnected
                  ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
                  : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              }
            >
              <span
                aria-hidden
                className={
                  isConnected
                    ? "size-1.5 rounded-full bg-emerald-500"
                    : "size-1.5 rounded-full bg-muted-foreground"
                }
              />
              {isConnected ? "Conectado" : "Sin conectar"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          {isConnected ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Solo leemos actividades recientes. Podés desconectar cuando quieras.
              </p>
              <StravaDisconnectButton />
            </div>
          ) : (
            <Link
              href="/api/strava/connect"
              className={buttonVariants({
                variant: "strava",
                className: "w-full",
              })}
            >
              Conectar con Strava
            </Link>
          )}
        </CardContent>
      </Card>

      <CommunityProfileCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Acerca de</CardTitle>
          <CardDescription>
            Esta app usa Strava para rutas, actividades y eventos en grupo. No es
            asesoría médica ni coaching profesional.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          <Link
            href="/dashboard"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Abrir el panel clásico de Strava →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
