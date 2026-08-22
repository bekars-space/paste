import { sequence } from "@sveltejs/kit/hooks";
import { dev } from "$app/environment";
import type { Handle } from "@sveltejs/kit";
import { fetchRaw } from "$lib/server/raw";

const ID_PATH = /^\/([A-Za-z0-9]{8})$/;

/**
 * Content negotiation for GET /{id} (ADR 0004): browsers — whose Accept
 * explicitly includes text/html — fall through to the viewer page; every
 * other client (curl, wget, plain HTTP) gets the raw body right here, no
 * redirect involved. GET /raw/{id} never matches and stays forced-raw.
 *
 * Kit strips the /__data.json and /__route.js suffixes from event.url before
 * hooks run, so its internal navigation requests look like plain /{id} here.
 * Their Accept carries no text/html — they must be excluded or the router
 * receives raw paste bytes instead of its payloads (symptom: 500 right after
 * create).
 */
const negotiate: Handle = async ({ event, resolve }) => {
  if (event.request.method !== "GET") return resolve(event);

  if (event.isDataRequest) return resolve(event);
  if (new URL(event.request.url).pathname.endsWith("/__route.js")) return resolve(event);

  const id = ID_PATH.exec(event.url.pathname)?.[1];
  if (!id || /text\/html/i.test(event.request.headers.get("accept") ?? "")) {
    return resolve(event);
  }

  return fetchRaw(id, event.request.headers);
};

/**
 * Baseline CSP for responses SvelteKit's page renderer does not cover
 * (raw endpoints, API routes). HTML pages get a richer header from
 * kit.csp in vite.config.ts, which hashes Kit's inline hydration
 * bootstrap — never duplicate it here. Skipped entirely in dev, where
 * Vite injects inline scripts that cannot be stably allowlisted.
 */
const BASELINE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'none'",
].join("; ");

const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (dev) {
    response.headers.delete("content-security-policy");
  } else if (!response.headers.has("content-security-policy")) {
    response.headers.set("content-security-policy", BASELINE_CSP);
  }
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return response;
};

export const handle = sequence(securityHeaders, negotiate);
