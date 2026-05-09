"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";

interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  username: string;
  city: string;
  state: string;
  country: string;
  sex: string;
  premium: boolean;
  profile: string;
  profile_medium: string;
  follower_count: number;
  friend_count: number;
  measurement_preference: string;
  weight: number;
}

function StravaProfileSkeleton() {
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-full max-w-xs" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t py-4">
        <Skeleton className="h-9 w-full rounded-lg" />
      </CardFooter>
    </Card>
  );
}

export function StravaProfile() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/strava/athlete");
        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};

        if (cancelled) return;

        if (res.ok) {
          setAthlete(payload as StravaAthlete);
          setError(null);
          return;
        }

        if (res.status === 404) {
          setAthlete(null);
          setError(null);
          router.refresh();
          return;
        }

        if (
          res.status === 401 &&
          payload.code === "strava_reconnect_required"
        ) {
          setAthlete(null);
          setError(null);
          router.refresh();
          return;
        }

        if (res.status === 503 && payload.code === "database_not_writable") {
          setAthlete(null);
          setError(
            typeof payload.error === "string"
              ? payload.error
              : "La base de datos es solo lectura — revisá DATABASE_URL o el hosting."
          );
          return;
        }

        setAthlete(null);
        setError(
          typeof payload.error === "string"
            ? payload.error
            : "No se pudo obtener el atleta"
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "No se pudo obtener el atleta"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleDisconnect() {
    await fetch("/api/strava/disconnect", { method: "POST" });
    router.refresh();
  }

  if (loading) {
    return <StravaProfileSkeleton />;
  }

  if (error) {
    return (
      <Card className="w-full border-destructive/30">
        <CardContent className="p-6">
          <p className="text-destructive text-center text-sm leading-relaxed">
            {error}
          </p>
          <p className="text-muted-foreground mt-3 text-center text-xs">
            Si venció tu sesión, volvé a conectar Strava desde el panel después de
            resolver lo anterior.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!athlete) return null;

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center">
        <Avatar className="ring-background size-16 shrink-0 ring-2 ring-offset-2 ring-offset-card">
          <AvatarImage src={athlete.profile_medium} alt={athlete.firstname} />
          <AvatarFallback className="text-lg">
            {athlete.firstname?.[0]}
            {athlete.lastname?.[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-xl leading-tight sm:text-2xl">
            {athlete.firstname} {athlete.lastname}
          </CardTitle>
          <CardDescription className="text-sm">
            {[athlete.city, athlete.state, athlete.country]
              .filter(Boolean)
              .join(", ") || "Atleta de Strava"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {athlete.premium && <Badge>Premium</Badge>}
          {athlete.username && (
            <Badge variant="secondary">@{athlete.username}</Badge>
          )}
          {athlete.sex && (
            <Badge variant="outline">
              {athlete.sex === "M" ? "Hombre" : "Mujer"}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div className="bg-muted/40 rounded-lg border px-3 py-2.5 ring-1 ring-foreground/5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Seguidores
            </p>
            <p className="text-foreground mt-0.5 font-semibold tabular-nums">
              {athlete.follower_count ?? "—"}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg border px-3 py-2.5 ring-1 ring-foreground/5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Amigos
            </p>
            <p className="text-foreground mt-0.5 font-semibold tabular-nums">
              {athlete.friend_count ?? "—"}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg border px-3 py-2.5 ring-1 ring-foreground/5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Peso
            </p>
            <p className="text-foreground mt-0.5 font-semibold tabular-nums">
              {athlete.weight ? `${athlete.weight} kg` : "—"}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg border px-3 py-2.5 ring-1 ring-foreground/5">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Unidades
            </p>
            <p className="text-foreground mt-0.5 font-semibold">
              {athlete.measurement_preference === "feet"
                ? "Imperial"
                : "Métrico"}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          className="w-full border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
          onClick={handleDisconnect}
        >
          Desconectar Strava
        </Button>
      </CardFooter>
    </Card>
  );
}
