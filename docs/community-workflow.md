# Community workflow

The routed `/admin/community/*` and `/dashboard/community` pages use the dedicated Community domain. The earlier `/members/me/community` interest-group, connection, discussion, and direct-message APIs retain their original tables and contracts. The unused localStorage Community store and its unrouted admin screen have been removed.

## Database and deployment

Apply `20260921000000_community_workflow` before starting the updated API:

```sh
npm run db:generate
npm --prefix backend run db:deploy
npm run build
```

The migration adds Community tables and `FileObject.communityManaged`; it does not rewrite legacy data. A newly created community receives a General conversation and an administrator membership in the same transaction. Existing databases start with no new communities; create them in Admin → Community. Do not run the development seed as a deployment step.

Community deletion is terminal soft deletion. Message deletion retains only a tombstone in API responses. The underlying records and audit history are retained for administration; no undelete operation is exposed. Slugs remain reserved after deletion.

## Access rules

| Actor | Read | Write |
| --- | --- | --- |
| Active platform administrator | All nondeleted communities and moderation records | Community lifecycle, roles, memberships, messages, reports |
| Active assigned moderator | Assigned active communities; management views scoped on every request | Ordinary-member decisions, conversation locks, content/report moderation; no role or community lifecycle changes |
| Active member | Active community discovery; chats and directory only with active community membership | Join/request/cancel/leave, send/reply, edit/delete own accessible messages, report |
| Applicant, inactive account, anonymous caller | No Community access | None |

`PUBLIC` means discoverable to authenticated members and immediately joinable. `PRIVATE` means discoverable metadata with approval required for contents. `ACTIVE` publishes a community, `INACTIVE` unpublishes it, and `ARCHIVED` disables member access. Only administrators can restore inactive/archived communities. Moderators cannot act on administrators, themselves, or other moderators. Rejected/suspended/blocked memberships cannot self-reset; removed members may rejoin.

Hidden messages are omitted from member lists and quoted replies. Deleted-message text and files are absent from all DTOs, including report previews. Locked conversations reject sends/replies; members can still delete their own messages. Community file access is checked before ordinary uploader/public file permissions, including revoked memberships and hidden/deleted content. Images use discovery access; message files require contextual content access. Responses for Community files are private/no-store.

## API contracts

All endpoints are under `/api/v1`, use the existing authentication/session middleware, success/failure envelopes, and field-level validation errors. Lists return `{ items, pagination: { page, limit, total, pages } }`, with limits of 1–100 and stable ID tie-breakers. The frontend types in `frontend/src/types/community.ts` match response names.

- `/admin/community/dashboard`: live counts, newest communities, pending memberships, conversations, and reports needing review.
- `/admin/community/communities`: list/create, `/:id` details/edit/delete, `/:id/status` lifecycle. Search, category, visibility, status and allowlisted sort filters.
- `/admin/community/members`: list, `/:id` details/removal, `/:id/status`, `/:id/role`. Membership IDs differ from user IDs. Email/activity are returned only to managers.
- `/admin/community/conversations`: list; `/:id` locks; `/:id/messages` list/send. `/admin/community/messages/:id` supports pin/hide/read updates and deletion. Read state belongs to the individual viewer; polling does not mark messages read.
- `/admin/community/reports`: list/details/update and `/:id/actions`. Supports status, community, reason/reporter/subject search, and `dateFrom` (inclusive UTC day). Review assigns the acting manager. Resolution/dismissal and moderation actions record notes and history transactionally; warnings create in-app notifications.
- `/community/communities`: list, `/mine`, `/:id`, `/:id/join`, `/:id/join-request`, `/:id/membership`, `/:id/members`, `/:id/conversations`.
- `/community/conversations/:id/messages`: list/send. Newest message page is returned in chronological order; subsequent pages contain older history.
- `/community/messages/:id`: own edit/delete; `/:id/report` and `/community/members/:id/report`: report submission. Open duplicate reports by the same reporter/target are idempotent.
- `/community/capabilities`: administrator flag, moderation capability and assigned community IDs. This is a frontend affordance; backend object checks remain authoritative.
- `/community/upload-policy`: configured limits and accepted types. `/community/options` and `/admin/community/options`: categories and community choices independent of the visible result page.

### Reporting and moderation

Message reports identify the message author even when the author is an administrator without a community membership. Such reports leave `reportedMemberId` absent and derive `reportedMemberName` from the sender; they do not create artificial memberships. Accessible historical messages remain reportable after their authors leave. Direct member reports require a currently visible directory membership. Self-reporting is rejected.

