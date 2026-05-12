/** Human-readable sport / modality for Strava route objects (API `type` is often numeric). */
export function stravaRouteSportTypeLabel(route: {
  sport_type?: string | null;
  type?: string | number | null;
}): string | null {
  if (typeof route.sport_type === "string" && route.sport_type.trim()) {
    return route.sport_type.replace(/_/g, " ");
  }
  if (typeof route.type === "string" && route.type.trim()) {
    return route.type.replace(/_/g, " ");
  }
  if (typeof route.type === "number" && Number.isFinite(route.type)) {
    if (route.type === 1) return "Ciclismo";
    if (route.type === 2) return "Caminata / carrera";
    return null;
  }
  return null;
}
