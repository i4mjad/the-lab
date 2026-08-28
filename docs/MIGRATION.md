# Migrate from `cc-setup` to The Lab 1.0.0

The GitHub repository was renamed from `i4mjad/cc-setup` to `i4mjad/the-lab`. GitHub redirects the old
repository URL, but the plugin identity is intentionally not aliased. Do not load both plugins in one
session.

## Claude Code

```bash
claude plugin uninstall cc-setup@cc-setup
claude plugin marketplace remove cc-setup
claude plugin marketplace add i4mjad/the-lab
claude plugin install the-lab@the-lab
```

Open the target project and run:

```text
/the-lab:initialize --sync
```

## Codex

If a development build of the old identity was installed, remove it first. Then:

```bash
codex plugin marketplace add i4mjad/the-lab --ref v1.0.0
codex plugin add the-lab@the-lab
```

Open the target project and run:

```text
$initialize --sync
```

## What synchronization changes

- A recognizable legacy root `CLAUDE.md` is migrated into canonical `AGENTS.md`; `CLAUDE.md` becomes
  the short `@AGENTS.md` import shim.
- Untouched generated Codex config, hooks, and role adapters update to The Lab 1.0.0.
- Project-owned `AGENTS.md` blocks and quality commands/thresholds remain unchanged; an untouched
  managed quality runner updates.
- A hand-edited generated file is report-only. The initializer prints a diff and does not overwrite it.

After reviewing any report-only files, run the printed bootstrap command. Bootstrap verifies the
mandatory writing standard for both hosts and installs only exact catalog resolutions.

If this checkout still has an old remote after the repository rename:

```bash
git remote set-url origin https://github.com/i4mjad/the-lab.git
```
