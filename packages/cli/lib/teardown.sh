#!/usr/bin/env bash
# teardown.sh — Hierarchical cleanup (bead, project, or everything).

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

  local window_name="${project}/${bead}"

  # Kill the entire window (kills all panes — engineering + any review panes)
  _tmux_kill_window "$window_name"

  # Remove git worktree
  if [[ -d "$worktree" ]]; then
    git -C "$project_path" worktree remove ".worktrees/$bead" --force 2>/dev/null || true
  fi

  # Delete the branch
  git -C "$project_path" branch -D "work/$bead" 2>/dev/null || true

  _info "Torn down '$project/$bead'."
}

_teardown_project() {
  local project="$1"
  local project_path
  project_path="$(_require_project "$project")"
  local worktrees_dir="$project_path/.worktrees"

  # Teardown all beads
  if [[ -d "$worktrees_dir" ]]; then
    for d in "$worktrees_dir"/*/; do
      [[ -d "$d" ]] || continue
      local bead
      bead="$(basename "$d")"
      _teardown_bead "$project" "$bead"
    done
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
  # orc teardown <project> <bead>
  if [[ "$force" -eq 0 ]]; then
    printf '%s' "[orc] Teardown $1/$2? This will kill the agent and remove the worktree. [y/N] "
    read -r answer
    [[ "$answer" =~ ^[Yy] ]] || { _info "Cancelled."; exit "$EXIT_OK"; }
  fi
  _teardown_bead "$1" "$2"
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
  _die "Usage: orc teardown [project] [bead] [--force]" "$EXIT_USAGE"
fi
