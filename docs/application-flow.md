# Application flow

How the IFSMHP platform handles a request, and how a person moves from public visitor to approved member. Architecture detail lives in [`architecture.md`](architecture.md). Endpoint detail lives in [`api.md`](api.md).

## Runtime

One React SPA, one Express API, one MySQL database.

```
Browser (Vite :5173)
  → Axios  VITE_API_BASE_URL  (default http://localhost:4000/api/v1)
    → Express  /api/v1
      → route middleware (auth, role, validation)
        → service (transactions, state changes)
          → Prisma → MySQL
```

`backend/` and `frontend/` are separate npm projects. The root `package.json` only starts them together. Controllers do not call Prisma. Services do not read `req` or `res`.

Uploaded files stay on disk under `UPLOAD_STORAGE_PATH`. Nothing in that directory is served as static files. A download checks permission on the parent record, then streams the bytes.

## Request path

1. `frontend/src/api/client.ts` sends JSON with `Authorization: Bearer <access token>` when a session exists. The access token is kept in `localStorage` under `ifsmhp.accessToken`. The refresh token is an httpOnly cookie.
2. `backend/server.ts` listens, then starts the admin-notification, event, and announcement workers. Missing mail does not stop the API. In development, one-time codes are written to the API log.
3. `backend/app.ts` applies a request id, Helmet, CORS (`CLIENT_URL`), rate limits, JSON parsing, and cookies. In production it trusts exactly one proxy hop.
4. `backend/routes/index.ts` mounts `/api/v1`. Unknown paths return the failure envelope with `404`. Errors never include a stack trace.

Successful responses use `{ success, data, message }`. Failures use `{ success: false, message, errors }`.

## Who can reach what

| Surface | Routes | API prefix | Who |
|---|---|---|---|
| Public site | `/`, `/about`, `/membership`, `/research`, `/events`, `/contact`, `/support-services`, `/product-reviews` | `/public/*`, `/contact`, `/auth/*` | Anyone |
| Sign-in | `/login`, `/register`, `/forgot-password`, `/reset-password` | `/auth/*` | Anyone |
| Member workspace | `/dashboard/*` | `/members/*` | `MEMBER` and status `ACTIVE` |
| Admin back office | `/admin/*` | `/admin/*` | `ADMIN` |

The SPA guards in `frontend/src/App.tsx` only choose which screen to show. The API checks the role and the record owner on every call. A pending applicant who calls a member route gets `403`. A member who asks for someone else's record gets `404`.

## Sign-in

Administrators use `POST /api/v1/auth/login` with email and password.

Members and applicants have no password. They use `POST /api/v1/auth/otp/request` with `{ purpose: "LOGIN", email }`, then `POST /api/v1/auth/otp/verify` with the 6-digit code. Without SMTP, that code is printed in the API process log.

A successful sign-in returns a short-lived access JWT and sets a rotating refresh cookie backed by a hashed `Session` row. `GET /api/v1/auth/me` rebuilds the client session. Deactivating a user takes effect on the next request because membership status is checked again, not only at login.

Development accounts created by the seed:

| Email | How to sign in |
|---|---|
| `admin@ifsmhp.local` | Password `ChangeMeNow!2026` |
| `member@ifsmhp.local` | Emailed code (API log when SMTP is unset) |
| `applicant@ifsmhp.local` | Emailed code (API log when SMTP is unset) |

## Membership loop

This is the product. Almost every member action waits for the Chief Research Officer.

1. A visitor opens `/membership` and submits `/register`. The API creates `User` (`PENDING`), `MemberProfile` (no member id yet), `MembershipApplication`, credentials, education, research interests, and uploaded documents in one transaction.
2. The applicant can see application status. They cannot open the member dashboard.
3. An administrator reviews `/admin/members/pending`. Approval, in one transaction, reserves the next `IFSMHP-YYYY-NNNNNN` id, sets the user to `MEMBER` / `ACTIVE`, and writes status history, a notification, and an audit row. Rejection records a reason and does not issue an id.
4. The member works in `/dashboard`: profile, research projects, support requests (`MORAL`, `OFFICIAL`, `FUNDING`), publications, messages with the CRO, document exchange, gallery, community, and notifications.
5. Projects move `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED` or `REJECTED`. The member can edit a draft or a rejection. Submitted and in-review projects are locked.
6. Support requests move `PENDING → UNDER_REVIEW → APPROVED` or `REJECTED`, and an approval can later become `COMPLETED`.
7. Publications move `DRAFT → SUBMITTED → APPROVED`. `APPROVED` is not public. A separate publish action sets `PUBLISHED`. Only then does the work appear on `/api/v1/public/publications` and `/research`.
8. Public readers, events, and the gallery are the outward face. That visibility is what the next applicant sees.

Messages, support replies, and file downloads all authorize the parent conversation or record. Original filenames are metadata. Storage names are random.

## Background work

These start with the API process and are safe to leave on in development:

- Announcement delivery (`ANNOUNCEMENT_WORKER_ENABLED`)
- Event reminders and related jobs
- Administrator operational email (`ADMIN_EMAIL_WORKER_ENABLED`)

Mail is sent only when `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are all set. Otherwise OTP and similar messages stay in the log.

## Where to change behavior

| Change | Start here |
|---|---|
| Screen or route | `frontend/src/pages`, `frontend/src/App.tsx` |
| HTTP call | `frontend/src/api` |
| URL, auth gate, validation | `backend/routes`, `backend/middleware`, `backend/validators` |
| Business rule or status change | `backend/services` |
| Table or migration | `backend/database/prisma` |
| Required environment variable | `backend/config/env.ts` and `backend/.env.example` |
