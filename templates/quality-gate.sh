#!/usr/bin/env bash
# quality-gate.sh — this project's mechanical quality bar (see AGENTS.md §10).
#
# You declare the commands and thresholds below; /feature runs this script and refuses to call an
# initiative green unless it exits 0. Build agents run `./quality-gate.sh <platform>` before
# reporting; the orchestrator runs the full gate at Verify. Agents are hook-blocked from editing
# its project configuration — only you change the bar they are graded against. `$initialize --sync`
# may update an untouched managed runner but never the commands or thresholds above it.
#
# Contract per check:
#   - Empty active config    -> FAIL. Only inactive platforms are N/A.
#   - Command exits non-zero -> FAIL (a configured-but-missing tool is a FAIL, not a SKIP)
#   - *_MIN checks           -> the command's LAST stdout line must be a bare number (e.g. "83.4");
#                               FAIL when below the threshold (non-numeric output also FAILs)
#   - QUICK=1                -> skip mutation checks (slow). Build agents use QUICK=1 in fix loops;
#                               the orchestrator's final green check runs the full gate.
#
# Usage: ./quality-gate.sh [web|ios|flutter|backend ...]   (no args = all four; inactive = N/A)

set -u

# the-lab:project:quality-config:start
ACTIVE_PLATFORMS="${ACTIVE_PLATFORMS-}" # e.g. "web ios backend"; initialize must set this

# ── web ──────────────────────────────────────────────────────────────────────────────────────────
WEB_TEST_CMD="${WEB_TEST_CMD-}"         # e.g. "npx vitest run"
WEB_LINT_CMD="${WEB_LINT_CMD-}"         # e.g. "npx eslint . && npx tsc --noEmit"
WEB_COVERAGE_CMD="${WEB_COVERAGE_CMD-}" # must print a bare number on its last line
WEB_COVERAGE_MIN="${WEB_COVERAGE_MIN-}" # e.g. 80
WEB_COMPLEXITY_CMD="${WEB_COMPLEXITY_CMD-}"
WEB_DEPS_CMD="${WEB_DEPS_CMD-}"
WEB_MUTATION_CMD="${WEB_MUTATION_CMD-}" # must print a bare number on its last line
WEB_MUTATION_MIN="${WEB_MUTATION_MIN-}" # e.g. 60
WEB_SRC_DIR="${WEB_SRC_DIR-}"           # e.g. "apps/web/src"
WEB_SRC_GLOB="${WEB_SRC_GLOB-}"         # e.g. "*.ts *.tsx"
WEB_MAX_MODULE_LINES="${WEB_MAX_MODULE_LINES-}" # e.g. 300

# ── ios ──────────────────────────────────────────────────────────────────────────────────────────
IOS_TEST_CMD="${IOS_TEST_CMD-}"
IOS_LINT_CMD="${IOS_LINT_CMD-}"
IOS_COVERAGE_CMD="${IOS_COVERAGE_CMD-}"
IOS_COVERAGE_MIN="${IOS_COVERAGE_MIN-}"
IOS_COMPLEXITY_CMD="${IOS_COMPLEXITY_CMD-}"
IOS_DEPS_CMD="${IOS_DEPS_CMD-}"
IOS_MUTATION_CMD="${IOS_MUTATION_CMD-}"
IOS_MUTATION_MIN="${IOS_MUTATION_MIN-}"
IOS_SRC_DIR="${IOS_SRC_DIR-}"
IOS_SRC_GLOB="${IOS_SRC_GLOB-}"
IOS_MAX_MODULE_LINES="${IOS_MAX_MODULE_LINES-}"

# ── flutter ──────────────────────────────────────────────────────────────────────────────────────
FLUTTER_TEST_CMD="${FLUTTER_TEST_CMD-}"
FLUTTER_LINT_CMD="${FLUTTER_LINT_CMD-}"
FLUTTER_COVERAGE_CMD="${FLUTTER_COVERAGE_CMD-}"
FLUTTER_COVERAGE_MIN="${FLUTTER_COVERAGE_MIN-}"
FLUTTER_COMPLEXITY_CMD="${FLUTTER_COMPLEXITY_CMD-}"
FLUTTER_DEPS_CMD="${FLUTTER_DEPS_CMD-}"
FLUTTER_MUTATION_CMD="${FLUTTER_MUTATION_CMD-}"
FLUTTER_MUTATION_MIN="${FLUTTER_MUTATION_MIN-}"
FLUTTER_SRC_DIR="${FLUTTER_SRC_DIR-}"
FLUTTER_SRC_GLOB="${FLUTTER_SRC_GLOB-}"
FLUTTER_MAX_MODULE_LINES="${FLUTTER_MAX_MODULE_LINES-}"

