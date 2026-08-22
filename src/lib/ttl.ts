/** Client-safe TTL vocabulary shared by server logic and the create form. */

const TTL_DAYS = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365 } as const;

export type TtlChoice = keyof typeof TTL_DAYS;
export const DEFAULT_TTL: TtlChoice = "7d";
export const TTL_CHOICES = Object.keys(TTL_DAYS) as TtlChoice[];

export function ttlDays(ttl: TtlChoice): number {
  return TTL_DAYS[ttl];
}

/** Missing/blank → default; unknown value → null. */
export function resolveTtl(value: string | null | undefined): TtlChoice | null {
  if (value === undefined || value === null || value === "") return DEFAULT_TTL;
  return value in TTL_DAYS ? (value as TtlChoice) : null;
}
