"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Crown,
  Timer,
  UserPlus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDistanceMeters,
  formatDurationSeconds,
  formatStartDateTime,
} from "@/lib/format-strava-metrics";
import type { AthletePerformanceSummary } from "@/lib/athlete-rollups";

type BitacoraItem =
  | {
      kind: "event_hosted";
      id: string;
      title: string;
      startsAt: string;
      sportTypeSnapshot?: string | null;
      stravaRouteId: string;
      joinKind: string;
    }
  | {
      kind: "event_joined";
      signupId: string;
      status: string;
      eventId: string;
      title: string;
      startsAt: string;
      sportTypeSnapshot?: string | null;
      stravaRouteId: string;
      joinKind: string;
    }
  | {
      kind: "activity";
      id: string;
      name: string;
      sportType?: string | null;
      distanceMeters?: number | null;
      movingTimeSeconds: number;
      startedAt: string;
    };

export function ProfileBitacoraView({
  userId,
  displayName,
  isViewerOwner,
  initialPerformance,
}: {
  userId: string;
  displayName: string;
  isViewerOwner: boolean;
  initialPerformance?: AthletePerformanceSummary;
}) {
  const [items, setItems] = useState<BitacoraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "60", offset: "0" });
      const res = await fetch(`/api/profile/${encodeURIComponent(userId)}/bitacora?${qs}`, {
        cache: "no-store",
      });
      const payload =
        res.headers.get("content-type")?.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};
      if (!res.ok) {
        setItems([]);
        setError(
          typeof payload.error === "string" ? payload.error : "No se pudo cargar."
        );
        return;
      }
      const rows = Array.isArray(payload.items) ? payload.items : [];
      setItems(rows as BitacoraItem[]);
    } catch {
      setItems([]);
      setError("No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <Link
        href="/today"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Hoy
      </Link>

      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Bitácora de rutas
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Eventos de la comunidad y actividades sincronizadas desde Strava.
        </p>
      </header>

      {isViewerOwner && initialPerformance ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Tu rendimiento (~90&nbsp;días)
            </CardTitle>
            <CardDescription>
              Ayuda a los anfitriones a contextualizar solicitudes: son los mismos
              números que ven cuando pedís cupo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 pb-5 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1 font-medium capitalize">
              {initialPerformance.activityCount} actividades registradas
            </span>
            {initialPerformance.totalDistanceM >= 1000 ? (
              <span className="rounded-full bg-muted px-3 py-1 font-medium capitalize">
                {formatDistanceMeters(initialPerformance.totalDistanceM)} en
                movimiento
              </span>
            ) : null}
            {initialPerformance.avgWeeklyLoadScore != null ? (
              <span className="rounded-full bg-muted px-3 py-1 font-medium capitalize">
                ~{initialPerformance.avgWeeklyLoadScore.toFixed(1)}{" "}
                carga semanal (unidades internas)
              </span>
            ) : (
              <span className="rounded-full bg-muted px-3 py-1">
                Esperando actividades sincronizadas…
              </span>
            )}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl w-full" />
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sin actividad todavía</CardTitle>
            <CardDescription>
              Organizá o sumate a eventos, sincronizá Strava y acá se irá armando
              la línea de tiempo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/events"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver eventos próximos →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {items.map((row, idx) => renderRow(row, idx))}
      </ul>
    </div>
  );
}

function renderRow(row: BitacoraItem, idx: number) {
  const key =
    row.kind === "activity"
      ? `a-${row.id}`
      : row.kind === "event_hosted"
        ? `h-${row.id}`
        : `j-${row.signupId}-${row.eventId}`;

  const icon =
    row.kind === "activity" ? (
      <Activity className="size-5 text-muted-foreground" aria-hidden />
    ) : row.kind === "event_hosted" ? (
      <Crown className="size-5 text-muted-foreground" aria-hidden />
    ) : (
      <UserPlus className="size-5 text-muted-foreground" aria-hidden />
    );

  return (
    <li key={`${key}-${idx}`}>
      <Card className="py-5">
        <CardContent className="flex gap-3">
          <span className="mt-0.5">{icon}</span>
          <div className="min-w-0 space-y-2">
            {row.kind === "activity" ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Actividad Strava
                </p>
                <p className="font-medium leading-snug">{row.name}</p>
                <p className="text-xs flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3.5" aria-hidden />
                    {formatStartDateTime(row.startedAt)}
                  </span>
                  {typeof row.distanceMeters === "number" && row.distanceMeters > 0 ? (
                    <span>{formatDistanceMeters(row.distanceMeters)}</span>
                  ) : null}
                  <span>
                    {formatDurationSeconds(row.movingTimeSeconds)} en movimiento
                  </span>
                </p>
                {typeof row.sportType === "string" && row.sportType.trim() ? (
                  <span className="inline-block rounded bg-muted px-2 py-0.5 text-[10px] font-medium capitalize">
                    {row.sportType.replace("_", " ").toLowerCase()}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {row.kind === "event_hosted" ? "Evento que organizás" : "Participación"}
                </p>
                <Link
                  href={`/events/${encodeURIComponent(row.kind === "event_hosted" ? row.id : row.eventId)}`}
                  className="font-medium underline-offset-4 hover:underline leading-snug"
                >
                  {row.title}
                </Link>
                <p className="text-xs flex flex-wrap gap-2 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {formatStartDateTime(row.startsAt)}
                  </span>
                  {row.sportTypeSnapshot ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
                      {row.sportTypeSnapshot.replace("_", " ").toLowerCase()}
                    </span>
                  ) : null}
                  {row.kind === "event_joined" ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                      {row.status === "PENDING" ? "Pendiente" : "Confirmada"}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link
                    href={`/routes/${encodeURIComponent(row.stravaRouteId)}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ver ruta en la app
                  </Link>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}
