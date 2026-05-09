import { Activity } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDistanceMeters,
  formatDurationSeconds,
} from "@/lib/format-strava-metrics";
import type { TrainingActivity } from "@/lib/training-activity";

type Props = {
  activity: TrainingActivity | null;
  loading: boolean;
};

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/40 px-3 py-2 ring-1 ring-foreground/5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function TodayTrainingCard({ activity, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          <Skeleton className="h-5 w-3/4" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Entreno de hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <p className="text-sm text-muted-foreground">
            Aún no registraste nada hoy en Strava. Un paseo corto también cuenta.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Entreno de hoy
          </CardTitle>
          {activity.source === "mock" && (
            <Badge variant="outline" className="text-[10px] uppercase">
              Ejemplo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted ring-1 ring-foreground/5">
            <Activity className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-medium leading-snug text-foreground">
              {activity.name}
            </p>
            {activity.type && (
              <p className="text-xs text-muted-foreground">{activity.type}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="Distancia" value={formatDistanceMeters(activity.distance)} />
          <Stat
            label="Duración"
            value={formatDurationSeconds(activity.moving_time)}
          />
          <Stat
            label="FC prom."
            value={
              typeof activity.average_heartrate === "number"
                ? `${Math.round(activity.average_heartrate)} lpm`
                : "—"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
