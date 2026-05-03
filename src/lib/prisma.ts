import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool, type PoolConfig } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  /** Last DATABASE_URL used for the singleton pool + client (dev env reloads can change this). */
  prismaDbUrl?: string;
};

function assertPostgresUrl(url: string): void {
  if (url.startsWith("file:") || url.toLowerCase().startsWith("sqlite:")) {
    throw new Error(
      "DATABASE_URL is SQLite-style, but this app uses PostgreSQL + pg. " +
        "Set DATABASE_URL in .env.local (see .env.example), e.g. postgresql://strava:strava@localhost:5433/strava"
    );
  }
}

/**
 * Supabase + `pg` v8+: `sslmode=require` is treated like strict verification and can throw
 * "self-signed certificate in certificate chain" on Vercel. `uselibpqcompat=true` opts into
 * libpq-compatible SSL semantics (see pg-connection-string warning).
 */
function withSupabasePgSslCompat(connectionString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return connectionString;
  }
  if (!parsed.hostname.endsWith("supabase.co")) {
    return connectionString;
  }
  const q = new URLSearchParams(parsed.search);
  if (!q.has("uselibpqcompat")) {
    q.set("uselibpqcompat", "true");
  }
  if (!q.has("sslmode")) {
    q.set("sslmode", "require");
  }
  parsed.search = q.toString();
  return parsed.toString();
}

function poolOptionsForUrl(connectionString: string): PoolConfig {
  const url = withSupabasePgSslCompat(connectionString);
  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "0";
  if (!rejectUnauthorized) {
    return {
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    };
  }
  return { connectionString: url };
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
