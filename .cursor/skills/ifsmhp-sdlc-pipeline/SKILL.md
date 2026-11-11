---
name: ifsmhp-sdlc-pipeline
description: Orchestrates the end-to-end IFSMHP agentic SDLC pipeline across 8 sequential gates (Development, Unit Testing, Code Review, Security Audit, PR Creation, PR Validation, PR Merge, and Production Deployment + Live Release Verification). Use when running multi-agent feature delivery, bugfixes, pull request automation, or full development-to-deployment workflows.
---

# IFSMHP Agentic SDLC Pipeline

## Purpose

Defines the deterministic **Supervisor-Worker + Handoff Envelope + Quality Gate** architecture for IFSMHP (`backend/` Express + Prisma + MySQL, `frontend/` React + Vite + TypeScript).

Every stage runs in an isolated subagent context, consumes a structured input artifact from the orchestrator, executes a single responsibility, and returns a machine-verifiable **Handoff Envelope** ([CONTRACTS.md](CONTRACTS.md)) that `.cursor/agents/ifsmhp-orchestrator.md` validates before advancing to the next stage.

---

## Agentic & Generative AI Standards Enforced

1. **Supervisor-Worker Topology (Hub-and-Spoke):** Subagents never chain uncontrollably into arbitrary peers. Every worker reports back to `ifsmhp-orchestrator`, which verifies evidence against exit criteria before dispatching the next stage.
2. **Context Isolation & Fresh-Eyes Verification:** Implementation (`ifsmhp-development`, `ifsmhp-unit-test`) is strictly separated from evaluation (`ifsmhp-code-review`, `ifsmhp-security`, `ifsmhp-pr-validator`). Evaluators run with `readonly: true` and zero author confirmation bias.
3. **Structured Handoff Envelopes:** Prose summaries are insufficient. Every stage emits the canonical YAML/Markdown handoff block defined in [CONTRACTS.md](CONTRACTS.md) with `verdict: PASS | FAIL | BLOCKED`, concrete command exit codes, and changed-file manifests.
4. **Bounded Reflexion / Remediation Loops:** When Gate 2 (Tests), Gate 3 (Code Review), Gate 4 (Security), or Gate 6 (PR Validation) returns `FAIL`, the orchestrator routes actionable findings back to `ifsmhp-development` (max **3 remediation cycles** per gate) and re-verifies from Gate 2 so fixes never bypass tests or security.
5. **Least Privilege & Human-in-the-Loop (HITL) Guardrails:**
   - Reviewers/auditors/validators enforce `readonly: true`.
   - Autonomous execution proceeds through ordinary steps, pausing **only** at explicit policy/critical boundaries:
     - Merging to `main` or deploying to production when the user's request did not explicitly authorize merge/deploy (per workspace PR & deploy governance).
     - Destructive or critical infrastructure actions: deleting/resetting production data, modifying `www` / `@` / `ftp` DNS records, replacing working TLS certificates, opening public ports, or touching any server other than `ifsmhp` (`100.52.212.133`).
6. **Zero Secret Leakage & Production Database Safety:**
   - Never read-and-echo or commit `.env` secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `SMTP_PASS`, payment keys).
   - Never run `vitest`, `db:seed`, `db:migrate`, or `db:setup -- --reset` against production RDS (`api.ifsmhp.com`). All automated tests target local MySQL on port `3308` or an isolated `*_test` schema.

---

## Sequential 8-Stage Pipeline

```text
[User Request]
      │
      ▼
┌─────────────────────────────┐
│   ifsmhp-orchestrator       │ ◄─── Holds Master State, Skills & Gate Verifier
└─────────────┬───────────────┘
              │
   ┌──────────┼──────────────────────────────────────────────────────────┐
   ▼          ▼          ▼          ▼          ▼          ▼       ▼      ▼
[1.Dev] ──► [2.Test] ─► [3.Review] ► [4.Sec] ─► [5.PR] ─► [6.Val] ► [7.Mrg] ► [8.Deploy]
   ▲          │          │          │                     │                    │
   └──────────┴──────────┴──────────┴─────────────────────┘                    ▼
        Bounded Remediation Loop (re-enters Gate 1 → Gate 2)          [ifsmhp-release-verifier]
```

