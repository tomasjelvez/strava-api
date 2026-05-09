"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Link2, MapPinned, CalendarDays } from "lucide-react";
import {
  getMockTodayActivity,
  type TrainingActivity,
} from "@/lib/training-activity";
import { APP_LOCALE } from "@/lib/format-strava-metrics";
import { TodayTrainingCard } from "@/components/cyclesync/today-training-card";

type Props = {
  isStravaConnected: boolean;
  firstName: string | null;
};

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Que descanses";
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

function formattedDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

type StravaActivitySummary = {
  id: number;
  name?: string;
  type?: string;
  distance?: number;
  moving_time?: number;
  start_date?: string;
  average_heartrate?: number;
};

function isToday(iso: string | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function pickRelevant(
  activities: StravaActivitySummary[]
): StravaActivitySummary | null {
  if (activities.length === 0) return null;
  return activities.find((a) => isToday(a.start_date)) ?? activities[0];
}

export function TodayView({ isStravaConnected, firstName }: Props) {
  const [activity, setActivity] = useState<TrainingActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activitySource, setActivitySource] = useState<"strava" | "mock">(
    "mock"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isStravaConnected) {
        if (!cancelled) {
          setActivity(getMockTodayActivity());
          setActivitySource("mock");
          setActivityLoading(false);
        }
        return;
      }
      try {
        const res = await fetch("/api/strava/activities?per_page=10");
        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? await res.json().catch(() => null)
          : null;

        if (cancelled) return;

        if (res.ok && Array.isArray(payload)) {
          const picked = pickRelevant(payload as StravaActivitySummary[]);
          if (picked) {
            setActivity({
              id: picked.id,
              name: picked.name ?? "Actividad sin título",
              type: picked.type,
              distance: picked.distance,
              moving_time: picked.moving_time,
              start_date: picked.start_date,
              average_heartrate: picked.average_heartrate,
              source: "strava",
            });
            setActivitySource("strava");
          } else {
            setActivity(getMockTodayActivity());
            setActivitySource("mock");
          }
        } else {
          setActivity(getMockTodayActivity());
          setActivitySource("mock");
        }
      } catch {
        if (!cancelled) {
          setActivity(getMockTodayActivity());
          setActivitySource("mock");
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStravaConnected]);

  const today = new Date();
  const greeting = greetingFor(today);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {formattedDate(today)}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {greeting}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Tus entrenos recientes y las salidas en grupo, en un solo lugar.
        </p>
      </header>

      <TodayTrainingCard activity={activity} loading={activityLoading} />

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/routes"
          className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-left ring-1 ring-foreground/5 transition-colors hover:bg-muted/50"
        >
          <MapPinned className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">Rutas</span>
          <span className="text-[11px] text-muted-foreground">
            Rutas guardadas en Strava
          </span>
        </Link>
        <Link
          href="/events"
          className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-left ring-1 ring-foreground/5 transition-colors hover:bg-muted/50"
        >
          <CalendarDays className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">Eventos</span>
          <span className="text-[11px] text-muted-foreground">
            Únete u organiza salidas
          </span>
        </Link>
      </div>

      {!isStravaConnected && activitySource === "mock" && (
        <div className="rounded-2xl border border-dashed bg-background/60 px-4 py-3 text-xs text-muted-foreground">
          <p className="leading-relaxed">
            Mostramos un ejemplo de entreno.{" "}
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
            >
              Conecta Strava <Link2 className="size-3" aria-hidden />
            </Link>{" "}
            para ver tus datos reales.
          </p>
        </div>
      )}
    </div>
  );
}
