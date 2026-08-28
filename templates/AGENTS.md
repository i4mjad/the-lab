# <PROJECT_NAME> — Project Governance

This is the canonical project governance for **المعمل — The Lab**. Every Claude Code and Codex role
reads it before acting. Project-owned blocks are preserved by `$initialize --sync`.

<!-- the-lab:project:purpose:start -->
## 1. Purpose

<PROJECT_NAME> is <ONE_LINE_PRODUCT_DESCRIPTION>.

- Repository state: <GREENFIELD_OR_EXISTING>
<!-- the-lab:project:purpose:end -->

<!-- the-lab:managed:workflow:start -->
## 2. Team and pipeline

14 specialists follow one discovery → delivery workflow. The main thread orchestrates; it does not
perform a specialist's work.

```text
discovery ─[gate]→ business-analyst ─[gate]→ product-manager ─[gate]→ architect ─[gate]→
  designer ─[gate, UI only]→ frontend / ios / flutter / backend (active platforms, parallel) →
  code-reviewer + qa-tester + api-tester + mobile-qa + peer-reviewer (applicable roles, parallel) →
  routed fixes → re-review, at most 3 rounds

discovery KILL → stop; only the user may overrule
```

The five artifact gates are discovery GO/PIVOT, requirements, product, architecture, and design when
UI exists. Claude-led runs use Codex `gpt-5.6-sol`/`xhigh`; Codex-led runs use Claude Opus/`xhigh`.
The bridge retries the independent reviewer once, then uses a fresh same-host highest-tier fallback.
If both routes fail, the artifact returns to a human gate. Verdicts are schema-validated, SHA-256-bound,
resumable, and allow exactly one cited rebuttal round.

Large work is split into user-approved shippable phases after discovery. Routine work stays one phase.
KILL, non-UI, inactive-platform, missing-reviewer, and three-round-cap paths are explicit states, never
silent skips.

## 3. Artifact layout

```text
AGENTS.md
CLAUDE.md
quality-gate.sh
.codex/config.toml
.codex/agents/*.toml
docs/discovery/<slug>.md
docs/requirements/<slug>-business-requirements.md
docs/product/<slug>-product-spec.md
docs/architecture/<slug>/spec.md
docs/architecture/<slug>/tasks/NN-<title>.md
docs/design/<slug>/design.md                 # UI only
docs/reviews/<slug>/gates.md
docs/reports/<slug>/completion-report.md
docs/reports/<slug>/review.md
```
<!-- the-lab:managed:workflow:end -->

<!-- the-lab:project:domain:start -->
## 4. Domain defaults

- Region and market: <REGION_AND_MARKET>
- Audience: <AUDIENCE>
- Privacy, safety, and compliance: <PRIVACY_SAFETY_COMPLIANCE>
- Languages and RTL: <LOCALIZATION_AND_RTL>
<!-- the-lab:project:domain:end -->

<!-- the-lab:project:stack:start -->
## 5. Stack and active platforms

- Active platforms: <SPACE_SEPARATED_WEB_IOS_FLUTTER_BACKEND>
- Web: <WEB_STACK_OR_INACTIVE>
- Mobile: <IOS_FLUTTER_BOTH_OR_INACTIVE>
- Backend: <DOTNET_SUPABASE_FIREBASE_CUSTOM_OR_INACTIVE>
- Automation and AI: <AUTOMATION_DEFAULTS_OR_NONE>
- Optional design tools: <EXPLICIT_OPT_INS_OR_NONE>
<!-- the-lab:project:stack:end -->

<!-- the-lab:managed:standards:start -->
## 6. Delivery and writing standards

- Prefer the simplest implementation that satisfies current acceptance criteria. Apply SOLID, DRY,
  and YAGNI to reduce complexity, never to create speculative structure.
- Every owned acceptance criterion has a test. Use TDD at stable seams; run focused checks during work
  and the complete quality gate before shipping.
- The mandatory global `i-have-adhd` standard applies to every document: action first, bounded numbered
  steps, concrete values, lists capped at five, no preamble or closing recap. Bootstrap must verify the
  Claude always-on marker and the upstream-managed Codex rules block before document work starts.
- Automatic agents use only automatic skills from the lockfile. `grill-me`, `to-spec`, `to-tickets`,
  and `wayfinder` are user-only workflows and are never invoked automatically.
- Document authors have no Claude shell tool. Codex cannot remove the shell per role, so document roles
  are instruction-restricted and hook-guarded. Hooks cannot prove every possible shell side effect;
  reviewer read-only sandboxes are the hard boundary for review work.

## 7. Traceability and handoffs

Every chain is explicit: discovery risk → business outcome → story/AC → owner-tagged architecture task
→ implementation → test evidence → review finding. Downstream ambiguity goes backward to its owner;
agents do not silently repair upstream scope.

## 8. Verification and shipping

Green requires zero open blockers/majors, a full `./quality-gate.sh` pass, and all applicable verifier
evidence. Every active platform configures tests, lint/typecheck, coverage, complexity, module size,
dependency rules, and mutation testing. Missing active configuration is a failure. Inactive platforms
are N/A. `QUICK=1` skips mutation execution only during build loops; final verification runs it.

Mobile initiatives also require attach-only `mobile-qa`: Mobile MCP must be present, a device must
already be booted, and the app must already be running and authenticated. The agent never builds,
installs, uninstalls, launches, terminates, relaunches, creates, boots, erases, resets, or changes
orientation. Missing prerequisites block shipping.

<!-- the-lab:managed:standards:end -->

<!-- the-lab:project:git:start -->
## 9. Git policy

Default: one `feature/<slug>` worktree per initiative, based on `develop`, merged only after green.
Replace this block with the repository's actual policy; `$initialize --sync` preserves it.
<!-- the-lab:project:git:end -->

<!-- the-lab:managed:quality:start -->
## 10. Quality gate ownership

`quality-gate.sh` configuration is the project-owned mechanical bar. Agents may make the
implementation pass but may not edit the commands, active platforms, or thresholds they are graded
against. `$initialize --sync` may update only an untouched managed runner block.
<!-- the-lab:managed:quality:end -->
