"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDistanceMeters,
  formatElevation,
  formatStartDateTime,
} from "@/lib/format-strava-metrics";
import type { AthletePerformanceSummary } from "@/lib/athlete-rollups";

type Participant = {
  id: string;
  userId: string;
  displayName: string;
  joinedAt: string;
};

type PendingReview = {
  signupId: string;
  userId: string;
  displayName: string;
  createdAt: string;
  performance: AthletePerformanceSummary;
  appProfile: { declaresAsWoman: boolean; declaredSkillBand: string | null };
};

type EventDetailPayload = {
  id: string;
  hostUserId: string;
  hostDisplayName: string;
  title: string;
  notes?: string | null;
  startsAt: string;
  joinKind: "OPEN" | "APPROVAL";
  sportTypeSnapshot?: string | null;
  routeNameSnapshot?: string | null;
  stravaRouteId: string;
  distanceMetersSnapshot?: number | null;
  elevationGainSnapshot?: number | null;
  minSkillBand?: string | null;
  paceNote?: string | null;
  womenOnly: boolean;
  requisitesJson?: unknown;
  maxParticipants?: number | null;
  joinedCount: number;
  participants?: Participant[];
  mine: { status: string; id: string } | null;
  canSignup: boolean;
  pendingReviews?: PendingReview[];
};

function summarizePerf(p: AthletePerformanceSummary): string[] {
  return [
    `${p.activityCount} actividades / ${p.windowDays} días`,
    p.totalDistanceM >= 1000
      ? `${(p.totalDistanceM / 1000).toFixed(0)} km en el período`
      : `${Math.round(p.totalDistanceM)} m en el período`,
    p.avgWeeklyLoadScore != null
      ? `~${p.avgWeeklyLoadScore.toFixed(1)} carga semanal (unidades internas)`
      : null,
  ].filter(Boolean) as string[];
}

function skillBandEs(code: string): string {
  const m: Record<string, string> = {
    casual: "Principiante / suave",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  };
  return m[code.toLowerCase()] ?? code;
}

