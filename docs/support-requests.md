# Support Requests

## Deployment

Apply the additive migration before deploying code that reads support conversations:

```sh
npm --prefix backend run db:deploy
npm --prefix backend run db:generate
npm --prefix backend run db:backfill-support
```

The backfill is idempotent. It links each legacy request to one shared conversation,
preserves request timestamps and assignment labels, and leaves legacy responses in
`adminResponse`. It does not infer an administrator identity or a historical response
timestamp. Existing history notes default to private. No email is sent.

New requests create their conversation, participants, initial member message,
support types, history, audit entry and in-app notifications in one transaction.
Public replies from Support Requests or Messages update the same conversation and
request activity. Completed/rejected requests remain replyable without reopening.

## Access and Decisions

Member endpoints under `/api/v1/members/me/support` require an active member session
and scope every record to the requester. Admin endpoints under `/api/v1/admin/support`
require administrator authorization; assignment does not restrict other admins.

- Pending can enter review, approval or rejection.
- Under Review can enter approval or rejection.
- Approved can enter completion.
- Rejected and Completed cannot change status.

Review notes are private. Approval, rejection and completion responses are public
conversation messages. Review/rejection/completion require notes. Metadata and
decision calls accept `expectedUpdatedAt`; stale writes return 409, with no partial
history/message/notification changes. Private attachments are excluded from member
details, counts, previews, and downloads. Attachments use existing authenticated
file infrastructure and can be added through the shared Messages inbox.

## Verification

```sh
npm --prefix backend test -- tests/support.test.ts tests/messaging.test.ts
npm --prefix backend run typecheck
npm --prefix backend run lint
npm --prefix backend run build
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

`backend/tests/support.browser.cjs` exercises the real API in Chrome, creates isolated
fixtures, and removes them in `finally`. Run it after the backend build with both
servers running. It requires an installed Playwright module/browser:

```sh
PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/path/to/chrome \
  node backend/tests/support.browser.cjs
```

Optional variables: `SUPPORT_API_URL` (default `http://127.0.0.1:5002/api/v1`),
`SUPPORT_WEB_URL` (default `http://127.0.0.1:5174`) and `SUPPORT_SCREENSHOT_DIR`
(default `/private/tmp/support-browser`). Do not run browser fixtures concurrently
with integration suites sharing the same database. Neither suite sends email.

Letter generation and SAB escalation remain unavailable until their operational
workflows are defined. Polling uses 10 seconds for details and 30 seconds for lists,
pausing in hidden tabs; there is no new WebSocket service.
