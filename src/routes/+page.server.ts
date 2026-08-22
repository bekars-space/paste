import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { PASTE_MAX_BYTES } from "$lib/server/env";
import { createPaste } from "$lib/server/pastes";
import { clientIp } from "$lib/server/rate-limit";

/**
 * Web UI create path — same validation + rate-limit core as the API
 * endpoint (docs/api.md). Progressive enhancement: works without JS.
 */
export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const content = String(form.get("content") ?? "");
    const ttlField = form.get("ttl");

    const result = await createPaste(
      content,
      typeof ttlField === "string" ? ttlField : null,
      clientIp(request.headers),
    );

    if (!result.ok) {
      const e = result.error;
      const message =
        e.code === "rate_limited"
          ? `Upload budget exhausted — try again in about ${Math.ceil(e.retryAfterSeconds / 60)} minutes.`
          : e.code === "too_large"
            ? `Pastes are limited to ${Math.floor(PASTE_MAX_BYTES / 1024 / 1024)} MiB.`
            : e.message;
      return fail(e.status, { message });
    }

    redirect(303, `/${result.id}`);
  },
};
