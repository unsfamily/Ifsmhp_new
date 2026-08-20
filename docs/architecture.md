# IFSMHP Platform — Milestone 1: Requirements Analysis & Architecture

**Document status:** Draft for approval
**Repository state at time of writing:** No existing repository found. Greenfield build. §59 (inspect-before-change) does not apply to Milestone 1 but becomes binding from Milestone 2 onward.
**Scope of this document:** Sections A–K of the required first task. Section L is delivered separately as `docs/requirements-traceability.md`.

---

## A. Product Understanding

### A.1 What IFSMHP is

The International Forum of Scientists and Mental Health Professionals is a professional membership body. The platform is not a content site with a login bolted on — it is a **gated professional workflow system** wrapped in an institutional public face. Nearly every meaningful action a member takes (joining, publishing, receiving support) requires review and approval by the Chief Research Officer. That review gate is the spine of the product; almost every model, endpoint and screen exists to feed it, act on it, or display its outcome.

### A.2 The three surfaces

| Surface | Audience | Purpose | Auth |
|---|---|---|---|
| **Public institutional site** | Anyone | Credibility, recruitment, dissemination of approved research | None |
| **Member workspace** (`/dashboard`) | Approved members | Do the work: projects, support requests, publications, communication | Required, role `MEMBER`, status `ACTIVE` |
| **Admin back office** (`/admin`) | CRO / administrators | Review and decide: applications, projects, support, publications, events | Required, role `ADMIN` |

### A.3 The core value loop

```
Apply  →  CRO reviews credentials  →  Approved + Member ID issued
   →  Member creates research projects
   →  Member requests moral / official / funding support against a project
   →  CRO reviews and responds; documents and messages flow both ways
   →  Member submits a publication
   →  CRO reviews → approves → publishes
   →  Publication becomes publicly readable, attributed to the member and their Member ID
   →  Public visibility increases the member's academic standing → attracts new applicants
```

Every stage produces notifications, audit records and status history. The loop is what makes membership worth paying attention to, so the reliability of the review pipeline matters more than the polish of any single page.

### A.4 What makes this system non-trivial

Five things drive most of the engineering risk, and they should be treated as first-class concerns rather than incidental features:

1. **Object-level authorization.** Almost all data is member-scoped and private. Role checks alone are insufficient — every read and write must answer "does *this* user own or participate in *this* record?" This is the single most likely source of a serious defect (see §I.1).
2. **Member ID generation.** A globally unique, immutable, never-reused, human-facing identifier generated concurrently under approval load. Needs a transactional strategy, not `count() + 1`.
3. **Public/private data separation.** One `MemberProfile` row contains public academic identity *and* private PII *and* credential documents. Serialization must be explicit and default-deny, not "return the row and hope."
4. **Document handling.** Uploaded credential documents and research files are sensitive. They must never be statically served, never be reachable by guessing a path, and never be trusted based on extension.
5. **State machines.** Four independent workflows with legal/illegal transitions. Enforcement must live in the service layer, not the UI.

### A.5 Deliberate non-goals for v1

Recorded so scope doesn't drift: no peer-review committee (single CRO reviewer), no payments/dues, no public commenting, no real-time websockets (messaging is request/response with polling), no microservices, no external calendar integration, no multi-language content.

---

## B. Actors & Permissions

### B.1 Actors

| Actor | Backing record | Notes |
|---|---|---|
| **Public visitor** | None | No `User` row is created (§34) |
| **Applicant** | `User` (status `PENDING`) + `MembershipApplication` | Can authenticate but sees only application status; cannot reach dashboard resources |
| **Member** | `User` (role `MEMBER`, status `ACTIVE`) + `MemberProfile` with `memberId` | The main workspace user |
| **Suspended member** | `User` (status `SUSPENDED` / `DEACTIVATED`) | Login blocked; content retained; publications may remain published (see §J) |
| **Admin / CRO** | `User` (role `ADMIN`) | Seeded, never self-registered |

> **Note on applicants.** The spec's workflow implies an account exists before approval (credentials submitted, then reviewed). We therefore create the `User` at registration with status `PENDING`, but treat "authenticated" and "authorized as member" as separate checks. A pending user hitting `/api/v1/projects` gets `403`, not `401`.

### B.2 Permission matrix

Legend: **✓** allowed · **✗** denied · **Own** own records only · **Part.** conversations they participate in · **Pub.** published/approved items only

| Resource / Action | Public | Applicant (PENDING) | Member | Admin / CRO |
|---|---|---|---|---|
| View public pages, events, About | ✓ | ✓ | ✓ | ✓ |
| Read published publications | ✓ | ✓ | ✓ | ✓ |
| Read unpublished / draft publications | ✗ | ✗ | Own | ✓ |
| Submit contact inquiry | ✓ | ✓ | ✓ | ✓ |
| Read contact inquiries | ✗ | ✗ | ✗ | ✓ |
| Register application | ✓ | ✗ | ✗ | ✗ |
| View own application status | — | ✓ | ✓ | ✓ |
| Approve / reject application | ✗ | ✗ | ✗ | ✓ |
| Access member dashboard APIs | ✗ | ✗ | ✓ | ✓ (read-only where sensible) |
| View own profile (full) | ✗ | Own | Own | ✓ |
| Edit profile | ✗ | ✗ (locked during review) | Own | ✓ (with audit) |
| View other member's **public** profile | Pub. | Pub. | ✓ | ✓ |
| View other member's private PII / credential docs | ✗ | ✗ | ✗ | ✓ |
| Create / edit / delete project | ✗ | ✗ | Own | ✗ (admin reviews, does not author) |
| View project | ✗ | ✗ | Own | ✓ |
| Upload project file | ✗ | ✗ | Own | ✗ |
| Download project file | ✗ | ✗ | Own | ✓ |
| Transition project `DRAFT→SUBMITTED` | ✗ | ✗ | Own | ✗ |
| Transition project to `UNDER_REVIEW / APPROVED / REJECTED / PUBLISHED` | ✗ | ✗ | ✗ | ✓ |
| Archive project | ✗ | ✗ | Own (per rules in §H.2) | ✓ |
| Create support request | ✗ | ✗ | Own | ✗ |
| View support request | ✗ | ✗ | Own | ✓ |
| Decide support request | ✗ | ✗ | ✗ | ✓ |
| Create publication draft / submit | ✗ | ✗ | Own | ✗ |
| Approve / reject / publish / unpublish publication | ✗ | ✗ | ✗ | ✓ |
| Read conversation / messages | ✗ | ✗ | Part. | ✓ (all) |
| Start conversation | ✗ | ✗ | ✓ (with CRO only) | ✓ (with any member) |
| Download message attachment | ✗ | ✗ | Part. | ✓ |
| Read own notifications | ✗ | ✓ | Own | Own |
| Create / edit / delete events | ✗ | ✗ | ✗ | ✓ |
| View platform statistics | Aggregate only | Aggregate only | Aggregate only | ✓ (full) |
| Read audit log | ✗ | ✗ | ✗ | ✓ |

