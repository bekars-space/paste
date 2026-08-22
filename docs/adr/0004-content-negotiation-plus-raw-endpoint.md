# ADR 0004 — Content negotiation plus explicit `/raw` endpoint

- **Date:** 2026-08-22
- **Status:** Accepted

## Context

The product requirement: `/{id}` must serve **raw text to terminals** (curl,
wget, pipes) and an **HTML page to browsers** — one URL, two representations.

Options considered:

1. `Accept`-header negotiation only on `/{id}`
2. Separate raw path only (`/raw/{id}`), HTML always on `/{id}`
3. User-agent sniffing on a single path
4. Negotiation + explicit `/raw/{id}` escape hatch

## Decision

**Option 4.**

- `GET /{id}`: respond with the HTML viewer iff the `Accept` header contains
  the token `text/html`; otherwise respond with the raw body as
  `text/plain; charset=utf-8`.
- `GET /raw/{id}`: always returns the raw body, regardless of `Accept`.

Rationale:

- Every browser sends `text/html` in `Accept`; curl/wget send `*/*`. The rule
  "HTML only when explicitly requested" makes terminal behaviour deterministic.
- Header inspection beats user-agent sniffing: no brittle UA string parsing,
  and it is the HTTP-standard mechanism for exactly this problem.
- The explicit `/raw/{id}` covers real edge cases where negotiation alone is
  ambiguous — GUI tools and IDE plugins that send browser-like `Accept`
  headers, embedding links in READMEs, and humans who just want the guaranteed
  plain-text URL.

Rejected alternatives:

- *Negotiation only*: unpredictable across exotic clients; no way to force raw.
- *`/raw` only*: breaks the "paste URL works in my terminal" promise — curl
  users would need to remember a different path than browser users.
- *UA sniffing*: unmaintainable heuristics; fails for every new client.

## Consequences

- (+) Single canonical share URL that "just works" everywhere.
- (+) Raw responses can be cached/ETagged independently of HTML.
- (−) Two code paths must produce identical bytes for the payload (mitigated:
  both delegate to one shared read helper).
- (−) Clients sending unusual `Accept` values get raw output by default —
  chosen deliberately as the safe failure mode.
