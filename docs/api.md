# API

Base URL: `https://paste.example.com` (replace with the deployed domain).
Every response body is UTF-8. Errors use a consistent JSON shape:

```json
{ "error": { "code": "rate_limited", "message": "Upload budget exceeded, retry after 1200s" } }
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Create-paste UI (HTML) |
| `POST` | `/api/pastes` | Programmatic create (curl / scripts) |
| `GET` | `/{id}` | View paste — content-negotiated ([ADR 0004](adr/0004-content-negotiation-plus-raw-endpoint.md)) |
| `GET` | `/raw/{id}` | Forced raw text, regardless of `Accept` |
| `POST` | `/api/cron/purge` | Delete expired rows + objects (cron only) |

The web UI's create form posts through a SvelteKit form action on `/`
(progressive enhancement); it uses the same validation and rate-limit path as
the API endpoint.

---

## `POST /api/pastes`

Create a paste from a raw request body.

**Request**

- Body: raw text (`text/plain`). The body is treated as opaque bytes-in/UTF-8-out;
  no parsing of form fields.
- Query parameter (optional): `ttl` — one of `1d`, `7d` *(default)*, `30d`, `90d`, `365d`.

```sh
# paste from stdin
echo 'hello world' | curl --data-binary @- https://paste.example.com/api/pastes

# paste a file, expiring in 30 days
curl --data-binary @notes.txt 'https://paste.example.com/api/pastes?ttl=30d'
```

**Response `201 Created`**

```json
{
  "id": "kX9mQ2pL",
  "url": "https://paste.example.com/kX9mQ2pL",
  "raw_url": "https://paste.example.com/raw/kX9mQ2pL",
  "expires_at": "2026-08-29T12:00:00Z"
}
```

**Errors**

| Status | Code | When |
| --- | --- | --- |
| `400` | `invalid_ttl` | Unknown `ttl` value |
| `400` | `empty_body` | Zero-byte body |
| `413` | `too_large` | Body exceeds `PASTE_MAX_BYTES` (5 MiB) — rejected *before* rate budget is consumed |
| `429` | `rate_limited` | IP byte budget exhausted; includes `Retry-After` header |

---

## `GET /{id}`

Content negotiation decides the representation:

| Client `Accept` header | Response |
| --- | --- |
| Contains `text/html` (every browser sends this) | HTML viewer page |
| Anything else (`*/*`, `text/plain`, … e.g. curl) | Raw paste body, `Content-Type: text/plain; charset=utf-8` |

```sh
curl -s https://paste.example.com/kX9mQ2pL          # → raw text
paste.example.com/kX9mQ2pL                          # opened in a browser → HTML
```

The rule is deliberately simple: **HTML only when the client explicitly asks
for `text/html`**. This makes terminal behaviour predictable without
user-agent sniffing.

HTML responses render metadata (created at, size, expiry) plus the paste body
inside `<pre><code>` with client-side syntax highlighting; see
[Security § XSS](security.md#xss-and-safe-rendering).

## `GET /raw/{id}`

Always returns the exact bytes of the paste:

```
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
X-Content-Type-Options: nosniff
Cache-Control: private, max-age=60
ETag: "<sha256-of-body>"
```

Use this when you want raw output even inside tools that send browser-like
`Accept` headers, or to embed links in docs where readers may click from an app
that renders HTML.

## Status codes (all routes)

| Status | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Paste created |
| `303` | Redirect after successful form-action create (web UI → `/{id}`) |
| `400` | Malformed input |
| `404` | Unknown ID **or** expired paste — indistinguishable by design |
| `413` | Payload too large |
| `429` | Rate limited (see [Rate limiting](rate-limiting.md)) |
| `500` | Unexpected failure (no details leaked) |

## Paste IDs

- Format: `^[A-Za-z0-9]{8}$` (base62).
- Generated server-side with a CSPRNG; collisions retried up to 5×.
- URLs are case-sensitive; the ID is effectively the read password.