### B.3 Authorization rules that must be enforced server-side

These are stated separately because they are the tests in §55 and the most common failure mode:

- **R1** — Membership status is checked on every dashboard request, not only at login. A member deactivated mid-session loses access on the next request (short access-token TTL + status re-check).
- **R2** — Ownership is verified by loading the record and comparing `record.ownerId` to the authenticated user, never by trusting an ID supplied in the body or a hidden field.
- **R3** — File downloads authorize the *parent record*, not the file row. Owning a file ID is not permission.
- **R4** — Admin-only fields (`reviewNotes`, `internalNotes`, `reviewedBy`) are stripped by the member serializer, not merely hidden in the UI.
- **R5** — A "not found" and a "not yours" both return `404` for member-scoped resources, to avoid leaking existence. Admin routes may return `403` since existence is not sensitive to them.

---

## C. User Journeys

### C.1 Membership Registration
1. Visitor reads `/membership`, clicks *Apply*.
2. `/register` — multi-step form (account → professional identity → education/credentials → documents → review & submit). Client-side Zod validation mirrors server schema.
3. Submit → server validates, hashes password (bcrypt, cost 12), creates `User(status=PENDING)`, `MemberProfile(memberId=null)`, `MembershipApplication(status=PENDING)`, `ProfessionalCredential[]`, `Education[]`, `ResearchInterest[]`, and stores uploaded credential documents via the storage adapter — **all in one transaction**.
4. Email verification link sent. Notification created for admins.
5. Applicant lands on `/application-status` showing `PENDING`. No Member ID is shown (§7).

**Failure paths:** duplicate email → `409` with a neutral message; oversized/disallowed file → `422` before any DB write; partial upload failure → transaction rolls back and orphaned blobs are swept by a cleanup job.

### C.2 Membership Approval
1. Admin opens `/admin/members/pending`, filters, opens `/admin/members/:id`.
2. Admin inspects profile fields and streams credential documents through the authorized file endpoint.
3. Admin optionally sets `UNDER_REVIEW` (signals "seen", not decided).
4. **Approve** → single transaction: assert application is `PENDING`/`UNDER_REVIEW` → reserve next Member ID (§E.6) → set `MemberProfile.memberId`, `approvedAt` → `User.role=MEMBER`, `status=ACTIVE` → `MembershipApplication.status=APPROVED`, `reviewedBy`, `reviewedAt` → insert `Notification` → insert `AuditLog` → enqueue `EmailJob(MEMBERSHIP_APPROVED)`.
5. Email dispatched by the worker **after** commit. Email failure never rolls back approval.
6. **Reject** → same shape, no Member ID issued, `reviewNotes` required, `User.status=REJECTED`.

### C.3 Member Login
1. `/login` → credentials → server verifies bcrypt hash with constant-time comparison semantics and a uniform error for wrong-email vs wrong-password.
2. Checks `status`: `PENDING` → redirect to application status; `REJECTED`/`SUSPENDED` → explanatory error, no token.
3. Issues access JWT (15 min, returned in body, held in memory) + refresh token (httpOnly cookie, 7 days, rotated on use, hashed in `Session`).
4. `lastLoginAt` updated. Client bootstraps `/api/v1/auth/me`.
5. Password reset: `/forgot-password` always returns success regardless of account existence; token is random 32 bytes, stored hashed, single-use, 1-hour expiry, invalidates all sessions on use.

### C.4 Project Submission
1. `/dashboard/projects/new` → project metadata + support type intent + file uploads.
2. Saved as `DRAFT`; editable freely.
3. *Submit for review* → server validates required completeness → `DRAFT→SUBMITTED`, writes `ProjectStatusHistory`, notifies admin.
4. Project becomes read-only for the member while `SUBMITTED`/`UNDER_REVIEW` (see §H.2).
5. CRO reviews at `/admin/projects/:id`, adds review notes, transitions to `APPROVED` or `REJECTED`; member is notified and, if rejected, regains edit rights for resubmission.

### C.5 Support Request
1. From `/dashboard/support/new` or from within a project.
2. Member selects `MORAL` / `OFFICIAL` / `FUNDING`, optionally links a project, describes the need; `requestedAmount` + currency required only for `FUNDING`.
3. Created `PENDING` → admin notified.
4. CRO at `/admin/support/:id` sets `UNDER_REVIEW`, may exchange messages, then `APPROVED` / `REJECTED` with an `adminResponse`; `APPROVED` may later become `COMPLETED` (grant disbursed, letter issued).
5. Every transition writes `SupportRequestHistory` + `AuditLog` + `Notification`.

