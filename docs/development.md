# Development

## Prerequisites

| Tool                  | Version           | Notes                                                                                                             |
| --------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| [Bun](https://bun.sh) | >= 1.4            | Required — enforced by `engines` + `preinstall` guard (`npx only-allow bun`); npm/pnpm/yarn installs are rejected |
| Supabase CLI          | latest            | Run via `bunx supabase …`; used for migrations, type generation, optional local DB                                |
| A Supabase project    | free tier is fine | Hosted dev/staging project, or local stack via `supabase start` (needs Docker)                                    |

Node.js is **not** required locally.

## First-time setup

```sh
git clone <repo> && cd paste
bun install
cp .env.example .env        # then fill values (below)
bunx supabase login
bunx supabase link --project-ref <ref>
bunx supabase db push       # apply schema
bunx supabase gen types typescript --project-id <ref> --schema public \
  > src/lib/types/database.ts
bun run dev
```

### Environment variables

Copy [.env.example](../.env.example) and fill:

| Variable                    | Required | Purpose                                                                                       |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | yes      | Project URL (Dashboard → Settings → API)                                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | yes      | service_role secret — server-only                                                             |
| `RATE_LIMIT_SECRET`         | yes      | Any 32-byte hex string for dev (`openssl rand -hex 32`)                                       |
| `CRON_SECRET`               | yes      | Protects `/api/cron/purge`; any value locally                                                 |
| `PASTE_*`, `RATE_LIMIT_*`   | no       | Defaults in [Architecture § Configuration constants](architecture.md#configuration-constants) |
| `PUBLIC_SITE_URL`           | no       | Only affects returned absolute URLs                                                           |

Never commit `.env`; never prefix these with `PUBLIC_`
([Security § Secrets](security.md#secrets-handling)).

## Daily commands

```sh
bun run dev          # dev server with HMR
bun run build        # production build (adapter output → ./build)
bun run preview      # preview the production build
bun run start        # run adapter-node server: bun ./build/index.js

bun run check        # svelte-check + TypeScript
bun run lint         # oxlint
bun run lint:fix
bun run fmt          # oxfmt
bun run fmt:check
```

## Conventions

- **Server-only code lives in `$lib/server/`** — SvelteKit makes client imports
  of that directory a compile error. The supabase service client must never be
  imported outside it.
- **Runes mode everywhere** — forced on for all app files via `vite.config.ts`.
- **Formatting/linting:** oxfmt + oxlint; run `bun run fmt && bun run lint`
  before pushing.
- **Schema changes:** new migration file per change
  (`bunx supabase migration new <name>`), edit SQL, `db push`,
  regenerate types, commit both together. Never mutate the schema from the
  dashboard without capturing a migration (`bunx supabase db diff`).
- **New tunables** go through `$lib/server/config.ts` with an entry in
  `.env.example` — no magic numbers scattered across routes.
- **Docs:** behaviour-affecting changes update the relevant page here; decision
  reversals get a new ADR rather than editing history.

## Local Supabase (optional)

Prefer a hosted dev project for simplicity; if you need an offline stack:

```sh
bunx supabase start            # Docker required
# SUPABASE_URL=http://127.0.0.1:54321
# SUPABASE_SERVICE_ROLE_KEY= printed by the command above
```

Migrations apply automatically to the local stack; push them upstream with
`db push` when ready.
