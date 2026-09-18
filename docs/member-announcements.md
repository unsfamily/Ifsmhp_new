# Member announcements

## Rollout

From `backend`, run `npm run db:deploy`, `npm run db:generate`, and `npm run build`, then restart the API. Migration `20260918000000_member_announcements` is additive; do not reset or reseed the database.

The migration adds nullable announcement expiry/deletion timestamps and a direct notification-to-announcement relationship with unique `(userId, announcementId)` identity. Existing linked notifications are backfilled; historical duplicate rows are retained, but only one is used for member read state. Legacy announcements receive no fabricated deliveries or notifications. An explicit read/unread interaction creates their notification state when necessary.

## Member APIs

All paths are below `/api/v1`; existing success/error envelopes and authentication apply.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/members/me/announcements` | Paginated list; `q`, `status=All\|READ\|UNREAD`, `page`, `limit`; includes independent unread count. |
| GET | `/members/me/announcements/:id` | Authorized full content, sender, publication/expiry dates, read state. |
| POST | `/members/me/announcements/:id/read` | Idempotently mark read; preserve first successful delivery-read timestamp. |
| POST | `/members/me/announcements/:id/unread` | Mark unread without erasing historical engagement. |
| POST | `/notifications/:id/unread` | Current-user notification only; announcement lifecycle/visibility enforced. |

Existing notifications list/detail/read/read-all and Document Exchange announcement APIs use the same visibility policy. Announcement bodies are safe Markdown with raw HTML and unsafe links disabled. Lists show excerpts; details never expose recipient addresses, delivery failures, or administrative metadata.

Managed announcements require active membership, current audience eligibility, and a successful current-revision in-app broadcast delivery. An email failure does not hide successful in-app delivery. Drafts, future publication, preview/email-only delivery, deletion, expiration, and inaccessible audiences are excluded from counts and content. Inaccessible details/actions return 404. Legacy member-wide or explicitly targeted published content remains accessible; unknown legacy audiences require explicit targeting.

Read-all uses its existing server snapshot time, does not mark subsequently arriving notifications read, and leaves messaging/support behavior intact. Member views poll every 30 seconds while visible and refresh on tab return and local read changes. No WebSocket deployment is required.

## Admin lifecycle

Create/edit accept optional `expiresAt` in `YYYY-MM-DDTHH:mm`, interpreted in the existing IANA `timezone`. Blank means no expiry. Invalid/ambiguous local times and expiry at/before scheduled publication are rejected. Publication requires future expiry if supplied. Existing post-dispatch editing restrictions remain.

`POST /admin/announcements/:id/delete` requires `requestId`, `expectedRevision`, and `confirmed: true`. It soft-deletes and invalidates pending claims under the announcement lock, preserving audit/delivery history. Duplicate request IDs safely replay the result. Deleted content is removed from normal admin lists and member access. Already accepted email cannot be recalled.

The existing announcement worker runs at startup and every minute when `ANNOUNCEMENT_WORKER_ENABLED` is enabled. Expired schedules are suppressed without dispatch. Pending deliveries recheck expiry/deletion while holding the parent lock. Expired broadcasts cannot be retried or republished; create a new announcement instead. Deletion waits for a delivery already holding that lock, then stops subsequent delivery. No event-worker changes are required.

SMTP, SAB reviewers (`SAB_PREVIEW_EMAILS`), and unsubscribe configuration remain unchanged. Email acceptance is not proof of inbox delivery. Existing bounded retries and expired-claim recovery remain in place. SMTP cannot participate in a database transaction: a crash after SMTP acceptance but before database commit can still cause duplicate email on retry.

## Verification

Run `npm run test:exchange -- tests/announcements.test.ts tests/document-exchange.test.ts` for a dedicated temporary database when credentials allow database creation. This environment denies that permission; integration tests instead use namespaced fixtures, mocked mail, recipient-scoped worker execution, and cleanup. Never run global workers during fixture verification.

Regression commands from `backend`:

```sh
npm test -- tests/announcements.test.ts tests/document-exchange.test.ts tests/messaging.test.ts tests/support.test.ts tests/events.test.ts
npm run typecheck
npm run lint
npm run build
```

`tests/member-announcements.browser.cjs` verifies the real local APIs and UI using disposable accounts, an explicitly scoped worker, and no live email. Build the backend first and run the API without automatic workers. Configure `ANNOUNCEMENTS_API_URL`, `ANNOUNCEMENTS_WEB_URL`, `PLAYWRIGHT_MODULE_PATH`, and optionally `CHROME_PATH`. Defaults are API port 5005 and frontend port 5177. Screenshots are written to `/private/tmp/member-announcements-browser`.

Frontend `npm run typecheck`, `npm run lint`, and `npm run build` have pre-existing unused-import failures in `UploadProjectPage.tsx` (`Presentation`, `Badge`). That unrelated file is unchanged. `npx vite build` verifies bundling independently; the existing large-chunk warning remains.

### Verified locally

- 114 integration/regression tests passed: announcements 36, Document Exchange 11, messaging 33, support 11, events 23. Fourteen announcement cases were added; the existing worker test helper now uses the current time instead of fabricating future delivery timestamps.
- Backend type check, lint, and build passed. All changed frontend files pass lint; Vite production bundling passed. Full frontend checks remain blocked only by the unrelated errors above.
- Standalone Chrome verification passed for admin draft/save/publish/delete, member polling, notification and Document Exchange detail, read/unread persistence, first-read history, search, empty results, pagination, retry recovery, keyboard focus restoration, and deletion while a detail is open. Desktop/mobile screenshots were reviewed; no browser page errors or horizontal overflow were detected.
- The in-app browser connection failed with a tooling configuration error (`sandboxPolicy`), so standalone Playwright was used. Dedicated test-database creation was denied by MySQL; fixture isolation is not equivalent to a separate database.
- Local verification frontend: `http://127.0.0.1:5177`; API: `http://127.0.0.1:5005/api/v1`. This API runs without automatic delivery workers or SMTP. Use the normal backend server entry point with the documented worker configuration for automatic dispatch; do not enable global workers during fixture verification.