### C.6 Publication Submission
1. `/dashboard/publications/new` — title, abstract, full text, category, research type, PDF, supporting documents.
2. `DRAFT` → *Submit* → `SUBMITTED`. Content locked to the member.
3. Slug is generated server-side from the title at submission, uniqueness-suffixed; never editable by the member after publish (link stability).

### C.7 Publication Approval
1. `/admin/publications/:id` — CRO reads full text, downloads PDF, records a `PublicationReview` (decision + reviewer comments).
2. `APPROVED` does **not** make it public. A separate explicit **Publish** action sets `PUBLISHED` + `publishedAt` and only then does it appear under `/api/v1/public/publications`.
3. `Unpublish` returns it to `APPROVED` and removes it from all public queries immediately, with an audit entry.

### C.8 Member ↔ CRO Communication
1. `/dashboard/messages` → member starts or continues the (single, canonical) conversation with the CRO.
2. Message = subject + body + optional `MessageAttachment[]` + optional `SharedLink[]` (video/meeting URLs) + optional meeting request metadata.
3. Read state per participant (`ConversationParticipant.lastReadAt`), which drives unread badges cheaply.
4. Attachments authorized via conversation participation (**R3**).
5. Shared links are validated as `http(s)` and rendered as text with `rel="noopener noreferrer"` — never auto-embedded from arbitrary origins.

### C.9 Event Discovery
1. Public `/events` list (upcoming/past tabs, calendar view) → `/events/:slug` detail with speakers, topics, resources.
2. Registration info shown publicly; join links for online events are gated per `Event.linkVisibility` (public / members-only / registered-only) — see §J.
3. Past events expose recordings, proceedings and takeaways as `EventResource` rows.

### C.10 Public Research Reading
1. `/research` with server-side search + filters (category, author, type, date range) and pagination.
2. `/research/:slug` renders abstract and full text, offers PDF download and share links.
3. A view is recorded once per visitor per 24h via a hashed fingerprint in `PublicationView`; a denormalized `viewCount` is incremented for cheap sorting (§19).

---

## D. Page Map

### D.1 Public
| Route | Page | Notes |
|---|---|---|
| `/` | Homepage | Hero, community stats, what we offer, vision, mission |
| `/about` | About | Leadership, CRO, story, impact, objectives |
| `/membership` | Membership | Eligibility, benefits, CTA |
| `/research` | Publications index | Search + filters + pagination |
| `/research/:slug` | Publication detail | SEO slug, view tracking |
| `/support-services` | Support services | Moral / official / funding |
| `/events` | Events index | Upcoming + past, calendar/list toggle |
| `/events/:slug` | Event detail | |
| `/members` | Member directory | **Pending decision — see §J.4** |
| `/members/:memberId` | Public author profile | Public fields only |
| `/contact` | Contact | Rate-limited form |
| `/privacy`, `/terms`, `/code-of-ethics`, `/cookies` | Legal | Placeholder, marked awaiting approved copy (§51) |
| `*` | 404 | |

### D.2 Authentication
| Route | Page |
|---|---|
| `/login` | Login |
| `/register` | Multi-step application |
| `/register/success` | Submission confirmation |
| `/verify-email` | Token consumption |
| `/forgot-password` | Request reset |
| `/reset-password` | Consume reset token |
| `/application-status` | Pending/rejected applicant landing |

### D.3 Member (`MEMBER` + `ACTIVE`)
| Route | Page |
|---|---|
| `/dashboard` | Overview: Member ID, stats, recent activity |
| `/dashboard/profile` | View profile |
| `/dashboard/profile/edit` | Edit profile |
| `/dashboard/projects` | Project list |
| `/dashboard/projects/new` | Create |
| `/dashboard/projects/:id` | Detail + status history + files |
| `/dashboard/projects/:id/edit` | Edit (status-permitting) |
| `/dashboard/support` | Support requests |
| `/dashboard/support/new` | New request |
| `/dashboard/support/:id` | Detail + decision |
| `/dashboard/publications` | My submissions |
| `/dashboard/publications/new` | New submission |
| `/dashboard/publications/:id` | Detail + reviewer comments |
| `/dashboard/messages` | Inbox / sent |
| `/dashboard/messages/:conversationId` | Thread |
| `/dashboard/documents` | Document exchange view |
| `/dashboard/published-works` | My published papers |
| `/dashboard/community` | Member directory (member view) |
| `/dashboard/notifications` | Notifications |
| `/dashboard/settings` | Password, email, sessions |

### D.4 Admin (`ADMIN`)
| Route | Page |
|---|---|
| `/admin` | Statistics dashboard |
| `/admin/members` | All members (filters) |
| `/admin/members/pending` | Review queue |
| `/admin/members/:id` | Application + credential review |
| `/admin/projects` | All projects |
| `/admin/projects/:id` | Review + status change |
| `/admin/support` | Support queue |
| `/admin/support/:id` | Decide |
| `/admin/publications` | Submission queue |
| `/admin/publications/:id` | Review / approve / publish |
| `/admin/messages` | All conversations |
| `/admin/messages/:conversationId` | Thread |
| `/admin/events` · `/admin/events/new` · `/admin/events/:id/edit` | Event management |
| `/admin/inquiries` | Contact inquiries |
| `/admin/notifications` | Broadcast announcements |
| `/admin/audit-log` | Audit trail |

---

## E. Architecture

### E.1 Shape

A **modular monolith**: one Express process, one Postgres database, one React SPA, one background worker (in-process scheduler for v1, extractable later). Chosen because the domain is highly relational, traffic is modest (target 1,000 members), and a single team must maintain it (§67).

