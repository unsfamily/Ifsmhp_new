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

`npm run verify` runs typecheck, lint, tests, and production build. Use it before a release. It is slow.

Browser scripts under `backend/package.json` (`test:*:browser`) drive specific workflows and need a running app plus a browser. Use the one that matches the area you changed.

## Deploy

This repository has no hosting account, container registry, or remote release target. A deployment is not complete until both the API build and the SPA build are released together, and `prisma migrate deploy` has been applied to that environment's database.

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
