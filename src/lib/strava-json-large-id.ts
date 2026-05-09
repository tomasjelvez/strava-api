/**
 * Strava emits 64‑bit numeric ids (`routes`, activities, …). JavaScript rounds
 * values above `Number.MAX_SAFE_INTEGER` when parsing JSON numbers, which breaks
 * `GET /routes/{id}` with a mismatched path id.
 *
 * Quote known large-id slots as JSON strings **before** `JSON.parse`.
 */
export function quoteStravaSnowflakeJsonFields(jsonText: string): string {
  return jsonText.replace(
    /"(id|activity_id)"\s*:\s*(\d{16,})\b/g,
    '"$1":"$2"'
  );
}

export function parseStravaBodyPreservingSnowflakes<T = unknown>(
  jsonText: string
): T {
  return JSON.parse(quoteStravaSnowflakeJsonFields(jsonText)) as T;
}