**Repository layout** — `backend/` and `frontend/` as two standalone projects, each with its own `package.json`, lockfile and `.env`. This replaces the `client/` + `server/` monorepo naming in specification §3 at the client's request (ADR-004), and matches the reference project supplied. A thin root `package.json` provides orchestration scripts only; it is not an npm workspace root.

```
Browser (React SPA, Vite)
   │  HTTPS, JSON  ─ access JWT in Authorization header
   │               ─ refresh token in httpOnly cookie
   ▼
Express API  ── /api/v1/*
   │
   ├─ middleware:  helmet · cors · rate-limit · body-size · requestId · auth · rbac · validate(zod) · errorHandler
   ├─ controllers: HTTP only — parse, call service, format response
   ├─ services:    business rules, state machines, transactions, authorization policy
   ├─ storage:     StorageAdapter (local disk | S3-compatible)
   ├─ email:       EmailService interface + outbox worker
   └─ prisma  ──►  PostgreSQL
```

### E.2 Frontend

- **React 18 + Vite + TypeScript**, Tailwind for all styling, three route trees (`PublicLayout`, `AuthLayout`, `DashboardLayout`) under React Router.
- **State:** TanStack Query for all server state (caching, retries, invalidation on mutation); React Context only for auth session and toasts. No Redux — there is no meaningful client-side global state beyond the session.
  *(This is an addition to the stated stack and is flagged as ADR-003 for approval; the alternative is hand-rolled fetch hooks, which will reimplement the same behaviour worse.)*
- **Forms:** React Hook Form + Zod resolver. Validation schemas are written to match the server schemas exactly; the server remains authoritative.
- **API layer:** one Axios instance with interceptors for access-token attachment, 401 → silent refresh → single retry, and normalized error mapping to toasts/field errors.
- **Route guards:** `<RequireAuth>` / `<RequireRole>` for UX only. Explicitly not a security control (§67).

### E.3 Backend layering

`routes → middleware → controllers → services → prisma`. Controllers never touch Prisma; services never touch `req`/`res`. Validation happens in middleware from a Zod schema per endpoint covering body, query **and** params (§67).

### E.4 Authentication

| Concern | Decision |
|---|---|
| Password hashing | bcrypt, cost 12 |
| Access token | JWT, 15 min, `{ sub, role, status, sessionId }`, HS256, secret from env |
| Refresh token | Opaque 32-byte random, SHA-256 hashed in `Session`, httpOnly + Secure + SameSite=Lax cookie, 7 days, **rotated on every use** with reuse-detection revoking the session family |
| Logout | Deletes the `Session` row; access token expires naturally within 15 min |
| Status revocation | Access token carries `status`; services re-verify `User.status` on sensitive operations |
| Reset tokens | Random, hashed at rest, single-use, 1h TTL, invalidates all sessions |

Storing refresh tokens server-side is what makes deactivation, "log out everywhere", and reuse detection possible — a stateless-only JWT design cannot satisfy §28's *deactivate member* requirement.

### E.5 Authorization

Two layers, both server-side:
1. **Role gate** — `requireRole('ADMIN')` middleware on the route.
2. **Object policy** — a `policy/` module with functions like `canViewProject(user, project)`, called inside services after loading the record. Controllers cannot skip it because they never load records themselves.

### E.6 Member ID generation

Format `IFSMHP-<YYYY>-<NNNNNN>` where `YYYY` is the **approval** year (decision flagged in §J.1) and `NNNNNN` is a zero-padded per-year sequence.

```
BEGIN
  SELECT lastValue FROM member_id_sequence WHERE year = :year FOR UPDATE;   -- row lock
  UPDATE member_id_sequence SET lastValue = lastValue + 1 WHERE year = :year;
  memberId := format('IFSMHP-%s-%06s', year, lastValue + 1);
  ... approval writes ...
COMMIT
```
Defence in depth: row lock prevents the race; a `UNIQUE` constraint on `MemberProfile.memberId` is the final guarantee; the write path is server-only; the value is immutable once set (enforced in the service and asserted in tests).

### E.7 File storage

```ts
interface StorageAdapter {
  put(buffer: Buffer, opts: { mimeType: string; originalName: string }): Promise<{ storageKey: string }>;
  getStream(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
  getSignedUrl?(storageKey: string, ttlSeconds: number): Promise<string>;
}
```
`LocalDiskAdapter` in development (outside the web root, random filenames), `S3Adapter` in production. **Files are never statically served.** Every download goes through `GET /api/v1/files/:id` which authorizes the parent record, then streams with `Content-Disposition: attachment` and a safe `Content-Type`. Metadata lives in Postgres; bytes never do (§2).

### E.8 Notifications and email

In-app notifications are written **inside** the business transaction (they are part of the state change). Email is written to an `EmailJob` outbox in the same transaction and dispatched **after commit** by a worker with retry/backoff. This gives at-least-once delivery without letting an SMTP timeout roll back a membership approval.

```ts
interface EmailService {
  sendMembershipApproved(...): Promise<void>;
  sendMembershipRejected(...): Promise<void>;
  sendNewMessage(...): Promise<void>;
  sendProjectStatusUpdate(...): Promise<void>;
  sendPublicationStatusUpdate(...): Promise<void>;
  sendEventAnnouncement(...): Promise<void>;
  sendPasswordReset(...): Promise<void>;
  sendEmailVerification(...): Promise<void>;
}
```
Development uses a local capture mailbox (MailHog or a filesystem transport); production provider is env-configured (§32).

### E.9 Statistics

Homepage/About statistics come from `GET /api/v1/public/statistics`, which reads live counts with short-TTL caching. Where the database cannot yet supply a figure, the endpoint omits the key and the UI hides the tile rather than showing a fabricated number (§21, §52). **The hero copy's "277 members" conflicts with a database that will start at zero — see §J.3.**

---

## F. Database Design

PostgreSQL + Prisma with migrations. All tables carry `id` (cuid), `createdAt`, `updatedAt` unless noted.

