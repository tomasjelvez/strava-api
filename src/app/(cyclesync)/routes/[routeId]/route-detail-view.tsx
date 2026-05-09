"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, ArrowLeft, Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDistanceMeters,
  formatDurationSeconds,
  formatElevation,
} from "@/lib/format-strava-metrics";
import { stravaRouteIdFromObject } from "@/lib/strava-route-id";
import {
  decodeStravaLatLng,
  getRoutePolylineString,
} from "@/lib/strava-route-polyline";

const RoutePreviewMap = dynamic(
  () => import("@/components/cyclesync/route-preview-map"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-56 w-full rounded-xl" />,
  }
);

type StravaRouteDetail = {
  id: number | string;
  map?: {
    summary_polyline?: string;
    polyline?: string;
    id?: string | number | null;
  };
  name?: string;
  description?: string;
  distance?: number;
  elevation_gain?: number;
  estimated_moving_time?: number;
  type?: string | number;
  sport_type?: string;
  private?: boolean;
};

function routeTypeLabel(r: StravaRouteDetail): string | null {
  if (typeof r.sport_type === "string" && r.sport_type) return r.sport_type;
  if (typeof r.type === "string" && r.type) return r.type;
  if (typeof r.type === "number") return String(r.type);
  return null;
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

export function RouteDetailView({
  routeId,
  isStravaConnected,
}: {
  routeId: string;
  isStravaConnected: boolean;
}) {
  const [route, setRoute] = useState<StravaRouteDetail | null>(null);
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
        const res = await fetch(
          `/api/strava/routes/${encodeURIComponent(routeId)}`,
          { cache: "no-store" }
        );
        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};

        if (cancelled) return;

        if (!res.ok) {
          let msg =
            typeof payload.error === "string"
              ? payload.error
              : "No se pudo cargar esta ruta.";
          const code =
            typeof payload.code === "string" ? payload.code : undefined;
          if (code === "strava_connection_required") {
            msg = `${msg} Abrí Ajustes → Strava y conectá tu cuenta.`;
          }
          setError(msg);
          setRoute(null);
          return;
        }

        const row =
          payload &&
          typeof payload === "object" &&
          !Array.isArray(payload)
            ? (payload as Record<string, unknown>)
            : null;

        if (row !== null && stravaRouteIdFromObject(row)) {
          const withNumericId = row as unknown as StravaRouteDetail;
          setRoute(withNumericId);
          setError(null);
        } else {
          setRoute(null);
          setError("Respuesta inesperada de Strava.");
        }
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar esta ruta.");
          setRoute(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isStravaConnected, routeId]);

  const encodedPolyline = useMemo(
    () => (route ? getRoutePolylineString(route) : null),
    [route]
  );
  const mapPositions = useMemo(
    () => (encodedPolyline ? decodeStravaLatLng(encodedPolyline) : []),
    [encodedPolyline]
  );

  const stravaUrl = `https://www.strava.com/routes/${encodeURIComponent(routeId)}`;

  if (!isStravaConnected) {
    return (
      <div className="space-y-5">
        <Link
          href="/routes"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver a rutas
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Conecta Strava
            </CardTitle>
            <CardDescription>
              En Ajustes conectá Strava para ver y exportar esta ruta.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-5">
            <Link href="/settings" className={buttonVariants()}>
              Ir a ajustes
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/routes"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Todas las rutas
      </Link>

      {loading ? <DetailSkeleton /> : null}

      {!loading && error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!loading && !error && route ? (
        <>
          <header className="space-y-1">
            <h1 className="font-heading text-xl font-semibold leading-snug tracking-tight">
              {route.name?.trim() ||
                `Ruta ${typeof route.id === "number" ? route.id : routeId}`}
            </h1>
            <p className="text-xs text-muted-foreground">
              {[
                formatDistanceMeters(route.distance),
                route.elevation_gain != null && route.elevation_gain > 0
                  ? `desnivel ${formatElevation(route.elevation_gain)}`
                  : null,
                route.estimated_moving_time != null &&
                route.estimated_moving_time > 0
                  ? `~${formatDurationSeconds(route.estimated_moving_time)} en movimiento`
                  : null,
                routeTypeLabel(route),
                route.private ? "Privada" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>

          {route.description?.trim() ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Descripción
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-5">
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {route.description.trim()}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="py-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Vista previa
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-0 pt-2">
              {mapPositions.length >= 2 ? (
                <RoutePreviewMap positions={mapPositions} />
              ) : (
                <CardDescription>
                  No hay geometría en el mapa para esta ruta (Strava no envió polyline).
                </CardDescription>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Link
              href={`/events/new?routeId=${encodeURIComponent(routeId)}`}
              className={buttonVariants({
                variant: "default",
                className: "w-full justify-center",
              })}
            >
              Crear evento con esta ruta
            </Link>
            <a
              href={stravaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({
                variant: "outline",
                className: "w-full justify-center gap-2",
              })}
            >
              <ExternalLink className="size-4" aria-hidden />
              Abrir en Strava
            </a>
            <a
              href={`/api/strava/routes/${encodeURIComponent(routeId)}/export_gpx`}
              download
              className={buttonVariants({
                variant: "secondary",
                className: "w-full justify-center gap-2",
              })}
            >
              <Download className="size-4" aria-hidden />
              Descargar GPX
            </a>
            <a
              href={`/api/strava/routes/${encodeURIComponent(routeId)}/export_tcx`}
              download
              className={buttonVariants({
                variant: "secondary",
                className: "w-full justify-center gap-2",
              })}
            >
              <Download className="size-4" aria-hidden />
              Descargar TCX
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