# ── backend ──────────────────────────────────────────────────────────────────────────────────────
BACKEND_TEST_CMD="${BACKEND_TEST_CMD-}"
BACKEND_LINT_CMD="${BACKEND_LINT_CMD-}"
BACKEND_COVERAGE_CMD="${BACKEND_COVERAGE_CMD-}"
BACKEND_COVERAGE_MIN="${BACKEND_COVERAGE_MIN-}"
BACKEND_COMPLEXITY_CMD="${BACKEND_COMPLEXITY_CMD-}"
BACKEND_DEPS_CMD="${BACKEND_DEPS_CMD-}"
BACKEND_MUTATION_CMD="${BACKEND_MUTATION_CMD-}"
BACKEND_MUTATION_MIN="${BACKEND_MUTATION_MIN-}"
BACKEND_SRC_DIR="${BACKEND_SRC_DIR-}"
BACKEND_SRC_GLOB="${BACKEND_SRC_GLOB-}"
BACKEND_MAX_MODULE_LINES="${BACKEND_MAX_MODULE_LINES-}"
# the-lab:project:quality-config:end

# the-lab:managed:quality-runner:start
# ── runner (no config below this line) ───────────────────────────────────────────────────────────
overall=0

row() { printf '%-12s | %-8s | %-10s | %-10s | %s\n' "$1" "$2" "$3" "$4" "$5"; }

num_ge() { awk -v a="$1" -v b="$2" 'BEGIN { exit !(a+0 >= b+0 && a ~ /^[0-9]+([.][0-9]+)?$/ && b ~ /^[0-9]+([.][0-9]+)?$/) }'; }

check() { # <platform> <name> <cmd> [min] [min-required]
  local platform="$1" name="$2" cmd="$3" min="${4-}" out val
  local min_required="${5-0}"
  if [ -z "$cmd" ]; then
    row "$name" "$platform" "missing" "-" "FAIL (not configured)"
    overall=1
    return 0
  fi
  if [ "$min_required" = "1" ] && [ -z "$min" ]; then
    row "$name" "$platform" "missing" "missing" "FAIL (threshold)"
    overall=1
    return 0
  fi
  if ! out="$(bash -c "$cmd" 2>&1)"; then
    row "$name" "$platform" "error" "${min:--}" "FAIL"
    printf '  %s/%s: %s\n' "$platform" "$name" "$(printf '%s\n' "$out" | tail -1)" >&2
    overall=1
    return 0
  fi
  if [ -n "$min" ]; then
    val="$(printf '%s\n' "$out" | tail -1 | tr -d '[:space:]%')"
    if num_ge "$val" "$min"; then
      row "$name" "$platform" "$val" ">= $min" "PASS"
    else
      row "$name" "$platform" "$val" ">= $min" "FAIL"
      overall=1
    fi
    return 0
  fi
  row "$name" "$platform" "ok" "-" "PASS"
}

