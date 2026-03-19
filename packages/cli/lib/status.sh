#!/usr/bin/env bash
# status.sh — Render dashboard or status line for tmux bar.

# Source _common.sh if not already loaded (standalone for tmux status-right)
if ! declare -f _info &>/dev/null; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "$SCRIPT_DIR/_common.sh"
fi

set -euo pipefail

# ── Status line mode (for tmux status-right) ──────────────────────────────

if [[ "${1:-}" == "--line" ]]; then
  working=0; review=0; blocked=0; dead=0
  for key in $(_project_keys); do
    path="$(_project_path "$key")"
    [[ -d "$path/.worktrees" ]] || continue
    for d in "$path/.worktrees"/*/; do
      [[ -d "$d" ]] || continue
      status="$(_worker_status "$d")"
      case "$status" in
        working*)  ((working++)) ;;
        review*)   ((review++)) ;;
        blocked*)  ((blocked++)) ;;
        *)         ((dead++)) ;;
      esac
    done
  done
  parts=()
  (( working > 0 )) && parts+=("${working} ● working")
  (( review > 0 ))  && parts+=("${review} ✓ review")
  (( blocked > 0 )) && parts+=("${blocked} ✗ blocked")
  (( dead > 0 ))    && parts+=("${dead} ✗ dead")
  if (( ${#parts[@]} > 0 )); then
    printf '%s' "${parts[*]}"
  else
    printf '%s' "idle"
  fi
  exit 0
fi

# ── Full dashboard mode ───────────────────────────────────────────────────

keys="$(_project_keys)"
total_projects=0
total_workers=0
needs_attention=0

# Count first
for key in $keys; do
  ((total_projects++))
  path="$(_project_path "$key")"
  [[ -d "$path/.worktrees" ]] || continue
  for d in "$path/.worktrees"/*/; do
    [[ -d "$d" ]] || continue
    ((total_workers++))
    status="$(_worker_status "$d")"
    case "$status" in
      blocked*|unknown) ((needs_attention++)) ;;
    esac
  done
done

# Header
echo ""
if (( needs_attention > 0 )); then
  printf '  orc status · %d projects · %d workers · %d needs attention\n' \
    "$total_projects" "$total_workers" "$needs_attention"
else
  printf '  orc status · %d projects · %d workers\n' \
    "$total_projects" "$total_workers"
fi

if [[ -z "$keys" ]]; then
  echo ""
  _info "  (no projects registered — run 'orc add <key> <path>')"
  exit "$EXIT_OK"
fi

# Per-project
for key in $keys; do
  path="$(_project_path "$key")"
  max="$(_config_get "defaults.max_workers" "3" "$path")"
  workers="$(_worker_count "$path")"

  echo ""
  printf '  ─── %s (%s/%s) ───────────────────────────────────\n' "$key" "$workers" "$max"

  if [[ ! -d "$path/.worktrees" ]] || [[ -z "$(ls -A "$path/.worktrees" 2>/dev/null)" ]]; then
    echo "  (idle — no active workers)"
    continue
  fi

  for d in "$path/.worktrees"/*/; do
    [[ -d "$d" ]] || continue
    bead="$(basename "$d")"
    status="$(_worker_status "$d")"

    # Elapsed time
    elapsed=""
    if [[ -f "$d/.worker-status" ]]; then
      if _is_macos; then
        mod_time=$(stat -f %m "$d/.worker-status" 2>/dev/null || echo 0)
      else
        mod_time=$(stat -c %Y "$d/.worker-status" 2>/dev/null || echo 0)
      fi
      now=$(date +%s)
      diff=$(( now - mod_time ))
      if (( diff < 60 )); then
        elapsed="${diff}s"
      elif (( diff < 3600 )); then
        elapsed="$(( diff / 60 ))m"
      else
        elapsed="$(( diff / 3600 ))h"
      fi
    fi

    # Format status indicator
    indicator=""
    case "$status" in
      working*)  indicator="● working" ;;
      review*)   indicator="✓ review" ;;
      blocked*)  indicator="✗ blocked" ;;
      unknown)   indicator="✗ dead (agent exited)" ;;
      *)         indicator="? $status" ;;
    esac

    printf '  %-12s %-24s %s %5s\n' "$bead" "" "$indicator" "$elapsed"

    # Show blocked reason if present
    if [[ "$status" == blocked:* ]]; then
      reason="${status#blocked: }"
      printf '             "%s"\n' "$reason"
    fi
  done
done
echo ""
