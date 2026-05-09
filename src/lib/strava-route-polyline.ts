import { decode } from "@mapbox/polyline";

function coercePolylineString(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  return s.length ? s : null;
}

/**
 * Prefer full `map.polyline`, then summary line (Strava encoded polyline algorithm).
 */
export function getRoutePolylineString(routeLike: unknown): string | null {
  if (routeLike === null || typeof routeLike !== "object" || Array.isArray(routeLike)) {
    return null;
  }
  const r = routeLike as Record<string, unknown>;
  const map = r.map;
  if (map === null || typeof map !== "object" || Array.isArray(map)) {
    return null;
  }
  const m = map as Record<string, unknown>;
  return (
    coercePolylineString(m.polyline) ??
    coercePolylineString(m.summary_polyline) ??
    null
  );
}

/** Decoded points as `[lat, lng][]` for Leaflet. */
export function decodeStravaLatLng(encoded: string): [number, number][] {
  try {
    const raw = decode(encoded) as [number, number][];
    return raw.filter(
      ([lat, lng]) =>
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
    );
  } catch {
    return [];
  }
}
