import type { RequestHandler } from "./$types";
import { fetchRaw } from "$lib/server/raw";

/** Forced raw output regardless of Accept header. */
export const GET: RequestHandler = async ({ params, request }) =>
  fetchRaw(params.id, request.headers);
