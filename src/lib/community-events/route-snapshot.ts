import type { SkillBand } from "@/generated/prisma/client";
import { stravaRouteIdFromObject } from "@/lib/strava-route-id";

export type RouteSnapshots = {
  stravaRouteId: string | null;
  routeNameSnapshot: string | null;
  distanceMetersSnapshot: number | null;
  elevationGainSnapshot: number | null;
  sportTypeSnapshot: string | null;
};

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function sportFromRoute(route: Record<string, unknown>): string | null {
  const st = route.sport_type;
  if (typeof st === "string" && st.trim()) return st.trim();
  const t = route.type;
  if (typeof t === "string" && t.trim()) return t.trim();
  return null;
}

export function snapshotsFromStravaRouteJson(
  route: Record<string, unknown>
): RouteSnapshots {
  const idStr = stravaRouteIdFromObject(route);
  const nameRaw = route.name;
  const name =
    typeof nameRaw === "string" && nameRaw.trim()
      ? nameRaw.trim().slice(0, 280)
      : null;

  return {
    stravaRouteId: idStr,
    routeNameSnapshot: name,
    distanceMetersSnapshot: numOrNull(route.distance),
    elevationGainSnapshot: numOrNull(route.elevation_gain),
    sportTypeSnapshot: sportFromRoute(route),
  };
}

const SKILL_BANDS = new Set<SkillBand>([
  "CASUAL",
  "INTERMEDIATE",
  "ADVANCED",
]);

export function parseSkillBand(v: unknown): SkillBand | null {
  if (typeof v !== "string" || !SKILL_BANDS.has(v as SkillBand)) return null;
  return v as SkillBand;
}
