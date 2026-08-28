---
name: bootstrap
description: Install or verify The Lab's pinned cross-host skill and MCP dependency packs from the reviewed lockfile.
argument-hint: <stack-key...|core|optional> [--host auto|claude|codex|both] [--accept-unverified-license dependency-id] [--dry-run]
---

# Bootstrap

Resolve `<lab-root>` from this skill's directory (`../..`) and run:

```text
bash <lab-root>/scripts/bootstrap.sh <arguments>
```

Show the complete output. Any failed install, license/pin mismatch, missing Claude always-on marker, or
missing Codex upstream rules block is blocking. Never replace a pinned dependency with an arbitrary
latest branch. Optional design/catalog tools remain opt-in.
An unverified upstream license blocks installation unless the user explicitly supplies
`--accept-unverified-license <dependency-id>` after reviewing the manifest's trust note.
