import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Mountain,
  Ruler,
  Timer,
} from "lucide-react";

import {
  SqliteDatabaseNotWritableError,
  StravaConnectionNotFoundError,
  StravaReconnectRequiredError,
} from "@/lib/strava-connection";
import { fetchStravaActivityDetail } from "@/lib/strava-fetch-activity";
import {
  coerceStravaNumber,
  enrichStravaRecordWithHeartRate,
} from "@/lib/strava-heart-rate";
import {
  formatDistanceMeters,
  formatDurationSeconds,
  formatElevation,
  formatStartDateTime,
} from "@/lib/format-strava-metrics";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StravaActivityDetail = {
  id: number;
  name?: string;
  description?: string | null;
  type?: string;
  sport_type?: string;
  start_date?: string;
  timezone?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number | null;
  elev_high?: number | null;
  elev_low?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  calories?: number | null;
  device_name?: string | null;
  suffer_score?: number | null;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
};

function numericField(v: unknown): number | undefined {
  return coerceStravaNumber(v);
}

export default async function ActivityDetailPage(props: {
  params: Promise<{ activityId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { activityId } = await props.params;
  const activityNum = Number(activityId);
  if (!Number.isFinite(activityNum) || activityNum <= 0) {
    notFound();
  }

  let res: Response;
  try {
    res = await fetchStravaActivityDetail(userId, activityNum);
  } catch (err) {
    if (err instanceof StravaConnectionNotFoundError) {
      redirect("/dashboard");
    }
    if (err instanceof StravaReconnectRequiredError) {
      redirect("/dashboard?strava=reconnect");
    }
    if (err instanceof SqliteDatabaseNotWritableError) {
      redirect("/dashboard?strava=error&reason=database");
    }
    redirect("/dashboard?strava=error");
  }

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    return (
      <main className="bg-muted/40 min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl xl:max-w-4xl">
          <DashboardActivityHeader />
          <Card className="border-destructive/30 mt-10">
            <CardHeader>
              <CardTitle>Could not load activity</CardTitle>
              <CardDescription>
                Strava returned an error (HTTP {res.status}). Try again from your
                dashboard or open this workout on Strava.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
                Back to dashboard
              </Link>
              <a
                href={`https://www.strava.com/activities/${activityNum}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "strava", className: "gap-2" })
                )}
              >
                Open on Strava
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const rawBare = await res.json();
  const payload =
    rawBare !== null && typeof rawBare === "object" && !Array.isArray(rawBare)
      ? (rawBare as Record<string, unknown>)
      : {};

  const raw = await enrichStravaRecordWithHeartRate(
    userId,
    activityNum,
    payload
  );

  const a: StravaActivityDetail = {
    id: numericField(raw.id) ?? activityNum,
    name: typeof raw.name === "string" ? raw.name : undefined,
    description:
      typeof raw.description === "string" || raw.description === null
        ? (raw.description as string | null)
        : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
    sport_type: typeof raw.sport_type === "string" ? raw.sport_type : undefined,
    start_date: typeof raw.start_date === "string" ? raw.start_date : undefined,
    timezone: typeof raw.timezone === "string" ? raw.timezone : undefined,
    distance: numericField(raw.distance),
    moving_time: numericField(raw.moving_time),
    elapsed_time: numericField(raw.elapsed_time),
    total_elevation_gain:
      raw.total_elevation_gain == null
        ? undefined
        : numericField(raw.total_elevation_gain) ?? undefined,
    elev_high:
      raw.elev_high == null ? undefined : numericField(raw.elev_high) ?? undefined,
    elev_low:
      raw.elev_low == null ? undefined : numericField(raw.elev_low) ?? undefined,
    average_heartrate: numericField(raw.average_heartrate),
    max_heartrate: numericField(raw.max_heartrate),
    calories:
      raw.calories == null ? undefined : numericField(raw.calories) ?? undefined,
    device_name:
      typeof raw.device_name === "string" ? raw.device_name : undefined,
    suffer_score:
      raw.suffer_score == null ? undefined : numericField(raw.suffer_score),
    location_city:
      typeof raw.location_city === "string" ? raw.location_city : undefined,
    location_state:
      typeof raw.location_state === "string" ? raw.location_state : undefined,
    location_country:
      typeof raw.location_country === "string"
        ? raw.location_country
        : undefined,
  };

  const place = [
    a.location_city,
    a.location_state,
    a.location_country,
  ].filter(Boolean);

  return (
    <main className="bg-muted/40 min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl xl:max-w-4xl space-y-8">
        <DashboardActivityHeader />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {(a.type || a.sport_type) && (
                <Badge variant="secondary">
                  {(a.type || a.sport_type)!.replace(/_/g, " ")}
                </Badge>
              )}
              {a.timezone && (
                <Badge variant="outline" className="font-normal">
                  {a.timezone.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <h1 className="font-heading text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              {a.name || `Activity ${a.id}`}
            </h1>
            <p className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              {formatStartDateTime(a.start_date)}
            </p>
            {place.length > 0 && (
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {place.join(", ")}
              </p>
            )}
          </div>
          <a
            href={`https://www.strava.com/activities/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "strava", size: "lg" }),
              "shrink-0 gap-2"
            )}
          >
            Open on Strava
            <ExternalLink className="size-4 opacity-95" aria-hidden />
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            icon={Ruler}
            label="Distance"
            value={formatDistanceMeters(a.distance)}
          />
          <MetricCard
            icon={Timer}
            label="Moving time"
            value={formatDurationSeconds(a.moving_time)}
          />
          <MetricCard
            icon={Timer}
            label="Elapsed time"
            value={formatDurationSeconds(a.elapsed_time)}
          />
          <MetricCard
            icon={Mountain}
            label="Elevation gain"
            value={formatElevation(a.total_elevation_gain ?? undefined)}
          />
          <MetricCard
            icon={Heart}
            label="Avg / max HR"
            value={
              typeof a.average_heartrate === "number" ||
              typeof a.max_heartrate === "number"
                ? [
                    typeof a.average_heartrate === "number"
                      ? `${Math.round(a.average_heartrate)} bpm`
                      : "—",
                    typeof a.max_heartrate === "number"
                      ? `${Math.round(a.max_heartrate)} bpm max`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "—"
            }
          />
          <MetricCard
            icon={MapPin}
            label="Elevation min / max"
            value={
              a.elev_low != null || a.elev_high != null
                ? `${formatElevation(a.elev_low ?? undefined)} / ${formatElevation(a.elev_high ?? undefined)}`
                : "—"
            }
          />
        </div>

        {(a.calories != null ||
          typeof a.device_name === "string" ||
          a.suffer_score != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">More</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-3">
              {a.calories != null ? (
                <p>
                  <span className="text-foreground font-medium">
                    Calories:{" "}
                  </span>
                  {Math.round(a.calories)}
                </p>
              ) : null}
              {a.device_name ? (
                <p>
                  <span className="text-foreground font-medium">Device: </span>
                  {a.device_name}
                </p>
              ) : null}
              {a.suffer_score != null ? (
                <p>
                  <span className="text-foreground font-medium">
                    Relative effort:{" "}
                  </span>
                  {a.suffer_score}
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        {typeof a.description === "string" && a.description.trim().length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
                {a.description}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}

function DashboardActivityHeader() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href="/dashboard"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm", className: "-ml-3" }),
            "text-muted-foreground w-fit gap-1.5"
          )}
        >
          <ArrowLeft className="size-4 shrink-0" aria-hidden />
          Dashboard
        </Link>
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          Activity detail
        </p>
      </div>
      <UserButton />
    </header>
  );
}

function MetricCard(props: { icon: LucideIcon; label: string; value: string }) {
  const Icon = props.icon;
  return (
    <Card className="overflow-hidden shadow-none ring-1 ring-foreground/5 transition-colors hover:bg-muted/20">
      <CardContent className="flex gap-3 p-4">
        <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            {props.label}
          </p>
          <p className="text-foreground font-semibold tabular-nums leading-tight tracking-tight">
            {props.value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