### F.1 Entities

**Identity & membership**
| Entity | Key fields | Relations |
|---|---|---|
| `User` | email (unique), passwordHash, role, status, emailVerifiedAt, lastLoginAt | 1–1 `MemberProfile`; 1–n `Session`, `Notification`, `AuditLog` |
| `Session` | tokenHash (unique), familyId, userAgent, ip, expiresAt, revokedAt | n–1 `User` |
| `MemberProfile` | userId (unique), **memberId (unique, nullable)**, fullName, professionalType, professionalTitle, institution, country, biography, credentialsSummary, researchInterestsSummary, profileImageFileId, registrationDate, approvedAt, isDirectoryVisible | 1–n credentials/education/interests/projects/publications |
| `MembershipApplication` | userId, status, submittedAt, reviewedById, reviewedAt, reviewNotes | n–1 `User`; 1–n `ApplicationDocument` |
| `ProfessionalCredential` | profileId, title, issuingBody, issuedYear, referenceNumber, documentFileId, visibility | n–1 `MemberProfile` |
| `Education` | profileId, institution, degree, field, startYear, endYear | n–1 `MemberProfile` |
| `ResearchInterest` | profileId, label, (optional `topicId`) | n–1 `MemberProfile` |
| `MemberIdSequence` | year (PK), lastValue | — |

**Projects**
| Entity | Key fields |
|---|---|
| `Project` | ownerProfileId, title, description, category, status, startDate, expectedCompletionDate, budgetAmount, budgetCurrency, additionalResources, submittedAt, reviewedById, reviewNotes (admin-only), archivedAt |
| `ProjectFile` | projectId, fileId, kind (`DOCUMENT` / `PRESENTATION`) |
| `ProjectStatusHistory` | projectId, oldStatus, newStatus, changedById, note, createdAt |

**Support**
| Entity | Key fields |
|---|---|
| `SupportRequest` | requesterProfileId, projectId (nullable), type (`MORAL`/`OFFICIAL`/`FUNDING`), description, requestedAmount, currency, status, adminResponse, decidedById, decidedAt, completedAt |
| `SupportRequestHistory` | supportRequestId, oldStatus, newStatus, changedById, note |

**Publications**
| Entity | Key fields |
|---|---|
| `Publication` | authorProfileId, title, slug (unique), abstract, fullText, category, researchType, status, submittedAt, publishedAt, viewCount |
| `PublicationFile` | publicationId, fileId, kind (`MANUSCRIPT_PDF` / `SUPPORTING`) |
| `PublicationReview` | publicationId, reviewerId, decision, comments, createdAt |
| `PublicationView` | publicationId, viewerHash, viewedAt (unique on publicationId+viewerHash+day) |

**Communication**
| Entity | Key fields |
|---|---|
| `Conversation` | subject, lastMessageAt |
| `ConversationParticipant` | conversationId, userId, lastReadAt (unique on pair) |
| `Message` | conversationId, senderId, body, meetingRequestedAt (nullable), createdAt |
| `MessageAttachment` | messageId, fileId |
| `SharedLink` | messageId, url, label, kind (`VIDEO`/`MEETING`/`OTHER`) |

**Platform**
| Entity | Key fields |
|---|---|
| `FileObject` | originalName, storedName, mimeType, size, storageKey (unique), checksum, uploadedById |
| `Notification` | userId, type, title, body, targetUrl, readAt |
| `EmailJob` | template, toEmail, payload (json), status, attempts, lastError, sendAfter |
| `Event` | title, slug (unique), description, startAt, endAt, timezone, mode (`ONLINE`/`IN_PERSON`/`HYBRID`), location, joinUrl, linkVisibility, registrationUrl, status |
| `EventSpeaker` | eventId, name, affiliation, bio, profileId (nullable), photoFileId |
| `EventResource` | eventId, kind (`RECORDING`/`PROCEEDINGS`/`TAKEAWAY`/`FEEDBACK`), title, url or fileId |
| `EventTopic` | eventId, label |
| `ContactInquiry` | name, email, subject, message, ipHash, status, handledById, handledAt |
| `AuditLog` | actorId, action, entityType, entityId, metadata (json), createdAt |

### F.2 Notable modelling decisions

- **`FileObject` is a single central table** (§37) referenced by join tables (`ProjectFile`, `PublicationFile`, `MessageAttachment`, `ApplicationDocument`). This keeps upload/validation/storage logic in one place while preserving explicit, typed ownership for authorization — a fully generic polymorphic attachment table would make **R3** much harder to enforce correctly.
- **`ConversationParticipant`** rather than `senderId`/`receiverId` on the conversation: it gives per-user read state (cheap unread counts) and leaves room for future multi-party threads without a migration.
- **`memberId` is nullable** on `MemberProfile` by design — its absence *is* the pre-approval state, and a partial unique index enforces uniqueness over non-null values only.
- **`Session` and `EmailJob`** are additions to the model list in §33, justified by revocable auth (§E.4) and transactional email safety (§E.8).
- **`viewCount` is denormalized** onto `Publication` for sorting/display, with `PublicationView` as the deduplicated source of truth.

### F.3 Constraints and indexes

Unique: `User.email`, `MemberProfile.memberId` (partial), `MemberProfile.userId`, `Publication.slug`, `Event.slug`, `FileObject.storageKey`, `Session.tokenHash`, `ConversationParticipant(conversationId,userId)`.
Indexes: `Project(ownerProfileId,status)`, `Project(status,createdAt)`, `SupportRequest(status,type)`, `Publication(status,publishedAt)`, `Publication(category,status)`, `Message(conversationId,createdAt)`, `Notification(userId,readAt)`, `AuditLog(entityType,entityId)`, plus a GIN trigram or `tsvector` index for publication search (§42).
Cascades: deleting a `User` cascades to `Session`/`Notification` but **never** to `AuditLog` (traceability, §57). Business records use soft deletion (`archivedAt`/`deletedAt`) only where audit value exists — projects, publications, inquiries — not everywhere.

