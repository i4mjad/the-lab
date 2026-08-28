# The Lab orchestration contract

`AGENTS.md` is the project authority. `CLAUDE.md` imports it and contains Claude-only notes. The main
host thread owns pipeline state, creates artifact files before dispatch, invokes specialists, records
review logs, and routes findings. Specialists do not silently repair another role's artifact.

## State machine

```text
preflight
  ├─ missing writing standard / adapter drift / active quality config → BLOCKED
  └─ ready → discovery
       ├─ KILL → STOP (user override only)
       └─ GO or PIVOT → discovery gate
            → requirements gate → product gate → architecture gate
            ├─ no UI → build
            └─ UI → design gate → build
                 → full quality + applicable reviewers
                      ├─ blocker/major → owner fix → re-review (max 3)
                      ├─ missing mobile session/reviewer routes → HUMAN_GATE or BLOCKED
                      └─ green → merge using AGENTS.md §9
```

Large work may split into user-approved, independently shippable phases after discovery. Discovery is
shared; each phase gets its own downstream artifacts and gates.

## Gate matrix

| Leader | Independent reviewer | Retry | Fresh fallback |
|---|---|---:|---|
| Claude Code | Codex `gpt-5.6-sol`, `xhigh` | once | Claude Opus, `xhigh` |
| Codex | Claude Opus, `xhigh` | once | Codex `gpt-5.6-sol`, `xhigh` |

The bridge runs the reviewer in a read-only permission mode, validates structured output, binds it to
the artifact SHA-256, and logs host/model/effort/session/attempts/fallback/findings/verdict as JSONL.
`peer-reviewer` may dispute a finding with cited evidence once; the same reviewer session must answer.
An artifact edit invalidates the hash. Invalid output, stale bytes, unresolved disputes, or two failed
review routes cannot advance automatically.

## Build and verification routing

| Active platform | Builder | Required extra verification |
|---|---|---|
| web | `frontend` | browser `qa-tester`, accessibility |
| ios | `ios` | attach-only `mobile-qa` |
| flutter | `flutter` | attach-only `mobile-qa` |
| backend | `backend` | `api-tester` |

`code-reviewer` and cross-host `peer-reviewer` always run. Only active platforms run builders. A
non-UI feature records design N/A; it does not fabricate a design gate. Native mobile shipping is
blocked without pinned Mobile MCP and an already running authenticated session.
Mobile QA never builds, installs, uninstalls, launches, terminates, relaunches, creates, boots, erases,
resets, or changes orientation.

The orchestrator runs the complete `quality-gate.sh` before reviewers. Every active metric is
mandatory, and every FAIL is a non-adjudicable owner blocker. `QUICK=1` exists only for builder fix
loops and skips mutation execution only; it cannot produce final green.

## Write ownership

| Owner | Files |
|---|---|
| definition roles | their pre-created discovery/requirements/product/architecture/design artifact |
| builders | application code plus their completion-report section |
| orchestrator | gate JSONL/Markdown, consolidated review, final report, branch/worktree state |
| reviewers | none; evidence and findings are returned to the orchestrator |
| project owner | `quality-gate.sh` configuration and project-owned `AGENTS.md` blocks |

Claude file-edit payloads and Codex `apply_patch` payloads pass through the same guard. Reviewer
read-only permissions remain authoritative because shell-side effects cannot be exhaustively detected
by hooks.
