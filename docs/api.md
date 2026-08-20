# IFSMHP API Reference

Base path: `/api/v1`

All endpoints return the envelope defined in specification §40.

**Success**
```json
{ "success": true, "data": {}, "message": "Operation completed successfully" }
```

**Failure**
```json
{ "success": false, "message": "Useful error message", "errors": [], "requestId": "uuid" }
```

`errors` is an array of `{ field, message }`. `requestId` correlates the failure with a server log entry and is also returned on every response as the `X-Request-Id` header. Database errors, SQL, stack traces, filesystem paths and secrets are never returned.

**Status codes**

| Code | Meaning |
|---|---|
| 200 / 201 | Success |
| 400 | Malformed request |
| 401 | Not authenticated |
| 403 | Authenticated but not permitted |
| 404 | Not found — also returned for member-scoped records the caller does not own, so existence is not leaked |
| 409 | Conflict (duplicate) |
| 422 | Validation failed; see `errors` |
| 429 | Rate limited |
| 500 | Unexpected server error |

**Pagination** — every list endpoint accepts `?page=1&limit=20` (limit max 100) and returns `{ items, pagination: { page, limit, total, pages } }`.

---

## Implemented

### GET /health

Service health and readiness. Public, unauthenticated.

**Response 200**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "ifsmhp-api",
    "version": "0.1.0",
    "environment": "development",
    "uptimeSeconds": 42,
    "timestamp": "2026-01-01T00:00:00.000Z"
  },
  "message": "Service is healthy"
}
```

**Errors** — none. Returns 404 through the standard handler if the route is mistyped.

---

## Planned

The full module map is in `docs/architecture.md` §G. Each module is specified here — method, path, role, purpose, request, response, errors — **before** it is implemented, per specification §39.

| Module | Milestone |
|---|---|
| `/auth` | 5 |
| `/membership` | 6 |
| `/public`, `/contact` | 7 |
| `/members` | 8 |
| `/projects`, `/files` | 9 |
| `/support-requests` | 10 |
| `/messages` | 11 |
| `/publications` | 12 |
| `/admin` | 13 |
| `/events` | 14 |
| `/notifications` | 15 |
