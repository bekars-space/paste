# Deployment

Target platform: **Vercel** (serverless) + **Supabase** (managed Postgres and
Storage). Everything below is a one-time setup per environment; deploys after
that are `git push`.

> **Pending change:** the repo currently builds with `@sveltejs/adapter-node`
> (see `vite.config.ts`). Step 0 performs the swap to
> [`@sveltejs/adapter-vercel`](https://svelte.dev/docs/kit/adapter-vercel)
> ([ADR 0006](adr/0006-vercel-deployment.md)).

## Prerequisites

- [ ] Supabase project created ([database.md](database.md))
- [ ] Migrations applied (`bunx supabase db push`)
- [ ] Private Storage bucket `pastes` exists (create in dashboard → Storage,
      keep **private** — no policies needed; access is service-role only)
- [ ] Generated types committed (`src/lib/types/database.ts`)
- [ ] Env values collected per [.env.example](../.env.example)

## Step 0: Adapter switch

```sh
bun remove @sveltejs/adapter-node
bun add -D @sveltejs/adapter-vercel
```

```ts
// vite.config.ts
import vercel from "@sveltejs/adapter-vercel";
…
adapter: vercel(),
```

Keep Bun as the local dev/build runner (`bun --bun vite build`) — the adapter
only changes what the _build output_ targets (Vercel serverless functions), not
how you run Vite locally. Optionally pin function regions near the Supabase
project region via `vercel({ regions: ["fra1"] })` to cut DB latency.

## Step 1: Supabase

1. Create the project; note region (pick closest to your users).
2. Apply schema: `bunx supabase link --project-ref <ref> && bunx supabase db push`
3. Create private bucket `pastes` (dashboard or SQL:
   `insert into storage.buckets (id, name, public) values ('pastes','pastes', false);`)
4. Generate types: `bunx supabase gen types typescript …` (command in
   [database.md § Migrations and type generation](database.md#migrations-and-type-generation))

## Step 2: Vercel project

1. Import the Git repository → Framework preset auto-detects **SvelteKit**.
2. Install command: leave default (Vercel runs Bun-compatible installs);
   build command default (`vite build` via package script is fine).
3. Add environment variables (Production + Preview):

| Variable                    | Value                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | Project URL                                                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret (mark _Sensitive_)                                                    |
| `RATE_LIMIT_SECRET`         | `openssl rand -hex 32`                                                                    |
| `CRON_SECRET`               | `openssl rand -hex 32`                                                                    |
| `PUBLIC_SITE_URL`           | e.g. `https://paste.example.com`                                                          |
| Tunables                    | Optional — defaults documented in [Architecture](architecture.md#configuration-constants) |

4. Deploy. First deploy can also run before DNS/domain work.

## Scheduled cleanup

Daily purge of expired rows + storage objects, implemented as
`POST /api/cron/purge` guarded by `CRON_SECRET`
([database.md § Cleanup](database.md#cleanup)):

```jsonc
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/purge",
      "schedule": "17 3 * * *", // daily at 03:17 UTC
    },
  ],
}
```

Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set —
the endpoint must reject requests without it. Expiry correctness does not
depend on this job (reads filter on `expires_at`); it only reclaims space. The
schedule is once per day because Vercel's Hobby plan caps cron jobs at daily
frequency; on Pro it can be tightened (e.g. hourly).

## Domain & verification

Point the custom domain at Vercel per their dashboard; HTTPS/HSTS are automatic.

Post-deploy smoke test:

```sh
# create
curl -si --data-binary 'hello' https://paste.example.com/api/pastes?ttl=1d
# → 201 + JSON with id

# read raw from terminal (Accept: */* → text/plain)
curl -s https://paste.example.com/<id>

# forced raw path
curl -sI https://paste.example.com/raw/<id>
# → Content-Type: text/plain; charset=utf-8, nosniff

# browser check: open /<id> → HTML viewer renders

# rate limit check: paste PASTE_MAX_BYTES+1 → expect 413;
# drain budget → expect 429 with Retry-After
```

## Operations notes

- **Rollbacks:** Vercel instant rollback promotes any previous deployment.
- **Schema changes:** always land as migrations (`supabase/migrations/`),
  pushed _before_ deploying app code that depends on them.
- **Secrets rotation:** procedure in [Security § Secrets handling](security.md#secrets-handling).
- **Cost watch:** Supabase usage is dominated by Storage bandwidth for large
  pastes — if it grows, revisit the inline threshold and TTL defaults first.
