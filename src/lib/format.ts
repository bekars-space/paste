export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

/** Deterministic UTC rendering — avoids hydration locale mismatches. */
export function formatUtc(iso: string): string {
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}
