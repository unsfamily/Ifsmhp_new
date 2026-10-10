# Operations

Configure, run, test, and deploy the IFSMHP platform. Read [`application-flow.md`](application-flow.md) for how the running system behaves.

## Local environment on this machine

| Piece | Value |
|---|---|
| API | http://localhost:4000 |
| SPA | http://localhost:5173 |
| Health | http://localhost:4000/api/v1/health |
| MySQL | Docker container `ifsmhp-mysql`, host port **3308** |
| Database | `ifsmhp_platform` (`utf8mb4` / `utf8mb4_unicode_ci`) |
| App user | `ifsmhp` (host `%`, because Docker port-mapping is not `localhost` inside the container) |
| Secrets | `backend/.env` only. Never commit it. |
| Public API URL | `frontend/.env` → `VITE_API_BASE_URL` |

Port 3308 is intentional. Other local MySQL containers already claim 3306 and 3307.

SMTP is unset on purpose. One-time sign-in codes are printed in the API log.

## Configure

From the repository root, with Node 20 or newer:

```bash
npm install
npm run install:all
```

Create `frontend/.env` from `frontend/.env.example` if it is missing. Create `backend/.env` from `backend/.env.example` if it is missing, then set:

- `DATABASE_URL` to the application user on port 3308
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to different random strings of at least 32 characters
- `CLIENT_URL=http://localhost:5173`
- leave `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` empty unless real mail is required

`backend/config/env.ts` exits on startup when a required variable is missing or too short.

Start MySQL if the container exists and is stopped:

```bash
docker start ifsmhp-mysql
```

If the container does not exist, create it once:

```bash
docker run -d --name ifsmhp-mysql ^
  -e MYSQL_ROOT_PASSWORD=<root-password> ^
  -e MYSQL_DATABASE=ifsmhp_platform ^
  -p 3308:3306 ^
  mysql:8.0 ^
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

Put the same root login in `ADMIN_DATABASE_URL` inside `backend/.env` (gitignored, read only by setup). The application user must be allowed from `%`, not only `localhost`, or connections from the host fail.

Then:

```bash
npm run db:setup
```

That command applies migrations, generates the Prisma client, and seeds only when the database has no users. It refuses `--reset` and seeding when `NODE_ENV=production`.

Stop the API before setup if Prisma reports `EPERM` renaming `query_engine-windows.dll.node`. The running dev server locks that file on Windows.

After a Prisma schema change, stop the running backend, apply migrations, generate
the client, and restart the backend. Generation updates files on disk; it does not
replace a Prisma client already loaded in a running Node process. This also applies
to `tsx watch`, which does not automatically reload generated dependencies.
`npm --prefix backend run dev` and `npm --prefix backend run build` regenerate the
client automatically through their `predev` and `prebuild` hooks. These hooks do
not apply database migrations. A build or manual `db:generate` still requires
restarting any already-running backend afterward.

## Run

```bash
npm run dev
```

Backend listens on 4000, frontend on 5173 (`strictPort`, so a busy port is a failure, not a silent switch).

Check:

```bash
curl http://localhost:4000/api/v1/health
```

Expect `success: true` and `data.status: "ok"`. Open http://localhost:5173/ and confirm the public home page renders. Administrator sign-in is `POST /api/v1/auth/login` with `admin@ifsmhp.local` / `ChangeMeNow!2026`.

## Test

```bash
npm test
```

That is the backend Vitest suite (`vitest run`). It uses the `DATABASE_URL` in `backend/.env` and files run one at a time because they share one database. Do not point it at a production database. A focused smoke check that does not rewrite data:

```bash
npm --prefix backend run test -- tests/health.test.ts
```

Frontend session behavior:

```bash
npm --prefix frontend run test:session
```

Playwright smoke tests hit the running site. `npm run dev` must already be up, or the Playwright config will start it.

```bash
npm run test:e2e
```

The suite uses the installed Google Chrome browser. To use Playwright's own Chromium instead, run `npx playwright install chromium` from `backend` and set `PLAYWRIGHT_CHANNEL=chromium`. The suite checks the public home page, the unknown-email sign-in message, and administrator password sign-in. The older `test:*:browser` scripts use the same Playwright package. Point `CHROME_PATH` at Chrome when the bundled browser is not installed, and give them an isolated database whose name ends in `_test`.

`npm run verify` runs typecheck, lint, tests, and production build. Use it before a release. It is slow.

Browser scripts under `backend/package.json` (`test:*:browser`) drive specific workflows and need a running app plus a browser. Use the one that matches the area you changed.

## Deploy

The application instance in us-east-1 does not replace the static site. The production database is separate from the local Docker database on port 3308.

Use RDS for MySQL 8 in the same VPC as the `ifsmhp` instance. Do not open port 3306 to the internet. Allow it only from that instance's security group. Create the database before the first boot:

```sql
CREATE DATABASE ifsmhp_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Create an application user that is not the RDS master user. From the application instance the account host is `%`, because the connection does not come from the database server's own hostname.

