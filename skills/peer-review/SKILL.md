---
name: peer-review
description: Run a read-only, hash-bound, schema-validated cross-host review of an artifact or branch and one evidence-based rebuttal round.
argument-hint: [path/to/artifact.md | git-ref] [--leader claude|codex]
---

# Peer review

Read `AGENTS.md`. Resolve `<lab-root>` from this skill's directory (`../..`). Review only; change
nothing.

Map artifact paths to stages: `docs/discovery` → discovery, `docs/requirements` → requirements,
`docs/product` → product, `docs/architecture` → architecture, `docs/design` → design. Any other
Markdown path requires the user to select a rubric. A missing path is an error, not a guessed git ref.

Create an ephemeral audit log outside the target repository for a standalone review. Run
`node <lab-root>/scripts/review-bridge.mjs --leader <host> --stage <stage|code>
--artifact <path-or-ref> --log <ephemeral-log>`, then dispatch `peer-reviewer` to adjudicate the result.

If the peer disputes findings, resume with the same `--log` plus `--resume-session`,
`--reviewer-host`, and `--disputes-json`. The bridge rejects a mismatched prior event and a second
rebuttal for the same session/hash. Use the returned `adjudicated-final` event as the verdict; never
report the pre-rebuttal verdict as final.

Return verdict, reviewer host/model/effort/session, artifact hash, fallback reason, full findings, and
the verbatim dispute exchange. If both reviewer routes fail, return `HUMAN_GATE`. Do not offer or apply
fixes until the user makes a separate change request.
