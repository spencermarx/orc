#!/usr/bin/env bash
# teardown.sh — Hierarchical cleanup (bead, goal, project, or everything).

set -euo pipefail

# --force or ORC_YOLO skip confirmation
force=0
[[ "${ORC_YOLO:-0}" == "1" ]] && force=1
args=()
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    *)       args+=("$arg") ;;
  esac
done
set -- "${args[@]+"${args[@]}"}"

_teardown_bead() {
  local project="$1"
  local bead="$2"
  local project_path
  project_path="$(_require_project "$project")"
  local worktree="$project_path/.worktrees/$bead"

  # Detect the actual branch name from the worktree (handles both work/<bead> and work/<goal>/<bead>)
  local actual_branch=""
  if [[ -d "$worktree" ]]; then
    actual_branch="$(git -C "$worktree" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  fi

  # Detect goal from branch pattern work/<goal>/<bead>
  local goal_from_branch=""
  if [[ "$actual_branch" == work/*/* ]] && [[ "$actual_branch" != work/*//* ]]; then
    goal_from_branch="${actual_branch#work/}"
    goal_from_branch="${goal_from_branch%/*}"
  fi

  if [[ -n "$goal_from_branch" ]]; then
    # ── Pane-based: engineer is a pane inside the goal window ──
    local goal_window="${project}/${goal_from_branch}"
    local pane_title="eng: ${bead}"

    # Search goal window and overflow windows for the engineer pane
    local found_window="" found_pane=""
    _find_eng_pane() {
      local win="$1"
      local idx
      idx="$(_tmux_find_pane "$win" "$pane_title")"
      if [[ -n "$idx" ]]; then
        found_window="$win"
        found_pane="$idx"
        return 0
      fi
      return 1
    }

    if _tmux_window_exists "$goal_window" && _find_eng_pane "$goal_window"; then
      : # found in primary goal window
    else
      # Check overflow windows for the goal window
      local overflow
      overflow="$(_tmux_overflow_windows "$goal_window")"
      while IFS= read -r win; do
        [[ -z "$win" ]] && continue
        if _find_eng_pane "$win"; then
          break
        fi
      done <<< "$overflow"
    fi

    if [[ -n "$found_pane" ]]; then
      # Kill the engineer pane (and any review pane associated with it)
      # First kill any review pane for this bead
      _tmux_kill_pane_by_title "$found_window" "review: ${project}/${bead}"

      # Re-discover the engineer pane index (may have shifted after killing review pane)
      found_pane="$(_tmux_find_pane "$found_window" "$pane_title")"
      if [[ -n "$found_pane" ]]; then
        _pane_registry_remove "$found_window" "$found_pane"
        _tmux_kill_pane "$found_window" "$found_pane"
      fi

      # Rebalance the window (if it still has panes)
      if _tmux_window_exists "$found_window"; then
        local remaining
        remaining="$(_tmux_pane_count "$found_window")"
        if [[ "$remaining" -gt 0 ]]; then
          _tmux_rebalance "$found_window"
        fi
      fi

      # If the goal window (or overflow) is now empty, tmux kills it automatically.
      # Clean up any empty overflow windows that linger.
      local overflow_win
      overflow="$(_tmux_overflow_windows "$goal_window")"
      while IFS= read -r overflow_win; do
        [[ -z "$overflow_win" ]] && continue
        if _tmux_window_exists "$overflow_win"; then
          local oc
          oc="$(_tmux_pane_count "$overflow_win")"
          if [[ "$oc" -le 1 ]]; then
            # Single idle shell — no agents left, safe to remove
            if ! _tmux_is_pane_alive "$overflow_win" 0 2>/dev/null; then
              _tmux_kill_window "$overflow_win"
              _pane_registry_clear "$overflow_win"
            fi
          fi
        fi
      done <<< "$overflow"
    fi
  else
    # ── Legacy: engineer owns its own window ──
    local window_name="${project}/${bead}"
    _tmux_kill_window "$window_name"
  fi

  # Adapter post-teardown hook (cleanup CLI-specific files)
  if [[ -d "$worktree" ]]; then
    _load_adapter "$project_path"
    _adapter_post_teardown "$worktree" 2>/dev/null || _warn "Adapter post-teardown hook failed (non-fatal)."
  fi

  # Remove git worktree
  if [[ -d "$worktree" ]]; then
    git -C "$project_path" worktree remove ".worktrees/$bead" --force 2>/dev/null || true
  fi

  # Delete the branch (use detected name, fall back to work/<bead>)
  local branch_to_delete="${actual_branch:-work/$bead}"
  git -C "$project_path" branch -D "$branch_to_delete" 2>/dev/null || true

  _info "Torn down bead '$bead'${goal_from_branch:+ (goal: $goal_from_branch)} in project '$project'."
}

_teardown_goal() {
  local project="$1"
  local goal="$2"
  local project_path
  project_path="$(_require_project "$project")"
  local worktrees_dir="$project_path/.worktrees"
  local goal_window="${project}/${goal}"

  # ── 1. Kill all engineer panes + remove worktrees + delete branches ──

  if [[ -d "$worktrees_dir" ]]; then
    for d in "$worktrees_dir"/*/; do
      [[ -d "$d" ]] || continue
      local bead_name
      bead_name="$(basename "$d")"
      # Check if this worktree's branch matches work/<goal>/*
      local wt_branch
      wt_branch="$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
      if [[ "$wt_branch" == "work/${goal}/"* ]]; then
        # Kill engineer pane by title (in goal window or overflow)
        local pane_title="eng: ${bead_name}"
        local eng_win eng_pane

        # Search goal window and overflows for the engineer pane
        for search_win in "$goal_window" $(_tmux_overflow_windows "$goal_window"); do
          [[ -z "$search_win" ]] && continue
          _tmux_window_exists "$search_win" || continue
          eng_pane="$(_tmux_find_pane "$search_win" "$pane_title")"
          if [[ -n "$eng_pane" ]]; then
            eng_win="$search_win"
            break
          fi
        done

        if [[ -n "${eng_pane:-}" ]]; then
          # Kill review pane first (if any)
          _tmux_kill_pane_by_title "$eng_win" "review: ${project}/${bead_name}"
          # Re-find engineer pane (index may have shifted)
          eng_pane="$(_tmux_find_pane "$eng_win" "$pane_title")"
          [[ -n "$eng_pane" ]] && {
            _pane_registry_remove "$eng_win" "$eng_pane"
            _tmux_kill_pane "$eng_win" "$eng_pane"
          }
        fi

        # Adapter post-teardown hook
        _load_adapter "$project_path"
        _adapter_post_teardown "$d" 2>/dev/null || true

        # Remove worktree and branch
        git -C "$project_path" worktree remove ".worktrees/$bead_name" --force 2>/dev/null || true
        git -C "$project_path" branch -D "$wt_branch" 2>/dev/null || true
        _info "Torn down engineer '$bead_name'."
      fi
    done
  fi

  # ── 2. Kill goal window and any overflow windows ──

  # Kill overflow windows first
  local overflow_win
  for overflow_win in $(_tmux_overflow_windows "$goal_window"); do
    [[ -z "$overflow_win" ]] && continue
    _tmux_kill_window "$overflow_win"
    _pane_registry_clear "$overflow_win"
  done

  # Kill the primary goal window (if it still exists — may already be gone if all panes were killed)
  _tmux_kill_window "$goal_window"
  _pane_registry_clear "$goal_window"

  # ── 3. Delete any remaining work/<goal>/* branches (orphaned, already merged) ──

  local remaining_branches
  remaining_branches="$(git -C "$project_path" for-each-ref --format='%(refname:short)' "refs/heads/work/${goal}/" 2>/dev/null || true)"
  if [[ -n "$remaining_branches" ]]; then
    while IFS= read -r branch; do
      [[ -n "$branch" ]] && git -C "$project_path" branch -D "$branch" 2>/dev/null || true
    done <<< "$remaining_branches"
  fi

  # ── 4. Kill goal orchestrator pane in project window ──

  local goal_pane_title="goal: ${goal}"
  local proj_win proj_pane

  # Search project window and overflows
  for search_win in "$project" $(_tmux_overflow_windows "$project"); do
    [[ -z "$search_win" ]] && continue
    _tmux_window_exists "$search_win" || continue
    proj_pane="$(_tmux_find_pane "$search_win" "$goal_pane_title")"
    if [[ -n "$proj_pane" ]]; then
      proj_win="$search_win"
      break
    fi
  done

  if [[ -n "${proj_pane:-}" ]]; then
    _pane_registry_remove "$proj_win" "$proj_pane"
    _tmux_kill_pane "$proj_win" "$proj_pane"

    # Rebalance project window
    if _tmux_window_exists "$proj_win"; then
      local remaining
      remaining="$(_tmux_pane_count "$proj_win")"
      if [[ "$remaining" -gt 0 ]]; then
        _tmux_rebalance "$proj_win"
      fi
    fi
  fi

  # ── 5. Delete the goal branch itself ──

  local goal_branch
  goal_branch="$(_find_goal_branch "$project_path" "$goal" 2>/dev/null || true)"
  if [[ -n "$goal_branch" ]]; then
    git -C "$project_path" branch -D "$goal_branch" 2>/dev/null || true
    _info "Deleted branch '${goal_branch}'."
  fi

  # ── 6. Remove goal status directory ──

  local goal_status_dir
  goal_status_dir="$(_goal_status_dir "$project_path" "$goal")"
  if [[ -d "$goal_status_dir" ]]; then
    rm -rf "$goal_status_dir"
  fi

  _info "Torn down goal '$goal' in project '$project'."
}

_teardown_project() {
  local project="$1"
  local project_path
  project_path="$(_require_project "$project")"
  local worktrees_dir="$project_path/.worktrees"

  # Collect goals to teardown (deduplicating via newline-separated list)
  local goals_seen=""

  if [[ -d "$worktrees_dir" ]]; then
    for d in "$worktrees_dir"/*/; do
      [[ -d "$d" ]] || continue
      local bead
      bead="$(basename "$d")"
      local wt_branch
      wt_branch="$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
      if [[ "$wt_branch" == work/*/* ]] && [[ "$wt_branch" != work/*//* ]]; then
        local goal_name="${wt_branch#work/}"
        goal_name="${goal_name%/*}"
        # Deduplicate
        if ! echo "$goals_seen" | grep -qxF "$goal_name"; then
          goals_seen="${goals_seen:+$goals_seen
}$goal_name"
        fi
      else
        # Legacy non-goal bead — teardown directly
        _teardown_bead "$project" "$bead"
      fi
    done
  fi

  # Teardown each goal (handles engineer panes, goal windows, goal panes, goal status dirs)
  if [[ -n "$goals_seen" ]]; then
    local goal_name
    while IFS= read -r goal_name; do
      [[ -n "$goal_name" ]] && _teardown_goal "$project" "$goal_name"
    done <<< "$goals_seen"
  fi

  # Remove orc runtime state inside the gitignored .worktrees/ directory
  if [[ -d "$project_path/.worktrees/.orc-state" ]]; then
    rm -rf "$project_path/.worktrees/.orc-state"
  fi
  # Clean up legacy .goals/ if present (from earlier versions)
  if [[ -d "$project_path/.goals" ]]; then
    rm -rf "$project_path/.goals"
  fi

  # Kill any remaining goal windows (pattern: project/<goal> and overflow)
  local remaining_windows
  remaining_windows="$(tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -E "^${project}/[^/]+$" || true)"
  if [[ -n "$remaining_windows" ]]; then
    while IFS= read -r win; do
      [[ -n "$win" ]] && {
        _tmux_kill_window "$win"
        _pane_registry_clear "$win"
      }
    done <<< "$remaining_windows"
  fi

  # Delete all goal branches (feat/*, fix/*, task/*) and any remaining work/* branches
  local branches_to_delete
  branches_to_delete="$(git -C "$project_path" for-each-ref --format='%(refname:short)' \
    'refs/heads/feat/' 'refs/heads/fix/' 'refs/heads/task/' 'refs/heads/work/' 2>/dev/null || true)"
  if [[ -n "$branches_to_delete" ]]; then
    while IFS= read -r branch; do
      [[ -n "$branch" ]] && git -C "$project_path" branch -D "$branch" 2>/dev/null || true
    done <<< "$branches_to_delete"
  fi

  # Kill project orchestrator window and clear its pane registry
  _tmux_kill_window "$project"
  _pane_registry_clear "$project"

  # Kill project overflow windows
  local overflow_win
  for overflow_win in $(_tmux_overflow_windows "$project"); do
    [[ -z "$overflow_win" ]] && continue
    _tmux_kill_window "$overflow_win"
    _pane_registry_clear "$overflow_win"
  done

  # Kill board window
  _tmux_kill_window "${project}/board"

  _info "Torn down project '$project'."
}

_teardown_all() {
  for key in $(_project_keys); do
    _teardown_project "$key"
  done

  _tmux_kill_window "status"
  _tmux_kill_window "orc"

  tmux kill-session -t "$ORC_TMUX_SESSION" 2>/dev/null || true
  _info "Torn down everything. Clean slate."
}

if [[ $# -eq 2 ]]; then
  # orc teardown <project> <bead-or-goal>
  # Detect whether arg is a bead (worktree exists) or a goal (goal branch exists)
  project_path="$(_require_project "$1")"
  worktree="$project_path/.worktrees/$2"

  if [[ -d "$worktree" ]]; then
    # It's a bead
    if [[ "$force" -eq 0 ]]; then
      printf '%s' "[orc] Teardown $1/$2? This will kill the agent and remove the worktree. [y/N] "
      read -r answer
      [[ "$answer" =~ ^[Yy] ]] || { _info "Cancelled."; exit "$EXIT_OK"; }
    fi
    _teardown_bead "$1" "$2"
  elif _goal_branch_exists "$project_path" "$2"; then
    # It's a goal
    if [[ "$force" -eq 0 ]]; then
      printf '%s' "[orc] Teardown goal '$2' in '$1'? This will kill all agents under the goal, remove worktrees, and delete goal branches. [y/N] "
      read -r answer
      [[ "$answer" =~ ^[Yy] ]] || { _info "Cancelled."; exit "$EXIT_OK"; }
    fi
    _teardown_goal "$1" "$2"
  else
    _die "No bead worktree or goal branch found for '$2' in project '$1'." "$EXIT_STATE"
  fi
elif [[ $# -eq 1 ]]; then
  # orc teardown <project>
  project_path="$(_require_project "$1")"
  workers="$(_worker_count "$project_path")"
  if [[ "$force" -eq 0 ]]; then
    printf '%s' "[orc] Teardown '$1'? This will kill $workers agent(s) and remove all worktrees. [y/N] "
    read -r answer
    [[ "$answer" =~ ^[Yy] ]] || { _info "Cancelled."; exit "$EXIT_OK"; }
  fi
  _teardown_project "$1"
elif [[ $# -eq 0 ]]; then
  # orc teardown (nuclear)
  if [[ "$force" -eq 0 ]]; then
    printf '%s' "[orc] Teardown EVERYTHING? This kills all agents, removes all worktrees, and destroys the session. [y/N] "
    read -r answer
    [[ "$answer" =~ ^[Yy] ]] || { _info "Cancelled."; exit "$EXIT_OK"; }
  fi
  _teardown_all
else
  _die "Usage: orc teardown [project] [bead|goal] [--force]" "$EXIT_USAGE"
fi
