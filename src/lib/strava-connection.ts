import { prisma } from "@/lib/prisma";
import {
  refreshAccessToken,
  StravaTokenRequestError,
} from "@/lib/strava";

/** Refresh Strava OAuth access tokens this many seconds before expiry. */
export const STRAVA_REFRESH_BUFFER_SECONDS = 300;

const STRAVA_API_V3 = "https://www.strava.com/api/v3";

export class StravaConnectionNotFoundError extends Error {
  readonly name = "StravaConnectionNotFoundError";

  constructor() {
    super("No Strava connection for user");
  }
}

/**
 * Strava revoked the refresh token, credentials/env mismatch, or concurrent refresh failed with no recovery.
 * User should reconnect Strava (Settings → revoke or use in-app disconnect + connect).
 */
export class StravaReconnectRequiredError extends Error {
  readonly name = "StravaReconnectRequiredError";

  constructor(cause?: unknown) {
    super("Strava authorization invalid; reconnect Strava");
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function isInvalidStoredRefreshToken(stravaBody: string): boolean {
  try {
    const data = JSON.parse(stravaBody) as {
      errors?: { resource?: string; field?: string; code?: string }[];
    };
    return Boolean(
      data.errors?.some(
        (e) =>
          e.resource === "RefreshToken" &&
          e.field === "refresh_token" &&
          e.code === "invalid"
      )
    );
  } catch {
    return false;
  }
}

async function persistRefreshedTokens(
  userId: string,
  refreshToken: string
): Promise<string> {
  const refreshed = await refreshAccessToken(refreshToken);
  await prisma.stravaConnection.update({
    where: { userId },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: refreshed.expires_at,
    },
  });
  return refreshed.access_token;
}

/**
 * If another request just refreshed with the same stale refresh_token, ours fails;
 * reload the row and use the persisted access_token.
 */
async function recoverAccessTokenAfterFailedRefresh(
  userId: string,
  staleRefreshToken: string
): Promise<string | null> {
  const latest = await prisma.stravaConnection.findUnique({
    where: { userId },
  });
  if (!latest || latest.refreshToken === staleRefreshToken) {
    return null;
  }
  return latest.accessToken;
}

/** Always refresh via Strava and persist; concurrency-safe narrow recovery path. */
export async function refreshStravaTokensForUser(
  userId: string,
  connection: { refreshToken: string }
): Promise<string> {
  try {
    return await persistRefreshedTokens(userId, connection.refreshToken);
  } catch (err) {
    const recovered = await recoverAccessTokenAfterFailedRefresh(
      userId,
      connection.refreshToken
    );
    if (recovered !== null) {
      return recovered;
    }

    if (
      err instanceof StravaTokenRequestError &&
      err.status === 400 &&
      err.grant === "refresh_token" &&
      isInvalidStoredRefreshToken(err.responseBody)
    ) {
      await prisma.stravaConnection.deleteMany({
        where: { userId, refreshToken: connection.refreshToken },
      });
      throw new StravaConnectionNotFoundError();
    }

    throw new StravaReconnectRequiredError(err);
  }
}

function needsRefreshByExpiry(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return expiresAt - now < STRAVA_REFRESH_BUFFER_SECONDS;
}

/**
 * Load connection and return a usable access token; refreshes when within `STRAVA_REFRESH_BUFFER_SECONDS` of expiry.
 * For HTTP calls prefer `stravaApiFetchForUser` (handles 401 + forced refresh).
 */
export async function getStravaAccessTokenForUser(
  userId: string
): Promise<string | null> {
  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });
  if (!connection) {
    return null;
  }

  if (!needsRefreshByExpiry(connection.expiresAt)) {
    return connection.accessToken;
  }

  return refreshStravaTokensForUser(userId, connection);
}

function mergeAuthHeader(accessToken: string, init?: RequestInit): Headers {
  const h = new Headers(init?.headers ?? undefined);
  h.set("Authorization", `Bearer ${accessToken}`);
  return h;
}

async function fetchWithBearer(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: mergeAuthHeader(accessToken, init),
  });
}

function resolveStravaApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${STRAVA_API_V3}${normalized}`;
}

/**
 * Authenticated `fetch` to `https://www.strava.com/api/v3` with time-based refresh and one forced refresh + retry on HTTP 401.
 *
 * Dashboard, webhook, coach, etc.: use this instead of reading `accessToken` from Prisma and calling `fetch` manually.
 */
export async function stravaApiFetchForUser(
  userId: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = resolveStravaApiUrl(path);

  const tokenFirst = await getStravaAccessTokenForUser(userId);
  if (tokenFirst === null) {
    throw new StravaConnectionNotFoundError();
  }

  let res = await fetchWithBearer(url, tokenFirst, init);

  if (res.status !== 401) {
    return res;
  }

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId },
  });
  if (!connection) {
    throw new StravaConnectionNotFoundError();
  }

  const newAccessToken = await refreshStravaTokensForUser(userId, connection);
  res = await fetchWithBearer(url, newAccessToken, init);

  if (res.status === 401) {
    console.error(
      "Strava API still returned 401 after forced token refresh:",
      url
    );
    throw new StravaReconnectRequiredError(
      new Error("Strava access token invalid after refresh")
    );
  }

  return res;
}

export function stravaApiGetForUser(
  userId: string,
  path: string
): Promise<Response> {
  return stravaApiFetchForUser(userId, path, { method: "GET" });
}
