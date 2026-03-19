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

  # Detect the correct window name by checking if branch follows work/<goal>/<bead> pattern
  local window_name="${project}/${bead}"
  if [[ "$actual_branch" == work/*//* ]]; then
    # Should not happen — but guard against double-slash
    :
  elif [[ "$actual_branch" == work/*/* ]]; then
    # Branch is work/<goal>/<bead> — window is <project>/<goal>/<bead>
    local goal_from_branch="${actual_branch#work/}"
    goal_from_branch="${goal_from_branch%/*}"
    window_name="${project}/${goal_from_branch}/${bead}"
  fi

  # Kill the entire window (kills all panes — engineering + any review panes)
  _tmux_kill_window "$window_name"

  # Remove git worktree
  if [[ -d "$worktree" ]]; then
    git -C "$project_path" worktree remove ".worktrees/$bead" --force 2>/dev/null || true
  fi

  # Delete the branch (use detected name, fall back to work/<bead>)
  local branch_to_delete="${actual_branch:-work/$bead}"
  git -C "$project_path" branch -D "$branch_to_delete" 2>/dev/null || true

  _info "Torn down '$window_name'."
}

_teardown_goal() {
  local project="$1"
  local goal="$2"
  local project_path
  project_path="$(_require_project "$project")"
  local worktrees_dir="$project_path/.worktrees"

  # Teardown all beads belonging to this goal
  if [[ -d "$worktrees_dir" ]]; then
    for d in "$worktrees_dir"/*/; do
      [[ -d "$d" ]] || continue
      local bead_name
      bead_name="$(basename "$d")"
      # Check if this worktree's branch matches work/<goal>/*
      local wt_branch
      wt_branch="$(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
      if [[ "$wt_branch" == "work/${goal}/"* ]]; then
        # Kill window, remove worktree, delete branch
        _tmux_kill_window "${project}/${goal}/${bead_name}"
        git -C "$project_path" worktree remove ".worktrees/$bead_name" --force 2>/dev/null || true
        git -C "$project_path" branch -D "$wt_branch" 2>/dev/null || true
        _info "Torn down '${project}/${goal}/${bead_name}'."
      fi
    done
  fi

  # Delete any remaining work/<goal>/* branches (orphaned, already merged, etc.)
  local remaining_branches
  remaining_branches="$(git -C "$project_path" for-each-ref --format='%(refname:short)' "refs/heads/work/${goal}/" 2>/dev/null || true)"
  if [[ -n "$remaining_branches" ]]; then
    while IFS= read -r branch; do
      [[ -n "$branch" ]] && git -C "$project_path" branch -D "$branch" 2>/dev/null || true
    done <<< "$remaining_branches"
  fi

  # Kill goal orchestrator window
  _tmux_kill_window "${project}/${goal}"

  # Delete the goal branch itself
  local goal_branch
  goal_branch="$(_find_goal_branch "$project_path" "$goal" 2>/dev/null || true)"
  if [[ -n "$goal_branch" ]]; then
    git -C "$project_path" branch -D "$goal_branch" 2>/dev/null || true
    _info "Deleted branch '${goal_branch}'."
  fi

  _info "Torn down goal '$goal' in project '$project'."
}

_teardown_project() {
  local project="$1"
  local project_path
  project_path="$(_require_project "$project")"
  local worktrees_dir="$project_path/.worktrees"

  # Teardown all beads (handles both goal and non-goal beads)
  if [[ -d "$worktrees_dir" ]]; then
    for d in "$worktrees_dir"/*/; do
      [[ -d "$d" ]] || continue
      local bead
      bead="$(basename "$d")"
      _teardown_bead "$project" "$bead"
    done
  fi

  # Kill any goal orchestrator windows (pattern: project/*)
  local goal_windows
  goal_windows="$(tmux list-windows -t "$ORC_TMUX_SESSION" -F '#{window_name}' 2>/dev/null \
    | grep -E "^${project}/[^/]+$" || true)"
  if [[ -n "$goal_windows" ]]; then
    while IFS= read -r win; do
      [[ -n "$win" ]] && _tmux_kill_window "$win"
    done <<< "$goal_windows"
  fi

  # Delete all goal branches (feat/*, fix/*, task/*) — only those related to this project's goals
  # Also delete any remaining work/* branches
  local branches_to_delete
  branches_to_delete="$(git -C "$project_path" for-each-ref --format='%(refname:short)' \
    'refs/heads/feat/' 'refs/heads/fix/' 'refs/heads/task/' 'refs/heads/work/' 2>/dev/null || true)"
  if [[ -n "$branches_to_delete" ]]; then
    while IFS= read -r branch; do
      [[ -n "$branch" ]] && git -C "$project_path" branch -D "$branch" 2>/dev/null || true
    done <<< "$branches_to_delete"
  fi

  # Kill project orchestrator window
  _tmux_kill_window "$project"

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
