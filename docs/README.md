# Documentation

Design documentation for **paste**, an anonymous pastebin built with SvelteKit,
Bun and Supabase, deployed on Vercel.

> These docs describe the **target design**. The codebase currently contains the
> SvelteKit scaffold; backend features marked below are documented but not yet
> implemented.

## Reading order

| Doc | Contents |
| --- | --- |
| [Architecture](architecture.md) | Stack, components, request flows, storage strategy |
| [API](api.md) | Endpoints, content negotiation, status codes, curl examples |
| [Database](database.md) | Supabase schema, RLS, rate-limit RPC, migrations, type generation |
| [Rate limiting](rate-limiting.md) | Byte-budget policy, IP hashing, serverless constraints |
| [Security](security.md) | Threat model, XSS, secrets handling, privacy |
| [Deployment](deployment.md) | Vercel setup, adapter swap, cron cleanup, verification |
| [Development](development.md) | Local setup, environment variables, commands, conventions |

## Architecture decision records

Decisions are captured in [ADRs](adr/0001-record-architecture-decisions.md) —
short documents explaining why each choice was made:

- [ADR 0001 — Record architecture decisions](adr/0001-record-architecture-decisions.md)
- [ADR 0002 — Supabase for database and object storage](adr/0002-supabase-for-db-and-storage.md)
- [ADR 0003 — Anonymous access, no user accounts](adr/0003-anonymous-no-auth.md)
- [ADR 0004 — Content negotiation plus explicit /raw endpoint](adr/0004-content-negotiation-plus-raw-endpoint.md)
- [ADR 0005 — Hybrid paste storage with inline threshold](adr/0005-hybrid-storage-threshold.md)
- [ADR 0006 — Deploy to Vercel with adapter-vercel](adr/0006-vercel-deployment.md)

## Conventions

- Constants (thresholds, budgets, TTLs) referenced across docs are defined in
  [Architecture § Configuration constants](architecture.md#configuration-constants)
  and overridable via environment variables (see
  [Development § Environment variables](development.md#environment-variables)).
- Code snippets in SQL blocks are migration-ready; TypeScript snippets are
  indicative of the intended shape.
