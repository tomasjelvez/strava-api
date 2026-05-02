"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronRight,
  ExternalLink,
  MapPinned,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  formatActivityRowStart,
  formatDistanceMeters,
  formatDurationSeconds,
} from "@/lib/format-strava-metrics";

type StravaActivitySummary = {
  id: number;
  name?: string;
  type?: string;
  distance?: number;
  moving_time?: number;
  start_date?: string;
  average_heartrate?: number;
};

function ActivityListSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 max-w-xs" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-3/5 max-w-sm" />
                <Skeleton className="h-3 w-48" />
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <Skeleton className="h-8 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ActivityList() {
  const router = useRouter();
  const [items, setItems] = useState<StravaActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/strava/activities?per_page=30");
        const contentType = res.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? await res.json().catch(() => ({}))
          : {};

        if (cancelled) return;

        if (res.ok && Array.isArray(payload)) {
          setItems(payload);
          setError(null);
          return;
        }

        if (res.status === 404) {
          setItems([]);
          router.refresh();
          return;
        }

        if (
          res.status === 401 &&
          payload.code === "strava_reconnect_required"
        ) {
          setItems([]);
          router.refresh();
          return;
        }

        if (res.status === 503 && payload.code === "database_not_writable") {
          setItems([]);
          setError(
            typeof payload.error === "string"
              ? payload.error
              : "Database is read-only — fix DATABASE_URL or hosting."
          );
          return;
        }

        setItems([]);
        setError(
          typeof payload.error === "string"
            ? payload.error
            : "Failed to load activities"
        );
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(
            e instanceof Error ? e.message : "Failed to load activities"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return <ActivityListSkeleton />;
  }

  if (error) {
    return (
      <Card className="w-full border-destructive/30">
        <CardContent className="p-6">
          <p className="text-destructive text-center text-sm leading-relaxed">
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const list = items;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg leading-tight">Recent activities</CardTitle>
        <CardDescription>
          Tap a workout to load full detail from Strava. Use{" "}
          <span className="text-foreground font-medium">Open on Strava</span>{" "}
          on the detail page for maps and segments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-muted/30 py-14 text-center ring-1 ring-foreground/5">
            <div className="bg-background flex size-14 items-center justify-center rounded-full border shadow-sm ring-1 ring-foreground/5">
              <MapPinned className="text-muted-foreground size-7" aria-hidden />
            </div>
            <div className="max-w-xs space-y-1">
              <p className="font-medium">No workouts in this feed yet</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Record something in Strava, then reload this page to see it here.
              </p>
            </div>
            <a
              href="https://www.strava.com/upload"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "strava", size: "lg" }),
                "gap-2"
              )}
            >
              Open Strava
              <ExternalLink className="size-4 opacity-90" aria-hidden />
            </a>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard/activities/${a.id}`}
                  className={cn(
                    "group block rounded-xl border bg-card p-4 transition-colors ring-1 ring-transparent",
                    "hover:border-strava/30 hover:bg-muted/40 hover:ring-strava/10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-strava focus-visible:ring-offset-2"
                  )}
                >
                  <div className="flex gap-3 sm:gap-4">
                    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-sm ring-1 ring-foreground/5">
                      <Activity className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium leading-snug underline-offset-4 group-hover:underline">
                              {a.name || "Untitled"}
                            </span>
                            <ChevronRight className="text-muted-foreground size-4 shrink-0 opacity-70 transition-opacity group-hover:opacity-100" aria-hidden />
                          </div>
                          <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
                            {formatActivityRowStart(a.start_date)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          {a.type && (
                            <Badge
                              variant="secondary"
                              className="text-xs font-normal"
                            >
                              {a.type}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-muted-foreground grid grid-cols-3 gap-3 border-t border-dashed pt-3 text-xs sm:text-sm">
                        <div>
                          <p className="text-muted-foreground/90 uppercase tracking-wide">
                            Distance
                          </p>
                          <p className="text-foreground font-medium tabular-nums">
                            {formatDistanceMeters(a.distance)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground/90 uppercase tracking-wide">
                            Moving
                          </p>
                          <p className="text-foreground font-medium tabular-nums">
                            {formatDurationSeconds(a.moving_time)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground/90 uppercase tracking-wide">
                            Avg HR
                          </p>
                          <p className="text-foreground font-medium tabular-nums">
                            {typeof a.average_heartrate === "number"
                              ? `${Math.round(a.average_heartrate)} bpm`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
