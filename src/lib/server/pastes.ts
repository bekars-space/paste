import { PASTE_INLINE_THRESHOLD_BYTES, PASTE_MAX_BYTES } from "./env";
import { newPasteId } from "./ids";
import { DEFAULT_TTL, resolveTtl, TTL_CHOICES, ttlDays, type TtlChoice } from "$lib/ttl";
import { consumeRateBudget, hashIp } from "./rate-limit";
import { PASTES_BUCKET, supabase } from "./supabase";

export { DEFAULT_TTL, resolveTtl, TTL_CHOICES };
export type { TtlChoice };

function expiryFrom(ttl: TtlChoice): string {
  return new Date(Date.now() + ttlDays(ttl) * 86_400_000).toISOString();
}

// ── Create ──────────────────────────────────────────────────────────────────

export type CreateError =
  | { status: 400; code: "empty_body"; message: string }
  | { status: 400; code: "invalid_ttl"; message: string }
  | { status: 413; code: "too_large"; message: string }
  | { status: 429; code: "rate_limited"; retryAfterSeconds: number };

export type CreateResult =
  | { ok: true; id: string; sizeBytes: number; expiresAt: string }
  | { ok: false; error: CreateError };

const encoder = new TextEncoder();
const MAX_COLLISION_RETRIES = 5;

/**
 * Single validation + persistence path shared by POST /api/pastes and the web
 * form action. Order matters per docs/api.md: cheap input checks → 413 before
 * any budget is consumed → rate limit → insert.
 */
export async function createPaste(
  content: string,
  ttlParam: string | null,
  ip: string,
): Promise<CreateResult> {
  const sizeBytes = encoder.encode(content).length;

  if (sizeBytes === 0)
    return {
      ok: false,
      error: { status: 400, code: "empty_body", message: "Request body must not be empty." },
    };

  const ttl = resolveTtl(ttlParam);
  if (ttl === null) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "invalid_ttl",
        message: `Unknown ttl "${ttlParam}". Valid values: ${TTL_CHOICES.join(", ")}.`,
      },
    };
  }

  if (sizeBytes > PASTE_MAX_BYTES) {
    return {
      ok: false,
      error: {
        status: 413,
        code: "too_large",
        message: `Body exceeds ${PASTE_MAX_BYTES} bytes.`,
      },
    };
  }

  const budget = await consumeRateBudget(ip, sizeBytes);
  if (!budget.allowed) {
    return {
      ok: false,
      error: {
        status: 429,
        code: "rate_limited",
        retryAfterSeconds: budget.retryAfterSeconds,
      },
    };
  }

  const inline = sizeBytes <= PASTE_INLINE_THRESHOLD_BYTES;
  const expiresAt = expiryFrom(ttl);
  const ipHash = await hashIp(ip);

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const rowId = newPasteId();
    let storagePath: string | null = null;

    // Hybrid storage split (ADR 0005): ≤ threshold inline, else Storage
    // object keyed by the row id (docs/database.md § pastes).
    if (!inline) {
      const { error } = await supabase.storage.from(PASTES_BUCKET).upload(rowId, content, {
        contentType: "text/plain; charset=utf-8",
        upsert: false,
      });
      if (!error) {
        storagePath = rowId;
      } else if (!(error as { statusCode?: string }).statusCode?.startsWith("409")) {
        throw error;
      } else {
        continue; // path collision — astronomically rare, retry with fresh id
      }
    }

    const { error } = await supabase.from("pastes").insert({
      id: rowId,
      content: inline ? content : null,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      expires_at: expiresAt,
      ip_hash: ipHash,
    });

    if (!error) return { ok: true, id: rowId, sizeBytes, expiresAt };

    if (storagePath) await supabase.storage.from(PASTES_BUCKET).remove([storagePath]);

    if ((error as { code?: string }).code === "23505") continue;
    throw error;
  }

  throw new Error("Could not allocate a unique paste ID after 5 attempts");
}

// ── Read ────────────────────────────────────────────────────────────────────

export interface FetchedPaste {
  id: string;
  content: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
}

/** Returns null for unknown IDs *or* expired pastes — indistinguishable by design. */
export async function getPaste(id: string): Promise<FetchedPaste | null> {
  const { data, error } = await supabase
    .from("pastes")
    .select("id, content, storage_path, size_bytes, created_at, expires_at")
    .eq("id", id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let content: string;
  if (data.content !== null) {
    content = data.content;
  } else if (data.storage_path) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from(PASTES_BUCKET)
      .download(data.storage_path);
    if (downloadError || !blob) return null; // object lost → treat as gone
    content = await blob.text();
  } else {
    return null; // XOR constraint makes this unreachable
  }

  return {
    id: data.id,
    content,
    sizeBytes: Number(data.size_bytes),
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

// ── Purge (cron) ────────────────────────────────────────────────────────────

export async function purgeExpired(): Promise<{ pastes: number; objects: number }> {
  const staleBefore = new Date(Date.now() - 86_400_000).toISOString();

  const { data: deleted, error } = await supabase
    .from("pastes")
    .delete()
    .lte("expires_at", new Date().toISOString())
    .select("storage_path");

  if (error) throw error;

  const paths = deleted.map((row) => row.storage_path).filter((p): p is string => p !== null);
  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(PASTES_BUCKET).remove(paths);
    if (removeError) throw removeError;
  }

  const { error: staleError } = await supabase
    .from("rate_limits")
    .delete()
    .lt("window_start", staleBefore);
  if (staleError) throw staleError;

  return { pastes: deleted.length, objects: paths.length };
}