---

## G. API Map

All under `/api/v1`, all list endpoints paginated (§41), all responses in the envelope from §40.

**auth** — `POST /register` · `POST /login` · `POST /refresh` · `POST /logout` · `GET /me` · `POST /verify-email` · `POST /forgot-password` · `POST /reset-password` · `POST /change-password`

**membership** — `GET /application` (own status) · `POST /application/documents`

**members** — `GET /members` (directory, member+) · `GET /members/:memberId` (public projection) · `GET /profile` · `PATCH /profile` · `POST /profile/image` · CRUD for `/profile/credentials|education|interests`

**projects** — `GET /projects` · `POST /projects` · `GET /projects/:id` · `PATCH /projects/:id` · `DELETE /projects/:id` (draft only) · `POST /projects/:id/submit` · `POST /projects/:id/files` · `DELETE /projects/:id/files/:fileId` · `GET /projects/:id/history`

**support-requests** — `GET /support-requests` · `POST /support-requests` · `GET /support-requests/:id` · `PATCH /support-requests/:id` (draft-ish edits) · `GET /support-requests/:id/history`

**publications** — `GET /publications` (own) · `POST /publications` · `GET /publications/:id` · `PATCH /publications/:id` · `POST /publications/:id/submit` · `POST /publications/:id/files`

**messages** — `GET /conversations` · `POST /conversations` · `GET /conversations/:id` · `GET /conversations/:id/messages` · `POST /conversations/:id/messages` · `POST /conversations/:id/read`

**files** — `GET /files/:id` (authorized stream) · `DELETE /files/:id`

**notifications** — `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` · `GET /notifications/unread-count`

**events** — `GET /events` · `GET /events/:slug`

**contact** — `POST /contact` (rate-limited + honeypot)

**public** — `GET /public/statistics` · `GET /public/publications` · `GET /public/publications/:slug` · `POST /public/publications/:slug/view` · `GET /public/publications/:slug/pdf` · `GET /public/members` · `GET /public/members/:memberId` · `GET /public/events`

**admin** —
`GET /admin/statistics`
`GET /admin/members` · `GET /admin/members/pending` · `GET /admin/members/:id` · `POST /admin/members/:id/approve` · `POST /admin/members/:id/reject` · `POST /admin/members/:id/deactivate` · `POST /admin/members/:id/reactivate`
`GET /admin/projects` · `GET /admin/projects/:id` · `POST /admin/projects/:id/status` · `POST /admin/projects/:id/notes`
`GET /admin/support-requests` · `GET /admin/support-requests/:id` · `POST /admin/support-requests/:id/status`
`GET /admin/publications` · `GET /admin/publications/:id` · `POST /admin/publications/:id/review` · `POST /admin/publications/:id/publish` · `POST /admin/publications/:id/unpublish`
`GET /admin/conversations` · `POST /admin/conversations` (start with a member)
`GET|POST|PATCH|DELETE /admin/events` (+ speakers, topics, resources sub-resources)
`GET /admin/inquiries` · `PATCH /admin/inquiries/:id`
`POST /admin/announcements`
`GET /admin/audit-log`

**Design notes:** state changes are `POST` to explicit action sub-routes (`/approve`, `/submit`, `/publish`) rather than `PATCH { status }`, which makes illegal transitions unrepresentable at the routing layer and makes authorization and audit far easier to read. Public routes are a separate module so that "did I remember to filter to PUBLISHED?" is answered once, in one place.

---

## H. Workflow State Machines

### H.1 Membership Application

```
PENDING ──► UNDER_REVIEW ──► APPROVED   (terminal — issues Member ID)
   │             │
   └─────────────┴──────────► REJECTED  (terminal for that application)
```
| From | To | Actor | Side effects |
|---|---|---|---|
| PENDING | UNDER_REVIEW | Admin | audit |
| PENDING/UNDER_REVIEW | APPROVED | Admin | Member ID, `User.role=MEMBER`, `status=ACTIVE`, notification, email, audit |
| PENDING/UNDER_REVIEW | REJECTED | Admin | `reviewNotes` required, `User.status=REJECTED`, notification, email, audit |

Invariants: no path reaches `APPROVED` without a Member ID; a member can never trigger any of these transitions; `APPROVED` is irreversible (deactivation is a separate `User.status` concern, not a reversal of approval).

### H.2 Project

```
DRAFT ──► SUBMITTED ──► UNDER_REVIEW ──► APPROVED ──► PUBLISHED
  ▲            │              │              │            │
  └────────────┴──────────────┘              ▼            ▼
        (REJECTED → back to DRAFT)        ARCHIVED ◄──────┘
```
| From | To | Actor |
|---|---|---|
| DRAFT | SUBMITTED | Member (owner) |
| SUBMITTED | UNDER_REVIEW / APPROVED / REJECTED | Admin |
| UNDER_REVIEW | APPROVED / REJECTED | Admin |
| REJECTED | DRAFT | Member (to revise) |
| APPROVED | PUBLISHED / ARCHIVED | Admin |
| APPROVED / PUBLISHED / REJECTED | ARCHIVED | Member (owner) or Admin |

Rules: member edits allowed only in `DRAFT`; every transition writes `ProjectStatusHistory`; `ARCHIVED` is terminal; no transition may skip a step except the explicitly listed shortcuts.

### H.3 Support Request

```
PENDING ──► UNDER_REVIEW ──► APPROVED ──► COMPLETED
   │              │
   └──────────────┴────────► REJECTED
```
`APPROVED → COMPLETED` is admin-only and represents fulfilment (funds released, letter issued). `REJECTED` and `COMPLETED` are terminal. Withdrawal by the member from `PENDING` is a candidate addition — flagged in §J.

