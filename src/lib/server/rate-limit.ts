import { RATE_LIMIT_BUDGET_BYTES, RATE_LIMIT_SECRET, RATE_LIMIT_WINDOW_SECONDS } from "./env";
import { supabase } from "./supabase";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const encoder = new TextEncoder();

/** HMAC-SHA256 of the client IP — the raw IP is never persisted. */
export async function hashIp(ip: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(RATE_LIMIT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(ip));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Client IP behind Vercel's edge: first hop of X-Forwarded-For, falling back
 * to X-Real-IP. Unresolvable clients share one bucket — fail closed.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export async function consumeRateBudget(
  ip: string,
  requestBytes: number,
): Promise<RateLimitResult> {
  const ipHash = await hashIp(ip);
  const { data, error } = await supabase.rpc("consume_rate_budget", {
    p_ip_hash: ipHash,
    p_request_bytes: requestBytes,
    p_budget: RATE_LIMIT_BUDGET_BYTES,
    p_window: `${RATE_LIMIT_WINDOW_SECONDS} seconds`,
  });
  if (error) throw error;

  const row = data?.[0];
  if (!row) throw new Error("consume_rate_budget returned no row");
  return row.allowed
    ? { allowed: true }
    : { allowed: false, retryAfterSeconds: row.retry_after_seconds };
}
