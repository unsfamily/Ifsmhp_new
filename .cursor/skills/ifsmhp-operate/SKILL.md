---
name: ifsmhp-operate
description: Configures, runs, tests, and deploys the IFSMHP Express/React/MySQL platform. Use when the user asks to configure, start, run, test, verify, build, or deploy this application.
---

# IFSMHP operate

Follow `docs/operations.md`. Behavior of the running system is in `docs/application-flow.md`.

## Sequence

1. Install with `npm install` and `npm run install:all` when `node_modules` is missing.
2. Ensure `backend/.env` and `frontend/.env` exist. Secrets stay in `backend/.env` and are never committed or echoed.
3. `docker start ifsmhp-mysql` when that container is stopped. It must publish host port 3308.
4. `npm run db:setup` for migrations, Prisma client, and a first seed. Stop the API first if Windows locks `query_engine-windows.dll.node`.
5. `npm run dev` for the API on port 4000 and the SPA on port 5173.
6. Confirm `GET http://localhost:4000/api/v1/health` and that the home page loads.
7. Smoke-test with `npm --prefix backend run test -- tests/health.test.ts`. Full suite: `npm test` against the development database only.
8. `npm run build` produces `backend/dist` and `frontend/dist`. A remote deploy needs an explicit host and credentials. Schema rollout is `npm --prefix backend run db:deploy`. Do not seed production.

The project subagent `.cursor/agents/ifsmhp-operator.md` is the delegate for this workflow.
