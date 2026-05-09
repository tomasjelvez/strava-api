"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPinned } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatDistanceMeters,
  formatElevation,
} from "@/lib/format-strava-metrics";
import { stravaRouteIdFromObject } from "@/lib/strava-route-id";

type StravaRouteSummary = {
  id?: number | string;
  name?: string;
  distance?: number;
  elevation_gain?: number;
  description?: string;
  type?: string | number;
  sport_type?: string;
  private?: boolean;
};

function routeTypeLabel(r: StravaRouteSummary): string | null {
  if (typeof r.sport_type === "string" && r.sport_type) return r.sport_type;
  if (typeof r.type === "string" && r.type) return r.type;
  if (typeof r.type === "number") return String(r.type);
  return null;
}

function RoutesListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/5 max-w-xs" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RoutesView({
  isStravaConnected,
}: {
  isStravaConnected: boolean;
}) {
  const [items, setItems] = useState<StravaRouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStravaConnected) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/strava/routes?per_page=50");
        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};

        if (cancelled) return;

        if (!res.ok) {
          const msg =
            typeof payload.error === "string"
              ? payload.error
              : "No se pudieron cargar las rutas.";
          setError(msg);
          setItems([]);
          return;
        }

        const list = Array.isArray(payload) ? payload : [];
        setItems(
          list.filter(
            (x): x is StravaRouteSummary =>
              x !== null &&
              typeof x === "object" &&
              !Array.isArray(x) &&
              stravaRouteIdFromObject(x as Record<string, unknown>) !== null
          )
        );
        setError(null);
      } catch {
        if (!cancelled) {
          setError("No se pudieron cargar las rutas.");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStravaConnected]);

  if (!isStravaConnected) {
    return (
      <div className="space-y-5">
        <header className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Rutas
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Rutas de Strava
          </h1>
          <p className="text-sm text-muted-foreground">
            Revisá las rutas que creaste en Strava y exportá GPX o TCX.
          </p>
        </header>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Conecta Strava
            </CardTitle>
            <CardDescription>
              En Ajustes conectá tu cuenta para listar y abrir tus rutas
              guardadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
            <Link
              href="/settings"
              className={buttonVariants({ className: "w-full" })}
            >
              Ir a ajustes
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Rutas
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Tus rutas en Strava
        </h1>
        <p className="text-sm text-muted-foreground">
          Rutas que creaste. Tocá una para exportar o abrirla en Strava.
        </p>
      </header>

      {loading ? <RoutesListSkeleton /> : null}

      {!loading && error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Strava no devolvió rutas. Creá una en Strava y probá de nuevo.
        </p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((r) => {
            const sid = stravaRouteIdFromObject(
              r as unknown as Record<string, unknown>
            );
            if (!sid) return null;
            const typeLabel = routeTypeLabel(r);
            return (
              <li key={sid}>
                <Link
                  href={`/routes/${encodeURIComponent(sid)}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-4 ring-1 ring-foreground/5 transition-colors",
                    "hover:bg-muted/40"
                  )}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-foreground/5">
                    <MapPinned
                      className="size-4 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-snug">
                      {r.name?.trim() || `Ruta ${sid}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceMeters(r.distance)}
                      {r.elevation_gain != null && r.elevation_gain > 0
                        ? ` · desnivel ${formatElevation(r.elevation_gain)}`
                        : ""}
                      {typeLabel ? ` · ${typeLabel}` : ""}
                      {r.private ? " · Privada" : ""}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
