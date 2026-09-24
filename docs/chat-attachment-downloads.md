# CRO chat attachment downloads

## Root cause and behavior

The admin inbox, admin conversation detail and member CRO Messages page wired filename chips to `openAttachmentInTab`, not `downloadAttachment`. Opening a tab only after awaiting an authenticated request was also susceptible to popup blocking. JSON error envelopes returned as blobs obscured useful error messages; downloads revoked their object URLs immediately.

The earlier read-only local storage check found six referenced CRO files, all readable with sizes matching their database metadata. No storage migration or historical attachment rewrite was needed.

Filename chips now start downloads using the original filename and extension. A separate Preview button opens PDF, JPEG, PNG and WebP inside the existing modal, with its own Download action. DOC/DOCX, XLSX, PPT/PPTX, TXT and CSV download directly. Browser settings determine the destination and save prompt; the application cannot select a folder or confirm that a user finished saving.

## Implementation and security

- The three CRO views share `ChatAttachment`, including per-attachment loading states, duplicate-click protection, errors and Retry. Support conversation bubbles and the Document Exchange conversation view use the same controls. Composer drafts are independent of transfer failures.
- Shared helpers keep their existing call signatures, add optional cancellation and a 120-second timeout, decode bounded JSON blob errors, reject empty responses, and delay download URL revocation for 60 seconds. Non-chat popup callers open their tab before awaiting bytes and close it on failure.
- Preview URLs are released on close, replacement and session changes. Transfers are aborted and late responses ignored after logout/account changes, including cross-tab token changes. Access-token refresh within the same session does not cancel a transfer. Tokens stay in Authorization headers.
- The existing generic route validates attachment/action query parameters, checks explicit context before general grants, and denies PUBLIC/uploader bypasses for chat-linked files. Active stored-session administrators retain global CRO review access; members require non-internal conversation participation. Independent non-chat permissions and access to owned unattached uploads remain available.
- Files must have a live database row and resolve inside the configured upload root. The route opens a non-following, non-blocking descriptor, verifies a regular nonempty file and exact recorded size, then streams that descriptor. Missing/unreadable/unsafe files return safe 404 envelopes. An early read error returns JSON 404; a later stream error terminates the response rather than delivering an apparently successful empty file.
- Responses preserve original bytes and safe filename encoding, MIME and length, with private/no-store caching and nosniff. Browser multipart UTF-8 filenames are decoded before metadata persistence. MIME fallbacks now include WebP, XLSX, TXT and CSV; supported formats, existing size limits and content-validation policy are unchanged.
- Authorized available file access continues to produce `FileAccessGranted`/`CredentialAccessGranted` audit events. Contextual first-opening receipts remain idempotent and distinguish preview/download. Neither receipt nor audit claims completion of a local save.

See the [API contract](api.md#files). No schema changes, data reset or deployment were performed. Release frontend and API together.

## Verification and acceptance

Tests use isolated MySQL on port 3307 (`ifsmhp_settings_test`), `/private/tmp/ifsmhp-chat-test-uploads`, and disabled/stubbed SMTP. Integration tests create actual stored sessions; browser tests sign administrators in through password authentication and members through OTP verification with a delivered-code fixture.

| Acceptance | Evidence |
|---|---|
| Member → Admin and Admin → Member upload/send/reload/download | Integration format matrix and real browser composer uploads in both directions |
| All supported download formats | 24 transfer cases: 12 extensions × 2 directions; compare complete bytes, length, metadata, MIME and receipt idempotency |
| Original filenames and bytes | Unicode filename persistence plus browser suggestedFilename, byte count and SHA-256 checks |
| Preview stays in app and can download | Browser PDF/JPEG/PNG/WebP modal checks; unsupported DOCX preview absent |
| Permission boundaries | Anonymous/inactive/revoked sessions, unrelated member, internal note, PUBLIC flag, uploader, mismatched context, independent project access and deleted project |
| Unavailable files and streaming errors | Missing/deleted/empty/truncated/unreadable/directory/symlink/traversal cases and injected early read failure |
| Failure recovery | Browser unavailable-file and network failures retain composer drafts, display attachment errors and allow retry; no failed request starts a download |
| Session changes and duplicate clicks | Pending button disabled; delayed response discarded after session change |
| Shared consumers and existing messaging | Backend regression suites cover Support, Document Exchange, Publications, uploads, replies, internal notes and file references; shared helper call signatures preserved |
| Responsive presentation | Inspected desktop 1440×1000 and mobile 390×844 screenshots, no horizontal page overflow |

Fixtures and attribution are described in `backend/tests/fixtures/chat/README.md`; legacy PPT uses an actual Apache POI test presentation. Native Office application rendering is outside this download-only flow.

### Actual results

- Messaging integration: **69 passed**, including the original 33 messaging cases and 36 new transfer/security/storage cases.
- Browser: **8 scenarios passed**, with zero page errors. Screenshots and `results.json` are in `/private/tmp/ifsmhp-chat-browser` (`chat-admin-preview.png`, `chat-admin-inbox.png`, `chat-member-mobile-preview.png`, `chat-member-mobile.png`). The integrated browser connection failed during setup, so verification used local Chrome through the standalone runner.
- Final full backend regression: **605 passed in 24 suites**, with audit-contract checks enabled.
- Frontend/backend typechecks and production builds passed. Lint passed with two existing hook-dependency warnings at `AdminMessagesPage.tsx:101` and `MessagesPage.tsx:86`. The existing frontend bundle-size warning remains.
- Initial full regression: 602 passed and one Community evidence test failed while creating its parent message. A focused repeat failed later in that Community test's moderator-revocation assertion; the Community suite passed against the unchanged file route. The final complete regression run passed without changes to Community production or test code. These intermittent failures also occurred during the earlier timeline verification.

## Repeat verification

Use a migrated isolated MySQL database and isolated uploads. Set `DATABASE_URL`, `UPLOAD_STORAGE_PATH`, `NODE_ENV=test`, and disable SMTP. From `backend`:

```sh
npm test -- tests/messaging.test.ts
AUDIT_CAPTURE_CHECKS=1 npm test
npm run test:chat-attachments:browser
```

The browser runner requires the API/frontend using the same test database and a database name ending in `_test`. Defaults are API `http://127.0.0.1:5007/api/v1` and frontend `http://127.0.0.1:5179`; configure frontend `VITE_API_BASE_URL` accordingly. Override `CHAT_API_URL`, `CHAT_WEB_URL`, `CHAT_SCREENSHOT_DIR`, `PLAYWRIGHT_MODULE_PATH` and `CHROME_PATH` as needed. Accounts, conversation rows and uploaded files created by the browser runner are removed afterwards.

Run root `npm run typecheck`, `npm run build`, and `npm run lint`. No migration or reseeding is required.
