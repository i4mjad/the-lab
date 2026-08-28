---
name: feature
description: Run The Lab's governed discovery-to-delivery pipeline for a feature or product brief under Codex or Claude Code.
argument-hint: <brief, path, or initiative description>
---

# Feature

Run one canonical workflow. Read `AGENTS.md` before dispatching any role. The main thread is the
orchestrator: it creates artifacts, dispatches specialists, writes consolidated logs, routes findings,
and controls gates. It does not perform specialist work.

Resolve `<lab-root>` from this skill's own directory (`../..`). Under Claude Code,
`${CLAUDE_PLUGIN_ROOT}` points to the same root. Never require that variable under Codex.

## 0. Preflight

1. Require a git repository and read `AGENTS.md` §4, §5, §9, and §10.
2. Run `<lab-root>/scripts/bootstrap.sh --verify-writing-standard`. A missing Claude always-on marker
   or missing upstream-managed Codex rules block blocks every document pipeline. Stop with the exact
   remediation from the script.
3. Run `<lab-root>/scripts/generate-role-adapters.mjs --check`. Adapter drift blocks dispatch.
4. Detect the leader host: `CODEX_HOME`/Codex session → `codex`; `CLAUDE_PLUGIN_ROOT`/Claude session →
   `claude`. If ambiguous, ask once. Record it in the gate log.
5. Follow `AGENTS.md` §9 for branch/worktree policy. Never impose the default over a project override.
6. At each conditional transition, run `node <lab-root>/scripts/pipeline-policy.mjs --input-json
   '<current-state-json>'`. Treat its STOP, HUMAN_GATE, BLOCKED, and NOT_SHIPPABLE states as terminal;
   the prose below defines how to collect the input, not permission to contradict the policy result.

## 1. Setup

Create a stable kebab-case `<slug>`. Create the feature worktree/branch only when §9 requires it.
Pre-create every applicable artifact from `<lab-root>/docs/_templates/`; role authors fill existing
files instead of needing plugin-root paths:

- `docs/discovery/<slug>.md`
- `docs/requirements/<slug>-business-requirements.md`
- `docs/product/<slug>-product-spec.md`
- `docs/architecture/<slug>/spec.md` and task directory
- `docs/design/<slug>/design.md` only when UI exists
- `docs/reviews/<slug>/gates.md`
- `docs/reports/<slug>/completion-report.md` and `review.md`

## 2. Discovery and scope

1. Dispatch `discovery` with the raw brief.
2. On `KILL`, stop before any automated review. Show evidence and kill criteria. Only the user can
   overrule; an override starts a new recorded round.
3. On `GO` or `PIVOT`, run the discovery artifact gate (Gate protocol below). Only the approved
   **Handoff to BA** crosses downstream.
4. Size the surviving v1. If one pass is not independently shippable, propose ordered phases and stop
   for the one phase-plan human gate. Discovery is not repeated per phase.

## 3. Artifact stages

For each phase, run in order:

1. `business-analyst` → requirements gate.
2. `product-manager` → product gate.
3. `architect` → architecture gate.
4. If any acceptance criterion changes UI, `designer` → design gate. Otherwise record design as N/A.

Each author may hand backward to the owning upstream role. A changed artifact invalidates its old hash
and re-runs that gate. Maximum three author/review rounds per artifact; then return `HUMAN_GATE`.

## 4. Gate protocol

For `discovery | requirements | product | architecture | design`:

1. Hash the artifact with SHA-256.
2. Run:

   ```text
   node <lab-root>/scripts/review-bridge.mjs \
     --leader <claude|codex> --stage <stage> --artifact <path> \
     --log docs/reviews/<slug>/gates.jsonl
   ```

3. The bridge enforces the review matrix:
   - Claude leader → Codex `gpt-5.6-sol`/`xhigh`; retry once; fallback fresh Claude Opus/`xhigh`.
   - Codex leader → Claude Opus/`xhigh`; retry once; fallback fresh Codex
     `gpt-5.6-sol`/`xhigh`.
4. Dispatch `peer-reviewer` with the bridge result. It verifies every finding, submits cited disputes
   for exactly one same-session rebuttal, and returns the final adjudication. Resume the bridge with
   the same `--log`; it appends an `adjudicated-final` event containing surviving findings, disputes,
   replies, and final verdict.
5. Append the human-readable exchange to `gates.md`: leader/reviewer host, model, effort, session,
   fallback reason, artifact hash, attempts, full findings, disputes, replies, and verdict.
6. Re-hash before advancing. Stale hashes, invalid schemas, held disputes, or both reviewer routes
   failing become a human gate. Never auto-approve an unreviewed artifact.

## 5. Build

Read active platforms from `AGENTS.md` §5 and dispatch only their task owners in parallel:

- `web` → `frontend`
- `ios` → `ios`
- `flutter` → `flutter`
- `backend` → `backend`

Each builder uses `tdd`, covers every owned AC, runs `QUICK=1 ./quality-gate.sh <platform>`, and fills
only its completion-report section. Missing active metric configuration is a failure. Inactive
platforms are N/A. Build agents never edit `quality-gate.sh`.

## 6. Verify and route fixes

1. Run full `./quality-gate.sh` without `QUICK`. Every FAIL is a non-adjudicable blocker owned by its
   platform. Mutation runs here.
2. In parallel, dispatch applicable verifiers:
   - always: `code-reviewer` and `peer-reviewer` in code mode;
   - web active: `qa-tester`;
   - backend active: `api-tester`;
   - ios or flutter active: `mobile-qa`.
3. Mobile QA is attach-only. Missing pinned Mobile MCP, no already-booted device, no already-running
   app, or no authenticated session blocks mobile shipping. Never ask mobile-qa to build, install,
   uninstall, launch, terminate, relaunch, create, boot, erase, reset, or change orientation.
4. Consolidate all findings into `review.md`. Route each blocker/major and quality FAIL by owner.
5. Re-run focused reviewers and the quick platform gate after fixes. A final candidate always gets all
   applicable reviewers and the full gate.
6. Green is zero open blockers/majors, no unresolved peer dispute, all applicable verifier evidence,
   and a full quality-gate PASS. Minors may ship only when listed.
7. Stop after three build/review rounds. Remaining blocker/major or gate failure means
   `NOT SHIPPABLE`; preserve the worktree for resume.

## 7. Finish

On green, follow §9 to merge and clean up. Report the shipped scope, tests, metric table, gate verdicts,
mobile evidence when applicable, minor findings, dependency changes, and commit/merge result. Never
load the old `cc-setup` plugin alongside The Lab.
