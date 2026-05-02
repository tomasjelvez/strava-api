/** OAuth token helpers only (exchange + refresh). Authenticated api/v3 requests per user: use strava-connection.ts (`stravaApiFetchForUser`). */
const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: process.env.STRAVA_REDIRECT_URI!,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all,profile:read_all",
    state,
  });

  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

export class StravaTokenRequestError extends Error {
  readonly name = "StravaTokenRequestError";

  constructor(
    readonly status: number,
    readonly responseBody: string,
    readonly grant: "authorization_code" | "refresh_token"
  ) {
    super(
      `Strava token (${grant}) request failed: ${status} ${responseBody}`
    );
  }
}

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    firstname: string;
    lastname: string;
    profile: string;
    city: string;
    state: string;
    country: string;
  };
}

function tokenForm(body: Record<string, string>): URLSearchParams {
  return new URLSearchParams(body);
}

export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenForm({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new StravaTokenRequestError(res.status, text, "authorization_code");
  }

  return JSON.parse(text) as StravaTokenResponse;
}

export interface StravaRefreshResponse {
  token_type: string;
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<StravaRefreshResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenForm({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new StravaTokenRequestError(res.status, text, "refresh_token");
  }

  return JSON.parse(text) as StravaRefreshResponse;
}
