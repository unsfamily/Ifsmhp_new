# IFSMHP Requirements Traceability

**Last updated:** Milestone 2 (project scaffolding complete)
**Statuses:** `NOT_STARTED` · `IN_PROGRESS` · `COMPLETE` · `BLOCKED`

This file is updated at the end of every milestone (§62). A requirement moves to `COMPLETE` only when it satisfies the Definition of Done in §66 — database, API, validation, authorization, frontend integration, loading/empty/error states, responsive layout, tests, types, build and docs.

---

## Summary

| Milestone | Requirements | Status |
|---|---|---|
| M1 — Analysis & architecture | §68 A–L | COMPLETE |
| M2 — Project scaffolding | §3, §50, §65 | COMPLETE |
| M3 — Database & Prisma schema | §2, §33–§37, §56 | **BLOCKED** on §J.1 |
| M4–M18 | All remaining | NOT_STARTED |

**M2 verification:** `npm run verify` passes — server and client typecheck, both workspaces lint clean, 4 tests pass, production build succeeds for both. API smoke-tested live: security headers present, success and failure envelopes correct, correlation IDs issued.

**Blocked count: 6** — all blocked on decisions listed in §J of `architecture-analysis.md`.

---

## Foundation & platform

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Technology stack | §1 | **COMPLETE** | React 18/Vite 6/TS/Tailwind 3/Router 6/Axios/RHF/Zod/Lucide | Express 4/TS/Zod | Prisma 5 | Installed as specified. ADR-003 (TanStack Query) **declined pending approval** — not added |
| PostgreSQL + Prisma, no binary blobs in DB | §2 | IN_PROGRESS | — | — | datasource + generator | Models in M3; StorageAdapter implemented in M9 |
| Project structure | §3 | **COMPLETE** | `frontend/` | `backend/` | `backend/database/prisma/` | **ADR-004:** layout changed from `client/`+`server/` to `backend/`+`frontend/` standalone projects at client request, matching the supplied reference. Internal `src/` subdirectories retained per §3. ADR-002 (shared package) declined pending approval |
| Requirements analysis & architecture | §68, §69 | **COMPLETE** | — | — | — | `docs/architecture-analysis.md` |
| Architecture documentation | §63 | **COMPLETE** | — | — | — | `docs/architecture.md`; updated each milestone |
| API documentation | §64 | IN_PROGRESS | — | `docs/api.md` | — | Envelope, status codes and `/health` documented; modules specified before implementation |
| README | §65 | IN_PROGRESS | — | — | — | Written at M2; deployment section completed at M18 |
| Environment variables / `.env.example` | §50 | **COMPLETE** | VITE_API_BASE_URL | Zod-validated at boot | DATABASE_URL | Only consumed variables listed; grows per milestone |
| Seed data (clearly marked demo) | §53 | IN_PROGRESS | — | — | `prisma/seed.ts` | Harness in place; populated in M3 |
| Development workflow milestone order | §58 | IN_PROGRESS | — | — | — | Plan in §K |
| Existing-repository inspection rule | §59 | IN_PROGRESS | — | — | — | Repository now exists; binding for all future changes |
| Code modification rules | §60 | NOT_STARTED | — | — | — | Ongoing discipline |
| Database change discipline | §61 | NOT_STARTED | — | — | — | Ongoing discipline |
| Definition of Done | §66 | NOT_STARTED | — | — | — | Applied per requirement |
| Development principles | §67 | NOT_STARTED | — | — | — | Ongoing discipline |

## Data model

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Normalized schema (expanded model set) | §33 | NOT_STARTED | — | — | all | Designed in §F; ADR-001 adds 5 models |
| User model | §34 | NOT_STARTED | — | — | User | |
| MemberProfile model | §35 | NOT_STARTED | — | — | MemberProfile | |
| Membership application status enum | §36 | NOT_STARTED | — | — | MembershipApplication | |
| Relational file model (no `*_Path` fields) | §37 | NOT_STARTED | — | — | FileObject + join tables | |
| Audit logging | §38 | NOT_STARTED | `/admin/audit-log` | `/admin/audit-log` | AuditLog | Written in-transaction |
| Database integrity: keys, uniques, indexes, cascades | §56 | NOT_STARTED | — | — | all | Index list in §F.3 |
| Soft delete strategy | §57 | NOT_STARTED | — | — | selected models | Audit history never hard-deleted |

