"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatDistanceMeters,
  formatElevation,
} from "@/lib/format-strava-metrics";
import { stravaRouteIdFromObject } from "@/lib/strava-route-id";
import { cn } from "@/lib/utils";

type StravaRouteSummary = {
  id?: number | string;
  name?: string;
  distance?: number;
  elevation_gain?: number;
  sport_type?: string;
  type?: string | number;
};

export function NewEventWizard({
  isStravaConnected,
  initialRouteId,
}: {
  isStravaConnected: boolean;
  initialRouteId: string | null;
}) {
  const router = useRouter();
  const [routes, setRoutes] = useState<StravaRouteSummary[]>([]);
  const [routeSearch, setRouteSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialRouteId);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [joinKind, setJoinKind] = useState<"OPEN" | "APPROVAL">("OPEN");
  const [womenOnly, setWomenOnly] = useState(false);
  const [paceNote, setPaceNote] = useState("");
  const [minSkillBand, setMinSkillBand] = useState<string>("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isStravaConnected) {
      setLoadingRoutes(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/strava/routes?per_page=80");
        const payload = res.ok
          ? await res.json().catch(() => [])
          : [];
        if (!cancelled && Array.isArray(payload)) {
          setRoutes(
            payload.filter(
              (x): x is StravaRouteSummary =>
                !!x &&
                typeof x === "object" &&
                stravaRouteIdFromObject(x as Record<string, unknown>) !== null
            )
          );
        }
      } finally {
        if (!cancelled) setLoadingRoutes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStravaConnected]);

  const filteredRoutes = useMemo(() => {
    const q = routeSearch.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => {
      const name = typeof r.name === "string" ? r.name.toLowerCase() : "";
      const id =
        typeof r.id === "number"
          ? String(r.id)
          : typeof r.id === "string"
            ? r.id
            : "";
      return name.includes(q) || id.includes(q);
    });
  }, [routes, routeSearch]);

  const submit = useCallback(async () => {
    if (!selectedId) {
      setError("Elegí una ruta de tus rutas de Strava.");
      return;
    }
    if (title.trim().length < 2) {
      setError("Poné un título corto para el evento.");
      return;
    }

    let startsIso = "";
    if (startsAtLocal) {
      const d = new Date(startsAtLocal);
      if (!Number.isNaN(d.getTime())) startsIso = d.toISOString();
    }
    if (!startsIso || new Date(startsIso) <= new Date()) {
      setError("Elegí una fecha y hora de inicio en el futuro.");
      return;
    }

    let maxP: number | undefined;
    if (maxParticipants.trim()) {
      const n = Number(maxParticipants);
      if (Number.isFinite(n) && n > 0) maxP = Math.min(999, Math.trunc(n));
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stravaRouteId: selectedId,
          title: title.trim(),
          notes: notes.trim() || undefined,
          startsAt: startsIso,
          joinKind,
          womenOnly,
          paceNote: paceNote.trim() || undefined,
          minSkillBand:
            minSkillBand === ""
              ? undefined
              : minSkillBand,
          maxParticipants: maxP,
        }),
      });
      const payload =
        res.headers.get("content-type")?.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};

      if (!res.ok) {
        setError(
          typeof payload.error === "string"
            ? payload.error
            : "No se pudo crear el evento."
        );
        return;
      }
      const id =
        typeof payload.event?.id === "string"
          ? payload.event.id
          : null;
      if (!id) {
        setError("Respuesta inesperada del servidor.");
        return;
      }
      router.replace(`/events/${id}`);
      router.refresh();
    } catch {
      setError("Error de red. Probá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedId,
    title,
    notes,
    startsAtLocal,
    joinKind,
    womenOnly,
    paceNote,
    minSkillBand,
    maxParticipants,
    router,
  ]);

  if (!isStravaConnected) {
    return (
      <div className="space-y-4">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conecta Strava</CardTitle>
            <CardDescription>
              Necesitás Strava para elegir una de tus rutas guardadas y crear el
              evento.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
        href="/events"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Todos los eventos
      </Link>

      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Nuevo evento
        </h1>
        <p className="text-sm text-muted-foreground">
          Elegí una ruta, definí requisitos y publicá en el feed de la comunidad.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">1. Ruta</CardTitle>
          <CardDescription>
            Buscá por nombre entre tus rutas de Strava y tocá una para asociarla.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={routeSearch}
              onChange={(e) => setRouteSearch(e.target.value)}
              placeholder="Buscar rutas…"
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {loadingRoutes ? (
            <p className="text-xs text-muted-foreground">Cargando rutas…</p>
          ) : null}
          <ul className="max-h-60 space-y-1 overflow-y-auto rounded-lg border p-1">
            {filteredRoutes.map((r) => {
              const id = stravaRouteIdFromObject(
                r as Record<string, unknown>
              );
              if (!id) return null;
              const label =
                typeof r.name === "string" && r.name.trim()
                  ? r.name.trim()
                  : `Ruta ${id}`;
              const sport =
                typeof r.sport_type === "string"
                  ? r.sport_type
                  : typeof r.type === "string"
                    ? r.type
                    : null;
              const selected = selectedId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
                      selected
                        ? "bg-primary/15 text-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium leading-snug">{label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {[
                        formatDistanceMeters(r.distance),
                        r.elevation_gain != null && r.elevation_gain > 0
                          ? formatElevation(r.elevation_gain)
                          : null,
                        sport,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filteredRoutes.length === 0 && !loadingRoutes ? (
            <p className="text-xs text-muted-foreground">
              No hay coincidencias. Creá más rutas en Strava o probá otra búsqueda.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">2. Fecha y cupos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pb-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Título
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring font-normal"
              placeholder="Vuelta matinal · café después"
              maxLength={280}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
            Inicio (hora local)
            <input
              type="datetime-local"
              value={startsAtLocal}
              onChange={(e) => setStartsAtLocal(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring font-normal"
            />
          </label>
          <fieldset className="sm:col-span-2 flex flex-wrap gap-2">
            <legend className="mb-2 w-full text-xs font-medium">
              Cómo se suman
            </legend>
            {(
              [
                ["OPEN", "Abierto — entran al tiro"],
                ["APPROVAL", "Cerrado — vos aprobás las solicitudes"],
              ] as const
            ).map(([v, lbl]) => (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  joinKind === v ? "border-primary bg-primary/5" : "border-border"
                )}
              >
                <input
                  type="radio"
                  name="joinKind"
                  checked={joinKind === v}
                  onChange={() => setJoinKind(v)}
                  className="size-3.5"
                />
                {lbl}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
            Notas (opcional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring font-normal"
              placeholder="Punto de encuentro, reglas, convivencia…"
              maxLength={5000}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            3. Requisitos (se muestran en la tarjeta)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pb-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
            Ritmo / nota de intensidad
            <input
              value={paceNote}
              onChange={(e) => setPaceNote(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring font-normal"
              placeholder="Ej. conversacional ~30 km/h en plano"
              maxLength={400}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Nivel mínimo (referencia)
            <select
              value={minSkillBand}
              onChange={(e) => setMinSkillBand(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal"
            >
              <option value="">Sin mínimo</option>
              <option value="CASUAL">Principiante / suave</option>
              <option value="INTERMEDIATE">Intermedio</option>
              <option value="ADVANCED">Avanzado</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Cupo máximo (opcional)
            <input
              inputMode="numeric"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="Sin tope"
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring font-normal"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium sm:col-span-2">
            <input
              type="checkbox"
              checked={womenOnly}
              onChange={(e) => setWomenOnly(e.target.checked)}
              className="size-4 rounded border-input"
            />
            Espacio solo mujeres (quienes se suman deben declararlo en Ajustes)
          </label>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={submitting}
        className="w-full"
        onClick={() => void submit()}
      >
        {submitting ? "Publicando…" : "Publicar evento"}
      </Button>
    </div>
  );
}
