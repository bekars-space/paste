# ADR 0006 — Deploy to Vercel with adapter-vercel

- **Date:** 2026-08-22
- **Status:** Accepted

## Context

The app is a standard SvelteKit SSR project. Deployment candidates:

1. **Vercel** (`@sveltejs/adapter-vercel`) — serverless functions at the edge network
2. Any VPS/container (`@sveltejs/adapter-node`, current scaffold default) behind nginx/Caddy
3. Cloudflare Workers (`adapter-cloudflare`) — runtime differences with Bun-era tooling

Constraints: Bun-based toolchain locally; Supabase (HTTP-friendly) as backend;
no appetite for server ops; hobby budget.

## Decision

Deploy to **Vercel using `@sveltejs/adapter-vercel`**. The swap from the
current `adapter-node` happens as the first deployment step
([deployment.md](../deployment.md#step-0-adapter-switch)); Bun remains the local
dev/build runner — only the build _output target_ changes.

Rationale:

- First-class SvelteKit support: zero-config builds, previews per PR, instant rollback.
- Serverless model fits the workload (short-lived request handlers) and pairs
  cleanly with Supabase's HTTP client ([ADR 0002](0002-supabase-for-db-and-storage.md)).
- Platform features replace hand-rolled ops: TLS/HSTS, CDN caching for static
  assets, scheduled cron for expiry cleanup.
- No servers to patch or pay for while idle.

## Consequences

- (+) Cheapest path to a reliable production URL; git-push deploys.
- (−) In-process state is forbidden — this shaped two designs:
  rate limiting lives in Postgres ([rate-limiting.md](../rate-limiting.md)),
  not memory; and cleanup runs via Vercel Cron, not an in-app timer.
- (−) Function limits cap request sizes/timeouts — reflected in the 5 MiB paste
  hard cap and streaming reads for large objects.
- (−) Vendor coupling to Vercel's platform; SvelteKit adapters keep the exit
  cost low (swap adapter + redeploy).
- Note: `adapter-node` output remains runnable (`bun run start`) for local
  integration checks or a future self-host fallback.