check_module_size() { # <platform> <dir> <glob> <max>
  local platform="$1" dir="$2" glob="$3" max="$4" worst=0 worst_file="" count g file
  local -a globs
  if [ -z "$dir" ] || [ -z "$glob" ] || [ -z "$max" ]; then
    row "module-size" "$platform" "missing" "-" "FAIL (not configured)"
    overall=1
    return 0
  fi
  if ! [[ "$max" =~ ^[0-9]+$ ]]; then
    row "module-size" "$platform" "invalid" "$max" "FAIL (threshold)"
    overall=1
    return 0
  fi
  if [ ! -d "$dir" ]; then
    row "module-size" "$platform" "no dir" "<= $max" "FAIL"
    printf '  %s/module-size: directory %s not found\n' "$platform" "$dir" >&2
    overall=1
    return 0
  fi
  # read -a keeps the patterns as patterns — unquoted expansion would glob against the cwd
  IFS=' ' read -r -a globs <<<"${glob:-*}"
  for g in "${globs[@]}"; do
    while IFS= read -r file; do
      count="$(wc -l <"$file" | tr -d ' ')"
      if [ "$count" -gt "$worst" ]; then worst="$count" worst_file="$file"; fi
    done < <(find "$dir" -type f -name "$g")
  done
  if [ "$worst" -le "$max" ]; then
    row "module-size" "$platform" "$worst" "<= $max" "PASS"
  else
    row "module-size" "$platform" "$worst" "<= $max" "FAIL"
    printf '  %s/module-size: %s has %s lines (max %s)\n' "$platform" "$worst_file" "$worst" "$max" >&2
    overall=1
  fi
}

run_platform() {
  local platform="$1" platform_prefix reference
  platform_prefix="$(printf '%s' "$platform" | tr '[:lower:]' '[:upper:]')"
  local test_command lint_command coverage_command coverage_minimum complexity_command
  local dependency_command mutation_command mutation_minimum source_directory source_glob max_module_lines
  reference="${platform_prefix}_TEST_CMD" test_command="${!reference}"
  reference="${platform_prefix}_LINT_CMD" lint_command="${!reference}"
  reference="${platform_prefix}_COVERAGE_CMD" coverage_command="${!reference}"
  reference="${platform_prefix}_COVERAGE_MIN" coverage_minimum="${!reference}"
  reference="${platform_prefix}_COMPLEXITY_CMD" complexity_command="${!reference}"
  reference="${platform_prefix}_DEPS_CMD" dependency_command="${!reference}"
  reference="${platform_prefix}_MUTATION_CMD" mutation_command="${!reference}"
  reference="${platform_prefix}_MUTATION_MIN" mutation_minimum="${!reference}"
  reference="${platform_prefix}_SRC_DIR" source_directory="${!reference}"
  reference="${platform_prefix}_SRC_GLOB" source_glob="${!reference}"
  reference="${platform_prefix}_MAX_MODULE_LINES" max_module_lines="${!reference}"

  case " $ACTIVE_PLATFORMS " in
    *" $platform "*) ;;
    *)
    row "all" "$platform" "-" "-" "N/A (inactive)"
    return 0
    ;;
  esac
  check "$platform" "tests" "$test_command"
  check "$platform" "lint" "$lint_command"
  check "$platform" "coverage" "$coverage_command" "$coverage_minimum" 1
  check "$platform" "complexity" "$complexity_command"
  check_module_size "$platform" "$source_directory" "$source_glob" "$max_module_lines"
  check "$platform" "deps" "$dependency_command"
  if [ "${QUICK-}" = "1" ]; then
    if [ -z "$mutation_command" ] || [ -z "$mutation_minimum" ]; then
      row "mutation" "$platform" "missing" "missing" "FAIL (not configured)"
      overall=1
    else
      row "mutation" "$platform" "-" ">= $mutation_minimum" "SKIP (QUICK=1)"
    fi
  else
    check "$platform" "mutation" "$mutation_command" "$mutation_minimum" 1
  fi
}

platforms=("$@")
[ "${#platforms[@]}" -gt 0 ] || platforms=(web ios flutter backend)

row "Check" "Platform" "Value" "Threshold" "Status"
row "------------" "--------" "----------" "----------" "------"
if [ -z "$ACTIVE_PLATFORMS" ]; then
  row "configuration" "global" "missing" "-" "FAIL (ACTIVE_PLATFORMS)"
  overall=1
fi
for p in "${platforms[@]}"; do
  case "$p" in
    web | ios | flutter | backend) run_platform "$p" ;;
    *)
      echo "unknown platform: $p (expected web|ios|flutter|backend)" >&2
      overall=1
      ;;
  esac
done

if [ "$overall" = 0 ]; then
  echo "QUALITY GATE: PASS"
else
  echo "QUALITY GATE: FAIL"
fi
exit "$overall"
# the-lab:managed:quality-runner:end
