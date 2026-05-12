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
          Perfil
        </h1>
      </header>

      <CommunityProfileCard />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold">
                Integración opcional: Strava
              </CardTitle>
              <CardDescription>
                La app ahora funciona sin Strava. Puedes conectarlo solo si quieres
                usar rutas o datos deportivos más adelante.
              </CardDescription>
            </div>
            <span
              className={
                isConnected
                  ? "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                  : "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              }
            >
              <span
                aria-hidden
                className={
                  isConnected
                    ? "size-1.5 rounded-full bg-primary"
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
                Seguimos guardando esta conexión para funciones avanzadas. Podés
                desconectar cuando quieras.
              </p>
              <StravaDisconnectButton />
            </div>
          ) : (
            <Link
              href="/api/strava/connect"
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              Conectar Strava opcionalmente
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Acerca de</CardTitle>
          <CardDescription>
            Esta app está enfocada en eventos sociales: inscripciones, fotos y
            comentarios de la comunidad.
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
