# ADR 0001 — Record architecture decisions

- **Date:** 2026-08-22
- **Status:** Accepted

## Context

Engineering choices made today (storage backends, anonymity model, deployment
target) are cheap to make and expensive to rediscover. Without a written
record, the *why* behind each decision erodes as the codebase grows or as
contributors rotate — leading to relitigated debates, inconsistent docs, and
accidental reversals.

The project needs a lightweight way to capture significant decisions at the
moment they're made.

## Decision

Adopt **Architecture Decision Records** (ADRs), following the classic Nygard
format, stored in this directory:

```
docs/adr/NNNN-title-with-dashes.md
```

Each record contains: **Date**, **Status** (proposed / accepted / superseded by
NNNN), **Context** (forces at play), **Decision** (what we chose), and
**Consequences** (both positive and negative).

Rules of engagement:

- One ADR per decision; numbered sequentially; immutable once accepted —
  reversing a decision means writing a new ADR that supersedes the old one.
- Write the ADR when the decision is made, before or alongside the first
  implementing change.
- Decisions worth an ADR: anything affecting structure, external services,
  security posture, data lifecycle, or developer workflow. Trivial choices
  don't need one.
- `docs/README.md` links every ADR so the full history stays discoverable.

## Consequences

- (+) New contributors get rationale, not just configuration.
- (+) Reversals are explicit and traceable rather than silent drift.
- (−) Small documentation tax per decision — kept low by the terse format.
