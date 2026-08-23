import type { LayoutServerLoad } from "./$types";
import { siteUrl } from "$lib/server/env";

/**
 * Footer example command — rendered with the canonical host (PUBLIC_SITE_URL
 * when set) or the request origin, matching the URLs returned by
 * POST /api/pastes.
 */
export const load: LayoutServerLoad = ({ url }) => ({
  createCommand: `echo hi | curl --data-binary @- ${siteUrl(url.origin)}/api/pastes`,
});
