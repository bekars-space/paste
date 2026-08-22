import type { Handle } from "@sveltejs/kit";
import { fetchRaw } from "$lib/server/raw";

const ID_PATH = /^\/([A-Za-z0-9]{8})$/;

/**
 * Content negotiation for GET /{id} (ADR 0004): browsers — whose Accept
 * explicitly includes text/html — fall through to the viewer page; every
 * other client (curl, wget, plain HTTP) gets the raw body right here, no
 * redirect involved. GET /raw/{id} never matches and stays forced-raw.
 */
export const handle: Handle = async ({ event, resolve }) => {
  if (event.request.method !== "GET") return resolve(event);

  const id = ID_PATH.exec(event.url.pathname)?.[1];
  if (!id || /text\/html/i.test(event.request.headers.get("accept") ?? "")) {
    return resolve(event);
  }

  return fetchRaw(id, event.request.headers);
};