| Stage | Subagent (`.cursor/agents/`) | Mode | Primary Responsibility | Gate Exit Condition |
|---|---|---|---|---|
| **0** | `ifsmhp-orchestrator` | Read/Write | Scope analysis, branch isolation check, sequential dispatch, handoff verification | All requested stages `PASS` |
| **1** | `ifsmhp-development` | Read/Write | Architecture-aligned coding (`routes → middleware → controllers → services → prisma`, React + Zod), `typecheck`, `lint` | `typecheck` & `lint` exit `0`; clean scope |
| **2** | `ifsmhp-unit-test` | Read/Write | Author/update Vitest, frontend session, & Playwright tests; run suites on local port `3308` DB | Targeted & regression tests exit `0` |
| **3** | `ifsmhp-code-review` | `readonly` | Diff audit: architecture layering, exhaustive TS switches, no inline imports, state machines, UI states | Zero `CRITICAL` / `HIGH` defects |
| **4** | `ifsmhp-security` | `readonly` | OWASP & IFSMHP `docs/architecture.md` §B.3 (R1–R5) + §I.1–I.17 audit (BOLA, PII serializers, file streams, secrets) | Zero `CRITICAL` / `HIGH` security risks |
| **5** | `ifsmhp-pr-creator` | Read/Write | Feature branch check, secret-free staging, conventional commit, push, `gh pr create` / update | Open PR URL + clean `git status` |
| **6** | `ifsmhp-pr-validator` | `readonly` | Verify PR metadata, base branch (`main`), mergeability, CI checks (`gh pr checks`), diff vs scope, `npm run verify` readiness | Merge-ready PR, zero failing checks |
| **7** | `ifsmhp-pr-merger` | Read/Write | Enforce merge authorization gate, merge PR cleanly via `gh pr merge`, sync `main` | PR state `MERGED` on `main` |
| **8** | `ifsmhp-deployment` | Read/Write | Delegate/execute API rollout (`ifsmhp-operator`), SPA build/copy (`ifsmhp-frontend-release`), and mandatory live check (`ifsmhp-release-verifier`) | `ifsmhp-release-verifier` returns `PASS` |

---

## Connected Skills & Project References

Every agent in this pipeline connects to the repository's authoritative knowledge base:

- **Operational Skill:** `.cursor/skills/ifsmhp-operate/SKILL.md` — Local setup, Docker `ifsmhp-mysql` (`3308`), Prisma Windows DLL handling, build & deploy commands.
- **Contracts & Schemas:** `.cursor/skills/ifsmhp-sdlc-pipeline/CONTRACTS.md` — Input/output schemas, severity taxonomy, and orchestrator verification checklist.
- **System Docs:**
  - `docs/agentic-workflow.md` — Comprehensive end-to-end documentation of the multi-agent SDLC pipeline, sequence diagrams, remediation state machine, and walkthroughs.
  - `docs/architecture.md` — Actors, RBAC + BOLA rules `R1`–`R5`, state machines (§H), security controls (§I).
  - `docs/application-flow.md` — Request lifecycle, response envelopes, auth tokens/OTP, file streaming.
  - `docs/operations.md` — Local ports (`4000`, `5173`, `3308`), test harnesses, RDS SSL rules, production deployment steps.
  - `docs/api.md` — REST `/api/v1` contract and pagination envelope.
- **Specialist Operational Subagents:**
  - `.cursor/agents/ifsmhp-operator.md` — Environment, DB, local runtime, backend deploy.
  - `.cursor/agents/ifsmhp-frontend-release.md` — Production SPA build (`VITE_API_BASE_URL=https://api.ifsmhp.com/api/v1`) and Hostinger/EC2 sync.
  - `.cursor/agents/ifsmhp-release-verifier.md` — Post-PR and post-deploy live verification.

---

## Orchestrator Execution Protocol

1. **Determine Target Horizon:**
   - *Code + PR default* (standard feature/fix request): Run **Stages 1 → 6** (stop after open & validated PR unless user asked to merge/deploy).
   - *Full CI/CD delivery* (user explicitly requests merge and/or production deployment): Run **Stages 1 → 8** (including `ifsmhp-pr-merger`, `ifsmhp-deployment`, and `ifsmhp-release-verifier`).
   - *Targeted entry* (e.g., "validate and merge PR #31" or "deploy `main`"): Enter at the requested stage ONLY after verifying prerequisite gate artifacts exist (e.g., PR is validated before merge; `main` commit is merged before production deploy).
2. **Isolate Unrelated Worktree Changes:**
   - Before Stage 1, inspect `git status -sb`. Record any pre-existing uncommitted files in the Pipeline Context Manifest so downstream agents never stage, overwrite, or revert unrelated work.
3. **Dispatch One Stage at a Time:**
   - Pass the structured **Stage Dispatch Brief** ([CONTRACTS.md](CONTRACTS.md)) in each `Task` prompt because subagents start with an isolated, empty conversation window.
4. **Verify Handoff Before Advancing:**
   - Parse the subagent's **Stage Handoff Envelope**. Cross-check claimed files/commands if ambiguous. Never advance on `FAIL` or `BLOCKED`.
5. **Emit Final Pipeline Ledger:**
   - Conclude with a concise, auditable stage-by-stage summary showing every gate's status, test counts, PR link, and live verification result.
