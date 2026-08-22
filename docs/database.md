# Database

Supabase Postgres is the single source of truth for pastes, rate-limit state
and expiry. This page covers the access pattern, schema, security model, and
the migration workflow.

## Access pattern: supabase-js, no ORM

All database access goes through [`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript/introduction)
— a typed HTTP client (PostgREST), not an ORM:

```ts
// src/lib/server/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "$env/static/private";

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
```

Why this shape ([ADR 0002](adr/0002-supabase-for-db-and-storage.md)):

- **Serverless-friendly** — plain HTTPS calls; no TCP connection pooling to
  manage on Vercel (a direct `postgres` driver would need Supavisor
  transaction-mode pooling).
- **One client for DB _and_ Storage** — large-paste upload/download uses the
  same instance.
- **Type safety without ORM overhead** — query types are generated from the
  live schema (below).
- **Schema managed as plain SQL** — versioned migrations via Supabase CLI.

The service-role key **bypasses Row Level Security**, so it must only ever be
imported from `$lib/server` / `$env/static/private`. See
[Security § Secrets handling](security.md#secrets-handling).

## Schema

Two tables, no user/auth tables by design ([ADR 0003](adr/0003-anonymous-no-auth.md)).

### `public.pastes`

| Column         | Type                                 | Notes                                       |
| -------------- | ------------------------------------ | ------------------------------------------- |
| `id`           | `text` PK                            | 8-char base62                               |
| `content`      | `text` nullable                      | Inline payload (≤ 64 KiB)                   |
| `storage_path` | `text` nullable                      | Object key in bucket `pastes` (`{id}`)      |
| `size_bytes`   | `bigint NOT NULL`                    | Original byte length                        |
| `created_at`   | `timestamptz NOT NULL DEFAULT now()` |                                             |
| `expires_at`   | `timestamptz NOT NULL`               | Read-time expiry filter + cleanup key       |
| `ip_hash`      | `text NOT NULL`                      | HMAC-SHA256 of client IP — never the raw IP |

Exactly one payload column must be non-null:

```sql
create table public.pastes (
  id           text primary key,
  content      text,
  storage_path text,
  size_bytes   bigint not null check (size_bytes > 0),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  ip_hash      text not null,
  constraint pastes_payload_exclusive
    check ( (content is null) <> (storage_path is null) )
);

-- cleanup job scans on this
create index pastes_expires_at_idx on public.pastes (expires_at);
```

> The exclusive-or constraint is the enforcement point for the hybrid storage
> strategy — a bug that writes both or neither payload fails loudly at the DB.

### `public.rate_limits`

Fixed-window byte counters keyed by hashed IP:

| Column         | Type                        | Notes                         |
| -------------- | --------------------------- | ----------------------------- |
| `ip_hash`      | `text` PK                   | HMAC-SHA256 of client IP      |
| `window_start` | `timestamptz NOT NULL`      | Start of current fixed window |
| `bytes_used`   | `bigint NOT NULL DEFAULT 0` | Upload bytes consumed         |

```sql
create table public.rate_limits (
  ip_hash      text primary key,
  window_start timestamptz not null,
  bytes_used   bigint not null default 0 check (bytes_used >= 0)
);
```

Rows are reset (not deleted) when a new window starts inside the RPC below;
stale rows are purged opportunistically by the daily cron endpoint.

## Rate-budget RPC

Enforced atomically server-side via a `security definer` function so the
check-and-increment cannot race under concurrent requests:

```sql
create or replace function public.consume_rate_budget(
  p_ip_hash        text,
  p_request_bytes  bigint,
  p_budget         bigint,
  p_window         interval
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row          record;
  v_now          timestamptz := now();
  v_window_end   timestamptz;
begin
  -- uniform enforcement: reject requests larger than the whole budget even on
  -- a fresh window. Unreachable with correct config (bodies above
  -- PASTE_MAX_BYTES fail with 413 before this RPC runs); it guards against
  -- misconfiguration where the budget is lowered below the paste cap.
  if p_request_bytes > p_budget then
    return query select false,
      greatest(1, ceil(extract(epoch from p_window)))::int;
    return;
  end if;

  select * into v_row from public.rate_limits
   where ip_hash = p_ip_hash
   for update;

  -- new visitor, or window elapsed → fresh budget
  if v_row is null or v_row.window_start + p_window <= v_now then
    insert into public.rate_limits as rl (ip_hash, window_start, bytes_used)
    values (p_ip_hash, v_now, p_request_bytes)
    on conflict (ip_hash) do update
      set window_start = excluded.window_start,
          bytes_used   = excluded.bytes_used;
    return query select true, 0;
    return;
  end if;

  if v_row.bytes_used + p_request_bytes <= p_budget then
    update public.rate_limits
       set bytes_used = bytes_used + p_request_bytes
     where ip_hash = p_ip_hash;
    return query select true, 0;
    return;
  end if;

  v_window_end := v_row.window_start + p_window;
  return query select false,
    greatest(1, ceil(extract(epoch from (v_window_end - v_now))))::int;
end;
$$;
```

Called from `$lib/server/rate-limit.ts` with defaults
`p_budget = RATE_LIMIT_BUDGET_BYTES`, `p_window = RATE_LIMIT_WINDOW_SECONDS`.
Enforcement is uniform — every request, including the first of a fresh window,
is validated against the budget; no path bypasses it. Policy details:
[Rate limiting](rate-limiting.md).

## Security model

Row Level Security denies everything to non-service roles — all traffic flows
through our server, which authenticates with the service-role key:

```sql
alter table public.pastes      enable row level security;
alter table public.rate_limits enable row level security;

-- No policies created → anon/authenticated roles are denied by default.
revoke all on public.pastes, public.rate_limits from anon, authenticated;
```

The Storage bucket `pastes` mirrors this: created **private**, with no storage
policies granted to `anon`/`authenticated`. Objects are uploaded/downloaded via
the service-role client only.

## Migrations and type generation

Plain SQL files under `supabase/migrations/`, applied with the Supabase CLI:

```sh
bunx supabase login
bunx supabase link --project-ref <project-ref>

bunx supabase migration new init_schema     # creates timestamped .sql file
# …edit SQL…
bunx supabase db push                       # apply to linked project
bunx supabase db diff                       # generate SQL from dashboard edits
```

Generate typed queries from the live schema after each change:

```sh
bunx supabase gen types typescript --project-id <project-ref> \
  --schema public > src/lib/types/database.ts
```

The generated `Database` type feeds the client:

```ts
export const supabase = createClient<Database>(url, key, { … });
// supabase.from("pastes").select("id, content") → fully typed rows
```

## Cleanup

Expired data is removed by the daily cron route
(`POST /api/cron/purge`, protected by `CRON_SECRET`):

1. `DELETE FROM pastes WHERE expires_at <= now() RETURNING id, storage_path`
2. For each returned `storage_path`: remove the object from bucket `pastes`
   (batched `supabase.storage.from("pastes").remove([...])`)
3. Delete stale `rate_limits` rows whose window ended more than 24 h ago

Read-time filtering means users never see expired pastes even between cleanup
runs — see [Architecture § Expiry lifecycle](architecture.md#expiry-lifecycle).