### H.4 Publication

```
DRAFT ──► SUBMITTED ──► UNDER_REVIEW ──► APPROVED ──► PUBLISHED
  ▲            │              │                          │
  └────────────┴──────────────┴─► REJECTED               │
  └──────────────────────────── (unpublish) ◄────────────┘  → APPROVED
```
Only `PUBLISHED` is publicly readable. `APPROVED` is an internal green light, deliberately separate from publication so the CRO controls timing. Unpublishing returns to `APPROVED` and takes effect immediately across all public queries and the PDF endpoint.

---

## I. Security Review

| # | Risk | Controls |
|---|---|---|
| **I.1** | **Broken object-level authorization** (highest risk: private projects, files, messages, support requests) | Centralized policy module; ownership assertions in services; `404` for non-owned member resources; the nine §55 tests are release-blocking |
| I.2 | Privilege escalation via mass assignment | Zod schemas with `.strict()`; explicit field whitelists on update; `role`, `status`, `memberId`, `reviewNotes` never accepted from client input |
| I.3 | Credential-document exposure | No static serving; authorized streaming endpoint; random `storedName`; storage outside web root; admin-only access to application documents |
| I.4 | Malicious file upload | MIME allowlist + extension check + magic-byte sniff; size cap; executable rejection; random storage names; no path traversal (`storageKey` server-generated, never client-influenced); `Content-Disposition: attachment` on download |
| I.5 | Credential stuffing / brute force | Per-IP and per-account rate limits on login, reset and register; uniform error messages; bcrypt cost 12; account lockout backoff |
| I.6 | Token theft / replay | Short access TTL; refresh rotation with reuse detection; httpOnly+Secure+SameSite cookies; server-side session revocation |
| I.7 | Member ID collision | Row-locked sequence inside the approval transaction + DB `UNIQUE` constraint + concurrency test |
| I.8 | Unpublished content leakage | Separate `/public` module with mandatory status filter; publication serializer strips `fullText` from non-public projections; automated test asserts `404` for non-published slugs |
| I.9 | XSS via member-authored content (bios, abstracts, full text) | Server-side sanitization on write for any HTML-bearing field; React escaping by default; strict CSP; never `dangerouslySetInnerHTML` on unsanitized input |
| I.10 | SSRF / phishing via shared links | URL scheme allowlist (`http`/`https` only); no server-side fetching of user URLs; links rendered with `rel="noopener noreferrer"`, never auto-embedded |
| I.11 | Contact-form spam | Rate limit, honeypot field, timing check, optional CAPTCHA (provider TBD — §J) |
| I.12 | Information disclosure in errors | Central error handler maps to safe messages; stack traces, SQL and paths never returned; correlation ID returned instead (§40) |
| I.13 | PII over-exposure in profiles | Three explicit projections (public / member / admin) implemented as serializer functions, default-deny; tested |
| I.14 | Enumeration of accounts | Neutral responses on registration conflict and password reset |
| I.15 | Injection | Prisma parameterized queries only; any raw SQL uses tagged template parameters |
| I.16 | Transport / headers | Helmet, HSTS, strict CORS allowlist from `CLIENT_URL`, JSON body size limits, multipart limits |
| I.17 | Insider/admin error, disputes | `AuditLog` on every admin state change, written in-transaction; no passwords or file contents logged (§38) |

---

## J. Missing Information

**These require decisions from you. Nothing here has been invented; each item is either unspecified or internally inconsistent in the requirements.**

### J.1 Blocking (needed before Milestone 3 — database design)
1. **Member ID year semantics.** Is `YYYY` the year of *approval* or of *application*? Does the sequence reset each January (`IFSMHP-2027-000001`) or continue globally? This is baked into a permanent, immutable, human-facing identifier — expensive to change later. *(Proposed: approval year, per-year reset.)*
2. **Existing membership.** The site claims 277 existing members. Are these to be imported (and if so, do they get IDs `000001…000277` in registration order?), or does the system start empty? Import format and source needed if the former.
3. **Homepage statistics vs. reality.** The hero copy states 277 members / 123 scholars / 154 professionals, but §5 asks for live database statistics and §67 forbids fabricated data. Until data exists these conflict. *(Proposed: config-driven "announced figures" clearly separate from live counts, or hide tiles — your call.)*
4. **Member directory visibility.** Members can "view other members' public published work" (§4) and there is a *Community* nav item, but no directory page is specified. Is there a public directory, a members-only directory, or only author pages reachable from publications? Which fields are public (institution? country? email?) and can members opt out?

### J.2 Blocking (needed before Milestone 5–6 — auth and approval)
5. **Email verification ordering.** Must an applicant verify their email before the CRO can review the application, or is verification independent?
6. **Number of administrators.** §34 defines a single `ADMIN` role, but "Chief Research Officer" reads as one specific person. Are there multiple admins? Do they need distinguishing (CRO vs. staff admin) for audit and for "messages from the CRO"?
7. **Rejected applicants.** May they reapply? Immediately, after a cooling-off period, or never? Is their data retained or purged?
8. **Deactivated members.** Do their published papers remain public? Is their Member ID retired permanently (never reissued)? Can they log in read-only?

### J.3 Content and integration (needed before Milestone 7 and 15)
9. CRO photograph, full biography, name and title as it should appear.
10. Organizational postal address, phone, registration/incorporation details for the footer and About page.
11. Real social profile URLs (LinkedIn, X, Facebook, ResearchGate) — placeholders used until supplied (§52).
12. Brand assets: logo files, primary/secondary colours, approved typefaces. *(Absent these, a neutral academic palette and system-adjacent serif/sans pairing will be used and flagged as provisional.)*
13. Impact statistics for §21 (projects supported, papers published, grants awarded) — hidden until derivable from the database.
14. Production email provider and the sending domain/DNS status for `@ifsmhp.com` (SPF/DKIM/DMARC must exist before approval emails will deliver reliably).
15. Production file-storage provider and region (affects the S3 adapter and any data-residency obligations).
16. CAPTCHA provider for the contact form, if one is wanted.
17. Final legal copy for privacy, terms, code of ethics and cookies (§51).