## Authentication, authorization & security

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| User roles (Admin/CRO, Member, Public) | §4 | NOT_STARTED | route guards | rbac middleware | User.role | Matrix in §B.2 |
| Login / forgot / reset password | §9 | NOT_STARTED | `/login`, `/forgot-password`, `/reset-password` | `/auth/*` | User, Session | |
| Backend-enforced admin authorization | §9, §67 | NOT_STARTED | — | rbac + policy | — | Frontend guards are UX only |
| Security controls (helmet, CORS, rate limit, RBAC, validation) | §43 | IN_PROGRESS | — | helmet, CORS allowlist, rate limit, body limits, Zod validate | — | RBAC at M5; hardening pass at M16 |
| File upload security | §44 | NOT_STARTED | FileUploader | `/files` | FileObject | MIME + extension + magic bytes + size |
| Data privacy — public/member/admin field tiers | §45 | NOT_STARTED | — | serializers | — | Default-deny projections (I.13) |
| Critical authorization tests (9 cases) | §55 | NOT_STARTED | — | — | — | Release-blocking |

## Public website

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Homepage hero + CTAs | §5 | NOT_STARTED | `/` | — | — | |
| Homepage global community stats | §5 | **BLOCKED** | `/` | `/public/statistics` | derived | Blocked on §J.1-2, J.1-3 (277 members vs. live data) |
| Homepage "What we offer" | §5 | NOT_STARTED | `/` | — | — | |
| Vision & Mission | §5 | NOT_STARTED | `/` | — | — | Copy supplied |
| Membership page + eligibility + benefits | §6 | NOT_STARTED | `/membership` | — | — | |
| About page + leadership + impact stats | §21 | **BLOCKED** | `/about` | `/public/statistics` | derived | Blocked on §J.3-9, J.3-13 (CRO bio/photo, impact figures) |
| Support services page | §22 | NOT_STARTED | `/support-services` | — | — | |
| Contact page + form + spam protection | §25 | NOT_STARTED | `/contact` | `/contact` | ContactInquiry | CAPTCHA choice open (§J.3-16) |
| Footer (links, legal, social) | §26 | **BLOCKED** | Footer | — | — | Blocked on §J.3-11 (social URLs); placeholders until then |
| Legal placeholder pages | §51 | **BLOCKED** | `/privacy`, `/terms`, `/code-of-ethics`, `/cookies` | — | — | Blocked on §J.3-17; marked awaiting approved copy |
| Public member directory / author pages | §4, §17 | **BLOCKED** | `/members`, `/members/:memberId` | `/public/members` | MemberProfile | Blocked on §J.1-4 (scope and visible fields undefined) |
| Unknown information handled as config/placeholders | §52 | IN_PROGRESS | — | — | — | Catalogued in §J; nothing invented |

## Membership

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Registration page & form | §7 | NOT_STARTED | `/register` | `/auth/register` | User, MembershipApplication, ... | Multi-step |
| Registration → approval workflow | §7 | NOT_STARTED | `/application-status` | `/admin/members/:id/approve` | MembershipApplication | Journey C.1–C.2 |
| Unique Member ID system | §8 | **BLOCKED** | display only | server-side only | MemberIdSequence, MemberProfile.memberId | Blocked on §J.1-1 (year semantics); design ready (E.6) |
| Membership administration (review/approve/reject/activate) | §28 | NOT_STARTED | `/admin/members*` | `/admin/members/*` | + AuditLog, Notification | Single transaction |