Download the us-east-1 RDS CA bundle from the [RDS SSL certificate bundles](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html) (`us-east-1-bundle.pem`) and keep it outside the git repository. `NODE_ENV=production` refuses to boot when `DATABASE_URL` points at a remote host unless it includes `sslaccept=strict` and `sslcert` for that file. It also refuses the development passwords `ifsmhp` and `ChangeMeNow!2026`, identical JWT secrets, and the example JWT placeholders.

`npm run db:setup` with `NODE_ENV=production` only migrates and generates the Prisma client. It does not create users, write `.env`, seed, or honor `--reset`. The same command refuses `--reset` and seeding for any host that is not localhost, even outside production. Apply the schema with:

```bash
npm --prefix backend run db:deploy
```

Never run `db:seed` or `db:setup -- --reset` against RDS.

Local release artifacts:

```bash
npm run build
```

- API output: `backend/dist` — start with `npm --prefix backend start`
- SPA output: `frontend/dist` — serve as static files, with `VITE_API_BASE_URL` set at **build** time to the public API origin

Production process:

1. Set `NODE_ENV=production` and provide `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CLIENT_URL` in the environment. Do not generate `backend/.env` on the server.
2. Use HTTPS. Keep `trust proxy` at one hop (already set when `NODE_ENV=production`).
3. Apply schema with `npm --prefix backend run db:deploy`. Never `migrate dev`, `db:setup --reset`, or `db:seed` against production.
4. Keep `UPLOAD_STORAGE_PATH` outside any web root and persistent across restarts.
5. Configure SMTP. Production sign-in codes must not depend on the log.
6. Restart the API after the build so workers pick up the new code.
7. Confirm `GET /api/v1/health`, an administrator password login, and one public page (`/api/v1/public/publications` or the SPA home page).

Feature-specific rollout notes (what not to reseed, which migration is additive) are in the matching file under `docs/`, such as `gallery-management.md`, `community-workflow.md`, and `administration-settings.md`.

## Member profile image rollout and verification

Apply migration `20261010000000_member_avatar` and regenerate Prisma before
starting the updated backend and frontend:

```bash
npm --prefix backend run db:deploy
npm --prefix backend run db:generate
npm run build
```

Restart the running backend after these commands, including an existing development
watch process, before testing image uploads. An `Unknown argument avatarFileId`
error with the migration applied indicates a stale generated client in that process.

The migration adds a nullable unique `MemberProfile.avatarFileId` foreign key;
no backfill is required. `MEMBER_AVATAR_MAX_UPLOAD_MB` defaults to 5 (allowed
configuration range 1–25). The API exposes the resolved limit to the frontend.
Keep the existing `UPLOAD_STORAGE_PATH` durable and writable by the API. Both
admin and member avatars use existing `FileObject` records and avatar cleanup.
Cleanup failures are logged for retry; cleanup never purges a referenced image.

Run the new tests only against an isolated database whose name ends in `_test`
and a separate `UPLOAD_STORAGE_PATH` containing `test`. The database must have
all migrations applied. Disable SMTP and background workers in that environment.

```bash
npm --prefix backend run test -- tests/member-avatar.test.ts tests/admin-profile.test.ts tests/registration-documents.test.ts
npm --prefix backend run test:member-avatar:browser
```

For browser tests, build the backend and run the API and frontend against that
same isolated database. Configure `AVATAR_API_URL` (default
`http://127.0.0.1:5017/api/v1`), `AVATAR_WEB_URL` (default
`http://127.0.0.1:5187`), matching frontend `VITE_API_BASE_URL` and backend
`CLIENT_URL`. `CHROME_PATH` optionally selects an installed Chrome executable.
Screenshots go to `AVATAR_SCREENSHOT_DIR` or `/private/tmp/ifsmhp-avatar-browser`.
The test uses disposable members and actual OTP verification with database code
fixtures; no email is sent. Tests clean their users and uploaded files afterward.
