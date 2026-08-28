# IFSMHP Platform

Website and membership management platform for the **International Forum of Scientists and Mental Health Professionals**.

> **Current status: full-stack integration baseline.**
> The backend uses Express, TypeScript, Prisma, and MySQL with authenticated public/member/admin APIs. The frontend has API-backed auth/session routing and the primary operational write workflows are wired to the backend.

---

## Project

The platform combines three surfaces:

| Surface | Audience | Purpose |
|---|---|---|
| Public institutional website | Anyone | Credibility, recruitment, dissemination of approved research |
| Member workspace (`/dashboard`) | Approved members | Research projects, support requests, publications, communication with the CRO |
| Admin back office (`/admin`) | Chief Research Officer | Review and decide: applications, projects, support, publications, events |

The system is fundamentally a **gated professional workflow**: nearly every member action passes through CRO review. See [`docs/architecture.md`](docs/architecture.md) for the full analysis.

## Architecture

A modular monolith: one Express API process, one MySQL database, one React SPA.

```
ifsmhp-platform/
├── backend/                 Express + TypeScript REST API
│   ├── config/              env validation (env.ts), Prisma client (database.ts)
│   ├── controllers/         HTTP layer — parse request, call service, format response
│   ├── database/prisma/     schema.prisma, migrations, seed
│   ├── middleware/          auth, RBAC, validation, rate limiting, error handling
│   ├── routes/              /api/v1 router and per-module routers
│   ├── services/            business logic, transactions, state machines
│   ├── validators/          Zod request schemas
│   ├── utils/               errors, response envelope, pagination, logger
│   ├── types/               shared type declarations
│   ├── uploads/             local file storage (never served statically)
│   ├── tests/
│   ├── .env
│   └── server.ts            entrypoint
│
├── frontend/                React 18 + Vite + Tailwind
│   ├── public/
│   ├── src/
│   │   ├── api/             Axios instance, error normalization
│   │   ├── components/      common, forms, layout, dashboard
│   │   ├── context/  hooks/  layouts/  services/  types/  utils/
│   │   └── pages/           public, auth, member, admin
│   ├── .env
│   ├── index.html
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.ts
│
├── docs/                    architecture, API reference, traceability
├── package.json             orchestration scripts only
└── .gitignore
```

`backend/` and `frontend/` are **two standalone projects**, each with its own `package.json`, lockfile and `.env`. The root `package.json` runs both together for convenience; it is not an npm workspace root.

Backend layering is enforced by convention and review: **controllers never touch Prisma, services never touch `req`/`res`.**

## Technology stack

**Frontend** — React 18, Vite 6, TypeScript, Tailwind CSS 3, React Router 6, Axios, React Hook Form, Zod, Lucide React
**Backend** — Node.js 20+, Express 4, TypeScript, Zod, Helmet, CORS, express-rate-limit, cookie-parser, bcryptjs, jsonwebtoken, multer, file-type
**Database** — MySQL 8+ with Prisma ORM and migrations
**Testing** — Vitest + Supertest

## Requirements

- Node.js **20 or later** (developed against 22)
- npm 10+
- MySQL 8+

## Installation

```bash
git clone <repository-url>
cd ifsmhp-platform

npm install                  # root: orchestration scripts only
npm run install:all          # installs backend and frontend

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Environment configuration

Backend and frontend keep **separate** `.env` files, and that separation is a security boundary rather than a convention: Vite inlines its variables into the public bundle, so anything in `frontend/.env` is readable by any visitor. Server secrets belong in `backend/.env` only.

`backend/config/env.ts` validates the backend environment with Zod at boot — a missing or malformed variable crashes the process immediately rather than failing mysteriously later.

Never commit a real `.env`. See `backend/.env.example` and `frontend/.env.example`.

## MySQL Setup

```bash
mysql -u root -p
CREATE DATABASE ifsmhp_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ifsmhp'@'localhost' IDENTIFIED BY 'ifsmhp';
GRANT ALL PRIVILEGES ON ifsmhp_platform.* TO 'ifsmhp'@'localhost';
FLUSH PRIVILEGES;

# backend/.env
DATABASE_URL="mysql://ifsmhp:ifsmhp@localhost:3306/ifsmhp_platform"
```

## Prisma migrations

The schema lives at `backend/database/prisma/schema.prisma`. The first MySQL migration is in `backend/database/prisma/migrations/20260828000000_init_mysql`.

```bash
npm --prefix backend run db:generate
npm --prefix backend run db:migrate
npm --prefix backend run db:deploy
npm --prefix backend run db:studio
```

## Seed data

```bash
npm run db:seed
```

Seed data is **development-only** and must never be applied to a production database. Seed accounts:

```text
admin@ifsmhp.local / ChangeMeNow!2026
member@ifsmhp.local / ChangeMeNow!2026
applicant@ifsmhp.local / ChangeMeNow!2026
```

## Running the application

```bash
npm run dev            # backend (:4000) and frontend (:5173) together
npm run dev:backend
npm run dev:frontend
```

Verify the API:

```bash
curl http://localhost:4000/api/v1/health
```

## Tests

```bash
npm test                                  # backend suite
npm --prefix backend run test:watch
```

Authorization tests are release-blocking, not optional — see `docs/architecture.md` §I and the nine required cases in the specification.

## Production build

```bash
npm run build                 # backend → backend/dist, frontend → frontend/dist
npm --prefix backend start
```

`npm run verify` runs typecheck, lint, tests and build in sequence — run it before every commit.

## File storage

Uploaded documents are stored through a `StorageAdapter` interface: local disk in development, object storage in production. Two rules hold in both cases:

1. Files are **never** served statically. Every download passes through an authorized endpoint that checks permission on the *parent record*, then streams the bytes.
2. Storage filenames are server-generated and random. Original filenames are metadata, never paths.

The production storage provider is not yet chosen (`docs/architecture.md` §J.3-15).

## Authentication

Short-lived JWT access tokens are held by the client and attached as `Authorization: Bearer ...`. Rotating refresh tokens are stored server-side as hashed `Session` rows and delivered as httpOnly cookies. Server-side sessions are what make deactivation and global logout enforceable.

**The backend is the sole source of authorization truth.** Frontend route guards improve the experience; they are not a security control.

## Deployment notes

Documented in Milestone 18. Non-negotiables already established: HTTPS with HSTS, `trust proxy` set to exactly one hop, strict CORS allowlist, secrets from the environment rather than files, `prisma migrate deploy` (never `migrate dev`) against production, and storage kept outside any web-served directory.

## Documentation

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System architecture, data model, permissions, state machines, security review, open questions |
| [`docs/api.md`](docs/api.md) | Endpoint reference |
| [`docs/requirements-traceability.md`](docs/requirements-traceability.md) | Requirement → status → frontend/API/database mapping |

## Development principles

Carried through every milestone:

- Never fabricate functionality — a screen that fakes a successful API call is worse than no screen.
- Never fabricate data — demo fixtures are labelled as such.
- The backend is the source of authorization truth.
- Prefer maintainability over cleverness; another team will maintain this.
- Use transactions wherever multiple writes must succeed together.
- Validate all external input: bodies, query strings, route params, files and URLs.
