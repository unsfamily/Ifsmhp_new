# IFSMHP API Reference

Base path: `/api/v1`

Every endpoint returns the shared envelope:

```json
{ "success": true, "data": {}, "message": "Operation completed successfully" }
```

Failures return:

```json
{ "success": false, "message": "Useful error message", "errors": [], "requestId": "uuid" }
```

List endpoints use `?page=1&limit=20` and return `items` plus `pagination`.

## Authentication

Access tokens are short-lived JWTs returned in the response body. Refresh tokens are random values stored as hashed `Session` rows and sent as an httpOnly cookie.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Create a pending applicant, profile, and membership application |
| `POST` | `/auth/login` | Verify password, create session, set refresh cookie |
| `POST` | `/auth/logout` | Revoke current refresh session and clear cookie |
| `POST` | `/auth/refresh` | Rotate refresh token and return a new access token |
| `GET` | `/auth/me` | Return current user/profile |
| `POST` | `/auth/forgot-password` | Create a hashed reset token record |
| `POST` | `/auth/reset-password` | Consume reset token and update password hash |

## Public

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/public/stats` | Published platform/member/content counters |
| `GET` | `/public/publications` | Published publications with `q`, `category`, and `researchType` filters |
| `GET` | `/public/publications/:slugOrId` | Published publication detail and view tracking |
| `GET` | `/public/product-reviews` | Product reviews with pagination/filtering |
| `GET` | `/public/events` | Public published/past events |
| `GET` | `/public/events/:slugOrId` | Event detail |
| `GET` | `/public/gallery` | Public gallery albums, banners, and items |
| `POST` | `/contact` | Create a contact inquiry |

## Member

All member routes require an active `MEMBER` session. Admins may pass member route checks for operational escalation.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/members/me/dashboard` | Member dashboard aggregate |
| `GET` | `/members/me/profile` | Current member profile |
| `GET` | `/members/me/projects` | Owned projects |
| `POST` | `/members/me/projects` | Create draft/submitted project |
| `GET` | `/members/me/projects/:projectId` | Owned project detail |
| `GET` | `/members/me/support` | Owned support requests |
| `POST` | `/members/me/support` | Create support request |
| `GET` | `/members/me/publications` | Member manuscripts/publications |
| `GET` | `/members/me/conversations` | Participating conversations |
| `POST` | `/members/me/conversations/:id/messages` | Add a message |
| `GET` | `/members/me/documents` | Attachments visible to the member |
| `GET` | `/members/me/community` | Member directory, groups, and threads |

## Admin

All admin routes require an active `ADMIN` session.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/stats` | CRO dashboard counters |
| `GET` | `/admin/members` | Members/applications queue |
| `GET` | `/admin/members/:id` | Application detail |
| `POST` | `/admin/members/:id/approve` | Transactionally approve application and issue `IFSMHP-YYYY-NNNNNN` |
| `POST` | `/admin/members/:id/reject` | Reject application with reason |
| `GET` | `/admin/projects` | Project review queue |
| `GET` | `/admin/projects/:id` | Project detail |
| `POST` | `/admin/projects/:id/approve` | Approve project |
| `POST` | `/admin/projects/:id/reject` | Reject project |
| `PATCH` | `/admin/projects/:id/status` | Legal project status transition |
| `GET` | `/admin/publications` | Publication queue |
| `GET` | `/admin/publications/:id` | Publication detail |
| `POST` | `/admin/publications/:id/approve` | Approve internally |
| `POST` | `/admin/publications/:id/reject` | Reject manuscript |
| `POST` | `/admin/publications/:id/publish` | Publish publicly and create slug if needed |
| `POST` | `/admin/publications/:id/unpublish` | Return to approved internal state |
| `GET` | `/admin/support` | Support queue |
| `POST` | `/admin/support/:id/approve` | Approve support request |
| `POST` | `/admin/support/:id/reject` | Reject support request |
| `POST` | `/admin/support/:id/complete` | Complete support request |
| `GET` | `/admin/conversations` | All conversations |
| `GET` | `/admin/conversations/:id` | Conversation detail |
| `POST` | `/admin/conversations/:id/messages` | CRO reply |
| `GET` | `/admin/events` | Admin event list |
| `POST` | `/admin/events` | Create event |
| `PATCH` | `/admin/events/:id` | Update event |
| `GET` | `/admin/inquiries` | Contact inquiry queue |
| `POST` | `/admin/inquiries/:id/reply` | Add inquiry reply and mark responded |
| `POST` | `/admin/inquiries/:id/close` | Close inquiry |
| `POST` | `/admin/inquiries/:id/spam` | Mark inquiry as spam |
| `GET` | `/admin/announcements` | Announcement list |
| `POST` | `/admin/announcements` | Create draft/scheduled/sent announcement |
| `GET` | `/admin/gallery` | Admin gallery view |
| `GET` | `/admin/audit-log` | Immutable audit log |
| `GET` | `/admin/reports` | Report definitions |
| `GET` | `/admin/settings` | Platform settings |

## Files

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/files/upload` | Authenticated upload with size, MIME, and magic-byte checks |
| `GET` | `/files/:id/download` | Authorized streaming download |

Files are never served statically. Private file access is allowed to admins, uploaders, credential owners, project owners, publication authors, and conversation participants.
