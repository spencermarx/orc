#!/usr/bin/env bash
# status.sh — Render dashboard or status line for tmux bar.

# Source _common.sh if not already loaded (standalone for tmux status-right)
if ! declare -f _info &>/dev/null; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  source "$SCRIPT_DIR/_common.sh"
fi

set -euo pipefail

# ── JSON mode (for machine consumers) ─────────────────────────────────────

if [[ "${1:-}" == "--json" ]]; then
  keys="$(_project_keys)"
  printf '{"projects":['
  first_proj=true
  for key in $keys; do
    path="$(_project_path "$key")"
    $first_proj || printf ','
    first_proj=false

    printf '{"key":"%s","path":"%s","goals":[' "$key" "$path"
    # Scan goals
    first_goal=true
    if [[ -d "$path/.worktrees/.orc-state/goals" ]]; then
      for gd in "$path/.worktrees/.orc-state/goals"/*/; do
        [[ -d "$gd" ]] || continue
        goal_name="$(basename "$gd")"
        gs="$(head -1 "$gd/.worker-status" 2>/dev/null || echo "unknown")"
        $first_goal || printf ','
        first_goal=false
        printf '{"name":"%s","status":"%s","beads":[' "$goal_name" "$gs"
        # Scan beads for this goal
        first_bead=true
        for d in "$path/.worktrees"/*/; do
          [[ -d "$d" ]] || continue
          bead_name="$(basename "$d")"
          [[ "$bead_name" == .* ]] && continue
          wt_branch="$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
          if [[ "$wt_branch" == work/"$goal_name"/* ]]; then
            status="$(_worker_status "$d")"
            $first_bead || printf ','
            first_bead=false
            printf '{"name":"%s","status":"%s","branch":"%s"}' "$bead_name" "$status" "$wt_branch"
          fi
        done
        printf ']}'
      done
    fi
    printf ']}'
  done
  printf ']}\n'
  exit 0
fi

# ── Breadcrumb mode (for tmux status-left) ────────────────────────────────

if [[ "${1:-}" == "--breadcrumb" ]]; then
  # Derive breadcrumb from active window name + pane title
  local_session="${ORC_TMUX_SESSION:-orc}"
  win_name="$(tmux display-message -t "${local_session}" -p '#{window_name}' 2>/dev/null || echo "")"
  pane_title="$(tmux display-message -t "${local_session}" -p '#{pane_title}' 2>/dev/null || echo "")"

  accent="$(_config_get "theme.accent" "#00ff88")"
  bg="$(_config_get "theme.bg" "#0d1117")"
  fg="$(_config_get "theme.fg" "#8b949e")"

  # Build segments from window name (format: project/goal or just project)
  segments=()
  if [[ "$win_name" == *"/"* ]]; then
    project="${win_name%%/*}"
    goal="${win_name#*/}"
    segments+=("$project" "$goal")
    # If focused pane is an engineer, extract bead from title
    if [[ "$pane_title" == eng:* ]]; then
      bead="${pane_title#eng: }"
      bead="${bead%% *}"  # trim anything after first space
      segments+=("$bead")
    fi
  elif [[ "$win_name" == "status" ]]; then
    segments+=("status")
  elif [[ -n "$win_name" && "$win_name" != "orc" ]]; then
    # Project orchestrator window (just the project name)
    segments+=("$win_name")
  fi

  # Build breadcrumb string — only the path segments AFTER "⚔ orc"
  # (the "⚔ orc" / "⚔ ORC" prefix is rendered by the status-left format
  # with the prefix indicator conditional, not by this script)
  crumb=""
  if (( ${#segments[@]} > 0 )); then
    for seg in "${segments[@]}"; do
      crumb+=" #[fg=${fg}]▸ #[fg=${accent}]${seg}"
    done
  fi
  crumb+=" #[fg=${fg}]▸"

  # Truncate from left if too long (preserve rightmost segments)
  max_len=50  # leave room for "⚔ orc" prefix + padding
  stripped="$(echo "$crumb" | sed 's/#\[[^]]*\]//g')"  # strip tmux color codes for length check
  n=${#segments[@]}
  if (( ${#stripped} > max_len && n >= 2 )); then
    crumb=" #[fg=${fg}]…▸ #[fg=${accent}]${segments[n-2]} #[fg=${fg}]▸ #[fg=${accent}]${segments[n-1]} #[fg=${fg}]▸"
  fi

  printf '%s' "$crumb"
  exit 0
fi

# ── Status line mode (for tmux status-right) ──────────────────────────────

if [[ "${1:-}" == "--line" ]]; then
  working=0; review=0; blocked=0; dead=0; goals=0
  goal_review=0; goal_blocked=0; goal_done=0
  for key in $(_project_keys); do
    path="$(_project_path "$key")"
    # Count goals and their statuses from orc-state directory
    if [[ -d "$path/.worktrees/.orc-state/goals" ]]; then
      for gd in "$path/.worktrees/.orc-state/goals"/*/; do
        [[ -d "$gd" ]] || continue
        ((goals++)) || true
        gs="$(head -1 "$gd/.worker-status" 2>/dev/null || echo "unknown")"
        case "$gs" in
          review*)   ((goal_review++)) || true ;;
          blocked*)  ((goal_blocked++)) || true ;;
          done*)     ((goal_done++)) || true ;;
        esac
      done
    fi
    # Fall back to branch counting if no orc-state exists
    if [[ ! -d "$path/.worktrees/.orc-state/goals" ]]; then
      goal_branches="$(git -C "$path" for-each-ref --format='%(refname:short)' \
        'refs/heads/feat/' 'refs/heads/fix/' 'refs/heads/task/' 2>/dev/null || true)"
      if [[ -n "$goal_branches" ]]; then
        goals=$(( goals + $(echo "$goal_branches" | wc -l | tr -d ' ') ))
      fi
    fi
    for d in "$path/.worktrees"/*/; do
      [[ -d "$d" ]] || continue
      [[ "$(basename "$d")" == .* ]] && continue
      status="$(_worker_status "$d")"
      case "$status" in
        working*)  ((working++)) || true ;;
        review*)   ((review++)) || true ;;
        blocked*)  ((blocked++)) || true ;;
        done*)     ;; # completed — not counted in active totals
        *)         ((dead++)) || true ;;
      esac
    done
  done
  # Read theme colors for tmux status-right formatting
  c_accent="$(_config_get "theme.accent" "#00ff88")"
  c_fg="$(_config_get "theme.fg" "#8b949e")"
  c_activity="$(_config_get "theme.activity" "#d29922")"
  c_error="#f85149"

  parts=()
  # Notification count
  notify_count="$(_orc_notify_active_count 2>/dev/null || echo 0)"
  if (( notify_count > 0 )); then
    parts+=("#[fg=${c_activity}]● ${notify_count} active#[fg=${c_fg}]")
  fi
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
  (( working > 0 )) && parts+=("#[fg=${c_accent}]${working} ● working#[fg=${c_fg}]")
  (( review > 0 ))  && parts+=("#[fg=${c_activity}]${review} ✓ review#[fg=${c_fg}]")
  (( blocked > 0 )) && parts+=("#[fg=${c_error}]${blocked} ✗ blocked#[fg=${c_fg}]")
  (( dead > 0 ))    && parts+=("#[fg=${c_error}]${dead} ✗ dead#[fg=${c_fg}]")
  line_out=""
  if (( ${#parts[@]} > 0 )); then
    line_out="${parts[*]}"
  else
    line_out="idle"
  fi

  # Help hint (tui.show_help_hint)
  show_hint="$(_config_get "tui.show_help_hint" "true")"
  tui_enabled="$(_config_get "tui.enabled" "true")"
  if [[ "$show_hint" == "true" && "$tui_enabled" == "true" ]]; then
    c_muted="$(_config_get "theme.muted" "#6e7681")"
    kb_enabled="$(_config_get "keybindings.enabled" "false")"
    hint_key="^b ?"
    [[ "$kb_enabled" == "true" ]] && hint_key="Alt+?"
    line_out+=" #[fg=${c_muted}]│ ${hint_key} help"
  fi

  printf '%s' "$line_out"
  exit 0
fi

# ── Full dashboard mode ───────────────────────────────────────────────────

keys="$(_project_keys)"
total_projects=0
total_workers=0
needs_attention=0

# Count first
for key in $keys; do
  ((total_projects++)) || true
  path="$(_project_path "$key")"
  [[ -d "$path/.worktrees" ]] || continue
  for d in "$path/.worktrees"/*/; do
    [[ -d "$d" ]] || continue
    [[ "$(basename "$d")" == .* ]] && continue
    ((total_workers++)) || true
    status="$(_worker_status "$d")"
    case "$status" in
      blocked*|unknown) ((needs_attention++)) || true ;;
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

  # Collect workers grouped by goal (portable — no associative arrays)
  goal_tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/orc-status-XXXXXX")"
  ungrouped=""
  goal_names=""

  for d in "$path/.worktrees"/*/; do
    [[ -d "$d" ]] || continue
    bead_name="$(basename "$d")"
    # Skip internal state directories (not worktrees)
    [[ "$bead_name" == .* ]] && continue
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

    # Group by goal using temp files (one file per goal)
    if [[ "$wt_branch" == work/*/* ]]; then
      goal_name="${wt_branch#work/}"
      goal_name="${goal_name%/*}"
      echo "$entry" >> "$goal_tmpdir/$goal_name"
      # Track unique goal names
      if ! echo "$goal_names" | grep -qxF "$goal_name"; then
        goal_names="${goal_names:+$goal_names
}$goal_name"
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

  # Print goal-grouped workers (sorted)
  sorted_goals=""
  sorted_goals="$(echo "$goal_names" | sort)"
  while IFS= read -r goal_name; do
    [[ -z "$goal_name" ]] && continue
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

    # Goal elapsed time from orc-state
    goal_elapsed=""
    goal_status_file="$path/.worktrees/.orc-state/goals/$goal_name/.worker-status"
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
    done < "$goal_tmpdir/$goal_name"
    printf '  └\n'
  done <<< "$sorted_goals"

  # Clean up temp dir
  rm -rf "$goal_tmpdir"

  # Print ungrouped workers (no goal)
  if [[ -n "$ungrouped" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] && printf '  %s\n' "$line"
    done <<< "$ungrouped"
  fi

  unset goal_map
done
echo ""
