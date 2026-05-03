import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool, type PoolConfig } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  /** Last DATABASE_URL used for the singleton pool + client (dev env reloads can change this). */
  prismaDbUrl?: string;
};

/** Query keys that steer `pg` TLS via the URL; strip when using `ssl: { rejectUnauthorized: false }` on the Pool. */
const PG_TLS_QUERY_KEYS = [
  "sslmode",
  "ssl",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslcrl",
  "uselibpqcompat",
] as const;

function assertPostgresUrl(url: string): void {
  if (url.startsWith("file:") || url.toLowerCase().startsWith("sqlite:")) {
    throw new Error(
      "DATABASE_URL is SQLite-style, but this app uses PostgreSQL + pg. " +
        "Set DATABASE_URL in .env.local (see .env.example), e.g. postgresql://strava:strava@localhost:5433/strava"
    );
  }
}

/**
 * Detect Supabase without requiring `new URL()` to succeed (passwords with raw `@`, `:`, etc. break WHATWG URL).
 */
function isSupabaseConnectionString(connectionString: string): boolean {
  if (/\b[a-z0-9-]{1,128}\.pooler\.supabase\.co\b/i.test(connectionString)) {
    return true;
  }
  if (/\bdb\.[a-z0-9-]{1,128}\.supabase\.co\b/i.test(connectionString)) {
    return true;
  }
  try {
    return new URL(connectionString).hostname.endsWith("supabase.co");
  } catch {
    return false;
  }
}

/**
 * Remove TLS-related query params so Pool `ssl` options control TLS (avoids `sslmode=require` mapping to verify-full in pg v8+).
 */
function stripTlsQueryParamsFromConnectionString(cs: string): string {
  try {
    const u = new URL(cs);
    const q = new URLSearchParams(u.search);
    for (const k of PG_TLS_QUERY_KEYS) {
      q.delete(k);
    }
    const s = q.toString();
    u.search = s ? `?${s}` : "";
    return u.toString();
  } catch {
    let out = cs;
    for (const k of PG_TLS_QUERY_KEYS) {
      out = out.replace(new RegExp(`[?&]${k}=[^&#]*`, "gi"), "");
    }
    out = out.replace(/\?&+/g, "?").replace(/&&+/g, "&");
    if (out.endsWith("?") || out.endsWith("&")) {
      out = out.replace(/[?&]$/, "");
    }
    return out;
  }
}

/**
 * Supabase + `pg` v8+: optional `uselibpqcompat` in the URL when not using relaxed Pool TLS (see pg-connection-string warning).
 */
function withSupabasePgSslCompat(connectionString: string): string {
  if (!isSupabaseConnectionString(connectionString)) {
    return connectionString;
  }
  try {
    const parsed = new URL(connectionString);
    const q = new URLSearchParams(parsed.search);
    if (!q.has("uselibpqcompat")) {
      q.set("uselibpqcompat", "true");
    }
    if (!q.has("sslmode")) {
      q.set("sslmode", "require");
    }
    parsed.search = q.toString();
    return parsed.toString();
  } catch {
    const joiner = connectionString.includes("?") ? "&" : "?";
    if (/[?&]uselibpqcompat=/i.test(connectionString)) {
      return connectionString;
    }
    return `${connectionString}${joiner}uselibpqcompat=true`;
  }
}

function poolOptionsForUrl(connectionString: string): PoolConfig {
  const isSupabase = isSupabaseConnectionString(connectionString);
  /** P1011 on Vercel: relaxed cert verify for Supabase unless DATABASE_SSL_VERIFY=1. */
  const relaxedTls =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "0" ||
    (isSupabase && process.env.DATABASE_SSL_VERIFY !== "1");

  if (relaxedTls) {
    const withoutTlsQuery = stripTlsQueryParamsFromConnectionString(
      connectionString
    );
    return {
      connectionString: withoutTlsQuery,
      ssl: { rejectUnauthorized: false },
    };
  }

  return { connectionString: withSupabasePgSslCompat(connectionString) };
}

function getOrCreatePrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (see .env.example), or use `npm run prod` with a populated prod.env."
    );
  }
  assertPostgresUrl(connectionString);

  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaDbUrl === connectionString &&
    globalForPrisma.pgPool
  ) {
    return globalForPrisma.prisma;
  }

  if (globalForPrisma.pgPool) {
    void globalForPrisma.pgPool.end().catch(() => {});
  }

  const pool = new Pool(poolOptionsForUrl(connectionString));
  globalForPrisma.pgPool = pool;
  globalForPrisma.prismaDbUrl = connectionString;
  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  globalForPrisma.prisma = client;
  return client;
}

/**
 * Lazy singleton: reads `DATABASE_URL` when first used (and after Next.js env reload if the URL changed).
 * Avoids stale pools when `.env.local` changes without a full process restart.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getOrCreatePrisma();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
}) as PrismaClient;
