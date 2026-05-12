"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Filter,
  MapPinned,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDistanceMeters,
  formatElevation,
  formatStartDateTime,
} from "@/lib/format-strava-metrics";

type ListMine = { status: string; id: string } | null;

type EventListItem = {
  id: string;
  title: string;
  notes?: string | null;
  locationName?: string | null;
  startsAt: string;
  joinKind: "OPEN" | "APPROVAL";
  sportTypeSnapshot?: string | null;
  routeNameSnapshot?: string | null;
  distanceMetersSnapshot?: number | null;
  elevationGainSnapshot?: number | null;
  paceNote?: string | null;
  womenOnly?: boolean;
  minSkillBand?: string | null;
  maxParticipants?: number | null;
  joinedCount: number;
  mine: ListMine;
  canSignup: boolean;
};

export function EventsView() {
  const [scope, setScope] = useState<"all" | "joinable">("all");
  const [joinKindFilter, setJoinKindFilter] = useState<
    "ANY" | "OPEN" | "APPROVAL"
  >("ANY");
  const [items, setItems] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("per_page", "40");
      if (scope === "joinable") qs.set("joinable", "1");
      if (joinKindFilter !== "ANY") qs.set("join_kind", joinKindFilter);
      const res = await fetch(`/api/events?${qs.toString()}`, {
        cache: "no-store",
      });
      const payload =
        res.headers.get("content-type")?.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};

      if (!res.ok) {
        setItems([]);
        setError(
          typeof payload.error === "string"
            ? payload.error
            : "No se pudo cargar la lista."
        );
        return;
      }
      const list = Array.isArray(payload.items) ? payload.items : [];
      setItems(list as EventListItem[]);
    } catch {
      setItems([]);
      setError("No se pudo cargar la lista de eventos.");
    } finally {
      setLoading(false);
    }
  }, [scope, joinKindFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Draft
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Eventos
            </h1>
            <p className="text-sm text-muted-foreground">
              Juntas de la comunidad para inscribirse, comentar y compartir fotos.
            </p>
          </div>
          <Link
            href="/events/new"
            className={buttonVariants({ size: "sm", className: "shrink-0" })}
          >
            Crear
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            <Filter className="size-3" aria-hidden />
            Vista
          </span>
          {(
            [
              ["all", "Próximos"],
              ["joinable", "Podés sumarte"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                scope === key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground">·</span>
          {(
            [
              ["ANY", "Cualquier modo"],
              ["OPEN", "Abierto"],
              ["APPROVAL", "Con cupo"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setJoinKindFilter(key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                joinKindFilter === key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
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
            <CardTitle className="text-base">No hay eventos próximos</CardTitle>
            <CardDescription>
              Creá el primer evento social para que la comunidad se pueda sumar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/events/new" className={buttonVariants()}>
              Crear evento
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {items.map((ev) => (
          <li key={ev.id}>
            <Link href={`/events/${ev.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="line-clamp-2 text-sm font-semibold leading-snug">
                        {ev.title}
                      </CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" aria-hidden />
                          {formatStartDateTime(ev.startsAt)}
                        </span>
                        {ev.sportTypeSnapshot ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                            {ev.sportTypeSnapshot.toLowerCase().replace("_", " ")}
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                    <ArrowRight
                      className="size-5 shrink-0 text-muted-foreground opacity-70"
                      aria-hidden
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pb-5">
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden />
                      {ev.joinedCount}
                      {typeof ev.maxParticipants === "number"
                        ? ` / ${ev.maxParticipants}`
                        : ""}{" "}
                      {ev.joinedCount === 1 ? "inscrito" : "inscritos"}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                      {ev.joinKind === "OPEN"
                        ? "Cupos abiertos"
                        : "Anfitrión aprueba"}
                    </span>
                    {ev.womenOnly ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Solo mujeres
                      </span>
                    ) : null}
                  </p>
                  {ev.routeNameSnapshot ? (
                    <p className="text-xs flex items-start gap-1.5 text-muted-foreground">
                      <MapPinned className="size-3.5 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{ev.routeNameSnapshot}</span>
                    </p>
                  ) : null}
                  {ev.locationName || ev.paceNote || ev.distanceMetersSnapshot != null ? (
                    <p className="text-[11px] text-muted-foreground">
                      {[
                        ev.locationName,
                        ev.distanceMetersSnapshot != null
                          ? formatDistanceMeters(ev.distanceMetersSnapshot)
                          : null,
                        ev.elevationGainSnapshot != null &&
                        ev.elevationGainSnapshot > 0
                          ? formatElevation(ev.elevationGainSnapshot)
                          : null,
                        ev.paceNote ? ev.paceNote : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {!ev.canSignup && ev.mine?.status === "JOINED" ? (
                    <p className="text-[11px] font-medium text-primary">
                      Estás dentro
                    </p>
                  ) : null}
                  {ev.canSignup ? (
                    <p className="text-[11px] font-medium text-primary">
                      Podés anotarte
                    </p>
                  ) : null}
                  {ev.mine?.status === "PENDING" ? (
                    <p className="text-[11px] font-medium text-primary">
                      Solicitud pendiente de aprobación
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
