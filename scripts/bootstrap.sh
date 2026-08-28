#!/usr/bin/env bash
set -u

script_dir="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)"
lab_root="$(CDPATH='' cd -- "$script_dir/.." && pwd)"
manifest="$lab_root/skills.manifest.json"
dry_run=0
host="auto"
verify_only=0
groups=""
accepted_unverified=""

usage() {
  echo "usage: bootstrap.sh <core|web|ios|flutter|backend|.net|supabase|firebase|optional|dependency-id...> [--host auto|claude|codex|both] [--accept-unverified-license dependency-id] [--dry-run]"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=1 ;;
    --verify-writing-standard) verify_only=1 ;;
    --host)
      shift
      [ "$#" -gt 0 ] || { usage >&2; exit 2; }
      host="$1"
      ;;
    --accept-unverified-license)
      shift
      [ "$#" -gt 0 ] || { usage >&2; exit 2; }
      accepted_unverified="${accepted_unverified}${accepted_unverified:+ }$1"
      ;;
    --help|-h) usage; exit 0 ;;
    --*) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) groups="${groups}${groups:+ }$1" ;;
  esac
  shift
done

command -v jq >/dev/null 2>&1 || { echo "FAILED: jq is required" >&2; exit 1; }

codex_rules_start="<!-- i-have-adhd:managed:start -->"
codex_rules_end="<!-- i-have-adhd:managed:end -->"
codex_rules_file="${CODEX_HOME:-$HOME/.codex}/AGENTS.md"
claude_config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

codex_rules_block() {
  printf '%s\n' "$codex_rules_start"
  printf '%s\n\n' '## Output style'
  printf '%s\n\n' 'The reader has ADHD. Shape every response so it can be acted on:'
  printf '%s\n' '1. Lead with the answer or next action: command, path, or snippet first.'
  printf '%s\n' '2. Number multi-step work; one bounded action per step.'
  printf '%s\n' '3. End with one next action doable in under two minutes.'
  printf '%s\n' '4. Finish the current issue before raising a new one.'
  printf '%s\n' '5. Restate progress each turn ("step 3 of 5 done").'
  printf '%s\n' '6. Give time estimates in concrete units, never "a bit".'
  printf '%s\n' '7. After a change, show what now works.'
  printf '%s\n' '8. Errors: state location, cause, and fix. No drama.'
  printf '%s\n' '9. Cap lists at 5 items.'
  printf '%s\n\n' '10. No preamble, no recaps, no closers.'
  printf '%s\n' 'Exceptions: explain fully when asked to explain. Confirm before destructive actions. After three failed fixes, stop and name the doubtful assumption. If the request is ambiguous, ask one short question.'
  printf '%s\n' "$codex_rules_end"
}

verify_writing_standard() {
  local failed=0 current_block
  if [ -f "$claude_config_dir/.i-have-adhd-always" ]; then
    echo "OK: Claude i-have-adhd always-on marker"
  else
    echo "FAILED: missing $claude_config_dir/.i-have-adhd-always; run bootstrap.sh core" >&2
    failed=1
  fi
  current_block="$(sed -n "/^${codex_rules_start}$/,/^${codex_rules_end}$/p" "$codex_rules_file" 2>/dev/null)"
  if [ "$current_block" = "$(codex_rules_block)" ]; then
    echo "OK: Codex i-have-adhd managed rules block"
  else
    echo "FAILED: missing or stale upstream-managed i-have-adhd block in $codex_rules_file; run bootstrap.sh core" >&2
    failed=1
  fi
  return "$failed"
}

if [ "$verify_only" = 1 ]; then
  verify_writing_standard
  exit $?
fi

case "$host" in
  auto)
    if [ -n "${CLAUDE_PLUGIN_ROOT-}" ]; then host="claude";
    elif [ -n "${CODEX_HOME-}" ]; then host="codex";
    elif command -v claude >/dev/null 2>&1 && command -v codex >/dev/null 2>&1; then host="both";
    elif command -v claude >/dev/null 2>&1; then host="claude";
    elif command -v codex >/dev/null 2>&1; then host="codex";
    else echo "FAILED: neither claude nor codex is available" >&2; exit 1; fi
    ;;
  claude|codex|both) ;;
  *) echo "FAILED: invalid --host $host" >&2; exit 2 ;;
esac

if [ -z "$groups" ]; then
  echo "Available groups:"
  jq -r '[.dependencies[].groups[]] | unique[]' "$manifest" | sed 's/^/  /'
  echo "Dependency ids:"
  jq -r '.dependencies[].id' "$manifest" | sed 's/^/  /'
  exit 0
fi

# The writing standard is mandatory for every bootstrap, regardless of selected stack keys.
groups="core $groups"
selected="$(jq --arg groups "$groups" '
  ($groups | split(" ")) as $wanted |
  [.dependencies[] as $dependency |
    select(
      (($wanted | index($dependency.id)) != null) or
      (any($dependency.groups[]; . as $group | ($wanted | index($group)) != null))
    ) |
    $dependency]
' "$manifest")"