Report list/detail/dashboard responses include `availableActions`, using the existing action names. The server computes these from the viewer's permissions and current target state and rechecks the same rules inside the mutation transaction. Member-only reports cannot hide/restore content; removed or protected membership targets cannot be disciplined. Visible messages offer hide, hidden messages offer restore, and deleted messages offer neither. The action modal retrieves fresh details before offering these choices and preserves notes if a stale action or network failure requires retrying.

Starting an already active review is idempotent: it preserves the reviewer and adds no duplicate history. Successful other actions retain existing assignment behavior. Content/member actions do not automatically resolve a report, and resolved/dismissed reports remain available for documented corrections. Reopening through the existing status API clears obsolete resolution notes; no additional reopen control is exposed. Warnings, target updates, report status, moderation history and audit records commit or roll back together.

Report details use authenticated attachment links. Deleted messages display a tombstone without text or attachments in both the table and drawer. These corrections use existing nullable database relations and require no additional migration or backfill.

Community text is plain text. Names/slugs/categories are bounded to 191 characters, descriptions/messages to 10,000, report reasons to 191, membership reasons to 2,000, and report notes to 5,000. Message text is required even with files.

Community images accept JPG/PNG/WebP up to 5 MB each. Messages accept up to five PDF, Word, spreadsheet, presentation, text/CSV or image files, bounded by `MAX_UPLOAD_MB` (default 25 MB). Extensions, MIME, signatures, nonempty bytes, and UTF-8 text are validated. Failed operations remove staged files; committed files use generated storage keys and the existing authenticated download route.

## Frontend refresh and errors

Active message/access queries refresh every eight seconds; lists, details and the dashboard every fifteen seconds. Focus, reconnect and successful mutations trigger revalidation. Hidden tabs pause periodic fetches. Requests are deduplicated per resource, and stale responses cannot update a different selection/user. The Community HTTP budget is separate from the unchanged limit on other APIs.

Existing table pagination remains. List containers load further pages as they enter view; chats open at the latest messages and load older pages on upward scroll. Loaded pages are revalidated so hidden/deleted content does not remain in older history. Polling preserves unsent input and scroll position. Authentication/not-found failures clear protected results, while network errors retain retryable data and drafts. No mock fallback is used for Community requests.

## Verification

Use a dedicated MySQL database; the project integration suite creates/deletes fixtures and expects a baseline administrator for membership-queue tests. Do not point the suite at production.

```sh
DATABASE_URL=mysql://USER:PASSWORD@HOST/ifsmhp_community_test npm --prefix backend run db:deploy
# Provision the baseline test administrator, then:
DATABASE_URL=mysql://USER:PASSWORD@HOST/ifsmhp_community_test NODE_ENV=test npm test
npm run typecheck
npm run lint
npm run build
```

`backend/tests/community-workflow.test.ts` covers lifecycle, authorization, scoped moderators, private requests, concurrency, pagination, validation, moderation, and file revocation. The legacy suites remain part of the full run.

`backend/tests/community.browser.cjs` uses real sessions and APIs with namespaced fixtures and cleanup. Start the API and frontend against the same dedicated database, then run it with `DATABASE_URL`, `COMMUNITY_API_URL`, `COMMUNITY_WEB_URL`, and an installed Playwright module (`PLAYWRIGHT_MODULE_PATH` if not locally installed). Set `CHROME_PATH` for a local Chrome binary. Optional `COMMUNITY_BASELINE_URL` compares the original frontend admin table and member panel geometry. Screenshots are written to `COMMUNITY_SCREENSHOT_DIR`, defaulting to `/private/tmp/ifsmhp-community-browser`. It does not send email.

Verified on 2026-09-21 against isolated MySQL: all 358 backend tests across 20 suites passed (including 31 Community integration tests); the browser workflow passed 17 checks with separate administrator, moderator, and member sessions. Browser checks include mobile navigation, baseline layout comparisons, private approval, image previews, authenticated attachments, moderation, role revocation, more than 100 messages, table filters/pagination, scroll/draft preservation, and simulated network failure recovery. The report/moderation checks additionally cover duplicate review starts, member-only actions, canceled drafts, closed-report corrections, stale selections/actions, attachment tombstones, transaction rollback, and unchanged moderation table/modal geometry. Typecheck and production build passed. Lint passed with three existing warnings in unrelated Gallery and Messages files.
