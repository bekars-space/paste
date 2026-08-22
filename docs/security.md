# Security

## Threat model

`paste` is a public, anonymous, unmoderated content host. The design accepts
that abuse *will* happen and aims to make it boring, bounded, and cheap:

| Threat | Control |
| --- | --- |
| Storage/DB flooding | Byte-budget rate limiting ([rate-limiting.md](rate-limiting.md)) + 5 MiB cap + TTL expiry |
| Hosting malware/phishing | Short TTLs (default 7d), no custom URLs, IDs double as capability secrets; takedown = delete by ID |
| Enumeration of pastes | ~48-bit random base62 IDs; expired ≡ never-existed (`404` both ways) |
| XSS via paste content | Auto-escaping + strict CSP + forced `text/plain` on raw paths (below) |
| Content-type confusion / sniffing | `X-Content-Type-Options: nosniff`, explicit charset everywhere |
| IP harvesting / privacy | Raw IPs never stored — only HMAC hashes |
| Key leakage | Service-role key server-only via `$lib/server` import boundary |

Out of scope for v1 (documented future work): report-abuse endpoint,
optional private/unlisted pastes with separate read keys.

## XSS and safe rendering

Paste content is arbitrary user input and must never be trusted:

- **Svelte auto-escapes** all interpolated content. `{@html …}` is banned for
  paste-derived data — enforced in review, plus an oxlint rule where available.
- The viewer renders the body as plain text inside `<pre><code>`. Syntax
  highlighting (client-side) must operate on the escaped text node — highlighters
  that build DOM from tokens are safe; anything that sets `innerHTML` from raw
  paste text is not.
- No markdown/HTML rendering of pastes is planned. If ever added, it must use a
  sanitiser allowlist (e.g. DOMPurify) with a locked-down tag profile.

### Content Security Policy

Baseline CSP for HTML responses (set in `src/hooks.server.ts`):

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'none'
```

Notes: `connect-src 'self'` because the browser talks **only** to our API —
Supabase is never called client-side. `'unsafe-inline'` styles are tolerated for
highlighting themes; if highlighting ships without inline styles, drop it.
Companion headers on every response:

```
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Raw endpoints

`/[id]` (negotiated) and `/raw/[id]` always respond with
`Content-Type: text/plain; charset=utf-8` + `nosniff`. Browsers therefore
display, rather than execute, any bytes served from these routes — a pasted
HTML file can never run in the origin.

## Secrets handling

| Secret | Scope | Rule |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Bypasses RLS — the most powerful credential in the system. Only imported inside `$lib/server/**`. |
| `SUPABASE_URL` | Server | Not sensitive alone, but kept server-side since no client-side Supabase calls exist. |
| `RATE_LIMIT_SECRET` | Server | HMAC key for IP hashing. ≥ 32 random bytes (`openssl rand -hex 32`). Rotating it resets all rate windows and orphans old hashes — acceptable. |
| `CRON_SECRET` | Server | Shared secret for `/api/cron/purge`; compared with constant-time equality. |

Enforcement mechanisms:

1. SvelteKit's `$lib/server` boundary makes client imports of these modules a
   build error.
2. Variables **without** the `PUBLIC_` prefix are stripped from client bundles;
   nothing here uses that prefix.
3. `.env*` files are gitignored; [.env.example](../.env.example) documents shape only.

Rotation: replace the value in Vercel env settings → redeploy. For the service
role key, rotate in Supabase dashboard first, deploy, then revoke the old key.

## Privacy

- Client IPs exist transiently to compute the HMAC hash, then are discarded.
  They appear in no database column, log line, or analytics event.
- Stored `ip_hash` values are pseudonymous identifiers usable solely for
  window-scoped rate accounting — they cannot identify a person without the
  (secret) HMAC key, and are purged with stale rate rows by the cron job.
- Pastes store no author metadata whatsoever; there is deliberately nothing to
  subpoena beyond content already known to whoever holds the URL.
- Transport security is inherited from Vercel (TLS terminated at the edge,
  HSTS header above). Supabase traffic runs over HTTPS from function to DB.

## Capability URLs

Possession of `/{id}` equals read access (there is no ACL layer). This is an
accepted property of anonymous pastebins — mitigations in place:

- IDs are unguessable (~48 bits CSPRNG entropy).
- Expiry bounds the exposure window per paste.
- `Cache-Control: private` prevents shared caches from serving pastes across users.
- Future escape hatch if needed: "secret" pastes requiring a second key part
  (`/{id}#{key}`), decrypting payloads server-side — designed but deferred.

## Reporting & response

v1 has no automated reporting UI. Operational takedown is manual: delete the
row (+ storage object) by ID through the Supabase dashboard or a one-off
script. A `report@` contact link and an admin deletion path are tracked as
future work.
