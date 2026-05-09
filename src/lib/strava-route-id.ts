/**
 * Strava route ids are positive integers in the API path (`/routes/{id}`).
 * Keep them as decimal digit strings through our stack to avoid floating-point coercion.
 */

export function parseStravaRouteIdParam(segment: unknown): string | null {
  if (typeof segment !== "string") return null;
  const s = segment.trim();
  if (!/^\d+$/.test(s) || s === "0") return null;
  return s;
}

/** Accept id as Strava sends it from JSON (`number`, or occasional string). */
export function stravaRouteIdFromObject(route: Record<string, unknown>): string | null {
  const raw = route.id ?? route.id_str;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    const t = Math.trunc(raw);
    return t <= 0 ? null : String(t);
  }
  if (typeof raw === "string") return parseStravaRouteIdParam(raw);
  return null;
}
