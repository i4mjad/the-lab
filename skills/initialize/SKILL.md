---
name: initialize
description: Create or safely synchronize The Lab governance, quality gate, Codex config, and generated role adapters in a project.
argument-hint: [--sync] [--dry-run]
---

# Initialize

Resolve `<lab-root>` from this skill's directory (`../..`). Read the target repository before writing.

## New project

1. Interview once for: project name/purpose/state; market/audience/privacy/compliance/localization;
   active platforms (`web ios flutter backend`); concrete stack choices; automation defaults; explicit
   design opt-ins; and every quality command/threshold for each active platform.
2. Missing tests, lint/typecheck, coverage, complexity, module size, dependency rules, or mutation
   configuration for an active platform is not an acceptable completed initialization. Keep asking or
   leave initialization visibly blocked.
3. Pass the answers to:

   ```text
   node <lab-root>/scripts/initialize.mjs --target . --answers-json '<json>' [--dry-run]
   ```

4. The script creates `AGENTS.md`, short `CLAUDE.md`, executable `quality-gate.sh`,
   `.codex/config.toml`, `.codex/hooks.json`, `.codex/agents/*.toml`, and `.the-lab/state.json`.
5. Print the exact `$bootstrap <keys>` and Claude `/the-lab:bootstrap <keys>` command. Stop; initialize
   never starts a feature.

## Synchronize

Run `node <lab-root>/scripts/initialize.mjs --target . --sync [--dry-run]`.

- Untouched generated files and managed `AGENTS.md` blocks update.
- Project-owned blocks and `quality-gate.sh` configuration remain byte-for-byte; the untouched managed
  quality runner updates.
- Any hand-edited generated adapter becomes report-only: show an actionable unified diff and do not
  overwrite it. A divergent file is a successful preservation result, not permission to replace it.
- Missing generated files are restored. Never re-run the interview in sync mode.

The script verifies file presence, executable guards, and the state ledger before returning. Surface
every report-only file and any verification failure.
