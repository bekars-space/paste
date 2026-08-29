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
- **Hybrid storage** — small pastes live inline in Postgres; larger ones are stored as files in Supabase Storage.
- **Smart URLs** — browsers get an HTML viewer at `/<id>`, curl gets raw text; `/raw/<id>` always returns raw text.
- **Ephemeral by default** — every paste expires (7 days default).

## Quickstart

Requires [Bun](https://bun.sh) >= 1.4 (enforced via `engines` + `preinstall`
guard; npm/pnpm/yarn installs are rejected).

```sh
bun install
cp .env.example .env   # fill in Supabase credentials
bun run dev
```

## Production build

The app targets Vercel (`@sveltejs/adapter-vercel`, `nodejs22.x`).

```sh
bun run build     # needs env — use dummy values in CI if needed
bun run preview   # preview adapter-vercel output
```

## Tooling

```sh
bun run check        # svelte-check + TypeScript
bun run lint         # oxlint
bun run lint:fix
bun run fmt          # oxfmt
bun run fmt:check
```
