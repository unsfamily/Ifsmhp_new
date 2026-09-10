# Admin Events

The admin list, create form, and view/edit routes use live event APIs. The public
Events UI remains separate. Existing public API response shapes are retained;
drafts, cancelled events, invite-only detail, and deleted records are not public.

## Deployment

Run from `backend` after installing dependencies:

```sh
npm run db:deploy
npm run db:generate
npm run db:backfill-events
npm run build
```

The migration adds nullable draft dates, UTC event timestamps, scheduling and
reminder fields, soft deletion, and the event outbox. Backfill normalizes legacy
timezone labels and derives UTC timestamps without resetting any records.
Existing events default to reminders off so deployment cannot email old attendees.
Run the backfill before restarting the API; it can be repeated safely.

## API

All admin endpoints require an authenticated ADMIN and use the existing envelopes.

| Endpoint | Behavior |
| --- | --- |
| `GET /admin/events?tab=upcoming&q=&page=1&limit=10` | Items, pagination, global tab/KPI counts, next event |
| `POST /admin/events` | Create a draft, published event, or scheduled draft |
| `GET /admin/events/:id` | Full editable fields, cover metadata, delivery counts/failures |
| `PATCH /admin/events/:id` | Merge supplied fields, validate, update relations transactionally |
| `POST /admin/events/:id/publish` | Validate completeness, publish, clear schedule |
| `POST /admin/events/:id/cancel` | `{ reason, emailAttendees }`; cancel, unfeature, stop reminders |
| `DELETE /admin/events/:id` | Soft delete and cancel outstanding work |

Validation is shared by browser and backend in `backend/domain/event-input.ts`.
Drafts require a 6-140 character title. Supplied values must be valid, but other
required fields can be completed later. Publishing/scheduling requires the full
form. Capacity null means unlimited; zero means zero places. Tags are deduplicated
and limited to five. Speakers retain their order. Existing custom tags survive edits.
Dates use `YYYY-MM-DD`, times use `HH:mm`, and schedule values use
`YYYY-MM-DDTHH:mm` in the event's selected timezone. Luxon rejects invalid dates,
nonexistent daylight-saving times, and ambiguous clock-change times.

Save Draft explicitly clears publication and scheduling. Save Changes follows the
publishing controls. View is read-only. Upcoming excludes drafts and ended events;
Past & Cancelled contains ended/cancelled events; Drafts includes scheduled drafts.
RSVP counts include registrations with status `Registered`, excluding waitlists.
Cover uploads use private authenticated file storage. The event service checks
image type and ownership when attaching a new file reference.

## Worker and Email

The API starts the event worker once at startup and every minute. Jobs and their
claims persist in MySQL. Multiple API instances use atomic claims and event row
locks. Claims older than five minutes are recoverable. Shutdown awaits active work.
Pending reminders are reconciled on edits and on worker ticks, including newly
registered attendees. A scheduled event missed during downtime is published on
restart only if it has not ended; otherwise the job records a failure.

Reminder timing is 7/3/1 local calendar days before start, or three hours before
start for "same day". Recipients come from registered attendee email addresses,
falling back to linked users. Addresses are deduplicated. Cancellation emails are
optional and contain the recorded cancellation reason. No newsletter or refund
processing is performed.

Configure the existing `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and
`MAIL_FROM` variables. Without SMTP, event jobs are `UNCONFIGURED`, never falsely
reported as sent; they retry every minute. SMTP failures retry after 1, 5, 15, and
60 minutes, then become `FAILED` on the fifth failure. Inspect delivery counts and
failures on the admin detail page and `Event job failed` logs for diagnostics.
Successful jobs are deduplicated. As with SMTP outboxes generally, a process crash
after SMTP accepts a message but before the database commit can result in a retry
and duplicate delivery; SMTP does not provide an exactly-once transaction.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

`tests/events.test.ts` uses namespaced MySQL fixtures and mocked email transport.
`tests/events.browser.cjs` exercises the live UI with disposable admin/event/file
fixtures and cleans them up. It expects API port 5002 and frontend port 5174 by
default; override `EVENTS_API_URL` / `EVENTS_WEB_URL` as needed. Point
`PLAYWRIGHT_MODULE_PATH` at an installed Playwright package and optionally set
`CHROME_PATH`. Screenshots default to `/private/tmp/events-browser`.
Do not run browser fixtures against an API configured to send real email.
