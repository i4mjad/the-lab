# المعمل — The Lab

One discovery-to-delivery system that runs natively in Codex and Claude Code. The Lab defines its
workflow, governance, 14 specialist roles, artifact templates, schemas, and dependency catalog once;
generated host adapters are checksum-verified so drift fails validation.

## Install

Claude Code:

```bash
claude plugin marketplace add i4mjad/the-lab
claude plugin install the-lab@the-lab
```

Codex:

```bash
codex plugin marketplace add i4mjad/the-lab --ref v1.0.0
codex plugin add the-lab@the-lab
```

Then initialize a project:

```text
Codex:      $initialize
Claude:     /the-lab:initialize
```

Initialization writes canonical `AGENTS.md`, a short `CLAUDE.md` import shim, project-owned
`quality-gate.sh`, `.codex/config.toml`, hooks, and all generated Codex roles. It requires concrete
quality commands and thresholds for every active platform. Next, run the printed `$bootstrap` or
`/the-lab:bootstrap` command to install the reviewed, pinned stack packs.

> Bootstrap intentionally configures the global
> [`i-have-adhd`](https://github.com/ayghri/i-have-adhd) writing standard for both hosts. Claude gets
> its always-on marker; Codex gets the upstream-managed rules block in `~/.codex/AGENTS.md`.

## Public workflows

| Purpose | Codex | Claude Code |
|---|---|---|
| initialize or synchronize | `$initialize [--sync]` | `/the-lab:initialize [--sync]` |
| install verified dependencies | `$bootstrap <packs>` | `/the-lab:bootstrap <packs>` |
| run discovery through delivery | `$feature <brief>` | `/the-lab:feature <brief>` |
| run a standalone cross-host review | `$peer-review <target>` | `/the-lab:peer-review <target>` |

The feature pipeline is:

```text
discovery → requirements → product → architecture → design when UI exists → parallel build
          → full quality gate + applicable read-only reviewers → routed fixes, max 3 rounds
```

Five automated artifact gates protect discovery GO/PIVOT, requirements, product, architecture, and
design when UI exists. Claude-led work uses Codex `gpt-5.6-sol` at `xhigh`; Codex-led work uses Claude
Opus at `xhigh`. Each review is read-only, schema-validated, SHA-256-bound, resumable, and limited to
one rebuttal round. A failed independent reviewer retries once, then a fresh same-host highest-tier
reviewer takes over. If both routes fail, the result is a human gate—not an automatic approval.

## The 14 roles

| Stage | Roles |
|---|---|
| discovery and definition | `discovery`, `business-analyst`, `product-manager` |
| technical contract | `architect`, conditional `designer` |
| build | `frontend`, `ios`, `flutter`, `backend` |
| verify | `code-reviewer`, `qa-tester`, `api-tester`, conditional `mobile-qa`, `peer-reviewer` |

Canonical instructions live in `roles/`. Run `npm run generate` after changing a role; generated
Claude adapters live in `agents/`, Codex adapters in `.codex/agents/`, and checksums in
`generated/role-checksums.json`. CI runs `npm run generate:check` and rejects hand-edited adapters.

Reviewers use read-only host permissions. Document roles have no Claude shell access. Codex roles
cannot remove shell per role, so document authors are instruction-restricted and file-edit hooks
guard application paths. Shell hooks cannot classify every possible side effect; read-only reviewer
sandboxes are the hard boundary.

## Mechanical quality bar

Every active platform must configure and pass:

- tests and lint/typecheck;
- coverage and mutation thresholds;
- complexity and module-size limits;
- dependency rules.

Missing active configuration is a failure. Only inactive platforms are N/A. Builders may use
`QUICK=1` to defer mutation execution during a fix loop, but the final `./quality-gate.sh` run executes
everything. Agents cannot edit the bar they are graded against.

## Mobile QA

Mobile work uses pinned
[`@mobilenext/mobile-mcp@1.0.2`](https://github.com/mobile-next/mobile-mcp) with telemetry disabled and
an attach-only allowlist. `mobile-qa` requires an already booted device and an already running,
authenticated app. It may inspect screenshots/accessibility and perform user-level interactions. It
may never build, install, uninstall, launch, terminate, relaunch, create, boot, erase, reset, or change
orientation. Missing MCP, device, app, or authenticated state blocks shipping.

## Reviewed dependency catalog

`skills.manifest.json` records host support, status, license, source, exact resolution, trust review,
and invocation policy. `skills-lock.json` makes updates reviewable.

- Automatic core: `grilling`, `architecture-designer`, `tdd`, `code-review`, `api-testing`, and web
  `accessibility`.
- Official-first conditional packs: SwiftUI, [Flutter agent plugins](https://github.com/flutter/agent-plugins),
  Supabase, Firebase, and a maintainer-trusted .NET pack.
- User-only workflows: `grill-me`, `to-spec`, `to-tickets`, and `wayfinder`.
- Explicit opt-ins: contextual design sources and `code-review-graph`; Tailwind only for Tailwind
  projects.

External marketplace authentication, service credentials, and optional connector setup remain owned
by the user. The Lab never pipes a remote installer into Node.
The .NET pack currently has no upstream license declaration, so bootstrap requires the explicit
`--accept-unverified-license dotnet-clean-arch` trust decision before installing it.

## Migrate from `cc-setup`

Do not load both identities together. Follow [docs/MIGRATION.md](docs/MIGRATION.md): uninstall the
old plugin, install `the-lab`, then run `$initialize --sync` or `/the-lab:initialize --sync`.
Untouched generated files and the managed quality runner update; project-owned governance and quality
configuration stay unchanged. A hand-edited adapter or runner is reported with a diff and is never
overwritten.

## Develop and validate

Requirements: Node.js 22+, `jq`, Git, and at least one host CLI. macOS is required for native iOS
verification. Live cross-host smoke tests also require authenticated Codex and Claude Code sessions.

```bash
npm test
npm run validate
claude plugin validate --strict .
```

For a local marketplace, replace `i4mjad/the-lab` with the checkout path. See
[docs/ORCHESTRATION.md](docs/ORCHESTRATION.md) for state transitions and failure behavior.
