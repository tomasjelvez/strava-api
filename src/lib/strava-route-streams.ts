/** Parse Strava `GET /routes/{id}/streams` body (array of stream objects). */

function parseLatLngData(data: unknown): [number, number][] {
  if (!Array.isArray(data)) return [];
  const out: [number, number][] = [];
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const lat = Number(row[0]);
    const lng = Number(row[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
  }
  return out;
}

function parseNumericArray(data: unknown): number[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
}

export type ParsedRouteStreams = {
  latlng: [number, number][];
  distanceM: number[];
  altitudeM: number[];
};

export function parseStravaRouteStreams(body: unknown): ParsedRouteStreams | null {
  if (!Array.isArray(body)) return null;

  let latlng: [number, number][] = [];
  let distanceM: number[] = [];
  let altitudeM: number[] = [];

  for (const entry of body) {
    if (!entry || typeof entry !== "object") continue;
    const { type, data } = entry as { type?: string; data?: unknown };
    if (type === "latlng") latlng = parseLatLngData(data);
    else if (type === "distance") distanceM = parseNumericArray(data);
    else if (type === "altitude") altitudeM = parseNumericArray(data);
  }

  return { latlng, distanceM, altitudeM };
}

/** Align three streams to the same length (Strava usually matches; be defensive). */
export function alignRouteStreamSamples(s: ParsedRouteStreams): {
  distanceM: number[];
  altitudeM: number[];
} {
  const nd = s.distanceM.length;
  const na = s.altitudeM.length;
  if (nd < 2 || na < 2) {
    return { distanceM: [], altitudeM: [] };
  }
  const n = Math.min(nd, na);
  return {
    distanceM: s.distanceM.slice(0, n),
    altitudeM: s.altitudeM.slice(0, n),
  };
}

export function elevationRangeM(altitudeM: number[]): {
  min: number;
  max: number;
} | null {
  if (altitudeM.length < 1) return null;
  let min = altitudeM[0]!;
  let max = altitudeM[0]!;
  for (const a of altitudeM) {
    if (a < min) min = a;
    if (a > max) max = a;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/** Simple positive vertical gain along the sampled polyline (approx.). */
export function approximateAscentM(altitudeM: number[]): number {
  if (altitudeM.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < altitudeM.length; i++) {
    const d = altitudeM[i]! - altitudeM[i - 1]!;
    if (d > 0) sum += d;
  }
  return sum;
}
