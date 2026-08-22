/**
 * 8-character base62 IDs generated from a CSPRNG (docs/api.md § Paste IDs).
 */
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Rejection threshold to avoid modulo bias: 62 * 4 = 248 divides 256 evenly. */
const BIAS_LIMIT = 248;

export function newPasteId(length = 8): string {
  let id = "";
  while (id.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < BIAS_LIMIT) {
        id += ALPHABET[byte % ALPHABET.length];
        if (id.length === length) break;
      }
    }
  }
  return id;
}
