# ADR 0002 — Supabase for database and object storage

- **Date:** 2026-08-22
- **Status:** Accepted

## Context

A pastebin needs durable storage for structured paste metadata plus blob
storage for larger payloads, with minimal operational burden on a hobby-scale
project deployed serverlessly.

Options considered:

1. **Supabase** (Postgres + Storage, managed)
2. Self-hosted Postgres + S3-compatible storage on a VPS
3. Serverless-native DBs (e.g. Turso/Neon) + separate blob service

Access-pattern options within Supabase:

a. `@supabase/supabase-js` (HTTP/PostgREST client)
b. Direct Postgres connection with an ORM/driver (Drizzle, Prisma, postgres.js)

## Decision

Use **Supabase for both relational data and object storage**, accessed via
`@supabase/supabase-js` from server code only. No ORM, no direct TCP
connections. Schema is managed as plain SQL migrations through the Supabase
CLI; query types are generated from the schema (`supabase gen types`).

Rationale for supabase-js over ORM + direct connection:

- Serverless functions are ephemeral — HTTP calls avoid connection-pool
  management entirely (direct drivers need transaction-mode pooling).
- One client handles Postgres queries **and** Storage upload/download.
- Generated types give compile-time safety without ORM runtime weight.
- Plain-SQL migrations match the project's simple schema (2 tables).

## Consequences

- (+) Zero infrastructure to operate; free tier comfortably covers launch scale.
- (+) Storage bucket integrates with the same auth/permission model.
- (−) Vendor coupling to Supabase — mitigated by plain Postgres + S3-API
  compatibility underneath, making migration possible if ever needed.
- (−) Complex analytical SQL is awkward through PostgREST — irrelevant at this
  scope; escape hatch is SQL views/functions exposed via RPC.