export function EventDetailView({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [data, setData] = useState<EventDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
        cache: "no-store",
      });
      const payload = res.headers.get("content-type")?.includes("application/json")
        ? await res.json().catch(() => ({}))
        : {};

      if (!res.ok || !payload.event) {
        setError(
          typeof payload.error === "string" ? payload.error : "No encontrado."
        );
        setData(null);
        return;
      }
      setData(payload.event as EventDetailPayload);
    } catch {
      setError("No se pudo cargar.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const signup = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(data.id)}/signup`, {
        method: "POST",
      });
      const payload =
        res.headers.get("content-type")?.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};
      if (!res.ok) {
        alert(
          typeof payload.error === "string"
            ? payload.error
            : "No se pudo actualizar la inscripción."
        );
        return;
      }
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const cancelRsvp = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(data.id)}/signup`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("No se pudo cancelar la inscripción.");
        return;
      }
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const decide = async (signupId: string, decision: "accept" | "reject") => {
    if (!data) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(data.id)}/signup/${encodeURIComponent(signupId)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      const payload =
        res.headers.get("content-type")?.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};
      if (!res.ok) {
        alert(
          typeof payload.error === "string"
            ? payload.error
            : "No se pudo actualizar la solicitud."
        );
        return;
      }
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/events"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Volver
        </Link>
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error ?? "No encontrado."}
        </p>
      </div>
    );
  }

  const stravaHref = `https://www.strava.com/routes/${encodeURIComponent(data.stravaRouteId)}`;
  const past = new Date(data.startsAt) < new Date();

  return (
    <div className="space-y-5">
      <Link
        href="/events"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Eventos
      </Link>

      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {data.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden />
            {formatStartDateTime(data.startsAt)}
          </span>
          {past ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
              Ya comenzó
            </span>
          ) : null}
          {data.sportTypeSnapshot ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
              {data.sportTypeSnapshot.toLowerCase().replace("_", " ")}
            </span>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Detalles</CardTitle>
          <CardDescription>
            Organiza{" "}
            <Link
              href={`/profile/${encodeURIComponent(data.hostUserId)}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {data.hostDisplayName}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pb-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
            <Users className="size-3.5" aria-hidden />
            {data.joinedCount}
            {typeof data.maxParticipants === "number"
              ? ` / ${data.maxParticipants}`
              : ""}{" "}
            {data.joinedCount === 1 ? "inscrito" : "inscritos"}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
            {data.joinKind === "OPEN" ? "Cupos abiertos" : "Anfitrión aprueba"}
          </span>
          {data.womenOnly ? (
            <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300">
              Solo mujeres
            </span>
          ) : null}
          {data.minSkillBand ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium capitalize">
              Nivel mín.: {skillBandEs(data.minSkillBand)}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {data.notes?.trim() ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Notas del anfitrión
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {data.notes.trim()}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Ruta (resumen)</CardTitle>
          <CardDescription>
            Tomado de Strava cuando se creó el evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          {data.routeNameSnapshot ? (
            <p className="text-sm flex items-start gap-2">
              <MapPinned className="size-4 mt-0.5 shrink-0" aria-hidden />
              <span>{data.routeNameSnapshot}</span>
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {[
              data.distanceMetersSnapshot != null
                ? formatDistanceMeters(data.distanceMetersSnapshot)
                : null,
              data.elevationGainSnapshot != null &&
              data.elevationGainSnapshot > 0
                ? formatElevation(data.elevationGainSnapshot)
                : null,
              data.paceNote,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/routes/${encodeURIComponent(data.stravaRouteId)}`}
              className={buttonVariants({ variant: "secondary", className: "justify-center" })}
            >
              Ver ruta en la app
            </Link>
            <a
              href={stravaHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", className: "justify-center gap-2" })}
            >
              <ExternalLink className="size-4" aria-hidden />
              Ver en Strava
            </a>
          </div>
        </CardContent>
      </Card>

      {data.participants && data.participants.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Quién va</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <ul className="space-y-1 text-sm">
              {data.participants.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/profile/${encodeURIComponent(p.userId)}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {p.displayName}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · se sumó {formatStartDateTime(p.joinedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!past && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Tu inscripción
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            {data.canSignup ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void signup()}
                className="sm:flex-1"
              >
                {data.joinKind === "OPEN" ? "Unirme" : "Pedir cupo"}
              </Button>
            ) : (
              <>
                {!data.mine ? (
                  <p className="text-sm text-muted-foreground">
                    No podés anotarte en esta salida (cupo o estado de la solicitud).
                  </p>
                ) : null}
                {data.mine?.status === "JOINED" || data.mine?.status === "PENDING" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void cancelRsvp()}
                  >
                    {data.mine?.status === "PENDING"
                      ? "Retirar solicitud"
                      : "Salir del evento"}
                  </Button>
                ) : null}
                {data.mine?.status === "REJECTED" ? (
                  <p className="text-xs text-muted-foreground">
                    El anfitrión rechazó la solicitud. Podés volver a pedir cupo si el evento sigue abierto.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {data.pendingReviews && data.pendingReviews.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Solicitudes pendientes
            </CardTitle>
            <CardDescription>
              Estadísticas de entrenos sincronizados desde Strava (~90&nbsp;días).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-5">
            {data.pendingReviews.map((req) => (
              <div
                key={req.signupId}
                className="rounded-xl border bg-muted/40 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/profile/${encodeURIComponent(req.userId)}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {req.displayName}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      Solicitud {formatStartDateTime(req.createdAt)}
                      {typeof req.appProfile.declaredSkillBand === "string"
                        ? ` · dice ${skillBandEs(req.appProfile.declaredSkillBand)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="xs"
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(req.signupId, "reject")}
                      variant="outline"
                    >
                      Rechazar
                    </Button>
                    <Button
                      size="xs"
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(req.signupId, "accept")}
                    >
                      Aceptar
                    </Button>
                  </div>
                </div>
                <ul className="text-xs text-muted-foreground list-disc space-y-0.5 pl-5">
                  {summarizePerf(req.performance).map((line, idx) => (
                    <li key={`${idx}-${line}`}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
