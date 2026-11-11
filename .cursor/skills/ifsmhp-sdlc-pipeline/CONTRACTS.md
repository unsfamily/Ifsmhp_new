# IFSMHP Agentic Handoff Contracts & Gate Schemas

This document is the binding contract between `.cursor/agents/ifsmhp-orchestrator.md` and every stage subagent in `.cursor/agents/`. Because each subagent runs in an isolated context window, **all context travels through the Dispatch Brief (input) and Handoff Envelope (output)**.

---

## 1. Stage Dispatch Brief (Orchestrator → Subagent Input)

Whenever `ifsmhp-orchestrator` invokes a subagent via `Task`, it MUST supply this exact brief structure in the prompt:

```markdown
## Pipeline Dispatch Brief
- **Pipeline Run ID:** <short-slug-or-branch>
- **Current Stage:** <1..8> — <Stage Name>
- **Target Horizon:** <STAGE_6_PR_VALIDATED | STAGE_7_PR_MERGED | STAGE_8_DEPLOYED>
- **User Objective:** <concise statement of requested feature/fix/release>
- **Working Branch:** <branch-name> (Base: `main`)
- **Pre-existing Dirty Files (DO NOT STAGE/TOUCH):** <list or `none`>
- **In-Scope Changed Files:** <list from prior stage or `to be determined in Stage 1`>
- **Prior Gate Evidence Summary:**
  - Stage 1 (Dev): <PASS/N/A + key notes>
  - Stage 2 (Unit Test): <PASS/N/A + test command & counts>
  - Stage 3 (Code Review): <PASS/N/A>
  - Stage 4 (Security): <PASS/N/A>
  - Stage 5 (PR Creator): <PR # & URL or N/A>
  - Stage 6 (PR Validator): <PASS/N/A>
  - Stage 7 (PR Merger): <merge SHA or N/A>
- **Remediation Feedback (if re-run):** <exact findings to fix, or `none`>
- **Required Instruction File:** Read `.cursor/agents/<agent-name>.md` and return the canonical `Stage Handoff Envelope`.
```

---

## 2. Stage Handoff Envelope (Subagent → Orchestrator Output)

Every subagent MUST end its response with this structured block so `ifsmhp-orchestrator` can deterministically validate completion:

```yaml
handoff_envelope:
  stage: "<1..8>"
  agent: "<ifsmhp-...>"
  verdict: "PASS" # Allowed: PASS | FAIL | BLOCKED
  branch: "<git-branch>"
  head_sha: "<short-sha-or-uncommitted>"
  touched_files:
    - "<relative/path/to/file>"
  commands_executed:
    - cmd: "<exact command>"
      exit_code: 0
      summary: "<concise factual outcome>"
  gate_checks:
    - check: "<criterion name>"
      status: "PASS" # PASS | FAIL | SKIPPED
      evidence: "<file:line, test count, URL, or check output>"
  findings: # Empty array [] if none; required when verdict is FAIL or BLOCKED
    - id: "<F-01>"
      severity: "CRITICAL" # CRITICAL | HIGH | MEDIUM | LOW | INFO
      category: "<arch | authz | security | test | type | lint | ci | infra>"
      location: "<filepath:line>"
      issue: "<precise defect>"
      remediation: "<minimal concrete fix>"
  artifacts:
    pr_number: null       # Populated in Stages 5-8
    pr_url: null          # Populated in Stages 5-8
    merge_commit: null    # Populated in Stages 7-8
    deploy_targets: []    # Populated in Stage 8 (e.g., api.ifsmhp.com, /opt/ifsmhp/frontend/dist, www.ifsmhp.com)
  next_recommended_stage: "<stage-agent-name or REMEDIATE_STAGE_1 or COMPLETE>"
```

---

## 3. Severity Taxonomy & Gate Blocking Policy

| Severity | Definition | Blocks Gate? | Orchestrator Action |
|---|---|---|---|
| `CRITICAL` | Broken auth/BOLA (`R1`–`R5`), secret leak, data loss/prod DB hazard, crash, failing build/test, broken prod check | **YES** | Immediate `FAIL` → route to `ifsmhp-development` (or halt & escalate if infra/authz blocker) |
| `HIGH` | Missing validation (`.strict()`), state-machine bypass, missing regression test, inline import, non-exhaustive union switch, unhandled UI error/empty state | **YES** | `FAIL` → route to `ifsmhp-development` (max 3 loops) |
| `MEDIUM` | Suboptimal query/type, minor edge-case test gap, non-idiomatic error message | Conditional | Fix if within touched lines and low-risk; otherwise record in PR notes |
| `LOW` / `INFO` | Style nit, future refactor idea outside scope | **NO** | Record only; never churn unrelated code |

---

## 4. Orchestrator Gate Verification Checklist

Before transitioning from Stage `N` to Stage `N+1`, `ifsmhp-orchestrator` verifies:

1. **Gate 1 → Gate 2 (Dev → Unit Test):**
   - `verdict == PASS`
   - `npm run typecheck` and `npm run lint` (or workspace-scoped equivalents) exited `0`.
   - Pre-existing unrelated dirty files were left untouched.
   - Prisma migrations (if schema changed) are additive/safe and Prisma client was regenerated.

2. **Gate 2 → Gate 3 (Unit Test → Code Review):**
   - `verdict == PASS`
   - New or updated unit/integration tests directly exercise the changed behavior (happy path + validation/authz failure path).
   - Tests executed against local dev/test MySQL (`:3308`), never production.

3. **Gate 3 → Gate 4 (Code Review → Security):**
   - `verdict == PASS` with zero `CRITICAL` or `HIGH` findings.
   - Layering (`routes → middleware → controllers → services → prisma`), `no-inline-imports`, `typescript-exhaustive-switch`, and UI empty/error states confirmed.

4. **Gate 4 → Gate 5 (Security → PR Creator):**
   - `verdict == PASS` with zero `CRITICAL` or `HIGH` findings.
   - Verified against `docs/architecture.md` §B.3 (`R1`–`R5`) and §I (`I.1`–`I.17`), plus secret scan on diff.

5. **Gate 5 → Gate 6 (PR Creator → PR Validator):**
   - Feature/fix branch used (never direct push to `main`).
   - Only in-scope files committed; zero `.env` or secret files staged.
   - PR opened/updated against `main` with traceability summary and test evidence.

6. **Gate 6 → Gate 7 or STOP (PR Validator → PR Merger):**
   - PR state is `OPEN`, mergeable (`CONFLICTING` == false), base is `main`, all attached CI checks green (or locally proven via `npm run verify` when repo has no remote Actions workflow).
   - **Governance Gate:** If the user did NOT ask to merge, **STOP cleanly here** and return the validated PR URL. Proceed to Stage 7 only when merge (or end-to-end deploy) was requested by the user.

7. **Gate 7 → Gate 8 or STOP (PR Merger → Deployment):**
   - PR state confirmed `MERGED` into `main` with merge commit SHA recorded.
   - **Governance Gate:** Proceed to Stage 8 only when deployment was requested by the user.

8. **Gate 8 → COMPLETE (Deployment → Release Verification):**
   - Backend (`api.ifsmhp.com`) and/or Frontend (`/opt/ifsmhp/frontend/dist` + Hostinger status) deployed per scope without touching forbidden DNS/certs/prod seed.
   - `.cursor/agents/ifsmhp-release-verifier.md` executed and returned `PASS`. Never declare deployment complete without `ifsmhp-release-verifier` passing.
