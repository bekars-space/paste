import { getPaste, type FetchedPaste } from "./pastes";

const encoder = new TextEncoder();

async function sha256Hex(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(body));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Unknown ID and expired paste are indistinguishable — both return 404. */
export function notFoundResponse(): Response {
  return new Response(
    JSON.stringify({
      error: { code: "not_found", message: "No such paste (or it has expired)." },
    }),
    { status: 404, headers: { "content-type": "application/json; charset=utf-8" } },
  );
}

/** Raw representation — served both by the content-negotiation hook and the /raw/{id} route. */
export async function rawPasteResponse(
  paste: FetchedPaste,
  requestHeaders: Headers,
): Promise<Response> {
  const etag = `"${await sha256Hex(paste.content)}"`;
  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=60",
    etag,
  });
  if (requestHeaders.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(paste.content, { headers });
}

export async function fetchRaw(id: string, requestHeaders: Headers): Promise<Response> {
  const paste = await getPaste(id);
  return paste ? rawPasteResponse(paste, requestHeaders) : notFoundResponse();
}
