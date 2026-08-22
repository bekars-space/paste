import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { siteUrl } from "$lib/server/env";
import { createPaste } from "$lib/server/pastes";
import { clientIp } from "$lib/server/rate-limit";

/** Programmatic create — docs/api.md § POST /api/pastes. */
export const POST: RequestHandler = async ({ request, url }) => {
  const body = await request.text();

  const result = await createPaste(body, url.searchParams.get("ttl"), clientIp(request.headers));

  if (!result.ok) {
    const e = result.error;
    const headers: Record<string, string> = {};
    if (e.status === 429) headers["retry-after"] = String(e.retryAfterSeconds);
    return json({ error: { code: e.code, message: e.message } }, { status: e.status, headers });
  }

  const base = siteUrl(url.origin);
  return json(
    {
      id: result.id,
      url: `${base}/${result.id}`,
      raw_url: `${base}/raw/${result.id}`,
      expires_at: result.expiresAt,
    },
    { status: 201 },
  );
};
