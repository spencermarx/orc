#!/usr/bin/env bash
# halt.sh — Stop an engineer gracefully.

set -euo pipefail

if [[ $# -ne 2 ]]; then
  _die "Usage: orc halt <project> <bead>" "$EXIT_USAGE"
fi

project="$1"
bead="$2"

project_path="$(_require_project "$project")"

# Detect window name from worktree branch (handles both work/<bead> and work/<goal>/<bead>)
worktree_dir="$project_path/.worktrees/$bead"
window_name="${project}/${bead}"
if [[ -d "$worktree_dir" ]]; then
  actual_branch="$(git -C "$worktree_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ "$actual_branch" == work/*/* ]]; then
    goal_from_branch="${actual_branch#work/}"
    goal_from_branch="${goal_from_branch%/*}"
    window_name="${project}/${goal_from_branch}/${bead}"
  fi
fi

if ! _tmux_window_exists "$window_name"; then
  _die "No running window for '$window_name'." "$EXIT_STATE"
fi

# Send Ctrl-C to the engineering pane
# Find engineering pane by title, fallback to pane 0
eng_pane="$(_tmux_find_pane "$window_name" "eng:")"
eng_pane="${eng_pane:-0}"
tmux send-keys -t "$(_tmux_target "$window_name" "$eng_pane")" C-c

_info "Sent interrupt to engineer '$project/$bead'."
