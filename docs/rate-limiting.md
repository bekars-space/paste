# Rate limiting

With no user accounts ([ADR 0003](adr/0003-anonymous-no-auth.md)), rate
limiting is the primary abuse control. The strategy is deliberately simple:
**charge every IP a byte budget for uploads, per fixed window.**

## Policy

| Parameter | Default | Env override |
| --- | --- | --- |
| Budget per IP per window | 20 MiB | `RATE_LIMIT_BUDGET_BYTES` |
| Window length (fixed) | 1 hour | `RATE_LIMIT_WINDOW_SECONDS` |
| Max single paste | 5 MiB | `PASTE_MAX_BYTES` |

**Invariant:** the budget must stay ≥ `PASTE_MAX_BYTES`, so any single paste
always fits within a fresh window's budget.

Consequences of the defaults:

- Up to 4 full-size pastes (4 × 5 MiB) fit cleanly within one window's budget —
  real bursts work, sustained bulk uploading does not (ceiling ~480 MB/day/IP).
- Oversized bodies (`> PASTE_MAX_BYTES`) are rejected with `413` **before**
  touching the budget — fail fast, don't punish fat-fingered uploads twice.
- Rejected-by-rate-limit requests consume nothing further.

Responses:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 1200

{ "error": { "code": "rate_limited", "message": "…" } }
```

The web UI surfaces the same state as a friendly message with the retry time.

## Why bytes, not request counts?

A pastebin's cost driver and abuse surface is payload size, not hit count.
Counting requests lets one client flood storage with 100 × 5 MiB pastes inside
a normal-looking rate; a byte budget prices exactly the resource being
consumed. Reads stay unthrottled: they're cheap (single indexed row lookup,
CDN-cacheable) and throttling reads would hurt the terminal-first UX.

## Identifying clients without storing IPs

Raw IPs are never persisted. The limiter keys on an HMAC:

```ts
// $lib/server/rate-limit.ts
const ipHash = await hashIp(ip); // HMAC-SHA256(ip, RATE_LIMIT_SECRET) → hex
```

- On Vercel, the client IP is taken from the platform-provided `x-real-ip`
  header (`x-forwarded-for`'s leftmost value as fallback).
- HMAC with a server-side secret means hashes can't be reversed or rainbow-
  tabled to recover IPs — see [Security § Privacy](security.md#privacy).
- Hashes are stable per IP, which is all the fixed-window counter needs.

## Why not in-memory?

Vercel deploys SvelteKit routes as ephemeral, independently-scaled serverless
functions. An in-process counter would be:

- **Split-brained** — N instances keep N unrelated counters;
- **Amnesiac** — every cold start resets state;
- **Unenforceable** — attackers don't hit the same instance twice.

So the counter lives in Postgres via the atomic
[`consume_rate_budget` RPC](database.md#rate-budget-rpc) — one round-trip that
locks, checks, increments or rejects. This adds ~one DB call per create, which
is negligible against the insert/upload that follows.

### When to revisit

| Trigger | Upgrade path |
| --- | --- |
| Sub-second precision needed / high write contention | Upstash Redis (sliding window) |
| L7 floods before they reach functions | Vercel WAF / Firewall rules |
| Global abuse patterns (multi-IP farms) | Vercel Attack Challenge Mode + budget tightening |

None of these are warranted at current scale — documented here so the escape
hatch is obvious.

## Enforcement order

1. Parse body size → `413` if over cap *(budget untouched)*
2. Compute IP hash → call `consume_rate_budget` → `429` + `Retry-After` if denied
3. Generate ID, write payload, return `201`

Both validation failures return before any expensive work (Storage upload,
ID generation retries).
