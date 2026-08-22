import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { CRON_SECRET } from "$lib/server/env";
import { purgeExpired } from "$lib/server/pastes";

/**
 * Hourly cleanup invoked by Vercel Cron (vercel.json), which authenticates
 * with `Authorization: Bearer $CRON_SECRET`.
 */
export const POST: RequestHandler = async ({ request }) => {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return json(
      { error: { code: "unauthorized", message: "Missing or invalid bearer token." } },
      { status: 401 },
    );
  }

  const purged = await purgeExpired();
  return json({ purged });
};
