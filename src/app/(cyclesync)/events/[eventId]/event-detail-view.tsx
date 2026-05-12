"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CalendarClock,
  ExternalLink,
  MapPin,
  MapPinned,
  MessageCircle,
  Send,
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

type EventComment = {
  id: string;
  authorUserId: string;
  authorDisplayName: string;
  body: string;
  createdAt: string;
  images?: EventImage[];
};

type EventImage = {
  id: string;
  uploaderUserId: string;
  uploaderDisplayName?: string;
  url: string;
  altText?: string | null;
  createdAt: string;
};

type EventDetailPayload = {
  id: string;
  hostUserId: string;
  hostDisplayName: string;
  title: string;
  notes?: string | null;
  locationName?: string | null;
  startsAt: string;
  joinKind: "OPEN" | "APPROVAL";
  sportTypeSnapshot?: string | null;
  routeNameSnapshot?: string | null;
  stravaRouteId?: string | null;
  distanceMetersSnapshot?: number | null;
  elevationGainSnapshot?: number | null;
  minSkillBand?: string | null;
  paceNote?: string | null;
  womenOnly: boolean;
  requisitesJson?: unknown;
  maxParticipants?: number | null;
  joinedCount: number;
  participants?: Participant[];
  comments?: EventComment[];
  images?: EventImage[];
  canViewDetails: boolean;
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
  const [commentText, setCommentText] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commenting, setCommenting] = useState(false);

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

  const postComment = async () => {
    if (!data || (commentText.trim().length === 0 && !commentImage)) return;
    setCommenting(true);
    try {
      const form = new FormData();
      form.set("body", commentText);
      if (commentImage) form.set("file", commentImage);
      const res = await fetch(
        `/api/events/${encodeURIComponent(data.id)}/comments`,
        {
          method: "POST",
          body: form,
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
            : "No se pudo publicar el comentario."
        );
        return;
      }
      setCommentText("");
      setCommentImage(null);
      await load();
      router.refresh();
    } finally {
      setCommenting(false);
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

  const stravaHref = data.stravaRouteId
    ? `https://www.strava.com/routes/${encodeURIComponent(data.stravaRouteId)}`
    : null;
  const past = new Date(data.startsAt) < new Date();
  const signupPanel = !past ? (
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
  ) : null;

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
          {data.locationName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
              <MapPin className="size-3.5" aria-hidden />
              {data.locationName}
            </span>
          ) : null}
          {data.womenOnly ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
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

      {!data.canViewDetails ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Únete para ver la actividad
              </CardTitle>
              <CardDescription>
                Las fotos, comentarios, participantes y detalles completos solo
                están disponibles para el anfitrión y asistentes confirmados.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              {data.mine?.status === "PENDING" ? (
                <p className="text-sm text-muted-foreground">
                  Tu solicitud está pendiente. Cuando el anfitrión la acepte,
                  podrás ver y publicar en el evento.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Inscríbete para participar en la conversación y compartir fotos.
                </p>
              )}
            </CardContent>
          </Card>
          {signupPanel}
        </>
      ) : (
        <>
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

      {data.stravaRouteId ? (
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
            {stravaHref ? (
              <a
                href={stravaHref}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", className: "justify-center gap-2" })}
              >
                <ExternalLink className="size-4" aria-hidden />
                Ver en Strava
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Fotos</CardTitle>
          <CardDescription>
            Fotos compartidas desde los comentarios del evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          {data.images && data.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {data.images.map((image) => (
                <a
                  key={image.id}
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.altText ?? "Foto del evento"}
                    className="aspect-square h-full w-full object-cover"
                  />
                  {image.uploaderDisplayName ? (
                    <span className="block truncate px-2 py-1 text-[11px] text-muted-foreground">
                      Subida por {image.uploaderDisplayName}
                    </span>
                  ) : null}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay fotos. Adjunta una al publicar un comentario.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="size-4" aria-hidden />
            Comentarios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-5">
          {data.comments && data.comments.length > 0 ? (
            <ul className="space-y-3">
              {data.comments.map((comment) => (
                <li key={comment.id} className="rounded-xl bg-muted/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <Link
                      href={`/profile/${encodeURIComponent(comment.authorUserId)}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {comment.authorDisplayName}
                    </Link>
                    <span>{formatStartDateTime(comment.createdAt)}</span>
                  </div>
                  {comment.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                      {comment.body}
                    </p>
                  ) : null}
                  {comment.images && comment.images.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {comment.images.map((image) => (
                        <a
                          key={image.id}
                          href={image.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-xl border bg-background"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image.url}
                            alt={image.altText ?? "Foto del comentario"}
                            className="max-h-80 w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay comentarios.
            </p>
          )}

          <div className="space-y-2 rounded-xl border bg-background p-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Cuenta cómo estuvo, coordina detalles o deja un mensaje..."
              className="min-h-16 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className={buttonVariants({ size: "sm", variant: "outline", className: "cursor-pointer gap-2" })}>
                <Camera className="size-4" aria-hidden />
                {commentImage ? "Cambiar foto" : "Adjuntar foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={commenting}
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0] ?? null;
                    e.currentTarget.value = "";
                    setCommentImage(file);
                  }}
                />
              </label>
              {commentImage ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  disabled={commenting}
                  onClick={() => setCommentImage(null)}
                >
                  Quitar {commentImage.name}
                </button>
              ) : null}
              <Button
                type="button"
                disabled={
                  commenting ||
                  (commentText.trim().length === 0 && !commentImage)
                }
                onClick={() => void postComment()}
                className="ml-auto gap-2"
              >
                <Send className="size-4" aria-hidden />
                {commenting ? "Publicando..." : "Publicar"}
              </Button>
            </div>
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

      {signupPanel}

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
        </>
      )}
    </div>
  );
}