## Member workspace

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Member dashboard + navigation | §10 | NOT_STARTED | `/dashboard` | `/members/profile`, counts | — | |
| Member profile (public/private separation) | §11 | NOT_STARTED | `/dashboard/profile` | `/members/profile` | MemberProfile + children | |
| Research project management + files | §12 | NOT_STARTED | `/dashboard/projects*` | `/projects/*` | Project, ProjectFile | |
| Project status workflow + history | §13 | NOT_STARTED | status UI | `/projects/:id/submit`, `/admin/projects/:id/status` | ProjectStatusHistory | State machine §H.2 |
| Support requests (moral/official/funding) | §14 | NOT_STARTED | `/dashboard/support*` | `/support-requests/*` | SupportRequest, SupportRequestHistory | Currency/limits open (§J.4-18) |
| Document exchange | §15 | NOT_STARTED | `/dashboard/documents` | `/conversations/*`, `/files/:id` | MessageAttachment, SharedLink | |
| Messaging (inbox, unread, attachments) | §16 | NOT_STARTED | `/dashboard/messages*` | `/conversations/*` | Conversation, Message, ConversationParticipant | Meeting requests open (§J.4-22) |
| Publication submission | §18 | NOT_STARTED | `/dashboard/publications*` | `/publications/*` | Publication, PublicationFile | Full-text format open (§J.4-28) |
| Notifications page | §31 | NOT_STARTED | `/dashboard/notifications` | `/notifications/*` | Notification | |

## Publications & events

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Public research portal + filters | §17, §42 | NOT_STARTED | `/research` | `/public/publications` | Publication | Server-side search |
| Publication detail + slug + view tracking | §19 | NOT_STARTED | `/research/:slug` | `/public/publications/:slug` | PublicationView, viewCount | Dedup per visitor/day |
| Scientific opinions & review content types | §20 | NOT_STARTED | filters | category/type params | Publication.researchType | Enum designed for extension |
| Publications administration | §30 | NOT_STARTED | `/admin/publications*` | `/admin/publications/*` | PublicationReview | Approve ≠ publish |
| Events & symposiums (public + admin) | §23 | **BLOCKED** | `/events*`, `/admin/events*` | `/events`, `/admin/events` | Event, EventSpeaker, EventResource, EventTopic | Blocked on §J.4-24 (registration model, link visibility) |
| Event calendar | §24 | NOT_STARTED | calendar component | `/events` | Event | No external provider committed |

## Administration & platform services

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Admin dashboard + live statistics | §27 | NOT_STARTED | `/admin` | `/admin/statistics` | derived | Live values only |
| Project administration | §29 | NOT_STARTED | `/admin/projects*` | `/admin/projects/*` | ProjectStatusHistory, AuditLog | |
| Support administration | §14 | NOT_STARTED | `/admin/support*` | `/admin/support-requests/*` | SupportRequestHistory | |
| Notification system | §31 | NOT_STARTED | badge + page | `/notifications` | Notification | Written in-transaction |
| Email notifications (provider-agnostic) | §32 | NOT_STARTED | — | worker | EmailJob | Outbox pattern; provider open (§J.3-14) |
| API architecture `/api/v1` + module split | §39 | IN_PROGRESS | — | v1 router mounted | — | Modules registered as milestones land; no stub handlers |
| Consistent response format | §40 | **COMPLETE** | `normalizeError()` | `sendSuccess` / `sendFailure` | — | Tested: no stack traces leak; correlation ID returned |
| Pagination on all large lists | §41 | IN_PROGRESS | Pagination component (M7) | `utils/pagination.ts` | indexes at M3 | Shared helper ready; applied per module |
| Search & filters (server-side) | §42 | NOT_STARTED | filter UI | query schemas | indexes | |

## Experience quality

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Mobile responsive across all breakpoints | §46 | NOT_STARTED | all pages | — | — | Tables → cards on mobile |
| UI design direction + component library | §47 | **BLOCKED** | `components/common` | — | — | Blocked on §J.3-12 (brand assets); provisional system otherwise |
| Accessibility (WCAG practices) | §48 | IN_PROGRESS | focus rings, skip link, landmarks, reduced motion | — | — | Baseline set; audited per milestone |
| Loading / empty / error / unauthorized states | §49 | NOT_STARTED | all data pages | — | — | Part of Definition of Done |

## Testing

| Requirement | Ref | Status | Frontend | API | Database | Notes |
|---|---|---|---|---|---|---|
| Backend test coverage (auth, approval, ownership, workflows) | §54 | NOT_STARTED | — | — | — | Written alongside each module, not deferred to M17 |
| Critical authorization tests | §55 | NOT_STARTED | — | — | — | 9 named cases; release-blocking |
| Member ID concurrency test | §8 | NOT_STARTED | — | — | — | Parallel approval simulation |
| State-machine transition tests (4 workflows) | §13, §14, §18, §36 | NOT_STARTED | — | — | — | Legal and illegal transitions |
