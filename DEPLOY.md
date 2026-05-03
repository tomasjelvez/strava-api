# Deployment (Vercel + PostgreSQL)

## Environment variables

Set these in the Vercel project (and mirror them in `prod.env` for local runs against production data):

- **`DATABASE_URL`** — connection string used at **runtime** by the app. With Supabase or another PgBouncer pooler, use the **pooled** Prisma-style URL here. The app uses [`@prisma/adapter-pg`](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections#external-connection-poolers) with this value.
- **`DIRECT_URL`** — direct (non-pooling) Postgres URL for **`prisma migrate`**, `db push`, and other Prisma CLI commands. In `prisma.config.ts`, the CLI datasource URL is **`DIRECT_URL`**, falling back to **`DATABASE_URL`** if `DIRECT_URL` is unset (fine for local Docker when both are the same).

Also set Clerk, Strava OAuth, OpenAI, Resend, and any other app secrets with the same variable names as in `.env.example`.

## `npm run prod` (local app against prod DB)

`npm run prod` must load **`prod.env` for every step**. The scripts run `env-cmd` before **`next dev`** / **`next build`** as well as **`prisma generate`**, so Next.js sees the same `DATABASE_URL` as Prisma. If only `prisma generate` were wrapped, Next would still read `.env.local` / `.env` and you would get wrong-database or auth errors.

## Build and Prisma

The app imports the generated client from `src/generated/prisma`, which is gitignored. **`prisma generate` must run on install or before `next build`.** This repo uses `postinstall` and prefixes `build` with `prisma generate` so Vercel produces the client on every deploy.

## Supabase + `prisma migrate` (P1001 / pooler)

- **`prisma migrate dev`** (and this repo’s `prisma.config.ts`) use **`DIRECT_URL` first**, then **`DATABASE_URL`**. If **`DIRECT_URL` is missing**, the CLI may use your **transaction pooler** URL (`…pooler.supabase.com:6543`). That host/port can be **blocked** on some networks, and migrations are more reliable on a **direct** Postgres URL.
- In the Supabase dashboard: **Project Settings → Database → Connection string**. Use the **URI** intended for **direct** access (host like **`db.<project-ref>.supabase.co`**, port **`5432`**, database **`postgres`**) for **`DIRECT_URL`**. Keep the **pooler / “Transaction”** URI (often port **6543**) as **`DATABASE_URL`** for the Next.js app if you use it.
- Ensure the URI includes **`?sslmode=require`** (or `ssl=true`) if Supabase shows it.
- If you still see **P1001**, try another network (e.g. hotspot), disable VPN, or confirm outbound TCP to that host/port is allowed.

## Database migrations

Apply schema changes to production with:

```bash
DATABASE_URL="…" DIRECT_URL="…" npx prisma migrate deploy
```

Run this from a trusted environment (CI job, local machine with prod URLs, or a Vercel build step if you add one). The default Vercel build does not run `migrate deploy`; run it when you ship a migration.

## Secrets

If database or Supabase credentials were ever committed or pasted into chat, **rotate them** in the Supabase dashboard. Never commit `prod.env`; it is listed in `.gitignore`.
