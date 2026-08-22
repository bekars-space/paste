/**
 * Single chokepoint for configuration. Uses $env/dynamic/private so the
 * project compiles even before a local .env exists; every required value is
 * validated once at startup and fails loudly pointing at .env.example.
 * Server-only: never import from client-side code.
 */
import { env } from "$env/dynamic/private";

function required(name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got "${raw}".`);
  }
  return parsed;
}

export const SUPABASE_URL = required("SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
export const RATE_LIMIT_SECRET = required("RATE_LIMIT_SECRET");
export const CRON_SECRET = required("CRON_SECRET");

export const PASTE_INLINE_THRESHOLD_BYTES = int("PASTE_INLINE_THRESHOLD_BYTES", 65536);
export const PASTE_MAX_BYTES = int("PASTE_MAX_BYTES", 5242880);
export const RATE_LIMIT_BUDGET_BYTES = int("RATE_LIMIT_BUDGET_BYTES", 20971520);
export const RATE_LIMIT_WINDOW_SECONDS = int("RATE_LIMIT_WINDOW_SECONDS", 3600);

/** Optional canonical URL override; falls back to the request origin. */
export function siteUrl(fallbackOrigin: string): string {
  return env.PUBLIC_SITE_URL?.replace(/\/$/, "") || fallbackOrigin;
}
