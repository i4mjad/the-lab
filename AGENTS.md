# المعمل — The Lab: plugin development

This repository is the canonical dual-host plugin: shared skills, role catalog, governance, review
bridge, and generated adapters for Claude Code and Codex. `templates/AGENTS.md` is the consuming-project
governance template; this file governs the plugin itself.

## Rules

- Run `bash scripts/validate.sh` before every commit. CI runs the same validation.
- The canonical pipeline is `skills/feature/SKILL.md`; keep `docs/ORCHESTRATION.md`,
  `templates/AGENTS.md` §2, and `README.md` consistent with it.
- Owner vocabulary is exactly `frontend | ios | flutter | backend`. Changes touch the architect,
  builders, reviewers, report templates, quality gate, and feature router.
- The role count is 14. Edit roles only in `roles/catalog.json` and `roles/*.md`, then run
  `npm run generate`. Direct changes under `agents/` or `.codex/agents/` are generated drift.
- Every artifact stage has a corresponding file under `docs/_templates/` (requirements uses
  `business-requirements`, product uses `product-spec`, and architecture uses `architecture-spec`).
  Every automated gate has `prompts/<stage>-gate.md`; the set is discovery, requirements, product,
  architecture, and design.
- Bump both plugin manifests and `package.json` for behavior changes.
- Third-party dependencies are pinned in `skills-lock.json`. Manifest and lock changes travel together
  so updates produce a reviewable dependency diff.
- `hooks/guard-writes.sh` understands Claude edit payloads and Codex `apply_patch`. Reviewer adapters
  also use read-only host permissions. Shell hooks are a guardrail, not a complete sandbox; document
  authors therefore receive no shell tool in Claude.
- Preserve unrelated and user-authored worktree changes. Generated adapters are the exception: always
  regenerate them from the canonical role source.
