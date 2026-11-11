# IFSMHP Multi-Agent Orchestration Guide (`AGENTS.md`)

This repository implements a deterministic **Supervisor-Worker Agentic SDLC Pipeline** following Generative AI & Agentic Systems standards (Context Isolation, Structured Handoff Envelopes, Independent Read-Only Verification Gates, Bounded Reflexion Loops, and Least-Privilege HITL Guardrails).

---

## 1. Master Orchestrator & Connected Skills

- **End-to-End Architecture & Workflow Documentation:**
  - [`docs/agentic-workflow.md`](docs/agentic-workflow.md) — Complete specification of the multi-agent architecture, sequence diagrams, handoff envelopes, remediation state machine, governance gates, and concrete walkthroughs.
- **Orchestrative Supervisor Agent:** [`.cursor/agents/ifsmhp-orchestrator.md`](.cursor/agents/ifsmhp-orchestrator.md)
  - Owns the complete functional pipeline, maintains the Pipeline State Ledger, dispatches specialist subagents **one by one in strict sequence**, verifies every stage's YAML `handoff_envelope`, and manages bounded remediation loops.
- **Pipeline Skill & Schemas:**
  - [`.cursor/skills/ifsmhp-sdlc-pipeline/SKILL.md`](.cursor/skills/ifsmhp-sdlc-pipeline/SKILL.md) — End-to-end 8-stage workflow & governance horizons.
  - [`.cursor/skills/ifsmhp-sdlc-pipeline/CONTRACTS.md`](.cursor/skills/ifsmhp-sdlc-pipeline/CONTRACTS.md) — Canonical `Pipeline Dispatch Brief` (input) and `Stage Handoff Envelope` (output).
- **Platform Operations Skill:**
  - [`.cursor/skills/ifsmhp-operate/SKILL.md`](.cursor/skills/ifsmhp-operate/SKILL.md) — Local Docker MySQL (`:3308`), Express API (`:4000`), Vite SPA (`:5173`), Prisma Windows DLL rules, and deployment commands.

---

## 2. Sequential Agent Pipeline (Development → Deployment)

```text
User Objective
     │
     ▼
[0] ifsmhp-orchestrator  (Supervisor: Scope, Branch Isolation, Gate Verification)
     │
     ├──► [1] ifsmhp-development     (Code + Prisma + UI, typecheck & lint)
     │         ▲
     ├──► [2] ifsmhp-unit-test       (Vitest + Session + Playwright on local :3308 DB)
     │         │ (FAIL loops back to [1])
     ├──► [3] ifsmhp-code-review     (readonly: Layering, TS Exhaustive Switch, Regressions)
     │         │ (FAIL loops back to [1] → re-runs from [2])
     ├──► [4] ifsmhp-security        (readonly: OWASP, BOLA R1–R5, I.1–I.17, Secret Scan)
     │         │ (FAIL loops back to [1] → re-runs from [2])
     ├──► [5] ifsmhp-pr-creator      (Topic branch, selective staging, push, gh pr create)
     │
     ├──► [6] ifsmhp-pr-validator    (readonly: Base=main, Mergeable, Diff Audit, CI Checks)
     │         │  ──► [Default Stop Gate: Validated PR URL returned unless merge/deploy requested]
     ├──► [7] ifsmhp-pr-merger       (Explicit merge gate: gh pr merge → main sync)
     │
     └──► [8] ifsmhp-deployment      (Explicit deploy gate: Backend + Frontend + Release Verifier)
               ├── ifsmhp-operator           (EC2 100.52.212.133 API & db:deploy)
               ├── ifsmhp-frontend-release   (VITE_API_BASE_URL prod build & dist sync)
               └── ifsmhp-release-verifier   (Mandatory live PR, TLS, DNS, API & Hostinger check)
```

---

## 3. Agent Directory Reference

| Agent | File | Write Access | Primary Mandate |
|---|---|---|---|
| **Orchestrator** | `.cursor/agents/ifsmhp-orchestrator.md` | Read/Write | Master flow controller & handoff gate verifier |
| **Stage 1 — Development** | `.cursor/agents/ifsmhp-development.md` | Read/Write | Express/Prisma/React implementation, `typecheck`, `lint` |
| **Stage 2 — Unit Testing** | `.cursor/agents/ifsmhp-unit-test.md` | Read/Write | Vitest, frontend session, & Playwright tests on dev DB |
| **Stage 3 — Code Review** | `.cursor/agents/ifsmhp-code-review.md` | `readonly` | Architecture layering, state machines, TS standards, UI states |
| **Stage 4 — Security** | `.cursor/agents/ifsmhp-security.md` | `readonly` | BOLA (`R1`–`R5`), PII serializers, uploads, webhooks, secrets |
| **Stage 5 — PR Creator** | `.cursor/agents/ifsmhp-pr-creator.md` | Read/Write | Branch safety, clean staging, commit, push, `gh pr create` |
| **Stage 6 — PR Validator** | `.cursor/agents/ifsmhp-pr-validator.md` | `readonly` | PR metadata, conflict check, file scope audit, `gh pr checks` |
| **Stage 7 — PR Merger** | `.cursor/agents/ifsmhp-pr-merger.md` | Read/Write | Authorized `gh pr merge` into `main` with SHA verification |
| **Stage 8 — Deployment** | `.cursor/agents/ifsmhp-deployment.md` | Read/Write | Production rollout + mandatory `ifsmhp-release-verifier` |
| **Specialist — Operator** | `.cursor/agents/ifsmhp-operator.md` | Read/Write | Local/remote runtime, MySQL `:3308`, `db:deploy` |
| **Specialist — Frontend Release** | `.cursor/agents/ifsmhp-frontend-release.md` | Read/Write | Production SPA build & `/opt/ifsmhp/frontend/dist` publish |
| **Specialist — Release Verifier** | `.cursor/agents/ifsmhp-release-verifier.md` | Read-only checks | Live verification of PR, API TLS, DNS, EC2, and Hostinger |

---

## 4. How to Invoke

- **Full Supervised Delivery (Code → Tests → Review → Security → Validated PR):**
  > `/ifsmhp-orchestrator Implement <feature or bugfix>`
- **Full Release Delivery (Code → Validated PR → Merge → Production Deploy → Live Verify):**
  > `/ifsmhp-orchestrator Implement <feature>, merge the PR to main, and deploy to production`
- **Individual Stage Execution (Direct Specialist Invocation):**
  > `/ifsmhp-code-review`, `/ifsmhp-security`, `/ifsmhp-pr-validator`, `/ifsmhp-release-verifier`, etc.
