# Public Events

The public Events page reads the same records maintained by Admin Events. No new
database tables, migrations, seeds, registration workflow, or mail jobs are added.
Existing admin editing, publication scheduling, and soft deletion remain unchanged.

## API

All endpoints use the existing `/api/v1` prefix and success/error envelopes.

| Endpoint | Behavior |
| --- | --- |
| `GET /public/events` | Paginated `{ items, pagination }`; `tab=all/upcoming/past`, optional `date=YYYY-MM-DD`, title search `q`, `page`, and `limit` (1-100). Defaults remain all events, page 1, limit 20. Out-of-range pages clamp to the final page. |
| `GET /public/events/calendar?month=YYYY-MM` | `{ month, days: [{ date, count, major }] }`; covers the entire requested month independently of list pages. Featured events and Symposium tags mark major events. |
| `GET /public/events/:slugOrId` | `{ event }` with public full descriptions, organizer contact, speakers, safe resource links, registration link, and cover reference. Both slug and database ID resolve; public payload IDs remain slugs. |
| `GET /public/events/:slugOrId/cover` | Inline JPEG, PNG, or WebP bytes for the currently attached cover, subject to the same event visibility checks. Missing/deleted/non-image files return 404. |

Public visibility requires `PUBLISHED` or `PAST`, audience `Public` or `All Members`,
and no soft deletion. Drafts, unpublished schedules, cancellations, and `CRO Invite`
events return 404 from detail/cover and never appear in lists or calendar markers.
Public JSON and cover responses use `Cache-Control: no-store` so browser caching
does not retain a previous publication decision. Generic authenticated file access
is not widened; publishing the parent event grants access only through its cover route.

Upcoming includes published events whose UTC end timestamp has not elapsed. Past
includes explicit past records and published events at/after their end timestamp.
Legacy records lacking UTC timestamps are interpreted in their configured event
timezone before pagination. Calendar and card dates use the stored event-local
calendar date, not the visitor's timezone. Cards explicitly show the event timezone.

Only public fields are serialized. Registration records, attendee identities,
creator IDs, worker state, storage paths, and private file identifiers are excluded.
Attendance counts include only `Registered` records. Null capacity means unlimited;
zero remains zero. No feedback scores or key takeaways are synthesized.

Resource kinds `recording`/`video` enable Recordings; `proceedings`/`slides`/`document`/
`pdf` enable Proceedings. Generic resources remain visible in details. Only safe
HTTP(S) links without embedded credentials are navigable. File-only resources are
unavailable because there is no authorized public resource-file delivery route.
The `recordingProvided` promise alone never enables a recording link.

## Frontend

The original hero, sections, date strips, cards, sidebar order, and responsive
breakpoints are retained. Upcoming and archive pagination use four and two cards
respectively to match the original populated layout. Each view polls every 30 seconds
while visible, preserving selected date, month, page, and open details.

Event titles open a native accessible dialog containing an uncropped cover and full
details. Escape/Close restore focus. A failed detail refresh removes stale event
content; failed covers show an unavailable state. Each list/calendar can be retried
independently. Calendar day selection filters both lists; month navigation clears it.

Register opens the organizer's external URL in a new tab only when registration is
required and the URL is safe. Otherwise its disabled label distinguishes unavailable
registration from no registration required. Feedback remains explicitly disabled.
No RSVP, payment, native waitlist, resource upload, or feedback submission is implied.

## Verification

From `backend/`:

```sh
npm run typecheck
npm run lint
npm run build
npm test -- tests/public-events.test.ts tests/events.test.ts --silent
```

For a dedicated disposable database, provide `TEST_DATABASE_ADMIN_URL` with create/
drop-database permission and run the existing isolated runner:

```sh
npm run test:exchange -- tests/public-events.test.ts tests/events.test.ts
```

Without those privileges, the tests use namespaced fixture IDs and remove only their
own records/files. Email is mocked and worker calls are scoped to fixture event IDs.
This fallback is not full database isolation; unrelated preexisting records can affect
global assertions in older suites. Do not run against production data.

Browser scripts are `backend/tests/events.browser.cjs` (existing admin regression)
and `backend/tests/public-events.browser.cjs` (public/admin integration). Build the
backend first, run Vite with the matching API base URL, and use a verification API
created with `createApp()` rather than starting automatic workers. Disable SMTP.

```sh
EVENTS_API_URL=http://127.0.0.1:5004/api/v1 \
EVENTS_WEB_URL=http://127.0.0.1:5176 \
node tests/public-events.browser.cjs
```

`PLAYWRIGHT_MODULE_PATH` and `CHROME_PATH` optionally select an existing Playwright
installation and Chrome executable. `EVENTS_SCREENSHOT_DIR` changes the output
directory (default `/private/tmp/public-events-browser`). The scripts use temporary
accounts and events, never click external registration/resource destinations, and
clean fixtures in `finally`. Run the browser scripts sequentially.

Frontend `npm run typecheck`, `npm run lint`, and `npm run build` currently report
the preexisting unused `Presentation`/`Badge` imports in `UploadProjectPage.tsx`.
That file is intentionally untouched. `npx vite build` independently checks bundling.