[ "$(jq 'length' <<<"$selected")" -gt 0 ] || { echo "FAILED: no dependencies matched: $groups" >&2; exit 1; }
failed=0

run() {
  if [ "$dry_run" = 1 ]; then
    printf 'DRY-RUN:'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

configure_writing_standard() {
  local start_present=0 end_present=0 temporary
  if [ "$dry_run" = 1 ]; then
    echo "DRY-RUN: create Claude always-on marker and merge the managed Codex rules block"
    return 0
  fi
  mkdir -p "$claude_config_dir" "$(dirname "$codex_rules_file")"
  touch "$claude_config_dir/.i-have-adhd-always"
  grep -Fq "$codex_rules_start" "$codex_rules_file" 2>/dev/null && start_present=1
  grep -Fq "$codex_rules_end" "$codex_rules_file" 2>/dev/null && end_present=1
  if [ "$start_present" != "$end_present" ]; then
    echo "FAILED: partial i-have-adhd managed block in $codex_rules_file; repair it before bootstrap" >&2
    return 1
  fi
  if [ "$start_present" = 1 ]; then
    temporary="$(mktemp "${codex_rules_file}.tmp.XXXXXX")" || return 1
    awk -v start="$codex_rules_start" -v end="$codex_rules_end" '
      $0 == start { inside = 1; next }
      inside && $0 == end { inside = 0; next }
      !inside { print }
    ' "$codex_rules_file" >"$temporary" || return 1
    printf '\n' >>"$temporary"
    codex_rules_block >>"$temporary"
    mv "$temporary" "$codex_rules_file" || return 1
  else
    printf '\n' >>"$codex_rules_file"
    codex_rules_block >>"$codex_rules_file"
  fi
}

install_one() {
  local dep="$1" id kind license source_url resolved skill package cache_dir
  id="$(jq -r '.id' <<<"$dep")"
  kind="$(jq -r '.installer.kind' <<<"$dep")"
  license="$(jq -r '.license' <<<"$dep")"
  source_url="$(jq -r '.source.url' <<<"$dep")"
  resolved="$(jq -r '.resolved.value' <<<"$dep")"
  echo "==> $id ($kind, pinned $resolved)"
  if [ "$kind" != "manual" ] && { [ "$license" = "NOASSERTION" ] || [ "$license" = "UNKNOWN" ]; }; then
    case " $accepted_unverified " in
      *" $id "*) echo "WARNING: explicitly accepted unverified license for $id" >&2 ;;
      *)
        echo "FAILED: $id has no verified license; review upstream, then pass --accept-unverified-license $id" >&2
        return 1
        ;;
    esac
  fi
  case "$kind" in
    skills-cli)
      skill="$(jq -r '.installer.skill' <<<"$dep")"
      run npx --yes skills add "$source_url/tree/$resolved" --skill "$skill" --agent '*' -y || return 1
      ;;
    host-plugin)
      if [ "$host" = "claude" ] || [ "$host" = "both" ]; then
        cache_dir="$HOME/.the-lab/dependencies/$id-$resolved"
        if [ "$dry_run" = 1 ]; then
          echo "DRY-RUN: clone $source_url at $resolved to $cache_dir; register and install Claude plugin"
        else
          if [ ! -d "$cache_dir/.git" ]; then
            mkdir -p "$(dirname "$cache_dir")"
            git clone --quiet "$source_url" "$cache_dir" && git -C "$cache_dir" checkout --quiet "$resolved" || return 1
          fi
          [ "$(git -C "$cache_dir" rev-parse HEAD)" = "$resolved" ] || return 1
          run claude plugin marketplace add "$cache_dir" || return 1
          run claude plugin install "i-have-adhd@i-have-adhd" || return 1
        fi
      fi
      if [ "$host" = "codex" ] || [ "$host" = "both" ]; then
        run codex plugin marketplace add ayghri/i-have-adhd --ref "$resolved" || return 1
        run codex plugin add i-have-adhd@i-have-adhd || return 1
      fi
      configure_writing_standard || return 1
      ;;
    npm-mcp)
      package="$(jq -r '.installer.package' <<<"$dep")@$resolved"
      if [ "$host" = "claude" ] || [ "$host" = "both" ]; then
        run claude mcp add --scope user mobile-mcp -e MOBILEMCP_DISABLE_TELEMETRY=1 -- npx -y "$package" || return 1
      fi
      if [ "$host" = "codex" ] || [ "$host" = "both" ]; then
        run codex mcp add --env MOBILEMCP_DISABLE_TELEMETRY=1 mobile-mcp -- npx -y "$package" || return 1
      fi
      ;;
    manual)
      echo "MANUAL: $id is explicit opt-in; review trust requirements before configuring $source_url"
      ;;
    *) echo "FAILED: unsupported installer kind $kind" >&2; return 1 ;;
  esac
}

while IFS= read -r dep; do
  install_one "$dep" || { echo "FAILED: $(jq -r '.id' <<<"$dep")" >&2; failed=1; }
done < <(jq -c '.[]' <<<"$selected")

if [ "$dry_run" = 0 ]; then
  verify_writing_standard || failed=1
fi
exit "$failed"
