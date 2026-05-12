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
import { stravaRouteSportTypeLabel } from "@/lib/strava-route-display";
import {
  alignRouteStreamSamples,
  approximateAscentM,
  elevationRangeM,
  parseStravaRouteStreams,
  type ParsedRouteStreams,
} from "@/lib/strava-route-streams";
import { RouteElevationProfile } from "@/components/cyclesync/route-elevation-profile";

const RoutePreviewMap = dynamic(
  () => import("@/components/cyclesync/route-preview-map"),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="min-h-[min(58vh,520px)] w-full rounded-xl sm:min-h-[min(52vh,560px)]" />
    ),
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
  segments?: unknown[];
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5 ring-1 ring-border/40">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="min-h-[min(58vh,520px)] w-full rounded-xl sm:min-h-[min(52vh,560px)]" />
      <Skeleton className="h-32 w-full rounded-xl" />
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
  const [streams, setStreams] = useState<ParsedRouteStreams | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStravaConnected) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setRoute(null);
      setStreams(null);
      try {
        const [resRoute, resStreams] = await Promise.all([
          fetch(`/api/strava/routes/${encodeURIComponent(routeId)}`, {
            cache: "no-store",
          }),
          fetch(`/api/strava/routes/${encodeURIComponent(routeId)}/streams`, {
            cache: "no-store",
          }),
        ]);

        const routePayload =
          resRoute.headers.get("content-type")?.includes("application/json")
            ? await resRoute.json().catch(() => ({}))
            : {};

        if (cancelled) return;

        if (!resRoute.ok) {
          let msg =
            typeof routePayload.error === "string"
              ? routePayload.error
              : "No se pudo cargar esta ruta.";
          const code =
            typeof routePayload.code === "string"
              ? routePayload.code
              : undefined;
          if (code === "strava_connection_required") {
            msg = `${msg} Abrí Ajustes → Strava y conectá tu cuenta.`;
          }
          setError(msg);
          setRoute(null);
          setStreams(null);
          return;
        }

        const row =
          routePayload &&
          typeof routePayload === "object" &&
          !Array.isArray(routePayload)
            ? (routePayload as Record<string, unknown>)
            : null;

        if (row !== null && stravaRouteIdFromObject(row)) {
          setRoute(row as unknown as StravaRouteDetail);
          setError(null);
        } else {
          setRoute(null);
          setError("Respuesta inesperada de Strava.");
          setStreams(null);
          return;
        }

        if (resStreams.ok) {
          const streamPayload =
            resStreams.headers.get("content-type")?.includes("application/json")
              ? await resStreams.json().catch(() => null)
              : null;
          if (!cancelled && streamPayload != null) {
            setStreams(
              parseStravaRouteStreams(streamPayload) ?? {
                latlng: [],
                distanceM: [],
                altitudeM: [],
              }
            );
          }
        } else if (!cancelled) {
          setStreams(null);
        }
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar esta ruta.");
          setRoute(null);
          setStreams(null);
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

  const mapPositions = useMemo(() => {
    if (streams?.latlng && streams.latlng.length >= 2) return streams.latlng;
    if (encodedPolyline) return decodeStravaLatLng(encodedPolyline);
    return [];
  }, [streams, encodedPolyline]);

  const aligned = useMemo(() => {
    if (!streams) return { distanceM: [] as number[], altitudeM: [] as number[] };
    return alignRouteStreamSamples(streams);
  }, [streams]);

  const showElevationChart =
    aligned.distanceM.length >= 2 && aligned.altitudeM.length >= 2;

  const elevRange = useMemo(
    () => elevationRangeM(aligned.altitudeM),
    [aligned.altitudeM]
  );

  const profileAscentM = useMemo(
    () => approximateAscentM(aligned.altitudeM),
    [aligned.altitudeM]
  );

  const stravaUrl = `https://www.strava.com/routes/${encodeURIComponent(routeId)}`;
  const sportTypeLabel = route ? stravaRouteSportTypeLabel(route) : null;
  const segmentCount = Array.isArray(route?.segments)
    ? route.segments.length
    : 0;

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
          <header className="space-y-2">
            <h1 className="font-heading text-xl font-semibold leading-snug tracking-tight">
              {route.name?.trim() ||
                `Ruta ${typeof route.id === "number" ? route.id : routeId}`}
            </h1>
            {(sportTypeLabel || route.private) ? (
              <div className="flex flex-wrap gap-2">
                {sportTypeLabel ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-foreground ring-1 ring-border/60">
                    {sportTypeLabel}
                  </span>
                ) : null}
                {route.private ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border/60">
                    Privada
                  </span>
                ) : null}
              </div>
            ) : null}
          </header>

          <Card className="py-5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Resumen</CardTitle>
              <CardDescription className="text-xs">
                Datos de Strava y, si hay permisos, muestras del trazo detallado.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pb-5 sm:grid-cols-3">
              <StatCell
                label="Longitud"
                value={formatDistanceMeters(route.distance)}
              />
              <StatCell
                label="Desnivel (Strava)"
                value={
                  route.elevation_gain != null && route.elevation_gain > 0
                    ? formatElevation(route.elevation_gain)
                    : "—"
                }
              />
              <StatCell
                label="Tiempo estimado"
                value={
                  route.estimated_moving_time != null &&
                  route.estimated_moving_time > 0
                    ? formatDurationSeconds(route.estimated_moving_time)
                    : "—"
                }
              />
              {elevRange ? (
                <>
                  <StatCell
                    label="Elevación mín. (perfil)"
                    value={formatElevation(elevRange.min)}
                  />
                  <StatCell
                    label="Elevación máx. (perfil)"
                    value={formatElevation(elevRange.max)}
                  />
                </>
              ) : null}
              {showElevationChart && profileAscentM > 0 ? (
                <StatCell
                  label="Subida acumulada (perfil)"
                  value={formatElevation(profileAscentM)}
                />
              ) : null}
              {segmentCount > 0 ? (
                <StatCell
                  label="Segmentos en ruta"
                  value={String(segmentCount)}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card className="py-5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Mapa</CardTitle>
              <CardDescription className="text-xs">
                Trazado ampliado; podés hacer zoom y mover el mapa.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-0 pt-2">
              {mapPositions.length >= 2 ? (
                <RoutePreviewMap positions={mapPositions} />
              ) : (
                <CardDescription>
                  No hay geometría en el mapa para esta ruta (Strava no envió
                  polyline ni puntos en streams).
                </CardDescription>
              )}
            </CardContent>
          </Card>

          {showElevationChart ? (
            <Card className="py-5">
              <CardContent className="pb-5 pt-4">
                <RouteElevationProfile
                  distanceM={aligned.distanceM}
                  altitudeM={aligned.altitudeM}
                />
              </CardContent>
            </Card>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {streams
                ? "No hay datos de altimetría en los streams de esta ruta."
                : "No se pudieron cargar los streams (revisá permisos de Strava o reconectá en Ajustes)."}
            </p>
          )}

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
