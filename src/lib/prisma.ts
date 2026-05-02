import path from "node:path";

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Relative `file:./…` resolves against cwd; Next/Turbopack can mismatch that and SQLite may throw
 * `SQLITE_READONLY_DBMOVED`. Force an absolute file path here.
 */
function resolveSqliteDatabaseUrl(raw?: string): string {
  const url = (raw ?? "file:./prisma/dev.db").trim();
  if (!url.startsWith("file:")) {
    return url;
  }

  const rest = url.slice("file:".length);
  const isWinAbs = /^[a-zA-Z]:[\\/]/.test(rest);
  const isPosixAbs = rest.startsWith("/") && rest.length > 1;

  if (isWinAbs || isPosixAbs) {
    return url;
  }

  const stripped = rest.replace(/^[/\\]+/, "");
  const absPath = path.resolve(process.cwd(), stripped || ".");
  return `file:${absPath}`;
}

function createPrismaClient() {
  // SQLite requires a writable file path on the filesystem. Hosted serverless bundles are read-only; use Postgres there.
  const adapter = new PrismaBetterSqlite3({
    url: resolveSqliteDatabaseUrl(process.env.DATABASE_URL),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
