import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { CRON_SECRET } from "$lib/server/env";
import { purgeExpired } from "$lib/server/pastes";

/**
 * Hourly cleanup invoked by Vercel Cron (vercel.json). Vercel fires this as
 * a GET request authenticated via `Authorization: Bearer $CRON_SECRET`; POST
 * is kept for manual triggering.
 */
const purge: RequestHandler = async ({ request }) => {
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

export const GET = purge;
export const POST = purge;
