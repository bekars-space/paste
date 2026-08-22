import { createClient } from "@supabase/supabase-js";
import type { Database } from "$lib/types/database";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

/**
 * Service-role client: bypasses RLS. Must only ever be reached from
 * $lib/server — the directory boundary makes accidental client imports a
 * compile-time error.
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export const PASTES_BUCKET = "pastes";
