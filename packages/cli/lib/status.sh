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
  working=0; review=0; blocked=0; dead=0; goals=0
  goal_review=0; goal_blocked=0; goal_done=0
  for key in $(_project_keys); do
    path="$(_project_path "$key")"
    # Count goals and their statuses from .goals/ directory
    if [[ -d "$path/.goals" ]]; then
      for gd in "$path/.goals"/*/; do
        [[ -d "$gd" ]] || continue
        ((goals++)) || true
        gs="$(head -1 "$gd/.worker-status" 2>/dev/null || echo "unknown")"
        case "$gs" in
          review*)   ((goal_review++)) ;;
          blocked*)  ((goal_blocked++)) ;;
          done*)     ((goal_done++)) ;;
        esac
      done
    fi
    # Fall back to branch counting if this project has no .goals/ dir
    if [[ ! -d "$path/.goals" ]]; then
      goal_branches="$(git -C "$path" for-each-ref --format='%(refname:short)' \
        'refs/heads/feat/' 'refs/heads/fix/' 'refs/heads/task/' 2>/dev/null || true)"
      if [[ -n "$goal_branches" ]]; then
        goals=$(( goals + $(echo "$goal_branches" | wc -l | tr -d ' ') ))
      fi
    fi
    for d in "$path/.worktrees"/*/; do
      [[ -d "$d" ]] || continue
      status="$(_worker_status "$d")"
      case "$status" in
        working*)  ((working++)) ;;
        review*)   ((review++)) ;;
        blocked*)  ((blocked++)) ;;
        done*)     ;; # completed — not counted in active totals
        *)         ((dead++)) ;;
      esac
    done
  done
  parts=()
  if (( goals > 0 )); then
    goal_detail=""
    (( goal_review > 0 ))  && goal_detail+=" ${goal_review}✓"
    (( goal_blocked > 0 )) && goal_detail+=" ${goal_blocked}✗"
    (( goal_done > 0 ))    && goal_detail+=" ${goal_done}done"
    if [[ -n "$goal_detail" ]]; then
      parts+=("${goals} goals(${goal_detail## })")
    else
      parts+=("${goals} goals")
    fi
  fi
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

# Helper: format elapsed time from a status file
_format_elapsed() {
  local status_file="$1"
  local elapsed=""
  if [[ -f "$status_file" ]]; then
    local mod_time
    if _is_macos; then
      mod_time=$(stat -f %m "$status_file" 2>/dev/null || echo 0)
    else
      mod_time=$(stat -c %Y "$status_file" 2>/dev/null || echo 0)
    fi
    local now diff
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
  echo "$elapsed"
}

# Helper: format status indicator
_format_indicator() {
  local status="$1"
  case "$status" in
    working*)  echo "● working" ;;
    review*)   echo "✓ review" ;;
    blocked*)  echo "✗ blocked" ;;
    done*)     echo "✓ done" ;;
    unknown)   echo "✗ dead (agent exited)" ;;
    *)         echo "? $status" ;;
  esac
}

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

  # Collect workers grouped by goal
  # goal_map: associative array keyed by goal name, values are newline-separated bead entries
  declare -A goal_map=()
  ungrouped=""

  for d in "$path/.worktrees"/*/; do
    [[ -d "$d" ]] || continue
    bead_name="$(basename "$d")"
    wt_branch="$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    status="$(_worker_status "$d")"
    elapsed="$(_format_elapsed "$d/.worker-status")"
    indicator="$(_format_indicator "$status")"

    # Build entry line
    entry="$(printf '%-12s %s %5s' "$bead_name" "$indicator" "$elapsed")"
    if [[ "$status" == blocked:* ]]; then
      reason="${status#blocked: }"
      entry="$entry
             \"$reason\""
    fi

    # Group by goal
    if [[ "$wt_branch" == work/*/* ]]; then
      goal_name="${wt_branch#work/}"
      goal_name="${goal_name%/*}"
      if [[ -n "${goal_map[$goal_name]+x}" ]]; then
        goal_map[$goal_name]="${goal_map[$goal_name]}
${entry}"
      else
        goal_map[$goal_name]="$entry"
      fi
    else
      if [[ -n "$ungrouped" ]]; then
        ungrouped="$ungrouped
${entry}"
      else
        ungrouped="$entry"
      fi
    fi
  done

  # Print goal-grouped workers
  for goal_name in $(echo "${!goal_map[@]}" | tr ' ' '\n' | sort); do
    # Detect goal branch and goal orchestrator status
    goal_branch="$(_find_goal_branch "$path" "$goal_name" 2>/dev/null || true)"
    goal_status="$(_goal_worker_status "$path" "$goal_name")"
    goal_indicator=""
    case "$goal_status" in
      working*)  goal_indicator="● working" ;;
      review*)   goal_indicator="✓ review" ;;
      blocked*)  goal_indicator="✗ blocked" ;;
      done*)     goal_indicator="✓ done" ;;
      unknown)
        # Fall back to tmux liveness check if no status file exists
        if _tmux_window_exists "${key}/${goal_name}" 2>/dev/null; then
          if _tmux_is_dead_window "${key}/${goal_name}" 2>/dev/null; then
            goal_indicator="✗ dead"
          else
            goal_indicator="● active"
          fi
        fi
        ;;
      *)         goal_indicator="? $goal_status" ;;
    esac

    # Goal elapsed time from .goals/<goal>/.worker-status
    goal_elapsed=""
    goal_status_file="$path/.goals/$goal_name/.worker-status"
    goal_elapsed="$(_format_elapsed "$goal_status_file")"

    printf '  ┌ goal: %s' "$goal_name"
    [[ -n "$goal_branch" ]] && printf ' (%s)' "$goal_branch"
    [[ -n "$goal_indicator" ]] && printf '  [%s' "$goal_indicator"
    [[ -n "$goal_elapsed" ]] && printf ' %s' "$goal_elapsed"
    [[ -n "$goal_indicator" ]] && printf ']'
    printf '\n'

    # Show blocked reason for goals
    if [[ "$goal_status" == blocked:* ]]; then
      goal_reason="${goal_status#blocked: }"
      printf '  │ "%s"\n' "$goal_reason"
    fi

    while IFS= read -r line; do
      [[ -n "$line" ]] && printf '  │ %s\n' "$line"
    done <<< "${goal_map[$goal_name]}"
    printf '  └\n'
  done

  # Print ungrouped workers (no goal)
  if [[ -n "$ungrouped" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] && printf '  %s\n' "$line"
    done <<< "$ungrouped"
  fi

  unset goal_map
done
echo ""