### J.4 Policy and workflow gaps
18. **Funding currency and limits.** Single currency or multi? Any maximum request amount? Is an approved amount recorded separately from the requested amount?
19. **Publication licensing and copyright.** Under what licence is published work made available? Who holds copyright? Is there a plagiarism/originality check step?
20. **Co-authorship.** Can a publication have multiple IFSMHP member authors, or external co-authors? The current model assumes a single author — adding co-authors later is a schema change.
21. **Project collaboration.** §6 promises "collaboration" as a benefit, but §4 forbids members from seeing each other's projects. What does collaboration concretely mean — invited co-members on a project, or just the messaging channel?
22. **Meeting requests.** §15 lists "request meetings" but no scheduling mechanism is specified. Is it a flagged message with a proposed time, or is calendar integration expected?
23. **Support-request withdrawal.** May a member cancel a `PENDING` request?
24. **Event registration.** Is registration handled in-platform (requiring an `EventRegistration` model) or via an external link only? Who may see online joining links?
25. **Membership certificate** (§6). Is it a generated PDF, a manually issued document, or a page? Generation would add a template and PDF pipeline.
26. **Data protection regime.** Which jurisdiction's rules apply (GDPR? Indian DPDP Act? other)? This affects retention periods, the right to erasure vs. audit-log retention (§57), and consent copy.
27. **Retention.** How long are rejected applications, credential documents and contact inquiries kept?
28. **Full-text format.** Is publication `fullText` plain text, Markdown, or rich HTML? This determines the editor, the sanitization strategy (I.9) and the rendering path.

---

## K. Development Plan

Milestones follow §58. Each ends with the traceability table updated (§62) and a working, verifiable increment. No milestone is "done" until it meets §66.

| # | Milestone | Key deliverables | Exit criteria |
|---|---|---|---|
| 1 | Requirements & architecture | This document + traceability table | Approved by you; §J.1–J.2 answered |
| 2 | Scaffolding | Monorepo, client/server workspaces, TS config, ESLint/Prettier, Tailwind, `.env.example`, health endpoint, CI-ready scripts | `dev`, `build`, `lint`, `typecheck` all pass on both workspaces |
| 3 | Database | Full `schema.prisma`, initial migration, seed skeleton, ER documentation | Migration applies cleanly to an empty DB; seed runs |
| 4 | Backend foundation | Middleware stack, error handler, response envelope, Zod validation harness, pagination helper, storage adapter, logger | Sample module returns spec-compliant success/error envelopes |
| 5 | Auth & authorization | Register/login/refresh/logout/reset, sessions, RBAC middleware, policy module | Auth test suite green, including negative cases |
| 6 | Membership & approval | Application submission, admin review queue, approve/reject transaction, Member ID sequence, notifications | Concurrency test proves no duplicate Member IDs |
| 7 | Public website | All public pages, layout system, design tokens, responsive shell, statistics endpoint | Lighthouse a11y ≥ 90; all breakpoints verified |
| 8 | Profile & dashboard | Member dashboard shell, profile view/edit, credentials/education/interests, public projections | Serializer tests prove no private-field leakage |
| 9 | Projects | CRUD, file upload/download, submit, status history, admin review | §55 project ownership tests green |
| 10 | Support requests | Member request flow, admin decision flow, history | State-machine tests green |
| 11 | Messaging & documents | Conversations, messages, attachments, shared links, read state | Participation authorization tests green |
| 12 | Publications | Submission, review, approve, publish, public portal, slugs, view tracking | Unpublished content unreachable publicly (tested) |
| 13 | Admin dashboard | Live statistics, all admin queues, inquiries, audit log viewer | All admin routes role-gated and audited |
| 14 | Events | Public list/detail, calendar, admin CRUD, speakers/resources | Past/upcoming logic verified across timezones |
| 15 | Notifications & email | Notification centre, `EmailService`, outbox worker, templates | Emails captured locally for every notification type |
| 16 | Security hardening | Rate limits, helmet/CORS/CSP, upload hardening, sanitization, dependency audit | Security checklist in §I fully addressed |
| 17 | Testing | Fill coverage gaps; all §54–55 cases; concurrency and state-machine suites | Full suite green in CI |
| 18 | Documentation & deployment | `README`, `docs/architecture.md`, `docs/api.md`, deployment notes, production checklist | A new developer can run the project from the README alone |

**Sequencing note.** Milestones 2–6 are strictly sequential. From Milestone 8 onward, 9/10/11/12 could be reordered if your priorities differ — for example, if the CRO needs the review pipeline live before the public site, we can swap 7 later. Say the word and I'll re-sequence.

---

## STOP POINT (§69)

Implementation has **not** begun and will not begin until this architecture is approved.

To proceed to Milestone 2 I need:
- Approval (or corrections) of sections E, F, G and H;
- Answers to the four **blocking** items in §J.1 and the four in §J.2;
- Confirmation of the flagged deviations: **ADR-004** repository layout changed to `backend/` + `frontend/` standalone projects per the supplied reference structure (accepted, implemented); **ADR-001** additional models (`Session`, `EmailJob`, `ConversationParticipant`, `MemberIdSequence`, `FileObject`) beyond §33; **ADR-002** whether a shared types package may be added to the monorepo structure in §3; **ADR-003** TanStack Query as an addition to the frontend stack in §1.
