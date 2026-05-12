"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NewEventWizard() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [locationName, setLocationName] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [joinKind, setJoinKind] = useState<"OPEN" | "APPROVAL">("OPEN");
  const [womenOnly, setWomenOnly] = useState(false);
  const [paceNote, setPaceNote] = useState("");
  const [minSkillBand, setMinSkillBand] = useState<string>("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
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
          title: title.trim(),
          notes: notes.trim() || undefined,
          locationName: locationName.trim() || undefined,
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
    title,
    notes,
    locationName,
    startsAtLocal,
    joinKind,
    womenOnly,
    paceNote,
    minSkillBand,
    maxParticipants,
    router,
  ]);

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
          Publicá una junta para que la comunidad se inscriba, comente y comparta fotos.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">1. Datos del evento</CardTitle>
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
            Lugar o punto de encuentro (opcional)
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring font-normal"
              placeholder="Plaza Italia, café de siempre, punto de partida..."
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
                  className="size-3.5 accent-primary"
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
            2. Requisitos (se muestran en la tarjeta)
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
