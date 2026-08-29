# AGENTS — paste

Minimal guide for AI agents and operators. Code is the source of truth.

## Stack

- SvelteKit 2 / Svelte 5 (runes mode), Vite 8, Bun >= 1.4 (`preinstall` guard in `package.json`)
- Hosting: Vercel via `@sveltejs/adapter-vercel` (`nodejs22.x` in `vite.config.ts`)
- Persistence: Supabase Postgres + private Storage bucket `pastes` (`supabase/migrations/*`)
- Client: `@supabase/supabase-js` service-role only (server-only via `$lib/server`)

## Layout

```
src/
  lib/
    server/           # server-only — never import from client
      env.ts          # single env chokepoint ($env/dynamic/private)
      supabase.ts     # service-role client
      pastes.ts       # create/read/purge, hybrid storage split
      rate-limit.ts   # HMAC-SHA256 IP + RPC consume_rate_budget
      ids.ts          # 8-char base62 CSPRNG
      raw.ts          # raw response + ETag
    ttl.ts            # TTL vocabulary (1d/7d/30d/90d/365d)
    format.ts
    types/database.ts # generated Supabase types
  routes/
    +page.svelte / +page.server.ts   # create UI + form action
    [id]/+page.server.ts             # viewer (HTML)
    raw/[id]/+server.ts              # forced raw
    api/pastes/+server.ts            # POST /api/pastes (curl)
    api/cron/purge/+server.ts        # purge endpoint (Vercel Cron)
  hooks.server.ts     # content negotiation + security headers
  app.html / app.css
static/theme-init.js  # pre-paint theme, loads before Svelte
supabase/migrations/*.sql
vercel.json           # cron schedule
```

## Env

All config via `src/lib/server/env.ts` (`$env/dynamic/private`), documented in `.env.example`.

| Variable                       | Required | Purpose                                  |
| ------------------------------ | -------- | ---------------------------------------- |
| `SUPABASE_URL`                 | yes      | Project URL                              |
| `SUPABASE_SERVICE_ROLE_KEY`    | yes      | service_role — server-only, bypasses RLS |
| `RATE_LIMIT_SECRET`            | yes      | HMAC key for IP hashing                  |
| `CRON_SECRET`                  | yes      | Bearer for `POST /api/cron/purge`        |
| `PASTE_INLINE_THRESHOLD_BYTES` | no       | default `65536` (64 KiB)                 |
| `PASTE_MAX_BYTES`              | no       | default `5242880` (5 MiB)                |
| `RATE_LIMIT_BUDGET_BYTES`      | no       | default `20971520` (20 MiB/h/IP)         |
| `RATE_LIMIT_WINDOW_SECONDS`    | no       | default `3600`                           |
| `PUBLIC_SITE_URL`              | no       | canonical URL for returned links         |

## Commands

```sh
bun install
cp .env.example .env   # fill required vars
bun run dev            # HMR dev server
bun run check          # svelte-check + TypeScript
bun run lint           # oxlint
bun run lint:fix
bun run fmt            # oxfmt
bun run fmt:check
bun run build          # vite build (needs env — use dummy values in CI)
bun run preview        # preview adapter-vercel output
```

Build requires env at import time; for CI use dummy values:
`SUPABASE_URL=https://dummy.supabase.co SUPABASE_SERVICE_ROLE_KEY=dummy RATE_LIMIT_SECRET=dummy CRON_SECRET=dummy bun run build`

## Conventions

- `$lib/server` boundary enforced by SvelteKit — client imports fail at build.
- Runes mode forced for app files in `vite.config.ts`.
- `oxfmt` + `oxlint` before push.
- Schema changes: new migration file, `bunx supabase db push`, regenerate `src/lib/types/database.ts`.
- CSP via `vite.config.ts` `csp: { mode: "hash" }` (hashes SvelteKit hydration) + baseline in `hooks.server.ts` for raw/API routes.

## Deployment

- Vercel + Supabase. `vercel.json` runs `GET /api/cron/purge` daily `17 3 * * *` with `Authorization: Bearer $CRON_SECRET`.
- Supabase: apply migrations, ensure private bucket `pastes`, generate types.
- Vercel env: set all required vars (mark secrets sensitive), set `PUBLIC_SITE_URL`.

## Security notes

- Paste IDs: 8-char base62 CSPRNG, ~48-bit entropy, collision retries.
- Content negotiation in `hooks.server.ts`: `Accept: text/html` → HTML viewer, else raw `text/plain`.
- Raw + API routes set `nosniff`, `private` cache, ETag on raw.
- IPs never persisted, only HMAC hashes; pastes store no author metadata.

## License

AGPL-3.0 — see `LICENSE`.
