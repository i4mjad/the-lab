#!/usr/bin/env bash
# Repository-wide consistency validation for The Lab.
set -u

root="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$root" || exit 1
failed=0
fail() { printf 'FAIL: %s\n' "$*" >&2; failed=1; }

command -v jq >/dev/null 2>&1 || { echo "FAIL: jq is required" >&2; exit 1; }

json_files=(
  .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json
  hooks/hooks.json templates/codex-hooks.json roles/catalog.json generated/role-checksums.json
  skills.manifest.json skills-lock.json schemas/review.schema.json schemas/rebuttal.schema.json
  schemas/role-catalog.schema.json schemas/skills-manifest.schema.json package.json
)
for file in "${json_files[@]}"; do
  jq empty "$file" 2>/dev/null || fail "$file is not valid JSON"
done

for manifest in .claude-plugin/plugin.json .codex-plugin/plugin.json; do
  [ "$(jq -r '.name' "$manifest")" = "the-lab" ] || fail "$manifest must use slug the-lab"
  [ "$(jq -r '.version' "$manifest")" = "1.0.0" ] || fail "$manifest must declare 1.0.0"
  jq -e '.repository | contains("i4mjad/the-lab")' "$manifest" >/dev/null || fail "$manifest has a stale repository URL"
done
jq -e '.interface.displayName == "المعمل — The Lab"' .codex-plugin/plugin.json >/dev/null \
  || fail ".codex-plugin/plugin.json has the wrong display name"

role_count="$(jq '.roles | length' roles/catalog.json)"
[ "$role_count" = 14 ] || fail "canonical role catalog must contain 14 roles"
[ "$(find agents -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')" = "$role_count" ] \
  || fail "Claude adapter count differs from the role catalog"
[ "$(find .codex/agents -maxdepth 1 -name '*.toml' | wc -l | tr -d ' ')" = "$role_count" ] \
  || fail "Codex adapter count differs from the role catalog"
node scripts/generate-role-adapters.mjs --check || failed=1
node scripts/update-lock.mjs --check || failed=1
node scripts/validate-json-schema.mjs || failed=1

for stage in discovery requirements product architecture design; do
  [ -f "prompts/$stage-gate.md" ] || fail "missing $stage gate rubric"
done
for skill in initialize bootstrap feature peer-review; do
  [ -f "skills/$skill/SKILL.md" ] || fail "missing universal $skill skill"
  [ -f "commands/$skill.md" ] || fail "missing Claude compatibility command for $skill"
done
for template in discovery business-requirements product-spec architecture-spec task design gates review completion-report; do
  [ -f "docs/_templates/$template.template.md" ] || fail "missing $template artifact template"
done

for executable in scripts/bootstrap.sh scripts/validate.sh scripts/initialize.mjs \
  scripts/generate-role-adapters.mjs scripts/pipeline-policy.mjs scripts/review-bridge.mjs scripts/update-lock.mjs \
  scripts/validate-json-schema.mjs hooks/guard-writes.sh templates/quality-gate.sh; do
  [ -x "$executable" ] || fail "$executable is not executable"
done

for role in frontend ios flutter backend; do
  grep -Fq 'quality-gate.sh' "roles/$role.md" || fail "$role does not run the quality gate"
done
grep -Fq 'apply_patch' hooks/guard-writes.sh || fail "write guard does not inspect Codex patches"
grep -Fq 'quality-gate.sh' hooks/guard-writes.sh || fail "write guard does not protect the quality gate"

if rg -n 'Ponytail|RocketSim|flutter/skills|curl[^\n]*\|[^\n]*node|codex-plugin-cc' \
  --glob '!validate.sh' README.md AGENTS.md templates roles skills docs scripts skills.manifest.json >/tmp/the-lab-banned.txt; then
  cat /tmp/the-lab-banned.txt >&2
  fail "a removed or unsafe default remains"
fi
if rg -n 'codex-reviewer|13 specialists|13-agent|The 13 agents|four spec gates' \
  --glob '!validate.sh' README.md AGENTS.md templates roles skills docs prompts commands .claude-plugin .codex-plugin >/tmp/the-lab-stale.txt; then
  cat /tmp/the-lab-stale.txt >&2
  fail "stale single-host terminology remains"
fi

if command -v shellcheck >/dev/null 2>&1; then
  shellcheck scripts/bootstrap.sh scripts/validate.sh hooks/guard-writes.sh templates/quality-gate.sh || failed=1
else
  echo "NOTE: shellcheck is unavailable; CI installs and runs it."
fi

node --test tests/*.test.mjs || failed=1

if [ "$failed" = 0 ]; then
  echo "OK — repository validation passed."
else
  exit 1
fi
