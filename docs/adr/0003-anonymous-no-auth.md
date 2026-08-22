# ADR 0003 — Anonymous access, no user accounts

- **Date:** 2026-08-22
- **Status:** Accepted

## Context

A pastebin's core value is friction-free sharing. User registration would add
email flows, session management, password handling and GDPR surface — all for
features (paste ownership, editing, dashboards) that a minimal pastebin does
not promise.

The counter-risk is abuse: without accounts, nothing identifies repeat
offenders or caps consumption.

## Decision

**No authentication system.** Pastes are anonymous; the only persisted client
identifier is an HMAC-hashed IP used exclusively for rate accounting.
Abuse is contained by:

1. **Byte-budget rate limiting** per hashed IP ([rate-limiting.md](../rate-limiting.md))
2. **Hard size cap** (5 MiB) on every paste
3. **Mandatory expiry** (default 7 days) so nothing persists indefinitely

Ownership semantics are capability-based: whoever holds the paste URL can read
it; there is no edit/delete-by-owner flow in v1.

## Consequences

- (+) Zero-friction creation — the entire product works from one `curl` line.
- (+) No credentials to store, reset, or leak; no auth code to maintain.
- (+) Minimal personal data → minimal privacy obligations.
- (−) No self-service deletion/editing; takedowns are manual (admin).
- (−) Determined attackers can rotate IPs; budgets are a speed bump, not a wall.
  Accepted because storage cost is bounded by cap + TTL regardless.
- Future escape hatch documented: optional "unlisted" pastes with a separate
  read key if privacy demands grow; an abuse-report endpoint before public launch.
