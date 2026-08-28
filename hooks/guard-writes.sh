#!/usr/bin/env bash
# Cross-host PreToolUse guard for Claude file-edit payloads and Codex apply_patch payloads.
# Reviewers are also configured read-only; this script is defense in depth, not the sandbox.
# Shell commands can have arbitrary side effects and cannot be completely classified here. Document
# authors therefore receive no Claude shell tool, and reviewers use read-only host permissions.
set -u

command -v jq >/dev/null 2>&1 || exit 0
input="$(cat)"
payload_role="$(jq -r '.agent_type // .agent_name // empty' <<<"$input")"
role="${THE_LAB_ROLE:-$payload_role}"
role="${role##*:}"

# No role means the main orchestrator. It owns consolidated logs and is not role-restricted.
[ -n "$role" ] || exit 0

paths="$(jq -r '[.tool_input.file_path?, .tool_input.notebook_path?] | .[] | select(type == "string" and length > 0)' <<<"$input")"
tool_name="$(jq -r '.tool_name // empty' <<<"$input")"
if [ "$tool_name" = "apply_patch" ] || [ -z "$paths" ]; then
  patch_command="$(jq -r '.tool_input.command // empty' <<<"$input")"
  patch_paths="$(printf '%s\n' "$patch_command" | sed -nE 's/^\*\*\* (Add|Update|Delete) File: (.*)$/\2/p')"
  if [ -n "$patch_paths" ]; then
    paths="${paths}${paths:+$'\n'}${patch_paths}"
  fi
fi

[ -n "$paths" ] || exit 0

deny() {
  printf 'Blocked: %s\n' "$1" >&2
  exit 2
}

while IFS= read -r path; do
  [ -n "$path" ] || continue
  case "$path" in
    */docs/reports/*/review.md | docs/reports/*/review.md | */docs/reviews/*/gates.md | docs/reviews/*/gates.md)
      deny "review.md and gates.md are orchestrator-owned; $role must return findings instead."
      ;;
    */quality-gate.sh | quality-gate.sh)
      deny "quality-gate.sh is project-owned; $role must make the implementation pass without moving the bar."
      ;;
  esac

  case "$role" in
    code-reviewer | qa-tester | api-tester | mobile-qa | peer-reviewer)
      deny "$role is read-only; return evidence or findings to the orchestrator."
      ;;
    discovery | business-analyst | product-manager | architect | designer)
      case "$path" in
        */apps/* | apps/* | */services/* | services/*)
          deny "$role authors documents, not application code."
          ;;
      esac
      ;;
  esac
done <<<"$paths"

exit 0
