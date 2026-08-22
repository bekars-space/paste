# ADR 0005 — Hybrid paste storage with inline threshold

- **Date:** 2026-08-22
- **Status:** Accepted

## Context

Pastes range from one-liners to multi-megabyte dumps. Two storage backends are
available (Supabase Postgres and Supabase Storage), so each paste must land in
one of them.

Considerations:

- Small payloads as table rows: single indexed lookup on read, trivially
  transactional, no extra network hop. Postgres TOAST compresses large TEXT
  values out of the main tuple automatically.
- Very large blobs as rows bloat sequential scans, indexes-on-expression,
  logical replication, and backups; object storage is designed for exactly this.
- A fixed rule is easier to reason about than size-adaptive behaviour at read time.
- Reads must be uniform regardless of backend: `/{id}` and `/raw/{id}` cannot
  care where the bytes live.

## Decision

**Split by a single compile-time threshold:**

| Size                                      | Backend                                             | Row shape                          |
| ----------------------------------------- | --------------------------------------------------- | ---------------------------------- |
| ≤ 64 KiB (`PASTE_INLINE_THRESHOLD_BYTES`) | Postgres `pastes.content` TEXT column               | `content` set, `storage_path` NULL |
| 64 KiB – 5 MiB (`PASTE_MAX_BYTES`)        | Supabase Storage bucket `pastes`, object key `{id}` | `storage_path` set, `content` NULL |
| > 5 MiB                                   | Rejected (`413`) before any write                   | —                                  |

Invariants:

- A DB **CHECK constraint** enforces exactly-one-of (`(content IS NULL) <> (storage_path IS NULL)`).
- All reads go through one repository helper that resolves either source, so
  route code stays storage-agnostic.
- Storage objects use the paste ID as key and live in the private bucket —
  served only through our routes, never via public object URLs.

## Consequences

- (+) The overwhelmingly common case (small pastes) costs one query, not two.
- (+) Table, replication stream and DB backups stay lean; blobs scale in cheap
  object storage.
- (+) One knob (`threshold`) tunes the trade-off per environment.
- (−) Large-paste creation pays an extra upload round-trip (acceptable — rare path).
- (−) Deleting a storage-backed paste requires two deletions (row + object);
  centralised in the cron purge to keep it correct ([database.md § Cleanup](../database.md#cleanup)).
- Review trigger: if p95 paste size grows past ~1 MiB in practice, re-evaluate
  the threshold downward.
