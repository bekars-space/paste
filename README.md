# paste

Minimal, anonymous pastebin. Share text with a short link that works for both
humans and terminals:

```sh
curl --data-binary @notes.txt https://paste.example.com/api/pastes
# → https://paste.example.com/kX9mQ2pL

curl -sL https://paste.example.com/kX9mQ2pL   # prints raw text in a terminal
```

## How it works

- **No accounts** — pastes are anonymous; abuse is contained by IP-based rate limiting and expiration.
- **Hybrid storage** — small pastes live inline in Postgres; larger ones are stored as files in Supabase Storage (see [docs/architecture.md](docs/architecture.md)).
- **Smart URLs** — browsers get an HTML viewer at `/<id>`, curl gets raw text; `/raw/<id>` always returns raw text.
- **Ephemeral by default** — every paste expires (7 days default).

Full documentation lives in [`docs/`](docs/README.md):

| Doc                                                    | Contents                                  |
| ------------------------------------------------------ | ----------------------------------------- |
| [Architecture](docs/architecture.md)                   | Stack, components, request flows          |
| [API](docs/api.md)                                     | Routes, content negotiation, status codes |
| [Database](docs/database.md)                           | Supabase schema, RLS, migrations, types   |
| [Rate limiting](docs/rate-limiting.md)                 | Byte-budget policy per IP                 |
| [Security](docs/security.md)                           | Threat model, headers, privacy            |
| [Deployment](docs/deployment.md)                       | Vercel + Supabase setup, cron             |
| [Development](docs/development.md)                     | Local setup, commands, conventions        |
| [ADRs](docs/adr/0001-record-architecture-decisions.md) | Architecture decision records             |

## Quickstart

Requires [Bun](https://bun.sh) >= 1.4 (enforced via `engines` + `preinstall`
guard; npm/pnpm/yarn installs are rejected).

```sh
bun install
cp .env.example .env   # fill in Supabase credentials — see docs/development.md
bun run dev
```

## Production build & server

The app targets Vercel (`@sveltejs/adapter-vercel`) — see
[docs/deployment.md](docs/deployment.md). A standalone Node-compatible server
(`@sveltejs/adapter-node`, current default) can still be built and run locally:

```sh
bun run build
bun run start   # bun ./build/index.js
```

## Tooling

```sh
bun run check        # svelte-check + TypeScript
bun run lint         # oxlint
bun run lint:fix
bun run fmt          # oxfmt
bun run fmt:check
```
