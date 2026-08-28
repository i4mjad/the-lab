@AGENTS.md

## Claude Code

- Compatibility commands under `commands/` are thin wrappers over the universal skills.
- `${CLAUDE_PLUGIN_ROOT}` exists only inside Claude Code; shared scripts accept explicit paths so Codex
  uses the same implementation.
